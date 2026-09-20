from datetime import datetime

from flask import (
    Blueprint,
    jsonify,
    request,
    session,
)

from models import (
    db,
    User,
    Game,
    Club,
    ClubMember,
    ClubInvite,
    ClubJoinRequest,
    ClubRecruitmentPost,
    Notification,
    Friendship,
)

try:
    from rewards import process_synco_event
except ImportError:
    process_synco_event = None


# =========================================================
# BLUEPRINT
# =========================================================

clubs_bp = Blueprint(
    "clubs",
    __name__,
    url_prefix="/api/clubs",
)


# =========================================================
# AUTH
# =========================================================

def get_current_user():

    session_user = session.get("user")

    if not session_user:
        return None

    user_id = session_user.get("id")

    if not user_id:
        return None

    return db.session.get(User, user_id)


def auth_required_response():

    return jsonify({
        "success": False,
        "message": "Authentication required."
    }), 401


# =========================================================
# MEMBERSHIP HELPERS
# =========================================================

def get_membership(club_id, user_id):

    if not user_id:
        return None

    return (
        ClubMember.query
        .filter_by(
            club_id=club_id,
            user_id=user_id
        )
        .first()
    )


def is_member(club_id, user_id):

    return get_membership(
        club_id,
        user_id
    ) is not None


def is_owner(club, user_id):

    return bool(
        club
        and club.owner_id == user_id
    )


def can_manage_club(club, user_id):

    if not club or not user_id:
        return False

    if club.owner_id == user_id:
        return True

    membership = get_membership(
        club.id,
        user_id
    )

    return bool(
        membership
        and membership.role.upper() == "ADMIN"
    )


def are_friends(user_id, other_user_id):
    """
    Invitations are intentionally limited to friends of the
    person sending the invitation.
    """

    if not user_id or not other_user_id:
        return False

    friendship = (
        Friendship.query
        .filter(
            db.or_(
                db.and_(
                    Friendship.user_id == user_id,
                    Friendship.friend_id == other_user_id,
                ),
                db.and_(
                    Friendship.user_id == other_user_id,
                    Friendship.friend_id == user_id,
                ),
            )
        )
        .first()
    )

    return friendship is not None


# =========================================================
# NOTIFICATIONS
# =========================================================

def create_notification(
    user_id,
    notification_type,
    title,
    message,
    reference_type=None,
    reference_id=None,
    data=None,
):

    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        data=data or {},
        is_read=False,
    )

    db.session.add(notification)

    return notification


def notify_club_managers(
    club,
    title,
    message,
    notification_type,
    reference_id=None,
    data=None,
):

    manager_ids = {
        club.owner_id
    }

    for member in club.members:

        if member.role.upper() == "ADMIN":
            manager_ids.add(member.user_id)

    for user_id in manager_ids:

        create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            reference_type="CLUB_JOIN_REQUEST",
            reference_id=reference_id,
            data=data or {},
        )


def mark_join_request_notifications_read(
    request_id,
    user_ids,
):

    notifications = (
        Notification.query
        .filter(
            Notification.reference_type
            == "CLUB_JOIN_REQUEST",

            Notification.reference_id
            == request_id,

            Notification.user_id.in_(
                list(user_ids)
            ),

            Notification.is_read.is_(False),
        )
        .all()
    )

    for notification in notifications:
        notification.is_read = True


# =========================================================
# SERIALIZERS
# =========================================================

def serialize_join_request(join_request):

    return join_request.to_dict()


def serialize_recruitment_post(post):

    return post.to_dict()


# =========================================================
# GET ALL CLUBS
# =========================================================

