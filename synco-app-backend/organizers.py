# =========================================================
# SYNCO ORGANIZER API
# =========================================================

from datetime import datetime
import secrets

from flask import Blueprint, jsonify, request, session

from models import (
    db,
    User,
    OrganizerApplication,
    OrganizerApplicationAuditLog,
)


organizers_bp = Blueprint(
    "organizers",
    __name__,
    url_prefix="/api/organizers",
)


# =========================================================
# AUTH HELPERS
# =========================================================


def get_current_user():
    """
    Resolve the currently authenticated SYNCO user.

    Supports the common session keys used by existing SYNCO auth
    implementations. Keep the actual auth system responsible for
    creating the session; this module only reads it.
    """

    possible_keys = (
        "user_id",
        "id",
        "user",
    )

    for key in possible_keys:
        value = session.get(key)

        if value is None:
            continue

        if isinstance(value, dict):
            value = value.get("id")

        try:
            user_id = int(value)
        except (TypeError, ValueError):
            continue

        user = db.session.get(User, user_id)

        if user:
            return user

    return None


def require_login():
    user = get_current_user()

    if user is None:
        return None, (
            jsonify({
                "error": "Authentication required.",
            }),
            401,
        )

    return user, None


def require_admin():
    user, error = require_login()

    if error:
        return None, error

    if user.account_role != "admin":
        return None, (
            jsonify({
                "error": "Admin access required.",
            }),
            403,
        )

    return user, None


# =========================================================
# HELPERS
# =========================================================


def generate_application_code():
    while True:
        code = (
            "ORG-"
            + datetime.utcnow().strftime("%Y")
            + "-"
            + secrets.token_hex(4).upper()
        )

        exists = OrganizerApplication.query.filter_by(
            application_code=code
        ).first()

        if not exists:
            return code


def client_ip():
    forwarded = request.headers.get("X-Forwarded-For")

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.remote_addr


def write_audit(
    application,
    actor_id,
    action,
    previous_status=None,
    new_status=None,
    reason=None,
    metadata=None,
):
    audit = OrganizerApplicationAuditLog(
        application_id=application.id,
        actor_id=actor_id,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        reason=reason,
        audit_metadata=metadata or {},
        ip_address=client_ip(),
        user_agent=request.headers.get("User-Agent"),
    )

    db.session.add(audit)


def clean_string(value, max_length=None):
    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    if max_length:
        value = value[:max_length]

    return value


def clean_list(value):
    if not isinstance(value, list):
        return []

    result = []

    for item in value:
        item = clean_string(item, 100)

        if item and item not in result:
            result.append(item)

    return result


# =========================================================
# PLAYER: SUBMIT APPLICATION
# =========================================================


