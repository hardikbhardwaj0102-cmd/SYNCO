from flask import Blueprint, request, jsonify

from models import (
    db,
    User,
    UserProfile,
    Game,
    PlayerGameStats,
    Club,
)


# =========================================================
# BLUEPRINT
# =========================================================

leaderboards_bp = Blueprint(
    "leaderboards",
    __name__,
    url_prefix="/api/leaderboards",
)


# =========================================================
# HELPERS
# =========================================================

def get_player_region(user):
    """
    Get player's region from UserProfile.basic_data.

    Supported keys:
        region
        Region
        country
        Country
    """

    profile = UserProfile.query.filter_by(
        user_id=user.id
    ).first()

    if not profile or not profile.basic_data:
        return "Global"

    basic_data = profile.basic_data or {}

    region = (
        basic_data.get("region")
        or basic_data.get("Region")
        or basic_data.get("country")
        or basic_data.get("Country")
    )

    if not region:
        return "Global"

    return str(region).strip()


def get_game_filter():
    """
    Accept:

        ?game=bgmi
        ?game=BGMI
        ?game=Battlegrounds Mobile India
    """

    game_value = request.args.get("game")

    if not game_value:
        return None

    game_value = game_value.strip()

    game = Game.query.filter(
        db.or_(
            Game.id.ilike(game_value),
            Game.name.ilike(game_value),
            Game.short_name.ilike(game_value),
            Game.slug.ilike(game_value),
        )
    ).first()

    return game


def normalize_avatar(user):
    """
    Resolve Discord avatar when necessary.
    """

    try:
        data = user.to_dict()
        return data.get("avatar") or ""
    except Exception:
        return user.avatar or ""


# =========================================================
# PLAYER RANKINGS
# =========================================================

@leaderboards_bp.route("/players", methods=["GET"])
def player_rankings():

    game = get_game_filter()
    region_filter = request.args.get("region")

    query = (
        db.session.query(
            PlayerGameStats,
            User,
            Game,
        )
        .join(
            User,
            PlayerGameStats.user_id == User.id,
        )
        .join(
            Game,
            PlayerGameStats.game_id == Game.id,
        )
    )

    # -----------------------------------------------------
    # GAME FILTER
    # -----------------------------------------------------

    if game:
        query = query.filter(
            PlayerGameStats.game_id == game.id
        )

    rows = query.all()

    rankings = []

    for stats, user, row_game in rows:

        player_region = get_player_region(user)

        # -------------------------------------------------
        # REGION FILTER
        # -------------------------------------------------

        if region_filter:
            if player_region.lower() != region_filter.lower():
                continue

        rankings.append({
            "playerId": user.id,

            "uid": user.uid,

            "username": (
                user.username
                or user.name
                or "Unknown Player"
            ),

            "name": user.name,

            "avatar": normalize_avatar(user),

            "region": player_region,

            "game": {
                "id": row_game.id,
                "name": row_game.name,
                "shortName": row_game.short_name,
                "slug": row_game.slug,
                "logoUrl": row_game.logo_url,
            },

            "syncoPoints": stats.synco_points,
        })

    # -----------------------------------------------------
    # SORT
    # -----------------------------------------------------

    rankings.sort(
        key=lambda item: item["syncoPoints"],
        reverse=True,
    )

    # -----------------------------------------------------
    # ASSIGN RANK
    # -----------------------------------------------------

    for index, player in enumerate(
        rankings,
        start=1,
    ):
        player["rank"] = index

    return jsonify({
        "success": True,
        "count": len(rankings),

        "filters": {
            "game": game.id if game else None,
            "region": region_filter,
        },

        "rankings": rankings,
    })


# =========================================================
# CURRENT PLAYER RANKING
# =========================================================

