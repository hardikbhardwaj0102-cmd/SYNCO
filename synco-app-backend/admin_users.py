from datetime import datetime
from functools import wraps

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func, or_, text

from models import (
    db,
    User,
    Notification,
    OrganizerApplication,
    AdminUserActionLog,
)


# =========================================================
# ADMIN USER MANAGEMENT
# =========================================================

admin_users_bp = Blueprint(
    "admin_users",
    __name__,
    url_prefix="/api/admin/users",
)


# =========================================================
# CONSTANTS
# =========================================================

ACTIVE = "active"
SUSPENDED = "suspended"

PLAYER = "player"
ORGANIZER = "organizer"
ADMIN = "admin"


# =========================================================
# HELPERS
# =========================================================

def json_error(message, status=400, **extra):
    payload = {
        "success": False,
        "message": message,
    }
    payload.update(extra)
    return jsonify(payload), status


def current_admin():
    """
    Resolve the authenticated admin from the session and database.
    Never trust account_role/account_status values stored inside the
    client session dictionary.
    """

    session_user = session.get("user") or {}
    user_id = session_user.get("id")

    if not user_id:
        return None

    admin = db.session.get(User, user_id)

    if not admin:
        return None

    if admin.account_role != ADMIN:
        return None

    if admin.account_status != ACTIVE:
        return None

    return admin


