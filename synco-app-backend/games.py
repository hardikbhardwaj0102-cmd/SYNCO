from flask import Blueprint, jsonify

from models import Game


games_bp = Blueprint("games", __name__, url_prefix="/api/games")


@games_bp.route("", methods=["GET"])
def get_games():
    games = Game.query.filter_by(is_active=True).order_by(Game.name.asc()).all()
    return jsonify({"games": [game.to_dict() for game in games]})