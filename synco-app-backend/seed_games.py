from models import db, Game


INITIAL_GAMES = [
    {"id": "cs2", "name": "COUNTER STRIKE 2", "short_name": "CS2"},
    {"id": "freefire", "name": "FREE FIRE", "short_name": "FREE FIRE MAX"},
    {"id": "pubg", "name": "PUBG", "short_name": "PUBG BATTLEGROUNDS"},
    {"id": "cr", "name": "CLASH ROYALE", "short_name": "CLASH ROYALE"},
    {"id": "pubgm", "name": "PUBG M", "short_name": "PUBG MOBILE"},
    {"id": "bgmi", "name": "BGMI", "short_name": "BATTLEGROUNDS MOBILE INDIA"},
    {"id": "val", "name": "VALORANT", "short_name": "VALORANT"},
]


def seed_initial_games():
    for game_data in INITIAL_GAMES:
        game = db.session.get(Game, game_data["id"])
        if game is None:
            db.session.add(Game(**game_data))
        else:
            game.name = game_data["name"]
            game.short_name = game_data["short_name"]
            game.is_active = True
    db.session.commit()
    print(f"Seeded {len(INITIAL_GAMES)} games.")


if __name__ == "__main__":
    from app import app

    with app.app_context():
        seed_initial_games()