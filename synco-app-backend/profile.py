import os
import uuid
from pathlib import Path

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
    session,
)

from sqlalchemy import or_, text
from supabase import create_client

from rewards import process_synco_event

from models import (
    db,
    ProfileClip,
    ProfileClipLike,
    ProfileClipComment,
    ProfileGame,
    Game,
    User,
    UserProfile,
    discord_avatar_url,
)


# =========================================================
# BLUEPRINT
# =========================================================

profile_bp = Blueprint(
    "profile",
    __name__,
    url_prefix="/api/profile",
)


# =========================================================
# SUPABASE CONFIG
# =========================================================

SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "",
).strip()

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
).strip()

SUPABASE_CLIP_BUCKET = os.getenv(
    "SUPABASE_CLIP_BUCKET",
    "profile-clips",
).strip()


_supabase = None


def _get_supabase():
    global _supabase

    if _supabase is not None:
        return _supabase

    if not SUPABASE_URL:
        raise RuntimeError(
            "SUPABASE_URL is not configured."
        )

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured."
        )

    _supabase = create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    )

    return _supabase


# =========================================================
# CURRENT USER
# =========================================================

def _current_user():

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
# REQUIRE AUTHENTICATION
# =========================================================

def _require_user():

    user = _current_user()

    if user is None:

        return None, (
            jsonify({
                "success": False,
                "message": "Authentication required",
            }),
            401,
        )

    return user, None


# =========================================================
# REWARD EVENT HELPER
# =========================================================

def _process_reward_event(
    user,
    event_type,
    reference_id=None,
    metadata=None,
):

    try:

        process_synco_event(
            user=user,
            event_type=event_type,
            reference_id=reference_id,
            metadata=metadata or {},
        )

    except Exception:

        current_app.logger.exception(
            "SYNCO reward event failed: %s user_id=%s reference_id=%s",
            event_type,
            user.id if user else None,
            reference_id,
        )


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
# PROFILE COMPLETION CHECK
# =========================================================

def _is_profile_complete(user, profile=None):

    if profile is None:

        profile = UserProfile.query.filter_by(
            user_id=user.id
        ).first()

    if profile is None:
        return False

    basic_data = profile.basic_data or {}

    name = str(
        user.name
        or basic_data.get("name", "")
    ).strip()

    username = str(
        user.username
        or basic_data.get("username", "")
    ).strip()

    region = str(
        basic_data.get("region", "")
    ).strip()

    bio = str(
        basic_data.get("bio", "")
    ).strip()

    avatar = str(
        user.avatar
        or basic_data.get("avatarUrl", "")
    ).strip()

    return bool(
        name
        and username
        and region
        and bio
        and avatar
    )


# =========================================================
# AVATAR URL
# =========================================================

def _avatar_url(user):

    if user.discord_id:

        return discord_avatar_url(
            user.discord_id,
            user.avatar,
        )

    return user.avatar or ""


# =========================================================
# CREATE SIGNED SUPABASE CLIP URL
# =========================================================

def _clip_media_url(filename):

    if not filename:
        return ""

    try:

        supabase = _get_supabase()

        result = (
            supabase
            .storage
            .from_(SUPABASE_CLIP_BUCKET)
            .create_signed_url(
                filename,
                60 * 60 * 24 * 7,
            )
        )

        if isinstance(result, dict):

            return (
                result.get("signedURL")
                or result.get("signedUrl")
                or result.get("signed_url")
                or ""
            )

        return ""

    except Exception:

        current_app.logger.exception(
            "Failed to create Supabase signed URL"
        )

        return ""


# =========================================================
# GET CLIP IDS LIKED BY CURRENT VIEWER
# =========================================================

def _liked_clip_ids_for_viewer(
    clip_ids,
    viewer_user_id,
):

    if not viewer_user_id or not clip_ids:
        return set()

    liked_rows = (
        ProfileClipLike.query
        .filter(
            ProfileClipLike.user_id == viewer_user_id,
            ProfileClipLike.clip_id.in_(clip_ids),
        )
        .all()
    )

    return {
        like.clip_id
        for like in liked_rows
    }


