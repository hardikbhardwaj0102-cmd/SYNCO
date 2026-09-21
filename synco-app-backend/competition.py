# =========================================================
# SYNCO COMPETITION ENGINE V1
# Compatible with the Competition models previously provided
# =========================================================

from datetime import datetime, timezone
import math
import random
import re

from flask import Blueprint, current_app, jsonify, request, session

from models import (
    db,
    User,
    Game,
    Club,
    ClubMember,

    Competition,
    CompetitionStage,
    CompetitionParticipant,

    CompetitionMatch,
    MatchSide,
    MatchParticipant,

    ScoringRule,
    MatchResult,

    TeamMatchStats,
    PlayerMatchStats,

    CompetitionStanding,

    Bracket,
    BracketNode,

    VerificationRecord,
    CompetitionDispute,
    CompetitionAuditLog,
)


# =========================================================
# BLUEPRINT
# =========================================================

competition_bp = Blueprint(
    "competition",
    __name__,
    url_prefix="/api/competitions"
)


# =========================================================
# CONFIGURATION
# =========================================================

COMPETITION_CONFIG = {

    "bgmi": {
        "game_names": [
            "BGMI",
            "Battlegrounds Mobile India",
        ],

        "modes": {

            "CLASSIC": {
                "type": "CLASSIC",
                "structure": "POINTS",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": 3,
            },

            "VERSUS": {
                "type": "VERSUS",
                "structure": "KNOCKOUT",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": None,
            },
        },
    },

    "pubg": {
        "game_names": [
            "PUBG",
        ],

        "modes": {

            "CLASSIC": {
                "type": "CLASSIC",
                "structure": "POINTS",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": 3,
            },

            "VERSUS": {
                "type": "VERSUS",
                "structure": "KNOCKOUT",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": None,
            },
        },
    },

    "pubg-mobile": {
        "game_names": [
            "PUBG Mobile",
            "PUBG MOBILE",
        ],

        "modes": {

            "CLASSIC": {
                "type": "CLASSIC",
                "structure": "POINTS",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": 3,
            },

            "VERSUS": {
                "type": "VERSUS",
                "structure": "KNOCKOUT",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": None,
            },
        },
    },

    "free-fire": {
        "game_names": [
            "Free Fire",
            "Free Fire MAX",
        ],

        "modes": {

            "CLASSIC": {
                "type": "CLASSIC",
                "structure": "POINTS",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": 3,
            },

            "VERSUS": {
                "type": "VERSUS",
                "structure": "KNOCKOUT",
                "participant_type": "TEAM",
                "team_sizes": [1, 2, 3, 4],
                "default_matches": None,
            },
        },
    },

    "valorant": {
        "game_names": [
            "Valorant",
            "VALORANT",
        ],

        "modes": {

            "ARENA": {
                "type": "VERSUS",
                "structure": "KNOCKOUT",
                "participant_type": "TEAM",
                "team_sizes": [5],
                "default_matches": None,
            },
        },
    },

    "clash-royale": {
        "game_names": [
            "Clash Royale",
        ],

        "modes": {

            "COMPETITIVE": {
                "type": "VERSUS",
                "structure": "KNOCKOUT",
                "team_sizes": [1, 2],
                "default_matches": None,
            },
        },
    },
}


# =========================================================
# DEFAULT CLASSIC SCORING
# =========================================================

DEFAULT_SCORING = {

    "placementPoints": {
        "1": 15,
        "2": 12,
        "3": 10,
        "4": 8,
        "5": 6,
        "6": 5,
        "7": 4,
        "8": 3,
        "9": 2,
        "10": 1,
    },

    "killPoints": 1,

    "bonusPoints": 0,
}


# =========================================================
# STATUS CONSTANTS
# =========================================================

REGISTRATION_STATUSES = {
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "LOCKED",
    "ELIMINATED",
}

MATCH_STATUSES = {
    "SCHEDULED",
    "READY",
    "LIVE",
    "RESULT_PENDING",
    "VERIFICATION",
    "VERIFIED",
    "DISPUTED",
    "CANCELLED",
}

COMPETITION_STATUSES = {
    "DRAFT",
    "REGISTRATION_OPEN",
    "REGISTRATION_CLOSED",
    "READY",
    "LIVE",
    "RESULTS_PENDING",
    "DISPUTED",
    "COMPLETED",
    "CANCELLED",
}


# =========================================================
# BASIC HELPERS
# =========================================================

def current_user():

    user_id = session.get("user_id")

    # Compatibility with the current SYNCO auth session, which stores
    # the authenticated user under session["user"].
    if not user_id:
        session_user = session.get("user") or {}
        user_id = session_user.get("id")

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id
    )


def organizer_account_required():
    """
    Verify that the currently authenticated database user is an
    approved and active SYNCO organizer.

    This check is intentionally performed against the User row instead
    of trusting any frontend value or request payload.
    """

    user = current_user()

    if not user:
        return None, (
            jsonify({
                "success": False,
                "message": "Authentication required."
            }),
            401
        )

    account_role = str(
        getattr(user, "account_role", "player") or "player"
    ).strip().lower()

    if account_role != "organizer":
        return None, (
            jsonify({
                "success": False,
                "message": "Organizer access required to create a competition.",
                "redirect": "/organizer/register"
            }),
            403
        )

    # Newer SYNCO user records may also expose account_status.  The
    # getattr fallback keeps this backend compatible with older records
    # while still blocking explicitly suspended/disabled accounts.
    account_status = str(
        getattr(user, "account_status", "active") or "active"
    ).strip().lower()

    if account_status != "active":
        return None, (
            jsonify({
                "success": False,
                "message": "Your organizer account is not active and cannot create a competition.",
                "redirect": "/organizer/register",
                "accountStatus": account_status
            }),
            403
        )

    return user, None


def parse_datetime(value):

    if not value:
        return None

    if isinstance(value, datetime):
        return value

    value = str(value).strip()

    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except ValueError:
        return None


def utc_now():

    return datetime.now(timezone.utc)


def as_utc(value):

    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def sync_registration_status(competition):
    """Open a DRAFT competition when its registration window is active."""

    if not competition or competition.status != "DRAFT":
        return False

    now = utc_now()
    registration_start = as_utc(competition.registration_start)
    registration_end = as_utc(competition.registration_end)

    if registration_start and now < registration_start:
        return False

    if registration_end and now > registration_end:
        return False

    competition.status = "REGISTRATION_OPEN"
    competition.is_published = True
    return True

def slugify(value):

    value = str(value or "").strip().lower()

    value = re.sub(
        r"[^a-z0-9]+",
        "-",
        value
    )

    value = re.sub(
        r"-+",
        "-",
        value
    )

    return value.strip("-")


def unique_slug(title):

    base = slugify(title) or "competition"

    slug = base
    counter = 2

    while Competition.query.filter_by(
        slug=slug
    ).first():

        slug = f"{base}-{counter}"
        counter += 1

    return slug


def get_game(game_id):

    return db.session.get(
        Game,
        game_id
    )


def normalize_game_slug(game):

    if not game:
        return None

    name = str(
        getattr(game, "name", "") or ""
    ).strip().lower()

    aliases = {

        "bgmi": "bgmi",

        "battlegrounds mobile india": "bgmi",

        "pubg": "pubg",

        "pubg mobile": "pubg-mobile",

        "pubg mobile india": "pubg-mobile",

        "free fire": "free-fire",

        "free fire max": "free-fire",

        "valorant": "valorant",

        "clash royale": "clash-royale",
    }

    return aliases.get(
        name,
        slugify(name)
    )


def get_game_configuration(game):
    slug = normalize_game_slug(game)

    if not slug:
        return None

    return COMPETITION_CONFIG.get(slug)


def serialize_registration_club(club, registration=None):
    members = (
        ClubMember.query
        .filter_by(club_id=club.id)
        .order_by(ClubMember.joined_at.asc(), ClubMember.id.asc())
        .all()
    )

    member_rows = []
    for membership in members:
        user = membership.user
        if not user:
            continue
        member_rows.append({
            "id": user.id,
            "uid": getattr(user, "uid", None),
            "name": getattr(user, "name", None) or getattr(user, "username", None) or f"Player {user.id}",
            "username": getattr(user, "username", None),
            "avatar": getattr(user, "avatar", None),
            "role": getattr(membership, "role", None),
        })

    return {
        "id": club.id,
        "name": getattr(club, "name", None) or f"Club {club.id}",
        "tag": getattr(club, "tag", None),
        "logo": getattr(club, "logo", None),
        "gameId": getattr(club, "game_id", None),
        "memberCount": len(member_rows),
        "members": member_rows,
        "registration": serialize_participant(registration) if registration else None,
    }


def get_main_stage(competition):

    return (
        CompetitionStage.query
        .filter_by(
            competition_id=competition.id,
            stage_order=1
        )
        .first()
    )


def organizer_required(competition):

    user = current_user()

    if not user:
        return None, (
            jsonify({
                "success": False,
                "message": "Authentication required."
            }),
            401
        )

    if competition.organizer_id != user.id:
        return None, (
            jsonify({
                "success": False,
                "message": "Organizer access required."
            }),
            403
        )

    return user, None


# =========================================================
# AUDIT
# =========================================================

def create_audit_log(
    competition_id,
    actor_id,
    action,
    match_id=None,
    metadata=None
):

    log = CompetitionAuditLog(

        competition_id=competition_id,

        match_id=match_id,

        actor_id=actor_id,

        action=action,

        description=action,

        audit_metadata=metadata or {},
    )

    db.session.add(log)

    return log


# =========================================================
# SERIALIZERS
# =========================================================

def serialize_user(user):

    if not user:
        return None

    return {
        "id": user.id,
        "name": getattr(user, "name", None),
        "username": getattr(user, "username", None),
        "avatar": getattr(user, "avatar", None),
    }


def serialize_game(game):

    if not game:
        return None

    return {
        "id": game.id,
        "name": game.name,
        "slug": normalize_game_slug(game),
        "logoUrl": getattr(
            game,
            "logo_url",
            None
        ),
    }


