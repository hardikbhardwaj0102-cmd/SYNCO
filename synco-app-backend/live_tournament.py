# =========================================================
# SYNCO LIVE TOURNAMENT DASHBOARD API
# =========================================================
#
# Existing SYNCO competition schema only.
#
# This dashboard:
#   1. Locks the live dashboard until competition_start.
#   2. Automatically activates the competition when start time arrives.
#   3. Lets only the organizer enter match statistics.
#   4. Records kills + placement per player in PlayerMatchStats.extra_stats.
#   5. Keeps the existing PlayerMatchStats.score as the tournament score.
#   6. Keeps TeamMatchStats / CompetitionStanding synchronized.
#   7. Exposes Overview, Leaderboard, Matches and Final Results data.
#
# No new database tables are required.
# =========================================================

from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func

from models import (
    db,
    User,
    ClubMember,
    Competition,
    CompetitionStage,
    CompetitionParticipant,
    CompetitionMatch,
    MatchParticipant,
    MatchResult,
    TeamMatchStats,
    PlayerMatchStats,
    CompetitionStanding,
    VerificationRecord,
)


# =========================================================
# BLUEPRINT
# =========================================================

live_tournament_bp = Blueprint(
    "live_tournament",
    __name__,
    url_prefix="/api/live-tournaments",
)


# =========================================================
# STATUS GROUPS
# =========================================================

TERMINAL_COMPETITION_STATUSES = {
    "COMPLETED",
    "CANCELLED",
    "CANCELED",
}

PRE_LIVE_COMPETITION_STATUSES = {
    "DRAFT",
    "PENDING",
    "READY",
    "SCHEDULED",
    "REGISTRATION_OPEN",
    "REGISTRATION_CLOSED",
    "PUBLISHED",
    "OPEN",
}


# =========================================================
# AUTH HELPERS
# =========================================================

def current_user():
    """Resolve the current SYNCO user from the existing session."""

    user_id = session.get("user_id")

    if not user_id:
        session_user = session.get("user") or {}
        user_id = session_user.get("id")

    if not user_id:
        return None

    return db.session.get(User, user_id)


def organizer_required(competition):
    """
    Only the competition organizer may start matches or save scores.

    The tournament start time is always enforced server-side.
    """

    user = current_user()

    if not user:
        return None, (
            jsonify({
                "success": False,
                "message": "Authentication required.",
            }),
            401,
        )

    if competition.organizer_id != user.id:
        return None, (
            jsonify({
                "success": False,
                "message": "Organizer access required.",
            }),
            403,
        )

    account_status = str(
        getattr(user, "account_status", "active") or "active"
    ).strip().lower()

    if account_status != "active":
        return None, (
            jsonify({
                "success": False,
                "message": "Your account is not active.",
                "accountStatus": account_status,
            }),
            403,
        )

    if str(competition.participant_type or "").upper() != "TEAM":
        return None, (
            jsonify({
                "success": False,
                "message": "The live team dashboard requires a TEAM competition.",
            }),
            400,
        )

    access = get_competition_access(
        competition,
        persist_live_state=True,
    )

    if access["phase"] != "LIVE":
        return None, (
            jsonify({
                "success": False,
                "message": access["message"],
                "access": access,
            }),
            409,
        )

    return user, None


# =========================================================
# GENERAL HELPERS
# =========================================================

SYNCO_TIMEZONE = ZoneInfo("Asia/Kolkata")


def synco_now():
    """Return the current SYNCO tournament time as a naive IST datetime.

    Existing competition_start values are stored as naive datetimes and
    represent the India time selected by the organizer. Therefore the live
    dashboard must compare them against the current IST clock, not UTC.
    """

    return datetime.now(SYNCO_TIMEZONE).replace(tzinfo=None)


def scheduled_time(value):
    """Normalize a competition schedule value to naive Asia/Kolkata time."""

    if not value:
        return None

    if value.tzinfo is not None:
        return value.astimezone(SYNCO_TIMEZONE).replace(tzinfo=None)

    return value


def iso_datetime(value):
    """Serialize tournament schedule values with an explicit IST offset."""

    if not value:
        return None

    local_value = scheduled_time(value)

    return local_value.replace(
        tzinfo=SYNCO_TIMEZONE
    ).isoformat()


def get_competition(competition_id):
    return db.session.get(Competition, competition_id)


def get_stage(competition):
    stage = (
        CompetitionStage.query
        .filter_by(
            competition_id=competition.id,
            stage_order=1,
        )
        .first()
    )

    if stage:
        return stage

    return (
        CompetitionStage.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionStage.stage_order.asc().nullslast(),
            CompetitionStage.id.asc(),
        )
        .first()
    )


