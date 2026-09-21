# =========================================================
# SYNCO COMPETITION ENGINE V1
# Compatible with the Competition models previously provided
# =========================================================

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import copy
import math
import random
import re

from flask import Blueprint, current_app, jsonify, request, session
from sqlalchemy import or_

from models import (
    db,
    User,
    Game,
    Club,
    ClubMember,
    ProfileGame,

    Competition,
    CompetitionStage,
    CompetitionParticipant,
    CompetitionTeamInvite,
    CompetitionSubstitutionRequest,

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
    "CANCELLED",
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
    """Parse frontend/API datetime values into naive UTC datetimes.

    SYNCO's database uses SQLAlchemy DateTime columns without an explicit
    timezone. Browser datetime-local values are interpreted as Asia/Kolkata
    time, then normalized to UTC before being stored. Values that already
    carry an offset are converted using that offset.
    """

    if not value:
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        value = str(value).strip()
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo("Asia/Kolkata"))

    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def utc_now():
    """Return current UTC time as a naive datetime for DB compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_utc_naive(value):
    if value is None:
        return None

    if value.tzinfo is None:
        return value

    return value.astimezone(timezone.utc).replace(tzinfo=None)


def utc_iso(value):
    """Serialize a DB UTC datetime as an explicit UTC ISO-8601 value.

    The database stores naive UTC datetimes for compatibility. JavaScript
    treats a timezone-less ISO string as browser-local time, which caused
    tournament invite expiry/countdown values to appear several hours early.
    Always expose these timestamps with an explicit UTC suffix.
    """
    if value is None:
        return None

    value = as_utc_naive(value)
    return value.isoformat() + "Z"


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


def serialize_team_roster(participant):

    roster = getattr(
        participant,
        "team_roster",
        None
    ) or []

    result = []

    if not isinstance(roster, list):
        return result

    for index, item in enumerate(roster, start=1):

        if not isinstance(item, dict):
            continue

        try:
            user_id = int(item.get("userId"))
        except (TypeError, ValueError):
            continue

        result.append({
            "userId": user_id,
            "uid": item.get("uid"),
            "name": item.get("name"),
            "username": item.get("username"),
            "avatar": item.get("avatar"),
            "role": item.get("role") or "MEMBER",
            "status": str(item.get("status") or "ACCEPTED").upper(),
            "rosterOrder": item.get("rosterOrder", index),
            "inviteId": item.get("inviteId"),
            "inviteExpiresAt": item.get("inviteExpiresAt"),
        })

    result.sort(
        key=lambda item: int(
            item.get("rosterOrder") or 0
        )
    )

    return result


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

    team_roster = serialize_team_roster(
        participant
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

        "captainId": (
            participant.user_id
            if str(getattr(participant, "participant_type", "")).upper() == "TEAM"
            else None
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

        "registeredAt": utc_iso(participant.registered_at),

        "acceptedAt": utc_iso(participant.accepted_at),

        "eliminatedAt": utc_iso(participant.eliminated_at),

        "teamRoster": team_roster,

        "rosterCount": len(team_roster),
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

        "registrationStart": utc_iso(competition.registration_start),

        "registrationEnd": utc_iso(competition.registration_end),

        "competitionStart": utc_iso(competition.competition_start),

        "competitionEnd": utc_iso(competition.competition_end),

        "createdAt": utc_iso(competition.created_at),

        "updatedAt": utc_iso(competition.updated_at),
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

        # Registration workflow defaults. These are stored in the existing
        # competition JSON so the schema stays backward-compatible.
        registration_settings = configuration.get(
            "registration",
            {}
        )

        if not isinstance(registration_settings, dict):
            registration_settings = {}

        registration_settings.setdefault("inviteDurationHours", 5)
        registration_settings.setdefault("halfwayReminder", True)
        registration_settings.setdefault("lastHourReminder", True)
        registration_settings.setdefault("maxSubstitutions", 1)
        registration_settings.setdefault("substitutionCloseMinutes", 60)
        registration_settings.setdefault("substitutionApprovalMinutes", 60)

        configuration["registration"] = registration_settings

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

    changed = False
    for competition in competitions:
        if sync_registration_status(competition):
            changed = True

    if changed:
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

    if str(competition.status or "").upper() not in (
        "DRAFT",
        "REGISTRATION_OPEN",
        "REGISTRATION_CLOSED",
    ):
        return jsonify({
            "success": False,
            "message": "Registration cannot be opened from the current competition status.",
        }), 400

    now = utc_now()
    end = as_utc_naive(competition.registration_end)

    # Explicit organizer action means registration should open now even if
    # an older draft contained a future registrationStart value.
    if not competition.registration_start or as_utc_naive(competition.registration_start) > now:
        competition.registration_start = now

    if end and now >= end:
        return jsonify({
            "success": False,
            "message": "Registration end time has already passed. Extend the registration deadline first.",
        }), 400

    configuration = dict(competition.configuration or {})
    registration_settings = dict(configuration.get("registration") or {})
    registration_settings["manualClosed"] = False
    configuration["registration"] = registration_settings
    competition.configuration = configuration

    competition.status = "REGISTRATION_OPEN"

    competition.is_published = True

    if not competition.registration_start:

        competition.registration_start = (
            utc_now()
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
# REGISTRATION WORKFLOW HELPERS
# =========================================================

def _registration_settings(competition):

    configuration = getattr(
        competition,
        "configuration",
        None
    ) or {}

    settings = configuration.get(
        "registration",
        {}
    )

    if not isinstance(settings, dict):
        settings = {}

    return {
        "inviteDurationHours": max(
            1,
            min(
                5,
                int(settings.get("inviteDurationHours", 5) or 5)
            )
        ),
        "halfwayReminder": bool(
            settings.get("halfwayReminder", True)
        ),
        "lastHourReminder": bool(
            settings.get("lastHourReminder", True)
        ),
        "maxSubstitutions": max(
            0,
            int(settings.get("maxSubstitutions", 1) or 0)
        ),
        "substitutionCloseMinutes": max(
            1,
            int(settings.get("substitutionCloseMinutes", 60) or 60)
        ),
        "substitutionApprovalMinutes": max(
            5,
            int(settings.get("substitutionApprovalMinutes", 60) or 60)
        ),
    }


def competition_registration_deadline(competition):
    deadline = getattr(competition, "registration_end", None)
    return as_utc_naive(deadline)


def registration_manual_closed(competition):
    configuration = getattr(competition, "configuration", None) or {}
    settings = configuration.get("registration", {})
    return bool(isinstance(settings, dict) and settings.get("manualClosed", False))


def sync_registration_status(competition):
    """Keep persisted registration status aligned with the configured window.

    This fixes competitions that were incorrectly left CLOSED/DRAFT while
    their registration window is currently active. A deliberate organizer
    close is protected with registration.manualClosed=True.
    """

    if not competition:
        return False

    status = str(getattr(competition, "status", "") or "").upper()
    if status not in {"DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"}:
        return False

    if registration_manual_closed(competition):
        return False

    start = as_utc_naive(getattr(competition, "registration_start", None))
    end = as_utc_naive(getattr(competition, "registration_end", None))
    now = utc_now()
    changed = False

    # No start means the organizer can open registration immediately.
    if start and now < start:
        if status != "DRAFT":
            competition.status = "DRAFT"
            competition.is_published = False
            changed = True
        return changed

    # The registration end is exclusive.
    if end and now >= end:
        if status != "REGISTRATION_CLOSED":
            competition.status = "REGISTRATION_CLOSED"
            competition.is_published = True
            changed = True
        return changed

    # We are currently inside an active registration window.
    if status != "REGISTRATION_OPEN":
        competition.status = "REGISTRATION_OPEN"
        competition.is_published = True
        changed = True
    elif not competition.is_published:
        competition.is_published = True
        changed = True

    return changed


def is_registration_open_now(competition):

    if not competition:
        return False

    status = str(getattr(competition, "status", "") or "").upper()

    if status not in {"DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"}:
        return False

    if registration_manual_closed(competition):
        return False

    start = as_utc_naive(getattr(competition, "registration_start", None))
    deadline = competition_registration_deadline(competition)
    now = utc_now()

    if start and now < start:
        return False

    if deadline and now >= deadline:
        return False

    return True


def normalize_game_value(value):
    return slugify(value or "")


def user_has_linked_game(user, game):
    if not user or not game:
        return False

    aliases = {
        normalize_game_value(game.id),
        normalize_game_value(game.name),
        normalize_game_value(game.short_name),
        normalize_game_slug(game),
    }

    configuration = get_game_configuration(game) or {}
    for name in configuration.get("game_names", []) or []:
        aliases.add(normalize_game_value(name))

    profiles = (
        ProfileGame.query
        .filter_by(user_id=user.id)
        .all()
    )

    for profile in profiles:
        profile_value = normalize_game_value(
            getattr(profile, "game_name", "")
        )
        if profile_value in aliases:
            return True

    return False


def get_team_participant_rows(competition):

    return (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
        )
        .filter(
            CompetitionParticipant.registration_status.notin_(
                ["REJECTED", "CANCELLED", "DISQUALIFIED"]
            )
        )
        .order_by(
            CompetitionParticipant.registered_at.asc(),
            CompetitionParticipant.id.asc(),
        )
        .all()
    )


def get_committed_team_for_user(
    competition,
    user_id,
    exclude_participant_id=None,
):
    """
    Return the team entry where the player is already committed.

    A committed player is a captain or an accepted roster member.
    Pending invitations do not block a player; the first accepted
    invitation wins and cancels the other pending invitations.
    """

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    for participant in get_team_participant_rows(competition):

        if exclude_participant_id and participant.id == exclude_participant_id:
            continue

        # A team captain is committed immediately.
        if participant.user_id == user_id:
            return participant

        roster = getattr(participant, "team_roster", None) or []

        if not isinstance(roster, list):
            continue

        for item in roster:
            if not isinstance(item, dict):
                continue

            try:
                roster_user_id = int(item.get("userId"))
            except (TypeError, ValueError):
                continue

            status = str(
                item.get("status") or "ACCEPTED"
            ).upper()

            role = str(
                item.get("role") or ""
            ).upper()

            if roster_user_id == user_id and (
                status == "ACCEPTED"
                or role == "CAPTAIN"
            ):
                return participant

    return None


def user_has_any_active_competition_entry(competition, user_id):

    # Captain / solo participant.
    participant = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            user_id=user_id,
        )
        .filter(
            CompetitionParticipant.registration_status.notin_(
                ["REJECTED", "CANCELLED", "DISQUALIFIED"]
            )
        )
        .first()
    )

    if participant:
        return participant

    return get_committed_team_for_user(
        competition,
        user_id,
    )


def confirmed_participant_count(competition):

    return (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
        )
        .filter(
            CompetitionParticipant.registration_status.in_(
                ["ACCEPTED", "LOCKED", "ELIMINATED"]
            )
        )
        .count()
    )


def team_roster_snapshot_from_users(
    memberships,
    captain_user_id,
    statuses=None,
):

    statuses = statuses or {}
    snapshot = []

    for index, membership in enumerate(memberships, start=1):

        member_user = membership.user

        if not member_user:
            continue

        is_captain = member_user.id == captain_user_id

        snapshot.append({
            "userId": member_user.id,
            "uid": member_user.uid,
            "name": (
                member_user.username
                or member_user.name
                or f"Player {member_user.id}"
            ),
            "username": member_user.username,
            "avatar": member_user.avatar,
            "role": "CAPTAIN" if is_captain else membership.role,
            "status": "ACCEPTED" if is_captain else str(
                statuses.get(member_user.id, "PENDING")
            ).upper(),
            "rosterOrder": index,
        })

    return snapshot


def set_roster_player_status(participant, user_id, status):

    roster = getattr(participant, "team_roster", None) or []

    if not isinstance(roster, list):
        return False

    # JSON columns are not mutable-tracked by default. Rebuild the list so
    # SQLAlchemy always sees a new value and persists the status change.
    updated_roster = copy.deepcopy(roster)
    changed = False

    for item in updated_roster:
        if not isinstance(item, dict):
            continue

        try:
            item_user_id = int(item.get("userId"))
        except (TypeError, ValueError):
            continue

        if item_user_id == int(user_id):
            item["status"] = str(status).upper()
            changed = True

    if changed:
        participant.team_roster = updated_roster

    return changed


def roster_player(participant, user_id):

    roster = getattr(participant, "team_roster", None) or []
    if not isinstance(roster, list):
        return None

    for item in roster:
        if not isinstance(item, dict):
            continue
        try:
            if int(item.get("userId")) == int(user_id):
                return item
        except (TypeError, ValueError):
            continue

    return None


def next_roster_slot(participant):

    roster = getattr(participant, "team_roster", None) or []
    numbers = []

    if isinstance(roster, list):
        for item in roster:
            if isinstance(item, dict):
                try:
                    numbers.append(int(item.get("rosterOrder")))
                except (TypeError, ValueError):
                    pass

    return (max(numbers) + 1) if numbers else 1


def next_invite_expiry(competition, created_at=None):

    created_at = created_at or datetime.utcnow()
    hours = _registration_settings(competition)["inviteDurationHours"]
    expiry = created_at + timedelta(hours=hours)

    deadline = competition_registration_deadline(competition)
    if deadline:
        expiry = min(expiry, deadline)

    return expiry


def serialize_team_invite(invite):

    invite_data = invite.to_dict()
    participant = invite.participant
    competition = invite.competition

    invite_data["expiresAt"] = utc_iso(invite.expires_at)
    invite_data["createdAt"] = utc_iso(invite.created_at)
    invite_data["respondedAt"] = utc_iso(invite.responded_at)
    invite_data["halfwayRemindedAt"] = utc_iso(invite.halfway_reminded_at)
    invite_data["lastHourRemindedAt"] = utc_iso(invite.last_hour_reminded_at)

    invite_data["competitionTitle"] = (
        competition.title if competition else "Tournament"
    )
    invite_data["teamName"] = (
        participant.club.name
        if participant and participant.club
        else "Tournament Team"
    )
    invite_data["captainId"] = (
        participant.user_id
        if participant
        else None
    )

    return invite_data


def serialize_substitution_request(request_row):
    return request_row.to_dict()


def enrich_roster_with_invites(participant, roster_payload=None):
    """
    Add the latest tournament invite metadata to each roster row.

    This is intentionally separate from the general participant serializer
    so live leaderboard/match payloads do not perform extra invite queries.
    The registration screen can therefore show the captain the same expiry
    countdown that the invited player sees.
    """

    payload = list(roster_payload or serialize_team_roster(participant))

    invites = (
        CompetitionTeamInvite.query
        .filter_by(participant_id=participant.id)
        .order_by(
            CompetitionTeamInvite.created_at.desc(),
            CompetitionTeamInvite.id.desc(),
        )
        .all()
    )

    latest_by_user = {}

    for invite in invites:
        if invite.invited_user_id not in latest_by_user:
            latest_by_user[invite.invited_user_id] = invite

    for item in payload:
        try:
            user_id = int(item.get("userId"))
        except (TypeError, ValueError):
            continue

        invite = latest_by_user.get(user_id)
        if not invite:
            continue

        item["inviteId"] = invite.id
        item["inviteStatus"] = invite.status
        item["inviteType"] = invite.invite_type
        item["inviteExpiresAt"] = utc_iso(invite.expires_at)
        item["replacesUserId"] = invite.replaces_user_id

    return payload


def create_competition_notification(
    user_id,
    notification_type,
    title,
    message,
    competition_id,
    data=None,
):

    from models import Notification

    notification_data = dict(data or {})
    notification_data.setdefault("competitionId", competition_id)

    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type="COMPETITION",
        reference_id=competition_id,
        data=notification_data,
        is_read=False,
    )

    db.session.add(notification)
    return notification


def mark_competition_notifications_read(
    user_id,
    invite_id=None,
    substitution_request_id=None,
):

    from models import Notification

    notifications = (
        Notification.query
        .filter_by(user_id=user_id, is_read=False)
        .all()
    )

    for notification in notifications:

        data = notification.data or {}
        if not isinstance(data, dict):
            data = {}

        matches_invite = (
            invite_id is not None
            and str(data.get("inviteId")) == str(invite_id)
        )

        matches_substitution = (
            substitution_request_id is not None
            and str(data.get("substitutionRequestId")) == str(substitution_request_id)
        )

        if matches_invite or matches_substitution:
            notification.is_read = True


def cancel_other_pending_competition_invites(
    competition,
    user_id,
    accepted_invite_id=None,
):

    pending = (
        CompetitionTeamInvite.query
        .filter_by(
            competition_id=competition.id,
            invited_user_id=user_id,
            status="PENDING",
        )
        .all()
    )

    cancelled = []

    for invite in pending:

        if accepted_invite_id and invite.id == accepted_invite_id:
            continue

        invite.status = "CANCELLED"
        invite.responded_at = datetime.utcnow()
        cancelled.append(invite)

        participant = invite.participant
        if participant:
            set_roster_player_status(
                participant,
                user_id,
                "CANCELLED",
            )
        if participant:
            # A cancelled competing invite does not alter that team's
            # selected slot; the captain can still replace the player if
            # their own invite later becomes declined/expired.
            create_competition_notification(
                participant.user_id,
                "COMPETITION_INVITE_CANCELLED",
                "Tournament Invite Cancelled",
                (
                    f"{invite.invited_user.name or invite.invited_user.username or 'A player'} "
                    "accepted another team for this competition."
                ),
                competition.id,
                data={
                    "inviteId": invite.id,
                    "participantId": participant.id,
                    "teamName": participant.club.name if participant.club else "Tournament Team",
                    "actionStatus": "CANCELLED",
                    "actionUrl": f"/competitions/{competition.id}/register",
                },
            )

    return cancelled


def team_member_ids(participant, accepted_only=True):

    roster = getattr(participant, "team_roster", None) or []
    result = []

    if not isinstance(roster, list):
        return result

    for item in roster:
        if not isinstance(item, dict):
            continue

        try:
            user_id = int(item.get("userId"))
        except (TypeError, ValueError):
            continue

        if accepted_only:
            status = str(item.get("status") or "ACCEPTED").upper()
            if status != "ACCEPTED" and str(item.get("role") or "").upper() != "CAPTAIN":
                continue

        if user_id not in result:
            result.append(user_id)

    return result


def team_is_complete(participant, competition):

    required_size = int(competition.team_size or 0)
    if required_size < 1:
        return False

    ids = team_member_ids(participant, accepted_only=True)
    return len(ids) == required_size


def notify_team_confirmed(competition, participant):

    member_ids = team_member_ids(
        participant,
        accepted_only=True,
    )

    team_name = participant.club.name if participant.club else "Tournament Team"

    for user_id in member_ids:
        create_competition_notification(
            user_id,
            "COMPETITION_TEAM_CONFIRMED",
            "Team Confirmed",
            (
                f"{team_name} is confirmed for {competition.title}."
            ),
            competition.id,
            data={
                "participantId": participant.id,
                "clubId": participant.club_id,
                "teamName": team_name,
                "actionStatus": "CONFIRMED",
                "actionUrl": f"/competitions/{competition.id}/register",
            },
        )


def confirm_team_if_complete(competition, participant):

    if str(participant.participant_type or "").upper() != "TEAM":
        return False

    if not team_is_complete(participant, competition):
        return False

    if confirmed_participant_count(competition) >= int(competition.max_participants or 0):
        # The entry was pending and the field is already full. Do not allow
        # a new team to exceed the declared capacity.
        return False

    if participant.registration_status != "ACCEPTED":
        participant.registration_status = "ACCEPTED"
        participant.accepted_at = datetime.utcnow()
        notify_team_confirmed(competition, participant)
        create_audit_log(
            competition.id,
            participant.user_id,
            "TEAM_CONFIRMED",
            metadata={
                "participantId": participant.id,
                "clubId": participant.club_id,
                "rosterUserIds": team_member_ids(participant),
            },
        )
        return True

    return True


def cancel_pending_registration(
    competition,
    participant,
    reason,
    actor_id=None,
):

    if participant.registration_status == "CANCELLED":
        return

    accepted_members = team_member_ids(
        participant,
        accepted_only=True,
    )

    participant.registration_status = "CANCELLED"

    pending_invites = (
        CompetitionTeamInvite.query
        .filter_by(
            participant_id=participant.id,
            status="PENDING",
        )
        .all()
    )

    for invite in pending_invites:
        invite.status = "EXPIRED"
        invite.responded_at = datetime.utcnow()

        if invite.invited_user_id != participant.user_id:
            set_roster_player_status(
                participant,
                invite.invited_user_id,
                "EXPIRED",
            )

    team_name = participant.club.name if participant.club else "Tournament Team"

    notified_ids = set([participant.user_id] + accepted_members)

    for user_id in notified_ids:
        if not user_id:
            continue
        create_competition_notification(
            user_id,
            "COMPETITION_REGISTRATION_CANCELLED",
            "Team Registration Cancelled",
            (
                f"{team_name}'s registration for {competition.title} was cancelled "
                f"{reason}."
            ),
            competition.id,
            data={
                "participantId": participant.id,
                "clubId": participant.club_id,
                "teamName": team_name,
                "actionStatus": "CANCELLED",
                "actionUrl": f"/competitions/{competition.id}/register",
            },
        )

    create_audit_log(
        competition.id,
        actor_id or participant.user_id,
        "TEAM_REGISTRATION_CANCELLED",
        metadata={
            "participantId": participant.id,
            "clubId": participant.club_id,
            "reason": reason,
            "rosterUserIds": team_member_ids(participant, accepted_only=False),
        },
    )


def get_next_match_start(competition):

    now = utc_now()

    row = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .filter(CompetitionMatch.scheduled_at.isnot(None))
        .filter(CompetitionMatch.status.notin_(["CANCELLED", "VERIFIED"]))
        .filter(CompetitionMatch.scheduled_at > now)
        .order_by(CompetitionMatch.scheduled_at.asc())
        .first()
    )

    if row:
        return row.scheduled_at

    return competition.competition_start


def substitution_cutoff(competition):

    match_start = get_next_match_start(competition)
    if not match_start:
        return None

    minutes = _registration_settings(competition)["substitutionCloseMinutes"]
    return match_start - timedelta(minutes=minutes)


def process_competition_registration_timers(competition, commit=True):
    """
    Process invite reminders, expiries, pending-team confirmation, deadline
    cancellation, and roster lock. Safe to call repeatedly from registration
    info, notifications, a cron job, or an admin maintenance request.
    """

    now = utc_now()
    changed = False

    if not competition:
        return False

    # -----------------------------------------------------
    # Invite timers
    # -----------------------------------------------------

    pending_invites = (
        CompetitionTeamInvite.query
        .filter_by(
            competition_id=competition.id,
            status="PENDING",
        )
        .all()
    )

    settings = _registration_settings(competition)

    for invite in pending_invites:

        participant = invite.participant

        if not participant:
            invite.status = "CANCELLED"
            invite.responded_at = now
            changed = True
            continue

        # If registration was closed/cancelled, no invite should remain pending.
        if participant.registration_status in ("CANCELLED", "LOCKED", "ELIMINATED"):
            invite.status = "CANCELLED"
            invite.responded_at = now
            changed = True
            continue

        if now >= invite.expires_at:

            invite.status = "EXPIRED"
            invite.responded_at = now
            set_roster_player_status(
                participant,
                invite.invited_user_id,
                "EXPIRED",
            )

            captain = participant.user
            if captain:
                create_competition_notification(
                    captain.id,
                    "COMPETITION_INVITE_EXPIRED",
                    "Player Invite Expired",
                    (
                        f"{invite.invited_user.name if invite.invited_user else 'A player'} "
                        "did not respond to the team invitation before it expired."
                    ),
                    competition.id,
                    data={
                        "inviteId": invite.id,
                        "participantId": participant.id,
                        "clubId": participant.club_id,
                        "userId": invite.invited_user_id,
                        "teamName": participant.club.name if participant.club else "Tournament Team",
                        "actionStatus": "EXPIRED",
                        "actionUrl": f"/competitions/{competition.id}/register",
                    },
                )

            if invite.invite_type == "SUBSTITUTION" and invite.substitution_request_id:
                substitution = db.session.get(
                    CompetitionSubstitutionRequest,
                    invite.substitution_request_id,
                )
                if substitution and substitution.status == "APPROVED":
                    substitution.status = "REJECTED"
                    substitution.rejection_reason = "Replacement player did not accept before the substitution window closed."
                    substitution.decided_at = now
                    changed = True

            changed = True
            continue

        duration = invite.expires_at - invite.created_at
        halfway_at = invite.created_at + (duration / 2)

        if (
            settings["halfwayReminder"]
            and invite.halfway_reminded_at is None
            and now >= halfway_at
        ):
            invite.halfway_reminded_at = now
            create_competition_notification(
                invite.invited_user_id,
                "COMPETITION_INVITE_REMINDER",
                "Tournament Invite Reminder",
                (
                    f"You still have a pending invitation to join "
                    f"{participant.club.name if participant.club else 'a tournament team'}."
                ),
                competition.id,
                data={
                    "inviteId": invite.id,
                    "participantId": participant.id,
                    "clubId": participant.club_id,
                    "teamName": participant.club.name if participant.club else "Tournament Team",
                    "userId": invite.invited_user_id,
                    "actionStatus": "PENDING",
                    "actionUrl": f"/competitions/{competition.id}/register",
                },
            )
            changed = True

        if (
            settings["lastHourReminder"]
            and invite.last_hour_reminded_at is None
            and now < invite.expires_at
            and (invite.expires_at - now) <= timedelta(hours=1)
        ):
            invite.last_hour_reminded_at = now
            create_competition_notification(
                invite.invited_user_id,
                "COMPETITION_INVITE_FINAL_REMINDER",
                "Tournament Invite Expires Soon",
                (
                    f"Your tournament invitation expires in about an hour."
                ),
                competition.id,
                data={
                    "inviteId": invite.id,
                    "participantId": participant.id,
                    "clubId": participant.club_id,
                    "teamName": participant.club.name if participant.club else "Tournament Team",
                    "userId": invite.invited_user_id,
                    "actionStatus": "PENDING",
                    "actionUrl": f"/competitions/{competition.id}/register",
                },
            )
            changed = True

    # -----------------------------------------------------
    # Substitution approval deadlines
    # -----------------------------------------------------

    pending_substitution_requests = (
        CompetitionSubstitutionRequest.query
        .filter_by(
            competition_id=competition.id,
            status="PENDING",
        )
        .all()
    )

    substitution_cutoff_at = substitution_cutoff(competition)

    for request_row in pending_substitution_requests:

        should_reject = now >= request_row.decision_deadline

        if substitution_cutoff_at and now >= substitution_cutoff_at:
            should_reject = True

        if not should_reject:
            continue

        request_row.status = "REJECTED"
        request_row.decided_at = now
        request_row.rejection_reason = "Host approval deadline expired."

        participant = request_row.participant
        team_name = (
            participant.club.name
            if participant and participant.club
            else "Tournament Team"
        )

        for involved_user_id in {
            request_row.captain_id,
            request_row.outgoing_user_id,
            request_row.replacement_user_id,
        }:
            if involved_user_id:
                create_competition_notification(
                    involved_user_id,
                    "COMPETITION_SUBSTITUTION_REJECTED",
                    "Substitution Request Rejected",
                    (
                        f"The substitution request for {team_name} was rejected "
                        "because the host did not approve it before the deadline."
                    ),
                    competition.id,
                    data={
                        "participantId": request_row.participant_id,
                        "substitutionRequestId": request_row.id,
                        "outgoingUserId": request_row.outgoing_user_id,
                        "replacementUserId": request_row.replacement_user_id,
                        "teamName": team_name,
                        "actionStatus": "REJECTED",
                        "actionUrl": f"/competitions/{competition.id}/register",
                    },
                )

        create_audit_log(
            competition.id,
            competition.organizer_id,
            "SUBSTITUTION_REJECTED",
            metadata={
                "participantId": request_row.participant_id,
                "substitutionRequestId": request_row.id,
                "reason": request_row.rejection_reason,
            },
        )
        changed = True

    # -----------------------------------------------------
    # Normalize team state before confirming entries.
    # Older registrations could be stored as ACCEPTED while one or more
    # teammate invitations were still pending. That incorrectly consumes a
    # confirmed slot and makes the UI show an accepted team with an incomplete
    # roster. Treat such a team as pending until every roster slot is accepted.
    # -----------------------------------------------------

    for participant in get_team_participant_rows(competition):

        if (
            participant.registration_status == "ACCEPTED"
            and not team_is_complete(participant, competition)
        ):
            participant.registration_status = "PENDING"
            participant.accepted_at = None
            changed = True

    # -----------------------------------------------------
    # Confirm full pending teams
    # -----------------------------------------------------

    for participant in get_team_participant_rows(competition):

        if participant.registration_status != "PENDING":
            continue

        if team_is_complete(participant, competition):
            if confirmed_participant_count(competition) < int(competition.max_participants or 0):
                confirm_team_if_complete(competition, participant)
                changed = True

    # -----------------------------------------------------
    # Registration deadline -> pending teams cancel; confirmed
    # teams lock. This makes registration_end the roster lock.
    # -----------------------------------------------------

    deadline = competition_registration_deadline(competition)

    if deadline and now >= deadline:

        for participant in get_team_participant_rows(competition):

            if participant.registration_status == "PENDING":
                cancel_pending_registration(
                    competition,
                    participant,
                    "the registration deadline was reached without a complete accepted roster",
                    actor_id=competition.organizer_id,
                )
                changed = True

            elif participant.registration_status == "ACCEPTED":
                participant.registration_status = "LOCKED"
                changed = True

        if competition.status == "REGISTRATION_OPEN":
            competition.status = "REGISTRATION_CLOSED"

            configuration = dict(competition.configuration or {})
            registration_settings = dict(configuration.get("registration") or {})
            registration_settings["manualClosed"] = False
            configuration["registration"] = registration_settings
            competition.configuration = configuration

            changed = True

        # Lock solo registrations as well.
        solo_participants = (
            CompetitionParticipant.query
            .filter_by(
                competition_id=competition.id,
                participant_type="PLAYER",
                registration_status="ACCEPTED",
            )
            .all()
        )

        for participant in solo_participants:
            participant.registration_status = "LOCKED"
            changed = True

    if commit and changed:
        db.session.commit()

    return changed


# =========================================================
# CLOSE REGISTRATION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/close-registration",
    methods=["POST"]
)
def close_registration(competition_id):

    competition = db.session.get(
        Competition,
        competition_id
    )

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(competition)
    if error:
        return error

    if competition.status != "REGISTRATION_OPEN":
        return jsonify({
            "success": False,
            "message": "Registration is not open."
        }), 400

    now = utc_now()
    competition.registration_end = now

    configuration = dict(competition.configuration or {})
    registration_settings = dict(configuration.get("registration") or {})
    registration_settings["manualClosed"] = True
    configuration["registration"] = registration_settings
    competition.configuration = configuration

    process_competition_registration_timers(
        competition,
        commit=False,
    )

    confirmed_count = confirmed_participant_count(competition)

    if confirmed_count < 2:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "At least 2 confirmed participants are required.",
        }), 400

    competition.status = "REGISTRATION_CLOSED"

    create_audit_log(
        competition.id,
        user.id,
        "REGISTRATION_CLOSED",
        metadata={
            "confirmedParticipantCount": confirmed_count,
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Registration closed and rosters locked.",
        "competition": serialize_competition(competition),
    })


# =========================================================
# TOURNAMENT REGISTRATION INFO
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

    process_competition_registration_timers(
        competition,
        commit=True,
    )
    db.session.refresh(competition)

    mode_config = {}
    game_configuration = get_game_configuration(competition.game)
    if game_configuration:
        mode_config = (
            game_configuration
            .get("modes", {})
            .get(str(competition.game_mode or "").upper(), {})
        )

    is_team = str(competition.participant_type or "").upper() == "TEAM"
    registration_open = is_registration_open_now(competition)

    confirmed_count = confirmed_participant_count(competition)

    current_registration = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            user_id=user.id,
        )
        .filter(
            CompetitionParticipant.registration_status.notin_(
                ["REJECTED", "CANCELLED", "DISQUALIFIED"]
            )
        )
        .order_by(CompetitionParticipant.registered_at.desc())
        .first()
    )

    # Team members do not have CompetitionParticipant.user_id pointing to
    # themselves; only the captain owns that field. Once an invite is
    # accepted, resolve the team through the accepted roster so the invited
    # player sees the same confirmed/pending state as the captain.
    if current_registration is None and is_team:
        current_registration = get_committed_team_for_user(
            competition,
            user.id,
        )

    # All current memberships for the competition game. Owner is simply
    # another membership; there is no special registration permission.
    memberships = (
        ClubMember.query
        .join(Club, Club.id == ClubMember.club_id)
        .filter(
            ClubMember.user_id == user.id,
            Club.game_id == competition.game_id,
            Club.is_active.is_(True),
        )
        .order_by(Club.created_at.desc(), ClubMember.id.asc())
        .all()
    )

    # A club can still be a registration source even if another captain
    # has already used it; that entry is shown as unavailable.
    all_club_participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
        )
        .filter(
            CompetitionParticipant.registration_status.notin_(
                ["REJECTED", "CANCELLED", "DISQUALIFIED"]
            )
        )
        .all()
    )

    club_registration_map = {
        participant.club_id: participant
        for participant in all_club_participants
        if participant.club_id is not None
    }

    clubs_payload = []

    for membership in memberships:

        club = membership.club
        if not club:
            continue

        club_memberships = (
            ClubMember.query
            .filter_by(club_id=club.id)
            .order_by(ClubMember.role.asc(), ClubMember.joined_at.asc(), ClubMember.id.asc())
            .all()
        )

        member_rows = []
        eligible_count = 0

        for member in club_memberships:

            member_user = member.user
            if not member_user:
                continue

            game_linked = user_has_linked_game(
                member_user,
                competition.game,
            )

            committed_participant = get_committed_team_for_user(
                competition,
                member_user.id,
            )

            account_status = str(
                getattr(member_user, "account_status", "active") or "active"
            ).lower()

            available = (
                account_status == "active"
                and game_linked
                and committed_participant is None
            )

            reason = None
            if account_status != "active":
                reason = "Account is not active"
            elif not game_linked:
                reason = "Game is not linked to this profile"
            elif committed_participant is not None:
                reason = "Already committed to another team in this competition"

            if available:
                eligible_count += 1

            member_rows.append({
                "id": member.id,
                "userId": member_user.id,
                "uid": member_user.uid,
                "name": member_user.username or member_user.name or f"Player {member_user.id}",
                "username": member_user.username,
                "avatar": member_user.avatar,
                "role": member.role,
                "joinedAt": member.joined_at.isoformat() if member.joined_at else None,
                "gameLinked": game_linked,
                "eligible": available,
                "unavailableReason": reason,
                "isCurrentUser": member_user.id == user.id,
                "committedParticipantId": committed_participant.id if committed_participant else None,
            })

        participant = club_registration_map.get(club.id)
        participant_status = str(
            participant.registration_status if participant else ""
        ).upper()

        club_registration = (
            serialize_participant(participant)
            if participant
            else None
        )

        club_available = (
            participant is None
            or participant_status in ("REJECTED", "CANCELLED")
        )

        if not club_available:
            club_reason = "This club already has a tournament entry"
        elif eligible_count < int(competition.team_size or 0):
            club_reason = (
                f"Only {eligible_count} eligible player(s); "
                f"{competition.team_size} required"
            )
        else:
            club_reason = None

        clubs_payload.append({
            "id": club.id,
            "name": club.name,
            "tag": club.tag,
            "avatar": club.avatar,
            "banner": club.banner,
            "ownerId": club.owner_id,
            "gameId": club.game_id,
            "isOwner": club.owner_id == user.id,
            "membershipRole": membership.role,
            "memberCount": len(member_rows),
            "eligibleMemberCount": eligible_count,
            "eligible": (
                club_available
                and eligible_count >= int(competition.team_size or 0)
            ),
            "unavailableReason": club_reason,
            "members": member_rows,
            "registration": club_registration,
            "registered": not club_available,
        })

    my_pending_invites = (
        CompetitionTeamInvite.query
        .filter_by(
            competition_id=competition.id,
            invited_user_id=user.id,
            status="PENDING",
        )
        .order_by(CompetitionTeamInvite.expires_at.asc(), CompetitionTeamInvite.id.asc())
        .all()
    )

    substitution_requests = []
    if current_registration and is_team:
        rows = (
            CompetitionSubstitutionRequest.query
            .filter_by(
                competition_id=competition.id,
                participant_id=current_registration.id,
            )
            .order_by(CompetitionSubstitutionRequest.requested_at.desc())
            .all()
        )
        substitution_requests = [
            serialize_substitution_request(item)
            for item in rows
        ]

    # Only confirmed teams consume capacity.
    capacity_full = confirmed_count >= int(competition.max_participants or 0)

    serialized_current_registration = None
    if current_registration:
        serialized_current_registration = serialize_participant(
            current_registration
        )
        serialized_current_registration["teamRoster"] = (
            enrich_roster_with_invites(
                current_registration,
                serialized_current_registration.get("teamRoster", []),
            )
        )
        serialized_current_registration["rosterCount"] = len(
            serialized_current_registration["teamRoster"]
        )

    return jsonify({
        "success": True,
        "competition": serialize_competition(competition),
        "registrationOpen": registration_open,
        "registrationDeadline": utc_iso(competition.registration_end),
        "full": capacity_full,
        "capacity": competition.max_participants,
        "registeredCount": confirmed_count,
        "confirmedCount": confirmed_count,
        "pendingCount": (
            CompetitionParticipant.query
            .filter_by(
                competition_id=competition.id,
                registration_status="PENDING",
            )
            .count()
        ),
        "modeConfig": mode_config,
        "registrationSettings": _registration_settings(competition),
        "currentUserId": user.id,
        "isCaptain": bool(
            serialized_current_registration
            and str(serialized_current_registration.get("participantType", "")).upper() == "TEAM"
            and serialized_current_registration.get("captainId") == user.id
        ),
        "currentUserGameLinked": user_has_linked_game(
            user,
            competition.game,
        ),
        "myRegistration": serialized_current_registration,
        "myClubs": clubs_payload if is_team else [],
        "myInvites": [
            serialize_team_invite(invite)
            for invite in my_pending_invites
        ],
        "substitutionRequests": substitution_requests,
    })


# =========================================================
# REGISTER PLAYER / SOLO
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/register/player",
    methods=["POST"]
)
def register_player(competition_id):

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

    process_competition_registration_timers(competition, commit=True)

    if sync_registration_status(competition):
        db.session.commit()

    if not is_registration_open_now(competition):
        return jsonify({
            "success": False,
            "message": "Registration is not currently open."
        }), 400

    if str(competition.participant_type or "").upper() != "PLAYER":
        return jsonify({
            "success": False,
            "message": "This competition requires a team."
        }), 400

    if not user_has_linked_game(user, competition.game):
        return jsonify({
            "success": False,
            "message": "Link this game to your SYNCO profile before registering."
        }), 400

    if confirmed_participant_count(competition) >= int(competition.max_participants or 0):
        return jsonify({
            "success": False,
            "message": "Competition is full."
        }), 400

    existing = user_has_any_active_competition_entry(
        competition,
        user.id,
    )

    if existing:
        return jsonify({
            "success": False,
            "message": "You are already committed to an entry in this competition."
        }), 409

    # Registering solo is an accepted commitment, so any other pending
    # invitations for the same competition are cancelled.
    participant = CompetitionParticipant(
        competition_id=competition.id,
        participant_type="PLAYER",
        user_id=user.id,
        club_id=None,
        registration_status="ACCEPTED",
        accepted_at=datetime.utcnow(),
    )

    db.session.add(participant)
    db.session.flush()

    cancel_other_pending_competition_invites(
        competition,
        user.id,
        accepted_invite_id=None,
    )

    create_audit_log(
        competition.id,
        user.id,
        "PLAYER_REGISTERED",
        metadata={
            "participantId": participant.id,
            "participantType": "PLAYER",
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Player registered.",
        "participant": serialize_participant(participant),
    }), 201


# =========================================================
# REGISTER TEAM
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/register/team",
    methods=["POST"]
)
def register_team(competition_id):

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

    process_competition_registration_timers(competition, commit=True)

    if sync_registration_status(competition):
        db.session.commit()

    if not is_registration_open_now(competition):
        return jsonify({
            "success": False,
            "message": "Registration is not currently open."
        }), 400

    if str(competition.participant_type or "").upper() != "TEAM":
        return jsonify({
            "success": False,
            "message": "This competition requires a solo player."
        }), 400

    if confirmed_participant_count(competition) >= int(competition.max_participants or 0):
        return jsonify({
            "success": False,
            "message": "All confirmed tournament slots are already filled."
        }), 400

    data = request.get_json(silent=True) or {}

    try:
        club_id = int(data.get("clubId"))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "A valid club is required."
        }), 400

    member_ids = data.get("memberIds")
    if not isinstance(member_ids, list):
        return jsonify({
            "success": False,
            "message": "memberIds must be an array."
        }), 400

    try:
        member_ids = list(dict.fromkeys(int(item) for item in member_ids))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Every selected player must be a valid user ID."
        }), 400

    required_size = int(competition.team_size or 0)
    if required_size < 1:
        return jsonify({
            "success": False,
            "message": "Invalid tournament team size."
        }), 400

    if len(member_ids) != required_size:
        return jsonify({
            "success": False,
            "message": f"Select exactly {required_size} players including yourself."
        }), 400

    if user.id not in member_ids:
        return jsonify({
            "success": False,
            "message": "The registering player must be included as the team captain."
        }), 400

    if user_has_any_active_competition_entry(competition, user.id):
        return jsonify({
            "success": False,
            "message": "You are already committed to an entry in this competition."
        }), 409

    club = db.session.get(Club, club_id)
    if not club:
        return jsonify({
            "success": False,
            "message": "Club not found."
        }), 404

    if not club.is_active:
        return jsonify({
            "success": False,
            "message": "This club is inactive."
        }), 400

    if str(club.game_id) != str(competition.game_id):
        return jsonify({
            "success": False,
            "message": "This club belongs to a different game."
        }), 400

    captain_membership = (
        ClubMember.query
        .filter_by(
            club_id=club.id,
            user_id=user.id,
        )
        .first()
    )

    if not captain_membership:
        return jsonify({
            "success": False,
            "message": "You must belong to the selected club to register its team."
        }), 403

    existing_club_entry = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
            club_id=club.id,
        )
        .filter(
            CompetitionParticipant.registration_status.notin_(
                ["REJECTED", "CANCELLED", "DISQUALIFIED"]
            )
        )
        .first()
    )

    if existing_club_entry:
        return jsonify({
            "success": False,
            "message": "This club already has an active entry in this competition."
        }), 409

    selected_memberships = (
        ClubMember.query
        .filter_by(club_id=club.id)
        .filter(ClubMember.user_id.in_(member_ids))
        .all()
    )

    membership_map = {
        membership.user_id: membership
        for membership in selected_memberships
    }

    missing = [
        user_id
        for user_id in member_ids
        if user_id not in membership_map
    ]

    if missing:
        return jsonify({
            "success": False,
            "message": "Every selected player must be a member of the selected club.",
            "invalidMemberIds": missing,
        }), 400

    roster_memberships = [
        membership_map[user_id]
        for user_id in member_ids
    ]

    for membership in roster_memberships:

        member_user = membership.user
        if not member_user:
            return jsonify({
                "success": False,
                "message": "One of the selected players could not be found."
            }), 400

        account_status = str(
            getattr(member_user, "account_status", "active") or "active"
        ).lower()

        if account_status != "active":
            return jsonify({
                "success": False,
                "message": f"{member_user.username or member_user.name} has an inactive account."
            }), 400

        if not user_has_linked_game(member_user, competition.game):
            return jsonify({
                "success": False,
                "message": (
                    f"{member_user.username or member_user.name} must link "
                    f"{competition.game.name} to their SYNCO profile first."
                ),
            }), 400

        committed = get_committed_team_for_user(
            competition,
            member_user.id,
        )

        if committed:
            return jsonify({
                "success": False,
                "message": (
                    f"{member_user.username or member_user.name} is already committed "
                    "to another team in this competition."
                ),
                "conflictParticipantId": committed.id,
            }), 409

    created_at = datetime.utcnow()

    roster_snapshot = []
    invite_rows = []

    for index, membership in enumerate(roster_memberships, start=1):
        member_user = membership.user
        is_captain = member_user.id == user.id

        roster_snapshot.append({
            "userId": member_user.id,
            "uid": member_user.uid,
            "name": member_user.username or member_user.name or f"Player {member_user.id}",
            "username": member_user.username,
            "avatar": member_user.avatar,
            "role": "CAPTAIN" if is_captain else membership.role,
            "status": "ACCEPTED" if is_captain else "PENDING",
            "rosterOrder": index,
        })

    participant = CompetitionParticipant(
        competition_id=competition.id,
        participant_type="TEAM",
        user_id=user.id,
        club_id=club.id,
        team_roster=roster_snapshot,
        registration_status=(
            "ACCEPTED"
            if required_size == 1
            else "PENDING"
        ),
        accepted_at=(
            created_at
            if required_size == 1
            else None
        ),
        registered_at=created_at,
    )

    db.session.add(participant)
    db.session.flush()

    for index, membership in enumerate(roster_memberships, start=1):

        member_user = membership.user
        if member_user.id == user.id:
            continue

        invite = CompetitionTeamInvite(
            competition_id=competition.id,
            participant_id=participant.id,
            invited_user_id=member_user.id,
            invited_by=user.id,
            slot_number=index,
            invite_type="TEAM_MEMBER",
            status="PENDING",
            replaces_user_id=None,
            expires_at=next_invite_expiry(
                competition,
                created_at,
            ),
            created_at=created_at,
        )

        db.session.add(invite)
        db.session.flush()
        invite_rows.append(invite)

        player_name = member_user.username or member_user.name or "a player"
        team_name = club.name

        create_competition_notification(
            member_user.id,
            "COMPETITION_TEAM_INVITE",
            "Tournament Team Invitation",
            (
                f"{user.username or user.name} invited you to join {team_name} "
                f"for {competition.title}."
            ),
            competition.id,
            data={
                "inviteId": invite.id,
                "participantId": participant.id,
                "clubId": club.id,
                "teamName": team_name,
                "captainId": user.id,
                "captainName": user.username or user.name,
                "playerName": player_name,
                "actionStatus": "PENDING",
                "actionUrl": f"/competitions/{competition.id}/register",
                "expiresAt": utc_iso(invite.expires_at),
            },
        )

    create_audit_log(
        competition.id,
        user.id,
        "TEAM_REGISTRATION_STARTED",
        metadata={
            "participantId": participant.id,
            "clubId": club.id,
            "captainId": user.id,
            "selectedUserIds": member_ids,
            "inviteIds": [invite.id for invite in invite_rows],
            "expiresAt": utc_iso(min((invite.expires_at for invite in invite_rows), default=created_at)),
        },
    )

    if required_size == 1:
        notify_team_confirmed(
            competition,
            participant,
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": (
            "Team confirmed."
            if required_size == 1
            else "Team registration submitted. Invites have been sent to the selected players."
        ),
        "participant": serialize_participant(participant),
        "invites": [serialize_team_invite(invite) for invite in invite_rows],
    }), 201


# =========================================================
# TEAM INVITE LIST
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/invites",
    methods=["GET"]
)
def get_team_invites(competition_id):

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

    process_competition_registration_timers(competition, commit=True)

    invites = (
        CompetitionTeamInvite.query
        .filter_by(
            competition_id=competition.id,
            invited_user_id=user.id,
        )
        .order_by(
            CompetitionTeamInvite.created_at.desc()
        )
        .all()
    )

    return jsonify({
        "success": True,
        "invites": [serialize_team_invite(item) for item in invites],
    })


# =========================================================
# ACCEPT TEAM INVITE
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/invites/<int:invite_id>/accept",
    methods=["POST"]
)
def accept_team_invite(competition_id, invite_id):

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

    process_competition_registration_timers(competition, commit=True)
    db.session.refresh(competition)

    invite = (
        CompetitionTeamInvite.query
        .filter_by(
            id=invite_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not invite:
        return jsonify({
            "success": False,
            "message": "Tournament invitation not found."
        }), 404

    if invite.invited_user_id != user.id:
        return jsonify({
            "success": False,
            "message": "You cannot accept this invitation."
        }), 403

    if invite.status != "PENDING":
        return jsonify({
            "success": False,
            "message": f"This invitation is no longer pending. Current state: {invite.status.lower()}."
        }), 400

    if not is_registration_open_now(competition) and invite.invite_type != "SUBSTITUTION":
        return jsonify({
            "success": False,
            "message": "The tournament registration window is closed."
        }), 400

    if datetime.utcnow() >= invite.expires_at:
        invite.status = "EXPIRED"
        invite.responded_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            "success": False,
            "message": "This invitation has expired."
        }), 400

    participant = invite.participant
    if not participant:
        invite.status = "CANCELLED"
        invite.responded_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            "success": False,
            "message": "The team registration no longer exists."
        }), 400

    if str(participant.participant_type or "").upper() != "TEAM":
        return jsonify({
            "success": False,
            "message": "Invalid tournament team entry."
        }), 400

    if not user_has_linked_game(user, competition.game):
        return jsonify({
            "success": False,
            "message": "Link the tournament game to your SYNCO profile before accepting."
        }), 400

    # Substitution cutoff: the replacement must accept before the same cutoff.
    if invite.invite_type == "SUBSTITUTION":
        cutoff = substitution_cutoff(competition)
        if cutoff and datetime.utcnow() >= cutoff:
            invite.status = "EXPIRED"
            invite.responded_at = datetime.utcnow()
            db.session.commit()
            return jsonify({
                "success": False,
                "message": "The substitution window has closed."
            }), 400

    existing_commitment = get_committed_team_for_user(
        competition,
        user.id,
        exclude_participant_id=participant.id,
    )

    if existing_commitment:
        return jsonify({
            "success": False,
            "message": "You are already committed to another team in this competition."
        }), 409

    # Before accepting a normal team invitation, reserve the slot by
    # accepting this invite first and canceling competing pending invites.
    invite.status = "ACCEPTED"
    invite.responded_at = datetime.utcnow()

    if invite.invite_type == "SUBSTITUTION":
        substitution = None
        if invite.substitution_request_id:
            substitution = db.session.get(
                CompetitionSubstitutionRequest,
                invite.substitution_request_id,
            )

        if not substitution or substitution.status != "APPROVED":
            invite.status = "CANCELLED"
            invite.responded_at = None
            db.session.commit()
            return jsonify({
                "success": False,
                "message": "This substitution invite is no longer active."
            }), 400

        outgoing_user_id = substitution.outgoing_user_id
        replacement_user_id = user.id

        outgoing_user = db.session.get(User, outgoing_user_id) if outgoing_user_id else None
        outgoing_name = (
            outgoing_user.username
            or outgoing_user.name
            or "the outgoing player"
        ) if outgoing_user else "the outgoing player"

        current_item = roster_player(
            participant,
            outgoing_user_id,
        )

        if not current_item:
            return jsonify({
                "success": False,
                "message": "The player being replaced is no longer on this roster."
            }), 400

        replacement_item = dict(current_item)
        replacement_item.update({
            "userId": user.id,
            "uid": user.uid,
            "name": user.username or user.name or f"Player {user.id}",
            "username": user.username,
            "avatar": user.avatar,
            "role": "MEMBER",
            "status": "ACCEPTED",
            "replacedFromUserId": outgoing_user_id,
        })

        participant.team_roster = [
            replacement_item if int(item.get("userId")) == int(outgoing_user_id) else dict(item)
            for item in (participant.team_roster or [])
            if isinstance(item, dict)
        ]
        substitution.status = "COMPLETED"
        substitution.completed_at = datetime.utcnow()
        substitution.replacement_user_id = replacement_user_id

        create_audit_log(
            competition.id,
            user.id,
            "SUBSTITUTION_COMPLETED",
            metadata={
                "participantId": participant.id,
                "substitutionRequestId": substitution.id,
                "outgoingUserId": outgoing_user_id,
                "replacementUserId": replacement_user_id,
            },
        )

        mark_competition_notifications_read(
            user.id,
            invite_id=invite.id,
            substitution_request_id=substitution.id,
        )

        for notify_user_id in {
            participant.user_id,
            outgoing_user_id,
            replacement_user_id,
        }:
            if notify_user_id:
                create_competition_notification(
                    notify_user_id,
                    "COMPETITION_SUBSTITUTION_COMPLETED",
                    "Substitution Completed",
                    (
                        f"{user.username or user.name} has replaced "
                        f"{outgoing_name} in the team roster."
                    ),
                    competition.id,
                    data={
                        "participantId": participant.id,
                        "substitutionRequestId": substitution.id,
                        "replacementUserId": replacement_user_id,
                        "outgoingUserId": outgoing_user_id,
                        "teamName": participant.club.name if participant.club else "Tournament Team",
                        "actionStatus": "COMPLETED",
                        "actionUrl": f"/competitions/{competition.id}/register",
                    },
                )

        cancel_other_pending_competition_invites(
            competition,
            user.id,
            accepted_invite_id=invite.id,
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Substitution completed and the roster was updated.",
            "participant": serialize_participant(participant),
            "substitution": serialize_substitution_request(substitution),
        })

    set_roster_player_status(
        participant,
        user.id,
        "ACCEPTED",
    )

    if invite.invite_type == "REPLACEMENT" and invite.replaces_user_id:

        old_user_id = invite.replaces_user_id
        old_item = roster_player(participant, old_user_id)

        if not old_item:
            return jsonify({
                "success": False,
                "message": "The player being replaced is no longer on this roster."
            }), 400

        # Keep the old player until the replacement accepts; we are now at
        # the exact point where the swap is safe to apply.
        old_order = old_item.get("rosterOrder") or next_roster_slot(participant)
        new_item = {
            "userId": user.id,
            "uid": user.uid,
            "name": user.username or user.name or f"Player {user.id}",
            "username": user.username,
            "avatar": user.avatar,
            "role": old_item.get("role") or "MEMBER",
            "status": "ACCEPTED",
            "rosterOrder": old_order,
        }

        participant.team_roster = [
            dict(new_item) if isinstance(item, dict) and int(item.get("userId")) == int(old_user_id) else dict(item)
            for item in (participant.team_roster or [])
            if isinstance(item, dict)
        ]

        create_audit_log(
            competition.id,
            user.id,
            "TEAM_PLAYER_REPLACED",
            metadata={
                "participantId": participant.id,
                "oldUserId": old_user_id,
                "newUserId": user.id,
                "inviteId": invite.id,
            },
        )

    else:
        # Normal teammate acceptance only changes the existing roster entry.
        set_roster_player_status(
            participant,
            user.id,
            "ACCEPTED",
        )

    cancel_other_pending_competition_invites(
        competition,
        user.id,
        accepted_invite_id=invite.id,
    )

    confirm_team_if_complete(
        competition,
        participant,
    )

    mark_competition_notifications_read(
        user.id,
        invite_id=invite.id,
    )

    create_competition_notification(
        participant.user_id,
        "COMPETITION_INVITE_ACCEPTED",
        "Player Accepted",
        (
            f"{user.username or user.name or 'A player'} accepted the invitation to join "
            f"{participant.club.name if participant.club else 'your tournament team'}."
        ),
        competition.id,
        data={
            "inviteId": invite.id,
            "participantId": participant.id,
            "userId": user.id,
            "clubId": participant.club_id,
            "teamName": participant.club.name if participant.club else "Tournament Team",
            "actionStatus": "ACCEPTED",
            "actionUrl": f"/competitions/{competition.id}/register",
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "You accepted the tournament team invitation.",
        "participant": serialize_participant(participant),
        "invite": serialize_team_invite(invite),
    })


# =========================================================
# DECLINE TEAM INVITE
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/invites/<int:invite_id>/decline",
    methods=["POST"]
)
def decline_team_invite(competition_id, invite_id):

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

    process_competition_registration_timers(competition, commit=True)

    invite = (
        CompetitionTeamInvite.query
        .filter_by(
            id=invite_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not invite:
        return jsonify({
            "success": False,
            "message": "Tournament invitation not found."
        }), 404

    if invite.invited_user_id != user.id:
        return jsonify({
            "success": False,
            "message": "You cannot decline this invitation."
        }), 403

    if invite.status != "PENDING":
        return jsonify({
            "success": False,
            "message": f"This invitation is no longer pending. Current state: {invite.status.lower()}."
        }), 400

    invite.status = "DECLINED"
    invite.responded_at = datetime.utcnow()

    participant = invite.participant
    if participant:
        set_roster_player_status(
            participant,
            user.id,
            "DECLINED",
        )

        team_name = participant.club.name if participant.club else "Tournament Team"

        create_competition_notification(
            participant.user_id,
            "COMPETITION_INVITE_DECLINED",
            "Player Declined",
            (
                f"{user.username or user.name or 'A player'} declined the invitation "
                f"to join {team_name}."
            ),
            competition.id,
            data={
                "inviteId": invite.id,
                "participantId": participant.id,
                "userId": user.id,
                "clubId": participant.club_id,
                "teamName": team_name,
                "actionStatus": "DECLINED",
                "actionUrl": f"/competitions/{competition.id}/register",
            },
        )

        if invite.invite_type == "SUBSTITUTION" and invite.substitution_request_id:
            substitution = db.session.get(
                CompetitionSubstitutionRequest,
                invite.substitution_request_id,
            )
            if substitution and substitution.status == "APPROVED":
                substitution.status = "REJECTED"
                substitution.rejection_reason = "Replacement player declined the substitution invite."
                substitution.decided_at = datetime.utcnow()
                create_audit_log(
                    competition.id,
                    user.id,
                    "SUBSTITUTION_REPLACEMENT_DECLINED",
                    metadata={
                        "participantId": participant.id,
                        "substitutionRequestId": substitution.id,
                        "replacementUserId": user.id,
                    },
                )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Tournament invitation declined.",
        "invite": serialize_team_invite(invite),
    })


# =========================================================
# PRE-DEADLINE PLAYER REPLACEMENT
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/replace",
    methods=["POST"]
)
def replace_team_player(competition_id):

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

    process_competition_registration_timers(competition, commit=True)
    db.session.refresh(competition)

    if sync_registration_status(competition):
        db.session.commit()

    if not is_registration_open_now(competition):
        return jsonify({
            "success": False,
            "message": "Roster changes are closed because registration has ended."
        }), 400

    participant = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
            user_id=user.id,
        )
        .filter(
            CompetitionParticipant.registration_status.in_(["PENDING", "ACCEPTED"])
        )
        .first()
    )

    if not participant:
        return jsonify({
            "success": False,
            "message": "You are not the captain of an active team entry in this competition."
        }), 403

    data = request.get_json(silent=True) or {}

    try:
        outgoing_user_id = int(data.get("outgoingUserId"))
        replacement_user_id = int(data.get("replacementUserId"))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "A valid outgoing player and replacement player are required."
        }), 400

    if outgoing_user_id == user.id:
        return jsonify({
            "success": False,
            "message": "The captain cannot be replaced through this flow."
        }), 400

    outgoing_item = roster_player(participant, outgoing_user_id)
    if not outgoing_item:
        return jsonify({
            "success": False,
            "message": "The selected player is not on this tournament roster."
        }), 400

    outgoing_status = str(outgoing_item.get("status") or "").upper()
    if outgoing_status == "PENDING":
        return jsonify({
            "success": False,
            "message": "Wait for this player to respond before replacing them."
        }), 400

    replacement_user = db.session.get(User, replacement_user_id)
    if not replacement_user:
        return jsonify({
            "success": False,
            "message": "Replacement player not found."
        }), 404

    if replacement_user_id == user.id:
        return jsonify({
            "success": False,
            "message": "The captain is already on this roster."
        }), 400

    if roster_player(participant, replacement_user_id):
        return jsonify({
            "success": False,
            "message": "That player is already on your tournament roster."
        }), 409

    club_membership = (
        ClubMember.query
        .filter_by(
            club_id=participant.club_id,
            user_id=replacement_user_id,
        )
        .first()
    )

    if not club_membership:
        return jsonify({
            "success": False,
            "message": "The replacement must be a member of the same club."
        }), 400

    if str(getattr(replacement_user, "account_status", "active") or "active").lower() != "active":
        return jsonify({
            "success": False,
            "message": "The replacement player's account is not active."
        }), 400

    if not user_has_linked_game(replacement_user, competition.game):
        return jsonify({
            "success": False,
            "message": "The replacement player must have this game linked to their profile."
        }), 400

    committed = get_committed_team_for_user(
        competition,
        replacement_user_id,
        exclude_participant_id=participant.id,
    )

    if committed:
        return jsonify({
            "success": False,
            "message": "The replacement player is already committed to another team in this competition."
        }), 409

    existing_pending_replacement = (
        CompetitionTeamInvite.query
        .filter_by(
            participant_id=participant.id,
            invited_user_id=replacement_user_id,
            invite_type="REPLACEMENT",
            status="PENDING",
        )
        .first()
    )

    if existing_pending_replacement:
        return jsonify({
            "success": False,
            "message": "A replacement invitation is already pending for this player."
        }), 409

    created_at = datetime.utcnow()
    invite = CompetitionTeamInvite(
        competition_id=competition.id,
        participant_id=participant.id,
        invited_user_id=replacement_user_id,
        invited_by=user.id,
        slot_number=int(outgoing_item.get("rosterOrder") or 1),
        invite_type="REPLACEMENT",
        status="PENDING",
        replaces_user_id=outgoing_user_id,
        expires_at=next_invite_expiry(competition, created_at),
        created_at=created_at,
    )

    db.session.add(invite)
    db.session.flush()

    create_competition_notification(
        replacement_user_id,
        "COMPETITION_REPLACEMENT_INVITE",
        "Tournament Replacement Invitation",
        (
            f"{user.username or user.name} invited you to replace a player in "
            f"{participant.club.name if participant.club else 'their tournament team'}."
        ),
        competition.id,
        data={
            "inviteId": invite.id,
            "participantId": participant.id,
            "clubId": participant.club_id,
            "teamName": participant.club.name if participant.club else "Tournament Team",
            "captainId": user.id,
            "replacesUserId": outgoing_user_id,
            "actionStatus": "PENDING",
            "actionUrl": f"/competitions/{competition.id}/register",
            "expiresAt": utc_iso(invite.expires_at),
        },
    )

    create_competition_notification(
        user.id,
        "COMPETITION_REPLACEMENT_REQUESTED",
        "Replacement Invitation Sent",
        (
            f"A replacement invitation was sent to "
            f"{replacement_user.username or replacement_user.name or 'the new player'}."
        ),
        competition.id,
        data={
            "inviteId": invite.id,
            "participantId": participant.id,
            "clubId": participant.club_id,
            "replacesUserId": outgoing_user_id,
            "replacementUserId": replacement_user_id,
            "actionStatus": "PENDING",
            "actionUrl": f"/competitions/{competition.id}/register",
            "expiresAt": utc_iso(invite.expires_at),
        },
    )

    create_audit_log(
        competition.id,
        user.id,
        "TEAM_REPLACEMENT_REQUESTED",
        metadata={
            "participantId": participant.id,
            "clubId": participant.club_id,
            "outgoingUserId": outgoing_user_id,
            "replacementUserId": replacement_user_id,
            "inviteId": invite.id,
            "expiresAt": utc_iso(invite.expires_at),
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Replacement invitation sent. The current player remains on the roster until the replacement accepts.",
        "invite": serialize_team_invite(invite),
        "participant": serialize_participant(participant),
    })


# =========================================================
# SUBSTITUTION REQUESTS
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/substitution-requests",
    methods=["GET"]
)
def get_substitution_requests(competition_id):

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

    process_competition_registration_timers(competition, commit=True)

    is_host = competition.organizer_id == user.id

    query = CompetitionSubstitutionRequest.query.filter_by(
        competition_id=competition.id
    )

    if not is_host:
        participant = (
            CompetitionParticipant.query
            .filter_by(
                competition_id=competition.id,
                participant_type="TEAM",
                user_id=user.id,
            )
            .first()
        )
        if not participant:
            return jsonify({
                "success": False,
                "message": "You do not have access to substitution requests for this competition."
            }), 403
        query = query.filter_by(participant_id=participant.id)

    rows = query.order_by(
        CompetitionSubstitutionRequest.requested_at.desc()
    ).all()

    return jsonify({
        "success": True,
        "requests": [serialize_substitution_request(item) for item in rows],
    })


@competition_bp.route(
    "/<int:competition_id>/registration/substitution-requests",
    methods=["POST"]
)
def request_substitution(competition_id):

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

    process_competition_registration_timers(competition, commit=True)

    participant = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
            user_id=user.id,
            registration_status="LOCKED",
        )
        .first()
    )

    if not participant:
        return jsonify({
            "success": False,
            "message": "Only the locked team captain can request a substitution."
        }), 403

    cutoff = substitution_cutoff(competition)
    if cutoff and datetime.utcnow() >= cutoff:
        return jsonify({
            "success": False,
            "message": "Substitution requests are closed for the next match."
        }), 400

    used_substitutions = (
        CompetitionSubstitutionRequest.query
        .filter_by(
            participant_id=participant.id,
            status="COMPLETED",
        )
        .count()
    )

    max_substitutions = _registration_settings(competition)["maxSubstitutions"]
    if used_substitutions >= max_substitutions:
        return jsonify({
            "success": False,
            "message": "This team has reached its substitution limit."
        }), 400

    data = request.get_json(silent=True) or {}

    try:
        outgoing_user_id = int(data.get("outgoingUserId"))
        replacement_user_id = int(data.get("replacementUserId"))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "A valid outgoing player and replacement player are required."
        }), 400

    reason = str(data.get("reason", "")).strip()
    if not reason:
        return jsonify({
            "success": False,
            "message": "A substitution reason is required."
        }), 400

    if outgoing_user_id == user.id:
        return jsonify({
            "success": False,
            "message": "The captain cannot be removed through the current substitution flow."
        }), 400

    outgoing_item = roster_player(participant, outgoing_user_id)
    if not outgoing_item or str(outgoing_item.get("status") or "").upper() != "ACCEPTED":
        return jsonify({
            "success": False,
            "message": "Select an accepted roster player to replace."
        }), 400

    replacement_user = db.session.get(User, replacement_user_id)
    if not replacement_user:
        return jsonify({
            "success": False,
            "message": "Replacement player not found."
        }), 404

    if replacement_user_id == outgoing_user_id:
        return jsonify({
            "success": False,
            "message": "The replacement player must be different from the outgoing player."
        }), 400

    if roster_player(participant, replacement_user_id):
        return jsonify({
            "success": False,
            "message": "The replacement player is already on this roster."
        }), 409

    if str(getattr(replacement_user, "account_status", "active") or "active").lower() != "active":
        return jsonify({
            "success": False,
            "message": "The replacement player's account is not active."
        }), 400

    if not user_has_linked_game(replacement_user, competition.game):
        return jsonify({
            "success": False,
            "message": "The replacement player must have this game linked to their profile."
        }), 400

    club_membership = (
        ClubMember.query
        .filter_by(
            club_id=participant.club_id,
            user_id=replacement_user_id,
        )
        .first()
    )

    if not club_membership:
        return jsonify({
            "success": False,
            "message": "The replacement player must belong to the same club."
        }), 400

    committed = get_committed_team_for_user(
        competition,
        replacement_user_id,
        exclude_participant_id=participant.id,
    )

    if committed:
        return jsonify({
            "success": False,
            "message": "The replacement player is already committed to another team in this competition."
        }), 409

    existing_pending = (
        CompetitionSubstitutionRequest.query
        .filter_by(
            participant_id=participant.id,
            status="PENDING",
        )
        .first()
    )

    if existing_pending:
        return jsonify({
            "success": False,
            "message": "This team already has a pending substitution request."
        }), 409

    now = datetime.utcnow()
    approval_minutes = _registration_settings(competition)["substitutionApprovalMinutes"]
    decision_deadline = now + timedelta(minutes=approval_minutes)

    if cutoff:
        decision_deadline = min(decision_deadline, cutoff)

    request_row = CompetitionSubstitutionRequest(
        competition_id=competition.id,
        participant_id=participant.id,
        captain_id=user.id,
        outgoing_user_id=outgoing_user_id,
        replacement_user_id=replacement_user_id,
        reason=reason,
        status="PENDING",
        requested_at=now,
        decision_deadline=decision_deadline,
    )

    db.session.add(request_row)
    db.session.flush()

    team_name = participant.club.name if participant.club else "Tournament Team"

    # Host + all involved players are informed immediately; the actual
    # replacement invite is only created after host approval.
    create_competition_notification(
        competition.organizer_id,
        "COMPETITION_SUBSTITUTION_REQUESTED",
        "Substitution Requested",
        f"{team_name} requested a substitution.",
        competition.id,
        data={
            "participantId": participant.id,
            "substitutionRequestId": request_row.id,
            "captainId": user.id,
            "outgoingUserId": outgoing_user_id,
            "replacementUserId": replacement_user_id,
            "teamName": team_name,
            "actionStatus": "PENDING",
            "actionUrl": f"/live-tournament/{competition.id}",
            "decisionDeadline": utc_iso(decision_deadline),
        },
    )

    for involved_user_id in {
        user.id,
        outgoing_user_id,
        replacement_user_id,
    }:
        create_competition_notification(
            involved_user_id,
            "COMPETITION_SUBSTITUTION_REQUESTED",
            "Substitution Requested",
            (
                f"A substitution was requested for {team_name}. "
                "Host approval is required before any roster change."
            ),
            competition.id,
            data={
                "participantId": participant.id,
                "substitutionRequestId": request_row.id,
                "captainId": user.id,
                "outgoingUserId": outgoing_user_id,
                "replacementUserId": replacement_user_id,
                "teamName": team_name,
                "actionStatus": "PENDING",
                "actionUrl": f"/competitions/{competition.id}/register",
                "decisionDeadline": utc_iso(decision_deadline),
            },
        )

    create_audit_log(
        competition.id,
        user.id,
        "SUBSTITUTION_REQUESTED",
        metadata={
            "participantId": participant.id,
            "substitutionRequestId": request_row.id,
            "outgoingUserId": outgoing_user_id,
            "replacementUserId": replacement_user_id,
            "reason": reason,
            "decisionDeadline": utc_iso(decision_deadline),
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Substitution request sent to the host.",
        "request": serialize_substitution_request(request_row),
    }), 201


# =========================================================
# HOST APPROVE SUBSTITUTION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/substitution-requests/<int:request_id>/approve",
    methods=["POST"]
)
def approve_substitution(competition_id, request_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    host, error = organizer_required(competition)
    if error:
        return error

    process_competition_registration_timers(competition, commit=True)

    request_row = (
        CompetitionSubstitutionRequest.query
        .filter_by(
            id=request_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not request_row:
        return jsonify({
            "success": False,
            "message": "Substitution request not found."
        }), 404

    if request_row.status != "PENDING":
        return jsonify({
            "success": False,
            "message": "This substitution request is no longer pending."
        }), 400

    if datetime.utcnow() >= request_row.decision_deadline:
        request_row.status = "REJECTED"
        request_row.decided_at = datetime.utcnow()
        request_row.decided_by = host.id
        request_row.rejection_reason = "Host approval deadline expired."
        db.session.commit()
        return jsonify({
            "success": False,
            "message": "The host approval deadline has expired."
        }), 400

    participant = request_row.participant
    replacement_user = db.session.get(User, request_row.replacement_user_id)

    if not participant or not replacement_user:
        return jsonify({
            "success": False,
            "message": "The substitution roster is no longer valid."
        }), 400

    if not is_registration_open_now(competition) and participant.registration_status != "LOCKED":
        return jsonify({
            "success": False,
            "message": "The competition is not in a substitution-capable state."
        }), 400

    if not user_has_linked_game(replacement_user, competition.game):
        return jsonify({
            "success": False,
            "message": "The replacement player is no longer game eligible."
        }), 400

    if not (
        ClubMember.query
        .filter_by(
            club_id=participant.club_id,
            user_id=replacement_user.id,
        )
        .first()
    ):
        return jsonify({
            "success": False,
            "message": "The replacement player is no longer a member of the team club."
        }), 400

    request_row.status = "APPROVED"
    request_row.decided_at = datetime.utcnow()
    request_row.decided_by = host.id

    created_at = datetime.utcnow()
    invite_expiry = created_at + timedelta(
        hours=_registration_settings(competition)["inviteDurationHours"]
    )

    cutoff = substitution_cutoff(competition)
    if cutoff:
        invite_expiry = min(invite_expiry, cutoff)

    invite = CompetitionTeamInvite(
        competition_id=competition.id,
        participant_id=participant.id,
        invited_user_id=replacement_user.id,
        invited_by=host.id,
        slot_number=next_roster_slot(participant),
        invite_type="SUBSTITUTION",
        status="PENDING",
        replaces_user_id=request_row.outgoing_user_id,
        substitution_request_id=request_row.id,
        expires_at=invite_expiry,
        created_at=created_at,
    )

    db.session.add(invite)
    db.session.flush()

    request_row.replacement_invite_id = invite.id

    team_name = participant.club.name if participant.club else "Tournament Team"

    create_competition_notification(
        replacement_user.id,
        "COMPETITION_SUBSTITUTION_INVITE",
        "Substitution Approved",
        (
            f"The host approved your replacement for {team_name}. "
            "Accept the tournament invitation to complete the swap."
        ),
        competition.id,
        data={
            "participantId": participant.id,
            "substitutionRequestId": request_row.id,
            "inviteId": invite.id,
            "outgoingUserId": request_row.outgoing_user_id,
            "replacementUserId": replacement_user.id,
            "teamName": team_name,
            "actionStatus": "PENDING",
            "actionUrl": f"/competitions/{competition.id}/register",
            "expiresAt": utc_iso(invite.expires_at),
        },
    )

    for involved_user_id in {
        request_row.captain_id,
        request_row.outgoing_user_id,
    }:
        if involved_user_id:
            create_competition_notification(
                involved_user_id,
                "COMPETITION_SUBSTITUTION_APPROVED",
                "Substitution Approved",
                (
                    f"The host approved the substitution for {team_name}. "
                    "The replacement player must accept the invite before the swap is completed."
                ),
                competition.id,
                data={
                    "participantId": participant.id,
                    "substitutionRequestId": request_row.id,
                    "inviteId": invite.id,
                    "outgoingUserId": request_row.outgoing_user_id,
                    "replacementUserId": replacement_user.id,
                    "teamName": team_name,
                    "actionStatus": "APPROVED",
                    "actionUrl": f"/competitions/{competition.id}/register",
                },
            )

    create_audit_log(
        competition.id,
        host.id,
        "SUBSTITUTION_APPROVED",
        metadata={
            "participantId": participant.id,
            "substitutionRequestId": request_row.id,
            "outgoingUserId": request_row.outgoing_user_id,
            "replacementUserId": replacement_user.id,
            "replacementInviteId": invite.id,
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Substitution approved. The replacement player must accept the invite.",
        "request": serialize_substitution_request(request_row),
        "invite": serialize_team_invite(invite),
    })


# =========================================================
# HOST REJECT SUBSTITUTION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/substitution-requests/<int:request_id>/reject",
    methods=["POST"]
)
def reject_substitution(competition_id, request_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    host, error = organizer_required(competition)
    if error:
        return error

    request_row = (
        CompetitionSubstitutionRequest.query
        .filter_by(
            id=request_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not request_row:
        return jsonify({
            "success": False,
            "message": "Substitution request not found."
        }), 404

    if request_row.status != "PENDING":
        return jsonify({
            "success": False,
            "message": "This substitution request is no longer pending."
        }), 400

    data = request.get_json(silent=True) or {}
    reason = str(
        data.get("reason")
        or data.get("rejectionReason")
        or "Rejected by host."
    ).strip()

    request_row.status = "REJECTED"
    request_row.decided_at = datetime.utcnow()
    request_row.decided_by = host.id
    request_row.rejection_reason = reason

    participant = request_row.participant
    team_name = participant.club.name if participant and participant.club else "Tournament Team"

    for involved_user_id in {
        request_row.captain_id,
        request_row.outgoing_user_id,
        request_row.replacement_user_id,
    }:
        if involved_user_id:
            create_competition_notification(
                involved_user_id,
                "COMPETITION_SUBSTITUTION_REJECTED",
                "Substitution Rejected",
                f"The host rejected the substitution for {team_name}: {reason}",
                competition.id,
                data={
                    "participantId": request_row.participant_id,
                    "substitutionRequestId": request_row.id,
                    "outgoingUserId": request_row.outgoing_user_id,
                    "replacementUserId": request_row.replacement_user_id,
                    "teamName": team_name,
                    "actionStatus": "REJECTED",
                    "actionUrl": f"/competitions/{competition.id}/register",
                },
            )

    create_audit_log(
        competition.id,
        host.id,
        "SUBSTITUTION_REJECTED",
        metadata={
            "participantId": request_row.participant_id,
            "substitutionRequestId": request_row.id,
            "outgoingUserId": request_row.outgoing_user_id,
            "replacementUserId": request_row.replacement_user_id,
            "reason": reason,
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Substitution request rejected.",
        "request": serialize_substitution_request(request_row),
    })


# =========================================================
# WITHDRAW REGISTRATION
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/withdraw",
    methods=["DELETE", "POST"]
)
def withdraw_registration(competition_id):

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

    process_competition_registration_timers(competition, commit=True)

    if sync_registration_status(competition):
        db.session.commit()

    if not is_registration_open_now(competition):
        return jsonify({
            "success": False,
            "message": "Registration withdrawal is closed."
        }), 400

    participant = user_has_any_active_competition_entry(
        competition,
        user.id,
    )

    if not participant:
        return jsonify({
            "success": False,
            "message": "No active registration found for your account."
        }), 404

    if (
        str(participant.participant_type or "").upper() == "TEAM"
        and participant.user_id != user.id
    ):
        return jsonify({
            "success": False,
            "message": "Only the team captain can withdraw the tournament registration."
        }), 403

    if participant.registration_status not in ("PENDING", "ACCEPTED"):
        return jsonify({
            "success": False,
            "message": "This registration cannot be withdrawn."
        }), 400

    roster_before = getattr(participant, "team_roster", None) or []

    participant.registration_status = "CANCELLED"

    invites = (
        CompetitionTeamInvite.query
        .filter_by(
            participant_id=participant.id,
            status="PENDING",
        )
        .all()
    )

    for invite in invites:
        invite.status = "CANCELLED"
        invite.responded_at = datetime.utcnow()
        set_roster_player_status(
            participant,
            invite.invited_user_id,
            "CANCELLED",
        )

    notified_ids = {
        participant.user_id,
        *team_member_ids(participant, accepted_only=True),
    }

    team_name = participant.club.name if participant.club else "Your tournament entry"

    for user_id in notified_ids:
        if not user_id:
            continue
        create_competition_notification(
            user_id,
            "COMPETITION_REGISTRATION_CANCELLED",
            "Tournament Registration Withdrawn",
            f"{team_name} withdrew from {competition.title}.",
            competition.id,
            data={
                "participantId": participant.id,
                "clubId": participant.club_id,
                "teamName": team_name,
                "actionStatus": "CANCELLED",
                "actionUrl": f"/competitions/{competition.id}/register",
            },
        )

    create_audit_log(
        competition.id,
        user.id,
        "REGISTRATION_WITHDRAWN",
        metadata={
            "participantId": participant.id,
            "participantType": participant.participant_type,
            "clubId": participant.club_id,
            "roster": roster_before,
        },
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Tournament registration withdrawn.",
    })


# =========================================================
# GET PARTICIPANTS
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/participants",
    methods=["GET"]
)
def get_participants(competition_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    process_competition_registration_timers(competition, commit=True)

    participants = (
        CompetitionParticipant.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionParticipant.seed.asc().nullslast(),
            CompetitionParticipant.registered_at.asc()
        )
        .all()
    )

    return jsonify({
        "success": True,
        "participants": [serialize_participant(item) for item in participants],
    })


# =========================================================
# ACCEPT PARTICIPANT (ORGANIZER COMPATIBILITY)
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/participants/<int:participant_id>/accept",
    methods=["POST"]
)
def accept_participant(competition_id, participant_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(competition)
    if error:
        return error

    process_competition_registration_timers(competition, commit=True)

    participant = (
        CompetitionParticipant.query
        .filter_by(
            id=participant_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not participant:
        return jsonify({
            "success": False,
            "message": "Participant not found."
        }), 404

    if participant.participant_type == "TEAM":
        if not team_is_complete(participant, competition):
            return jsonify({
                "success": False,
                "message": "A team can only be confirmed after every roster spot is accepted."
            }), 400

        participant.registration_status = "ACCEPTED"
        participant.accepted_at = datetime.utcnow()
    else:
        participant.registration_status = "ACCEPTED"
        participant.accepted_at = datetime.utcnow()

    create_audit_log(
        competition.id,
        user.id,
        "PARTICIPANT_ACCEPTED",
        metadata={"participantId": participant.id},
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Participant accepted.",
        "participant": serialize_participant(participant),
    })


# =========================================================
# REJECT PARTICIPANT (ORGANIZER COMPATIBILITY)
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/participants/<int:participant_id>/reject",
    methods=["POST"]
)
def reject_participant(competition_id, participant_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(competition)
    if error:
        return error

    participant = (
        CompetitionParticipant.query
        .filter_by(
            id=participant_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not participant:
        return jsonify({
            "success": False,
            "message": "Participant not found."
        }), 404

    participant.registration_status = "REJECTED"

    create_audit_log(
        competition.id,
        user.id,
        "PARTICIPANT_REJECTED",
        metadata={"participantId": participant.id},
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Participant rejected.",
        "participant": serialize_participant(participant),
    })


# =========================================================
# LOCK PARTICIPANTS
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/lock-participants",
    methods=["POST"]
)
def lock_participants(competition_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user, error = organizer_required(competition)
    if error:
        return error

    process_competition_registration_timers(competition, commit=True)
    db.session.refresh(competition)

    if competition.status not in ("REGISTRATION_CLOSED", "READY"):
        return jsonify({
            "success": False,
            "message": "Registration must be closed before locking participants."
        }), 400

    participants = (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            registration_status="ACCEPTED",
        )
        .order_by(CompetitionParticipant.registered_at.asc())
        .all()
    )

    if len(participants) < 2:
        return jsonify({
            "success": False,
            "message": "At least 2 confirmed participants are required."
        }), 400

    participants = participants[:competition.max_participants]

    for index, participant in enumerate(participants, start=1):
        participant.seed = index
        participant.registration_status = "LOCKED"

    competition.status = "READY"

    create_audit_log(
        competition.id,
        user.id,
        "PARTICIPANTS_LOCKED",
        metadata={"participantCount": len(participants)},
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Participants locked.",
        "participantCount": len(participants),
    })


# =========================================================
# REGISTRATION MAINTENANCE
# =========================================================

@competition_bp.route(
    "/<int:competition_id>/registration/maintenance",
    methods=["POST"]
)
def registration_maintenance(competition_id):

    competition = db.session.get(Competition, competition_id)
    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found."
        }), 404

    user = current_user()
    if not user:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    # Organizer or an account that is directly participating in the event
    # can trigger a safe maintenance pass. This keeps the endpoint usable
    # from the frontend while still not allowing arbitrary competition data.
    authorized = (
        user.id == competition.organizer_id
        or user_has_any_active_competition_entry(competition, user.id) is not None
        or CompetitionTeamInvite.query.filter_by(
            competition_id=competition.id,
            invited_user_id=user.id,
            status="PENDING",
        ).first() is not None
    )

    if not authorized:
        return jsonify({
            "success": False,
            "message": "You are not part of this competition."
        }), 403

    changed = process_competition_registration_timers(
        competition,
        commit=True,
    )

    return jsonify({
        "success": True,
        "changed": bool(changed),
        "competitionStatus": competition.status,
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
