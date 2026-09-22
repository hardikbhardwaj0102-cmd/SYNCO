import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Activity,
    ArrowLeft,
    Check,
    ChevronDown,
    Clock3,
    Medal,
    Play,
    RefreshCw,
    Save,
    Swords,
    Target,
    Trophy,
    Users,
} from "lucide-react";

import "../styles/pages/LiveTournamentDashboard.css";


const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";

const POLL_INTERVAL = 5000;


const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
};


const formatStatus = (status) => {
    if (!status) return "UNKNOWN";

    return String(status)
        .replaceAll("_", " ")
        .toUpperCase();
};


const numericValue = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};


const getInitials = (name = "") => {
    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return "?";

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
};


const getGameName = (competition) => {
    if (!competition) return "—";

    if (
        typeof competition.game === "object" &&
        competition.game !== null
    ) {
        return (
            competition.game.name ||
            competition.game.shortName ||
            competition.game.id ||
            competition.gameId ||
            "—"
        );
    }

    return (
        competition.game ||
        competition.game_name ||
        competition.gameId ||
        "—"
    );
};


const statusIs = (value, ...statuses) =>
    statuses.includes(
        String(value || "").toUpperCase()
    );


// The backend returns detailed matches grouped by team:
// participants = [{ teamName, players: [...] }, ...]
// The editor works with a flat player list, so normalize it here.
const flattenMatchPlayers = (match) => {
    const rawParticipants = Array.isArray(match?.participants)
        ? match.participants
        : [];

    const players = [];

    rawParticipants.forEach((team) => {
        const nestedPlayers = Array.isArray(team?.players)
            ? team.players
            : null;

        if (nestedPlayers) {
            nestedPlayers.forEach((player) => {
                const userId =
                    player.userId ??
                    player.user_id ??
                    player.playerId ??
                    player.player_id ??
                    player.id;

                if (userId === undefined || userId === null) {
                    return;
                }

                players.push({
                    ...player,
                    userId,
                    teamId:
                        player.teamId ??
                        player.team_id ??
                        team.teamId ??
                        team.team_id ??
                        team.clubId ??
                        team.club_id ??
                        team.participantId ??
                        team.participant_id,
                    teamName:
                        player.teamName ??
                        player.team_name ??
                        team.teamName ??
                        team.team_name ??
                        "—",
                    teamTag:
                        player.teamTag ??
                        player.team_tag ??
                        team.teamTag ??
                        team.team_tag ??
                        null,
                });
            });

            return;
        }

        // Compatibility with an older flat detailed response.
        const userId =
            team.userId ??
            team.user_id ??
            team.playerId ??
            team.player_id ??
            team.id;

        if (userId === undefined || userId === null) {
            return;
        }

        players.push({
            ...team,
            userId,
            teamId:
                team.teamId ??
                team.team_id ??
                team.clubId ??
                team.club_id,
            teamName:
                team.teamName ??
                team.team_name ??
                team.clubName ??
                team.club_name ??
                "—",
        });
    });

    const unique = new Map();

    players.forEach((player) => {
        unique.set(String(player.userId), player);
    });

    return Array.from(unique.values());
};


const normalizeMatch = (match) => ({
    ...match,
    players: flattenMatchPlayers(match),
});


const buildDraft = (match) => {
    const draft = {};

    for (const player of match?.players || []) {
        draft[player.userId] = {
            points: numericValue(
                player.points ?? player.score
            ),
            kills: numericValue(player.kills),
            assists: numericValue(player.assists),
            deaths: numericValue(player.deaths),
        };
    }

    return draft;
};


