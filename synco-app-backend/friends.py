from datetime import datetime, timedelta

from flask import (
    Blueprint,
    jsonify,
    request,
    session
)

from models import (
    db,
    User,
    FriendRequest,
    Friendship,
    Notification
)

from rewards import process_synco_event


# =========================================================
# FRIENDS BLUEPRINT
# =========================================================

friends_bp = Blueprint(
    "friends",
    __name__,
    url_prefix="/api/friends"
)


# =========================================================
# ONLINE PRESENCE
# =========================================================
#
# Presence is kept in a separate table so the existing users
# table does not need to be changed just to support online
# status. A player is considered online only while their
# heartbeat is recent.
#
# Frontend heartbeat interval: ~20 seconds
# Online timeout: 45 seconds
# =========================================================

ONLINE_TIMEOUT_SECONDS = 45


class UserPresence(db.Model):

    __tablename__ = "user_presence"

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )

    is_online = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True
    )

    last_seen_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True
    )


def presence_state(presence, now=None):

    now = now or datetime.utcnow()

    if not presence or not presence.last_seen_at:
        return False

    age = now - presence.last_seen_at

    return bool(
        presence.is_online
        and age <= timedelta(
            seconds=ONLINE_TIMEOUT_SECONDS
        )
    )


def get_presence_map(user_ids):

    if not user_ids:
        return {}

    rows = (
        UserPresence.query
        .filter(
            UserPresence.user_id.in_(user_ids)
        )
        .all()
    )

    now = datetime.utcnow()

    return {
        row.user_id: {
            "isOnline": presence_state(
                row,
                now
            ),
            "lastSeenAt": (
                row.last_seen_at.isoformat()
                if row.last_seen_at
                else None
            ),
        }
        for row in rows
    }


# =========================================================
# CURRENT USER HELPER
# =========================================================

def get_current_user():

    session_user = session.get("user")

    if not session_user:
        return None

    user_id = session_user.get("id")

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id
    )


# =========================================================
# PUBLIC PLAYER SERIALIZATION
# =========================================================

def player_to_dict(user, presence=None):

    result = {
        "id": user.id,
        "uid": user.uid,
        "username": user.username,
        "name": user.name,
        "avatar": user.avatar,
        "level": user.level,
        "xp": user.xp
    }

    if presence is not None:
        result["isOnline"] = bool(
            presence.get("isOnline")
        )
        result["online"] = bool(
            presence.get("isOnline")
        )
        result["lastSeenAt"] = presence.get(
            "lastSeenAt"
        )

    return result


# =========================================================
# CHECK FRIENDSHIP
# =========================================================

def are_friends(user_id, friend_id):

    friendship = Friendship.query.filter(
        db.or_(
            db.and_(
                Friendship.user_id == user_id,
                Friendship.friend_id == friend_id
            ),
            db.and_(
                Friendship.user_id == friend_id,
                Friendship.friend_id == user_id
            )
        )
    ).first()

    return friendship is not None


# =========================================================
# FIND PENDING REQUEST
# =========================================================

def get_pending_request(user_id, other_user_id):

    return FriendRequest.query.filter(
        FriendRequest.status == "PENDING",
        db.or_(
            db.and_(
                FriendRequest.sender_id == user_id,
                FriendRequest.receiver_id == other_user_id
            ),
            db.and_(
                FriendRequest.sender_id == other_user_id,
                FriendRequest.receiver_id == user_id
            )
        )
    ).first()


# =========================================================
# PRESENCE HEARTBEAT
# =========================================================

@friends_bp.route(
    "/presence/heartbeat",
    methods=["POST"]
)
def presence_heartbeat():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    now = datetime.utcnow()

    presence = db.session.get(
        UserPresence,
        current_user.id
    )

    if not presence:

        presence = UserPresence(
            user_id=current_user.id,
            is_online=True,
            last_seen_at=now
        )

        db.session.add(presence)

    else:

        presence.is_online = True
        presence.last_seen_at = now

    db.session.commit()

    return jsonify({
        "success": True,
        "isOnline": True,
        "lastSeenAt": now.isoformat()
    })


