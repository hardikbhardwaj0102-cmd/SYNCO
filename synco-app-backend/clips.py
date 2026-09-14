# =========================================================
# CLIPS API
# =========================================================

import os
import uuid
from pathlib import Path

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
    send_from_directory,
    session,
)

from supabase import create_client, Client
from werkzeug.utils import secure_filename

from models import (
    db,
    ProfileClip,
    ProfileClipComment,
    ProfileClipLike,
    User,
)


# =========================================================
# BLUEPRINT
# =========================================================

clips_bp = Blueprint(
    "clips",
    __name__,
    url_prefix="/api/profile/clips",
)


# =========================================================
# CONFIGURATION
# =========================================================

# Supported video extensions
ALLOWED_EXTENSIONS = {
    "mp4",
    "webm",
    "mov",
}

# Supported MIME types
ALLOWED_MIME_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
}


# Maximum number of clips per user
MAX_CLIPS = 6


# Maximum size of ONE video
# 50 MB
MAX_FILE_SIZE = 50 * 1024 * 1024


# Maximum TOTAL storage per user
# 500 MB
MAX_USER_STORAGE = 500 * 1024 * 1024


# Supabase bucket
SUPABASE_BUCKET = "synco-videos"


# Signed URL validity
# 1 hour
SIGNED_URL_EXPIRY = 3600


# =========================================================
# SUPABASE CLIENT
# =========================================================

_supabase_client = None


def _get_supabase() -> Client:

    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url:
        raise RuntimeError(
            "SUPABASE_URL is not configured"
        )

    if not supabase_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured"
        )

    _supabase_client = create_client(
        supabase_url,
        supabase_key,
    )

    return _supabase_client


# =========================================================
# CURRENT USER
# =========================================================

def _current_user():

    session_user = session.get("user")

    if not session_user:
        return None

    return db.session.get(
        User,
        session_user.get("id"),
    )


# =========================================================
# REQUIRE AUTHENTICATION
# =========================================================

def _require_user():

    user = _current_user()

    if user is None:
        return (
            None,
            (
                jsonify({
                    "success": False,
                    "message": "Authentication required",
                }),
                401,
            ),
        )

    return user, None


# =========================================================
# EXTENSION HELPER
# =========================================================

def _get_extension(filename):

    return (
        Path(filename)
        .suffix
        .lower()
        .lstrip(".")
    )


# =========================================================
# MIME TYPE HELPER
# =========================================================

def _get_mime_type(extension, supplied_mime=None):

    # Trust our extension mapping rather than relying entirely
    # on browser-provided MIME types.

    mime_map = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
    }

    return mime_map.get(
        extension,
        supplied_mime or "application/octet-stream",
    )


# =========================================================
# LOCAL MEDIA DIRECTORY
# =========================================================
#
# Kept ONLY for backwards compatibility with old clips
# that may still exist on the local server.
#
# New clips are stored in Supabase.
#
# =========================================================

def _media_dir():

    path = (
        Path(current_app.root_path)
        / "media"
        / "clips"
    )

    path.mkdir(
        parents=True,
        exist_ok=True,
    )

    return path


# =========================================================
# USER STORAGE USAGE
# =========================================================

def _user_storage_usage(user_id):

    usage = (
        db.session.query(
            db.func.coalesce(
                db.func.sum(ProfileClip.file_size),
                0,
            )
        )
        .filter(
            ProfileClip.user_id == user_id
        )
        .scalar()
    )

    return int(usage or 0)


# =========================================================
# SIGNED SUPABASE URL
# =========================================================

def _create_signed_url(storage_path):

    supabase = _get_supabase()

    response = (
        supabase
        .storage
        .from_(SUPABASE_BUCKET)
        .create_signed_url(
            storage_path,
            SIGNED_URL_EXPIRY,
        )
    )

    data = getattr(
        response,
        "data",
        None,
    )

    if not data:
        raise RuntimeError(
            "Supabase did not return a signed URL"
        )

    # Current SDK normally returns:
    #
    # {
    #     "signedUrl": "..."
    # }
    #
    # Keep a fallback for alternate response formatting.

    if isinstance(data, dict):

        signed_url = (
            data.get("signedUrl")
            or data.get("signedURL")
            or data.get("signed_url")
        )

        if signed_url:
            return signed_url

    raise RuntimeError(
        "Unable to extract signed URL from Supabase response"
    )


