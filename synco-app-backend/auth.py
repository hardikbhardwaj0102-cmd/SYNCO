import os

from flask import (
    Blueprint,
    redirect,
    session,
    jsonify,
    request,
)

from itsdangerous import (
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer,
)

from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv

from otp import (
    send_otp_email,
    send_password_reset_email,
    verify_otp,
)

from models import db, User


load_dotenv()


# =========================================================
# AUTH BLUEPRINT
# =========================================================

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth",
)

oauth = OAuth()


# =========================================================
# RESET TOKEN SERIALIZER
# =========================================================

def reset_token_serializer():
    return URLSafeTimedSerializer(
        os.getenv(
            "SECRET_KEY",
            "dev-secret-key",
        )
    )


# =========================================================
# DISCORD AVATAR
# =========================================================

def discord_avatar_url(user_info):
    user_id = user_info.get("id")
    avatar_hash = user_info.get("avatar")

    if not user_id:
        return None

    if avatar_hash:
        return (
            f"https://cdn.discordapp.com/avatars/"
            f"{user_id}/{avatar_hash}.png?size=256"
        )

    default_avatar_index = (
        (int(user_id) >> 22) % 6
    )

    return (
        "https://cdn.discordapp.com/embed/"
        f"avatars/{default_avatar_index}.png"
    )


# =========================================================
# FRONTEND URL HELPER
# =========================================================

def get_frontend_url():
    return os.getenv(
        "FRONTEND_URL",
        "http://127.0.0.1:5173",
    ).rstrip("/")


# =========================================================
# INITIALIZE OAUTH
# =========================================================

def init_oauth(app):

    oauth.init_app(app)

    # =====================================================
    # GOOGLE
    # =====================================================

    oauth.register(
        name="google",

        client_id=os.getenv(
            "GOOGLE_CLIENT_ID"
        ),

        client_secret=os.getenv(
            "GOOGLE_CLIENT_SECRET"
        ),

        server_metadata_url=(
            "https://accounts.google.com/"
            ".well-known/openid-configuration"
        ),

        client_kwargs={
            "scope": "openid email profile",
        },
    )

    # =====================================================
    # DISCORD
    # =====================================================

    oauth.register(
        name="discord",

        client_id=os.getenv(
            "DISCORD_CLIENT_ID"
        ),

        client_secret=os.getenv(
            "DISCORD_CLIENT_SECRET"
        ),

        access_token_url=(
            "https://discord.com/api/oauth2/token"
        ),

        authorize_url=(
            "https://discord.com/api/oauth2/authorize"
        ),

        api_base_url=(
            "https://discord.com/api/"
        ),

        client_kwargs={
            "scope": "identify email",
        },
    )


# =========================================================
# GOOGLE LOGIN
# =========================================================

@auth_bp.route("/google")
def google_login():

    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI"
    )

    if not redirect_uri:
        return jsonify({
            "success": False,
            "message": (
                "GOOGLE_REDIRECT_URI "
                "is not configured"
            ),
        }), 500

    print(
        "Google OAuth redirect URI:",
        redirect_uri,
    )

    return oauth.google.authorize_redirect(
        redirect_uri
    )


# =========================================================
# GOOGLE CALLBACK
# =========================================================

@auth_bp.route("/google/callback")
def google_callback():

    try:

        # -------------------------------------------------
        # Get Google token
        # -------------------------------------------------

        token = oauth.google.authorize_access_token()

        # -------------------------------------------------
        # Get user information
        # -------------------------------------------------

        user_info = token.get("userinfo")

        if not user_info:
            return jsonify({
                "success": False,
                "message": (
                    "Unable to retrieve "
                    "Google user information"
                ),
            }), 400

        email = user_info.get("email")

        if not email:
            return jsonify({
                "success": False,
                "message": (
                    "Google account does not "
                    "provide an email"
                ),
            }), 400

        email = email.strip().lower()

        # -------------------------------------------------
        # Find existing user
        # -------------------------------------------------

        user = User.query.filter_by(
            email=email
        ).first()

        # -------------------------------------------------
        # Create user
        # -------------------------------------------------

        if not user:

            user = User(
                name=(
                    user_info.get("name")
                    or "Google User"
                ),

                email=email,

                google_id=user_info.get(
                    "sub"
                ),

                avatar=user_info.get(
                    "picture"
                ),

                email_verified=True,
            )

            db.session.add(user)
            db.session.commit()

        # -------------------------------------------------
        # Existing user
        # -------------------------------------------------

        else:

            user.google_id = (
                user_info.get("sub")
            )

            if (
                not user.discord_id
                and user_info.get("picture")
            ):
                user.avatar = (
                    user_info.get("picture")
                )

            user.email_verified = True

            db.session.commit()

        # -------------------------------------------------
        # Refresh user from database
        # -------------------------------------------------

        user = db.session.get(
            User,
            user.id,
        )

        # -------------------------------------------------
        # CREATE SESSION
        # -------------------------------------------------

        session.clear()

        session["user_id"] = user.id
        session["user"] = user.to_dict()

        session.permanent = True

        print(
            "Google login successful:",
            user.email,
        )

        print(
            "Session user ID:",
            user.id,
        )

        # -------------------------------------------------
        # Redirect to frontend
        # -------------------------------------------------

        frontend_url = get_frontend_url()

        return redirect(
            f"{frontend_url}/home"
        )

    except Exception as e:

        db.session.rollback()

        print(
            "Google OAuth Error:",
            repr(e),
        )

        return jsonify({
            "success": False,
            "message": (
                "Google authentication failed"
            ),
            "error": str(e),
        }), 500