@clubs_bp.route(
    "",
    methods=["GET"]
)
def get_clubs():

    try:

        clubs = (
            Club.query
            .filter_by(is_active=True)
            .order_by(
                Club.created_at.desc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "clubs": [
                club.to_dict()
                for club in clubs
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load clubs.",
            "error": str(e),
        }), 500


# =========================================================
# GET SINGLE CLUB
# =========================================================

@clubs_bp.route(
    "/<int:club_id>",
    methods=["GET"]
)
def get_club(club_id):

    try:

        club = db.session.get(
            Club,
            club_id
        )

        if not club:
            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        user = get_current_user()

        membership = None

        if user:
            membership = get_membership(
                club.id,
                user.id
            )

        pending_request = None

        if user and not membership:

            pending_request = (
                ClubJoinRequest.query
                .filter_by(
                    club_id=club.id,
                    user_id=user.id,
                    status="PENDING"
                )
                .first()
            )

        return jsonify({
            "success": True,

            "club": club.to_dict(),

            "currentUser": (
                {
                    "id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "avatar": user.avatar,
                    "role": (
                        membership.role
                        if membership
                        else None
                    ),
                }
                if user
                else None
            ),

            "pendingJoinRequest": (
                serialize_join_request(
                    pending_request
                )
                if pending_request
                else None
            ),

            "canManage": (
                can_manage_club(
                    club,
                    user.id
                )
                if user
                else False
            ),

            "isOwner": (
                is_owner(
                    club,
                    user.id
                )
                if user
                else False
            )
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load club.",
            "error": str(e),
        }), 500


# =========================================================
# GET MEMBERS
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/members",
    methods=["GET"]
)
def get_club_members(club_id):

    try:

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        members = (
            ClubMember.query
            .filter_by(club_id=club_id)
            .order_by(
                ClubMember.role.asc(),
                ClubMember.joined_at.asc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "members": [
                member.to_dict()
                for member in members
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load members.",
            "error": str(e),
        }), 500


# =========================================================
# CREATE CLUB
# =========================================================

@clubs_bp.route(
    "",
    methods=["POST"]
)
def create_club():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        data = request.get_json(
            silent=True
        ) or {}

        name = str(
            data.get("name", "")
        ).strip()

        tag = str(
            data.get("tag", "")
        ).strip().upper()

        description = str(
            data.get("description", "")
        ).strip()

        game_id = str(
            data.get("gameId", "")
        ).strip()

        region = str(
            data.get("region", "Global")
        ).strip()

        avatar = data.get("avatar")
        banner = data.get("banner")

        if not name:
            return jsonify({
                "success": False,
                "message": "Club name is required."
            }), 400

        if not tag:
            return jsonify({
                "success": False,
                "message": "Club tag is required."
            }), 400

        if len(tag) > 5:
            return jsonify({
                "success": False,
                "message": "Club tag cannot exceed 5 characters."
            }), 400

        if not game_id:
            return jsonify({
                "success": False,
                "message": "Game is required."
            }), 400

        game = db.session.get(
            Game,
            game_id
        )

        if not game:

            return jsonify({
                "success": False,
                "message": "Selected game was not found."
            }), 404

        existing_name = (
            Club.query
            .filter(
                db.func.lower(
                    Club.name
                ) == name.lower()
            )
            .first()
        )

        if existing_name:

            return jsonify({
                "success": False,
                "message": "A club with this name already exists."
            }), 409

        existing_tag = (
            Club.query
            .filter(
                db.func.lower(
                    Club.tag
                ) == tag.lower()
            )
            .first()
        )

        if existing_tag:

            return jsonify({
                "success": False,
                "message": "A club with this tag already exists."
            }), 409

        # -------------------------------------------------
        # PRIVACY HAS BEEN REMOVED FROM CLUB BEHAVIOR.
        # -------------------------------------------------
        # The legacy privacy column is kept at Public only as
        # a compatibility value in case the existing database
        # schema still requires it. It is never used to decide
        # whether a player can request to join.
        # -------------------------------------------------

        club = Club(
            name=name,
            tag=tag,
            description=description,
            privacy="Public",
            game_id=game_id,
            owner_id=user.id,
            avatar=avatar,
            banner=banner,
            region=region or "Global",
            # Legacy database field kept enabled for compatibility.
            # Invitations are always controlled by owner/admin
            # permissions and the friendship requirement.
            allow_member_invites=True,
            require_join_approval=True,
            is_active=True,
        )

        db.session.add(club)

        db.session.flush()

        owner_membership = ClubMember(
            club_id=club.id,
            user_id=user.id,
            role="OWNER"
        )

        db.session.add(
            owner_membership
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Club created successfully.",
            "club": club.to_dict()
        }), 201

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to create club.",
            "error": str(e),
        }), 500


# =========================================================
# MY CLUBS
# =========================================================

@clubs_bp.route(
    "/mine",
    methods=["GET"]
)
def get_my_clubs():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        memberships = (
            ClubMember.query
            .filter_by(user_id=user.id)
            .all()
        )

        clubs = [
            membership.club.to_dict()
            for membership in memberships
            if membership.club
        ]

        return jsonify({
            "success": True,
            "clubs": clubs
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load your clubs.",
            "error": str(e),
        }), 500


# =========================================================
# USER SEARCH
# =========================================================

