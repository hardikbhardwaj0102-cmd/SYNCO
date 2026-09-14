from datetime import datetime

from flask import Blueprint, request, jsonify, session

from models import (
    db,
    User,
    Game,
    Club,
    ClubMember,
    ClubInvite,
    Notification,
)


# =========================================================
# BLUEPRINT
# =========================================================

clubs_bp = Blueprint(
    "clubs",
    __name__,
    url_prefix="/api/clubs",
)


# =========================================================
# AUTH HELPER
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
        user_id,
    )


# =========================================================
# MEMBERSHIP HELPERS
# =========================================================

def get_membership(club_id, user_id):

    return ClubMember.query.filter_by(
        club_id=club_id,
        user_id=user_id,
    ).first()


def can_manage_club(club_id, user_id):

    member = get_membership(
        club_id,
        user_id,
    )

    if not member:
        return False

    return member.role in [
        "OWNER",
        "ADMIN",
    ]


# =========================================================
# GET CLUB DIRECTORY
# =========================================================

@clubs_bp.get("")
def get_clubs():

    clubs = Club.query.filter_by(
        is_active=True,
    ).order_by(
        Club.created_at.desc(),
    ).all()

    return jsonify({
        "success": True,
        "clubs": [
            club.to_dict()
            for club in clubs
        ],
    })


# =========================================================
# GET SINGLE CLUB
# =========================================================

@clubs_bp.get("/<int:club_id>")
def get_club(club_id):

    club = db.session.get(
        Club,
        club_id,
    )

    if not club or not club.is_active:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    current_user = get_current_user()

    membership = None

    if current_user:

        membership = get_membership(
            club.id,
            current_user.id,
        )

    data = club.to_dict()

    data["currentUser"] = (
        membership.to_dict()
        if membership
        else None
    )

    data["canManage"] = bool(
        current_user
        and can_manage_club(
            club.id,
            current_user.id,
        )
    )

    return jsonify({
        "success": True,
        "club": data,
    })


# =========================================================
# GET MEMBERS
# =========================================================

@clubs_bp.get("/<int:club_id>/members")
def get_members(club_id):

    club = db.session.get(
        Club,
        club_id,
    )

    if not club:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    members = ClubMember.query.filter_by(
        club_id=club_id,
    ).order_by(
        ClubMember.role.asc(),
        ClubMember.joined_at.asc(),
    ).all()

    return jsonify({
        "success": True,
        "members": [
            member.to_dict()
            for member in members
        ],
    })


# =========================================================
# CREATE CLUB
# =========================================================

@clubs_bp.post("")
def create_club():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    data = request.get_json(
        silent=True,
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

    privacy = str(
        data.get("privacy", "Public")
    ).strip()

    if not name:

        return jsonify({
            "success": False,
            "message": "Club name is required.",
        }), 400

    if not tag:

        return jsonify({
            "success": False,
            "message": "Club tag is required.",
        }), 400

    if len(tag) > 5:

        return jsonify({
            "success": False,
            "message": "Club tag cannot exceed 5 characters.",
        }), 400

    if not game_id:

        return jsonify({
            "success": False,
            "message": "Primary game is required.",
        }), 400

    if privacy not in [
        "Public",
        "Private",
    ]:

        return jsonify({
            "success": False,
            "message": "Invalid privacy setting.",
        }), 400

    existing_name = Club.query.filter_by(
        name=name,
    ).first()

    if existing_name:

        return jsonify({
            "success": False,
            "message": "A club with this name already exists.",
        }), 409

    existing_tag = Club.query.filter_by(
        tag=tag,
    ).first()

    if existing_tag:

        return jsonify({
            "success": False,
            "message": "This club tag is already taken.",
        }), 409

    game = db.session.get(
        Game,
        game_id,
    )

    if not game:

        return jsonify({
            "success": False,
            "message": "Selected game does not exist.",
        }), 400

    club = Club(
        name=name,
        tag=tag,
        description=description or None,
        privacy=privacy,
        game_id=game.id,
        owner_id=current_user.id,
    )

    db.session.add(club)

    db.session.flush()

    owner_member = ClubMember(
        club_id=club.id,
        user_id=current_user.id,
        role="OWNER",
    )

    db.session.add(owner_member)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Club created successfully.",
        "club": club.to_dict(),
    }), 201


# =========================================================
# MY CLUBS
# =========================================================

@clubs_bp.get("/mine")
def get_my_clubs():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    memberships = ClubMember.query.filter_by(
        user_id=current_user.id,
    ).all()

    clubs = [
        membership.club.to_dict()
        for membership in memberships
        if membership.club
        and membership.club.is_active
    ]

    return jsonify({
        "success": True,
        "clubs": clubs,
    })


# =========================================================
# SEARCH USERS
#
# ONLY USERNAME + UID
# =========================================================