# =========================================================
# SEARCH PLAYERS
# =========================================================

@friends_bp.route("/search", methods=["GET"])
def search_players():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    query = request.args.get(
        "q",
        ""
    ).strip()

    if not query:
        return jsonify({
            "success": True,
            "players": []
        })

    uid_query = query.upper()
    username_query = query

    users = User.query.filter(
        User.id != current_user.id,
        db.or_(
            User.uid == uid_query,
            User.username.ilike(
                f"%{username_query}%"
            ),
            User.name.ilike(
                f"%{username_query}%"
            )
        )
    ).limit(20).all()

    presence_map = get_presence_map(
        [user.id for user in users]
    )

    results = []

    for user in users:

        request_status = None
        request_direction = None

        if are_friends(
            current_user.id,
            user.id
        ):

            request_status = "FRIENDS"

        else:

            pending_request = get_pending_request(
                current_user.id,
                user.id
            )

            if pending_request:

                request_status = "PENDING"

                if (
                    pending_request.sender_id
                    == current_user.id
                ):

                    request_direction = "SENT"

                else:

                    request_direction = "RECEIVED"

        player_data = player_to_dict(
            user,
            presence_map.get(user.id)
        )

        player_data["friendStatus"] = request_status
        player_data["requestDirection"] = request_direction

        results.append(
            player_data
        )

    return jsonify({
        "success": True,
        "players": results
    })


# =========================================================
# UPDATE FRIEND REQUEST NOTIFICATION
# =========================================================

def update_friend_request_notification(
    request_id,
    user_id,
    notification_type,
    title,
    message,
    action_status,
):

    notification = Notification.query.filter_by(
        user_id=user_id,
        reference_type="FRIEND_REQUEST",
        reference_id=request_id,
    ).first()

    if not notification:
        return

    existing_data = notification.data or {}

    notification.data = {
        **existing_data,
        "actionStatus": action_status,
        "action_status": action_status,
        "requestStatus": notification_type,
        "request_status": notification_type,
    }

    notification.notification_type = notification_type
    notification.title = title
    notification.message = message
    notification.is_read = True


# =========================================================
# SEND FRIEND REQUEST
# =========================================================

@friends_bp.route("/request", methods=["POST"])
def send_friend_request():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    data = request.get_json(
        silent=True
    ) or {}

    target_uid = data.get(
        "uid",
        ""
    ).strip().upper()

    target_username = data.get(
        "username",
        ""
    ).strip()

    if not target_uid and not target_username:

        return jsonify({
            "success": False,
            "message": "UID or username is required"
        }), 400

    target_user = None

    if target_uid:

        target_user = User.query.filter_by(
            uid=target_uid
        ).first()

    elif target_username:

        target_user = User.query.filter(
            db.func.lower(User.username)
            == target_username.lower()
        ).first()

    if not target_user:

        return jsonify({
            "success": False,
            "message": "Player not found"
        }), 404

    if target_user.id == current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot add yourself"
        }), 400

    if are_friends(
        current_user.id,
        target_user.id
    ):

        return jsonify({
            "success": False,
            "message": "You are already friends"
        }), 409

    existing_request = get_pending_request(
        current_user.id,
        target_user.id
    )

    if existing_request:

        if existing_request.sender_id == current_user.id:

            return jsonify({
                "success": False,
                "message": "Friend request already sent"
            }), 409

        return jsonify({
            "success": False,
            "message": (
                "This player has already sent "
                "you a friend request"
            ),
            "requestId": existing_request.id
        }), 409

    friend_request = FriendRequest(
        sender_id=current_user.id,
        receiver_id=target_user.id,
        status="PENDING"
    )

    db.session.add(
        friend_request
    )

    db.session.flush()

    notification = Notification(
        user_id=target_user.id,
        notification_type="FRIEND_REQUEST",
        title="New Friend Request",
        message=(
            f"{current_user.name} sent you "
            f"a friend request."
        ),
        reference_type="FRIEND_REQUEST",
        reference_id=friend_request.id,
        data={
            "requestId": friend_request.id,
            "senderId": current_user.id,
            "senderUid": current_user.uid,
            "senderUsername": current_user.username,
            "senderName": current_user.name,
            "senderAvatar": current_user.avatar,
        },
        is_read=False
    )

    db.session.add(
        notification
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Friend request sent",
        "request": friend_request.to_dict()
    }), 201


