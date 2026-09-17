from flask import jsonify, request, session

from models import db, User


# =========================================================
# ACCOUNT STATUS GUARD
# =========================================================

# Routes that must remain reachable even when a stale session belongs
# to a suspended account. This lets the account log out and lets the
# auth endpoints decide their own response for unauthenticated users.
AUTH_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/discord",
    "/api/auth/discord/login",
    "/api/auth/discord/callback",
    "/api/auth/send-otp",
    "/api/auth/verify-otp",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
}


def install_account_status_guard(app):
    """
    Install one global request guard.

    Any authenticated session is re-checked against the users table.
    This means suspending an account immediately blocks subsequent API
    requests without depending on every individual blueprint to add a
    decorator.
    """

    @app.before_request
    def enforce_account_status():
        path = request.path.rstrip("/") or "/"

        if path in AUTH_EXEMPT_PATHS:
            return None

        session_user = session.get("user") or {}
        user_id = session_user.get("id")

        # No authenticated session. Let the route itself decide whether
        # authentication is required.
        if not user_id:
            return None

        user = db.session.get(User, user_id)

        # Deleted account: terminate the stale session.
        if user is None:
            session.clear()

            return jsonify({
                "success": False,
                "authenticated": False,
                "message": "This SYNCO account no longer exists.",
            }), 401

        # Suspended account: terminate the session and block the request.
        if user.account_status != "active":
            session.clear()

            return jsonify({
                "success": False,
                "authenticated": False,
                "message": "This SYNCO account is suspended.",
                "account_status": user.account_status,
                "reason": user.account_status_reason,
            }), 403

        return None
