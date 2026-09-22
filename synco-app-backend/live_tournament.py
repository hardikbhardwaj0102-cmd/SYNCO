# =========================================================
# SYNCO LIVE TOURNAMENT DASHBOARD API
# =========================================================
#
# Uses the EXISTING SYNCO competition schema.
#
# Teams come from CompetitionParticipant -> Club.
# New tournament rosters come from CompetitionParticipant.team_roster.
# Legacy registrations fall back to ClubMember -> User.
# Individual live points are stored in PlayerMatchStats.score.
# Team match totals are synchronized to TeamMatchStats.total_points.
#
# Endpoints provided here power four frontend sections/pages:
#   1. Overview
#   2. Live Leaderboard
#   3. Match Management
#   4. Final Results
#
# This file intentionally does NOT add/remove players.
# =========================================================

from datetime import datetime

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
    """Only the competition organizer may manage live scores."""

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

    return user, None


# =========================================================
# GENERAL HELPERS
# =========================================================

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
        .order_by(CompetitionStage.stage_order.asc(), CompetitionStage.id.asc())
        .first()
    )


def display_user_name(user):
    if not user:
        return "Unknown Player"

    return user.username or user.name or f"Player {user.id}"


def display_team_name(participant):
    if participant.club:
        return participant.club.name

    if participant.user:
        return display_user_name(participant.user)

    return "Unknown Team"


def get_team_participants(competition):
    """Return only confirmed/locked team registrations for the live event."""

    return (
        CompetitionParticipant.query
        .filter_by(
            competition_id=competition.id,
            participant_type="TEAM",
        )
        .filter(
            CompetitionParticipant.registration_status.in_(
                ["ACCEPTED", "LOCKED"]
            )
        )
        .order_by(
            CompetitionParticipant.seed.asc().nullslast(),
            CompetitionParticipant.registered_at.asc().nullslast(),
            CompetitionParticipant.id.asc(),
        )
        .all()
    )


