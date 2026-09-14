from datetime import datetime

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
    Friendship
)


# =========================================================
# FRIENDS BLUEPRINT
# =========================================================

friends_bp = Blueprint(
    "friends",
    __name__,
    url_prefix="/api/friends"
)


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

def player_to_dict(user):

    return {
        "id": user.id,
        "uid": user.uid,
        "username": user.username,
        "name": user.name,
        "avatar": user.avatar,
        "level": user.level,
        "xp": user.xp
    }


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

    # -----------------------------------------------------
    # UID SEARCH
    # -----------------------------------------------------

    uid_query = query.upper()

    # -----------------------------------------------------
    # USERNAME SEARCH
    # -----------------------------------------------------

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

    results = []

    for user in users:

        request_status = None
        request_direction = None

        # -------------------------------------------------
        # Existing friendship
        # -------------------------------------------------

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

        player_data = player_to_dict(user)

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

    # -----------------------------------------------------
    # Find target user
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Cannot add yourself
    # -----------------------------------------------------

    if target_user.id == current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot add yourself"
        }), 400

    # -----------------------------------------------------
    # Already friends
    # -----------------------------------------------------

    if are_friends(
        current_user.id,
        target_user.id
    ):

        return jsonify({
            "success": False,
            "message": "You are already friends"
        }), 409

    # -----------------------------------------------------
    # Existing pending request
    # -----------------------------------------------------

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

        else:

            return jsonify({
                "success": False,
                "message": (
                    "This player has already sent "
                    "you a friend request"
                ),
                "requestId": existing_request.id
            }), 409

    # -----------------------------------------------------
    # Create request
    # -----------------------------------------------------

    friend_request = FriendRequest(
        sender_id=current_user.id,
        receiver_id=target_user.id,
        status="PENDING"
    )

    db.session.add(
        friend_request
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

    # -----------------------------------------------------
    # Only receiver can accept
    # -----------------------------------------------------

    if friend_request.receiver_id != current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot accept this request"
        }), 403

    # -----------------------------------------------------
    # Request must be pending
    # -----------------------------------------------------

    if friend_request.status != "PENDING":

        return jsonify({
            "success": False,
            "message": "This request is no longer pending"
        }), 400

    sender_id = friend_request.sender_id
    receiver_id = friend_request.receiver_id

    # -----------------------------------------------------
    # Update request
    # -----------------------------------------------------

    friend_request.status = "ACCEPTED"
    friend_request.responded_at = datetime.utcnow()

    # -----------------------------------------------------
    # Create friendship in both directions
    # -----------------------------------------------------

    friendship_one = Friendship(
        user_id=sender_id,
        friend_id=receiver_id
    )

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

    db.session.commit()

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

    # -----------------------------------------------------
    # Only receiver can decline
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Only sender can cancel
    # -----------------------------------------------------

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

    friends = [
        friendship.to_dict()
        for friendship in friendships
    ]

    return jsonify({
        "success": True,
        "friends": friends,
        "count": len(friends)
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
