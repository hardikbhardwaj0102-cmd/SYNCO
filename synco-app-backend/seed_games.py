from models import db, Game


INITIAL_GAMES = [
    {
        "id": "freefire",
        "name": "FREE FIRE",
        "short_name": "FREE FIRE MAX",
    },
    {
        "id": "pubg",
        "name": "PUBG",
        "short_name": "PUBG BATTLEGROUNDS",
    },
    {
        "id": "cr",
        "name": "CLASH ROYALE",
        "short_name": "CLASH ROYALE",
    },
    {
        "id": "pubgm",
        "name": "PUBG M",
        "short_name": "PUBG MOBILE",
    },
    {
        "id": "bgmi",
        "name": "BGMI",
        "short_name": "BATTLEGROUNDS MOBILE INDIA",
    },
    {
        "id": "val",
        "name": "VALORANT",
        "short_name": "VALORANT",
    },
]


def seed_initial_games():

    active_game_ids = {
        game_data["id"]
        for game_data in INITIAL_GAMES
    }

    # =====================================================
    # ADD / UPDATE ACTIVE GAMES
    # =====================================================

    for game_data in INITIAL_GAMES:

        game = db.session.get(
            Game,
            game_data["id"]
        )

        if game is None:

            db.session.add(
                Game(
                    id=game_data["id"],
                    name=game_data["name"],
                    short_name=game_data["short_name"],
                    is_active=True,
                )
            )

        else:

            game.name = game_data["name"]
            game.short_name = game_data["short_name"]
            game.is_active = True

    # =====================================================
    # DEACTIVATE REMOVED GAMES
    # =====================================================

    all_games = Game.query.all()

    for game in all_games:

        if game.id not in active_game_ids:
            game.is_active = False

    db.session.commit()

    print(
        f"Seeded {len(INITIAL_GAMES)} active games."
    )


if __name__ == "__main__":

    from app import app

    with app.app_context():
        seed_initial_games()