# =========================================================
# DELETE FROM SUPABASE
# =========================================================

def _delete_from_supabase(storage_path):

    if not storage_path:
        return

    try:

        supabase = _get_supabase()

        (
            supabase
            .storage
            .from_(SUPABASE_BUCKET)
            .remove([
                storage_path
            ])
        )

    except Exception as error:

        current_app.logger.error(
            "Failed to delete Supabase clip %s: %s",
            storage_path,
            error,
        )


# =========================================================
# CLIP RESPONSE
# =========================================================

def _clip_response(clip):

    filename = clip.filename or ""

    # -----------------------------------------------------
    # NEW SUPABASE CLIPS
    # -----------------------------------------------------

    if "/" in filename:

        try:

            media_url = _create_signed_url(
                filename
            )

            return clip.to_dict(
                media_url
            )

        except Exception as error:

            current_app.logger.error(
                "Failed to create signed URL for clip %s: %s",
                clip.id,
                error,
            )

            response = clip.to_dict("")

            response["url"] = ""

            return response

    # -----------------------------------------------------
    # OLD LOCAL CLIPS
    # -----------------------------------------------------

    return clip.to_dict(
        f"/api/profile/clips/media/{secure_filename(filename)}"
    )


# =========================================================
# GET ALL USER CLIPS
# =========================================================

@clips_bp.route(
    "",
    methods=["GET"],
)
def list_clips():

    user = _current_user()

    if user is None:

        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

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

    return jsonify({
        "success": True,
        "clips": [
            _clip_response(clip)
            for clip in clips
        ],
        "limit": MAX_CLIPS,
        "storage": {
            "usedBytes": _user_storage_usage(
                user.id
            ),
            "maxBytes": MAX_USER_STORAGE,
        },
    })


# =========================================================
# UPLOAD CLIP
# =========================================================