def require_admin(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        admin = current_admin()

        if admin is None:
            return json_error(
                "Administrator access required.",
                403,
            )

        return view_func(*args, **kwargs)

    return wrapped


def resolve_user(uid):
    normalized_uid = (uid or "").strip().upper()

    if not normalized_uid:
        return None

    return (
        User.query
        .filter(func.upper(User.uid) == normalized_uid)
        .first()
    )


def require_reason():
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason") or "").strip()

    if not reason:
        return None, json_error(
            "A reason is required for this action.",
            400,
        )

    if len(reason) > 2000:
        return None, json_error(
            "Reason must be 2000 characters or fewer.",
            400,
        )

    return reason, None


def request_metadata():
    return {
        "ip": request.remote_addr,
        "userAgent": (
            request.headers.get("User-Agent", "")[:2000]
            or None
        ),
    }


def create_audit_log(
    admin,
    target,
    action,
    reason=None,
    metadata=None,
):
    log = AdminUserActionLog(
        admin_id=admin.id if admin else None,
        target_user_id=target.id if target else None,
        target_uid=target.uid if target else None,
        target_email=target.email if target else None,
        action=action,
        reason=reason,
        audit_metadata=metadata or {},
        ip_address=request.remote_addr,
        user_agent=(
            request.headers.get("User-Agent", "")[:2000]
            or None
        ),
    )

    db.session.add(log)
    return log


def create_notification(
    user,
    title,
    message,
    data=None,
):
    notification = Notification(
        user_id=user.id,
        notification_type="ACCOUNT_ACTION",
        title=title,
        message=message,
        reference_type="user_account",
        reference_id=user.id,
        data=data or {},
        is_read=False,
    )

    db.session.add(notification)
    return notification


def get_user_summary(user):
    application = OrganizerApplication.query.filter_by(
        user_id=user.id
    ).first()

    counts = {}

    count_queries = {
        "clubsOwned": (
            "SELECT COUNT(*) FROM clubs "
            "WHERE owner_id = :user_id"
        ),
        "clubMemberships": (
            "SELECT COUNT(*) FROM club_members "
            "WHERE user_id = :user_id"
        ),
        "competitionsOrganized": (
            "SELECT COUNT(*) FROM competitions "
            "WHERE organizer_id = :user_id"
        ),
        "competitionParticipations": (
            "SELECT COUNT(*) FROM competition_participants "
            "WHERE user_id = :user_id"
        ),
        "matchResultsSubmitted": (
            "SELECT COUNT(*) FROM match_results "
            "WHERE submitted_by = :user_id"
        ),
        "playerMatchStats": (
            "SELECT COUNT(*) FROM player_match_stats "
            "WHERE user_id = :user_id"
        ),
        "clips": (
            "SELECT COUNT(*) FROM profile_clips "
            "WHERE user_id = :user_id"
        ),
        "notifications": (
            "SELECT COUNT(*) FROM notifications "
            "WHERE user_id = :user_id"
        ),
        "friendships": (
            "SELECT COUNT(*) FROM friendships "
            "WHERE user_id = :user_id "
            "OR friend_id = :user_id"
        ),
    }

    for key, sql in count_queries.items():
        value = db.session.execute(
            text(sql),
            {"user_id": user.id},
        ).scalar_one()
        counts[key] = int(value or 0)

    payload = user.to_dict()
    payload["organizerApplication"] = (
        application.to_dict()
        if application
        else None
    )
    payload["counts"] = counts

    return payload


def get_protected_delete_blockers(user_id):
    """
    Hard deletion is blocked when the account owns or created records
    that SYNCO needs to preserve for competition integrity.
    """

    blockers = []

    protected_checks = [
        (
            "clubs",
            "SELECT COUNT(*) FROM clubs WHERE owner_id = :user_id",
            "owns one or more clubs",
        ),
        (
            "competitions",
            "SELECT COUNT(*) FROM competitions WHERE organizer_id = :user_id",
            "organizes one or more competitions",
        ),
        (
            "match_results",
            "SELECT COUNT(*) FROM match_results WHERE submitted_by = :user_id",
            "submitted one or more match results",
        ),
        (
            "player_match_stats",
            "SELECT COUNT(*) FROM player_match_stats WHERE user_id = :user_id",
            "has player match statistics",
        ),
        (
            "competition_verification_records",
            "SELECT COUNT(*) FROM competition_verification_records WHERE verifier_id = :user_id",
            "verified one or more competition results",
        ),
        (
            "competition_disputes",
            "SELECT COUNT(*) FROM competition_disputes WHERE raised_by = :user_id",
            "raised one or more competition disputes",
        ),
    ]

    for key, sql, description in protected_checks:
        count = db.session.execute(
            text(sql),
            {"user_id": user_id},
        ).scalar_one()

        count = int(count or 0)

        if count > 0:
            blockers.append({
                "type": key,
                "count": count,
                "message": description,
            })

    return blockers


def delete_user_owned_data(user_id):
    """
    Remove user-owned/social data and anonymize nullable historical
    references before the final users row is deleted.

    Protected records are checked before this function is called.
    """

    statements = [
        # Clip interactions first.
        (
            "DELETE FROM profile_clip_likes "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM profile_clip_comments "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM profile_clips "
            "WHERE user_id = :user_id"
        ),

        # Profile / game data.
        (
            "DELETE FROM profile_games "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM player_game_stats "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM user_profiles "
            "WHERE user_id = :user_id"
        ),

        # Rewards.
        (
            "DELETE FROM user_challenges "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM user_inventory "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM user_achievements "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM reward_transactions "
            "WHERE user_id = :user_id"
        ),

        # Social graph.
        (
            "DELETE FROM club_members "
            "WHERE user_id = :user_id"
        ),
        (
            "DELETE FROM club_invites "
            "WHERE inviter_id = :user_id "
            "OR invitee_id = :user_id"
        ),
        (
            "DELETE FROM club_join_requests "
            "WHERE user_id = :user_id"
        ),
        (
            "UPDATE club_join_requests "
            "SET responded_by = NULL "
            "WHERE responded_by = :user_id"
        ),
        (
            "DELETE FROM club_recruitment_posts "
            "WHERE created_by = :user_id"
        ),
        (
            "DELETE FROM friend_requests "
            "WHERE sender_id = :user_id "
            "OR receiver_id = :user_id"
        ),
        (
            "DELETE FROM friendships "
            "WHERE user_id = :user_id "
            "OR friend_id = :user_id"
        ),
        (
            "DELETE FROM notifications "
            "WHERE user_id = :user_id"
        ),

        # Competition participant identity can be removed while
        # preserving the competition record itself.
        (
            "UPDATE competition_participants "
            "SET user_id = NULL "
            "WHERE user_id = :user_id"
        ),

        # Nullable historical references.
        (
            "UPDATE match_results "
            "SET verified_by = NULL "
            "WHERE verified_by = :user_id"
        ),
        (
            "UPDATE competition_verification_records "
            "SET verifier_id = NULL "
            "WHERE verifier_id = :user_id"
        ),
        (
            "UPDATE competition_disputes "
            "SET resolved_by = NULL "
            "WHERE resolved_by = :user_id"
        ),
        (
            "UPDATE competition_audit_logs "
            "SET actor_id = NULL "
            "WHERE actor_id = :user_id"
        ),

        # Organizer application is user-owned and can be removed.
        (
            "DELETE FROM organizer_applications "
            "WHERE user_id = :user_id"
        ),

        # Organizer application audit logs may still reference the
        # deleted user as the actor.
        (
            "UPDATE organizer_application_audit_logs "
            "SET actor_id = NULL "
            "WHERE actor_id = :user_id"
        ),
    ]

    for sql in statements:
        db.session.execute(
            text(sql),
            {"user_id": user_id},
        )


# =========================================================
# LIST / SEARCH USERS
# =========================================================

@admin_users_bp.route("", methods=["GET"])
@require_admin
def list_users():
    search = request.args.get("search", "").strip()
    role = request.args.get("role", "").strip().lower()
    status = request.args.get("status", "").strip().lower()

    query = User.query

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.uid.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.name.ilike(pattern),
            )
        )

    if role in {PLAYER, ORGANIZER, ADMIN}:
        query = query.filter(
            User.account_role == role
        )

    if status in {ACTIVE, SUSPENDED}:
        query = query.filter(
            User.account_status == status
        )

    users = (
        query
        .order_by(User.created_at.desc())
        .limit(200)
        .all()
    )

    return jsonify({
        "success": True,
        "users": [
            user.to_dict()
            for user in users
        ],
        "count": len(users),
    }), 200