@clubs_bp.get("/users/search")
def search_users():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    query = str(
        request.args.get("q", "")
    ).strip()

    club_id = request.args.get(
        "clubId",
        type=int,
    )

    if len(query) < 2:

        return jsonify({
            "success": True,
            "users": [],
        })

    search_pattern = f"%{query}%"

    # -----------------------------------------------------
    # SEARCH ONLY USERNAME OR UID
    # -----------------------------------------------------

    users = User.query.filter(
        db.or_(
            User.username.ilike(search_pattern),
            User.uid.ilike(search_pattern),
        ),
        User.id != current_user.id,
    ).limit(20).all()

    result = []

    for user in users:

        # -------------------------------------------------
        # SKIP EXISTING CLUB MEMBERS
        # -------------------------------------------------

        if club_id:

            membership = get_membership(
                club_id,
                user.id,
            )

            if membership:
                continue

            # ---------------------------------------------
            # SKIP USERS WITH PENDING INVITE
            # ---------------------------------------------

            pending_invite = ClubInvite.query.filter_by(
                club_id=club_id,
                invitee_id=user.id,
                status="PENDING",
            ).first()

            if pending_invite:
                continue

        # -------------------------------------------------
        # ONLY RETURN REQUIRED INFORMATION
        # -------------------------------------------------

        result.append({
            "id": user.id,
            "uid": user.uid,
            "username": user.username,
            "avatar": user.to_dict().get("avatar"),
        })

    return jsonify({
        "success": True,
        "users": result,
    })


# =========================================================
# SEND CLUB INVITE
# =========================================================

@clubs_bp.post("/<int:club_id>/invites")
def send_invite(club_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    club = db.session.get(
        Club,
        club_id,
    )

    if not club or not club.is_active:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    # -----------------------------------------------------
    # CHECK PERMISSION
    # -----------------------------------------------------

    if not can_manage_club(
        club_id,
        current_user.id,
    ):

        return jsonify({
            "success": False,
            "message": (
                "You do not have permission "
                "to invite members."
            ),
        }), 403

    data = request.get_json(
        silent=True,
    ) or {}

    user_id = data.get(
        "userId",
    )

    if not user_id:

        return jsonify({
            "success": False,
            "message": "User ID is required.",
        }), 400

    # -----------------------------------------------------
    # FIND INVITEE
    # -----------------------------------------------------

    invitee = db.session.get(
        User,
        user_id,
    )

    if not invitee:

        return jsonify({
            "success": False,
            "message": "User not found.",
        }), 404

    if invitee.id == current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot invite yourself.",
        }), 400

    # -----------------------------------------------------
    # CHECK EXISTING MEMBER
    # -----------------------------------------------------

    existing_member = get_membership(
        club_id,
        invitee.id,
    )

    if existing_member:

        return jsonify({
            "success": False,
            "message": "This user is already a member.",
        }), 409

    # -----------------------------------------------------
    # CHECK EXISTING INVITE
    # -----------------------------------------------------

    existing_invite = ClubInvite.query.filter_by(
        club_id=club_id,
        invitee_id=invitee.id,
        status="PENDING",
    ).first()

    if existing_invite:

        return jsonify({
            "success": False,
            "message": (
                "An invite is already pending "
                "for this user."
            ),
        }), 409

    # =====================================================
    # CREATE CLUB INVITE
    # =====================================================

    invite = ClubInvite(
        club_id=club.id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        status="PENDING",
    )

    db.session.add(invite)

    # Get invite.id before creating notification
    db.session.flush()

    # =====================================================
    # CREATE NOTIFICATION
    # =====================================================

    inviter_name = (
        current_user.username
        or current_user.name
        or "A SYNCO player"
    )

    inviter_avatar = (
        current_user.to_dict().get("avatar")
    )

    notification = Notification(
        user_id=invitee.id,

        notification_type="CLUB_INVITE",

        title="Club invitation",

        message=(
            f"{inviter_name} "
            f"invited you to join {club.name}."
        ),

        reference_type="CLUB_INVITE",

        reference_id=invite.id,

        data={
            "inviteId": invite.id,
            "clubId": club.id,
            "clubName": club.name,
            "clubTag": club.tag,

            "inviterId": current_user.id,

            "inviterName": inviter_name,

            "inviterAvatar": inviter_avatar,
        },

        is_read=False,
    )

    db.session.add(notification)

    # =====================================================
    # SAVE EVERYTHING
    # =====================================================

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Club invite sent.",
        "invite": invite.to_dict(),
        "notification": notification.to_dict(),
    }), 201


# =========================================================
# GET MY RECEIVED INVITES
# =========================================================