@leaderboards_bp.route("/players/me", methods=["GET"])
def my_player_rankings():

    user_id = request.args.get("userId")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "userId is required",
        }), 400

    try:
        user_id = int(user_id)

    except ValueError:
        return jsonify({
            "success": False,
            "message": "Invalid userId",
        }), 400

    user = User.query.get(user_id)

    if not user:
        return jsonify({
            "success": False,
            "message": "User not found",
        }), 404

    game = get_game_filter()
    region_filter = request.args.get("region")

    player_region = get_player_region(user)

    # -----------------------------------------------------
    # REGION CHECK
    # -----------------------------------------------------

    if region_filter:

        if player_region.lower() != region_filter.lower():

            return jsonify({
                "success": True,
                "player": {
                    "id": user.id,
                    "uid": user.uid,
                    "username": user.username or user.name,
                    "name": user.name,
                    "avatar": normalize_avatar(user),
                    "region": player_region,
                },
                "rankings": [],
            })

    # -----------------------------------------------------
    # GET ALL RELEVANT PLAYER STATS
    # -----------------------------------------------------

    query = (
        db.session.query(
            PlayerGameStats,
            User,
        )
        .join(
            User,
            PlayerGameStats.user_id == User.id,
        )
    )

    if game:
        query = query.filter(
            PlayerGameStats.game_id == game.id
        )

    rows = query.all()

    # -----------------------------------------------------
    # BUILD RANKING
    # -----------------------------------------------------

    result = []

    for stats, row_user in rows:

        row_region = get_player_region(row_user)

        if region_filter:
            if row_region.lower() != region_filter.lower():
                continue

        result.append({
            "playerId": row_user.id,
            "gameId": stats.game_id,
            "points": stats.synco_points,
        })

    result.sort(
        key=lambda item: item["points"],
        reverse=True,
    )

    # -----------------------------------------------------
    # FIND CURRENT USER
    # -----------------------------------------------------

    my_rows = []

    for index, item in enumerate(
        result,
        start=1,
    ):

        if item["playerId"] != user.id:
            continue

        my_rows.append({
            "rank": index,
            "gameId": item["gameId"],
            "syncoPoints": item["points"],
        })

    return jsonify({
        "success": True,

        "player": {
            "id": user.id,
            "uid": user.uid,
            "username": user.username or user.name,
            "name": user.name,
            "avatar": normalize_avatar(user),
            "region": player_region,
        },

        "rankings": my_rows,
    })


# =========================================================
# CLUB RANKINGS
# =========================================================

@leaderboards_bp.route("/clubs", methods=["GET"])
def club_rankings():

    game = get_game_filter()
    region_filter = request.args.get("region")

    query = (
        Club.query
        .join(
            Game,
            Club.game_id == Game.id,
        )
        .filter(
            Club.is_active.is_(True)
        )
    )

    # -----------------------------------------------------
    # GAME FILTER
    # -----------------------------------------------------

    if game:

        query = query.filter(
            Club.game_id == game.id
        )

    clubs = query.all()

    rankings = []

    for club in clubs:

        club_region = club.region or "Global"

        # -------------------------------------------------
        # REGION FILTER
        # -------------------------------------------------

        if region_filter:

            if club_region.lower() != region_filter.lower():
                continue

        rankings.append({

            "clubId": club.id,

            "name": club.name,

            "tag": club.tag,

            "avatar": club.avatar or "",

            "level": club.level,

            "syncoPoints": club.synco_points,

            "region": club_region,

            "game": (
                {
                    "id": club.game.id,
                    "name": club.game.name,
                    "shortName": club.game.short_name,
                    "slug": club.game.slug,
                    "logoUrl": club.game.logo_url,
                }
                if club.game
                else None
            ),

            "memberCount": len(club.members),
        })

    # -----------------------------------------------------
    # SORT
    # -----------------------------------------------------

    rankings.sort(
        key=lambda item: item["syncoPoints"],
        reverse=True,
    )

    # -----------------------------------------------------
    # ASSIGN RANK
    # -----------------------------------------------------

    for index, club in enumerate(
        rankings,
        start=1,
    ):
        club["rank"] = index

    return jsonify({
        "success": True,
        "count": len(rankings),

        "filters": {
            "game": game.id if game else None,
            "region": region_filter,
        },

        "rankings": rankings,
    })


# =========================================================
# AVAILABLE FILTERS
# =========================================================

@leaderboards_bp.route("/filters", methods=["GET"])
def leaderboard_filters():

    # -----------------------------------------------------
    # GAMES
    # -----------------------------------------------------

    games = (
        Game.query
        .filter(
            Game.is_active.is_(True)
        )
        .order_by(
            Game.name.asc()
        )
        .all()
    )

    # -----------------------------------------------------
    # PLAYER REGIONS
    # -----------------------------------------------------

    player_regions = set()

    profiles = UserProfile.query.all()

    for profile in profiles:

        basic_data = profile.basic_data or {}

        region = (
            basic_data.get("region")
            or basic_data.get("Region")
            or basic_data.get("country")
            or basic_data.get("Country")
        )

        if region:
            player_regions.add(
                str(region).strip()
            )

    # -----------------------------------------------------
    # CLUB REGIONS
    # -----------------------------------------------------

    club_regions = set()

    clubs = (
        Club.query
        .filter(
            Club.is_active.is_(True)
        )
        .all()
    )

    for club in clubs:

        if club.region:

            club_regions.add(
                str(club.region).strip()
            )

    # -----------------------------------------------------
    # COMBINE
    # -----------------------------------------------------

    regions = sorted(
        player_regions.union(club_regions),
        key=lambda value: value.lower(),
    )

    return jsonify({

        "success": True,

        "games": [
            {
                "id": game.id,
                "name": game.name,
                "shortName": game.short_name,
                "slug": game.slug,
                "logoUrl": game.logo_url,
            }
            for game in games
        ],

        "regions": regions,
    })