def get_team_members(participant):
    """
    Return the tournament-specific roster snapshot.

    New registrations store the exact selected players on the
    CompetitionParticipant. Legacy registrations without a
    snapshot fall back to the club roster so older tournaments
    continue to work.
    """

    roster = getattr(
        participant,
        "team_roster",
        None
    ) or []

    # -----------------------------------------------------
    # NEW TOURNAMENT-SPECIFIC ROSTER
    # -----------------------------------------------------

    if isinstance(roster, list) and roster:

        user_ids = []

        for item in roster:

            if not isinstance(item, dict):
                continue

            try:
                user_id = int(
                    item.get("userId")
                )
            except (TypeError, ValueError):
                continue

            if user_id not in user_ids:
                user_ids.append(user_id)

        if not user_ids:
            return []

        users = (
            User.query
            .filter(
                User.id.in_(user_ids)
            )
            .all()
        )

        users_by_id = {
            user.id: user
            for user in users
        }

        return [
            users_by_id[user_id]
            for user_id in user_ids
            if user_id in users_by_id
        ]

    # -----------------------------------------------------
    # LEGACY TOURNAMENT FALLBACK
    # -----------------------------------------------------

    club_id = participant.club_id

    if not club_id:
        return []

    memberships = (
        ClubMember.query
        .filter_by(club_id=club_id)
        .order_by(
            ClubMember.joined_at.asc(),
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


def player_points_for_competition(competition_id, participant_id, user_id):
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


def team_points_for_competition(competition_id, participant_id):
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
        )
        .scalar()
    )

    return int(value or 0)


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

    return {
        "userId": user.id,
        "uid": user.uid,
        "name": display_user_name(user),
        "username": user.username,
        "avatar": user.avatar,
        "role": role,
        "individualPoints": player_points_for_competition(
            competition.id,
            participant.id,
            user.id,
        ),
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

        # IMPORTANT: team total is derived from the individual members.
        total_points = sum(
            int(member["individualPoints"])
            for member in member_rows
        )

        rows.append({
            "participantId": participant.id,
            "teamId": participant.club_id,
            "teamName": display_team_name(participant),
            "teamTag": participant.club.tag if participant.club else None,
            "teamAvatar": participant.club.avatar if participant.club else None,
            "seed": participant.seed,
            "status": participant.registration_status,
            "totalPoints": total_points,
            "members": member_rows,
        })

    # Team total points are primary. Seed / participant id are deterministic
    # fallbacks so equal scores do not randomly reorder the live table.
    rows.sort(
        key=lambda row: (
            -row["totalPoints"],
            row["seed"] if row["seed"] is not None else 10**9,
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


def serialize_match(match, detailed=False):
    competition = match.competition

    result = {
        "id": match.id,
        "competitionId": match.competition_id,
        "stageId": match.stage_id,
        "matchNumber": match.match_number,
        "roundName": match.round_name,
        "roundNumber": match.round_number,
        "scheduledAt": match.scheduled_at.isoformat() if match.scheduled_at else None,
        "startedAt": match.started_at.isoformat() if match.started_at else None,
        "completedAt": match.completed_at.isoformat() if match.completed_at else None,
        "status": match.status,
        "participants": [],
    }

    for participant in match_team_participants(match):
        entry = {
            "participantId": participant.id,
            "teamId": participant.club_id,
            "teamName": display_team_name(participant),
            "teamTag": participant.club.tag if participant.club else None,
            "totalPoints": team_points_for_competition(
                competition.id,
                participant.id,
            ),
        }

        if detailed:
            players = []

            for user in get_team_members(participant):
                stat = get_player_match_stat(match.id, user.id)

                players.append({
                    "userId": user.id,
                    "uid": user.uid,
                    "name": display_user_name(user),
                    "username": user.username,
                    "avatar": user.avatar,
                    "points": int(stat.score if stat else 0),
                    "kills": int(stat.kills if stat else 0),
                    "assists": int(stat.assists if stat else 0),
                    "deaths": int(stat.deaths if stat else 0),
                })

            entry["players"] = players
            entry["matchPoints"] = sum(
                player["points"] for player in players
            )

        result["participants"].append(entry)

    return result


def sync_team_match_stats(match):
    """Synchronize TeamMatchStats from PlayerMatchStats for one match."""

    for participant in match_team_participants(match):
        team_points = (
            db.session.query(
                func.coalesce(func.sum(PlayerMatchStats.score), 0)
            )
            .filter(
                PlayerMatchStats.match_id == match.id,
                PlayerMatchStats.competition_participant_id == participant.id,
            )
            .scalar()
        )

        team_kills = (
            db.session.query(
                func.coalesce(func.sum(PlayerMatchStats.kills), 0)
            )
            .filter(
                PlayerMatchStats.match_id == match.id,
                PlayerMatchStats.competition_participant_id == participant.id,
            )
            .scalar()
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
        try:
            user_id = int(
                raw.get("userId", raw.get("user_id", raw.get("player_id")))
            )
        except (TypeError, ValueError):
            return None, "Each player needs a valid userId."

        if user_id in received:
            return None, f"Player {user_id} was submitted more than once."

        if user_id not in expected:
            return None, f"Player {user_id} is not part of this match roster."

        received.add(user_id)

    missing = sorted(set(expected) - received)

    if missing:
        return None, (
            "Every participating team member needs a score before the match "
            f"can be finalized. Missing user IDs: {missing}"
        )

    return expected, None


def sync_classic_standings(competition):
    """
    Keep the existing CompetitionStanding table aligned with the existing
    competition.py rules, using only VERIFIED matches.
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
        row.placement_points = sum(int(item.placement_points or 0) for item in stats)
        row.kill_points = sum(int(item.kill_points or 0) for item in stats)
        row.bonus_points = sum(int(item.bonus_points or 0) for item in stats)
        row.total_points = sum(int(item.total_points or 0) for item in stats)
        row.total_kills = sum(int(item.kills or 0) for item in stats)
        row.best_match_score = max(
            (int(item.total_points or 0) for item in stats),
            default=0,
        )
        row.wins = sum(
            1 for item in stats if int(item.placement or 0) == 1
        )
        row.losses = max(0, row.matches_played - row.wins)

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


# =========================================================
# FULL DASHBOARD
# =========================================================

@live_tournament_bp.route("/<int:competition_id>/dashboard", methods=["GET"])
def dashboard(competition_id):

    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    teams = build_leaderboard(competition)

    matches = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    live_match = next(
        (item for item in matches if item.status == "LIVE"),
        None,
    )

    viewer = current_user()

    return jsonify({
        "success": True,
        "dashboard": {
            "viewer": {
                "authenticated": bool(viewer),
                "userId": viewer.id if viewer else None,
                "isOrganizer": bool(
                    viewer and competition.organizer_id == viewer.id
                ),
            },
            "competition": {
                "id": competition.id,
                "title": competition.title,
                "slug": competition.slug,
                "gameId": competition.game_id,
                "game": competition.game.to_dict() if competition.game else None,
                "competitionType": competition.competition_type,
                "gameMode": competition.game_mode,
                "participantType": competition.participant_type,
                "teamSize": competition.team_size,
                "numberOfMatches": competition.number_of_matches,
                "structure": competition.structure,
                "status": competition.status,
                "start": competition.competition_start.isoformat() if competition.competition_start else None,
                "end": competition.competition_end.isoformat() if competition.competition_end else None,
            },
            "overview": {
                "teams": len(teams),
                "players": sum(len(item["members"]) for item in teams),
                "matches": len(matches),
                "completedMatches": sum(1 for item in matches if item.status == "VERIFIED"),
                "liveMatchId": live_match.id if live_match else None,
            },
            "leaderboard": teams,
            "matches": [serialize_match(item) for item in matches],
        },
        "updatedAt": datetime.utcnow().isoformat(),
    })


# =========================================================
# PAGE 1 - OVERVIEW
# =========================================================

@live_tournament_bp.route("/<int:competition_id>/overview", methods=["GET"])
def overview(competition_id):

    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    teams = build_leaderboard(competition)

    matches = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    viewer = current_user()

    return jsonify({
        "success": True,
        "viewer": {
            "authenticated": bool(viewer),
            "userId": viewer.id if viewer else None,
            "isOrganizer": bool(
                viewer and competition.organizer_id == viewer.id
            ),
        },
        "overview": {
            "competition": {
                "id": competition.id,
                "title": competition.title,
                "slug": competition.slug,
                "status": competition.status,
                "gameId": competition.game_id,
                "game": competition.game.to_dict() if competition.game else None,
                "gameMode": competition.game_mode,
                "teamSize": competition.team_size,
                "numberOfMatches": competition.number_of_matches,
            },
            "teams": len(teams),
            "players": sum(len(item["members"]) for item in teams),
            "matches": len(matches),
            "liveMatches": [
                serialize_match(item)
                for item in matches
                if item.status == "LIVE"
            ],
            "upcomingMatches": [
                serialize_match(item)
                for item in matches
                if item.status in ("READY", "SCHEDULED")
            ],
            "recentMatches": [
                serialize_match(item)
                for item in matches
                if item.status in ("VERIFIED", "CANCELLED")
            ][-5:],
        },
        "updatedAt": datetime.utcnow().isoformat(),
    })


# =========================================================
# PAGE 2 - LIVE LEADERBOARD
# =========================================================

@live_tournament_bp.route("/<int:competition_id>/leaderboard", methods=["GET"])
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

    return jsonify({
        "success": True,
        "competition": {
            "id": competition.id,
            "title": competition.title,
            "status": competition.status,
            "gameId": competition.game_id,
        },
        "leaderboard": build_leaderboard(competition),
        "updatedAt": datetime.utcnow().isoformat(),
    })


# =========================================================
# PAGE 3 - MATCH MANAGEMENT
# =========================================================

@live_tournament_bp.route("/<int:competition_id>/matches", methods=["GET"])
def matches(competition_id):

    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    rows = (
        CompetitionMatch.query
        .filter_by(competition_id=competition.id)
        .order_by(
            CompetitionMatch.round_number.asc().nullslast(),
            CompetitionMatch.match_number.asc(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    return jsonify({
        "success": True,
        "matches": [serialize_match(item, detailed=True) for item in rows],
        "updatedAt": datetime.utcnow().isoformat(),
    })


@live_tournament_bp.route("/<int:competition_id>/matches/<int:match_id>", methods=["GET"])
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
        "match": serialize_match(match, detailed=True),
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

    if match.status == "LIVE":
        return jsonify({
            "success": True,
            "message": "Match is already live.",
            "match": serialize_match(match, detailed=True),
        })

    if match.status not in ("READY", "SCHEDULED"):
        return jsonify({
            "success": False,
            "message": f"Match cannot be started from status {match.status}.",
        }), 400

    match.status = "LIVE"
    match.started_at = datetime.utcnow()

    if competition.status in (
        "READY",
        "REGISTRATION_CLOSED",
    ):
        competition.status = "LIVE"

    stage = get_stage(competition)
    if stage and stage.status in ("PENDING", "READY"):
        stage.status = "LIVE"

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Match started.",
        "match": serialize_match(match, detailed=True),
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

    if match.status not in ("LIVE", "RESULT_PENDING"):
        return jsonify({
            "success": False,
            "message": "Only LIVE or RESULT_PENDING matches can receive scores.",
        }), 400

    payload = request.get_json(silent=True) or {}
    players = payload.get("players")
    finalize = bool(payload.get("finalize", False))

    if not isinstance(players, list):
        return jsonify({
            "success": False,
            "message": "players must be an array.",
        }), 400

    expected, validation_error = validate_match_players(match, players)

    if validation_error:
        return jsonify({
            "success": False,
            "message": validation_error,
        }), 400

    try:
        for raw in players:
            user_id = int(
                raw.get("userId", raw.get("user_id", raw.get("player_id")))
            )
            points = int(raw.get("points", raw.get("score", 0)))
            kills = int(raw.get("kills", 0))
            assists = int(raw.get("assists", 0))
            deaths = int(raw.get("deaths", 0))

            if points < 0 or kills < 0 or assists < 0 or deaths < 0:
                raise ValueError("Scores and stats cannot be negative.")

            participant_id = expected[user_id]

            stat = get_player_match_stat(match.id, user_id)

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
            stat.extra_stats = {
                **(stat.extra_stats or {}),
                "source": "SYNCO_LIVE_DASHBOARD",
            }

        sync_team_match_stats(match)

        if finalize:
            match.status = "VERIFIED"
            match.completed_at = match.completed_at or datetime.utcnow()

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
            result.submitted_at = datetime.utcnow()
            result.verified_at = datetime.utcnow()
            result.verified_by = user.id
            result.raw_result = {
                "source": "SYNCO_LIVE_DASHBOARD",
                "players": [
                    {
                        "userId": int(
                            raw.get("userId", raw.get("user_id", raw.get("player_id")))
                        ),
                        "participantId": expected[int(
                            raw.get("userId", raw.get("user_id", raw.get("player_id")))
                        )],
                        "points": int(raw.get("points", raw.get("score", 0))),
                        "kills": int(raw.get("kills", 0)),
                        "assists": int(raw.get("assists", 0)),
                        "deaths": int(raw.get("deaths", 0)),
                    }
                    for raw in players
                ],
            }

            db.session.add(
                VerificationRecord(
                    match_id=match.id,
                    verifier_id=user.id,
                    action="VERIFIED",
                    reason="Verified through SYNCO Live Tournament Dashboard.",
                )
            )

            competition.configuration = {
                **(competition.configuration or {}),
                "liveDashboard": {
                    "lastUpdatedAt": datetime.utcnow().isoformat(),
                },
            }

            sync_classic_standings(competition)
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
        "message": "Match finalized." if finalize else "Live scores saved.",
        "match": serialize_match(match, detailed=True),
        "leaderboard": build_leaderboard(competition),
        "updatedAt": datetime.utcnow().isoformat(),
    })


# =========================================================
# PAGE 4 - FINAL RESULTS
# =========================================================

@live_tournament_bp.route("/<int:competition_id>/results", methods=["GET"])
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
            CompetitionMatch.match_number.asc(),
            CompetitionMatch.id.asc(),
        )
        .all()
    )

    verified_only = competition.status == "COMPLETED"

    rows = []

    for team in build_leaderboard(competition):
        if verified_only:
            points = (
                db.session.query(
                    func.coalesce(func.sum(PlayerMatchStats.score), 0)
                )
                .join(
                    CompetitionMatch,
                    CompetitionMatch.id == PlayerMatchStats.match_id,
                )
                .filter(
                    CompetitionMatch.competition_id == competition.id,
                    CompetitionMatch.status == "VERIFIED",
                    PlayerMatchStats.competition_participant_id == team["participantId"],
                )
                .scalar()
            )
            team["totalPoints"] = int(points or 0)

        rows.append(team)

    rows.sort(
        key=lambda row: (
            -row["totalPoints"],
            row["seed"] if row["seed"] is not None else 10**9,
            row["participantId"],
        )
    )

    for rank, row in enumerate(rows, start=1):
        row["finalRank"] = rank

    viewer = current_user()

    return jsonify({
        "success": True,
        "viewer": {
            "authenticated": bool(viewer),
            "userId": viewer.id if viewer else None,
            "isOrganizer": bool(
                viewer and competition.organizer_id == viewer.id
            ),
        },
        "competition": {
            "id": competition.id,
            "title": competition.title,
            "status": competition.status,
            "completedAt": competition.competition_end.isoformat() if competition.competition_end else None,
        },
        "results": rows,
        "matches": [serialize_match(item) for item in matches],
        "updatedAt": datetime.utcnow().isoformat(),
    })


# =========================================================
# FINALIZE / LOCK COMPETITION
# =========================================================

@live_tournament_bp.route("/<int:competition_id>/finalize", methods=["POST"])
def finalize_competition(competition_id):

    competition = get_competition(competition_id)

    if not competition:
        return jsonify({
            "success": False,
            "message": "Competition not found.",
        }), 404

    user, error = organizer_required(competition)
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
        if match.status not in ("VERIFIED", "CANCELLED")
    ]

    if incomplete:
        return jsonify({
            "success": False,
            "message": "All matches must be verified or cancelled before finalization.",
            "incompleteMatches": incomplete,
        }), 400

    sync_classic_standings(competition)

    competition.status = "COMPLETED"
    competition.competition_end = datetime.utcnow()

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
            "completedAt": competition.competition_end.isoformat(),
        },
        "finalResults": build_leaderboard(competition),
        "finalizedBy": user.id,
    })