def serialize_club(club):

    if not club:
        return None

    return {
        "id": club.id,
        "name": getattr(
            club,
            "name",
            None
        ),
        "logo": getattr(
            club,
            "logo",
            None
        ),
        "ownerId": getattr(
            club,
            "owner_id",
            None
        ),
        "gameId": getattr(
            club,
            "game_id",
            None
        ),
    }


def serialize_participant(participant):

    user = getattr(
        participant,
        "user",
        None
    )

    club = getattr(
        participant,
        "club",
        None
    )

    return {

        "id": participant.id,

        "competitionId": (
            participant.competition_id
        ),

        "participantType": (
            participant.participant_type
        ),

        "user": serialize_user(user),

        "club": serialize_club(club),

        "userId": getattr(
            participant,
            "user_id",
            None
        ),

        "clubId": getattr(
            participant,
            "club_id",
            None
        ),

        "seed": participant.seed,

        "registrationStatus": (
            participant.registration_status
        ),

        "registeredAt": (
            participant.registered_at.isoformat()
            if participant.registered_at
            else None
        ),

        "acceptedAt": (
            participant.accepted_at.isoformat()
            if participant.accepted_at
            else None
        ),

        "eliminatedAt": (
            participant.eliminated_at.isoformat()
            if participant.eliminated_at
            else None
        ),
    }


def serialize_match_participant(mp):

    participant = getattr(
        mp,
        "competition_participant",
        None
    )

    if participant is None:
        participant = getattr(
            mp,
            "participant",
            None
        )

    side = getattr(
        mp,
        "side",
        None
    )

    return {

        "id": mp.id,

        "matchId": mp.match_id,

        "sideId": mp.side_id,

        "competitionParticipantId": (
            mp.competition_participant_id
        ),

        "sideNumber": (
            getattr(side, "side_number", None)
            if side
            else None
        ),

        "participant": (
            serialize_participant(participant)
            if participant
            else None
        ),
    }


def serialize_side(side):

    return {

        "id": side.id,

        "matchId": side.match_id,

        "sideNumber": side.side_number,

        "label": side.label,

        "sourceNodeId": side.source_node_id,

        "sourceResult": side.source_result,

        "status": side.status,

        "participants": [
            serialize_match_participant(item)
            for item in side.participants
        ],
    }


def serialize_result(result):

    if not result:
        return None

    return {

        "id": result.id,

        "matchId": result.match_id,

        "submittedBy": result.submitted_by,

        "winningSideId": result.winning_side_id,

        "status": result.status,

        "rawResult": result.raw_result or {},

        "submittedAt": (
            result.submitted_at.isoformat()
            if result.submitted_at
            else None
        ),

        "verifiedAt": (
            result.verified_at.isoformat()
            if result.verified_at
            else None
        ),

        "verifiedBy": result.verified_by,

        "notes": result.notes,
    }


def serialize_match(match):

    return {

        "id": match.id,

        "competitionId": match.competition_id,

        "stageId": match.stage_id,

        "matchNumber": match.match_number,

        "roundName": match.round_name,

        "roundNumber": match.round_number,

        "scheduledAt": (
            match.scheduled_at.isoformat()
            if match.scheduled_at
            else None
        ),

        "startedAt": (
            match.started_at.isoformat()
            if match.started_at
            else None
        ),

        "completedAt": (
            match.completed_at.isoformat()
            if match.completed_at
            else None
        ),

        "status": match.status,

        "metadata": match.match_metadata or {},

        "sides": [
            serialize_side(side)
            for side in match.sides
        ],

        "result": serialize_result(
            match.result
            if hasattr(match, "result")
            else None
        ),
    }


def serialize_standing(standing):

    participant = getattr(
        standing,
        "competition_participant",
        None
    )

    if participant is None:
        participant = getattr(
            standing,
            "participant",
            None
        )

    return {

        "id": standing.id,

        "competitionId": (
            standing.competition_id
        ),

        "stageId": standing.stage_id,

        "participantId": (
            standing.competition_participant_id
        ),

        "rank": standing.rank,

        "matchesPlayed": (
            standing.matches_played
        ),

        "wins": standing.wins,

        "losses": standing.losses,

        "placementPoints": float(
            standing.placement_points or 0
        ),

        "killPoints": float(
            standing.kill_points or 0
        ),

        "bonusPoints": float(
            standing.bonus_points or 0
        ),

        "totalPoints": float(
            standing.total_points or 0
        ),

        "bestMatchScore": float(
            standing.best_match_score or 0
        ),

        "totalKills": (
            standing.total_kills or 0
        ),

        "participant": (
            serialize_participant(participant)
            if participant
            else None
        ),
    }


def serialize_bracket_node(node):

    return {

        "id": node.id,

        "bracketId": node.bracket_id,

        "stageId": node.stage_id,

        "matchId": node.match_id,

        "nodeOrder": node.node_order,

        "roundNumber": node.round_number,

        "roundName": node.round_name,

        "matchNumber": node.match_number,

        "sideAParticipantId": (
            node.side_a_participant_id
        ),

        "sideBParticipantId": (
            node.side_b_participant_id
        ),

        "winnerParticipantId": (
            node.winner_participant_id
        ),

        "winnerDestinationNodeId": (
            node.winner_destination_node_id
        ),

        "isBye": node.is_bye,

        "byeParticipantId": (
            node.bye_participant_id
        ),

        "status": node.status,
    }


def serialize_stage(stage):

    return {

        "id": stage.id,

        "competitionId": (
            stage.competition_id
        ),

        "name": stage.name,

        "stageType": stage.stage_type,

        "stageOrder": stage.stage_order,

        "status": stage.status,

        "configuration": (
            stage.configuration or {}
        ),

        "createdAt": (
            stage.created_at.isoformat()
            if stage.created_at
            else None
        ),
    }


def serialize_competition(
    competition,
    include_children=False
):

    game = get_game(
        competition.game_id
    )

    result = {

        "id": competition.id,

        "title": competition.title,

        "slug": competition.slug,

        "description": (
            competition.description
        ),

        "organizerId": (
            competition.organizer_id
        ),

        "gameId": competition.game_id,

        "game": serialize_game(game),

        "competitionType": (
            competition.competition_type
        ),

        "gameMode": (
            competition.game_mode
        ),

        "participantType": (
            competition.participant_type
        ),

        "teamSize": competition.team_size,

        "maxParticipants": (
            competition.max_participants
        ),

        "maxTeams": (
            competition.max_participants
        ),

        "numberOfMatches": (
            competition.number_of_matches
        ),

        "structure": competition.structure,

        "status": competition.status,

        "configuration": (
            competition.configuration or {}
        ),

        "competitionRules": (
            competition.competition_rules
        ),

        "matchRules": (
            competition.match_rules
        ),

        "eligibilityRules": (
            competition.eligibility_rules
        ),

        "isPublished": (
            competition.is_published
        ),

        "registrationStart": (
            competition.registration_start.isoformat()
            if competition.registration_start
            else None
        ),

        "registrationEnd": (
            competition.registration_end.isoformat()
            if competition.registration_end
            else None
        ),

        "competitionStart": (
            competition.competition_start.isoformat()
            if competition.competition_start
            else None
        ),

        "competitionEnd": (
            competition.competition_end.isoformat()
            if competition.competition_end
            else None
        ),

        "createdAt": (
            competition.created_at.isoformat()
            if competition.created_at
            else None
        ),

        "updatedAt": (
            competition.updated_at.isoformat()
            if competition.updated_at
            else None
        ),
    }

    if include_children:

        result["stages"] = [
            serialize_stage(stage)
            for stage in competition.stages
        ]

        result["participants"] = [
            serialize_participant(participant)
            for participant
            in competition.participants
        ]

        result["matches"] = [
            serialize_match(match)
            for match in competition.matches
        ]

    return result


# =========================================================
# VALIDATION
# =========================================================

def validate_competition_configuration(
    game,
    mode,
    participant_type,
    team_size,
    max_participants,
    competition_type=None
):

    configuration = get_game_configuration(game)

    if not configuration:

        return (
            False,
            "This game is not supported by "
            "the SYNCO Competition Engine."
        )

    mode = str(
        mode or ""
    ).upper()

    mode_config = configuration.get(
        "modes",
        {}
    ).get(mode)

    if not mode_config:

        return (
            False,
            f"Mode '{mode}' is not supported "
            f"for {game.name}."
        )

    expected_type = mode_config["type"]

    if competition_type:

        if (
            str(
                competition_type
            ).upper()
            != expected_type
        ):

            return (
                False,
                "Competition type does not match "
                "the selected game mode."
            )

    participant_type = str(
        participant_type or ""
    ).upper()

    if participant_type not in (
        "PLAYER",
        "TEAM"
    ):

        return (
            False,
            "participantType must be PLAYER or TEAM."
        )

    expected_participant_type = mode_config.get(
        "participant_type"
    )

    if expected_participant_type:

        if participant_type != expected_participant_type:

            return (
                False,
                f"This mode requires "
                f"{expected_participant_type} participants."
            )

    try:

        team_size = int(team_size)

        max_participants = int(
            max_participants
        )

    except (
        TypeError,
        ValueError
    ):

        return (
            False,
            "teamSize and maxTeams "
            "must be integers."
        )

    if team_size not in mode_config["team_sizes"]:

        return (
            False,
            f"{game.name} {mode} does not support "
            f"{team_size}v{team_size}."
        )

    if max_participants < 2:

        return (
            False,
            "At least 2 participants are required."
        )

    if max_participants > 25:

        return (
            False,
            "A competition can have a maximum of "
            "25 teams/participants."
        )

    if expected_type == "VERSUS":

        # Single-elimination accepts any field size from 2-25.
        # The bracket generator expands the field to the next
        # power of two and distributes unused slots as byes.
        if max_participants > 25:
            return (
                False,
                "Versus competitions support up to 25 participants."
            )

    return True, mode_config


# =========================================================
# CONFIG API
# =========================================================

