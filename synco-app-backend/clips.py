import os
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_from_directory, session
from werkzeug.utils import secure_filename

from models import db, ProfileClip, ProfileClipComment, ProfileClipLike, User


clips_bp = Blueprint("clips", __name__, url_prefix="/api/profile/clips")
ALLOWED_EXTENSIONS = {"mp4", "webm", "mov"}
MAX_CLIPS = 6
MAX_FILE_SIZE = 250 * 1024 * 1024


def _current_user():
    session_user = session.get("user")
    return db.session.get(User, session_user.get("id")) if session_user else None


def _media_dir():
    path = Path(current_app.root_path) / "media" / "clips"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _clip_response(clip):
    return clip.to_dict(f"/api/profile/clips/media/{clip.filename}")


def _require_user():
    user = _current_user()
    if user is None:
        return None, (jsonify({"success": False, "message": "Authentication required"}), 401)
    return user, None


@clips_bp.route("", methods=["GET"])
def list_clips():
    user = _current_user()
    if user is None:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    clips = ProfileClip.query.filter_by(user_id=user.id).order_by(ProfileClip.created_at.desc()).all()
    return jsonify({"clips": [_clip_response(clip) for clip in clips], "limit": MAX_CLIPS})


@clips_bp.route("", methods=["POST"])
def upload_clip():
    user = _current_user()
    if user is None:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    if ProfileClip.query.filter_by(user_id=user.id).count() >= MAX_CLIPS:
        return jsonify({"success": False, "message": "You can add up to 6 clips"}), 400

    media = request.files.get("clip")
    if media is None or not media.filename:
        return jsonify({"success": False, "message": "A video clip is required"}), 400

    extension = Path(media.filename).suffix.lower().lstrip(".")
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"success": False, "message": "Only MP4, WebM, and MOV clips are supported"}), 400

    duration = request.form.get("durationSeconds", type=float)
    width = request.form.get("width", type=int)
    height = request.form.get("height", type=int)
    if duration is None or width is None or height is None:
        return jsonify({"success": False, "message": "Video metadata is required"}), 400
    if duration <= 0 or duration > 120:
        return jsonify({"success": False, "message": "Clips must be 120 seconds or shorter"}), 400
    if width < 1280 or height < 720 or width > 1920 or height > 1080:
        return jsonify({"success": False, "message": "Clips must be between 720p and 1080p"}), 400

    media.stream.seek(0, os.SEEK_END)
    file_size = media.stream.tell()
    media.stream.seek(0)
    if file_size > MAX_FILE_SIZE:
        return jsonify({"success": False, "message": "Clip file must be 250 MB or smaller"}), 400

    filename = f"{uuid.uuid4().hex}.{extension}"
    media.save(_media_dir() / filename)
    clip = ProfileClip(
        user_id=user.id,
        title=request.form.get("title", "Gameplay clip").strip()[:160] or "Gameplay clip",
        filename=filename,
        duration_seconds=duration,
        width=width,
        height=height,
    )
    db.session.add(clip)
    db.session.commit()
    return jsonify(_clip_response(clip)), 201


@clips_bp.route("/<int:clip_id>", methods=["DELETE"])
def delete_clip(clip_id):
    user = _current_user()
    if user is None:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    clip = ProfileClip.query.filter_by(id=clip_id, user_id=user.id).first()
    if clip is None:
        return jsonify({"success": False, "message": "Clip not found"}), 404
    path = _media_dir() / clip.filename
    if path.exists():
        path.unlink()
    db.session.delete(clip)
    db.session.commit()
    return jsonify({"success": True})


@clips_bp.route("/<int:clip_id>/like", methods=["POST"])
def toggle_like(clip_id):
    user, error = _require_user()
    if error:
        return error
    clip = db.session.get(ProfileClip, clip_id)
    if clip is None:
        return jsonify({"success": False, "message": "Clip not found"}), 404

    like = ProfileClipLike.query.filter_by(clip_id=clip_id, user_id=user.id).first()
    if like:
        db.session.delete(like)
        liked = False
    else:
        db.session.add(ProfileClipLike(clip_id=clip_id, user_id=user.id))
        liked = True
    db.session.commit()
    return jsonify({"liked": liked, "likes": ProfileClipLike.query.filter_by(clip_id=clip_id).count()})


@clips_bp.route("/<int:clip_id>/comments", methods=["GET", "POST"])
def clip_comments(clip_id):
    clip = db.session.get(ProfileClip, clip_id)
    if clip is None:
        return jsonify({"success": False, "message": "Clip not found"}), 404

    if request.method == "GET":
        comments = ProfileClipComment.query.filter_by(clip_id=clip_id).order_by(ProfileClipComment.created_at.asc()).all()
        return jsonify({"comments": [comment.to_dict() for comment in comments]})

    user, error = _require_user()
    if error:
        return error
    content = (request.get_json(silent=True) or {}).get("content", "").strip()
    if not content:
        return jsonify({"success": False, "message": "Comment cannot be empty"}), 400
    if len(content) > 1000:
        return jsonify({"success": False, "message": "Comment must be 1000 characters or fewer"}), 400

    comment = ProfileClipComment(clip_id=clip_id, user_id=user.id, content=content)
    db.session.add(comment)
    db.session.commit()
    return jsonify(comment.to_dict()), 201


@clips_bp.route("/media/<filename>", methods=["GET"])
def serve_clip(filename):
    return send_from_directory(_media_dir(), secure_filename(filename))