# =========================================================
# CLIP METADATA
# =========================================================
#
# The existing ProfileClip ORM model predates game/description
# fields. The database migration adds those two columns, while
# this module reads/writes them using SQL directly. This keeps
# the rest of the large models.py file untouched and avoids
# breaking the competition/club models.
#
# Returned shape:
# {
#     clip_id: {
#         "description": ...,
#         "gameId": ...,
#         "gameName": ...,
#         "game": {...} | None,
#     }
# }
# =========================================================

def _clip_metadata_by_user(user_id):

    rows = db.session.execute(
        text(
            """
            SELECT
                pc.id AS clip_id,
                pc.description AS clip_description,
                pc.game_id AS clip_game_id,
                g.id AS game_id,
                g.name AS game_name,
                g.short_name AS game_short_name,
                g.slug AS game_slug,
                g.description AS game_description,
                g.logo_url AS game_logo_url,
                g.is_active AS game_is_active
            FROM profile_clips pc
            LEFT JOIN games g
                ON g.id = pc.game_id
            WHERE pc.user_id = :user_id
            """
        ),
        {
            "user_id": user_id,
        },
    ).mappings().all()

    metadata = {}

    for row in rows:

        game = None

        if row["game_id"] is not None:

            game = {
                "id": row["game_id"],
                "name": row["game_name"],
                "shortName": row["game_short_name"],
                "slug": row["game_slug"],
                "description": row["game_description"],
                "logoUrl": row["game_logo_url"],
                "isActive": row["game_is_active"],
            }

        metadata[row["clip_id"]] = {
            "description": row["clip_description"] or "",
            "gameId": row["clip_game_id"],
            "gameName": row["game_name"] or "",
            "game": game,
        }

    # -----------------------------------------------------
    # BACKWARD-COMPATIBILITY FOR OLD CLIPS
    # -----------------------------------------------------
    #
    # Clips created before game_id was introduced have no
    # persisted game. When the owner has exactly one profile
    # game, we can safely infer that game for display.
    #
    # This does not invent a game when the player has multiple
    # games, because there would be no reliable way to know
    # which game the old clip belongs to.
    # -----------------------------------------------------

    missing_game_clip_ids = [
        clip_id
        for clip_id, item in metadata.items()
        if not item.get("gameId")
    ]

    if missing_game_clip_ids:

        profile_games = (
            ProfileGame.query
            .filter_by(user_id=user_id)
            .all()
        )

        if len(profile_games) == 1:

            inferred_name = (
                profile_games[0].game_name or ""
            ).strip()

            if inferred_name:

                inferred_game = (
                    Game.query
                    .filter(
                        or_(
                            Game.id == inferred_name,
                            Game.slug.ilike(inferred_name),
                            Game.name.ilike(inferred_name),
                            Game.short_name.ilike(inferred_name),
                        )
                    )
                    .first()
                )

                if inferred_game:

                    inferred_data = {
                        "id": inferred_game.id,
                        "name": inferred_game.name,
                        "shortName": inferred_game.short_name,
                        "slug": inferred_game.slug,
                        "description": inferred_game.description,
                        "logoUrl": inferred_game.logo_url,
                        "isActive": inferred_game.is_active,
                    }

                    for clip_id in missing_game_clip_ids:
                        metadata[clip_id]["gameId"] = inferred_game.id
                        metadata[clip_id]["gameName"] = inferred_game.name
                        metadata[clip_id]["game"] = inferred_data

    return metadata


# =========================================================
# RESOLVE CLIP GAME
# =========================================================