# =========================================================
# USER DETAILS
# =========================================================

@admin_users_bp.route("/<string:uid>", methods=["GET"])
@require_admin
def get_user(uid):
    user = resolve_user(uid)

    if not user:
        return json_error(
            "User account not found.",
            404,
        )

    return jsonify({
        "success": True,
        "user": get_user_summary(user),
    }), 200


# =========================================================
# AUDIT HISTORY
# =========================================================

@admin_users_bp.route(
    "/<string:uid>/actions",
    methods=["GET"],
)
@require_admin
def get_user_actions(uid):
    user = resolve_user(uid)

    if user:
        logs = (
            AdminUserActionLog.query
            .filter(
                AdminUserActionLog.target_user_id == user.id
            )
            .order_by(AdminUserActionLog.created_at.desc())
            .limit(100)
            .all()
        )
    else:
        normalized_uid = (uid or "").strip().upper()
        logs = (
            AdminUserActionLog.query
            .filter(
                func.upper(AdminUserActionLog.target_uid)
                == normalized_uid
            )
            .order_by(AdminUserActionLog.created_at.desc())
            .limit(100)
            .all()
        )

    return jsonify({
        "success": True,
        "actions": [
            log.to_dict()
            for log in logs
        ],
    }), 200


# =========================================================
# REMOVE ORGANIZER ROLE
# =========================================================

@admin_users_bp.route(
    "/<string:uid>/remove-organizer",
    methods=["POST"],
)
@require_admin
def remove_organizer(uid):
    admin = current_admin()
    user = resolve_user(uid)

    if not user:
        return json_error(
            "User account not found.",
            404,
        )

    if user.id == admin.id:
        return json_error(
            "You cannot change your own administrator account here.",
            403,
        )

    if user.account_role == ADMIN:
        return json_error(
            "Administrator accounts are protected.",
            403,
        )

    if user.account_role != ORGANIZER:
        return json_error(
            "This account is not an organizer.",
            409,
        )

    reason, error = require_reason()

    if error:
        return error

    application = OrganizerApplication.query.filter_by(
        user_id=user.id
    ).first()

    previous_role = user.account_role
    previous_application_status = (
        application.status
        if application
        else None
    )

    try:
        user.account_role = PLAYER

        if application:
            application.status = "suspended"
            application.rejection_reason = reason
            application.reviewed_by = admin.id
            application.reviewed_at = datetime.utcnow()

        create_audit_log(
            admin=admin,
            target=user,
            action="REMOVE_ORGANIZER",
            reason=reason,
            metadata={
                "previousRole": previous_role,
                "newRole": PLAYER,
                "previousApplicationStatus": previous_application_status,
                "newApplicationStatus": (
                    application.status
                    if application
                    else None
                ),
            },
        )

        create_notification(
            user=user,
            title="Organizer access removed",
            message=(
                "Your SYNCO organizer role has been removed by an administrator."
            ),
            data={
                "action": "REMOVE_ORGANIZER",
                "reason": reason,
            },
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Organizer access removed.",
            "user": user.to_dict(),
        }), 200

    except Exception as exc:
        db.session.rollback()

        return json_error(
            "Unable to remove organizer access.",
            500,
            error=str(exc),
        )


# =========================================================
# SUSPEND ACCOUNT
# =========================================================