@competition_bp.route(
    "/config",
    methods=["GET"]
)
def get_competition_config():

    return jsonify({

        "success": True,

        "games": COMPETITION_CONFIG,

        "defaultScoring": DEFAULT_SCORING,
    })


# =========================================================
# AVAILABLE GAMES
# =========================================================

@competition_bp.route(
    "/games",
    methods=["GET"]
)
def get_competition_games():

    games = (
        Game.query
        .filter_by(
            is_active=True
        )
        .all()
    )

    result = []

    for game in games:

        configuration = (
            get_game_configuration(game)
        )

        if not configuration:
            continue

        result.append({

            "id": game.id,

            "name": game.name,

            "slug": normalize_game_slug(
                game
            ),

            "logoUrl": getattr(
                game,
                "logo_url",
                None
            ),

            "modes": configuration[
                "modes"
            ],
        })

    return jsonify({

        "success": True,

        "games": result,
    })


# =========================================================
# CREATE COMPETITION
# =========================================================

@competition_bp.route(
    "",
    methods=["POST"]
)
def create_competition():

    # -----------------------------------------------------
    # PLATFORM-LEVEL ORGANIZER AUTHORIZATION
    # -----------------------------------------------------
    # This is the security boundary for tournament creation.
    # Never rely on React route protection or a client-supplied
    # organizerId. The database-backed User.account_role is checked
    # before any competition data is processed or persisted.
    creation_step = "organizer authorization"

    try:

        user, authorization_error = organizer_account_required()

        if authorization_error:
            return authorization_error

        creation_step = "read request"

        data = request.get_json(
            silent=True
        ) or {}

        title = str(
            data.get(
                "title",
                data.get("name", "")
            )
        ).strip()

        if not title:

            return jsonify({
                "success": False,
                "message": "Competition title is required."
            }), 400

        game_id = data.get(
            "gameId",
            data.get("game_id")
        )

        if not game_id:

            return jsonify({
                "success": False,
                "message": "gameId is required."
            }), 400

        creation_step = "load game"

        game = get_game(game_id)

        if not game:

            return jsonify({
                "success": False,
                "message": "Game not found."
            }), 404

        competition_type = str(
            data.get(
                "competitionType",
                ""
            )
        ).upper()

        game_mode = str(
            data.get(
                "gameMode",
                ""
            )
        ).upper()

        participant_type = str(
            data.get(
                "participantType",
                "TEAM"
            )
        ).upper()

        try:

            team_size = int(
                data.get(
                    "teamSize",
                    1
                )
            )

            max_participants = int(
                data.get(
                    "maxTeams",
                    data.get(
                        "maxParticipants",
                        16
                    )
                )
            )

        except (
            TypeError,
            ValueError
        ):

            return jsonify({
                "success": False,
                "message": (
                    "teamSize and maxParticipants "
                    "must be integers."
                )
            }), 400

        # -----------------------------------------------------
        # Clash Royale
        # -----------------------------------------------------

        if normalize_game_slug(game) == "clash-royale":

            if team_size == 1:
                participant_type = "PLAYER"

            elif team_size == 2:
                participant_type = "TEAM"

        creation_step = "validate competition configuration"

        valid, mode_config = (
            validate_competition_configuration(
                game=game,
                mode=game_mode,
                participant_type=participant_type,
                team_size=team_size,
                max_participants=max_participants,
                competition_type=competition_type,
            )
        )

        if not valid:

            return jsonify({
                "success": False,
                "message": mode_config
            }), 400

        number_of_matches = data.get(
            "numberOfMatches"
        )

        if number_of_matches is None:

            number_of_matches = (
                mode_config["default_matches"]
            )

        if number_of_matches is None:
            number_of_matches = 1

        try:

            number_of_matches = int(
                number_of_matches
            )

        except (
            TypeError,
            ValueError
        ):

            return jsonify({
                "success": False,
                "message": (
                    "numberOfMatches must be an integer."
                )
            }), 400

        if competition_type == "CLASSIC":

            if number_of_matches < 1:

                return jsonify({
                    "success": False,
                    "message": (
                        "Classic competitions need "
                        "at least one match."
                    )
                }), 400

        else:

            number_of_matches = 1

        configuration = data.get(
            "configuration",
            {}
        )

        if not isinstance(
            configuration,
            dict
        ):

            configuration = {}

        competition_rules = data.get(
            "competitionRules"
        )

        match_rules = data.get(
            "matchRules"
        )

        eligibility_rules = data.get(
            "eligibilityRules"
        )

        creation_step = "build competition"

        competition = Competition(

            title=title,

            slug=unique_slug(title),

            description=data.get(
                "description"
            ),

            organizer_id=user.id,

            game_id=game.id,

            competition_type=competition_type,

            game_mode=game_mode,

            participant_type=participant_type,

            team_size=team_size,

            max_participants=max_participants,

            number_of_matches=number_of_matches,

            structure=mode_config["structure"],

            configuration=configuration,

            competition_rules=competition_rules,

            match_rules=match_rules,

            eligibility_rules=eligibility_rules,

            status="DRAFT",

            is_published=False,

            registration_start=parse_datetime(
                data.get("registrationStart")
            ),

            registration_end=parse_datetime(
                data.get("registrationEnd")
            ),

            competition_start=parse_datetime(
                data.get("competitionStart")
            ),

            competition_end=parse_datetime(
                data.get("competitionEnd")
            ),
        )

        db.session.add(competition)

        creation_step = "flush competition"
        db.session.flush()

        stage = CompetitionStage(

            competition_id=competition.id,

            name="Main Stage",

            stage_type="MAIN",

            stage_order=1,

            status="PENDING",

            configuration={
                "structure": mode_config[
                    "structure"
                ],

                "competitionType": competition_type,

                "gameMode": game_mode,
            },
        )

        db.session.add(stage)

        creation_step = "flush main stage"
        db.session.flush()

        if competition_type == "CLASSIC":

            scoring_config = (
                configuration.get(
                    "scoring",
                    DEFAULT_SCORING
                )
            )

            scoring_rule = ScoringRule(

                competition_id=competition.id,

                rule_type="POINTS",

                name="Classic Scoring",

                points=0,

                configuration=scoring_config,
            )

            db.session.add(
                scoring_rule
            )

            creation_step = "flush scoring rule"
            db.session.flush()

        auto_opened = sync_registration_status(competition)

        creation_step = "create audit log"

        create_audit_log(

            competition.id,

            user.id,

            "COMPETITION_CREATED",

            metadata={
                "title": title,
                "gameId": game.id,
                "competitionType": competition_type,
                "gameMode": game_mode,
            },
        )

        if auto_opened:
            create_audit_log(
                competition.id,
                user.id,
                "REGISTRATION_OPENED",
                metadata={
                    "source": "AUTOMATIC_REGISTRATION_WINDOW"
                },
            )

        creation_step = "commit competition"
        db.session.commit()

        creation_step = "serialize response"

        return jsonify({

            "success": True,

            "message": "Competition created.",

            "competition": serialize_competition(
                competition,
                include_children=True
            ),
        }), 201

    except Exception as exc:

        db.session.rollback()

        current_app.logger.exception(
            "Competition creation failed at step: %s",
            creation_step if "creation_step" in locals() else "unknown"
        )

        error_text = str(exc).strip() or exc.__class__.__name__

        return jsonify({
            "success": False,
            "message": "Competition creation failed.",
            "step": creation_step if "creation_step" in locals() else "unknown",
            "error": error_text,
            "errorType": exc.__class__.__name__,
        }), 500


# =========================================================
# COMPETITION BLUEPRINT ERROR HANDLER
# =========================================================

@competition_bp.errorhandler(Exception)
def competition_unhandled_error(exc):

    current_app.logger.exception(
        "Unhandled competition blueprint error"
    )

    return jsonify({
        "success": False,
        "message": "Competition API error.",
        "error": str(exc).strip() or exc.__class__.__name__,
        "errorType": exc.__class__.__name__,
    }), 500


# =========================================================
# GET COMPETITIONS
# =========================================================

@competition_bp.route(
    "",
    methods=["GET"]
)
def get_competitions():

    query = Competition.query

    status = request.args.get(
        "status"
    )

    game_id = request.args.get(
        "gameId"
    )

    competition_type = request.args.get(
        "competitionType"
    )

    if status:

        query = query.filter_by(
            status=status.upper()
        )

    if game_id:

        query = query.filter_by(
            game_id=game_id
        )

    if competition_type:

        query = query.filter_by(
            competition_type=(
                competition_type.upper()
            )
        )

    competitions = (
        query
        .order_by(
            Competition.created_at.desc()
        )
        .all()
    )

    status_changed = False
    for competition in competitions:
        status_changed = sync_registration_status(competition) or status_changed

    if status_changed:
        db.session.commit()

    return jsonify({

        "success": True,

        "competitions": [
            serialize_competition(
                competition
            )
            for competition in competitions
        ],
    })


# =========================================================
# GET SINGLE COMPETITION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>",
    methods=["GET"]
)
def get_competition(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    if sync_registration_status(competition):
        db.session.commit()

    return jsonify({

        "success": True,

        "competition": serialize_competition(
            competition,
            include_children=True
        ),
    })


# =========================================================
# OPEN REGISTRATION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/open-registration",
    methods=["POST"]
)
def open_registration(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if competition.status != "DRAFT":

        return jsonify({
            "success": False,
            "message": (
                "Only draft competitions "
                "can open registration."
            )
        }), 400

    competition.status = (
        "REGISTRATION_OPEN"
    )

    competition.is_published = True

    if not competition.registration_start:

        competition.registration_start = (
            datetime.utcnow()
        )

    create_audit_log(
        competition.id,
        user.id,
        "REGISTRATION_OPENED"
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Registration opened.",

        "competition": serialize_competition(
            competition
        ),
    })