def _resolve_clip_game_id(
    user,
    raw_game_value=None,
):
    """
    Resolve an uploaded clip's game to the canonical games.id.

    Accepted input can be:
        - games.id
        - games.slug
        - games.name
        - games.short_name

    When the uploader does not provide a game and has exactly one
    ProfileGame entry, that game's name is used as a best-effort
    fallback.
    """

    explicit = (
        str(raw_game_value).strip()
        if raw_game_value is not None
        else ""
    )

    if not explicit:

        profile_games = (
            ProfileGame.query
            .filter_by(user_id=user.id)
            .all()
        )

        if len(profile_games) == 1:
            explicit = (
                profile_games[0].game_name or ""
            ).strip()

    if not explicit:
        return None

    game = (
        Game.query
        .filter(
            or_(
                Game.id == explicit,
                Game.slug.ilike(explicit),
                Game.name.ilike(explicit),
                Game.short_name.ilike(explicit),
            )
        )
        .first()
    )

    return game.id if game else None


# =========================================================
# CLIP SERIALIZER
# =========================================================

def _serialize_clip(
    clip,
    liked_clip_ids=None,
    metadata_by_clip_id=None,
):

    liked_clip_ids = liked_clip_ids or set()
    metadata_by_clip_id = metadata_by_clip_id or {}

    clip_data = clip.to_dict(
        _clip_media_url(
            clip.filename
        )
    )

    metadata = metadata_by_clip_id.get(
        clip.id,
        {},
    )

    clip_data["description"] = (
        metadata.get("description") or ""
    )

    clip_data["gameId"] = metadata.get(
        "gameId"
    )

    clip_data["gameName"] = (
        metadata.get("gameName") or ""
    )

    clip_data["game"] = metadata.get(
        "game"
    )

    # Frontend compatibility.
    clip_data["isLiked"] = (
        clip.id in liked_clip_ids
    )

    return clip_data


# =========================================================
# PUBLIC PROFILE SERIALIZER
# =========================================================

def _public_profile(user):

    profile = _profile_for(user)

    basic_data = profile.basic_data or {}

    clips = (
        ProfileClip.query
        .filter_by(
            user_id=user.id
        )
        .order_by(
            ProfileClip.created_at.desc()
        )
        .all()
    )

    session_user = session.get("user")

    viewer_user_id = (
        session_user.get("id")
        if session_user
        else None
    )

    clip_ids = [
        clip.id
        for clip in clips
    ]

    liked_clip_ids = _liked_clip_ids_for_viewer(
        clip_ids,
        viewer_user_id,
    )

    metadata_by_clip_id = _clip_metadata_by_user(
        user.id
    )

    return {

        "id": user.id,

        "uid": user.uid,

        "username": user.username or "",

        "name": user.name or "",

        "avatarUrl": (
            _avatar_url(user)
            or basic_data.get(
                "avatarUrl",
                "",
            )
        ),

        "bio": basic_data.get(
            "bio",
            "",
        ),

        "region": basic_data.get(
            "region",
            "",
        ),

        "socials": profile.socials or {},

        "games": [
            game.to_dict()
            for game in ProfileGame.query.filter_by(
                user_id=user.id
            ).all()
        ],

        "clips": [
            _serialize_clip(
                clip,
                liked_clip_ids,
                metadata_by_clip_id,
            )
            for clip in clips
        ],

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
    methods=["GET"],
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
                "",
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

    clips = (
        ProfileClip.query
        .filter_by(
            user_id=user.id
        )
        .order_by(
            ProfileClip.created_at.desc()
        )
        .all()
    )

    clip_ids = [
        clip.id
        for clip in clips
    ]

    liked_clip_ids = _liked_clip_ids_for_viewer(
        clip_ids,
        user.id,
    )

    metadata_by_clip_id = _clip_metadata_by_user(
        user.id
    )

    return jsonify({

        "basicData": basic_data,

        "uid": user.uid,

        "games": [
            game.to_dict()
            for game in ProfileGame.query.filter_by(
                user_id=user.id
            ).all()
        ],

        "clips": [
            _serialize_clip(
                clip,
                liked_clip_ids,
                metadata_by_clip_id,
            )
            for clip in clips
        ],

        "socials": profile.socials or {},

        "linkedStatus": linked_status,

    })


# =========================================================
# GET PUBLIC PROFILE
# =========================================================

@profile_bp.route(
    "/<username>",
    methods=["GET"],
)
def get_public_profile(username):

    user = User.query.filter_by(
        username=username
    ).first()

    if user is None:

        return jsonify({
            "success": False,
            "message": "Profile not found",
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
    methods=["PUT"],
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
        "avatarUrl",
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
    profile.socials = dict(socials)

    if (
        "name" in basic_data
        and basic_data["name"]
    ):
        user.name = basic_data["name"]

    if (
        "username" in basic_data
        and not user.discord_verified
    ):
        user.username = (
            basic_data["username"]
            or None
        )

    if (
        "email" in basic_data
        and basic_data["email"]
    ):
        user.email = (
            basic_data["email"].lower()
        )

    if "avatarUrl" in basic_data:
        user.avatar = (
            basic_data["avatarUrl"]
            or None
        )

    db.session.commit()

    if _is_profile_complete(
        user,
        profile,
    ):

        _process_reward_event(
            user=user,
            event_type="PROFILE_COMPLETED",
            reference_id=user.id,
            metadata={
                "source": "profile_update",
            },
        )

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
    })


# =========================================================
# DELETE ACCOUNT
# =========================================================

@profile_bp.route(
    "/account",
    methods=["DELETE"],
)
def delete_account():

    user, error = _require_user()

    if error:
        return error

    clips = ProfileClip.query.filter_by(
        user_id=user.id
    ).all()

    if clips:

        try:

            supabase = _get_supabase()

            storage_paths = [
                clip.filename
                for clip in clips
                if clip.filename
            ]

            if storage_paths:

                supabase.storage.from_(
                    SUPABASE_CLIP_BUCKET
                ).remove(
                    storage_paths
                )

        except Exception:

            current_app.logger.exception(
                "Failed to delete Supabase clips"
            )

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
        "message": "Account deleted successfully",
    })