@clubs_bp.get("/invites")
def get_my_invites():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    invites = ClubInvite.query.filter_by(
        invitee_id=current_user.id,
        status="PENDING",
    ).order_by(
        ClubInvite.created_at.desc(),
    ).all()

    return jsonify({
        "success": True,
        "invites": [
            invite.to_dict()
            for invite in invites
        ],
    })


# =========================================================
# ALIAS
#
# Compatibility with ClubProfile.jsx
# =========================================================

@clubs_bp.get("/invites/mine")
def get_my_invites_alias():

    return get_my_invites()


# =========================================================
# GET PENDING INVITES FOR A CLUB
# =========================================================

@clubs_bp.get("/<int:club_id>/invites")
def get_club_invites(club_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    club = db.session.get(
        Club,
        club_id,
    )

    if not club:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    if not can_manage_club(
        club_id,
        current_user.id,
    ):

        return jsonify({
            "success": False,
            "message": "You do not have permission.",
        }), 403

    invites = ClubInvite.query.filter_by(
        club_id=club_id,
        status="PENDING",
    ).order_by(
        ClubInvite.created_at.desc(),
    ).all()

    return jsonify({
        "success": True,
        "invites": [
            invite.to_dict()
            for invite in invites
        ],
    })


# =========================================================
# ACCEPT INVITE
# =========================================================

@clubs_bp.post("/invites/<int:invite_id>/accept")
def accept_invite(invite_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    invite = db.session.get(
        ClubInvite,
        invite_id,
    )

    if not invite:

        return jsonify({
            "success": False,
            "message": "Invite not found.",
        }), 404

    # -----------------------------------------------------
    # MAKE SURE INVITE BELONGS TO CURRENT USER
    # -----------------------------------------------------

    if invite.invitee_id != current_user.id:

        return jsonify({
            "success": False,
            "message": (
                "This invite does not belong to you."
            ),
        }), 403

    if invite.status != "PENDING":

        return jsonify({
            "success": False,
            "message": (
                "This invite is no longer pending."
            ),
        }), 400

    club = db.session.get(
        Club,
        invite.club_id,
    )

    # =====================================================
    # CLUB NO LONGER EXISTS
    # =====================================================

    if not club or not club.is_active:

        invite.status = "CANCELLED"
        invite.responded_at = datetime.utcnow()

        Notification.query.filter_by(
            user_id=current_user.id,
            notification_type="CLUB_INVITE",
            reference_type="CLUB_INVITE",
            reference_id=invite.id,
        ).update({
            "is_read": True,
        })

        db.session.commit()

        return jsonify({
            "success": False,
            "message": (
                "This club is no longer available."
            ),
        }), 404

    # =====================================================
    # CHECK IF ALREADY MEMBER
    # =====================================================

    existing_member = get_membership(
        invite.club_id,
        current_user.id,
    )

    if existing_member:

        invite.status = "ACCEPTED"
        invite.responded_at = datetime.utcnow()

        Notification.query.filter_by(
            user_id=current_user.id,
            notification_type="CLUB_INVITE",
            reference_type="CLUB_INVITE",
            reference_id=invite.id,
        ).update({
            "is_read": True,
        })

        db.session.commit()

        return jsonify({
            "success": False,
            "message": (
                "You are already a member "
                "of this club."
            ),
        }), 409

    # =====================================================
    # CREATE MEMBERSHIP
    # =====================================================

    member = ClubMember(
        club_id=invite.club_id,
        user_id=current_user.id,
        role="MEMBER",
    )

    db.session.add(member)

    # =====================================================
    # UPDATE INVITE
    # =====================================================

    invite.status = "ACCEPTED"
    invite.responded_at = datetime.utcnow()

    # =====================================================
    # MARK NOTIFICATION AS READ
    # =====================================================

    Notification.query.filter_by(
        user_id=current_user.id,
        notification_type="CLUB_INVITE",
        reference_type="CLUB_INVITE",
        reference_id=invite.id,
    ).update({
        "is_read": True,
    })

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "You joined the club.",
        "member": member.to_dict(),
        "invite": invite.to_dict(),
    })


# =========================================================
# DECLINE INVITE
# =========================================================

@clubs_bp.post("/invites/<int:invite_id>/decline")
def decline_invite(invite_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    invite = db.session.get(
        ClubInvite,
        invite_id,
    )

    if not invite:

        return jsonify({
            "success": False,
            "message": "Invite not found.",
        }), 404

    # -----------------------------------------------------
    # MAKE SURE INVITE BELONGS TO CURRENT USER
    # -----------------------------------------------------

    if invite.invitee_id != current_user.id:

        return jsonify({
            "success": False,
            "message": (
                "This invite does not belong to you."
            ),
        }), 403

    if invite.status != "PENDING":

        return jsonify({
            "success": False,
            "message": (
                "This invite is no longer pending."
            ),
        }), 400

    # =====================================================
    # DECLINE INVITE
    # =====================================================

    invite.status = "DECLINED"
    invite.responded_at = datetime.utcnow()

    # =====================================================
    # MARK NOTIFICATION AS READ
    # =====================================================

    Notification.query.filter_by(
        user_id=current_user.id,
        notification_type="CLUB_INVITE",
        reference_type="CLUB_INVITE",
        reference_id=invite.id,
    ).update({
        "is_read": True,
    })

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Invite declined.",
    })