# =========================================================
# GET FRIEND REQUESTS
# =========================================================

@friends_bp.route("/requests", methods=["GET"])
def get_friend_requests():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    received = FriendRequest.query.filter_by(
        receiver_id=current_user.id,
        status="PENDING"
    ).order_by(
        FriendRequest.created_at.desc()
    ).all()

    sent = FriendRequest.query.filter_by(
        sender_id=current_user.id,
        status="PENDING"
    ).order_by(
        FriendRequest.created_at.desc()
    ).all()

    return jsonify({
        "success": True,

        "received": [
            {
                "id": item.id,
                "status": item.status,
                "createdAt": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
                "player": player_to_dict(
                    item.sender
                )
            }
            for item in received
        ],

        "sent": [
            {
                "id": item.id,
                "status": item.status,
                "createdAt": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
                "player": player_to_dict(
                    item.receiver
                )
            }
            for item in sent
        ]
    })


# =========================================================
# ACCEPT FRIEND REQUEST
# =========================================================

@friends_bp.route(
    "/request/<int:request_id>/accept",
    methods=["POST"]
)
def accept_friend_request(request_id):

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    friend_request = db.session.get(
        FriendRequest,
        request_id
    )

    if not friend_request:

        return jsonify({
            "success": False,
            "message": "Friend request not found"
        }), 404

    if friend_request.receiver_id != current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot accept this request"
        }), 403

    if friend_request.status != "PENDING":

        return jsonify({
            "success": False,
            "message": "This request is no longer pending"
        }), 400

    sender_id = friend_request.sender_id
    receiver_id = friend_request.receiver_id

    # -----------------------------------------------------
    # Check for existing friendship
    # -----------------------------------------------------

    if are_friends(
        sender_id,
        receiver_id
    ):

        friend_request.status = "ACCEPTED"
        friend_request.responded_at = datetime.utcnow()

        update_friend_request_notification(
            request_id=friend_request.id,
            user_id=current_user.id,
            notification_type="FRIEND_ACCEPTED",
            title="Friend Request Accepted",
            message=(
                f"You are already friends with "
                f"{friend_request.sender.name}."
            ),
            action_status="accepted",
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "You are already friends",
            "friend": player_to_dict(
                friend_request.sender
            )
        })

    # -----------------------------------------------------
    # Accept request
    # -----------------------------------------------------

    friend_request.status = "ACCEPTED"
    friend_request.responded_at = datetime.utcnow()

    update_friend_request_notification(
        request_id=friend_request.id,
        user_id=current_user.id,
        notification_type="FRIEND_ACCEPTED",
        title="Friend Request Accepted",
        message=(
            f"You are now friends with "
            f"{friend_request.sender.name}."
        ),
        action_status="accepted",
    )

    # -----------------------------------------------------
    # Create friendship for sender
    # -----------------------------------------------------

    friendship_one = Friendship(
        user_id=sender_id,
        friend_id=receiver_id
    )

    # -----------------------------------------------------
    # Create friendship for receiver
    # -----------------------------------------------------

    friendship_two = Friendship(
        user_id=receiver_id,
        friend_id=sender_id
    )

    db.session.add(
        friendship_one
    )

    db.session.add(
        friendship_two
    )

    db.session.flush()

    # -----------------------------------------------------
    # Commit friendship
    # -----------------------------------------------------

    db.session.commit()

    # =====================================================
    # REWARD
    # =====================================================
    #
    # Sending a friend request:
    #     NO REWARD
    #
    # Accepting the first friendship:
    #     XP + CREDITS
    #
    # rewards.py verifies the actual friendship and
    # prevents duplicate first-friend rewards.
    # =====================================================

    try:

        process_synco_event(
            current_user,
            "FIRST_FRIENDSHIP",
            reference_id=friendship_two.id
        )

    except Exception as reward_error:

        print(
            "[REWARDS] Friendship reward processing failed:",
            reward_error
        )

    return jsonify({
        "success": True,
        "message": "Friend request accepted",
        "friend": player_to_dict(
            friend_request.sender
        )
    })