# =========================================================
# ADD GAME
# =========================================================

@profile_bp.route(
    "/games",
    methods=["POST"],
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
            dict,
        )
        else data
    )

    required_fields = (
        "gameName",
        "ign",
        "uid",
    )

    if any(
        not str(
            game_data.get(
                field,
                "",
            )
        ).strip()
        for field in required_fields
    ):

        return jsonify({
            "success": False,
            "message": (
                "gameName, ign, and uid "
                "are required"
            ),
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
                "",
            )
        ).strip(),
        tier=str(
            game_data.get(
                "tier",
                "Semi-Pro",
            )
        ).strip(),
        experience=str(
            game_data.get(
                "experience",
                "",
            )
        ).strip(),
    )

    db.session.add(game)

    db.session.commit()

    _process_reward_event(
        user=user,
        event_type="GAME_ADDED",
        reference_id=game.id,
        metadata={
            "game_id": game.id,
            "game_name": game.game_name,
            "source": "profile_game",
        },
    )

    return jsonify(
        game.to_dict()
    ), 201


# =========================================================
# DELETE GAME
# =========================================================

@profile_bp.route(
    "/games/<int:game_id>",
    methods=["DELETE"],
)
def delete_game(game_id):

    user, error = _require_user()

    if error:
        return error

    game = ProfileGame.query.filter_by(
        id=game_id,
        user_id=user.id,
    ).first()

    if game is None:

        return jsonify({
            "success": False,
            "message": "Game not found",
        }), 404

    db.session.delete(game)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Game removed",
    })


# =========================================================
# GET CURRENT USER CLIPS
# =========================================================

@profile_bp.route(
    "/clips",
    methods=["GET"],
)
def get_my_clips():

    user, error = _require_user()

    if error:
        return error

    clips = (
        ProfileClip.query
        .filter_by(
            user_id=user.id
        )
        .order_by(
            ProfileClip.created_at.desc()
        )
        .all()
    )

    clip_ids = [
        clip.id
        for clip in clips
    ]

    liked_clip_ids = _liked_clip_ids_for_viewer(
        clip_ids,
        user.id,
    )

    metadata_by_clip_id = _clip_metadata_by_user(
        user.id
    )

    return jsonify({
        "success": True,
        "clips": [
            _serialize_clip(
                clip,
                liked_clip_ids,
                metadata_by_clip_id,
            )
            for clip in clips
        ],
    })


