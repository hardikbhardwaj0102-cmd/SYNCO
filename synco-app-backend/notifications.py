from flask import Blueprint, jsonify, session

from models import (
    db,
    User,
    Notification,
    FriendRequest,
    ClubInvite,
    Competition,
    CompetitionParticipant,
    CompetitionTeamInvite,
    CompetitionSubstitutionRequest,
)


# =========================================================
# BLUEPRINT
# =========================================================

notifications_bp = Blueprint(
    "notifications",
    __name__,
    url_prefix="/api/notifications",
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

    return db.session.get(
        User,
        user_id,
    )


# =========================================================
# NORMALIZE / ENRICH NOTIFICATION
# =========================================================

def serialize_notification(notification):
    """
    Return the normal notification payload plus the CURRENT state
    of interactive friend requests and club invitations.

    This is intentionally calculated from the related database
    record rather than relying only on notification.is_read.

    That means old notifications created before this fix are also
    corrected after a refresh.
    """

    payload = notification.to_dict()

    data = payload.get("data") or {}

    if not isinstance(data, dict):
        data = {}

    notification_type = str(
        payload.get("type")
        or payload.get("notificationType")
        or payload.get("notification_type")
        or ""
    ).upper()

    reference_type = str(
        payload.get("referenceType")
        or payload.get("reference_type")
        or ""
    ).upper()

    reference_id = (
        payload.get("referenceId")
        if payload.get("referenceId") is not None
        else payload.get("reference_id")
    )

    # =====================================================
    # FRIEND REQUEST
    # =====================================================

    if (
        notification_type.startswith("FRIEND_")
        or reference_type == "FRIEND_REQUEST"
    ):

        request_id = (
            data.get("requestId")
            or data.get("request_id")
            or reference_id
        )

        if request_id:

            friend_request = db.session.get(
                FriendRequest,
                request_id,
            )

            if friend_request:

                status = str(
                    friend_request.status or ""
                ).upper()

                sender_name = (
                    data.get("senderName")
                    or data.get("sender_name")
                    or getattr(
                        friend_request.sender,
                        "name",
                        None,
                    )
                    or getattr(
                        friend_request.sender,
                        "username",
                        None,
                    )
                    or "this player"
                )

                payload["actionStatus"] = status
                payload["action_status"] = status

                data["actionStatus"] = status
                data["action_status"] = status
                data["requestStatus"] = status
                data["request_status"] = status

                payload["data"] = data

                if status == "PENDING":

                    payload["type"] = "FRIEND_REQUEST"
                    payload["notificationType"] = "FRIEND_REQUEST"
                    payload["notification_type"] = "FRIEND_REQUEST"

                elif status == "ACCEPTED":

                    payload["type"] = "FRIEND_ACCEPTED"
                    payload["notificationType"] = "FRIEND_ACCEPTED"
                    payload["notification_type"] = "FRIEND_ACCEPTED"

                    payload["title"] = "Friend Request Accepted"
                    payload["message"] = (
                        f"You are now friends with {sender_name}."
                    )
                    payload["isRead"] = True
                    payload["is_read"] = True

                elif status == "DECLINED":

                    payload["type"] = "FRIEND_DECLINED"
                    payload["notificationType"] = "FRIEND_DECLINED"
                    payload["notification_type"] = "FRIEND_DECLINED"

                    payload["title"] = "Friend Request Declined"
                    payload["message"] = (
                        f"The friend request from {sender_name} was declined."
                    )
                    payload["isRead"] = True
                    payload["is_read"] = True

                elif status == "CANCELLED":

                    payload["type"] = "FRIEND_CANCELLED"
                    payload["notificationType"] = "FRIEND_CANCELLED"
                    payload["notification_type"] = "FRIEND_CANCELLED"

                    payload["title"] = "Friend Request Cancelled"
                    payload["message"] = (
                        f"The friend request from {sender_name} was cancelled."
                    )
                    payload["isRead"] = True
                    payload["is_read"] = True

    # =====================================================
    # CLUB INVITATION
    # =====================================================

    if (
        notification_type == "CLUB_INVITE"
        or reference_type == "CLUB_INVITE"
    ):

        invite_id = (
            data.get("inviteId")
            or data.get("invite_id")
            or reference_id
        )

        if invite_id:

            invite = db.session.get(
                ClubInvite,
                invite_id,
            )

            if invite:

                status = str(
                    invite.status or ""
                ).upper()

                club = invite.club
                club_name = (
                    data.get("clubName")
                    or data.get("club_name")
                    or getattr(
                        club,
                        "name",
                        None,
                    )
                    or "the club"
                )

                payload["actionStatus"] = status
                payload["action_status"] = status

                data["actionStatus"] = status
                data["action_status"] = status
                data["inviteStatus"] = status
                data["invite_status"] = status

                payload["data"] = data

                if status == "PENDING":

                    payload["type"] = "CLUB_INVITE"
                    payload["notificationType"] = "CLUB_INVITE"
                    payload["notification_type"] = "CLUB_INVITE"

                elif status == "ACCEPTED":

                    payload["type"] = "CLUB_INVITE_ACCEPTED"
                    payload["notificationType"] = "CLUB_INVITE_ACCEPTED"
                    payload["notification_type"] = "CLUB_INVITE_ACCEPTED"

                    payload["title"] = "Club Invitation Accepted"
                    payload["message"] = (
                        f"You joined {club_name}."
                    )
                    payload["isRead"] = True
                    payload["is_read"] = True

                elif status == "DECLINED":

                    payload["type"] = "CLUB_INVITE_DECLINED"
                    payload["notificationType"] = "CLUB_INVITE_DECLINED"
                    payload["notification_type"] = "CLUB_INVITE_DECLINED"

                    payload["title"] = "Club Invitation Declined"
                    payload["message"] = (
                        f"You declined the invitation to join {club_name}."
                    )
                    payload["isRead"] = True
                    payload["is_read"] = True

                elif status == "CANCELLED":

                    payload["type"] = "CLUB_INVITE_CANCELLED"
                    payload["notificationType"] = "CLUB_INVITE_CANCELLED"
                    payload["notification_type"] = "CLUB_INVITE_CANCELLED"

                    payload["title"] = "Club Invitation Cancelled"
                    payload["message"] = (
                        f"The invitation to join {club_name} was cancelled."
                    )
                    payload["isRead"] = True
                    payload["is_read"] = True

    # =====================================================
    # COMPETITION REGISTRATION / INVITES / SUBSTITUTIONS
    # =====================================================

    if (
        notification_type.startswith("COMPETITION_")
        or reference_type == "COMPETITION"
    ):

        invite_id = data.get("inviteId") or data.get("invite_id")
        substitution_id = (
            data.get("substitutionRequestId")
            or data.get("substitution_request_id")
        )

        invite = None
        substitution = None

        if invite_id:
            invite = db.session.get(CompetitionTeamInvite, invite_id)

        if substitution_id:
            substitution = db.session.get(
                CompetitionSubstitutionRequest,
                substitution_id,
            )

        if invite:
            invite_status = str(invite.status or "").upper()
            payload["actionStatus"] = invite_status
            payload["action_status"] = invite_status
            payload["inviteStatus"] = invite_status
            payload["invite_status"] = invite_status
            data["actionStatus"] = invite_status
            data["action_status"] = invite_status
            data["inviteStatus"] = invite_status
            data["invite_status"] = invite_status
            data["inviteId"] = invite.id
            data["participantId"] = invite.participant_id
            data["expiresAt"] = (
                invite.expires_at.isoformat()
                if invite.expires_at
                else None
            )
            data["inviteType"] = invite.invite_type
            data["actionUrl"] = f"/competitions/{invite.competition_id}/register"
            payload["data"] = data

            if invite_status != "PENDING":
                # Once the member responds or a competing invite is
                # cancelled/expired, there is no longer an action to take.
                payload["isRead"] = True
                payload["is_read"] = True

        if substitution:
            substitution_status = str(substitution.status or "").upper()
            payload["actionStatus"] = substitution_status
            payload["action_status"] = substitution_status
            payload["substitutionStatus"] = substitution_status
            payload["substitution_status"] = substitution_status
            data["actionStatus"] = substitution_status
            data["action_status"] = substitution_status
            data["substitutionStatus"] = substitution_status
            data["substitution_status"] = substitution_status
            data["substitutionRequestId"] = substitution.id
            data["participantId"] = substitution.participant_id
            data["decisionDeadline"] = (
                substitution.decision_deadline.isoformat()
                if substitution.decision_deadline
                else None
            )
            payload["data"] = data

            if substitution_status != "PENDING":
                payload["isRead"] = True
                payload["is_read"] = True

    return payload


# =========================================================
# COMPETITION TIMER MAINTENANCE
# =========================================================

def process_current_user_competition_timers(current_user):
    """
    Process registration expiry/reminders for competitions that are relevant
    to the current user. This keeps invite status and captain notifications
    current whenever the notification center is opened or its unread badge is
    refreshed.
    """

    if not current_user:
        return

    try:
        from competition import process_competition_registration_timers

        competition_ids = set(
            row[0]
            for row in (
                db.session.query(CompetitionTeamInvite.competition_id)
                .filter(
                    CompetitionTeamInvite.invited_user_id == current_user.id
                )
                .distinct()
                .all()
            )
        )

        captain_ids = {
            row[0]
            for row in (
                db.session.query(CompetitionParticipant.competition_id)
                .filter(
                    CompetitionParticipant.user_id == current_user.id,
                    CompetitionParticipant.participant_type == "TEAM",
                    CompetitionParticipant.registration_status.in_([
                        "PENDING",
                        "ACCEPTED",
                        "LOCKED",
                    ]),
                )
                .distinct()
                .all()
            )
        }
        competition_ids.update(captain_ids)

        for competition_id in competition_ids:
            competition = db.session.get(Competition, competition_id)
            if competition:
                process_competition_registration_timers(
                    competition,
                    commit=False,
                )

        if competition_ids:
            db.session.commit()

    except Exception as exc:
        db.session.rollback()
        print("Competition notification maintenance error:", exc)


# =========================================================
# GET ALL NOTIFICATIONS
# =========================================================

@notifications_bp.get("")
def get_notifications():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    process_current_user_competition_timers(current_user)

    notifications = Notification.query.filter_by(
        user_id=current_user.id,
    ).order_by(
        Notification.created_at.desc(),
    ).all()

    serialized_notifications = [
        serialize_notification(notification)
        for notification in notifications
    ]

    # Count effective unread state from the serialized notifications.
    # This keeps the unread badge correct even for older interactive
    # notifications whose underlying action was already completed.
    unread_count = sum(
        1
        for notification in serialized_notifications
        if not (
            notification.get("isRead")
            or notification.get("is_read")
        )
    )

    return jsonify({
        "success": True,
        "notifications": serialized_notifications,
        "unreadCount": unread_count,
    })


# =========================================================
# UNREAD COUNT
# =========================================================

@notifications_bp.get("/unread-count")
def get_unread_count():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    process_current_user_competition_timers(current_user)

    notifications = Notification.query.filter_by(
        user_id=current_user.id,
    ).all()

    serialized_notifications = [
        serialize_notification(notification)
        for notification in notifications
    ]

    count = sum(
        1
        for notification in serialized_notifications
        if not (
            notification.get("isRead")
            or notification.get("is_read")
        )
    )

    return jsonify({
        "success": True,
        "unreadCount": count,
    })


# =========================================================
# MARK ONE AS READ
# =========================================================

@notifications_bp.patch("/<int:notification_id>/read")
def mark_as_read(notification_id):

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    notification = db.session.get(
        Notification,
        notification_id,
    )

    if not notification:

        return jsonify({
            "success": False,
            "message": "Notification not found.",
        }), 404

    if notification.user_id != current_user.id:

        return jsonify({
            "success": False,
            "message": "You cannot modify this notification.",
        }), 403

    notification.is_read = True

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Notification marked as read.",
        "notification": serialize_notification(notification),
    })


# =========================================================
# MARK ALL AS READ
# =========================================================

@notifications_bp.patch("/read-all")
def mark_all_as_read():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "success": False,
            "message": "You must be logged in.",
        }), 401

    Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False,
    ).update({
        "is_read": True,
    })

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "All notifications marked as read.",
    })