@admin_users_bp.route(
    "/<string:uid>/suspend",
    methods=["POST"],
)
@require_admin
def suspend_user(uid):
    admin = current_admin()
    user = resolve_user(uid)

    if not user:
        return json_error(
            "User account not found.",
            404,
        )

    if user.id == admin.id:
        return json_error(
            "You cannot suspend your own administrator account.",
            403,
        )

    if user.account_role == ADMIN:
        return json_error(
            "Administrator accounts are protected.",
            403,
        )

    reason, error = require_reason()

    if error:
        return error

    if user.account_status == SUSPENDED:
        return json_error(
            "This account is already suspended.",
            409,
        )

    previous_status = user.account_status

    try:
        user.account_status = SUSPENDED
        user.account_status_reason = reason
        user.account_status_changed_at = datetime.utcnow()

        create_audit_log(
            admin=admin,
            target=user,
            action="SUSPEND_ACCOUNT",
            reason=reason,
            metadata={
                "previousStatus": previous_status,
                "newStatus": SUSPENDED,
                "accountRole": user.account_role,
            },
        )

        create_notification(
            user=user,
            title="Account suspended",
            message=(
                "Your SYNCO account has been suspended by an administrator."
            ),
            data={
                "action": "SUSPEND_ACCOUNT",
                "reason": reason,
            },
        )

        db.session.commit()

        # The target user's existing Flask session will be rejected by
        # the global account-status guard once that guard is installed.
        return jsonify({
            "success": True,
            "message": "Account suspended.",
            "user": user.to_dict(),
        }), 200

    except Exception as exc:
        db.session.rollback()

        return json_error(
            "Unable to suspend account.",
            500,
            error=str(exc),
        )


# =========================================================
# UNSUSPEND ACCOUNT
# =========================================================

@admin_users_bp.route(
    "/<string:uid>/unsuspend",
    methods=["POST"],
)
@require_admin
def unsuspend_user(uid):
    admin = current_admin()
    user = resolve_user(uid)

    if not user:
        return json_error(
            "User account not found.",
            404,
        )

    if user.id == admin.id:
        return json_error(
            "This account is already active and cannot be changed here.",
            403,
        )

    if user.account_role == ADMIN:
        return json_error(
            "Administrator accounts are protected.",
            403,
        )

    if user.account_status != SUSPENDED:
        return json_error(
            "This account is not suspended.",
            409,
        )

    previous_status = user.account_status
    previous_reason = user.account_status_reason

    try:
        user.account_status = ACTIVE
        user.account_status_reason = None
        user.account_status_changed_at = datetime.utcnow()

        create_audit_log(
            admin=admin,
            target=user,
            action="UNSUSPEND_ACCOUNT",
            reason="Account suspension removed by administrator.",
            metadata={
                "previousStatus": previous_status,
                "newStatus": ACTIVE,
                "previousReason": previous_reason,
                "accountRole": user.account_role,
            },
        )

        create_notification(
            user=user,
            title="Account restored",
            message="Your SYNCO account has been restored by an administrator.",
            data={
                "action": "UNSUSPEND_ACCOUNT",
            },
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Account restored.",
            "user": user.to_dict(),
        }), 200

    except Exception as exc:
        db.session.rollback()

        return json_error(
            "Unable to restore account.",
            500,
            error=str(exc),
        )


# =========================================================
# HARD DELETE ACCOUNT
# =========================================================

@admin_users_bp.route(
    "/<string:uid>",
    methods=["DELETE"],
)
@require_admin
def delete_user(uid):
    admin = current_admin()
    user = resolve_user(uid)

    if not user:
        return json_error(
            "User account not found.",
            404,
        )

    if user.id == admin.id:
        return json_error(
            "You cannot delete your own administrator account.",
            403,
        )

    if user.account_role == ADMIN:
        return json_error(
            "Administrator accounts are protected.",
            403,
        )

    reason, error = require_reason()

    if error:
        return error

    blockers = get_protected_delete_blockers(user.id)

    if blockers:
        return json_error(
            "This account cannot be permanently deleted because it owns or has created protected competition history.",
            409,
            canDelete=False,
            blockers=blockers,
            recommendation=(
                "Use Suspend Account or Remove Organizer, "
                "or transfer the protected records before deletion."
            ),
        )

    target_snapshot = {
        "id": user.id,
        "uid": user.uid,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "accountRole": user.account_role,
        "accountStatus": user.account_status,
    }

    try:
        audit = create_audit_log(
            admin=admin,
            target=user,
            action="DELETE_ACCOUNT",
            reason=reason,
            metadata={
                "deletedUser": target_snapshot,
                **request_metadata(),
            },
        )

        # Preserve the audit record even after the target user row is gone.
        # target_uid / target_email remain as immutable snapshots.
        audit.target_user_id = None

        delete_user_owned_data(user.id)

        db.session.delete(user)
        db.session.commit()

        # The browser can no longer use the target account because the
        # users row is permanently gone.
        return jsonify({
            "success": True,
            "message": "Account permanently deleted.",
            "deletedUid": target_snapshot["uid"],
        }), 200

    except Exception as exc:
        db.session.rollback()

        return json_error(
            "Unable to permanently delete this account.",
            500,
            error=str(exc),
        )