# =========================================================
# UPLOAD CLIP
# =========================================================

@profile_bp.route(
    "/clips",
    methods=["POST"],
)
def upload_clip():

    user, error = _require_user()

    if error:
        return error

    if not SUPABASE_URL:

        return jsonify({
            "success": False,
            "message": (
                "SUPABASE_URL is not configured "
                "on the backend."
            ),
        }), 500

    if not SUPABASE_SERVICE_ROLE_KEY:

        return jsonify({
            "success": False,
            "message": (
                "SUPABASE_SERVICE_ROLE_KEY is not "
                "configured on the backend."
            ),
        }), 500

    if not SUPABASE_CLIP_BUCKET:

        return jsonify({
            "success": False,
            "message": (
                "SUPABASE_CLIP_BUCKET is not "
                "configured on the backend."
            ),
        }), 500

    clip_file = request.files.get(
        "clip"
    )

    if clip_file is None:

        return jsonify({
            "success": False,
            "message": "Video file is required.",
        }), 400

    if not clip_file.filename:

        return jsonify({
            "success": False,
            "message": "Video file is required.",
        }), 400

    mime_type = (
        clip_file.mimetype
        or "video/mp4"
    ).lower()

    allowed_mime_types = {
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-matroska",
    }

    if mime_type not in allowed_mime_types:

        return jsonify({
            "success": False,
            "message": (
                "Unsupported video format. "
                "Please upload MP4, WebM, MOV, or MKV."
            ),
        }), 400

    # -----------------------------------------------------
    # TITLE
    # -----------------------------------------------------

    title = request.form.get(
        "title",
        "",
    ).strip()

    if not title:
        title = "Gameplay Clip"

    if len(title) > 160:

        return jsonify({
            "success": False,
            "message": (
                "Title must be 160 characters or less."
            ),
        }), 400

    # -----------------------------------------------------
    # DESCRIPTION
    # -----------------------------------------------------

    description = (
        request.form.get("description")
        or request.form.get("desc")
        or ""
    ).strip()

    if len(description) > 2000:

        return jsonify({
            "success": False,
            "message": (
                "Description must be 2000 characters or less."
            ),
        }), 400

    # -----------------------------------------------------
    # GAME
    # -----------------------------------------------------

    raw_game_value = (
        request.form.get("gameId")
        or request.form.get("game_id")
        or request.form.get("gameSlug")
        or request.form.get("game_slug")
        or request.form.get("gameName")
        or request.form.get("game_name")
        or request.form.get("game")
        or ""
    ).strip()

    resolved_game_id = _resolve_clip_game_id(
        user,
        raw_game_value,
    )

    if raw_game_value and not resolved_game_id:

        return jsonify({
            "success": False,
            "message": (
                "The selected game could not be found. "
                "Please select a valid SYNCO game."
            ),
        }), 400

    # -----------------------------------------------------
    # VIDEO METADATA
    # -----------------------------------------------------

    try:

        duration_seconds = float(
            request.form.get(
                "durationSeconds",
                0,
            )
            or 0
        )

    except (TypeError, ValueError):
        duration_seconds = 0

    try:

        width = int(
            request.form.get(
                "width",
                0,
            )
            or 0
        )

    except (TypeError, ValueError):
        width = 0

    try:

        height = int(
            request.form.get(
                "height",
                0,
            )
            or 0
        )

    except (TypeError, ValueError):
        height = 0

    if duration_seconds <= 0:

        return jsonify({
            "success": False,
            "message": "Invalid video duration.",
        }), 400

    if duration_seconds > 120:

        return jsonify({
            "success": False,
            "message": (
                "Clips must be 120 seconds or shorter."
            ),
        }), 400

    if width <= 0 or height <= 0:

        return jsonify({
            "success": False,
            "message": "Invalid video resolution.",
        }), 400

    if width < 720 or height < 720:

        return jsonify({
            "success": False,
            "message": (
                "Minimum video resolution is 720p."
            ),
        }), 400

    if width > 1920 or height > 1920:

        return jsonify({
            "success": False,
            "message": (
                "Maximum supported resolution is 1080p."
            ),
        }), 400

    # -----------------------------------------------------
    # READ VIDEO
    # -----------------------------------------------------

    file_bytes = clip_file.read()

    if not file_bytes:

        return jsonify({
            "success": False,
            "message": "Uploaded video is empty.",
        }), 400

    file_size = len(file_bytes)

    max_file_size = (
        250 * 1024 * 1024
    )

    if file_size > max_file_size:

        return jsonify({
            "success": False,
            "message": (
                "Video must be smaller than 250 MB."
            ),
        }), 400

    # -----------------------------------------------------
    # FILE EXTENSION
    # -----------------------------------------------------

    original_extension = Path(
        clip_file.filename
    ).suffix.lower()

    extension_map = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
        "video/x-matroska": ".mkv",
    }

    extension = (
        extension_map.get(mime_type)
        or original_extension
        or ".mp4"
    )

    # -----------------------------------------------------
    # SUPABASE STORAGE PATH
    # -----------------------------------------------------

    storage_path = (
        f"{user.id}/"
        f"{uuid.uuid4()}{extension}"
    )

    # -----------------------------------------------------
    # UPLOAD TO SUPABASE
    # -----------------------------------------------------

    try:

        supabase = _get_supabase()

        current_app.logger.info(
            "Uploading SYNCO profile clip: "
            "bucket=%s path=%s size=%s mime=%s game_id=%s",
            SUPABASE_CLIP_BUCKET,
            storage_path,
            file_size,
            mime_type,
            resolved_game_id,
        )

        upload_result = (
            supabase
            .storage
            .from_(SUPABASE_CLIP_BUCKET)
            .upload(
                storage_path,
                file_bytes,
                {
                    "content-type": mime_type,
                    "upsert": "false",
                },
            )
        )

        current_app.logger.info(
            "Supabase clip upload successful: %s",
            upload_result,
        )

    except Exception as upload_error:

        current_app.logger.exception(
            "SUPABASE CLIP UPLOAD FAILED"
        )

        return jsonify({
            "success": False,
            "message": (
                "Unable to upload video to storage."
            ),
            "error": str(
                upload_error
            ),
            "bucket": SUPABASE_CLIP_BUCKET,
        }), 500

    # -----------------------------------------------------
    # SAVE DATABASE RECORD
    # -----------------------------------------------------

    try:

        clip = ProfileClip(
            user_id=user.id,
            title=title,
            filename=storage_path,
            file_size=file_size,
            mime_type=mime_type,
            duration_seconds=duration_seconds,
            width=width,
            height=height,
        )

        db.session.add(clip)
        db.session.flush()

        # The two metadata columns are intentionally written
        # using SQL so models.py does not need to be replaced.
        db.session.execute(
            text(
                """
                UPDATE profile_clips
                SET
                    description = :description,
                    game_id = :game_id
                WHERE id = :clip_id
                """
            ),
            {
                "description": description,
                "game_id": resolved_game_id,
                "clip_id": clip.id,
            },
        )

        db.session.commit()

    except Exception as database_error:

        db.session.rollback()

        try:

            supabase.storage.from_(
                SUPABASE_CLIP_BUCKET
            ).remove([
                storage_path
            ])

        except Exception:
            pass

        current_app.logger.exception(
            "PROFILE CLIP DATABASE INSERT FAILED"
        )

        return jsonify({
            "success": False,
            "message": (
                "Video uploaded but could not be "
                "saved to the profile."
            ),
            "error": str(
                database_error
            ),
        }), 500

    _process_reward_event(
        user=user,
        event_type="CLIP_UPLOADED",
        reference_id=clip.id,
        metadata={
            "clip_id": clip.id,
            "title": clip.title,
            "game_id": resolved_game_id,
            "description": description,
            "source": "profile_clip",
        },
    )

    media_url = _clip_media_url(
        clip.filename
    )

    metadata_by_clip_id = _clip_metadata_by_user(
        user.id
    )

    return jsonify({
        "success": True,
        "message": "Clip uploaded successfully.",
        "clip": _serialize_clip(
            clip,
            set(),
            metadata_by_clip_id,
        ),
    }), 201


