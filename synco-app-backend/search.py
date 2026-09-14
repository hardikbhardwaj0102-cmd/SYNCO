from flask import Blueprint, request, jsonify

from models import db, User, Club, Game


# =========================================================
# BLUEPRINT
# =========================================================

search_bp = Blueprint(
    "search",
    __name__,
    url_prefix="/api/search",
)


# =========================================================
# USER SERIALIZER
# =========================================================

def serialize_user(user):

    resolved_avatar = user.avatar

    if (
        user.discord_id
        and user.avatar
        and not user.avatar.startswith("http")
    ):
        resolved_avatar = (
            f"https://cdn.discordapp.com/avatars/"
            f"{user.discord_id}/{user.avatar}.png?size=256"
        )

    return {
        "id": user.id,
        "uid": user.uid,
        "username": user.username,
        "name": user.name,
        "avatar": resolved_avatar,
        "level": user.level,
        "type": "user",
    }


# =========================================================
# CLUB SERIALIZER
# =========================================================

def serialize_club(club):

    return {
        "id": club.id,
        "name": club.name,
        "tag": club.tag,
        "description": club.description,
        "privacy": club.privacy,
        "gameId": club.game_id,

        "gameName": (
            club.game.name
            if club.game
            else None
        ),

        "memberCount": len(club.members),

        "ownerId": club.owner_id,

        "type": "club",
    }


# =========================================================
# GAME SERIALIZER
# =========================================================

def serialize_game(game):

    return {
        "id": game.id,
        "name": game.name,
        "shortName": game.short_name,
        "slug": game.slug,
        "description": game.description,
        "logoUrl": game.logo_url,
        "isActive": game.is_active,
        "type": "game",
    }


# =========================================================
# GLOBAL SEARCH
# =========================================================

@search_bp.get("")
def global_search():

    query = request.args.get(
        "q",
        ""
    ).strip()

    search_type = request.args.get(
        "type",
        "all"
    ).strip().lower()


    # =====================================================
    # VALIDATION
    # =====================================================

    allowed_types = {
        "all",
        "users",
        "clubs",
        "games",
    }

    if search_type not in allowed_types:

        return jsonify({
            "success": False,
            "message": (
                "Invalid search type. "
                "Use all, users, clubs, or games."
            )
        }), 400


    # =====================================================
    # EMPTY QUERY
    # =====================================================

    if not query:

        return jsonify({
            "success": True,
            "query": "",
            "type": search_type,

            "results": {
                "users": [],
                "clubs": [],
                "games": [],
            },

            "counts": {
                "users": 0,
                "clubs": 0,
                "games": 0,
                "total": 0,
            }
        })


    # =====================================================
    # SEARCH PATTERN
    # =====================================================

    search_pattern = f"%{query}%"


    users = []
    clubs = []
    games = []


    # =====================================================
    # USERS
    # =====================================================

    if search_type in ("all", "users"):

        users = (
            User.query
            .filter(
                db.or_(
                    User.username.ilike(
                        search_pattern
                    ),

                    User.name.ilike(
                        search_pattern
                    ),

                    User.uid.ilike(
                        search_pattern
                    ),
                )
            )
            .order_by(
                User.username.asc()
            )
            .limit(20)
            .all()
        )


    # =====================================================
    # CLUBS
    # =====================================================

    if search_type in ("all", "clubs"):

        clubs = (
            Club.query
            .filter(
                Club.is_active.is_(True),

                db.or_(
                    Club.name.ilike(
                        search_pattern
                    ),

                    Club.tag.ilike(
                        search_pattern
                    ),
                )
            )
            .order_by(
                Club.name.asc()
            )
            .limit(20)
            .all()
        )


    # =====================================================
    # GAMES
    # =====================================================

    if search_type in ("all", "games"):

        games = (
            Game.query
            .filter(
                Game.is_active.is_(True),

                db.or_(
                    Game.name.ilike(
                        search_pattern
                    ),

                    Game.short_name.ilike(
                        search_pattern
                    ),

                    Game.slug.ilike(
                        search_pattern
                    ),
                )
            )
            .order_by(
                Game.name.asc()
            )
            .limit(20)
            .all()
        )


    # =====================================================
    # SERIALIZE
    # =====================================================

    user_results = [
        serialize_user(user)
        for user in users
    ]

    club_results = [
        serialize_club(club)
        for club in clubs
    ]

    game_results = [
        serialize_game(game)
        for game in games
    ]


    total = (
        len(user_results)
        + len(club_results)
        + len(game_results)
    )


    # =====================================================
    # RESPONSE
    # =====================================================

    return jsonify({

        "success": True,

        "query": query,

        "type": search_type,

        "results": {

            "users": user_results,

            "clubs": club_results,

            "games": game_results,

        },

        "counts": {

            "users": len(user_results),

            "clubs": len(club_results),

            "games": len(game_results),

            "total": total,

        }

    })