@clubs_bp.route(
    "/users/search",
    methods=["GET"]
)
def search_users():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        query = str(
            request.args.get(
                "q",
                ""
            )
        ).strip()

        club_id = request.args.get(
            "clubId",
            type=int
        )

        if len(query) < 2:

            return jsonify({
                "success": True,
                "users": []
            })

        search_pattern = f"%{query}%"

        users_query = (
            User.query
            .filter(
                User.id != user.id
            )
            .filter(
                db.or_(
                    User.username.ilike(
                        search_pattern
                    ),
                    User.name.ilike(
                        search_pattern
                    ),
                    User.uid.ilike(
                        search_pattern
                    )
                )
            )
        )

        users = users_query.limit(50).all()

        if club_id:

            # Only friends can be invited.
            friend_ids = {
                friendship.friend_id
                for friendship in (
                    Friendship.query
                    .filter_by(
                        user_id=user.id
                    )
                    .all()
                )
            }

            friend_ids.update({
                friendship.user_id
                for friendship in (
                    Friendship.query
                    .filter_by(
                        friend_id=user.id
                    )
                    .all()
                )
            })

            users = [
                found_user
                for found_user in users
                if found_user.id in friend_ids
            ]

            existing_member_ids = {
                member.user_id
                for member in (
                    ClubMember.query
                    .filter_by(
                        club_id=club_id
                    )
                    .all()
                )
            }

            pending_invite_ids = {
                invite.invitee_id
                for invite in (
                    ClubInvite.query
                    .filter_by(
                        club_id=club_id,
                        status="PENDING"
                    )
                    .all()
                )
            }

            pending_request_ids = {
                req.user_id
                for req in (
                    ClubJoinRequest.query
                    .filter_by(
                        club_id=club_id,
                        status="PENDING"
                    )
                    .all()
                )
            }

            excluded_ids = (
                existing_member_ids
                | pending_invite_ids
                | pending_request_ids
            )

            users = [
                found_user
                for found_user in users
                if found_user.id
                not in excluded_ids
            ]

        return jsonify({
            "success": True,

            "users": [
                {
                    "id": found_user.id,
                    "uid": found_user.uid,
                    "name": found_user.name,
                    "username": found_user.username,
                    "avatar": found_user.avatar,
                    "level": found_user.level,
                    "isFriend": are_friends(
                        user.id,
                        found_user.id
                    ),
                }
                for found_user in users
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to search users.",
            "error": str(e),
        }), 500


# =========================================================
# SEND CLUB INVITE
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/invites",
    methods=["POST"]
)
def send_club_invite(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not club.is_active:

            return jsonify({
                "success": False,
                "message": "This club is inactive."
            }), 400

        # Owner OR Admin only.
        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "Only the owner or an admin can invite players."
            }), 403

        data = request.get_json(
            silent=True
        ) or {}

        invitee_id = data.get(
            "userId"
        )

        try:
            invitee_id = int(
                invitee_id
            )
        except (
            TypeError,
            ValueError
        ):

            return jsonify({
                "success": False,
                "message": "Invalid player."
            }), 400

        if invitee_id == user.id:

            return jsonify({
                "success": False,
                "message": "You cannot invite yourself."
            }), 400

        invitee = db.session.get(
            User,
            invitee_id
        )

        if not invitee:

            return jsonify({
                "success": False,
                "message": "Player not found."
            }), 404

        # -------------------------------------------------
        # NEW RULE:
        # Owner/Admin can invite friends only.
        # -------------------------------------------------

        if not are_friends(
            user.id,
            invitee.id
        ):

            return jsonify({
                "success": False,
                "message": "You can only invite players who are your friends."
            }), 403

        if is_member(
            club.id,
            invitee.id
        ):

            return jsonify({
                "success": False,
                "message": "Player is already a club member."
            }), 400

        pending_invite = (
            ClubInvite.query
            .filter_by(
                club_id=club.id,
                invitee_id=invitee.id,
                status="PENDING"
            )
            .first()
        )

        if pending_invite:

            return jsonify({
                "success": False,
                "message": "An invitation is already pending."
            }), 409

        pending_request = (
            ClubJoinRequest.query
            .filter_by(
                club_id=club.id,
                user_id=invitee.id,
                status="PENDING"
            )
            .first()
        )

        if pending_request:

            return jsonify({
                "success": False,
                "message": "This player already has a pending join request."
            }), 409

        invite = ClubInvite(
            club_id=club.id,
            inviter_id=user.id,
            invitee_id=invitee.id,
            status="PENDING"
        )

        db.session.add(invite)

        db.session.flush()

        create_notification(
            user_id=invitee.id,
            notification_type="CLUB_INVITE",
            title="Club invitation",
            message=(
                f"{club.name} invited you to join their club."
            ),
            reference_type="CLUB_INVITE",
            reference_id=invite.id,
            data={
                "clubId": club.id,
                "clubName": club.name,
                "inviterId": user.id,
                "inviterName": (
                    user.username
                    or user.name
                ),
                "inviteId": invite.id,
            }
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Invitation sent.",
            "invite": invite.to_dict()
        }), 201

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to send invitation.",
            "error": str(e),
        }), 500


# =========================================================
# MY CLUB INVITES
# =========================================================

