from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, session

from models import (
    db,
    ProfileClip,
    ProfileGame,
    User,
    UserProfile,
    discord_avatar_url
)


profile_bp = Blueprint(
    "profile",
    __name__,
    url_prefix="/api/profile"
)


# =========================================================
# CURRENT USER
# =========================================================

def _current_user():
    session_user = session.get("user")

    if not session_user or not session_user.get("id"):
        return None

    return db.session.get(
        User,
        session_user["id"]
    )


# =========================================================
# REQUIRE AUTHENTICATION
# =========================================================

def _require_user():

    user = _current_user()

    if user is None:
        return None, (
            jsonify({
                "success": False,
                "message": "Authentication required"
            }),
            401
        )

    return user, None


# =========================================================
# GET / CREATE USER PROFILE
# =========================================================

def _profile_for(user):

    profile = UserProfile.query.filter_by(
        user_id=user.id
    ).first()

    if profile is None:

        profile = UserProfile(
            user_id=user.id,
            basic_data={
                "name": user.name or "",
                "username": user.username or "",
                "email": user.email or "",
                "gender": "",
                "dob": "",
                "region": "",
                "bio": "",
                "avatarUrl": user.avatar or "",
            },
            socials={},
        )

        db.session.add(profile)
        db.session.commit()

    return profile


# =========================================================
# AVATAR URL
# =========================================================

def _avatar_url(user):

    if user.discord_id:
        return discord_avatar_url(
            user.discord_id,
            user.avatar
        )

    return user.avatar or ""


# =========================================================
# PUBLIC PROFILE SERIALIZER
# =========================================================

def _public_profile(user):

    profile = _profile_for(user)

    basic_data = profile.basic_data or {}

    return {

        # -------------------------------------------------
        # BASIC IDENTITY
        # -------------------------------------------------

        "id": user.id,

        "uid": user.uid,

        "username": user.username or "",

        "name": user.name or "",


        # -------------------------------------------------
        # PROFILE
        # -------------------------------------------------

        "avatarUrl": (
            _avatar_url(user)
            or basic_data.get("avatarUrl", "")
        ),

        "bio": basic_data.get(
            "bio",
            ""
        ),

        "region": basic_data.get(
            "region",
            ""
        ),


        # -------------------------------------------------
        # SOCIALS
        # -------------------------------------------------

        "socials": profile.socials or {},


        # -------------------------------------------------
        # GAMES
        # -------------------------------------------------

        "games": [
            game.to_dict()
            for game in ProfileGame.query.filter_by(
                user_id=user.id
            ).all()
        ],


        # -------------------------------------------------
        # CLIPS
        # -------------------------------------------------

        "clips": [
            clip.to_dict(
                f"/api/profile/clips/media/{clip.filename}"
            )
            for clip in ProfileClip.query.filter_by(
                user_id=user.id
            )
            .order_by(
                ProfileClip.created_at.desc()
            )
            .all()
        ],


        # -------------------------------------------------
        # LINKED ACCOUNTS
        # -------------------------------------------------

        "linkedStatus": {

            "discord": bool(
                user.discord_verified
            ),

            "discordTag": (
                user.username or ""
            ),

            "google": bool(
                user.google_id
            ),

        },


        # -------------------------------------------------
        # STATS
        # -------------------------------------------------

        "stats": {

            "matches": 0,

            "winRate": 0,

            "trophies": 0,

        },

    }


# =========================================================
# GET CURRENT USER PROFILE
# =========================================================

@profile_bp.route(
    "",
    methods=["GET"]
)
def get_profile():

    user, error = _require_user()

    if error:
        return error

    profile = _profile_for(user)

    avatar_url = _avatar_url(user)


    basic_data = {
        **(profile.basic_data or {}),

        "name": user.name or "",

        "username": user.username or "",

        "email": user.email or "",

        "avatarUrl": (
            avatar_url
            or (profile.basic_data or {}).get(
                "avatarUrl",
                ""
            )
        ),
    }


    linked_status = {

        "discord": bool(
            user.discord_verified
        ),

        "discordTag": (
            user.username or ""
        ),

        "google": bool(
            user.google_id
        ),

        "email": bool(
            user.email_verified
        ),

    }


    return jsonify({

        "basicData": basic_data,

        # Permanent SYNCO UID
        "uid": user.uid,

        "games": [
            game.to_dict()
            for game in ProfileGame.query.filter_by(
                user_id=user.id
            ).all()
        ],

        "clips": [
            clip.to_dict(
                f"/api/profile/clips/media/{clip.filename}"
            )
            for clip in ProfileClip.query.filter_by(
                user_id=user.id
            )
            .order_by(
                ProfileClip.created_at.desc()
            )
            .all()
        ],

        "socials": profile.socials or {},

        "linkedStatus": linked_status,

    })


# =========================================================
# GET PUBLIC PROFILE
# =========================================================

