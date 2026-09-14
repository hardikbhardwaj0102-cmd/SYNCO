from flask import Blueprint, jsonify

from models import Game


games_bp = Blueprint(
    "games",
    __name__,
    url_prefix="/api/games"
)


# =========================================================
# GET ALL ACTIVE GAMES
# =========================================================

@games_bp.route("", methods=["GET"])
def get_games():

    games = (
        Game.query
        .filter_by(is_active=True)
        .order_by(Game.name.asc())
        .all()
    )

    return jsonify({
        "games": [
            game.to_dict()
            for game in games
        ]
    })


# =========================================================
# GET SINGLE GAME
# =========================================================

@games_bp.route("/<string:game_id>", methods=["GET"])
def get_game(game_id):

    game = Game.query.filter_by(
        id=game_id,
        is_active=True
    ).first()

    if not game:
        return jsonify({
            "error": "Game not found"
        }), 404

    return jsonify({
        "game": game.to_dict()
    })