@clubs_bp.route(
    "/invites/mine",
    methods=["GET"]
)
def get_my_invites():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        invites = (
            ClubInvite.query
            .filter_by(
                invitee_id=user.id,
                status="PENDING"
            )
            .order_by(
                ClubInvite.created_at.desc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "invites": [
                invite.to_dict()
                for invite in invites
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load invitations.",
            "error": str(e),
        }), 500


# =========================================================
# ACCEPT INVITE
# =========================================================

@clubs_bp.route(
    "/invites/<int:invite_id>/accept",
    methods=["POST"]
)
def accept_invite(invite_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        invite = db.session.get(
            ClubInvite,
            invite_id
        )

        if not invite:

            return jsonify({
                "success": False,
                "message": "Invitation not found."
            }), 404

        if invite.invitee_id != user.id:

            return jsonify({
                "success": False,
                "message": "You cannot accept this invitation."
            }), 403

        if invite.status != "PENDING":

            return jsonify({
                "success": False,
                "message": "This invitation is no longer pending."
            }), 400

        club = invite.club

        if not club or not club.is_active:

            return jsonify({
                "success": False,
                "message": "This club is no longer active."
            }), 400

        existing = get_membership(
            club.id,
            user.id
        )

        if not existing:

            db.session.add(
                ClubMember(
                    club_id=club.id,
                    user_id=user.id,
                    role="MEMBER"
                )
            )

        invite.status = "ACCEPTED"
        invite.responded_at = datetime.utcnow()

        pending_requests = (
            ClubJoinRequest.query
            .filter_by(
                club_id=club.id,
                user_id=user.id,
                status="PENDING"
            )
            .all()
        )

        for join_request in pending_requests:

            join_request.status = "CANCELLED"
            join_request.responded_at = datetime.utcnow()
            join_request.responded_by = user.id

        db.session.commit()

        if process_synco_event:

            try:

                process_synco_event(
                    user=user,
                    event_type="CLUB_JOINED",
                    reference_id=club.id
                )

                db.session.commit()

            except Exception as reward_error:

                db.session.rollback()

                print(
                    "Club reward error:",
                    str(reward_error)
                )

        return jsonify({
            "success": True,
            "message": "You joined the club.",
            "club": club.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to accept invitation.",
            "error": str(e),
        }), 500


# =========================================================
# DECLINE INVITE
# =========================================================

@clubs_bp.route(
    "/invites/<int:invite_id>/decline",
    methods=["POST"]
)
def decline_invite(invite_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        invite = db.session.get(
            ClubInvite,
            invite_id
        )

        if not invite:

            return jsonify({
                "success": False,
                "message": "Invitation not found."
            }), 404

        if invite.invitee_id != user.id:

            return jsonify({
                "success": False,
                "message": "You cannot decline this invitation."
            }), 403

        if invite.status != "PENDING":

            return jsonify({
                "success": False,
                "message": "This invitation is no longer pending."
            }), 400

        invite.status = "DECLINED"
        invite.responded_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Invitation declined."
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to decline invitation.",
            "error": str(e),
        }), 500


# =========================================================
# REQUEST TO JOIN
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/join",
    methods=["POST"]
)
def request_to_join(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not club.is_active:

            return jsonify({
                "success": False,
                "message": "This club is inactive."
            }), 400

        if club.owner_id == user.id:

            return jsonify({
                "success": False,
                "message": "You already own this club."
            }), 400

        if is_member(
            club.id,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You are already a member."
            }), 400

        # -------------------------------------------------
        # Public/private logic has been removed.
        # Any non-member may request to join.
        # Every request is reviewed by owner/admin.
        # -------------------------------------------------

        pending_request = (
            ClubJoinRequest.query
            .filter_by(
                club_id=club.id,
                user_id=user.id,
                status="PENDING"
            )
            .first()
        )

        if pending_request:

            return jsonify({
                "success": True,
                "message": "Your join request is already pending.",
                "pending": True,
                "request": (
                    pending_request.to_dict()
                )
            })

        pending_invite = (
            ClubInvite.query
            .filter_by(
                club_id=club.id,
                invitee_id=user.id,
                status="PENDING"
            )
            .first()
        )

        if pending_invite:

            return jsonify({
                "success": False,
                "message": "You already have an invitation from this club."
            }), 400

        data = request.get_json(
            silent=True
        ) or {}

        message = str(
            data.get(
                "message",
                ""
            )
        ).strip()

        if len(message) > 500:

            return jsonify({
                "success": False,
                "message": "Request message cannot exceed 500 characters."
            }), 400

        join_request = ClubJoinRequest(
            club_id=club.id,
            user_id=user.id,
            status="PENDING",
            message=message or None
        )

        db.session.add(
            join_request
        )

        db.session.flush()

        notify_club_managers(
            club=club,
            title="New club join request",
            message=(
                f"{user.username or user.name} "
                f"requested to join {club.name}."
            ),
            notification_type="CLUB_JOIN_REQUEST",
            reference_id=join_request.id,
            data={
                "clubId": club.id,
                "clubName": club.name,
                "requesterId": user.id,
                "requesterName": (
                    user.username
                    or user.name
                ),
                "requestId": join_request.id
            }
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "pending": True,
            "message": "Join request sent.",
            "request": (
                join_request.to_dict()
            )
        }), 201

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to send join request.",
            "error": str(e),
        }), 500


# =========================================================
# MY JOIN REQUESTS
# =========================================================