def display_user_name(user):
    if not user:
        return "Unknown Player"

    return (
        user.username
        or getattr(user, "name", None)
        or f"Player {user.id}"
    )


def display_team_name(participant):
    if participant.club:
        return participant.club.name

    if participant.user:
        return display_user_name(participant.user)

    return "Unknown Team"


def get_team_participants(competition):
    """
    Return registered team participants.

    The existing registration system remains the source of truth.
    This dashboard never adds/removes players or teams.
    """

    return (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
        )
        .filter(
            CompetitionParticipant.registration_status.notin_(
                ["REJECTED", "DISQUALIFIED"]
            )
        )
        .order_by(
            CompetitionParticipant.seed.asc().nullslast(),
            CompetitionParticipant.id.asc(),
        )
        .all()
    )


def get_team_members(participant):
    """Read the existing club roster. Never mutates the roster."""

    club_id = participant.club_id

    if not club_id:
        return []

    memberships = (
        ClubMember.query
        .filter_by(club_id=club_id)
        .order_by(
            ClubMember.joined_at.asc().nullslast(),
            ClubMember.id.asc(),
        )
        .all()
    )

    return [
        membership.user
        for membership in memberships
        if membership.user
    ]


def get_player_match_stat(match_id, user_id):
    return (
        PlayerMatchStats.query
        .filter_by(
            match_id=match_id,
            user_id=user_id,
        )
        .first()
    )


def as_non_negative_int(value, field_name, allow_blank=False):
    if allow_blank and value in (None, ""):
        return None

    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid number.")

    if parsed < 0:
        raise ValueError(f"{field_name} cannot be negative.")

    return parsed


def stat_placement(stat):
    extra = stat.extra_stats or {}

    raw = (
        extra.get("placement")
        if isinstance(extra, dict)
        else None
    )

    if raw in (None, ""):
        return None

    try:
        placement = int(raw)
    except (TypeError, ValueError):
        return None

    return placement if placement > 0 else None


def competition_access_message(phase, seconds_until_start):
    if phase == "UPCOMING":
        if seconds_until_start is not None:
            return "Tournament has not started yet."
        return "Tournament start time is not available."

    if phase == "LIVE":
        return "Tournament is live."

    if phase == "COMPLETED":
        return "Tournament is completed."

    if phase == "CANCELLED":
        return "Tournament has been cancelled."

    return "Tournament is not available."


def get_competition_access(competition, persist_live_state=False):
    """
    Server-authoritative access state.

    The UI may count down locally, but every protected write endpoint
    checks this state again on the server.
    """

    now = synco_now()
    status = str(competition.status or "").upper()
    start_at = scheduled_time(competition.competition_start)

    phase = None
    seconds_until_start = None
    changed = False

    if status in TERMINAL_COMPETITION_STATUSES:
        phase = (
            "CANCELLED"
            if status in {"CANCELLED", "CANCELED"}
            else "COMPLETED"
        )

    elif start_at and now < start_at:
        phase = "UPCOMING"
        seconds_until_start = max(
            0,
            int((start_at - now).total_seconds()),
        )

    elif not start_at and status != "LIVE":
        # Existing tournaments without a scheduled time keep their
        # current status. The organizer can still use the old manual
        # start flow when there is no competition_start value.
        phase = "UPCOMING"

    else:
        phase = "LIVE"

        if persist_live_state and status != "LIVE":
            competition.status = "LIVE"

            stage = get_stage(competition)

            if stage and str(stage.status or "").upper() in {
                "PENDING",
                "READY",
                "SCHEDULED",
            }:
                stage.status = "LIVE"

            changed = True

    if changed:
        db.session.commit()

    user = current_user()

    can_enter = phase in {"LIVE", "COMPLETED"}
    is_organizer = bool(
        user and competition.organizer_id == user.id
    )

    return {
        "phase": phase,
        "canEnter": can_enter,
        "isLive": phase == "LIVE",
        "isOrganizer": is_organizer,
        "startAt": iso_datetime(start_at),
        "secondsUntilStart": seconds_until_start,
        "serverNow": iso_datetime(now),
        "message": competition_access_message(
            phase,
            seconds_until_start,
        ),
    }


def player_points_for_competition(
    competition_id,
    participant_id,
    user_id,
):
    value = (
        db.session.query(
            func.coalesce(func.sum(PlayerMatchStats.score), 0)
        )
        .join(
            CompetitionMatch,
            CompetitionMatch.id == PlayerMatchStats.match_id,
        )
        .filter(
            CompetitionMatch.competition_id == competition_id,
            CompetitionMatch.status != "CANCELLED",
            PlayerMatchStats.competition_participant_id == participant_id,
            PlayerMatchStats.user_id == user_id,
        )
        .scalar()
    )

    return int(value or 0)