# =========================================================
# CLOSE REGISTRATION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/close-registration",
    methods=["POST"]
)
def close_registration(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if competition.status != (
        "REGISTRATION_OPEN"
    ):

        return jsonify({
            "success": False,
            "message": "Registration is not open."
        }), 400

    accepted_count = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            registration_status="ACCEPTED"
        )
        .count()
    )

    if accepted_count < 2:

        return jsonify({
            "success": False,
            "message": (
                "At least 2 accepted "
                "participants are required."
            )
        }), 400

    competition.status = "REGISTRATION_CLOSED"
    competition.registration_end = datetime.utcnow()

    accepted_participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            registration_status="ACCEPTED"
        )
        .order_by(CompetitionParticipant.registered_at.asc(), CompetitionParticipant.id.asc())
        .all()
    )

    if len(accepted_participants) < 2:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "At least 2 accepted participants are required to prepare the tournament."
        }), 400

    accepted_participants = accepted_participants[:competition.max_participants]

    for index, participant in enumerate(accepted_participants, start=1):
        participant.seed = index
        participant.registration_status = "LOCKED"

    stage = get_main_stage(competition)
    if not stage:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Main stage not found."
        }), 500

    existing_count = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .count()
    )

    generated_matches = []

    if not existing_count:
        if competition.competition_type == "CLASSIC":
            generated_matches = generate_classic_matches(
                competition,
                stage,
                accepted_participants,
            )
        else:
            generate_versus_bracket(
                competition,
                stage,
                accepted_participants,
            )
            generated_matches = (
                CompetitionMatch.query
                .filter_by(competition_id=competition.id)
                .order_by(
                    CompetitionMatch.round_number.asc(),
                    CompetitionMatch.match_number.asc(),
                )
                .all()
            )

    stage.status = "READY"
    competition.status = "READY"

    create_audit_log(
        competition.id,
        user.id,
        "REGISTRATION_CLOSED",
        metadata={
            "acceptedCount": len(accepted_participants),
        },
    )

    create_audit_log(
        competition.id,
        user.id,
        "PARTICIPANTS_LOCKED",
        metadata={
            "participantCount": len(accepted_participants),
        },
    )

    if not existing_count:
        create_audit_log(
            competition.id,
            user.id,
            "MATCHES_GENERATED",
            metadata={
                "matchCount": len(generated_matches),
            },
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Registration closed and tournament prepared.",
        "participantCount": len(accepted_participants),
        "matchCount": len(generated_matches) if not existing_count else existing_count,
        "matchesGenerated": not bool(existing_count),
        "competition": serialize_competition(competition, include_children=True),
    })


# =========================================================
# REGISTRATION INFO
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration-info",
    methods=["GET"]
)
def get_registration_info(competition_id):

    user = current_user()

    if not user:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    competition = db.session.get(Competition, competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    if sync_registration_status(competition):
        db.session.commit()

    game = get_game(competition.game_id)
    game_config = get_game_configuration(game) or {}
    mode_config = (game_config.get("modes") or {}).get(
        str(competition.game_mode or "").upper(),
        {}
    )

    registered_count = (
        CompetitionParticipant.query
        .filter_by(competition_id=competition.id)
        .filter(
            CompetitionParticipant.registration_status.notin_(["REJECTED"])
        )
        .count()
    )

    capacity = int(competition.max_participants or 0)
    registration_open = competition.status == "REGISTRATION_OPEN"
    full = capacity > 0 and registered_count >= capacity

    payload = {
        "success": True,
        "registrationOpen": registration_open,
        "full": full,
        "registeredCount": registered_count,
        "capacity": capacity,
        "competition": serialize_competition(competition, include_children=False),
        "modeConfig": mode_config,
        "defaultScoring": DEFAULT_SCORING,
        "myRegistration": None,
        "myClubs": [],
    }

    if str(competition.participant_type or "").upper() == "PLAYER":
        payload["myRegistration"] = serialize_participant(
            CompetitionParticipant.query
            .filter_by(
                competition_id=competition.id,
                user_id=user.id,
            )
            .first()
        ) if CompetitionParticipant.query.filter_by(
            competition_id=competition.id,
            user_id=user.id,
        ).first() else None

        return jsonify(payload)

    # TEAM competition: expose only clubs owned by the logged-in user.
    owned_clubs = (
        Club.query
        .filter_by(owner_id=user.id)
        .order_by(Club.name.asc(), Club.id.asc())
        .all()
    )

    for club in owned_clubs:
        if getattr(club, "game_id", None) not in (None, competition.game_id):
            continue

        registration = (
            CompetitionParticipant.query
            .filter_by(
                competition_id=competition.id,
                club_id=club.id,
            )
            .first()
        )

        payload["myClubs"].append(
            serialize_registration_club(
                club,
                registration=registration,
            )
        )

    return jsonify(payload)


# =========================================================
# REGISTER PLAYER
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/register/player",
    methods=["POST"]
)
def register_player(
    competition_id
):

    user = current_user()

    if not user:

        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    if sync_registration_status(competition):
        db.session.commit()

    if competition.status != (
        "REGISTRATION_OPEN"
    ):

        return jsonify({
            "success": False,
            "message": "Registration is not open."
        }), 400

    if competition.participant_type != "PLAYER":

        return jsonify({
            "success": False,
            "message": (
                "This competition requires teams."
            )
        }), 400

    count = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id
        )
        .count()
    )

    if count >= competition.max_participants:

        return jsonify({
            "success": False,
            "message": "Competition is full."
        }), 400

    existing = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            user_id=user.id
        )
        .first()
    )

    if existing:

        return jsonify({
            "success": False,
            "message": "You are already registered."
        }), 409

    participant = CompetitionParticipant(

        competition_id=competition.id,

        participant_type="PLAYER",

        user_id=user.id,

        club_id=None,

        registration_status="PENDING",
    )

    db.session.add(participant)

    db.session.flush()

    create_audit_log(

        competition.id,

        user.id,

        "PARTICIPANT_REGISTERED",

        metadata={
            "participantId": participant.id,
            "participantType": "PLAYER",
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Player registered.",

        "participant": serialize_participant(
            participant
        ),
    }), 201


# =========================================================
# REGISTER TEAM / CLUB
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/register/team",
    methods=["POST"]
)
def register_team(
    competition_id
):

    user = current_user()

    if not user:

        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    if sync_registration_status(competition):
        db.session.commit()

    if competition.status != (
        "REGISTRATION_OPEN"
    ):

        return jsonify({
            "success": False,
            "message": "Registration is not open."
        }), 400

    if competition.participant_type != "TEAM":

        return jsonify({
            "success": False,
            "message": (
                "This competition requires players."
            )
        }), 400

    data = request.get_json(
        silent=True
    ) or {}

    club_id = data.get(
        "clubId"
    )

    if not club_id:

        return jsonify({
            "success": False,
            "message": "clubId is required."
        }), 400

    club = db.session.get(
        Club,
        club_id
    )

    if not club:

        return jsonify({
            "success": False,
            "message": "Club not found."
        }), 404

    if club.owner_id != user.id:

        return jsonify({
            "success": False,
            "message": (
                "Only the club owner can "
                "register this club."
            )
        }), 403

    club_game_id = getattr(
        club,
        "game_id",
        None
    )

    if club_game_id and str(
        club_game_id
    ) != str(
        competition.game_id
    ):

        return jsonify({
            "success": False,
            "message": (
                "This club belongs to a "
                "different game."
            )
        }), 400

    team_size = int(competition.team_size or 0)

    member_count = (
        ClubMember.query
        .filter_by(club_id=club.id)
        .count()
    )

    if team_size and member_count != team_size:
        return jsonify({
            "success": False,
            "message": (
                f"This tournament requires exactly {team_size} "
                f"team member{'' if team_size == 1 else 's'}. "
                f"Your club currently has {member_count}."
            ),
            "requiredTeamSize": team_size,
            "memberCount": member_count,
        }), 400

    count = (
        CompetitionParticipant.query
        .filter_by(competition_id=competition.id)
        .filter(
            CompetitionParticipant.registration_status.notin_(["REJECTED"])
        )
        .count()
    )

    if competition.max_participants is not None and count >= int(competition.max_participants):
        return jsonify({
            "success": False,
            "message": "Competition is full."
        }), 400

    existing = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            club_id=club.id
        )
        .first()
    )

    if existing:
        if existing.registration_status == "REJECTED":
            existing.registration_status = "PENDING"
            existing.seed = None
            existing.accepted_at = None
            create_audit_log(
                competition.id,
                user.id,
                "PARTICIPANT_REREGISTERED",
                metadata={
                    "participantId": existing.id,
                    "participantType": "TEAM",
                    "clubId": club.id,
                },
            )
            db.session.commit()
            return jsonify({
                "success": True,
                "message": "Team registration submitted again.",
                "participant": serialize_participant(existing),
            }), 201

        return jsonify({
            "success": False,
            "message": f"This club is already registered with status {existing.registration_status}.",
        }), 409

    participant = CompetitionParticipant(

        competition_id=competition.id,

        participant_type="TEAM",

        user_id=None,

        club_id=club.id,

        registration_status="PENDING",
    )

    db.session.add(participant)

    db.session.flush()

    create_audit_log(

        competition.id,

        user.id,

        "PARTICIPANT_REGISTERED",

        metadata={
            "participantId": participant.id,
            "participantType": "TEAM",
            "clubId": club.id,
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Team registered.",

        "participant": serialize_participant(
            participant
        ),
    }), 201


# =========================================================
# GET PARTICIPANTS
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/participants",
    methods=["GET"]
)
def get_participants(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id
        )
        .order_by(
            CompetitionParticipant.seed.asc().nullslast(),
            CompetitionParticipant.registered_at.asc()
        )
        .all()
    )

    return jsonify({

        "success": True,

        "participants": [
            serialize_participant(
                participant
            )
            for participant in participants
        ],
    })