@clips_bp.route(
    "",
    methods=["POST"],
)
def upload_clip():

    user = _current_user()

    if user is None:

        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

    # -----------------------------------------------------
    # MAX CLIP COUNT
    # -----------------------------------------------------

    current_clip_count = (
        ProfileClip.query
        .filter_by(
            user_id=user.id
        )
        .count()
    )

    if current_clip_count >= MAX_CLIPS:

        return jsonify({
            "success": False,
            "message": "You can add up to 6 clips",
        }), 400

    # -----------------------------------------------------
    # GET FILE
    # -----------------------------------------------------

    media = request.files.get("clip")

    if media is None or not media.filename:

        return jsonify({
            "success": False,
            "message": "A video clip is required",
        }), 400

    original_filename = media.filename

    # -----------------------------------------------------
    # EXTENSION
    # -----------------------------------------------------

    extension = _get_extension(
        original_filename
    )

    if extension not in ALLOWED_EXTENSIONS:

        return jsonify({
            "success": False,
            "message": (
                "Only MP4, WebM, and MOV clips are supported"
            ),
        }), 400

    # -----------------------------------------------------
    # MIME TYPE
    # -----------------------------------------------------

    mime_type = _get_mime_type(
        extension,
        media.mimetype,
    )

    if mime_type not in ALLOWED_MIME_TYPES:

        return jsonify({
            "success": False,
            "message": (
                "Unsupported video format"
            ),
        }), 400

    # -----------------------------------------------------
    # VIDEO METADATA
    # -----------------------------------------------------

    duration = request.form.get(
        "durationSeconds",
        type=float,
    )

    width = request.form.get(
        "width",
        type=int,
    )

    height = request.form.get(
        "height",
        type=int,
    )

    if (
        duration is None
        or width is None
        or height is None
    ):

        return jsonify({
            "success": False,
            "message": "Video metadata is required",
        }), 400

    # -----------------------------------------------------
    # DURATION VALIDATION
    # -----------------------------------------------------

    if duration <= 0 or duration > 120:

        return jsonify({
            "success": False,
            "message": (
                "Clips must be 120 seconds or shorter"
            ),
        }), 400

    # -----------------------------------------------------
    # RESOLUTION VALIDATION
    # -----------------------------------------------------

    if (
        width < 1280
        or height < 720
        or width > 1920
        or height > 1080
    ):

        return jsonify({
            "success": False,
            "message": (
                "Clips must be between 720p and 1080p"
            ),
        }), 400

    # -----------------------------------------------------
    # FILE SIZE
    # -----------------------------------------------------

    try:

        media.stream.seek(
            0,
            os.SEEK_END,
        )

        file_size = media.stream.tell()

        media.stream.seek(
            0
        )

    except Exception:

        return jsonify({
            "success": False,
            "message": (
                "Unable to determine video size"
            ),
        }), 400

    # -----------------------------------------------------
    # INDIVIDUAL 50 MB LIMIT
    # -----------------------------------------------------

    if file_size > MAX_FILE_SIZE:

        return jsonify({
            "success": False,
            "message": (
                "Clip file must be 50 MB or smaller"
            ),
            "maxFileSize": MAX_FILE_SIZE,
        }), 400

    # -----------------------------------------------------
    # EMPTY FILE
    # -----------------------------------------------------

    if file_size <= 0:

        return jsonify({
            "success": False,
            "message": "The video file is empty",
        }), 400

    # -----------------------------------------------------
    # USER 500 MB STORAGE QUOTA
    # -----------------------------------------------------

    current_usage = _user_storage_usage(
        user.id
    )

    if (
        current_usage + file_size
        > MAX_USER_STORAGE
    ):

        remaining = max(
            0,
            MAX_USER_STORAGE - current_usage,
        )

        return jsonify({
            "success": False,
            "message": (
                "You have reached your 500 MB video storage limit"
            ),
            "usedBytes": current_usage,
            "remainingBytes": remaining,
            "maxBytes": MAX_USER_STORAGE,
        }), 400

    # -----------------------------------------------------
    # TITLE
    # -----------------------------------------------------

    title = (
        request.form.get(
            "title",
            "Gameplay clip",
        )
        .strip()
        [:160]
    )

    if not title:
        title = "Gameplay clip"

    # -----------------------------------------------------
    # UNIQUE STORAGE PATH
    # -----------------------------------------------------
    #
    # Example:
    #
    # 42/8a9f4c7e8d2f4a9a9b1d3c.mp4
    #
    # User ID keeps each user's files organized.
    #
    # -----------------------------------------------------

    storage_filename = (
        f"{uuid.uuid4().hex}.{extension}"
    )

    storage_path = (
        f"{user.id}/{storage_filename}"
    )

    supabase = None
    uploaded = False

    try:

        # -------------------------------------------------
        # SUPABASE CLIENT
        # -------------------------------------------------

        supabase = _get_supabase()

        # -------------------------------------------------
        # RESET FILE POINTER
        # -------------------------------------------------

        media.stream.seek(0)

        # -------------------------------------------------
        # UPLOAD TO SUPABASE
        # -------------------------------------------------

        (
            supabase
            .storage
            .from_(SUPABASE_BUCKET)
            .upload(
                path=storage_path,
                file=media.stream,
                file_options={
                    "content-type": mime_type,
                    "cache-control": "3600",
                    "upsert": "false",
                },
            )
        )

        uploaded = True

        # -------------------------------------------------
        # CREATE DATABASE RECORD
        # -------------------------------------------------

        clip = ProfileClip(
            user_id=user.id,

            title=title,

            filename=storage_path,

            file_size=file_size,

            mime_type=mime_type,

            duration_seconds=duration,

            width=width,

            height=height,
        )

        db.session.add(clip)

        db.session.commit()

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return jsonify(
            _clip_response(clip)
        ), 201

    except Exception as error:

        # -------------------------------------------------
        # DATABASE ROLLBACK
        # -------------------------------------------------

        db.session.rollback()

        current_app.logger.exception(
            "Clip upload failed"
        )

        # -------------------------------------------------
        # REMOVE SUPABASE FILE IF DB SAVE FAILED
        # -------------------------------------------------

        if uploaded and supabase:

            try:

                (
                    supabase
                    .storage
                    .from_(SUPABASE_BUCKET)
                    .remove([
                        storage_path
                    ])
                )

            except Exception as cleanup_error:

                current_app.logger.error(
                    "Supabase cleanup failed after upload error: %s",
                    cleanup_error,
                )

        return jsonify({
            "success": False,
            "message": (
                "Failed to upload clip"
            ),
        }), 500


# =========================================================
# DELETE CLIP
# =========================================================

