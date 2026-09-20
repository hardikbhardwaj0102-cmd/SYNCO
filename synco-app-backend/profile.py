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

from supabase import create_client

from rewards import process_synco_event

from models import (
    db,
    ProfileClip,
    ProfileClipLike,
    ProfileClipComment,
    ProfileGame,
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
#
# IMPORTANT:
# A clip belongs to one user, but the "liked" state belongs
# to the person currently viewing the clip.
#
# Therefore we must calculate isLiked using:
#
#     ProfileClipLike.user_id == viewer_user_id
#
# and NOT using the clip owner.
#
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
# CLIP SERIALIZER
# =========================================================

def _serialize_clip(
    clip,
    liked_clip_ids=None,
):

    liked_clip_ids = liked_clip_ids or set()

    clip_data = clip.to_dict(
        _clip_media_url(
            clip.filename
        )
    )

    # -----------------------------------------------------
    # THIS IS THE IMPORTANT PART
    # -----------------------------------------------------
    #
    # The frontend uses:
    #
    #     clip.isLiked
    #
    # so always send it explicitly.
    #
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # CURRENT VIEWER
    # -----------------------------------------------------

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

            _serialize_clip(
                clip,
                liked_clip_ids,
            )

            for clip in clips

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

    return jsonify({

        "basicData": basic_data,

        "uid": user.uid,


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

            _serialize_clip(
                clip,
                liked_clip_ids,
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

            basic_data["email"].lower()

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


    # =====================================================
    # PROFILE COMPLETION REWARD
    # =====================================================

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


    # -----------------------------------------------------
    # DELETE SUPABASE CLIPS
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # DELETE DATABASE DATA
    # -----------------------------------------------------

    ProfileClip.query.filter_by(
        user_id=user.id
    ).delete()

    ProfileGame.query.filter_by(
        user_id=user.id
    ).delete()

    UserProfile.query.filter_by(
        user_id=user.id
    ).delete()


    # -----------------------------------------------------
    # DELETE USER
    # -----------------------------------------------------

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


    # =====================================================
    # CREATE GAME
    # =====================================================

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


    # =====================================================
    # FIRST GAME REWARD
    # =====================================================

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
#
# DashboardHome uses:
#
#     GET /api/profile/clips
#
# This endpoint now also returns isLiked so the heart
# correctly restores its state after refresh.
#
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

    return jsonify({

        "success": True,

        "clips": [

            _serialize_clip(
                clip,
                liked_clip_ids,
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


    # -----------------------------------------------------
    # CHECK SUPABASE CONFIGURATION
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # GET FILE
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # MIME TYPE
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # VALIDATE DURATION
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # VALIDATE RESOLUTION
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # MAX FILE SIZE
    # -----------------------------------------------------

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

        extension_map.get(
            mime_type
        )

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
            "bucket=%s path=%s size=%s mime=%s",

            SUPABASE_CLIP_BUCKET,

            storage_path,

            file_size,

            mime_type,

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

        db.session.commit()


    except Exception as database_error:

        db.session.rollback()


        # -----------------------------------------------
        # Roll back Supabase upload if DB fails.
        # -----------------------------------------------

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


    # =====================================================
    # FIRST CLIP REWARD
    # =====================================================

    _process_reward_event(

        user=user,

        event_type="CLIP_UPLOADED",

        reference_id=clip.id,

        metadata={
            "clip_id": clip.id,
            "title": clip.title,
            "source": "profile_clip",
        },

    )


    # -----------------------------------------------------
    # CREATE SIGNED URL
    # -----------------------------------------------------

    media_url = _clip_media_url(
        clip.filename
    )


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------
    #
    # A newly uploaded clip is not automatically liked.
    #
    # -----------------------------------------------------

    return jsonify({

        "success": True,

        "message": "Clip uploaded successfully.",

        "clip": _serialize_clip(
            clip,
            set(),
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


    # -----------------------------------------------------
    # DELETE FROM SUPABASE
    # -----------------------------------------------------

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


    # -----------------------------------------------------
    # DELETE DATABASE RECORD
    # -----------------------------------------------------

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