# =========================================================
# ACCEPT PARTICIPANT
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/participants/<int:participant_id>/accept",
    methods=["POST"]
)
def accept_participant(
    competition_id,
    participant_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    participant = (
        CompetitionParticipant.query
        .filter_by(
            id=participant_id,
            competition_id=competition.id
        )
        .first()
    )

    if not participant:

        return jsonify({
            "success": False,
            "message": "Participant not found."
        }), 404

    if participant.registration_status != "PENDING":

        return jsonify({
            "success": False,
            "message": (
                "Only pending participants "
                "can be accepted."
            )
        }), 400

    participant.registration_status = (
        "ACCEPTED"
    )

    participant.accepted_at = (
        datetime.utcnow()
    )

    create_audit_log(

        competition.id,

        user.id,

        "PARTICIPANT_ACCEPTED",

        metadata={
            "participantId": participant.id
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Participant accepted.",

        "participant": serialize_participant(
            participant
        ),
    })


# =========================================================
# REJECT PARTICIPANT
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/participants/<int:participant_id>/reject",
    methods=["POST"]
)
def reject_participant(
    competition_id,
    participant_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    participant = (
        CompetitionParticipant.query
        .filter_by(
            id=participant_id,
            competition_id=competition.id
        )
        .first()
    )

    if not participant:

        return jsonify({
            "success": False,
            "message": "Participant not found."
        }), 404

    participant.registration_status = (
        "REJECTED"
    )

    create_audit_log(

        competition.id,

        user.id,

        "PARTICIPANT_REJECTED",

        metadata={
            "participantId": participant.id
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Participant rejected.",

        "participant": serialize_participant(
            participant
        ),
    })


# =========================================================
# LOCK PARTICIPANTS
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/lock-participants",
    methods=["POST"]
)
def lock_participants(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if competition.status not in (
        "REGISTRATION_CLOSED",
        "READY",
    ):

        return jsonify({
            "success": False,
            "message": (
                "Registration must be closed "
                "before locking participants."
            )
        }), 400

    participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            registration_status="ACCEPTED"
        )
        .order_by(
            CompetitionParticipant.registered_at.asc()
        )
        .all()
    )

    if len(participants) < 2:

        return jsonify({
            "success": False,
            "message": (
                "At least 2 accepted "
                "participants are required."
            )
        }), 400

    participants = participants[
        :competition.max_participants
    ]

    for index, participant in enumerate(
        participants,
        start=1
    ):

        participant.seed = index

        participant.registration_status = (
            "LOCKED"
        )

    competition.status = "READY"

    create_audit_log(

        competition.id,

        user.id,

        "PARTICIPANTS_LOCKED",

        metadata={
            "participantCount": len(
                participants
            )
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Participants locked.",

        "participantCount": len(
            participants
        ),
    })


# =========================================================
# CLASSIC MATCH GENERATOR
# =========================================================

def generate_classic_matches(
    competition,
    stage,
    participants
):

    matches = []

    for match_number in range(
        1,
        competition.number_of_matches + 1
    ):

        match = CompetitionMatch(

            competition_id=competition.id,

            stage_id=stage.id,

            match_number=match_number,

            round_number=1,

            round_name=f"Match {match_number}",

            status="SCHEDULED",

            match_metadata={
                "format": "CLASSIC"
            },
        )

        db.session.add(match)

        db.session.flush()

        side = MatchSide(

            match_id=match.id,

            side_number=1,

            label="Lobby",

            status="READY",
        )

        db.session.add(side)

        db.session.flush()

        for participant in participants:

            db.session.add(
                MatchParticipant(

                    match_id=match.id,

                    side_id=side.id,

                    competition_participant_id=(
                        participant.id
                    ),
                )
            )

        matches.append(match)

    return matches


# =========================================================
# ROUND NAME
# =========================================================

def get_round_name(
    round_number,
    total_rounds
):

    if round_number == total_rounds:
        return "Final"

    if round_number == total_rounds - 1:
        return "Semifinal"

    if round_number == total_rounds - 2:
        return "Quarterfinal"

    size = 2 ** (
        total_rounds - round_number + 1
    )

    return f"Round of {size}"


# =========================================================
# VERSUS BRACKET GENERATOR
# =========================================================

def generate_versus_bracket(
    competition,
    stage,
    participants
):

    participants = list(participants)

    # -----------------------------------------------------
    # Shuffle before seeding
    # -----------------------------------------------------

    random.shuffle(participants)

    for index, participant in enumerate(
        participants,
        start=1
    ):
        participant.seed = index

    participant_count = len(
        participants
    )

    bracket_size = 1

    while bracket_size < participant_count:
        bracket_size *= 2

    total_rounds = int(
        math.log2(bracket_size)
    )

    # -----------------------------------------------------
    # Create bracket
    # -----------------------------------------------------

    bracket = Bracket(

        competition_id=competition.id,

        bracket_type="SINGLE_ELIMINATION",

        participant_count=bracket_size,
    )

    db.session.add(bracket)

    db.session.flush()

    rounds = []

    # -----------------------------------------------------
    # Create match/node structure
    # -----------------------------------------------------

    match_counter = 1
    node_counter = 1

    for round_number in range(
        1,
        total_rounds + 1
    ):

        match_count = (
            bracket_size
            // (2 ** round_number)
        )

        current_round = []

        for match_index in range(
            match_count
        ):

            match = CompetitionMatch(

                competition_id=competition.id,

                stage_id=stage.id,

                match_number=match_counter,

                round_number=round_number,

                round_name=get_round_name(
                    round_number,
                    total_rounds
                ),

                status="SCHEDULED",

                match_metadata={
                    "format": "VERSUS"
                },
            )

            db.session.add(match)

            db.session.flush()

            node = BracketNode(

                bracket_id=bracket.id,

                stage_id=stage.id,

                match_id=match.id,

                node_order=node_counter,

                round_number=round_number,

                round_name=get_round_name(
                    round_number,
                    total_rounds
                ),

                match_number=match_counter,

                status="PENDING",
            )

            db.session.add(node)

            db.session.flush()

            current_round.append(node)

            match_counter += 1
            node_counter += 1

        rounds.append(
            current_round
        )

    # -----------------------------------------------------
    # Wire winner destinations
    # -----------------------------------------------------

    for round_index in range(
        0,
        len(rounds) - 1
    ):

        current_round = rounds[
            round_index
        ]

        next_round = rounds[
            round_index + 1
        ]

        for index, node in enumerate(
            current_round
        ):

            destination = next_round[
                index // 2
            ]

            node.winner_destination_node_id = (
                destination.id
            )

    db.session.flush()

    # -----------------------------------------------------
    # Populate first round
    # -----------------------------------------------------

    first_round = rounds[0]

    participant_index = 0

    for node in first_round:

        match = db.session.get(
            CompetitionMatch,
            node.match_id
        )

        first = None
        second = None

        if participant_index < participant_count:

            first = participants[
                participant_index
            ]

            participant_index += 1

        if participant_index < participant_count:

            second = participants[
                participant_index
            ]

            participant_index += 1

        # -------------------------------------------------
        # Side A
        # -------------------------------------------------

        side_a = MatchSide(

            match_id=match.id,

            side_number=1,

            label="A",

            status="READY",
        )

        db.session.add(side_a)

        db.session.flush()

        if first:

            db.session.add(
                MatchParticipant(

                    match_id=match.id,

                    side_id=side_a.id,

                    competition_participant_id=(
                        first.id
                    ),
                )
            )

            node.side_a_participant_id = (
                first.id
            )

        # -------------------------------------------------
        # Side B
        # -------------------------------------------------

        side_b = MatchSide(

            match_id=match.id,

            side_number=2,

            label="B",

            status="READY",
        )

        db.session.add(side_b)

        db.session.flush()

        if second:

            db.session.add(
                MatchParticipant(

                    match_id=match.id,

                    side_id=side_b.id,

                    competition_participant_id=(
                        second.id
                    ),
                )
            )

            node.side_b_participant_id = (
                second.id
            )

        # -------------------------------------------------
        # BYE
        # -------------------------------------------------

        if first and not second:

            node.is_bye = True

            node.bye_participant_id = (
                first.id
            )

            node.winner_participant_id = (
                first.id
            )

            node.status = "COMPLETED"

            match.status = "VERIFIED"

        elif first and second:

            node.status = "READY"

            match.status = "READY"

        else:

            node.status = "COMPLETED"

            match.status = "CANCELLED"

    # -----------------------------------------------------
    # Propagate BYEs
    # -----------------------------------------------------

    for node in first_round:

        if not node.is_bye:
            continue

        if not node.winner_participant_id:
            continue

        destination_id = (
            node.winner_destination_node_id
        )

        if not destination_id:
            continue

        destination = db.session.get(
            BracketNode,
            destination_id
        )

        if not destination:
            continue

        winner_id = (
            node.winner_participant_id
        )

        # Determine whether this is A or B.
        current_index = (
            node.node_order
        )

        destination_index = (
            destination.node_order
        )

        if current_index % 2 == 1:

            destination.side_a_participant_id = (
                winner_id
            )

        else:

            destination.side_b_participant_id = (
                winner_id
            )

        match = db.session.get(
            CompetitionMatch,
            destination.match_id
        )

        if match:

            ensure_versus_side_participant(
                match,
                winner_id,
                destination
            )

    db.session.flush()

    return bracket, rounds


# =========================================================
# ENSURE VERSUS SIDE
# =========================================================

def ensure_versus_side_participant(
    match,
    participant_id,
    node
):

    participant = db.session.get(
        CompetitionParticipant,
        participant_id
    )

    if not participant:
        return

    existing = (
        MatchParticipant.query
        .filter_by(
            match_id=match.id,
            competition_participant_id=participant_id
        )
        .first()
    )

    if existing:
        return

    if node.side_a_participant_id == participant_id:
        side_number = 1
        label = "A"
    else:
        side_number = 2
        label = "B"

    side = (
        MatchSide.query
        .filter_by(
            match_id=match.id,
            side_number=side_number
        )
        .first()
    )

    if not side:

        side = MatchSide(

            match_id=match.id,

            side_number=side_number,

            label=label,

            status="READY",
        )

        db.session.add(side)

        db.session.flush()

    db.session.add(
        MatchParticipant(

            match_id=match.id,

            side_id=side.id,

            competition_participant_id=participant_id,
        )
    )