@clubs_bp.route(
    "/join-requests/mine",
    methods=["GET"]
)
def get_my_join_requests():

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        requests_list = (
            ClubJoinRequest.query
            .filter_by(
                user_id=user.id
            )
            .order_by(
                ClubJoinRequest.created_at.desc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "requests": [
                request_item.to_dict()
                for request_item in requests_list
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load join requests.",
            "error": str(e),
        }), 500


# =========================================================
# CLUB PENDING JOIN REQUESTS
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/join-requests",
    methods=["GET"]
)
def get_club_join_requests(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission to view join requests."
            }), 403

        requests_list = (
            ClubJoinRequest.query
            .filter_by(
                club_id=club.id,
                status="PENDING"
            )
            .order_by(
                ClubJoinRequest.created_at.asc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "requests": [
                serialize_join_request(
                    request_item
                )
                for request_item in requests_list
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load join requests.",
            "error": str(e),
        }), 500


# =========================================================
# APPROVE JOIN REQUEST
# =========================================================

@clubs_bp.route(
    "/join-requests/<int:request_id>/approve",
    methods=["POST"]
)
def approve_join_request(request_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        join_request = db.session.get(
            ClubJoinRequest,
            request_id
        )

        if not join_request:

            return jsonify({
                "success": False,
                "message": "Join request not found."
            }), 404

        club = join_request.club

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission to approve requests."
            }), 403

        if join_request.status != "PENDING":

            return jsonify({
                "success": False,
                "message": "This request has already been processed."
            }), 400

        if not club.is_active:

            return jsonify({
                "success": False,
                "message": "This club is inactive."
            }), 400

        requester = join_request.user

        if not requester:

            return jsonify({
                "success": False,
                "message": "Requester no longer exists."
            }), 400

        existing_membership = get_membership(
            club.id,
            requester.id
        )

        if not existing_membership:

            db.session.add(
                ClubMember(
                    club_id=club.id,
                    user_id=requester.id,
                    role="MEMBER"
                )
            )

        join_request.status = "APPROVED"
        join_request.responded_at = datetime.utcnow()
        join_request.responded_by = user.id

        manager_ids = {
            club.owner_id
        }

        for member in club.members:
            if member.role.upper() == "ADMIN":
                manager_ids.add(member.user_id)

        mark_join_request_notifications_read(
            request_id,
            manager_ids
        )

        create_notification(
            user_id=requester.id,
            notification_type="CLUB_JOIN_APPROVED",
            title="Join request approved",
            message=(
                f"Your request to join {club.name} "
                f"was approved."
            ),
            reference_type="CLUB",
            reference_id=club.id,
            data={
                "clubId": club.id,
                "clubName": club.name
            }
        )

        db.session.commit()

        if process_synco_event:

            try:

                process_synco_event(
                    user=requester,
                    event_type="CLUB_JOINED",
                    reference_id=club.id
                )

                db.session.commit()

            except Exception as reward_error:

                db.session.rollback()

                print(
                    "Club join reward error:",
                    str(reward_error)
                )

        return jsonify({
            "success": True,
            "message": "Player approved.",
            "request": join_request.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to approve request.",
            "error": str(e),
        }), 500


# =========================================================
# REJECT / DISMISS JOIN REQUEST
# =========================================================

@clubs_bp.route(
    "/join-requests/<int:request_id>/reject",
    methods=["POST"]
)
@clubs_bp.route(
    "/join-requests/<int:request_id>/dismiss",
    methods=["POST"]
)
def reject_join_request(request_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        join_request = db.session.get(
            ClubJoinRequest,
            request_id
        )

        if not join_request:

            return jsonify({
                "success": False,
                "message": "Join request not found."
            }), 404

        club = join_request.club

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission to dismiss requests."
            }), 403

        if join_request.status != "PENDING":

            return jsonify({
                "success": False,
                "message": "This request has already been processed."
            }), 400

        join_request.status = "REJECTED"
        join_request.responded_at = datetime.utcnow()
        join_request.responded_by = user.id

        requester_id = join_request.user_id

        manager_ids = {
            club.owner_id
        }

        for member in club.members:
            if member.role.upper() == "ADMIN":
                manager_ids.add(member.user_id)

        mark_join_request_notifications_read(
            request_id,
            manager_ids
        )

        create_notification(
            user_id=requester_id,
            notification_type="CLUB_JOIN_REJECTED",
            title="Join request declined",
            message=(
                f"Your request to join {club.name} "
                f"was declined."
            ),
            reference_type="CLUB",
            reference_id=club.id,
            data={
                "clubId": club.id,
                "clubName": club.name
            }
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Join request dismissed.",
            "request": join_request.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to dismiss request.",
            "error": str(e),
        }), 500


# =========================================================
# CANCEL OWN JOIN REQUEST
# =========================================================

@clubs_bp.route(
    "/join-requests/<int:request_id>/cancel",
    methods=["POST"]
)
def cancel_join_request(request_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        join_request = db.session.get(
            ClubJoinRequest,
            request_id
        )

        if not join_request:

            return jsonify({
                "success": False,
                "message": "Join request not found."
            }), 404

        if join_request.user_id != user.id:

            return jsonify({
                "success": False,
                "message": "You cannot cancel this request."
            }), 403

        if join_request.status != "PENDING":

            return jsonify({
                "success": False,
                "message": "This request is no longer pending."
            }), 400

        join_request.status = "CANCELLED"
        join_request.responded_at = datetime.utcnow()
        join_request.responded_by = user.id

        manager_ids = {
            join_request.club.owner_id
        }

        for member in join_request.club.members:

            if member.role.upper() == "ADMIN":
                manager_ids.add(member.user_id)

        mark_join_request_notifications_read(
            request_id,
            manager_ids
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Join request cancelled."
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to cancel request.",
            "error": str(e),
        }), 500