# =========================================================
# DECLINE FRIEND REQUEST
# =========================================================

@friends_bp.route(
    "/request/<int:request_id>/decline",
    methods=["POST"]
)
def decline_friend_request(request_id):

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    friend_request = db.session.get(
        FriendRequest,
        request_id
    )

    if not friend_request:

        return jsonify({
            "success": False,
            "message": "Friend request not found"
        }), 404

    if friend_request.receiver_id != current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot decline this request"
        }), 403

    if friend_request.status != "PENDING":

        return jsonify({
            "success": False,
            "message": "This request is no longer pending"
        }), 400

    friend_request.status = "DECLINED"
    friend_request.responded_at = datetime.utcnow()

    update_friend_request_notification(
        request_id=friend_request.id,
        user_id=current_user.id,
        notification_type="FRIEND_DECLINED",
        title="Friend Request Declined",
        message="The friend request was declined.",
        action_status="declined",
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Friend request declined"
    })


# =========================================================
# CANCEL SENT FRIEND REQUEST
# =========================================================

@friends_bp.route(
    "/request/<int:request_id>/cancel",
    methods=["POST"]
)
def cancel_friend_request(request_id):

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    friend_request = db.session.get(
        FriendRequest,
        request_id
    )

    if not friend_request:

        return jsonify({
            "success": False,
            "message": "Friend request not found"
        }), 404

    if friend_request.sender_id != current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot cancel this request"
        }), 403

    if friend_request.status != "PENDING":

        return jsonify({
            "success": False,
            "message": "This request is no longer pending"
        }), 400

    friend_request.status = "CANCELLED"
    friend_request.responded_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Friend request cancelled"
    })


# =========================================================
# GET FRIENDS
# =========================================================

@friends_bp.route("", methods=["GET"])
def get_friends():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    friendships = Friendship.query.filter_by(
        user_id=current_user.id
    ).order_by(
        Friendship.created_at.desc()
    ).all()

    friend_ids = [
        friendship.friend_id
        for friendship in friendships
    ]

    presence_map = get_presence_map(
        friend_ids
    )

    friends = []

    for friendship in friendships:

        data = friendship.to_dict()

        friend = data.get("friend")

        presence = presence_map.get(
            friendship.friend_id,
            {
                "isOnline": False,
                "lastSeenAt": None,
            }
        )

        if friend:
            friend["isOnline"] = bool(
                presence.get("isOnline")
            )
            friend["online"] = bool(
                presence.get("isOnline")
            )
            friend["lastSeenAt"] = presence.get(
                "lastSeenAt"
            )

        friends.append(data)

    online_count = sum(
        1
        for item in friends
        if item.get("friend", {}).get(
            "isOnline", False
        )
    )

    return jsonify({
        "success": True,
        "friends": friends,
        "count": len(friends),
        "onlineCount": online_count
    })


# =========================================================
# REMOVE FRIEND
# =========================================================

@friends_bp.route(
    "/<int:friend_id>",
    methods=["DELETE"]
)
def remove_friend(friend_id):

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    if current_user.id == friend_id:

        return jsonify({
            "success": False,
            "message": "Invalid friend"
        }), 400

    friendship_one = Friendship.query.filter_by(
        user_id=current_user.id,
        friend_id=friend_id
    ).first()

    friendship_two = Friendship.query.filter_by(
        user_id=friend_id,
        friend_id=current_user.id
    ).first()

    if not friendship_one and not friendship_two:

        return jsonify({
            "success": False,
            "message": "You are not friends with this player"
        }), 404

    if friendship_one:

        db.session.delete(
            friendship_one
        )

    if friendship_two:

        db.session.delete(
            friendship_two
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Friend removed"
    })