# =========================================================
# DISCORD LOGIN
# =========================================================

@auth_bp.route("/discord")
@auth_bp.route("/discord/login")
def discord_login():

    redirect_uri = os.getenv(
        "DISCORD_REDIRECT_URI"
    )

    if not redirect_uri:
        return jsonify({
            "success": False,
            "message": (
                "DISCORD_REDIRECT_URI "
                "is not configured"
            ),
        }), 500

    print(
        "Discord OAuth redirect URI:",
        redirect_uri,
    )

    return oauth.discord.authorize_redirect(
        redirect_uri
    )


# =========================================================
# DISCORD CALLBACK
# =========================================================

@auth_bp.route("/discord/callback")
def discord_callback():

    try:

        # -------------------------------------------------
        # Get Discord token
        # -------------------------------------------------

        token = (
            oauth.discord.authorize_access_token()
        )

        # -------------------------------------------------
        # Get Discord user
        # -------------------------------------------------

        response = oauth.discord.get(
            "users/@me"
        )

        user_info = response.json()

        if not user_info:
            return jsonify({
                "success": False,
                "message": (
                    "Unable to retrieve "
                    "Discord user information"
                ),
            }), 400

        email = user_info.get("email")

        if not email:
            return jsonify({
                "success": False,
                "message": (
                    "Discord account does not "
                    "provide an email"
                ),
            }), 400

        email = email.strip().lower()

        # -------------------------------------------------
        # Find existing user
        # -------------------------------------------------

        user = User.query.filter_by(
            email=email
        ).first()

        # -------------------------------------------------
        # Create user
        # -------------------------------------------------

        if not user:

            display_name = (
                user_info.get("global_name")
                or user_info.get("username")
                or "Discord User"
            )

            user = User(
                name=display_name,

                email=email,

                discord_id=user_info.get(
                    "id"
                ),

                username=user_info.get(
                    "username"
                ),

                avatar=discord_avatar_url(
                    user_info
                ),

                email_verified=True,

                discord_verified=True,
            )

            db.session.add(user)
            db.session.commit()

        # -------------------------------------------------
        # Existing user
        # -------------------------------------------------

        else:

            user.discord_id = (
                user_info.get("id")
            )

            if not user.username:
                user.username = (
                    user_info.get(
                        "username"
                    )
                )

            user.avatar = (
                discord_avatar_url(
                    user_info
                )
            )

            user.discord_verified = True
            user.email_verified = True

            db.session.commit()

        # -------------------------------------------------
        # Refresh user
        # -------------------------------------------------

        user = db.session.get(
            User,
            user.id,
        )

        # -------------------------------------------------
        # CREATE SESSION
        # -------------------------------------------------

        session.clear()

        session["user_id"] = user.id
        session["user"] = user.to_dict()

        session.permanent = True

        print(
            "Discord login successful:",
            user.email,
        )

        print(
            "Session user ID:",
            user.id,
        )

        # -------------------------------------------------
        # Redirect to frontend
        # -------------------------------------------------

        frontend_url = get_frontend_url()

        return redirect(
            f"{frontend_url}/home"
        )

    except Exception as e:

        db.session.rollback()

        print(
            "Discord OAuth Error:",
            repr(e),
        )

        return jsonify({
            "success": False,
            "message": (
                "Discord authentication failed"
            ),
            "error": str(e),
        }), 500


# =========================================================
# SEND REGISTRATION OTP
# =========================================================

@auth_bp.route(
    "/send-otp",
    methods=["POST"],
)
def send_registration_otp():

    data = request.get_json(
        silent=True
    )

    if not data:
        return jsonify({
            "success": False,
            "message": "Invalid request",
        }), 400

    email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    if not email:
        return jsonify({
            "success": False,
            "message": "Email is required",
        }), 400

    # -----------------------------------------------------
    # Existing account
    # -----------------------------------------------------

    existing_user = User.query.filter_by(
        email=email
    ).first()

    if existing_user:
        return jsonify({
            "success": False,
            "message": (
                "An account with this "
                "email already exists"
            ),
        }), 409

    # -----------------------------------------------------
    # Send OTP
    # -----------------------------------------------------

    success = send_otp_email(email)

    if not success:
        return jsonify({
            "success": False,
            "message": "Failed to send OTP",
        }), 500

    return jsonify({
        "success": True,
        "message": "OTP sent successfully",
    })


# =========================================================
# VERIFY REGISTRATION OTP
# =========================================================

@auth_bp.route(
    "/verify-otp",
    methods=["POST"],
)
def verify_registration_otp():

    data = request.get_json(
        silent=True
    )

    if not data:
        return jsonify({
            "success": False,
            "message": "Invalid request",
        }), 400

    email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    otp = (
        data.get("otp", "")
        .strip()
    )

    if not email or not otp:
        return jsonify({
            "success": False,
            "message": (
                "Email and OTP are required"
            ),
        }), 400

    if len(otp) != 6 or not otp.isdigit():
        return jsonify({
            "success": False,
            "message": (
                "OTP must be 6 digits"
            ),
        }), 400

    # -----------------------------------------------------
    # Verify OTP
    # -----------------------------------------------------

    success, message = verify_otp(
        email,
        otp,
    )

    if not success:
        return jsonify({
            "success": False,
            "message": message,
        }), 400

    # -----------------------------------------------------
    # Store verified email
    # -----------------------------------------------------

    session["verified_email"] = email

    return jsonify({
        "success": True,
        "message": (
            "OTP verified successfully"
        ),
    })


# =========================================================
# REGISTER
# =========================================================

@auth_bp.route(
    "/register",
    methods=["POST"],
)
def register():

    data = request.get_json(
        silent=True
    )

    if not data:
        return jsonify({
            "success": False,
            "message": "Invalid request",
        }), 400

    name = (
        data.get("name", "")
        .strip()
    )

    email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    password = data.get(
        "password",
        "",
    )

    # -----------------------------------------------------
    # Validation
    # -----------------------------------------------------

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": (
                "Name, email and password "
                "are required"
            ),
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": (
                "Password must be at least "
                "8 characters"
            ),
        }), 400

    # -----------------------------------------------------
    # OTP verification
    # -----------------------------------------------------

    verified_email = session.get(
        "verified_email"
    )

    if verified_email != email:
        return jsonify({
            "success": False,
            "message": (
                "Please verify your "
                "email first"
            ),
        }), 400

    # -----------------------------------------------------
    # Duplicate account
    # -----------------------------------------------------

    existing_user = User.query.filter_by(
        email=email
    ).first()

    if existing_user:
        return jsonify({
            "success": False,
            "message": (
                "An account with this "
                "email already exists"
            ),
        }), 409

    # -----------------------------------------------------
    # Create account
    # -----------------------------------------------------

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(
            password
        ),
        email_verified=True,
    )

    db.session.add(user)
    db.session.commit()

    # -----------------------------------------------------
    # Remove temporary verification
    # -----------------------------------------------------

    session.pop(
        "verified_email",
        None,
    )

    return jsonify({
        "success": True,
        "message": (
            "Account created successfully"
        ),
        "user": user.to_dict(),
    }), 201


# =========================================================
# CURRENT USER
# =========================================================

@auth_bp.route("/me")
def get_current_user():

    session_user = session.get(
        "user"
    )

    session_user_id = session.get(
        "user_id"
    )

    # -----------------------------------------------------
    # No session
    # -----------------------------------------------------

    if not session_user and not session_user_id:

        return jsonify({
            "authenticated": False,
        }), 401

    # -----------------------------------------------------
    # Get actual database user
    # -----------------------------------------------------

    user_id = session_user_id

    if not user_id and session_user:
        user_id = session_user.get(
            "id"
        )

    if not user_id:

        session.clear()

        return jsonify({
            "authenticated": False,
        }), 401

    user_record = db.session.get(
        User,
        user_id,
    )

    if user_record is None:

        session.clear()

        return jsonify({
            "authenticated": False,
        }), 401

    # -----------------------------------------------------
    # Refresh session user
    # -----------------------------------------------------

    user = user_record.to_dict()

    session["user_id"] = user_record.id
    session["user"] = user
    session.permanent = True

    return jsonify({
        "authenticated": True,
        "user": user,
    }), 200