# =========================================================
# CLUB SETTINGS
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/settings",
    methods=["PATCH"]
)
def update_club_settings(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission to manage this club."
            }), 403

        data = request.get_json(
            silent=True
        ) or {}

        # -------------------------------------------------
        # NAME
        # -------------------------------------------------

        if "name" in data:

            name = str(
                data.get("name", "")
            ).strip()

            if not name:

                return jsonify({
                    "success": False,
                    "message": "Club name cannot be empty."
                }), 400

            if len(name) > 100:

                return jsonify({
                    "success": False,
                    "message": "Club name cannot exceed 100 characters."
                }), 400

            existing = (
                Club.query
                .filter(
                    Club.id != club.id,
                    db.func.lower(
                        Club.name
                    ) == name.lower()
                )
                .first()
            )

            if existing:

                return jsonify({
                    "success": False,
                    "message": "A club with this name already exists."
                }), 409

            club.name = name

        # -------------------------------------------------
        # TAG
        # -------------------------------------------------

        if "tag" in data:

            tag = str(
                data.get("tag", "")
            ).strip().upper()

            if not tag:

                return jsonify({
                    "success": False,
                    "message": "Club tag cannot be empty."
                }), 400

            if len(tag) > 5:

                return jsonify({
                    "success": False,
                    "message": "Club tag cannot exceed 5 characters."
                }), 400

            existing = (
                Club.query
                .filter(
                    Club.id != club.id,
                    db.func.lower(
                        Club.tag
                    ) == tag.lower()
                )
                .first()
            )

            if existing:

                return jsonify({
                    "success": False,
                    "message": "A club with this tag already exists."
                }), 409

            club.tag = tag

        # -------------------------------------------------
        # DESCRIPTION
        # -------------------------------------------------

        if "description" in data:

            description = str(
                data.get(
                    "description",
                    ""
                )
            ).strip()

            if len(description) > 5000:

                return jsonify({
                    "success": False,
                    "message": "Description is too long."
                }), 400

            club.description = (
                description
                or None
            )

        # -------------------------------------------------
        # AVATAR
        # -------------------------------------------------

        if "avatar" in data:

            avatar = data.get(
                "avatar"
            )

            club.avatar = (
                str(avatar).strip()
                if avatar
                else None
            )

        # -------------------------------------------------
        # BANNER
        # -------------------------------------------------

        if "banner" in data:

            banner = data.get(
                "banner"
            )

            club.banner = (
                str(banner).strip()
                if banner
                else None
            )

        # -------------------------------------------------
        # REGION
        # -------------------------------------------------

        if "region" in data:

            region = str(
                data.get(
                    "region",
                    "Global"
                )
            ).strip()

            club.region = (
                region
                or "Global"
            )

        # -------------------------------------------------
        # GAME
        # -------------------------------------------------

        if "gameId" in data:

            game_id = str(
                data.get(
                    "gameId",
                    ""
                )
            ).strip()

            if not game_id:

                return jsonify({
                    "success": False,
                    "message": "Game is required."
                }), 400

            game = db.session.get(
                Game,
                game_id
            )

            if not game:

                return jsonify({
                    "success": False,
                    "message": "Selected game was not found."
                }), 404

            club.game_id = game_id

        # -------------------------------------------------
        # PRIVACY REMOVED
        # -------------------------------------------------
        # Incoming privacy updates are intentionally ignored.
        # New and existing clubs use the same join-request flow.
        # -------------------------------------------------

        # -------------------------------------------------
        # MEMBER INVITES
        # -------------------------------------------------

        # Invitations are always enabled for owner/admin.
        # The legacy setting is no longer configurable.
        club.allow_member_invites = True

        # -------------------------------------------------
        # JOIN APPROVAL
        # -------------------------------------------------
        # All join requests are reviewed by owner/admin.
        # -------------------------------------------------

        club.require_join_approval = True

        # -------------------------------------------------
        # ACTIVE STATUS
        # -------------------------------------------------

        if "isActive" in data:

            if not is_owner(
                club,
                user.id
            ):

                return jsonify({
                    "success": False,
                    "message": "Only the owner can change club status."
                }), 403

            club.is_active = bool(
                data.get(
                    "isActive"
                )
            )

        club.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Club settings updated.",
            "club": club.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update club settings.",
            "error": str(e),
        }), 500


# =========================================================
# DEACTIVATE CLUB
# =========================================================

@clubs_bp.route(
    "/<int:club_id>",
    methods=["DELETE"]
)
def deactivate_club(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not is_owner(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "Only the owner can deactivate the club."
            }), 403

        club.is_active = False
        club.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Club deactivated."
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to deactivate club.",
            "error": str(e),
        }), 500


# =========================================================
# REMOVE MEMBER
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/members/<int:user_id>",
    methods=["DELETE"]
)
def remove_member(club_id, user_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission."
            }), 403

        member = get_membership(
            club.id,
            user_id
        )

        if not member:

            return jsonify({
                "success": False,
                "message": "Member not found."
            }), 404

        if member.user_id == club.owner_id:

            return jsonify({
                "success": False,
                "message": "The club owner cannot be removed."
            }), 400

        if (
            member.role.upper() == "ADMIN"
            and not is_owner(
                club,
                user.id
            )
        ):

            return jsonify({
                "success": False,
                "message": "Only the owner can remove an admin."
            }), 403

        removed_user_id = member.user_id

        db.session.delete(
            member
        )

        create_notification(
            user_id=removed_user_id,
            notification_type="CLUB_MEMBER_REMOVED",
            title="Removed from club",
            message=(
                f"You were removed from {club.name}."
            ),
            reference_type="CLUB",
            reference_id=club.id,
            data={
                "clubId": club.id
            }
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Member removed."
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to remove member.",
            "error": str(e),
        }), 500