@organizers_bp.route("/apply", methods=["POST"])
def submit_application():
    user, error = require_login()

    if error:
        return error

    if user.account_role == "admin":
        return jsonify({
            "error": "Admin accounts do not need an organizer application.",
        }), 400

    if user.account_role == "organizer":
        return jsonify({
            "error": "You are already an approved organizer.",
        }), 400

    existing = OrganizerApplication.query.filter_by(
        user_id=user.id
    ).first()

    if existing:
        return jsonify({
            "error": "You already have an organizer application.",
            "application": existing.to_dict(),
        }), 409

    data = request.get_json(silent=True) or {}

    organization_name = clean_string(
        data.get("organization_name"),
        150,
    )

    organizer_type = clean_string(
        data.get("organizer_type"),
        50,
    )

    country = clean_string(
        data.get("country"),
        100,
    )

    city = clean_string(
        data.get("city"),
        100,
    )

    contact_phone = clean_string(
        data.get("contact_phone"),
        30,
    )

    experience_description = clean_string(
        data.get("experience_description"),
        3000,
    )

    organizer_description = clean_string(
        data.get("organizer_description"),
        3000,
    )

    games = clean_list(data.get("games"))
    planned_games = clean_list(data.get("planned_games"))

    tournament_frequency = clean_string(
        data.get("tournament_frequency"),
        40,
    )

    website_url = clean_string(
        data.get("website_url"),
        500,
    )

    discord_url = clean_string(
        data.get("discord_url"),
        500,
    )

    social_url = clean_string(
        data.get("social_url"),
        500,
    )

    previous_event_url = clean_string(
        data.get("previous_event_url"),
        500,
    )

    # -----------------------------------------------------
    # REQUIRED VALIDATION
    # -----------------------------------------------------

    required = {
        "organization_name": organization_name,
        "organizer_type": organizer_type,
        "country": country,
        "contact_phone": contact_phone,
        "tournament_frequency": tournament_frequency,
        "organizer_description": organizer_description,
    }

    missing = [
        name
        for name, value in required.items()
        if not value
    ]

    if missing:
        return jsonify({
            "error": "Required fields are missing.",
            "fields": missing,
        }), 400

    if not games:
        return jsonify({
            "error": "Select at least one game you organize.",
        }), 400

    if not planned_games:
        return jsonify({
            "error": "Select at least one game you plan to organize on SYNCO.",
        }), 400

    # -----------------------------------------------------
    # NUMBER VALIDATION
    # -----------------------------------------------------

    try:
        experience_years = int(
            data.get("experience_years", 0)
        )

        events_organized = int(
            data.get("events_organized", 0)
        )

        largest_event_size = data.get(
            "largest_event_size"
        )

        if largest_event_size not in (None, ""):
            largest_event_size = int(
                largest_event_size
            )
        else:
            largest_event_size = None

        expected_participants = data.get(
            "expected_participants"
        )

        if expected_participants not in (None, ""):
            expected_participants = int(
                expected_participants
            )
        else:
            expected_participants = None

    except (TypeError, ValueError):
        return jsonify({
            "error": "One or more numeric fields are invalid.",
        }), 400

    if experience_years < 0 or experience_years > 100:
        return jsonify({
            "error": "Invalid organizer experience value.",
        }), 400

    if events_organized < 0:
        return jsonify({
            "error": "Events organized cannot be negative.",
        }), 400

    if largest_event_size is not None and largest_event_size <= 0:
        return jsonify({
            "error": "Largest event size must be greater than zero.",
        }), 400

    if expected_participants is not None and expected_participants <= 0:
        return jsonify({
            "error": "Expected participants must be greater than zero.",
        }), 400

    # -----------------------------------------------------
    # CREATE APPLICATION
    # -----------------------------------------------------

    application = OrganizerApplication(
        user_id=user.id,
        application_code=generate_application_code(),
        organization_name=organization_name,
        organizer_type=organizer_type,
        country=country,
        city=city,
        contact_phone=contact_phone,
        experience_years=experience_years,
        events_organized=events_organized,
        largest_event_size=largest_event_size,
        games=games,
        website_url=website_url,
        discord_url=discord_url,
        social_url=social_url,
        previous_event_url=previous_event_url,
        experience_description=experience_description,
        planned_games=planned_games,
        tournament_frequency=tournament_frequency,
        expected_participants=expected_participants,
        organizer_description=organizer_description,
        status="pending",
        submitted_ip=client_ip(),
        user_agent=request.headers.get("User-Agent"),
    )

    db.session.add(application)
    db.session.flush()

    write_audit(
        application=application,
        actor_id=user.id,
        action="submitted",
        new_status="pending",
    )

    db.session.commit()

    return jsonify({
        "message": "Organizer application submitted successfully.",
        "application": application.to_dict(),
    }), 201


# =========================================================
# PLAYER: CURRENT APPLICATION
# =========================================================


@organizers_bp.route("/application", methods=["GET"])
def my_application():
    user, error = require_login()

    if error:
        return error

    application = OrganizerApplication.query.filter_by(
        user_id=user.id
    ).first()

    return jsonify({
        "application": (
            application.to_dict()
            if application
            else None
        ),
        "accountRole": user.account_role,
    })


# =========================================================
# ADMIN: LIST APPLICATIONS
# =========================================================


@organizers_bp.route(
    "/admin/applications",
    methods=["GET"],
)
def admin_applications():
    admin, error = require_admin()

    if error:
        return error

    status = clean_string(
        request.args.get("status"),
        30,
    )

    query = OrganizerApplication.query

    if status:
        allowed_statuses = {
            "pending",
            "under_review",
            "approved",
            "rejected",
            "suspended",
        }

        if status not in allowed_statuses:
            return jsonify({
                "error": "Invalid status filter.",
            }), 400

        query = query.filter_by(
            status=status
        )

    applications = query.order_by(
        OrganizerApplication.submitted_at.desc()
    ).all()

    response = []

    for application in applications:
        item = application.to_dict()

        item["applicant"] = {
            "id": application.applicant.id,
            "uid": application.applicant.uid,
            "username": application.applicant.username,
            "name": application.applicant.name,
            "email": application.applicant.email,
            "accountRole": application.applicant.account_role,
        }

        response.append(item)

    return jsonify({
        "applications": response,
        "count": len(response),
    })


# =========================================================
# ADMIN: APPLICATION DETAILS
# =========================================================


@organizers_bp.route(
    "/admin/applications/<int:application_id>",
    methods=["GET"],
)
def admin_application_details(application_id):
    admin, error = require_admin()

    if error:
        return error

    application = db.session.get(
        OrganizerApplication,
        application_id,
    )

    if application is None:
        return jsonify({
            "error": "Organizer application not found.",
        }), 404

    logs = OrganizerApplicationAuditLog.query.filter_by(
        application_id=application.id
    ).order_by(
        OrganizerApplicationAuditLog.created_at.desc()
    ).all()

    data = application.to_dict()

    data["applicant"] = {
        "id": application.applicant.id,
        "uid": application.applicant.uid,
        "username": application.applicant.username,
        "name": application.applicant.name,
        "email": application.applicant.email,
        "accountRole": application.applicant.account_role,
    }

    data["audit_logs"] = [
        log.to_dict()
        for log in logs
    ]

    return jsonify(data)