# =========================================================
# DELETE CLIP
# =========================================================

@profile_bp.route(
    "/clips/<int:clip_id>",
    methods=["DELETE"],
)
def delete_clip(clip_id):

    user, error = _require_user()

    if error:
        return error

    clip = ProfileClip.query.filter_by(
        id=clip_id,
        user_id=user.id,
    ).first()

    if clip is None:

        return jsonify({
            "success": False,
            "message": "Clip not found.",
        }), 404

    if clip.filename:

        try:

            supabase = _get_supabase()

            supabase.storage.from_(
                SUPABASE_CLIP_BUCKET
            ).remove([
                clip.filename
            ])

        except Exception:

            current_app.logger.exception(
                "Failed to delete clip from Supabase"
            )

    db.session.delete(clip)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Clip deleted successfully.",
    })


# =========================================================
# LIKE / UNLIKE CLIP
# =========================================================

@profile_bp.route(
    "/clips/<int:clip_id>/like",
    methods=["POST"],
)
def toggle_clip_like(clip_id):

    user, error = _require_user()

    if error:
        return error

    clip = db.session.get(
        ProfileClip,
        clip_id,
    )

    if clip is None:

        return jsonify({
            "success": False,
            "message": "Clip not found.",
        }), 404

    existing_like = (
        ProfileClipLike.query
        .filter_by(
            clip_id=clip.id,
            user_id=user.id,
        )
        .first()
    )

    if existing_like:

        db.session.delete(
            existing_like
        )

        liked = False

    else:

        new_like = ProfileClipLike(
            clip_id=clip.id,
            user_id=user.id,
        )

        db.session.add(
            new_like
        )

        liked = True

    db.session.commit()

    likes_count = (
        ProfileClipLike.query
        .filter_by(
            clip_id=clip.id
        )
        .count()
    )

    return jsonify({
        "success": True,
        "liked": liked,
        "likes": likes_count,
    })