def player_stats_for_competition(
    competition_id,
    participant_id,
    user_id,
):
    rows = (
        db.session.query(
            PlayerMatchStats,
            CompetitionMatch,
        )
        .join(
            CompetitionMatch,
            CompetitionMatch.id == PlayerMatchStats.match_id,
        )
        .filter(
            CompetitionMatch.competition_id == competition_id,
            CompetitionMatch.status != "CANCELLED",
            PlayerMatchStats.competition_participant_id == participant_id,
            PlayerMatchStats.user_id == user_id,
        )
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc().nullslast(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    total_points = 0
    total_kills = 0
    placements = []

    for stat, _match in rows:
        total_points += int(stat.score or 0)
        total_kills += int(stat.kills or 0)

        placement = stat_placement(stat)

        if placement is not None:
            placements.append(placement)

    return {
        "matchesPlayed": len(rows),
        "totalPoints": total_points,
        "totalKills": total_kills,
        "latestPlacement": placements[-1] if placements else None,
        "bestPlacement": min(placements) if placements else None,
    }


def serialize_member(competition, participant, user):
    role = "MEMBER"

    if participant.club:
        membership = next(
            (
                item
                for item in participant.club.members
                if item.user_id == user.id
            ),
            None,
        )

        if membership and membership.role:
            role = membership.role

    stats = player_stats_for_competition(
        competition.id,
        participant.id,
        user.id,
    )

    return {
        "userId": user.id,
        "playerId": user.id,
        "uid": user.uid,
        "name": display_user_name(user),
        "username": user.username,
        "avatar": user.avatar,
        "role": role,
        "matchesPlayed": stats["matchesPlayed"],
        "individualPoints": stats["totalPoints"],
        "points": stats["totalPoints"],
        "totalKills": stats["totalKills"],
        "kills": stats["totalKills"],
        "latestPlacement": stats["latestPlacement"],
        "bestPlacement": stats["bestPlacement"],
    }


def build_leaderboard(competition):
    rows = []

    for participant in get_team_participants(competition):
        members = get_team_members(participant)

        member_rows = [
            serialize_member(
                competition,
                participant,
                user,
            )
            for user in members
        ]

        total_points = sum(
            int(member["individualPoints"])
            for member in member_rows
        )

        total_kills = sum(
            int(member["totalKills"])
            for member in member_rows
        )

        placements = [
            member["latestPlacement"]
            for member in member_rows
            if member["latestPlacement"] is not None
        ]

        best_placement = min(placements) if placements else None

        rows.append({
            "participantId": participant.id,
            "teamId": participant.club_id,
            "teamName": display_team_name(participant),
            "teamTag": (
                participant.club.tag
                if participant.club
                else None
            ),
            "teamAvatar": (
                participant.club.avatar
                if participant.club
                else None
            ),
            "seed": participant.seed,
            "status": participant.registration_status,
            "totalPoints": total_points,
            "totalKills": total_kills,
            "latestPlacement": (
                placements[-1] if placements else None
            ),
            "bestPlacement": best_placement,
            "members": member_rows,
            # Compatibility aliases for older frontend code.
            "team_name": display_team_name(participant),
            "team_id": participant.club_id,
        })

    # Existing tournament score remains the primary ranking source.
    # Kills / placement are deterministic secondary information.
    rows.sort(
        key=lambda row: (
            -row["totalPoints"],
            -row["totalKills"],
            (
                row["bestPlacement"]
                if row["bestPlacement"] is not None
                else 10**9
            ),
            (
                row["seed"]
                if row["seed"] is not None
                else 10**9
            ),
            row["participantId"],
        )
    )

    for index, row in enumerate(rows, start=1):
        row["rank"] = index

    return rows


def match_team_participants(match):
    return [
        item.competition_participant
        for item in match.participants
        if item.competition_participant
        and item.competition_participant.participant_type == "TEAM"
    ]


def team_points_for_match(match_id, participant_id):
    value = (
        db.session.query(
            func.coalesce(func.sum(PlayerMatchStats.score), 0)
        )
        .filter(
            PlayerMatchStats.match_id == match_id,
            PlayerMatchStats.competition_participant_id == participant_id,
        )
        .scalar()
    )

    return int(value or 0)


def team_kills_for_match(match_id, participant_id):
    value = (
        db.session.query(
            func.coalesce(func.sum(PlayerMatchStats.kills), 0)
        )
        .filter(
            PlayerMatchStats.match_id == match_id,
            PlayerMatchStats.competition_participant_id == participant_id,
        )
        .scalar()
    )

    return int(value or 0)


def placement_for_team_match(match_id, participant_id):
    rows = (
        PlayerMatchStats.query
        .filter_by(
            match_id=match_id,
            competition_participant_id=participant_id,
        )
        .all()
    )

    placements = [
        stat_placement(row)
        for row in rows
        if stat_placement(row) is not None
    ]

    return min(placements) if placements else None


def serialize_match(match, detailed=False):
    competition = match.competition

    result = {
        "id": match.id,
        "competitionId": match.competition_id,
        "stageId": match.stage_id,
        "matchNumber": match.match_number,
        "match_number": match.match_number,
        "roundName": match.round_name,
        "roundNumber": match.round_number,
        "scheduledAt": iso_datetime(match.scheduled_at),
        "startedAt": iso_datetime(match.started_at),
        "completedAt": iso_datetime(match.completed_at),
        "status": match.status,
        "participants": [],
    }

    flat_players = []

    for participant in match_team_participants(match):
        match_points = team_points_for_match(
            match.id,
            participant.id,
        )
        match_kills = team_kills_for_match(
            match.id,
            participant.id,
        )
        team_placement = placement_for_team_match(
            match.id,
            participant.id,
        )

        entry = {
            "participantId": participant.id,
            "teamId": participant.club_id,
            "teamName": display_team_name(participant),
            "teamTag": (
                participant.club.tag
                if participant.club
                else None
            ),
            "totalPoints": match_points,
            "matchPoints": match_points,
            "kills": match_kills,
            "placement": team_placement,
        }

        if detailed:
            players = []

            for user in get_team_members(participant):
                stat = get_player_match_stat(
                    match.id,
                    user.id,
                )

                points = int(stat.score or 0) if stat else 0
                kills = int(stat.kills or 0) if stat else 0
                assists = int(stat.assists or 0) if stat else 0
                deaths = int(stat.deaths or 0) if stat else 0
                placement = stat_placement(stat) if stat else None

                player_row = {
                    "userId": user.id,
                    "playerId": user.id,
                    "player_id": user.id,
                    "uid": user.uid,
                    "name": display_user_name(user),
                    "username": user.username,
                    "avatar": user.avatar,
                    "teamId": participant.club_id,
                    "team_id": participant.club_id,
                    "teamName": display_team_name(participant),
                    "team_name": display_team_name(participant),
                    "points": points,
                    "kills": kills,
                    "placement": placement,
                    "assists": assists,
                    "deaths": deaths,
                }

                players.append(player_row)
                flat_players.append(player_row)

            entry["players"] = players
            entry["matchPoints"] = sum(
                player["points"]
                for player in players
            )
            entry["kills"] = sum(
                player["kills"]
                for player in players
            )

        result["participants"].append(entry)

    if detailed:
        result["players"] = flat_players

    return result


def sync_team_match_stats(match):
    """
    Synchronize TeamMatchStats from PlayerMatchStats for one match.

    Placement is copied into the existing TeamMatchStats. No new column
    is required on PlayerMatchStats because player placement is retained
    inside extra_stats.
    """

    for participant in match_team_participants(match):
        team_points = team_points_for_match(
            match.id,
            participant.id,
        )

        team_kills = team_kills_for_match(
            match.id,
            participant.id,
        )

        placement = placement_for_team_match(
            match.id,
            participant.id,
        )

        row = (
            TeamMatchStats.query
            .filter_by(
                match_id=match.id,
                competition_participant_id=participant.id,
            )
            .first()
        )

        if not row:
            row = TeamMatchStats(
                match_id=match.id,
                competition_participant_id=participant.id,
            )
            db.session.add(row)

        row.total_points = int(team_points or 0)
        row.kills = int(team_kills or 0)

        # The existing model in SYNCO already exposes placement.
        if hasattr(row, "placement"):
            row.placement = placement


def validate_match_players(match, payload_players):
    """
    Validate the exact roster already attached to the match.

    This deliberately prevents adding players through the dashboard.
    """

    expected = {}

    for participant in match_team_participants(match):
        for user in get_team_members(participant):
            expected[user.id] = participant.id

    received = set()

    for raw in payload_players:
        raw_user_id = raw.get("userId", raw.get("player_id"))

        try:
            user_id = int(raw_user_id)
        except (TypeError, ValueError):
            return None, "Each player needs a valid userId."

        if user_id in received:
            return (
                None,
                f"Player {user_id} was submitted more than once.",
            )

        if user_id not in expected:
            return (
                None,
                f"Player {user_id} is not part of this match roster.",
            )

        received.add(user_id)

    missing = sorted(set(expected) - received)

    if missing:
        return None, (
            "Every participating team member needs a score before the "
            f"match can be finalized. Missing user IDs: {missing}"
        )

    return expected, None


def sync_classic_standings(competition):
    """
    Keep the existing CompetitionStanding table aligned with verified
    matches, using the existing competition schema.
    """

    if str(competition.competition_type or "").upper() != "CLASSIC":
        return

    stage = get_stage(competition)

    if not stage:
        return

    participants = get_team_participants(competition)

    standings = []

    for participant in participants:
        row = (
            CompetitionStanding.query
            .filter_by(
                competition_id=competition.id,
                stage_id=stage.id,
                competition_participant_id=participant.id,
            )
            .first()
        )

        if not row:
            row = CompetitionStanding(
                competition_id=competition.id,
                stage_id=stage.id,
                competition_participant_id=participant.id,
                rank=0,
            )
            db.session.add(row)

        stats = (
            TeamMatchStats.query
            .join(
                CompetitionMatch,
                CompetitionMatch.id == TeamMatchStats.match_id,
            )
            .filter(
                CompetitionMatch.competition_id == competition.id,
                CompetitionMatch.status == "VERIFIED",
                TeamMatchStats.competition_participant_id == participant.id,
            )
            .all()
        )

        row.matches_played = len(stats)
        row.placement_points = sum(
            int(item.placement_points or 0)
            for item in stats
        )
        row.kill_points = sum(
            int(item.kill_points or 0)
            for item in stats
        )
        row.bonus_points = sum(
            int(item.bonus_points or 0)
            for item in stats
        )
        row.total_points = sum(
            int(item.total_points or 0)
            for item in stats
        )
        row.total_kills = sum(
            int(item.kills or 0)
            for item in stats
        )
        row.best_match_score = max(
            (
                int(item.total_points or 0)
                for item in stats
            ),
            default=0,
        )
        row.wins = sum(
            1
            for item in stats
            if int(item.placement or 0) == 1
        )
        row.losses = max(
            0,
            row.matches_played - row.wins,
        )

        standings.append(row)

    standings.sort(
        key=lambda item: (
            -int(item.total_points or 0),
            -int(item.total_kills or 0),
            -int(item.wins or 0),
            item.competition_participant_id,
        )
    )

    for rank, row in enumerate(standings, start=1):
        row.rank = rank


def competition_payload(competition):
    return {
        "id": competition.id,
        "title": competition.title,
        "slug": competition.slug,
        "gameId": competition.game_id,
        "game": (
            competition.game.to_dict()
            if competition.game
            else None
        ),
        "competitionType": competition.competition_type,
        "gameMode": competition.game_mode,
        "participantType": competition.participant_type,
        "teamSize": competition.team_size,
        "numberOfMatches": competition.number_of_matches,
        "structure": competition.structure,
        "status": competition.status,
        "start": iso_datetime(competition.competition_start),
        "end": iso_datetime(
            competition.competition_end
        ),
        "organizerId": competition.organizer_id,
    }


def dashboard_payload(competition):
    teams = build_leaderboard(competition)

    matches = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc().nullslast(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    access = get_competition_access(
        competition,
        persist_live_state=True,
    )

    live_match = next(
        (
            item
            for item in matches
            if str(item.status or "").upper() == "LIVE"
        ),
        None,
    )

    # Before the scheduled start, keep the page in its locked state.
    # Match/leaderboard details are not exposed as live data until start.
    live_data_enabled = access["phase"] in {
        "LIVE",
        "COMPLETED",
    }

    dashboard_matches = (
        [serialize_match(item) for item in matches]
        if live_data_enabled
        else [serialize_match(item) for item in matches]
    )

    leaderboard = teams if live_data_enabled else []

    return {
        "competition": competition_payload(competition),
        "access": access,
        "overview": {
            "teams": len(teams),
            "players": sum(
                len(item["members"])
                for item in teams
            ),
            "matches": len(matches),
            "completedMatches": sum(
                1
                for item in matches
                if str(item.status or "").upper() == "VERIFIED"
            ),
            "liveMatches": sum(
                1
                for item in matches
                if str(item.status or "").upper() == "LIVE"
            ),
            "liveMatchId": (
                live_match.id
                if live_match
                else None
            ),
        },
        "leaderboard": leaderboard,
        "matches": dashboard_matches,
    }


# =========================================================
# ACCESS
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/access",
    methods=["GET"],
)
def access(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    access_data = get_competition_access(
        competition,
        persist_live_state=True,
    )

    return jsonify({
        "success": True,
        "competition": competition_payload(competition),
        "access": access_data,
        "updatedAt": iso_datetime(synco_now()),
    })


# =========================================================
# FULL DASHBOARD
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/dashboard",
    methods=["GET"],
)
def dashboard(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    if str(competition.participant_type or "").upper() != "TEAM":
        return jsonify({
            "success": False,
            "message": "The live team dashboard requires a TEAM competition.",
        }), 400

    data = dashboard_payload(competition)

    return jsonify({
        "success": True,
        "dashboard": data,
        "updatedAt": iso_datetime(synco_now()),
    })


# =========================================================
# PAGE 1 - OVERVIEW
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/overview",
    methods=["GET"],
)
def overview(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    access_data = get_competition_access(
        competition,
        persist_live_state=True,
    )

    teams = build_leaderboard(competition)

    matches = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc().nullslast(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    return jsonify({
        "success": True,
        "access": access_data,
        "overview": {
            "competition": competition_payload(competition),
            "teams": len(teams),
            "players": sum(
                len(item["members"])
                for item in teams
            ),
            "matches": len(matches),
            "liveMatches": [
                serialize_match(item)
                for item in matches
                if str(item.status or "").upper() == "LIVE"
            ],
            "upcomingMatches": [
                serialize_match(item)
                for item in matches
                if str(item.status or "").upper()
                in {"READY", "SCHEDULED"}
            ],
            "recentMatches": [
                serialize_match(item)
                for item in matches
                if str(item.status or "").upper()
                in {"VERIFIED", "CANCELLED"}
            ][-5:],
        },
        "updatedAt": iso_datetime(synco_now()),
    })


# =========================================================
# PAGE 2 - LIVE LEADERBOARD
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/leaderboard",
    methods=["GET"],
)
def leaderboard(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    if str(competition.participant_type or "").upper() != "TEAM":
        return jsonify({
            "success": False,
            "message": "The live leaderboard is only available for TEAM competitions.",
        }), 400

    access_data = get_competition_access(
        competition,
        persist_live_state=True,
    )

    return jsonify({
        "success": True,
        "access": access_data,
        "competition": competition_payload(competition),
        "leaderboard": (
            build_leaderboard(competition)
            if access_data["phase"] in {"LIVE", "COMPLETED"}
            else []
        ),
        "updatedAt": iso_datetime(synco_now()),
    })


# =========================================================
# PAGE 3 - MATCH MANAGEMENT
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/matches",
    methods=["GET"],
)
def matches(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    access_data = get_competition_access(
        competition,
        persist_live_state=True,
    )

    rows = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc().nullslast(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    return jsonify({
        "success": True,
        "access": access_data,
        "matches": [
            serialize_match(
                item,
                detailed=True,
            )
            for item in rows
        ],
        "updatedAt": iso_datetime(synco_now()),
    })


@live_tournament_bp.route(
    "/<int:competition_id>/matches/<int:match_id>",
    methods=["GET"],
)
def match_detail(competition_id, match_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    match = (
        CompetitionMatch.query
        .filter_by(
            id=match_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not match:
        return jsonify({
            "success": False,
            "message": "Match not found.",
        }), 404

    return jsonify({
        "success": True,
        "match": serialize_match(
            match,
            detailed=True,
        ),
    })


@live_tournament_bp.route(
    "/<int:competition_id>/matches/<int:match_id>/start",
    methods=["POST"],
)
def start_match(competition_id, match_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    user, error = organizer_required(competition)

    if error:
        return error

    match = (
        CompetitionMatch.query
        .filter_by(
            id=match_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not match:
        return jsonify({
            "success": False,
            "message": "Match not found.",
        }), 404

    status = str(match.status or "").upper()

    if status == "LIVE":
        return jsonify({
            "success": True,
            "message": "Match is already live.",
            "match": serialize_match(
                match,
                detailed=True,
            ),
        })

    if status not in {"READY", "SCHEDULED"}:
        return jsonify({
            "success": False,
            "message": (
                f"Match cannot be started from status "
                f"{match.status}."
            ),
        }), 400

    # Do not allow an individual match to bypass the tournament start.
    access_data = get_competition_access(
        competition,
        persist_live_state=True,
    )

    if access_data["phase"] != "LIVE":
        return jsonify({
            "success": False,
            "message": access_data["message"],
            "access": access_data,
        }), 409

    match.status = "LIVE"
    match.started_at = utc_now()

    stage = get_stage(competition)

    if stage and str(stage.status or "").upper() in {
        "PENDING",
        "READY",
        "SCHEDULED",
    }:
        stage.status = "LIVE"

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Match started.",
        "match": serialize_match(
            match,
            detailed=True,
        ),
        "startedBy": user.id,
    })


@live_tournament_bp.route(
    "/<int:competition_id>/matches/<int:match_id>/scores",
    methods=["POST"],
)
def save_scores(competition_id, match_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    user, error = organizer_required(competition)

    if error:
        return error

    match = (
        CompetitionMatch.query
        .filter_by(
            id=match_id,
            competition_id=competition.id,
        )
        .first()
    )

    if not match:
        return jsonify({
            "success": False,
            "message": "Match not found.",
        }), 404

    status = str(match.status or "").upper()

    if status not in {"LIVE", "RESULT_PENDING"}:
        return jsonify({
            "success": False,
            "message": (
                "Only LIVE or RESULT_PENDING matches "
                "can receive scores."
            ),
        }), 400

    payload = request.get_json(silent=True) or {}
    players = payload.get("players")
    finalize = bool(payload.get("finalize", False))

    if not isinstance(players, list):
        return jsonify({
            "success": False,
            "message": "players must be an array.",
        }), 400

    expected, validation_error = validate_match_players(
        match,
        players,
    )

    if validation_error:
        return jsonify({
            "success": False,
            "message": validation_error,
        }), 400

    team_count = len(
        match_team_participants(match)
    )

    try:
        for raw in players:
            raw_user_id = raw.get(
                "userId",
                raw.get("player_id"),
            )

            user_id = int(raw_user_id)
            participant_id = expected[user_id]

            existing_stat = get_player_match_stat(
                match.id,
                user_id,
            )

            # Points remain compatible with the existing SYNCO
            # scoring model. If the organizer does not submit a
            # points value, retain the current score.
            raw_points = raw.get(
                "points",
                raw.get("score", None),
            )

            if raw_points in (None, ""):
                points = (
                    int(existing_stat.score or 0)
                    if existing_stat
                    else 0
                )
            else:
                points = as_non_negative_int(
                    raw_points,
                    "points",
                )

            kills = as_non_negative_int(
                raw.get("kills", 0),
                "kills",
            )

            placement = as_non_negative_int(
                raw.get("placement"),
                "placement",
                allow_blank=True,
            )

            if placement == 0:
                placement = None

            if placement is not None and placement < 1:
                raise ValueError(
                    "Placement must be 1 or higher."
                )

            if finalize and placement is None:
                raise ValueError(
                    f"Player {user_id} needs a placement before "
                    "the match can be finalized."
                )

            assists = as_non_negative_int(
                raw.get("assists", 0),
                "assists",
            )

            deaths = as_non_negative_int(
                raw.get("deaths", 0),
                "deaths",
            )

            if placement is not None and team_count:
                if placement > team_count:
                    raise ValueError(
                        "Placement cannot be higher than the "
                        f"number of teams in this match ({team_count})."
                    )

            stat = existing_stat

            if not stat:
                stat = PlayerMatchStats(
                    match_id=match.id,
                    competition_participant_id=participant_id,
                    user_id=user_id,
                )
                db.session.add(stat)

            stat.competition_participant_id = participant_id
            stat.score = points
            stat.kills = kills
            stat.assists = assists
            stat.deaths = deaths

            extra_stats = dict(
                stat.extra_stats or {}
            )

            extra_stats["source"] = (
                "SYNCO_LIVE_DASHBOARD"
            )
            extra_stats["placement"] = placement

            stat.extra_stats = extra_stats

        sync_team_match_stats(match)

        if finalize:
            match.status = "VERIFIED"
            match.completed_at = (
                match.completed_at
                or utc_now()
            )

            result = (
                MatchResult.query
                .filter_by(match_id=match.id)
                .first()
            )

            if not result:
                result = MatchResult(
                    match_id=match.id,
                    submitted_by=user.id,
                )
                db.session.add(result)

            result.submitted_by = user.id
            result.status = "VERIFIED"
            result.submitted_at = utc_now()
            result.verified_at = utc_now()
            result.verified_by = user.id
            result.raw_result = {
                "source": (
                    "SYNCO_LIVE_DASHBOARD"
                ),
                "players": [
                    {
                        "userId": int(
                            raw.get(
                                "userId",
                                raw.get("player_id"),
                            )
                        ),
                        "participantId": expected[
                            int(
                                raw.get(
                                    "userId",
                                    raw.get("player_id"),
                                )
                            )
                        ],
                        "points": int(
                            raw.get(
                                "points",
                                raw.get("score", 0),
                            )
                            or 0
                        ),
                        "kills": int(
                            raw.get("kills", 0)
                            or 0
                        ),
                        "placement": (
                            int(raw["placement"])
                            if raw.get("placement")
                            not in (None, "")
                            else None
                        ),
                        "assists": int(
                            raw.get("assists", 0)
                            or 0
                        ),
                        "deaths": int(
                            raw.get("deaths", 0)
                            or 0
                        ),
                    }
                    for raw in players
                ],
            }

            db.session.add(
                VerificationRecord(
                    match_id=match.id,
                    verifier_id=user.id,
                    action="VERIFIED",
                    reason=(
                        "Verified through SYNCO Live "
                        "Tournament Dashboard."
                    ),
                )
            )

            configuration = (
                competition.configuration
                if isinstance(
                    competition.configuration,
                    dict,
                )
                else {}
            )

            existing_live_dashboard = (
                configuration.get(
                    "liveDashboard",
                    {}
                )
                if isinstance(
                    configuration.get(
                        "liveDashboard",
                        {},
                    ),
                    dict,
                )
                else {}
            )

            configuration["liveDashboard"] = {
                **existing_live_dashboard,
                "lastUpdatedAt": iso_datetime(
                    utc_now()
                ),
            }

            competition.configuration = configuration

            sync_classic_standings(
                competition
            )

        else:
            match.status = "LIVE"

        db.session.commit()

    except ValueError as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": str(exc),
        }), 400

    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to save live scores.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": (
            "Match finalized."
            if finalize
            else "Live scores saved."
        ),
        "match": serialize_match(
            match,
            detailed=True,
        ),
        "leaderboard": build_leaderboard(
            competition
        ),
        "updatedAt": iso_datetime(
            utc_now()
        ),
    })


# =========================================================
# PAGE 4 - FINAL RESULTS
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/results",
    methods=["GET"],
)
def results(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    matches = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc().nullslast(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    verified_only = (
        str(competition.status or "").upper()
        == "COMPLETED"
    )

    rows = build_leaderboard(competition)

    if verified_only:
        # Rebuild team totals from verified match records only.
        for team in rows:
            points = (
                db.session.query(
                    func.coalesce(
                        func.sum(
                            PlayerMatchStats.score
                        ),
                        0,
                    )
                )
                .join(
                    CompetitionMatch,
                    CompetitionMatch.id
                    == PlayerMatchStats.match_id,
                )
                .filter(
                    CompetitionMatch.competition_id
                    == competition.id,
                    CompetitionMatch.status
                    == "VERIFIED",
                    PlayerMatchStats.competition_participant_id
                    == team["participantId"],
                )
                .scalar()
            )

            kills = (
                db.session.query(
                    func.coalesce(
                        func.sum(
                            PlayerMatchStats.kills
                        ),
                        0,
                    )
                )
                .join(
                    CompetitionMatch,
                    CompetitionMatch.id
                    == PlayerMatchStats.match_id,
                )
                .filter(
                    CompetitionMatch.competition_id
                    == competition.id,
                    CompetitionMatch.status
                    == "VERIFIED",
                    PlayerMatchStats.competition_participant_id
                    == team["participantId"],
                )
                .scalar()
            )

            team["totalPoints"] = int(
                points or 0
            )
            team["totalKills"] = int(
                kills or 0
            )

    rows.sort(
        key=lambda row: (
            -int(row["totalPoints"] or 0),
            -int(row["totalKills"] or 0),
            (
                row["bestPlacement"]
                if row["bestPlacement"] is not None
                else 10**9
            ),
            row["participantId"],
        )
    )

    for rank, row in enumerate(
        rows,
        start=1,
    ):
        row["finalRank"] = rank

    return jsonify({
        "success": True,
        "access": get_competition_access(
            competition,
            persist_live_state=True,
        ),
        "competition": {
            **competition_payload(competition),
            "completedAt": iso_datetime(
                competition.competition_end
            ),
        },
        "results": rows,
        "matches": [
            serialize_match(item)
            for item in matches
        ],
        "updatedAt": iso_datetime(
            utc_now()
        ),
    })


# =========================================================
# FINALIZE / LOCK COMPETITION
# =========================================================

@live_tournament_bp.route(
    "/<int:competition_id>/finalize",
    methods=["POST"],
)
def finalize_competition(competition_id):
    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    user, error = organizer_required(
        competition
    )

    if error:
        return error

    matches = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .all()
    )

    if not matches:
        return jsonify({
            "success": False,
            "message": "No matches found.",
        }), 400

    incomplete = [
        match.id
        for match in matches
        if str(match.status or "").upper()
        not in {"VERIFIED", "CANCELLED"}
    ]

    if incomplete:
        return jsonify({
            "success": False,
            "message": (
                "All matches must be verified or "
                "cancelled before finalization."
            ),
            "incompleteMatches": incomplete,
        }), 400

    sync_classic_standings(
        competition
    )

    competition.status = "COMPLETED"
    competition.competition_end = utc_now()

    stage = get_stage(competition)

    if stage:
        stage.status = "COMPLETED"

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Competition finalized.",
        "competition": {
            "id": competition.id,
            "status": competition.status,
            "completedAt": iso_datetime(
                competition.competition_end
            ),
        },
        "finalResults": build_leaderboard(
            competition
        ),
        "finalizedBy": user.id,
    })