# =========================================================
# CHANGE MEMBER ROLE
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/members/<int:user_id>/role",
    methods=["PATCH"]
)
def change_member_role(club_id, user_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not is_owner(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "Only the owner can change member roles."
            }), 403

        member = get_membership(
            club.id,
            user_id
        )

        if not member:

            return jsonify({
                "success": False,
                "message": "Member not found."
            }), 404

        if member.user_id == club.owner_id:

            return jsonify({
                "success": False,
                "message": "Owner role cannot be changed."
            }), 400

        data = request.get_json(
            silent=True
        ) or {}

        role = str(
            data.get(
                "role",
                ""
            )
        ).strip().upper()

        if role not in [
            "MEMBER",
            "ADMIN"
        ]:

            return jsonify({
                "success": False,
                "message": "Role must be MEMBER or ADMIN."
            }), 400

        member.role = role

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Member role updated.",
            "member": member.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update role.",
            "error": str(e),
        }), 500


# =========================================================
# LEAVE CLUB
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/leave",
    methods=["POST"]
)
def leave_club(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if club.owner_id == user.id:

            return jsonify({
                "success": False,
                "message": "The owner cannot leave the club. Transfer ownership or deactivate it."
            }), 400

        membership = get_membership(
            club.id,
            user.id
        )

        if not membership:

            return jsonify({
                "success": False,
                "message": "You are not a member."
            }), 400

        db.session.delete(
            membership
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "You left the club."
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to leave club.",
            "error": str(e),
        }), 500


# =========================================================
# RECRUITMENT
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/recruitment",
    methods=["POST"]
)
def create_recruitment_post(club_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "Only the owner or an admin can create recruitment posts."
            }), 403

        data = request.get_json(
            silent=True
        ) or {}

        title = str(
            data.get(
                "title",
                ""
            )
        ).strip()

        description = str(
            data.get(
                "description",
                ""
            )
        ).strip()

        game_id = str(
            data.get(
                "gameId",
                club.game_id
            )
        ).strip()

        role = str(
            data.get(
                "role",
                ""
            )
        ).strip()

        rank_requirement = str(
            data.get(
                "rankRequirement",
                data.get(
                    "rank",
                    ""
                )
            )
        ).strip()

        region = str(
            data.get(
                "region",
                club.region
            )
        ).strip()

        mic_required = bool(
            data.get(
                "micRequired",
                False
            )
        )

        status = str(
            data.get(
                "status",
                "OPEN"
            )
        ).upper().strip()

        if not title:

            return jsonify({
                "success": False,
                "message": "Recruitment title is required."
            }), 400

        if len(title) > 160:

            return jsonify({
                "success": False,
                "message": "Title cannot exceed 160 characters."
            }), 400

        if not description:

            return jsonify({
                "success": False,
                "message": "Recruitment description is required."
            }), 400

        if len(description) > 2000:

            return jsonify({
                "success": False,
                "message": "Description cannot exceed 2000 characters."
            }), 400

        game = db.session.get(
            Game,
            game_id
        )

        if not game:

            return jsonify({
                "success": False,
                "message": "Selected game was not found."
            }), 404

        if status not in [
            "OPEN",
            "CLOSED"
        ]:

            status = "OPEN"

        post = ClubRecruitmentPost(
            club_id=club.id,
            created_by=user.id,
            title=title,
            description=description,
            game_id=game_id,
            role=role or None,
            rank_requirement=(
                rank_requirement
                or None
            ),
            region=region or None,
            mic_required=mic_required,
            status=status
        )

        db.session.add(
            post
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Recruitment post created.",
            "post": post.to_dict()
        }), 201

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to create recruitment post.",
            "error": str(e),
        }), 500


# =========================================================
# GET RECRUITMENT POSTS
# =========================================================

@clubs_bp.route(
    "/<int:club_id>/recruitment",
    methods=["GET"]
)
def get_recruitment_posts(club_id):

    try:

        club = db.session.get(
            Club,
            club_id
        )

        if not club:

            return jsonify({
                "success": False,
                "message": "Club not found."
            }), 404

        include_closed = (
            request.args.get(
                "includeClosed",
                "false"
            ).lower()
            == "true"
        )

        query = (
            ClubRecruitmentPost.query
            .filter_by(
                club_id=club.id
            )
        )

        if not include_closed:

            query = query.filter_by(
                status="OPEN"
            )

        posts = (
            query
            .order_by(
                ClubRecruitmentPost.created_at.desc()
            )
            .all()
        )

        return jsonify({
            "success": True,
            "posts": [
                serialize_recruitment_post(
                    post
                )
                for post in posts
            ]
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load recruitment posts.",
            "error": str(e),
        }), 500


# =========================================================
# GET ONE RECRUITMENT POST
# =========================================================