# =========================================================
# ADMIN: MARK UNDER REVIEW
# =========================================================


@organizers_bp.route(
    "/admin/applications/<int:application_id>/review",
    methods=["POST"],
)
def review_application(application_id):
    admin, error = require_admin()

    if error:
        return error

    application = db.session.get(
        OrganizerApplication,
        application_id,
    )

    if application is None:
        return jsonify({
            "error": "Organizer application not found.",
        }), 404

    if application.status == "approved":
        return jsonify({
            "error": "Approved applications cannot be moved back to review.",
        }), 400

    previous_status = application.status

    application.status = "under_review"
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.utcnow()

    write_audit(
        application=application,
        actor_id=admin.id,
        action="under_review",
        previous_status=previous_status,
        new_status="under_review",
    )

    db.session.commit()

    return jsonify({
        "message": "Application moved to review.",
        "application": application.to_dict(),
    })


# =========================================================
# ADMIN: APPROVE
# =========================================================


@organizers_bp.route(
    "/admin/applications/<int:application_id>/approve",
    methods=["POST"],
)
def approve_application(application_id):
    admin, error = require_admin()

    if error:
        return error

    application = db.session.get(
        OrganizerApplication,
        application_id,
    )

    if application is None:
        return jsonify({
            "error": "Organizer application not found.",
        }), 404

    if application.status == "approved":
        return jsonify({
            "error": "Application is already approved.",
        }), 400

    applicant = application.applicant

    if applicant is None:
        return jsonify({
            "error": "Applicant account no longer exists.",
        }), 400

    previous_status = application.status

    application.status = "approved"
    application.rejection_reason = None
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.utcnow()

    # Platform-level permission.
    # This does NOT touch ProfileGame.role.
    applicant.account_role = "organizer"

    write_audit(
        application=application,
        actor_id=admin.id,
        action="approved",
        previous_status=previous_status,
        new_status="approved",
        metadata={
            "account_role_before": "player",
            "account_role_after": "organizer",
        },
    )

    db.session.commit()

    return jsonify({
        "message": "Organizer approved successfully.",
        "application": application.to_dict(),
        "user": applicant.to_dict(),
    })


# =========================================================
# ADMIN: REJECT
# =========================================================


@organizers_bp.route(
    "/admin/applications/<int:application_id>/reject",
    methods=["POST"],
)
def reject_application(application_id):
    admin, error = require_admin()

    if error:
        return error

    application = db.session.get(
        OrganizerApplication,
        application_id,
    )

    if application is None:
        return jsonify({
            "error": "Organizer application not found.",
        }), 404

    data = request.get_json(silent=True) or {}

    reason = clean_string(
        data.get("reason"),
        2000,
    )

    if not reason:
        return jsonify({
            "error": "A rejection reason is required.",
        }), 400

    if application.status == "approved":
        return jsonify({
            "error": "An approved organizer cannot be rejected from this endpoint.",
        }), 400

    previous_status = application.status

    application.status = "rejected"
    application.rejection_reason = reason
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.utcnow()

    write_audit(
        application=application,
        actor_id=admin.id,
        action="rejected",
        previous_status=previous_status,
        new_status="rejected",
        reason=reason,
    )

    db.session.commit()

    return jsonify({
        "message": "Organizer application rejected.",
        "application": application.to_dict(),
    })


# =========================================================
# ADMIN: SUSPEND ORGANIZER
# =========================================================


@organizers_bp.route(
    "/admin/users/<int:user_id>/suspend",
    methods=["POST"],
)
def suspend_organizer(user_id):
    admin, error = require_admin()

    if error:
        return error

    user = db.session.get(
        User,
        user_id,
    )

    if user is None:
        return jsonify({
            "error": "User not found.",
        }), 404

    if user.account_role != "organizer":
        return jsonify({
            "error": "User is not an approved organizer.",
        }), 400

    data = request.get_json(silent=True) or {}

    reason = clean_string(
        data.get("reason"),
        2000,
    )

    if not reason:
        return jsonify({
            "error": "A suspension reason is required.",
        }), 400

    application = OrganizerApplication.query.filter_by(
        user_id=user.id
    ).first()

    previous_role = user.account_role

    user.account_role = "player"

    if application:
        previous_status = application.status

        application.status = "suspended"
        application.reviewed_by = admin.id
        application.reviewed_at = datetime.utcnow()

        write_audit(
            application=application,
            actor_id=admin.id,
            action="suspended",
            previous_status=previous_status,
            new_status="suspended",
            reason=reason,
            metadata={
                "account_role_before": previous_role,
                "account_role_after": "player",
            },
        )

    db.session.commit()

    return jsonify({
        "message": "Organizer suspended.",
        "user": user.to_dict(),
    })