@clips_bp.route(
    "/<int:clip_id>",
    methods=["DELETE"],
)
def delete_clip(clip_id):

    user = _current_user()

    if user is None:

        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

    # -----------------------------------------------------
    # ONLY OWNER CAN DELETE
    # -----------------------------------------------------

    clip = (
        ProfileClip.query
        .filter_by(
            id=clip_id,
            user_id=user.id,
        )
        .first()
    )

    if clip is None:

        return jsonify({
            "success": False,
            "message": "Clip not found",
        }), 404

    storage_path = clip.filename

    # -----------------------------------------------------
    # DELETE SUPABASE FILE
    # -----------------------------------------------------

    if storage_path and "/" in storage_path:

        try:

            _delete_from_supabase(
                storage_path
            )

        except Exception as error:

            current_app.logger.error(
                "Supabase delete error: %s",
                error,
            )

    # -----------------------------------------------------
    # DELETE OLD LOCAL FILE
    # -----------------------------------------------------

    else:

        path = (
            _media_dir()
            / secure_filename(
                storage_path or ""
            )
        )

        if path.exists():

            try:
                path.unlink()
            except Exception as error:

                current_app.logger.error(
                    "Failed to delete local clip: %s",
                    error,
                )

    # -----------------------------------------------------
    # DELETE DATABASE RECORD
    # -----------------------------------------------------

    try:

        db.session.delete(clip)

        db.session.commit()

    except Exception:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": (
                "Failed to delete clip record"
            ),
        }), 500

    return jsonify({
        "success": True,
    })


# =========================================================
# LIKE / UNLIKE CLIP
# =========================================================

@clips_bp.route(
    "/<int:clip_id>/like",
    methods=["POST"],
)
def toggle_like(clip_id):

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
            "message": "Clip not found",
        }), 404

    # -----------------------------------------------------
    # CHECK EXISTING LIKE
    # -----------------------------------------------------

    like = (
        ProfileClipLike.query
        .filter_by(
            clip_id=clip_id,
            user_id=user.id,
        )
        .first()
    )

    if like:

        db.session.delete(
            like
        )

        liked = False

    else:

        db.session.add(
            ProfileClipLike(
                clip_id=clip_id,
                user_id=user.id,
            )
        )

        liked = True

    db.session.commit()

    like_count = (
        ProfileClipLike.query
        .filter_by(
            clip_id=clip_id
        )
        .count()
    )

    return jsonify({
        "success": True,
        "liked": liked,
        "likes": like_count,
    })


# =========================================================
# COMMENTS
# =========================================================

@clips_bp.route(
    "/<int:clip_id>/comments",
    methods=["GET", "POST"],
)
def clip_comments(clip_id):

    clip = db.session.get(
        ProfileClip,
        clip_id,
    )

    if clip is None:

        return jsonify({
            "success": False,
            "message": "Clip not found",
        }), 404

    # =====================================================
    # GET COMMENTS
    # =====================================================

    if request.method == "GET":

        comments = (
            ProfileClipComment.query
            .filter_by(
                clip_id=clip_id
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

    # =====================================================
    # POST COMMENT
    # =====================================================

    user, error = _require_user()

    if error:
        return error

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    content = (
        data.get(
            "content",
            "",
        )
        .strip()
    )

    if not content:

        return jsonify({
            "success": False,
            "message": "Comment cannot be empty",
        }), 400

    if len(content) > 1000:

        return jsonify({
            "success": False,
            "message": (
                "Comment must be 1000 characters or fewer"
            ),
        }), 400

    # -----------------------------------------------------
    # CREATE COMMENT
    # -----------------------------------------------------

    comment = ProfileClipComment(
        clip_id=clip_id,
        user_id=user.id,
        content=content,
    )

    db.session.add(
        comment
    )

    db.session.commit()

    return jsonify(
        comment.to_dict()
    ), 201


# =========================================================
# OLD LOCAL MEDIA ROUTE
# =========================================================
#
# Kept for backwards compatibility with clips that were
# uploaded before the Supabase migration.
#
# New clips DO NOT use this route.
#
# =========================================================

@clips_bp.route(
    "/media/<filename>",
    methods=["GET"],
)
def serve_clip(filename):

    safe_filename = secure_filename(
        filename
    )

    if not safe_filename:

        return jsonify({
            "success": False,
            "message": "Invalid filename",
        }), 400

    path = (
        _media_dir()
        / safe_filename
    )

    if not path.exists():

        return jsonify({
            "success": False,
            "message": "Clip not found",
        }), 404

    return send_from_directory(
        _media_dir(),
        safe_filename,
    )