# =========================================================
# GENERATE MATCHES
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/generate-matches",
    methods=["POST"]
)
def generate_matches(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if competition.status not in (
        "READY",
        "REGISTRATION_CLOSED",
    ):

        return jsonify({
            "success": False,
            "message": (
                "Competition must be READY "
                "before matches are generated."
            )
        }), 400

    existing_count = (
        CompetitionMatch.query
        .filter_by(
            competition_id=competition.id
        )
        .count()
    )

    if existing_count:

        return jsonify({
            "success": False,
            "message": (
                "Matches have already "
                "been generated."
            )
        }), 409

    stage = get_main_stage(
        competition
    )

    if not stage:

        return jsonify({
            "success": False,
            "message": "Main stage not found."
        }), 500

    participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            registration_status="LOCKED"
        )
        .order_by(
            CompetitionParticipant.seed.asc()
        )
        .all()
    )

    if len(participants) < 2:

        return jsonify({
            "success": False,
            "message": (
                "At least 2 locked "
                "participants are required."
            )
        }), 400

    if competition.competition_type == "CLASSIC":

        matches = generate_classic_matches(
            competition,
            stage,
            participants
        )

    else:

        bracket, rounds = (
            generate_versus_bracket(
                competition,
                stage,
                participants
            )
        )

        matches = (
            CompetitionMatch.query
            .filter_by(
                competition_id=competition.id
            )
            .order_by(
                CompetitionMatch.round_number.asc(),
                CompetitionMatch.match_number.asc()
            )
            .all()
        )

    stage.status = "READY"

    competition.status = "READY"

    create_audit_log(

        competition.id,

        user.id,

        "MATCHES_GENERATED",

        metadata={
            "matchCount": len(matches)
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Matches generated.",

        "matchCount": len(matches),

        "matches": [
            serialize_match(match)
            for match in matches
        ],
    }), 201


# =========================================================
# GET MATCHES
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/matches",
    methods=["GET"]
)
def get_matches(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    matches = (
        CompetitionMatch.query
        .filter_by(
            competition_id=competition.id
        )
        .order_by(
            CompetitionMatch.round_number.asc(),
            CompetitionMatch.match_number.asc()
        )
        .all()
    )

    return jsonify({

        "success": True,

        "matches": [
            serialize_match(match)
            for match in matches
        ],
    })


# =========================================================
# START COMPETITION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/start",
    methods=["POST"]
)
def start_competition(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    match_count = (
        CompetitionMatch.query
        .filter_by(
            competition_id=competition.id
        )
        .count()
    )

    if match_count == 0:

        return jsonify({
            "success": False,
            "message": (
                "Generate matches before "
                "starting the competition."
            )
        }), 400

    if competition.status not in (
        "READY",
    ):

        return jsonify({
            "success": False,
            "message": (
                "Competition must be READY "
                "before starting."
            )
        }), 400

    competition.status = "LIVE"

    competition.competition_start = (
        competition.competition_start
        or datetime.utcnow()
    )

    stage = get_main_stage(
        competition
    )

    if stage:
        stage.status = "LIVE"

    first_matches = (
        CompetitionMatch.query
        .filter_by(
            competition_id=competition.id,
            round_number=1
        )
        .order_by(
            CompetitionMatch.match_number.asc()
        )
        .all()
    )

    for match in first_matches:

        if match.status == "SCHEDULED":

            match.status = "READY"

    create_audit_log(
        competition.id,
        user.id,
        "COMPETITION_STARTED"
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Competition started.",

        "competition": serialize_competition(
            competition
        ),
    })


# =========================================================
# START MATCH
# =========================================================

@competition_bp.route(
    "/matches/<int:match_id>/start",
    methods=["POST"]
)
def start_match(
    match_id
):

    match = db.session.get(
        CompetitionMatch,
        match_id
    )

    if not match:

        return jsonify({
            "success": False,
            "message": "Match not found."
        }), 404

    competition = db.session.get(
        Competition,
        match.competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if competition.status != "LIVE":

        return jsonify({
            "success": False,
            "message": (
                "Competition is not live."
            )
        }), 400

    if match.status != "READY":

        return jsonify({
            "success": False,
            "message": (
                "This match is not ready."
            )
        }), 400

    match.status = "LIVE"

    match.started_at = (
        datetime.utcnow()
    )

    create_audit_log(
        competition.id,
        user.id,
        "MATCH_STARTED",
        match.id
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Match started.",

        "match": serialize_match(
            match
        ),
    })


# =========================================================
# SUBMIT RESULT
# =========================================================

@competition_bp.route(
    "/matches/<int:match_id>/result",
    methods=["POST"]
)
def submit_match_result(
    match_id
):

    match = db.session.get(
        CompetitionMatch,
        match_id
    )

    if not match:

        return jsonify({
            "success": False,
            "message": "Match not found."
        }), 404

    competition = db.session.get(
        Competition,
        match.competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if match.status not in (
        "LIVE",
        "RESULT_PENDING",
    ):

        return jsonify({
            "success": False,
            "message": (
                "This match is not accepting results."
            )
        }), 400

    data = request.get_json(
        silent=True
    ) or {}

    if competition.competition_type == "CLASSIC":

        return submit_classic_result(
            match,
            competition,
            data,
            user
        )

    return submit_versus_result(
        match,
        competition,
        data,
        user
    )


# =========================================================
# GET OR CREATE MATCH RESULT
# =========================================================

def get_existing_result(match):

    return (
        MatchResult.query
        .filter_by(
            match_id=match.id
        )
        .first()
    )


# =========================================================
# CLASSIC RESULT
# =========================================================

def submit_classic_result(
    match,
    competition,
    data,
    user
):

    results = data.get(
        "participants"
    )

    if not isinstance(
        results,
        list
    ):

        results = data.get(
            "results"
        )

    if not isinstance(
        results,
        list
    ):

        return jsonify({
            "success": False,
            "message": (
                "participants/results must "
                "be an array."
            )
        }), 400

    match_participants = (
        MatchParticipant.query
        .filter_by(
            match_id=match.id
        )
        .all()
    )

    expected_ids = {
        item.competition_participant_id
        for item in match_participants
    }

    received_ids = set()

    result_payload = []

    placements = set()

    scoring_rule = (
        ScoringRule.query
        .filter_by(
            competition_id=competition.id
        )
        .first()
    )

    scoring = (
        scoring_rule.configuration
        if scoring_rule
        else DEFAULT_SCORING
    )

    placement_map = scoring.get(
        "placementPoints",
        DEFAULT_SCORING["placementPoints"]
    )

    kill_point_value = float(
        scoring.get(
            "killPoints",
            1
        )
    )

    bonus_default = float(
        scoring.get(
            "bonusPoints",
            0
        )
    )

    for item in results:

        try:

            participant_id = int(
                item.get(
                    "competitionParticipantId",
                    item.get(
                        "participantId"
                    )
                )
            )

            placement = int(
                item.get(
                    "placement"
                )
            )

            kills = int(
                item.get(
                    "kills",
                    0
                )
            )

        except (
            TypeError,
            ValueError
        ):

            return jsonify({
                "success": False,
                "message": (
                    "Invalid participant result."
                )
            }), 400

        if participant_id not in expected_ids:

            return jsonify({
                "success": False,
                "message": (
                    f"Participant {participant_id} "
                    "is not in this match."
                )
            }), 400

        if participant_id in received_ids:

            return jsonify({
                "success": False,
                "message": (
                    "Duplicate participant result."
                )
            }), 400

        if placement < 1:

            return jsonify({
                "success": False,
                "message": (
                    "Placement must be at least 1."
                )
            }), 400

        if placement in placements:

            return jsonify({
                "success": False,
                "message": (
                    "Placements must be unique."
                )
            }), 400

        if kills < 0:

            return jsonify({
                "success": False,
                "message": (
                    "Kills cannot be negative."
                )
            }), 400

        received_ids.add(
            participant_id
        )

        placements.add(
            placement
        )

        placement_points = float(
            placement_map.get(
                str(placement),
                0
            )
        )

        kill_points = (
            kills * kill_point_value
        )

        bonus_points = float(
            item.get(
                "bonusPoints",
                bonus_default
            )
        )

        total_points = (
            placement_points
            + kill_points
            + bonus_points
        )

        result_payload.append({

            "competitionParticipantId": (
                participant_id
            ),

            "placement": placement,

            "kills": kills,

            "placementPoints": (
                placement_points
            ),

            "killPoints": kill_points,

            "bonusPoints": bonus_points,

            "totalPoints": total_points,
        })

    if received_ids != expected_ids:

        return jsonify({
            "success": False,
            "message": (
                "A result is required "
                "for every participant."
            )
        }), 400

    # -----------------------------------------------------
    # Store stats
    # -----------------------------------------------------

    for item in result_payload:

        participant_id = (
            item[
                "competitionParticipantId"
            ]
        )

        stats = (
            TeamMatchStats.query
            .filter_by(
                match_id=match.id,
                competition_participant_id=(
                    participant_id
                )
            )
            .first()
        )

        if not stats:

            stats = TeamMatchStats(

                match_id=match.id,

                competition_participant_id=(
                    participant_id
                ),
            )

            db.session.add(stats)

        stats.placement = item[
            "placement"
        ]

        stats.kills = item[
            "kills"
        ]

        stats.placement_points = item[
            "placementPoints"
        ]

        stats.kill_points = item[
            "killPoints"
        ]

        stats.bonus_points = item[
            "bonusPoints"
        ]

        stats.total_points = item[
            "totalPoints"
        ]

    # -----------------------------------------------------
    # Result
    # -----------------------------------------------------

    result = get_existing_result(
        match
    )

    if not result:

        result = MatchResult(
            match_id=match.id,
            submitted_by=user.id,
            status="SUBMITTED",
            raw_result={
                "participants": result_payload
            },
            submitted_at=datetime.utcnow(),
        )

        db.session.add(result)

    else:

        result.submitted_by = user.id

        result.status = "SUBMITTED"

        result.raw_result = {
            "participants": result_payload
        }

        result.submitted_at = datetime.utcnow()

    match.status = "RESULT_PENDING"

    create_audit_log(

        competition.id,

        user.id,

        "RESULT_SUBMITTED",

        match.id,

        {
            "type": "CLASSIC"
        },
    )

    db.session.add(
        VerificationRecord(

            match_id=match.id,

            verifier_id=user.id,

            action="SUBMITTED",

            reason="Result submitted for verification.",
        )
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": (
            "Classic result submitted "
            "for verification."
        ),

        "match": serialize_match(
            match
        ),
    })