@clubs_bp.route(
    "/recruitment/<int:post_id>",
    methods=["GET"]
)
def get_recruitment_post(post_id):

    try:

        post = db.session.get(
            ClubRecruitmentPost,
            post_id
        )

        if not post:

            return jsonify({
                "success": False,
                "message": "Recruitment post not found."
            }), 404

        return jsonify({
            "success": True,
            "post": post.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to load recruitment post.",
            "error": str(e),
        }), 500


# =========================================================
# UPDATE RECRUITMENT POST
# =========================================================

@clubs_bp.route(
    "/recruitment/<int:post_id>",
    methods=["PATCH"]
)
def update_recruitment_post(post_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        post = db.session.get(
            ClubRecruitmentPost,
            post_id
        )

        if not post:

            return jsonify({
                "success": False,
                "message": "Recruitment post not found."
            }), 404

        club = post.club

        if not can_manage_club(
            club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission to edit this post."
            }), 403

        data = request.get_json(
            silent=True
        ) or {}

        if "title" in data:

            title = str(
                data.get(
                    "title",
                    ""
                )
            ).strip()

            if not title:

                return jsonify({
                    "success": False,
                    "message": "Title cannot be empty."
                }), 400

            if len(title) > 160:

                return jsonify({
                    "success": False,
                    "message": "Title is too long."
                }), 400

            post.title = title

        if "description" in data:

            description = str(
                data.get(
                    "description",
                    ""
                )
            ).strip()

            if not description:

                return jsonify({
                    "success": False,
                    "message": "Description cannot be empty."
                }), 400

            if len(description) > 2000:

                return jsonify({
                    "success": False,
                    "message": "Description is too long."
                }), 400

            post.description = description

        if "gameId" in data:

            game_id = str(
                data.get(
                    "gameId",
                    ""
                )
            ).strip()

            game = db.session.get(
                Game,
                game_id
            )

            if not game:

                return jsonify({
                    "success": False,
                    "message": "Selected game was not found."
                }), 404

            post.game_id = game_id

        if "role" in data:

            post.role = (
                str(
                    data.get(
                        "role",
                        ""
                    )
                ).strip()
                or None
            )

        if (
            "rankRequirement"
            in data
        ):

            post.rank_requirement = (
                str(
                    data.get(
                        "rankRequirement",
                        ""
                    )
                ).strip()
                or None
            )

        elif "rank" in data:

            post.rank_requirement = (
                str(
                    data.get(
                        "rank",
                        ""
                    )
                ).strip()
                or None
            )

        if "region" in data:

            post.region = (
                str(
                    data.get(
                        "region",
                        ""
                    )
                ).strip()
                or None
            )

        if "micRequired" in data:

            post.mic_required = bool(
                data.get(
                    "micRequired"
                )
            )

        if "status" in data:

            status = str(
                data.get(
                    "status",
                    post.status
                )
            ).upper().strip()

            if status not in [
                "OPEN",
                "CLOSED"
            ]:

                return jsonify({
                    "success": False,
                    "message": "Invalid recruitment status."
                }), 400

            post.status = status

        post.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Recruitment post updated.",
            "post": post.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update recruitment post.",
            "error": str(e),
        }), 500


# =========================================================
# CLOSE RECRUITMENT
# =========================================================

@clubs_bp.route(
    "/recruitment/<int:post_id>/close",
    methods=["POST"]
)
def close_recruitment_post(post_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        post = db.session.get(
            ClubRecruitmentPost,
            post_id
        )

        if not post:

            return jsonify({
                "success": False,
                "message": "Recruitment post not found."
            }), 404

        if not can_manage_club(
            post.club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission."
            }), 403

        post.status = "CLOSED"
        post.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Recruitment post closed.",
            "post": post.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to close recruitment post.",
            "error": str(e),
        }), 500


# =========================================================
# OPEN RECRUITMENT
# =========================================================

@clubs_bp.route(
    "/recruitment/<int:post_id>/open",
    methods=["POST"]
)
def open_recruitment_post(post_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        post = db.session.get(
            ClubRecruitmentPost,
            post_id
        )

        if not post:

            return jsonify({
                "success": False,
                "message": "Recruitment post not found."
            }), 404

        if not can_manage_club(
            post.club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission."
            }), 403

        post.status = "OPEN"
        post.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Recruitment post reopened.",
            "post": post.to_dict()
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to reopen recruitment post.",
            "error": str(e),
        }), 500


# =========================================================
# DELETE RECRUITMENT
# =========================================================

@clubs_bp.route(
    "/recruitment/<int:post_id>",
    methods=["DELETE"]
)
def delete_recruitment_post(post_id):

    try:

        user = get_current_user()

        if user is None:
            return auth_required_response()

        post = db.session.get(
            ClubRecruitmentPost,
            post_id
        )

        if not post:

            return jsonify({
                "success": False,
                "message": "Recruitment post not found."
            }), 404

        if not can_manage_club(
            post.club,
            user.id
        ):

            return jsonify({
                "success": False,
                "message": "You do not have permission."
            }), 403

        db.session.delete(
            post
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Recruitment post deleted."
        })

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to delete recruitment post.",
            "error": str(e),
        }), 500