# =========================================================
# JOIN PUBLIC CLUB
# =========================================================

@clubs_bp.post("/<int:club_id>/join")
def join_club(club_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    club = db.session.get(
        Club,
        club_id,
    )

    if not club or not club.is_active:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    if club.privacy != "Public":

        return jsonify({
            "success": False,
            "message": (
                "This is a private club. "
                "You need an invite."
            ),
        }), 403

    # =====================================================
    # CHECK EXISTING MEMBER
    # =====================================================

    existing_member = get_membership(
        club_id,
        current_user.id,
    )

    if existing_member:

        return jsonify({
            "success": False,
            "message": "You are already a member.",
        }), 409

    # =====================================================
    # CREATE MEMBERSHIP
    # =====================================================

    member = ClubMember(
        club_id=club_id,
        user_id=current_user.id,
        role="MEMBER",
    )

    db.session.add(member)

    # =====================================================
    # CANCEL PENDING INVITE IF ONE EXISTS
    # =====================================================

    pending_invite = ClubInvite.query.filter_by(
        club_id=club_id,
        invitee_id=current_user.id,
        status="PENDING",
    ).first()

    if pending_invite:

        pending_invite.status = "CANCELLED"
        pending_invite.responded_at = datetime.utcnow()

        # -----------------------------------------------
        # MARK RELATED NOTIFICATION AS READ
        # -----------------------------------------------

        Notification.query.filter_by(
            user_id=current_user.id,
            notification_type="CLUB_INVITE",
            reference_type="CLUB_INVITE",
            reference_id=pending_invite.id,
        ).update({
            "is_read": True,
        })

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "You joined the club.",
        "member": member.to_dict(),
    })


# =========================================================
# REMOVE MEMBER
# =========================================================

@clubs_bp.delete(
    "/<int:club_id>/members/<int:user_id>"
)
def remove_member(club_id, user_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    club = db.session.get(
        Club,
        club_id,
    )

    if not club:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    if not can_manage_club(
        club_id,
        current_user.id,
    ):

        return jsonify({
            "success": False,
            "message": "You do not have permission.",
        }), 403

    if user_id == club.owner_id:

        return jsonify({
            "success": False,
            "message": (
                "The club owner cannot be removed."
            ),
        }), 400

    member = get_membership(
        club_id,
        user_id,
    )

    if not member:

        return jsonify({
            "success": False,
            "message": "Member not found.",
        }), 404

    db.session.delete(member)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Member removed successfully.",
    })


# =========================================================
# CHANGE MEMBER ROLE
# =========================================================

@clubs_bp.patch(
    "/<int:club_id>/members/<int:user_id>"
)
def update_member_role(club_id, user_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    club = db.session.get(
        Club,
        club_id,
    )

    if not club:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    if current_user.id != club.owner_id:

        return jsonify({
            "success": False,
            "message": (
                "Only the club owner can change roles."
            ),
        }), 403

    if user_id == club.owner_id:

        return jsonify({
            "success": False,
            "message": (
                "Owner role cannot be changed."
            ),
        }), 400

    member = get_membership(
        club_id,
        user_id,
    )

    if not member:

        return jsonify({
            "success": False,
            "message": "Member not found.",
        }), 404

    data = request.get_json(
        silent=True,
    ) or {}

    role = str(
        data.get("role", "")
    ).upper()

    if role not in [
        "ADMIN",
        "MEMBER",
    ]:

        return jsonify({
            "success": False,
            "message": "Invalid role.",
        }), 400

    member.role = role

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Member role updated.",
        "member": member.to_dict(),
    })


# =========================================================
# LEAVE CLUB
# =========================================================

@clubs_bp.post("/<int:club_id>/leave")
def leave_club(club_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    club = db.session.get(
        Club,
        club_id,
    )

    if not club:

        return jsonify({
            "success": False,
            "message": "Club not found.",
        }), 404

    if current_user.id == club.owner_id:

        return jsonify({
            "success": False,
            "message": (
                "The club owner cannot leave the club. "
                "Transfer ownership first."
            ),
        }), 400

    member = get_membership(
        club_id,
        current_user.id,
    )

    if not member:

        return jsonify({
            "success": False,
            "message": (
                "You are not a member of this club."
            ),
        }), 404

    db.session.delete(member)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "You left the club.",
    })