@profile_bp.route(
    "/<username>",
    methods=["GET"]
)
def get_public_profile(username):

    user = User.query.filter_by(
        username=username
    ).first()


    if user is None:

        return jsonify({
            "success": False,
            "message": "Profile not found"
        }), 404


    response = _public_profile(user)


    session_user = session.get("user")


    response["isOwner"] = bool(
        session_user
        and session_user.get("id") == user.id
    )


    return jsonify(response)


# =========================================================
# UPDATE PROFILE
# =========================================================

@profile_bp.route(
    "/update",
    methods=["PUT"]
)
def update_profile():

    user, error = _require_user()

    if error:
        return error


    data = request.get_json(
        silent=True
    ) or {}


    profile = _profile_for(user)


    basic_data = (
        data.get("basicData")
        or {}
    )


    socials = (
        data.get("socials")
        or {}
    )


    allowed_basic_fields = {
        "name",
        "username",
        "email",
        "gender",
        "dob",
        "region",
        "bio",
        "avatarUrl"
    }


    stored_basic = {
        **(profile.basic_data or {}),

        **{
            key: value
            for key, value in basic_data.items()
            if key in allowed_basic_fields
        },
    }


    profile.basic_data = stored_basic

    profile.socials = dict(
        socials
    )


    # -----------------------------------------------------
    # NAME
    # -----------------------------------------------------

    if (
        "name" in basic_data
        and basic_data["name"]
    ):
        user.name = basic_data["name"]


    # -----------------------------------------------------
    # USERNAME
    # -----------------------------------------------------

    if (
        "username" in basic_data
        and not user.discord_verified
    ):
        user.username = (
            basic_data["username"]
            or None
        )


    # -----------------------------------------------------
    # EMAIL
    # -----------------------------------------------------

    if (
        "email" in basic_data
        and basic_data["email"]
    ):
        user.email = (
            basic_data["email"]
            .lower()
        )


    # -----------------------------------------------------
    # AVATAR
    # -----------------------------------------------------

    if "avatarUrl" in basic_data:

        user.avatar = (
            basic_data["avatarUrl"]
            or None
        )


    db.session.commit()


    return jsonify({
        "success": True,
        "message": "Profile updated successfully"
    })


# =========================================================
# DELETE ACCOUNT
# =========================================================

@profile_bp.route(
    "/account",
    methods=["DELETE"]
)
def delete_account():

    user, error = _require_user()

    if error:
        return error


    clips = ProfileClip.query.filter_by(
        user_id=user.id
    ).all()


    media_dir = (
        Path(current_app.root_path)
        / "media"
        / "clips"
    )


    for clip in clips:

        clip_path = (
            media_dir
            / clip.filename
        )

        if clip_path.exists():
            clip_path.unlink()


    ProfileClip.query.filter_by(
        user_id=user.id
    ).delete()


    ProfileGame.query.filter_by(
        user_id=user.id
    ).delete()


    UserProfile.query.filter_by(
        user_id=user.id
    ).delete()


    db.session.delete(user)

    db.session.commit()

    session.clear()


    return jsonify({
        "success": True,
        "message": "Account deleted successfully"
    })


# =========================================================
# ADD GAME
# =========================================================

@profile_bp.route(
    "/games",
    methods=["POST"]
)
def add_game():

    user, error = _require_user()

    if error:
        return error


    data = request.get_json(
        silent=True
    ) or {}


    game_data = (
        data.get("newGame")
        if isinstance(
            data.get("newGame"),
            dict
        )
        else data
    )


    required_fields = (
        "gameName",
        "ign",
        "uid"
    )


    if any(
        not str(
            game_data.get(
                field,
                ""
            )
        ).strip()

        for field in required_fields
    ):

        return jsonify({
            "success": False,
            "message": (
                "gameName, ign, and uid "
                "are required"
            )
        }), 400


    game = ProfileGame(

        user_id=user.id,

        game_name=str(
            game_data["gameName"]
        ).strip(),

        ign=str(
            game_data["ign"]
        ).strip(),

        uid=str(
            game_data["uid"]
        ).strip(),

        role=str(
            game_data.get(
                "role",
                ""
            )
        ).strip(),

        tier=str(
            game_data.get(
                "tier",
                "Semi-Pro"
            )
        ).strip(),

        experience=str(
            game_data.get(
                "experience",
                ""
            )
        ).strip(),

    )


    db.session.add(game)

    db.session.commit()


    return jsonify(
        game.to_dict()
    ), 201


# =========================================================
# DELETE GAME
# =========================================================

@profile_bp.route(
    "/games/<int:game_id>",
    methods=["DELETE"]
)
def delete_game(game_id):

    user, error = _require_user()

    if error:
        return error


    game = ProfileGame.query.filter_by(
        id=game_id,
        user_id=user.id
    ).first()


    if game is None:

        return jsonify({
            "success": False,
            "message": "Game not found"
        }), 404


    db.session.delete(game)

    db.session.commit()


    return jsonify({
        "success": True,
        "message": "Game removed"
    })