# =========================================================
# GET CLIP COMMENTS
# =========================================================

@profile_bp.route(
    "/clips/<int:clip_id>/comments",
    methods=["GET"],
)
def get_clip_comments(clip_id):

    clip = db.session.get(
        ProfileClip,
        clip_id,
    )

    if clip is None:

        return jsonify({
            "success": False,
            "message": "Clip not found.",
        }), 404

    comments = (
        ProfileClipComment.query
        .filter_by(
            clip_id=clip.id
        )
        .order_by(
            ProfileClipComment.created_at.asc()
        )
        .all()
    )

    return jsonify({
        "success": True,
        "comments": [
            comment.to_dict()
            for comment in comments
        ],
    })


# =========================================================
# ADD CLIP COMMENT
# =========================================================

@profile_bp.route(
    "/clips/<int:clip_id>/comments",
    methods=["POST"],
)
def add_clip_comment(clip_id):

    user, error = _require_user()

    if error:
        return error

    clip = db.session.get(
        ProfileClip,
        clip_id,
    )

    if clip is None:

        return jsonify({
            "success": False,
            "message": "Clip not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    content = str(
        data.get(
            "content",
            "",
        )
    ).strip()

    if not content:

        return jsonify({
            "success": False,
            "message": "Comment cannot be empty.",
        }), 400

    if len(content) > 1000:

        return jsonify({
            "success": False,
            "message": (
                "Comment must be 1000 characters "
                "or less."
            ),
        }), 400

    comment = ProfileClipComment(
        clip_id=clip.id,
        user_id=user.id,
        content=content,
    )

    db.session.add(comment)

    db.session.commit()

    return jsonify(
        comment.to_dict()
    ), 201