async function apiRequest(path, options = {}) {
    const response = await fetch(
        `${API_URL}${path}`,
        {
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
            ...options,
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`
        );
    }

    if (data?.success === false) {
        throw new Error(
            data.message ||
            data.error ||
            "Request failed."
        );
    }

    return data;
}


export default function LiveTournamentDashboard() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [activeSection, setActiveSection] =
        useState("overview");

    const [dashboard, setDashboard] =
        useState(null);

    const [selectedMatchId, setSelectedMatchId] =
        useState(null);

    const [selectedMatch, setSelectedMatch] =
        useState(null);

    const [scoreDraft, setScoreDraft] =
        useState({});

    const [resultsData, setResultsData] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [matchLoading, setMatchLoading] =
        useState(false);

    const [resultsLoading, setResultsLoading] =
        useState(false);

    const [startingMatch, setStartingMatch] =
        useState(false);

    const [savingScores, setSavingScores] =
        useState(false);

    const [finalizingCompetition, setFinalizingCompetition] =
        useState(false);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");


    const competition = dashboard?.competition || {};
    const overview = dashboard?.overview || {};
    const leaderboard = Array.isArray(dashboard?.leaderboard)
        ? dashboard.leaderboard
        : [];
    const matches = Array.isArray(dashboard?.matches)
        ? dashboard.matches
        : [];

    const isOrganizer = Boolean(
        dashboard?.viewer?.isOrganizer
    );

    const competitionIsCompleted = statusIs(
        competition.status,
        "COMPLETED"
    );


    const loadDashboard = useCallback(
        async (showLoader = false) => {
            if (!competitionId) {
                setError("Competition ID is missing.");
                setLoading(false);
                return;
            }

            try {
                if (showLoader) {
                    setLoading(true);
                }

                setError("");

                const data = await apiRequest(
                    `/api/live-tournaments/${competitionId}/dashboard`
                );

                if (!data?.success || !data?.dashboard) {
                    throw new Error(
                        data?.message ||
                        "Invalid tournament dashboard response."
                    );
                }

                const dashboardData = data.dashboard;
                setDashboard(dashboardData);

                const nextMatches =
                    Array.isArray(dashboardData.matches)
                        ? dashboardData.matches
                        : [];

                if (
                    selectedMatchId &&
                    !nextMatches.some(
                        (match) =>
                            String(match.id) ===
                            String(selectedMatchId)
                    )
                ) {
                    setSelectedMatchId(null);
                    setSelectedMatch(null);
                    setScoreDraft({});
                }

                if (
                    !selectedMatchId &&
                    dashboardData.overview?.liveMatchId
                ) {
                    setSelectedMatchId(
                        dashboardData.overview.liveMatchId
                    );
                }

            } catch (err) {
                console.error(
                    "Failed to load live tournament dashboard:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to load tournament."
                );
            } finally {
                if (showLoader) {
                    setLoading(false);
                }
            }
        },
        [competitionId, selectedMatchId]
    );


    const loadResults = useCallback(
        async (showLoader = true) => {
            if (!competitionId) return;

            try {
                if (showLoader) {
                    setResultsLoading(true);
                }

                const data = await apiRequest(
                    `/api/live-tournaments/${competitionId}/results`
                );

                if (!data?.success) {
                    throw new Error(
                        data?.message ||
                        "Unable to load final results."
                    );
                }

                setResultsData(data);
            } catch (err) {
                console.error(
                    "Failed to load final results:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to load final results."
                );
            } finally {
                if (showLoader) {
                    setResultsLoading(false);
                }
            }
        },
        [competitionId]
    );


    useEffect(() => {
        loadDashboard(true);
    }, [loadDashboard]);


    useEffect(() => {
        if (!competitionId) return undefined;

        const interval = setInterval(() => {
            loadDashboard(false);

            if (activeSection === "results") {
                loadResults(false);
            }
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [
        competitionId,
        activeSection,
        loadDashboard,
        loadResults,
    ]);


    const loadMatch = useCallback(
        async (matchId, showLoader = true) => {
            if (!competitionId || !matchId) return;

            try {
                if (showLoader) {
                    setMatchLoading(true);
                }

                setError("");

                const data = await apiRequest(
                    `/api/live-tournaments/${competitionId}/matches/${matchId}`
                );

                const normalized = normalizeMatch(
                    data?.match || data
                );

                if (!normalized?.id) {
                    throw new Error(
                        "Match data was not returned."
                    );
                }

                setSelectedMatch(normalized);
                setScoreDraft(buildDraft(normalized));

            } catch (err) {
                console.error(
                    "Failed to load match:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to load match."
                );
            } finally {
                if (showLoader) {
                    setMatchLoading(false);
                }
            }
        },
        [competitionId]
    );


    useEffect(() => {
        if (
            selectedMatchId &&
            !selectedMatch
        ) {
            loadMatch(selectedMatchId, true);
        }
    }, [
        selectedMatchId,
        selectedMatch,
        loadMatch,
    ]);


    const handleSelectMatch = async (matchId) => {
        setSelectedMatchId(matchId);
        await loadMatch(matchId, true);
    };


    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            setSuccessMessage("");

            await loadDashboard(false);

            if (selectedMatchId) {
                await loadMatch(
                    selectedMatchId,
                    false
                );
            }

            if (activeSection === "results") {
                await loadResults(false);
            }
        } finally {
            setRefreshing(false);
        }
    };


    const handleStartMatch = async () => {
        if (!isOrganizer || !selectedMatchId) {
            return;
        }

        if (!statusIs(
            selectedMatch?.status,
            "READY",
            "SCHEDULED"
        )) {
            return;
        }

        try {
            setStartingMatch(true);
            setError("");
            setSuccessMessage("");

            const data = await apiRequest(
                `/api/live-tournaments/${competitionId}/matches/${selectedMatchId}/start`,
                {
                    method: "POST",
                }
            );

            const normalized = normalizeMatch(
                data?.match || data
            );

            setSelectedMatch(normalized);
            setScoreDraft(buildDraft(normalized));

            await loadDashboard(false);
            await loadMatch(
                selectedMatchId,
                false
            );

            setSuccessMessage(
                "Match started successfully."
            );
        } catch (err) {
            console.error(
                "Failed to start match:",
                err
            );

            setError(
                err.message ||
                "Unable to start match."
            );
        } finally {
            setStartingMatch(false);
        }
    };


    const updatePlayerScore = (
        playerId,
        field,
        value
    ) => {
        if (!isOrganizer) return;

        setScoreDraft((previous) => ({
            ...previous,
            [playerId]: {
                ...(previous[playerId] || {}),
                [field]: value,
            },
        }));
    };


    const handleSaveScores = async (finalize = false) => {
        if (
            !isOrganizer ||
            !selectedMatchId ||
            !selectedMatch
        ) {
            return;
        }

        if (!statusIs(selectedMatch.status, "LIVE")) {
            return;
        }

        try {
            setSavingScores(true);
            setError("");
            setSuccessMessage("");

            const players = (
                selectedMatch.players || []
            ).map((player) => {
                const draft =
                    scoreDraft[player.userId] || {};

                return {
                    userId: Number(player.userId),
                    points: numericValue(draft.points),
                    kills: numericValue(draft.kills),
                    assists: numericValue(draft.assists),
                    deaths: numericValue(draft.deaths),
                };
            });

            const data = await apiRequest(
                `/api/live-tournaments/${competitionId}/matches/${selectedMatchId}/scores`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        players,
                        finalize,
                    }),
                }
            );

            const normalized = normalizeMatch(
                data?.match || selectedMatch
            );

            setSelectedMatch(normalized);
            setScoreDraft(buildDraft(normalized));

            await loadDashboard(false);
            await loadMatch(
                selectedMatchId,
                false
            );

            if (activeSection === "results") {
                await loadResults(false);
            }

            setSuccessMessage(
                finalize
                    ? "Match finalized successfully."
                    : "Live scores saved successfully."
            );
        } catch (err) {
            console.error(
                "Failed to save scores:",
                err
            );

            setError(
                err.message ||
                "Unable to save scores."
            );
        } finally {
            setSavingScores(false);
        }
    };


    const handleFinalizeCompetition = async () => {
        if (
            !isOrganizer ||
            competitionIsCompleted
        ) {
            return;
        }

        try {
            setFinalizingCompetition(true);
            setError("");
            setSuccessMessage("");

            const data = await apiRequest(
                `/api/live-tournaments/${competitionId}/finalize`,
                {
                    method: "POST",
                    body: JSON.stringify({}),
                }
            );

            await loadDashboard(false);
            await loadResults(false);

            setResultsData((previous) => ({
                ...(previous || {}),
                competition:
                    data?.competition ||
                    previous?.competition,
                results:
                    data?.finalResults ||
                    previous?.results ||
                    [],
            }));

            setActiveSection("results");
            setSuccessMessage(
                "Tournament finalized successfully."
            );
        } catch (err) {
            console.error(
                "Failed to finalize competition:",
                err
            );

            setError(
                err.message ||
                "Unable to finalize tournament."
            );
        } finally {
            setFinalizingCompetition(false);
        }
    };


    const teamCount = numericValue(
        overview.teams ??
        overview.team_count ??
        overview.teamCount
    );

    const playerCount = numericValue(
        overview.players ??
        overview.player_count ??
        overview.playerCount
    );

    const matchCount = numericValue(
        overview.matches ??
        overview.match_count ??
        overview.matchCount
    );

    const completedMatchCount = numericValue(
        overview.completedMatches ??
        overview.completed_match_count ??
        overview.completedMatchCount
    );

    const liveMatches = useMemo(
        () => matches.filter((match) =>
            statusIs(match.status, "LIVE")
        ),
        [matches]
    );

    const upcomingMatches = useMemo(
        () => matches.filter((match) =>
            statusIs(
                match.status,
                "READY",
                "SCHEDULED",
                "UPCOMING",
                "PENDING"
            )
        ),
        [matches]
    );

    const selectedMatchPlayers =
        selectedMatch?.players || [];

    const selectedMatchTeamTotals = useMemo(() => {
        const totals = {};

        for (const player of selectedMatchPlayers) {
            const teamId = String(
                player.teamId ??
                player.team_id ??
                player.teamName ??
                "unknown"
            );

            if (!totals[teamId]) {
                totals[teamId] = {
                    teamId,
                    teamName:
                        player.teamName ||
                        player.team_name ||
                        "Unknown Team",
                    points: 0,
                    kills: 0,
                };
            }

            const draft =
                scoreDraft[player.userId] || {};

            totals[teamId].points += numericValue(
                draft.points
            );

            totals[teamId].kills += numericValue(
                draft.kills
            );
        }

        return Object.values(totals);
    }, [selectedMatchPlayers, scoreDraft]);


    const resultRows = Array.isArray(resultsData?.results)
        ? resultsData.results
        : [];


    if (loading) {
        return (
            <div className="live-tournament-page">
                <div className="live-loading">
                    <div className="live-loading-spinner" />
                    <p>Loading tournament dashboard...</p>
                </div>
            </div>
        );
    }


    if (error && !dashboard) {
        return (
            <div className="live-tournament-page">
                <div className="live-error-screen">
                    <div className="live-error-box">
                        <h2>Unable to load tournament</h2>
                        <p>{error}</p>

                        <div className="live-error-actions">
                            <button
                                type="button"
                                onClick={() => loadDashboard(true)}
                            >
                                <RefreshCw size={16} />
                                Retry
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="live-tournament-page">

            <header className="live-tournament-header">
                <div className="live-header-left">
                    <button
                        type="button"
                        className="live-back-button"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div>
                        <div className="live-header-kicker">
                            LIVE TOURNAMENT
                        </div>

                        <h1>
                            {competition.title ||
                                competition.name ||
                                "Tournament"}
                        </h1>
                    </div>
                </div>

                <div className="live-header-right">
                    <div className="live-status-pill">
                        <span className="live-status-dot" />
                        {formatStatus(competition.status || "LIVE")}
                    </div>

                    <button
                        type="button"
                        className="live-refresh-button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw
                            size={16}
                            className={refreshing ? "live-spin" : ""}
                        />
                        Refresh
                    </button>
                </div>
            </header>


            {(error || successMessage) && (
                <div className="live-alert-wrapper">
                    {error && (
                        <div className="live-alert live-alert-error">
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={() => setError("")}
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {successMessage && (
                        <div className="live-alert live-alert-success">
                            <Check size={16} />
                            <span>{successMessage}</span>
                        </div>
                    )}
                </div>
            )}


            <section className="live-tournament-info">
                <div>
                    <span>GAME</span>
                    <strong>{getGameName(competition)}</strong>
                </div>

                <div>
                    <span>FORMAT</span>
                    <strong>
                        {competition.gameMode ||
                            competition.game_mode ||
                            competition.competitionType ||
                            competition.competition_type ||
                            "—"}
                    </strong>
                </div>

                <div>
                    <span>STATUS</span>
                    <strong>
                        {formatStatus(competition.status)}
                    </strong>
                </div>

                <div>
                    <span>ROLE</span>
                    <strong>
                        {isOrganizer ? "ORGANIZER" : "PLAYER"}
                    </strong>
                </div>
            </section>


            <nav className="live-section-tabs">
                <button
                    type="button"
                    className={activeSection === "overview" ? "active" : ""}
                    onClick={() => setActiveSection("overview")}
                >
                    <Activity size={16} />
                    Overview
                </button>

                <button
                    type="button"
                    className={activeSection === "leaderboard" ? "active" : ""}
                    onClick={() => setActiveSection("leaderboard")}
                >
                    <Trophy size={16} />
                    Leaderboard
                </button>

                <button
                    type="button"
                    className={activeSection === "matches" ? "active" : ""}
                    onClick={() => setActiveSection("matches")}
                >
                    <Swords size={16} />
                    Match Management
                </button>

                <button
                    type="button"
                    className={activeSection === "results" ? "active" : ""}
                    onClick={() => {
                        setActiveSection("results");
                        loadResults(true);
                    }}
                >
                    <Medal size={16} />
                    Final Results
                </button>
            </nav>


            <main className="live-tournament-content">

                {activeSection === "overview" && (
                    <section className="live-section">
                        <div className="live-section-heading">
                            <div>
                                <span>TOURNAMENT CONTROL</span>
                                <h2>Tournament Overview</h2>
                                <p>
                                    Monitor the current tournament state,
                                    teams, players and matches.
                                </p>
                            </div>
                        </div>

                        <div className="live-stat-grid">
                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Users size={19} />
                                </div>
                                <div>
                                    <span>TEAMS</span>
                                    <strong>{teamCount}</strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Users size={19} />
                                </div>
                                <div>
                                    <span>PLAYERS</span>
                                    <strong>{playerCount}</strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Swords size={19} />
                                </div>
                                <div>
                                    <span>TOTAL MATCHES</span>
                                    <strong>{matchCount}</strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Play size={19} />
                                </div>
                                <div>
                                    <span>LIVE MATCHES</span>
                                    <strong>{liveMatches.length}</strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Clock3 size={19} />
                                </div>
                                <div>
                                    <span>UPCOMING</span>
                                    <strong>{upcomingMatches.length}</strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Check size={19} />
                                </div>
                                <div>
                                    <span>COMPLETED</span>
                                    <strong>{completedMatchCount}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="live-overview-layout">
                            <div className="live-panel">
                                <div className="live-panel-header">
                                    <div>
                                        <span>CURRENT MATCH</span>
                                        <h3>Live Match</h3>
                                    </div>
                                </div>

                                {liveMatches.length ? (
                                    <div className="live-current-match-list">
                                        {liveMatches.map((match) => (
                                            <button
                                                key={match.id}
                                                type="button"
                                                className="live-current-match"
                                                onClick={() => {
                                                    setActiveSection("matches");
                                                    handleSelectMatch(match.id);
                                                }}
                                            >
                                                <div>
                                                    <span>
                                                        MATCH #{
                                                            match.matchNumber ||
                                                            match.match_number ||
                                                            match.id
                                                        }
                                                    </span>
                                                    <strong>
                                                        {match.name ||
                                                            `Match ${match.matchNumber ||
                                                            match.match_number ||
                                                            match.id
                                                            }`}
                                                    </strong>
                                                </div>

                                                <div className="live-current-match-status">
                                                    <span className="live-status-dot" />
                                                    LIVE
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="live-empty-state">
                                        <Play size={22} />
                                        <strong>No match is live</strong>
                                        <p>
                                            Start a scheduled match from Match
                                            Management.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="live-panel">
                                <div className="live-panel-header">
                                    <div>
                                        <span>RECENT ACTIVITY</span>
                                        <h3>Match Status</h3>
                                    </div>
                                </div>

                                <div className="live-mini-match-list">
                                    {matches.length === 0 ? (
                                        <div className="live-empty-small">
                                            No matches have been generated yet.
                                        </div>
                                    ) : (
                                        matches.slice(0, 6).map((match) => (
                                            <div
                                                className="live-mini-match"
                                                key={match.id}
                                            >
                                                <div>
                                                    <strong>
                                                        Match #{
                                                            match.matchNumber ||
                                                            match.match_number ||
                                                            match.id
                                                        }
                                                    </strong>
                                                    <span>
                                                        {formatDate(
                                                            match.updatedAt ||
                                                            match.updated_at ||
                                                            match.startedAt ||
                                                            match.started_at ||
                                                            match.scheduledAt ||
                                                            match.scheduled_at
                                                        )}
                                                    </span>
                                                </div>

                                                <span
                                                    className={`live-match-status status-${String(
                                                        match.status || ""
                                                    ).toLowerCase()}`}
                                                >
                                                    {formatStatus(match.status)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}


                {activeSection === "leaderboard" && (
                    <section className="live-section">
                        <div className="live-section-heading">
                            <div>
                                <span>LIVE STANDINGS</span>
                                <h2>Leaderboard</h2>
                                <p>
                                    Team points are calculated from the
                                    individual player points recorded for
                                    this tournament.
                                </p>
                            </div>
                        </div>

                        <div className="live-leaderboard">
                            {leaderboard.length === 0 ? (
                                <div className="live-empty-state large">
                                    <Trophy size={28} />
                                    <strong>No standings yet</strong>
                                    <p>
                                        Scores will appear here once matches
                                        begin.
                                    </p>
                                </div>
                            ) : (
                                leaderboard.map((team, index) => {
                                    const members =
                                        team.members ||
                                        team.players ||
                                        [];

                                    const teamTotal = numericValue(
                                        team.totalPoints
                                    ) || members.reduce(
                                        (total, player) =>
                                            total +
                                            numericValue(
                                                player.individualPoints ??
                                                player.points
                                            ),
                                        0
                                    );

                                    return (
                                        <div
                                            className="live-team-row"
                                            key={
                                                team.participantId ||
                                                team.teamId ||
                                                team.team_id ||
                                                team.id ||
                                                index
                                            }
                                        >
                                            <div className="live-team-rank">
                                                {team.rank || index + 1}
                                            </div>

                                            <div className="live-team-main">
                                                <div className="live-team-heading">
                                                    <div className="live-team-avatar">
                                                        {getInitials(
                                                            team.teamName ||
                                                            team.team_name ||
                                                            team.name ||
                                                            "Team"
                                                        )}
                                                    </div>

                                                    <div>
                                                        <h3>
                                                            {team.teamName ||
                                                                team.team_name ||
                                                                team.name ||
                                                                "Unnamed Team"}
                                                        </h3>
                                                        <span>
                                                            {members.length} player
                                                            {members.length !== 1
                                                                ? "s"
                                                                : ""}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="live-player-list">
                                                    {members.map(
                                                        (player, playerIndex) => {
                                                            const playerPoints = numericValue(
                                                                player.individualPoints ??
                                                                player.points
                                                            );

                                                            return (
                                                                <div
                                                                    className="live-player-row"
                                                                    key={
                                                                        player.userId ||
                                                                        player.user_id ||
                                                                        player.id ||
                                                                        playerIndex
                                                                    }
                                                                >
                                                                    <div className="live-player-info">
                                                                        <div className="live-player-avatar">
                                                                            {getInitials(
                                                                                player.name ||
                                                                                player.username ||
                                                                                "Player"
                                                                            )}
                                                                        </div>

                                                                        <div>
                                                                            <strong>
                                                                                {player.name ||
                                                                                    player.username ||
                                                                                    "Player"}
                                                                            </strong>
                                                                            {player.uid && (
                                                                                <span>
                                                                                    {player.uid}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="live-player-points">
                                                                        <strong>
                                                                            {playerPoints}
                                                                        </strong>
                                                                        <span>POINTS</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>

                                            <div className="live-team-total">
                                                <span>TEAM TOTAL</span>
                                                <strong>{teamTotal}</strong>
                                                <small>POINTS</small>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                )}


                {activeSection === "matches" && (
                    <section className="live-section">
                        <div className="live-section-heading">
                            <div>
                                <span>MATCH CONTROL</span>
                                <h2>Match Management</h2>
                                <p>
                                    {isOrganizer
                                        ? "Start matches, record live player scores, and finalize match results."
                                        : "View tournament matches and live scores. Match controls are available only to the organizer."}
                                </p>
                            </div>
                        </div>

                        <div className="live-match-management">
                            <div className="live-match-sidebar">
                                <div className="live-panel-header">
                                    <div>
                                        <span>MATCHES</span>
                                        <h3>Tournament Matches</h3>
                                    </div>
                                </div>

                                <div className="live-match-list">
                                    {matches.length === 0 ? (
                                        <div className="live-empty-small">
                                            No matches available.
                                        </div>
                                    ) : (
                                        matches.map((match) => (
                                            <button
                                                type="button"
                                                key={match.id}
                                                className={`live-match-list-item ${String(selectedMatchId) ===
                                                        String(match.id)
                                                        ? "selected"
                                                        : ""
                                                    }`}
                                                onClick={() =>
                                                    handleSelectMatch(match.id)
                                                }
                                            >
                                                <div className="live-match-number">
                                                    {match.matchNumber ||
                                                        match.match_number ||
                                                        match.id}
                                                </div>

                                                <div className="live-match-list-info">
                                                    <strong>
                                                        {match.name ||
                                                            `Match ${match.matchNumber ||
                                                            match.match_number ||
                                                            match.id
                                                            }`}
                                                    </strong>
                                                    <span>
                                                        {formatStatus(match.status)}
                                                    </span>
                                                </div>

                                                <ChevronDown
                                                    size={15}
                                                    className="live-match-chevron"
                                                />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="live-match-editor">
                                {!selectedMatchId ? (
                                    <div className="live-empty-state large">
                                        <Swords size={30} />
                                        <strong>Select a match</strong>
                                        <p>
                                            Select a match from the list to
                                            manage or view it.
                                        </p>
                                    </div>
                                ) : matchLoading ? (
                                    <div className="live-loading-inline">
                                        <div className="live-loading-spinner" />
                                        <p>Loading match...</p>
                                    </div>
                                ) : !selectedMatch ? (
                                    <div className="live-empty-state large">
                                        <Swords size={30} />
                                        <strong>Match unavailable</strong>
                                        <p>
                                            The selected match could not be loaded.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="live-editor-header">
                                            <div>
                                                <span>
                                                    MATCH #{
                                                        selectedMatch.matchNumber ||
                                                        selectedMatch.match_number ||
                                                        selectedMatch.id
                                                    }
                                                </span>
                                                <h3>
                                                    {selectedMatch.name ||
                                                        selectedMatch.roundName ||
                                                        `Match ${selectedMatch.matchNumber ||
                                                        selectedMatch.match_number ||
                                                        selectedMatch.id
                                                        }`}
                                                </h3>
                                                <p>
                                                    {formatStatus(
                                                        selectedMatch.status
                                                    )}
                                                    {selectedMatch.scheduledAt
                                                        ? ` • ${formatDate(
                                                            selectedMatch.scheduledAt
                                                        )}`
                                                        : ""}
                                                </p>
                                            </div>

                                            <div className="live-editor-actions">
                                                {isOrganizer &&
                                                    statusIs(
                                                        selectedMatch.status,
                                                        "READY",
                                                        "SCHEDULED"
                                                    ) && (
                                                        <button
                                                            type="button"
                                                            className="live-primary-button"
                                                            onClick={
                                                                handleStartMatch
                                                            }
                                                            disabled={
                                                                startingMatch
                                                            }
                                                        >
                                                            <Play size={16} />
                                                            {startingMatch
                                                                ? "Starting..."
                                                                : "Start Match"}
                                                        </button>
                                                    )}

                                                {isOrganizer &&
                                                    statusIs(
                                                        selectedMatch.status,
                                                        "LIVE"
                                                    ) && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="live-secondary-button"
                                                                onClick={() =>
                                                                    handleSaveScores(
                                                                        false
                                                                    )
                                                                }
                                                                disabled={
                                                                    savingScores
                                                                }
                                                            >
                                                                <Save size={16} />
                                                                Save Live Scores
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="live-primary-button"
                                                                onClick={() =>
                                                                    handleSaveScores(
                                                                        true
                                                                    )
                                                                }
                                                                disabled={
                                                                    savingScores
                                                                }
                                                            >
                                                                <Check size={16} />
                                                                Finalize Match
                                                            </button>
                                                        </>
                                                    )}
                                            </div>
                                        </div>

                                        {!isOrganizer && (
                                            <div className="live-score-note">
                                                <Target size={16} />
                                                <span>
                                                    Player view only. The organizer
                                                    controls match start and score
                                                    verification.
                                                </span>
                                            </div>
                                        )}

                                        <div className="live-match-team-summary">
                                            {selectedMatchTeamTotals.map((team) => (
                                                <div
                                                    className="live-team-summary-card"
                                                    key={team.teamId}
                                                >
                                                    <span>{team.teamName}</span>
                                                    <strong>{team.points}</strong>
                                                    <small>
                                                        TEAM POINTS • {team.kills} KILLS
                                                    </small>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="live-score-table-wrapper">
                                            <table className="live-score-table">
                                                <thead>
                                                    <tr>
                                                        <th>PLAYER</th>
                                                        <th>TEAM</th>
                                                        <th>POINTS</th>
                                                        <th>KILLS</th>
                                                        <th>ASSISTS</th>
                                                        <th>DEATHS</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {selectedMatchPlayers.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6}>
                                                                No registered players
                                                                found for this match.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        selectedMatchPlayers.map(
                                                            (player, index) => {
                                                                const draft =
                                                                    scoreDraft[
                                                                    player.userId
                                                                    ] || {};

                                                                const locked =
                                                                    !isOrganizer ||
                                                                    !statusIs(
                                                                        selectedMatch.status,
                                                                        "LIVE"
                                                                    ) ||
                                                                    statusIs(
                                                                        selectedMatch.status,
                                                                        "VERIFIED"
                                                                    );

                                                                return (
                                                                    <tr
                                                                        key={
                                                                            player.userId ||
                                                                            index
                                                                        }
                                                                    >
                                                                        <td>
                                                                            <div className="live-table-player">
                                                                                <div className="live-player-avatar">
                                                                                    {getInitials(
                                                                                        player.name ||
                                                                                        player.username ||
                                                                                        "Player"
                                                                                    )}
                                                                                </div>
                                                                                <div>
                                                                                    <strong>
                                                                                        {player.name ||
                                                                                            player.username ||
                                                                                            "Player"}
                                                                                    </strong>
                                                                                    {player.uid && (
                                                                                        <span>
                                                                                            {player.uid}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>

                                                                        <td>
                                                                            <span className="live-table-team">
                                                                                {player.teamName ||
                                                                                    "—"}
                                                                            </span>
                                                                        </td>

                                                                        {[
                                                                            "points",
                                                                            "kills",
                                                                            "assists",
                                                                            "deaths",
                                                                        ].map((field) => (
                                                                            <td key={field}>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={
                                                                                        draft[
                                                                                        field
                                                                                        ] ??
                                                                                        0
                                                                                    }
                                                                                    disabled={
                                                                                        locked
                                                                                    }
                                                                                    onChange={(
                                                                                        event
                                                                                    ) =>
                                                                                        updatePlayerScore(
                                                                                            player.userId,
                                                                                            field,
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                );
                                                            }
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="live-score-note">
                                            <Target size={16} />
                                            <span>
                                                Player scores are stored per match.
                                                Team points are calculated by
                                                summing the participating players'
                                                points.
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                )}


                {activeSection === "results" && (
                    <section className="live-section">
                        <div className="live-section-heading">
                            <div>
                                <span>TOURNAMENT OUTCOME</span>
                                <h2>Final Results</h2>
                                <p>
                                    {competitionIsCompleted
                                        ? "Final standings based on verified match scores."
                                        : "Current result preview. Final standings are locked when the organizer finalizes the tournament."}
                                </p>
                            </div>

                            {isOrganizer && !competitionIsCompleted && (
                                <div className="live-editor-actions">
                                    <button
                                        type="button"
                                        className="live-primary-button"
                                        onClick={handleFinalizeCompetition}
                                        disabled={finalizingCompetition}
                                    >
                                        <Check size={16} />
                                        {finalizingCompetition
                                            ? "Finalizing..."
                                            : "Finalize Tournament"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {resultsLoading ? (
                            <div className="live-loading-inline">
                                <div className="live-loading-spinner" />
                                <p>Loading final results...</p>
                            </div>
                        ) : resultRows.length === 0 ? (
                            <div className="live-empty-state large">
                                <Medal size={30} />
                                <strong>Results not available</strong>
                                <p>
                                    Results will appear after match scores are
                                    recorded.
                                </p>
                            </div>
                        ) : (
                            <div className="live-results">
                                {resultRows.map((team, index) => {
                                    const members =
                                        team.members ||
                                        team.players ||
                                        [];

                                    const finalPoints = numericValue(
                                        team.totalPoints
                                    ) || members.reduce(
                                        (total, player) =>
                                            total +
                                            numericValue(
                                                player.individualPoints ??
                                                player.points
                                            ),
                                        0
                                    );

                                    return (
                                        <div
                                            className={`live-result-row ${index === 0
                                                    ? "result-first"
                                                    : ""
                                                }`}
                                            key={
                                                team.participantId ||
                                                team.teamId ||
                                                team.id ||
                                                index
                                            }
                                        >
                                            <div className="live-result-rank">
                                                <span>
                                                    {team.finalRank ||
                                                        team.rank ||
                                                        index + 1}
                                                </span>
                                            </div>

                                            <div className="live-result-team">
                                                <div className="live-team-avatar">
                                                    {getInitials(
                                                        team.teamName ||
                                                        team.team_name ||
                                                        team.name ||
                                                        "Team"
                                                    )}
                                                </div>

                                                <div>
                                                    <strong>
                                                        {team.teamName ||
                                                            team.team_name ||
                                                            team.name ||
                                                            "Unnamed Team"}
                                                    </strong>
                                                    <span>
                                                        {members.length} player
                                                        {members.length !== 1
                                                            ? "s"
                                                            : ""}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="live-result-members">
                                                {members.map(
                                                    (player, playerIndex) => (
                                                        <div
                                                            className="live-result-member"
                                                            key={
                                                                player.userId ||
                                                                player.user_id ||
                                                                player.id ||
                                                                playerIndex
                                                            }
                                                        >
                                                            <span>
                                                                {player.name ||
                                                                    player.username ||
                                                                    "Player"}
                                                            </span>
                                                            <strong>
                                                                {numericValue(
                                                                    player.individualPoints ??
                                                                    player.points
                                                                )}
                                                            </strong>
                                                        </div>
                                                    )
                                                )}
                                            </div>

                                            <div className="live-result-points">
                                                <span>FINAL POINTS</span>
                                                <strong>{finalPoints}</strong>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