# =========================================================
# VERSUS RESULT
# =========================================================

def submit_versus_result(
    match,
    competition,
    data,
    user
):

    winning_participant_id = data.get(
        "winnerParticipantId"
    )

    winning_side_id = data.get(
        "winningSideId"
    )

    if not winning_participant_id and not winning_side_id:

        return jsonify({
            "success": False,
            "message": (
                "winnerParticipantId or "
                "winningSideId is required."
            )
        }), 400

    sides = (
        MatchSide.query
        .filter_by(
            match_id=match.id
        )
        .order_by(
            MatchSide.side_number.asc()
        )
        .all()
    )

    if len(sides) != 2:

        return jsonify({
            "success": False,
            "message": (
                "A versus match must "
                "have two sides."
            )
        }), 400

    winner_side = None

    if winning_side_id:

        winner_side = db.session.get(
            MatchSide,
            int(winning_side_id)
        )

        if not winner_side or (
            winner_side.match_id
            != match.id
        ):

            return jsonify({
                "success": False,
                "message": "Invalid winning side."
            }), 400

        side_participants = [
            item.competition_participant_id
            for item in winner_side.participants
        ]

        if not side_participants:

            return jsonify({
                "success": False,
                "message": (
                    "Winning side has no participant."
                )
            }), 400

        winning_participant_id = (
            side_participants[0]
        )

    else:

        try:

            winning_participant_id = int(
                winning_participant_id
            )

        except (
            TypeError,
            ValueError
        ):

            return jsonify({
                "success": False,
                "message": (
                    "Invalid winnerParticipantId."
                )
            }), 400

        for side in sides:

            ids = [
                item.competition_participant_id
                for item in side.participants
            ]

            if winning_participant_id in ids:

                winner_side = side
                break

        if not winner_side:

            return jsonify({
                "success": False,
                "message": (
                    "Winner is not in this match."
                )
            }), 400

    result = get_existing_result(
        match
    )

    if not result:

        result = MatchResult(

            match_id=match.id,

            submitted_by=user.id,

            winning_side_id=winner_side.id,

            status="SUBMITTED",

            raw_result={
                "winnerParticipantId": (
                    winning_participant_id
                ),
                "winningSideId": winner_side.id,
            },

            submitted_at=datetime.utcnow(),
        )

        db.session.add(result)

    else:

        result.submitted_by = user.id

        result.winning_side_id = (
            winner_side.id
        )

        result.status = "SUBMITTED"

        result.raw_result = {
            "winnerParticipantId": (
                winning_participant_id
            ),
            "winningSideId": winner_side.id,
        }

        result.submitted_at = datetime.utcnow()

    match.status = "RESULT_PENDING"

    match.completed_at = (
        datetime.utcnow()
    )

    create_audit_log(

        competition.id,

        user.id,

        "RESULT_SUBMITTED",

        match.id,

        {
            "type": "VERSUS",

            "winnerParticipantId": (
                winning_participant_id
            ),
        },
    )

    db.session.add(
        VerificationRecord(

            match_id=match.id,

            verifier_id=user.id,

            action="SUBMITTED",

            reason="Versus result submitted for verification.",
        )
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": (
            "Versus result submitted "
            "for verification."
        ),

        "match": serialize_match(
            match
        ),
    })


# =========================================================
# VERIFY RESULT
# =========================================================

@competition_bp.route(
    "/matches/<int:match_id>/verify",
    methods=["POST"]
)
def verify_result(
    match_id
):

    match = db.session.get(
        CompetitionMatch,
        match_id
    )

    if not match:

        return jsonify({
            "success": False,
            "message": "Match not found."
        }), 404

    competition = db.session.get(
        Competition,
        match.competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if match.status != "RESULT_PENDING":

        return jsonify({
            "success": False,
            "message": (
                "This match has no pending result."
            )
        }), 400

    result = get_existing_result(
        match
    )

    if not result:

        return jsonify({
            "success": False,
            "message": "No result exists."
        }), 400

    result.status = "VERIFIED"

    result.verified_at = (
        datetime.utcnow()
    )

    result.verified_by = user.id

    match.status = "VERIFIED"

    match.completed_at = (
        match.completed_at
        or datetime.utcnow()
    )

    if competition.competition_type == "CLASSIC":

        update_classic_standings(
            competition
        )

        prepare_next_classic_match(
            competition,
            match
        )

    else:

        advance_verified_versus_match(
            competition,
            match,
            result
        )

    db.session.add(
        VerificationRecord(

            match_id=match.id,

            verifier_id=user.id,

            action="VERIFIED",

            reason="Result verified by organizer.",
        )
    )

    create_audit_log(

        competition.id,

        user.id,

        "RESULT_VERIFIED",

        match.id
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Result verified.",

        "match": serialize_match(
            match
        ),
    })


# =========================================================
# CLASSIC STANDINGS
# =========================================================

def update_classic_standings(
    competition
):

    participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id
        )
        .all()
    )

    stage = get_main_stage(
        competition
    )

    if not stage:
        return

    for participant in participants:

        standing = (
            CompetitionStanding.query
            .filter_by(
                competition_id=competition.id,
                stage_id=stage.id,
                competition_participant_id=(
                    participant.id
                )
            )
            .first()
        )

        if not standing:

            standing = CompetitionStanding(

                competition_id=competition.id,

                stage_id=stage.id,

                competition_participant_id=(
                    participant.id
                ),

                rank=0,

                matches_played=0,

                wins=0,

                losses=0,

                placement_points=0,

                kill_points=0,

                bonus_points=0,

                total_points=0,

                best_match_score=0,

                total_kills=0,
            )

            db.session.add(
                standing
            )

        stats = (
            TeamMatchStats.query
            .join(
                CompetitionMatch,
                CompetitionMatch.id
                == TeamMatchStats.match_id
            )
            .filter(
                CompetitionMatch.competition_id
                == competition.id,

                CompetitionMatch.status
                == "VERIFIED",

                TeamMatchStats.competition_participant_id
                == participant.id
            )
            .all()
        )

        standing.matches_played = len(
            stats
        )

        standing.placement_points = sum(
            float(
                item.placement_points or 0
            )
            for item in stats
        )

        standing.kill_points = sum(
            float(
                item.kill_points or 0
            )
            for item in stats
        )

        standing.bonus_points = sum(
            float(
                item.bonus_points or 0
            )
            for item in stats
        )

        standing.total_points = sum(
            float(
                item.total_points or 0
            )
            for item in stats
        )

        standing.total_kills = sum(
            int(
                item.kills or 0
            )
            for item in stats
        )

        standing.best_match_score = max(
            [
                float(
                    item.total_points or 0
                )
                for item in stats
            ],
            default=0
        )

        standing.wins = sum(
            1
            for item in stats
            if int(item.placement or 0) == 1
        )

        standing.losses = max(
            0,
            standing.matches_played - standing.wins
        )

        standing.updated_at = (
            datetime.utcnow()
        )

    db.session.flush()

    standings = (
        CompetitionStanding.query
        .filter_by(
            competition_id=competition.id,
            stage_id=stage.id
        )
        .all()
    )

    leaderboard_config = (
        competition.configuration or {}
    ).get("leaderboard", {})

    configured_tiebreakers = leaderboard_config.get(
        "tiebreakers",
        [
            "PLACEMENT_POINTS",
            "KILLS",
            "MATCH_WINS",
        ]
    )

    supported_tiebreakers = {
        "PLACEMENT_POINTS": lambda item: float(
            item.placement_points or 0
        ),
        "KILLS": lambda item: int(
            item.total_kills or 0
        ),
        "MATCH_WINS": lambda item: int(
            item.wins or 0
        ),
        "BEST_MATCH_SCORE": lambda item: float(
            item.best_match_score or 0
        ),
    }

    tiebreaker_functions = [
        supported_tiebreakers[item]
        for item in configured_tiebreakers
        if item in supported_tiebreakers
    ]

    # Total points is always the primary key. The organizer's
    # configured tiebreakers are applied only when totals are equal.
    sort_keys = [
        lambda item: float(item.total_points or 0)
    ] + tiebreaker_functions

    standings.sort(
        key=lambda item: tuple(
            key(item) for key in sort_keys
        ),
        reverse=True
    )

    for rank, standing in enumerate(
        standings,
        start=1
    ):

        standing.rank = rank


# =========================================================
# PREPARE NEXT CLASSIC MATCH
# =========================================================

def prepare_next_classic_match(
    competition,
    completed_match
):

    if competition.competition_type != "CLASSIC":
        return

    next_match = (
        CompetitionMatch.query
        .filter(
            CompetitionMatch.competition_id
            == competition.id,

            CompetitionMatch.round_number
            == 1,

            CompetitionMatch.match_number
            == (
                completed_match.match_number + 1
            )
        )
        .first()
    )

    if next_match and (
        next_match.status
        == "SCHEDULED"
    ):

        next_match.status = "READY"


