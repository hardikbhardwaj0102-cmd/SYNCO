import os

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from models import db
from seed_games import seed_initial_games

from auth import auth_bp, init_oauth
from profile import profile_bp
from games import games_bp
from clips import clips_bp
from rewards import rewards_bp
from clubs import clubs_bp
from friends import friends_bp
from notifications import notifications_bp


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
# DATABASE CONFIGURATION
# =========================================================

BASE_DIR = os.path.abspath(
    os.path.dirname(__file__)
)

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "synco.db"
)

app.config["SQLALCHEMY_DATABASE_URI"] = (
    "sqlite:///" + DATABASE_PATH
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# =========================================================
# FILE UPLOAD LIMIT
# =========================================================

app.config["MAX_CONTENT_LENGTH"] = (
    250 * 1024 * 1024
)


# =========================================================
# SESSION / COOKIE CONFIGURATION
# =========================================================

app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False


# =========================================================
# INITIALIZE DATABASE
# =========================================================

db.init_app(app)


# =========================================================
# CREATE DATABASE TABLES
# =========================================================

with app.app_context():

    print("\n===== DATABASE =====")
    print(
        f"Database path: {DATABASE_PATH}"
    )
    print("====================\n")

    db.create_all()

    # -----------------------------------------------------
    # Seed default games
    # -----------------------------------------------------

    seed_initial_games()


# =========================================================
# CORS
# =========================================================

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]
)


# =========================================================
# INITIALIZE OAUTH
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


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/")
def home():

    return {
        "message": "SYNCO backend running"
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