# =========================================================
# FORGOT PASSWORD
# =========================================================

@auth_bp.route(
    "/forgot-password",
    methods=["POST"],
)
def forgot_password():

    data = request.get_json(
        silent=True
    ) or {}

    email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    if not email:
        return jsonify({
            "success": False,
            "message": "Email is required",
        }), 400

    user = User.query.filter_by(
        email=email
    ).first()

    if not user:
        return jsonify({
            "success": False,
            "message": (
                "No account found with "
                "this email address."
            ),
        }), 404

    token = reset_token_serializer().dumps({
        "user_id": user.id,
        "email": user.email,
    })

    frontend_url = get_frontend_url()

    reset_link = (
        f"{frontend_url}/resetpass/{token}"
    )

    if not send_password_reset_email(
        user.email,
        reset_link,
    ):
        return jsonify({
            "success": False,
            "message": (
                "Unable to send the reset email. "
                "Check the email service configuration."
            ),
        }), 500

    return jsonify({
        "success": True,
        "message": (
            "If an account exists, "
            "a reset link has been sent."
        ),
    })


# =========================================================
# RESET PASSWORD
# =========================================================

@auth_bp.route(
    "/reset-password",
    methods=["POST"],
)
def reset_password():

    data = request.get_json(
        silent=True
    ) or {}

    token = data.get(
        "token",
        ""
    )

    password = data.get(
        "password",
        ""
    )

    if not token or len(password) < 8:
        return jsonify({
            "success": False,
            "message": (
                "A valid token and a password "
                "of at least 8 characters "
                "are required."
            ),
        }), 400

    # -----------------------------------------------------
    # Validate token
    # -----------------------------------------------------

    try:

        token_data = (
            reset_token_serializer()
            .loads(
                token,
                max_age=15 * 60,
            )
        )

    except SignatureExpired:

        return jsonify({
            "success": False,
            "message": (
                "This reset link has expired."
            ),
        }), 400

    except BadSignature:

        return jsonify({
            "success": False,
            "message": (
                "This reset link is invalid."
            ),
        }), 400

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = db.session.get(
        User,
        token_data.get("user_id"),
    )

    if (
        not user
        or user.email != token_data.get("email")
    ):
        return jsonify({
            "success": False,
            "message": (
                "This reset link is invalid."
            ),
        }), 400

    # -----------------------------------------------------
    # Update password
    # -----------------------------------------------------

    user.password_hash = (
        generate_password_hash(password)
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": (
            "Password reset successfully."
        ),
    })


# =========================================================
# EMAIL / PASSWORD LOGIN
# =========================================================

@auth_bp.route(
    "/login",
    methods=["POST"],
)
def login():

    data = request.get_json(
        silent=True
    )

    if not data:
        return jsonify({
            "success": False,
            "message": "Invalid request",
        }), 400

    email = (
        data.get("email", "")
        .strip()
        .lower()
    )

    password = data.get(
        "password",
        "",
    )

    if not email or not password:
        return jsonify({
            "success": False,
            "message": (
                "Email and password "
                "are required"
            ),
        }), 400

    # -----------------------------------------------------
    # Find user
    # -----------------------------------------------------

    user = User.query.filter_by(
        email=email
    ).first()

    if not user:
        return jsonify({
            "success": False,
            "message": (
                "Invalid email or password"
            ),
        }), 401

    # -----------------------------------------------------
    # Social-only account
    # -----------------------------------------------------

    if not user.password_hash:

        return jsonify({
            "success": False,
            "message": (
                "This account uses social login. "
                "Please continue with Google "
                "or Discord."
            ),
        }), 401

    # -----------------------------------------------------
    # Password
    # -----------------------------------------------------

    if not check_password_hash(
        user.password_hash,
        password,
    ):

        return jsonify({
            "success": False,
            "message": (
                "Invalid email or password"
            ),
        }), 401

    # -----------------------------------------------------
    # Create session
    # -----------------------------------------------------

    session.clear()

    session["user_id"] = user.id
    session["user"] = user.to_dict()

    session.permanent = True

    print(
        "Email login successful:",
        user.email,
    )

    # -----------------------------------------------------
    # Response
    # -----------------------------------------------------

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": user.to_dict(),
    }), 200


# =========================================================
# LOGOUT
# =========================================================

@auth_bp.route("/logout")
def logout():

    session.clear()

    return jsonify({
        "success": True,
        "message": (
            "Logged out successfully"
        ),
    })