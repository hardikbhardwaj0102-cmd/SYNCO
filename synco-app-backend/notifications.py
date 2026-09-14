from flask import Blueprint, jsonify, session

from models import db, User, Notification


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

    notifications = Notification.query.filter_by(
        user_id=current_user.id,
    ).order_by(
        Notification.created_at.desc(),
    ).all()

    unread_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False,
    ).count()

    return jsonify({
        "success": True,
        "notifications": [
            notification.to_dict()
            for notification in notifications
        ],
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

    count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False,
    ).count()

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
        "notification": notification.to_dict(),
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