# =========================================================
# GET STANDINGS
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/standings",
    methods=["GET"]
)
def get_standings(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    if competition.competition_type != "CLASSIC":

        return jsonify({

            "success": True,

            "standings": [],

            "message": (
                "Versus competitions use "
                "a knockout bracket."
            ),
        })

    update_classic_standings(
        competition
    )

    db.session.commit()

    stage = get_main_stage(
        competition
    )

    standings = (
        CompetitionStanding.query
        .filter_by(
            competition_id=competition.id,
            stage_id=stage.id
        )
        .order_by(
            CompetitionStanding.rank.asc()
        )
        .all()
    )

    return jsonify({

        "success": True,

        "standings": [
            serialize_standing(
                standing
            )
            for standing in standings
        ],
    })


# =========================================================
# ADVANCE VERSUS WINNER
# =========================================================

def advance_verified_versus_match(
    competition,
    match,
    result
):

    if not result.winning_side_id:
        return

    winning_side = db.session.get(
        MatchSide,
        result.winning_side_id
    )

    if not winning_side:
        return

    winner_match_participant = (
        MatchParticipant.query
        .filter_by(
            side_id=winning_side.id
        )
        .first()
    )

    if not winner_match_participant:
        return

    winner_id = (
        winner_match_participant
        .competition_participant_id
    )

    node = (
        BracketNode.query
        .filter_by(
            match_id=match.id
        )
        .first()
    )

    if not node:
        return

    node.winner_participant_id = (
        winner_id
    )

    node.status = "COMPLETED"

    # -----------------------------------------------------
    # Mark loser eliminated
    # -----------------------------------------------------

    all_match_participants = (
        MatchParticipant.query
        .filter_by(
            match_id=match.id
        )
        .all()
    )

    for item in all_match_participants:

        if (
            item.competition_participant_id
            != winner_id
        ):

            loser = db.session.get(
                CompetitionParticipant,
                item.competition_participant_id
            )

            if loser:

                loser.registration_status = (
                    "ELIMINATED"
                )

                loser.eliminated_at = (
                    datetime.utcnow()
                )

    # -----------------------------------------------------
    # Final
    # -----------------------------------------------------

    if not node.winner_destination_node_id:

        competition.status = (
            "RESULTS_PENDING"
        )

        return

    destination = db.session.get(
        BracketNode,
        node.winner_destination_node_id
    )

    if not destination:
        return

    destination_match = db.session.get(
        CompetitionMatch,
        destination.match_id
    )

    if not destination_match:
        return

    # -----------------------------------------------------
    # Determine destination side
    # -----------------------------------------------------

    if (
        destination.side_a_participant_id
        is None
    ):

        destination.side_a_participant_id = (
            winner_id
        )

        ensure_versus_side_participant(
            destination_match,
            winner_id,
            destination
        )

    elif (
        destination.side_b_participant_id
        is None
    ):

        destination.side_b_participant_id = (
            winner_id
        )

        ensure_versus_side_participant(
            destination_match,
            winner_id,
            destination
        )

    # -----------------------------------------------------
    # Both sides ready
    # -----------------------------------------------------

    if (
        destination.side_a_participant_id
        and
        destination.side_b_participant_id
    ):

        destination.status = "READY"

        destination_match.status = "READY"


# =========================================================
# GET BRACKET
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/bracket",
    methods=["GET"]
)
def get_bracket(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    if competition.competition_type != "VERSUS":

        return jsonify({
            "success": False,
            "message": (
                "Classic competitions do not "
                "have a knockout bracket."
            )
        }), 400

    bracket = (
        Bracket.query
        .filter_by(
            competition_id=competition.id
        )
        .first()
    )

    if not bracket:

        return jsonify({
            "success": True,
            "bracket": None,
            "rounds": []
        })

    nodes = (
        BracketNode.query
        .filter_by(
            bracket_id=bracket.id
        )
        .order_by(
            BracketNode.round_number.asc(),
            BracketNode.node_order.asc()
        )
        .all()
    )

    rounds = {}

    for node in nodes:

        rounds.setdefault(
            node.round_number,
            []
        ).append(
            serialize_bracket_node(node)
        )

    return jsonify({

        "success": True,

        "bracket": {
            "id": bracket.id,
            "competitionId": bracket.competition_id,
            "bracketType": bracket.bracket_type,
            "participantCount": bracket.participant_count,
        },

        "rounds": [
            {
                "roundNumber": round_number,
                "matches": rounds[
                    round_number
                ],
            }
            for round_number
            in sorted(rounds.keys())
        ],
    })


# =========================================================
# DISPUTE
# =========================================================

@competition_bp.route(
    "/matches/<int:match_id>/dispute",
    methods=["POST"]
)
def dispute_result(
    match_id
):

    user = current_user()

    if not user:

        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    match = db.session.get(
        CompetitionMatch,
        match_id
    )

    if not match:

        return jsonify({
            "success": False,
            "message": "Match not found."
        }), 404

    competition = db.session.get(
        Competition,
        match.competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    reason = str(
        data.get(
            "reason",
            ""
        )
    ).strip()

    if not reason:

        return jsonify({
            "success": False,
            "message": "Dispute reason is required."
        }), 400

    dispute = CompetitionDispute(

        competition_id=competition.id,

        match_id=match.id,

        raised_by=user.id,

        reason=reason,

        status="OPEN",
    )

    db.session.add(dispute)

    match.status = "DISPUTED"

    competition.status = "DISPUTED"

    create_audit_log(

        competition.id,

        user.id,

        "DISPUTE_OPENED",

        match.id,

        {
            "reason": reason
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Dispute opened.",

        "dispute": {

            "id": dispute.id,

            "competitionId": (
                dispute.competition_id
            ),

            "matchId": dispute.match_id,

            "raisedBy": dispute.raised_by,

            "reason": dispute.reason,

            "status": dispute.status,

            "createdAt": (
                dispute.created_at.isoformat()
                if dispute.created_at
                else None
            ),
        },
    }), 201


# =========================================================
# RESOLVE DISPUTE
# =========================================================

@competition_bp.route(
    "/disputes/<int:dispute_id>/resolve",
    methods=["POST"]
)
def resolve_dispute(
    dispute_id
):

    dispute = db.session.get(
        CompetitionDispute,
        dispute_id
    )

    if not dispute:

        return jsonify({
            "success": False,
            "message": "Dispute not found."
        }), 404

    competition = db.session.get(
        Competition,
        dispute.competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if dispute.status != "OPEN":

        return jsonify({
            "success": False,
            "message": "Dispute is already resolved."
        }), 400

    match = db.session.get(
        CompetitionMatch,
        dispute.match_id
    )

    if not match:

        return jsonify({
            "success": False,
            "message": "Match not found."
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    resolution = str(
        data.get(
            "resolution",
            ""
        )
    ).upper()

    allowed = {
        "CONFIRMED",
        "CORRECTED",
        "REPLAY",
        "CANCELLED",
    }

    if resolution not in allowed:

        return jsonify({
            "success": False,
            "message": (
                "resolution must be "
                "CONFIRMED, CORRECTED, "
                "REPLAY or CANCELLED."
            )
        }), 400

    dispute.status = "RESOLVED"

    dispute.resolution = resolution

    dispute.resolved_by = user.id

    dispute.resolved_at = (
        datetime.utcnow()
    )

    if resolution == "CANCELLED":

        match.status = "CANCELLED"

    elif resolution == "REPLAY":

        match.status = "READY"

    elif resolution == "CONFIRMED":

        match.status = "VERIFIED"

    elif resolution == "CORRECTED":

        match.status = "RESULT_PENDING"

    if competition.status == "DISPUTED":

        competition.status = "LIVE"

    create_audit_log(

        competition.id,

        user.id,

        "DISPUTE_RESOLVED",

        match.id,

        {
            "disputeId": dispute.id,
            "resolution": resolution,
        },
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Dispute resolved.",

        "dispute": {

            "id": dispute.id,

            "competitionId": (
                dispute.competition_id
            ),

            "matchId": dispute.match_id,

            "status": dispute.status,

            "resolution": dispute.resolution,

            "resolvedBy": dispute.resolved_by,

            "resolvedAt": (
                dispute.resolved_at.isoformat()
                if dispute.resolved_at
                else None
            ),
        },
    })


# =========================================================
# COMPLETE COMPETITION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/complete",
    methods=["POST"]
)
def complete_competition(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    matches = (
        CompetitionMatch.query
        .filter_by(
            competition_id=competition.id
        )
        .all()
    )

    if not matches:

        return jsonify({
            "success": False,
            "message": "No matches found."
        }), 400

    incomplete = [

        match.id

        for match in matches

        if match.status not in (
            "VERIFIED",
            "CANCELLED",
        )
    ]

    if incomplete:

        return jsonify({

            "success": False,

            "message": (
                "Competition still has "
                "incomplete matches."
            ),

            "incompleteMatches": incomplete,
        }), 400

    if competition.competition_type == "CLASSIC":

        update_classic_standings(
            competition
        )

    else:

        final_match = (
            CompetitionMatch.query
            .filter_by(
                competition_id=competition.id,
                round_name="Final"
            )
            .order_by(
                CompetitionMatch.id.desc()
            )
            .first()
        )

        if final_match and (
            final_match.status
            == "VERIFIED"
        ):

            competition.status = "COMPLETED"

        else:

            return jsonify({
                "success": False,
                "message": (
                    "The final has not "
                    "been verified."
                )
            }), 400

    competition.status = "COMPLETED"

    competition.competition_end = (
        datetime.utcnow()
    )

    stage = get_main_stage(
        competition
    )

    if stage:

        stage.status = "COMPLETED"

    create_audit_log(

        competition.id,

        user.id,

        "COMPETITION_COMPLETED"
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Competition completed.",

        "competition": serialize_competition(
            competition,
            include_children=True
        ),
    })


# =========================================================
# CANCEL COMPETITION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/cancel",
    methods=["POST"]
)
def cancel_competition(
    competition_id
):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:

        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    if competition.status == "COMPLETED":

        return jsonify({
            "success": False,
            "message": (
                "Completed competitions "
                "cannot be cancelled."
            )
        }), 400

    competition.status = "CANCELLED"

    matches = (
        CompetitionMatch.query
        .filter_by(
            competition_id=competition.id
        )
        .all()
    )

    for match in matches:

        if match.status not in (
            "VERIFIED",
            "CANCELLED",
        ):

            match.status = "CANCELLED"

    create_audit_log(

        competition.id,

        user.id,

        "COMPETITION_CANCELLED"
    )

    db.session.commit()

    return jsonify({

        "success": True,

        "message": "Competition cancelled.",

        "competition": serialize_competition(
            competition
        ),
    })
