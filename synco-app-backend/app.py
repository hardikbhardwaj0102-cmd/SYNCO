import os

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from models import db
from seed_games import seed_initial_games

from search import search_bp
from auth import auth_bp, init_oauth
from profile import profile_bp
from games import games_bp
from clips import clips_bp
from rewards import rewards_bp
from clubs import clubs_bp
from friends import friends_bp
from notifications import notifications_bp
from leaderboards import leaderboards_bp


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# CREATE FLASK APP
# =========================================================

app = Flask(__name__)


# =========================================================
# SECRET KEY
# =========================================================

app.secret_key = os.getenv(
    "SECRET_KEY",
    "dev-secret-key"
)


# =========================================================
# SESSION CONFIGURATION
# =========================================================

app.config["SESSION_COOKIE_HTTPONLY"] = True

app.config["SESSION_COOKIE_SECURE"] = (
    os.getenv("FLASK_ENV") == "production"
)

app.config["SESSION_COOKIE_SAMESITE"] = "None"

app.config["PERMANENT_SESSION_LIFETIME"] = (
    86400 * 30
)


# =========================================================
# DATABASE CONFIGURATION
# =========================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set."
    )


# Render/PostgreSQL compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1
    )


app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# =========================================================
# UPLOAD LIMIT
# =========================================================

app.config["MAX_CONTENT_LENGTH"] = (
    250 * 1024 * 1024
)


# =========================================================
# INITIALIZE DATABASE
# =========================================================

db.init_app(app)


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

with app.app_context():

    print("\n===== DATABASE =====")

    print(
        "Database configured:",
        "PostgreSQL"
    )

    print("====================\n")

    db.create_all()

    seed_initial_games()


# =========================================================
# FRONTEND URL
# =========================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://127.0.0.1:5173"
)


# =========================================================
# CORS
# =========================================================

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        FRONTEND_URL
    ]
)


# =========================================================
# OAUTH
# =========================================================

init_oauth(app)


# =========================================================
# REGISTER BLUEPRINTS
# =========================================================

app.register_blueprint(auth_bp)

app.register_blueprint(profile_bp)

app.register_blueprint(games_bp)

app.register_blueprint(clips_bp)

app.register_blueprint(rewards_bp)

app.register_blueprint(clubs_bp)

app.register_blueprint(friends_bp)

app.register_blueprint(notifications_bp)

app.register_blueprint(search_bp)

app.register_blueprint(leaderboards_bp)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/")
def home():

    return {
        "message": "SYNCO backend running",
        "status": "ok"
    }


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":

    print("\n===== SYNCO ROUTES =====")

    print(app.url_map)

    print("========================\n")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )