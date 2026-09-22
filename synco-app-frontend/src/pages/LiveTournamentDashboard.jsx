import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Check,
    ChevronDown,
    Clock3,
    Play,
    RefreshCw,
    Save,
    Trophy,
    Users,
    Swords,
    Activity,
    Target,
    Medal,
} from "lucide-react";

import "../styles/pages/LiveTournamentDashboard.css";


// =========================================================
// CONFIG
// =========================================================

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";

const POLL_INTERVAL = 5000;


// =========================================================
// HELPERS
// =========================================================

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
};


const formatStatus = (status) => {
    if (!status) return "UNKNOWN";

    return String(status)
        .replaceAll("_", " ")
        .toUpperCase();
};


const getInitials = (name = "") => {
    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return "?";
    }

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
};


const numericValue = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return number;
};


const getGameName = (competition) => {
    if (!competition) {
        return "—";
    }

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


// =========================================================
// API
// =========================================================

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
        const message =
            data?.error ||
            data?.message ||
            `Request failed with status ${response.status}`;

        throw new Error(message);
    }

    if (
        data &&
        data.success === false
    ) {
        throw new Error(
            data.message ||
            data.error ||
            "Request failed."
        );
    }

    return data;
}


// =========================================================
// MAIN COMPONENT
// =========================================================

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

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [matchLoading, setMatchLoading] =
        useState(false);

    const [savingScores, setSavingScores] =
        useState(false);

    const [startingMatch, setStartingMatch] =
        useState(false);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");


    // =====================================================
    // LOAD DASHBOARD
    // =====================================================

    const loadDashboard = useCallback(
        async (showLoader = false) => {
            if (!competitionId) {
                setError(
                    "Competition ID is missing."
                );

                setLoading(false);

                return;
            }

            try {
                if (showLoader) {
                    setLoading(true);
                }

                setError("");

                const data =
                    await apiRequest(
                        `/api/live-tournaments/${competitionId}/dashboard`
                    );


                // IMPORTANT:
                // Backend response:
                //
                // {
                //     success: true,
                //     dashboard: {
                //         competition: {},
                //         overview: {},
                //         leaderboard: [],
                //         matches: []
                //     }
                // }
                //
                // Therefore we MUST store data.dashboard.

                if (
                    !data ||
                    !data.success ||
                    !data.dashboard
                ) {
                    throw new Error(
                        data?.message ||
                        "Invalid tournament dashboard response."
                    );
                }

                const dashboardData =
                    data.dashboard;

                setDashboard(
                    dashboardData
                );


                const matches =
                    dashboardData.matches || [];


                // If currently selected match
                // disappeared, clear it.

                if (
                    selectedMatchId &&
                    !matches.some(
                        (match) =>
                            String(match.id) ===
                            String(selectedMatchId)
                    )
                ) {
                    setSelectedMatchId(null);
                    setSelectedMatch(null);
                    setScoreDraft({});
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
        [
            competitionId,
            selectedMatchId,
        ]
    );


    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {
        loadDashboard(true);
    }, [loadDashboard]);


    // =====================================================
    // LIVE POLLING
    // =====================================================

    useEffect(() => {
        if (!competitionId) {
            return;
        }

        const interval =
            setInterval(() => {
                loadDashboard(false);
            }, POLL_INTERVAL);

        return () => {
            clearInterval(interval);
        };
    }, [
        competitionId,
        loadDashboard,
    ]);


    // =====================================================
    // LOAD MATCH
    // =====================================================

    const loadMatch = useCallback(
        async (
            matchId,
            showLoader = true
        ) => {
            if (
                !competitionId ||
                !matchId
            ) {
                return;
            }

            try {
                if (showLoader) {
                    setMatchLoading(true);
                }

                setError("");

                const data =
                    await apiRequest(
                        `/api/live-tournaments/${competitionId}/matches/${matchId}`
                    );


                const match =
                    data?.match ||
                    data;


                if (!match) {
                    throw new Error(
                        "Match data was not returned."
                    );
                }


                setSelectedMatch(match);


                const draft = {};

                const participants =
                    match.participants ||
                    [];


                participants.forEach(
                    (player) => {
                        draft[
                            player.player_id
                        ] = {
                            points:
                                numericValue(
                                    player.points
                                ),

                            kills:
                                numericValue(
                                    player.kills
                                ),

                            assists:
                                numericValue(
                                    player.assists
                                ),

                            deaths:
                                numericValue(
                                    player.deaths
                                ),
                        };
                    }
                );


                setScoreDraft(draft);

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


    // =====================================================
    // SELECT MATCH
    // =====================================================

    const handleSelectMatch =
        async (matchId) => {
            setSelectedMatchId(
                matchId
            );

            await loadMatch(
                matchId,
                true
            );
        };


    // =====================================================
    // REFRESH
    // =====================================================

    const handleRefresh =
        async () => {
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

            } finally {
                setRefreshing(false);
            }
        };


    // =====================================================
    // START MATCH
    // =====================================================

    const handleStartMatch =
        async () => {
            if (!selectedMatchId) {
                return;
            }

            try {
                setStartingMatch(true);
                setError("");
                setSuccessMessage("");

                const data =
                    await apiRequest(
                        `/api/live-tournaments/${competitionId}/matches/${selectedMatchId}/start`,
                        {
                            method: "POST",
                        }
                    );


                const match =
                    data?.match ||
                    data;

                setSelectedMatch(
                    match
                );


                await loadDashboard(
                    false
                );


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


    // =====================================================
    // SCORE CHANGE
    // =====================================================

    const updatePlayerScore = (
        playerId,
        field,
        value
    ) => {
        setScoreDraft(
            (previous) => ({
                ...previous,

                [playerId]: {
                    ...(previous[playerId] ||
                        {}),
                    [field]: value,
                },
            })
        );
    };


    // =====================================================
    // SAVE SCORES
    // =====================================================

    const handleSaveScores =
        async (
            finalize = false
        ) => {
            if (!selectedMatchId) {
                return;
            }

            try {
                setSavingScores(true);
                setError("");
                setSuccessMessage("");


                const players =
                    Object.entries(
                        scoreDraft
                    ).map(
                        ([
                            playerId,
                            stats,
                        ]) => ({
                            player_id:
                                Number(
                                    playerId
                                ),

                            points:
                                numericValue(
                                    stats.points
                                ),

                            kills:
                                numericValue(
                                    stats.kills
                                ),

                            assists:
                                numericValue(
                                    stats.assists
                                ),

                            deaths:
                                numericValue(
                                    stats.deaths
                                ),
                        })
                    );


                const data =
                    await apiRequest(
                        `/api/live-tournaments/${competitionId}/matches/${selectedMatchId}/scores`,
                        {
                            method: "POST",

                            body: JSON.stringify(
                                {
                                    players,
                                    finalize,
                                }
                            ),
                        }
                    );


                if (data?.match) {
                    setSelectedMatch(
                        data.match
                    );
                }


                await loadDashboard(
                    false
                );


                await loadMatch(
                    selectedMatchId,
                    false
                );


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


    // =====================================================
    // DATA
    // =====================================================

    const competition =
        dashboard?.competition ||
        {};

    const overview =
        dashboard?.overview ||
        {};

    const leaderboard =
        dashboard?.leaderboard ||
        [];

    const matches =
        dashboard?.matches ||
        [];


    // =====================================================
    // NORMALIZED OVERVIEW
    // =====================================================

    const teamCount =
        numericValue(
            overview.teams ??
            overview.team_count ??
            overview.teamCount
        );

    const playerCount =
        numericValue(
            overview.players ??
            overview.player_count ??
            overview.playerCount
        );

    const matchCount =
        numericValue(
            overview.matches ??
            overview.match_count ??
            overview.matchCount
        );

    const completedMatchCount =
        numericValue(
            overview.completedMatches ??
            overview.completed_match_count ??
            overview.completedMatchCount
        );

    const liveMatchId =
        overview.liveMatchId ??
        overview.live_match_id ??
        null;


    const liveMatchCount =
        matches.filter(
            (match) =>
                String(
                    match.status || ""
                ).toUpperCase() ===
                "LIVE"
        ).length;


    const upcomingMatchCount =
        matches.filter(
            (match) =>
                [
                    "SCHEDULED",
                    "UPCOMING",
                    "PENDING",
                ].includes(
                    String(
                        match.status || ""
                    ).toUpperCase()
                )
        ).length;


    // =====================================================
    // MATCH TOTALS
    // =====================================================

    const selectedMatchTeamTotals =
        useMemo(() => {
            const totals = {};

            if (
                !selectedMatch?.participants
            ) {
                return totals;
            }


            selectedMatch.participants.forEach(
                (player) => {
                    const teamId =
                        player.team_id ??
                        player.club_id ??
                        player.teamId ??
                        player.clubId ??
                        "unknown";


                    if (
                        !totals[teamId]
                    ) {
                        totals[teamId] = 0;
                    }


                    const draft =
                        scoreDraft[
                        player.player_id
                        ] || {};


                    totals[teamId] +=
                        numericValue(
                            draft.points
                        );
                }
            );


            return totals;
        }, [
            selectedMatch,
            scoreDraft,
        ]);


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {
        return (
            <div className="live-tournament-page">
                <div className="live-loading">
                    <div className="live-loading-spinner" />

                    <p>
                        Loading tournament dashboard...
                    </p>
                </div>
            </div>
        );
    }


    // =====================================================
    // ERROR WITHOUT DASHBOARD
    // =====================================================

    if (
        error &&
        !dashboard
    ) {
        return (
            <div className="live-tournament-page">

                <div className="live-error-screen">

                    <div className="live-error-box">

                        <h2>
                            Unable to load tournament
                        </h2>

                        <p>
                            {error}
                        </p>

                        <div className="live-error-actions">

                            <button
                                type="button"
                                onClick={() =>
                                    loadDashboard(
                                        true
                                    )
                                }
                            >
                                <RefreshCw
                                    size={16}
                                />

                                Retry
                            </button>


                            <button
                                type="button"
                                onClick={() =>
                                    navigate(-1)
                                }
                            >
                                Go Back
                            </button>

                        </div>

                    </div>

                </div>

            </div>
        );
    }


    // =====================================================
    // RENDER
    // =====================================================

    return (
        <div className="live-tournament-page">

            {/* =================================================
                TOP BAR
            ================================================= */}

            <header className="live-tournament-header">

                <div className="live-header-left">

                    <button
                        type="button"
                        className="live-back-button"
                        onClick={() =>
                            navigate(-1)
                        }
                    >
                        <ArrowLeft
                            size={18}
                        />
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

                        LIVE
                    </div>


                    <button
                        type="button"
                        className="live-refresh-button"
                        onClick={
                            handleRefresh
                        }
                        disabled={
                            refreshing
                        }
                    >
                        <RefreshCw
                            size={16}
                            className={
                                refreshing
                                    ? "live-spin"
                                    : ""
                            }
                        />

                        Refresh
                    </button>

                </div>

            </header>


            {/* =================================================
                ALERTS
            ================================================= */}

            {(error ||
                successMessage) && (
                    <div className="live-alert-wrapper">

                        {error && (
                            <div className="live-alert live-alert-error">

                                <span>
                                    {error}
                                </span>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setError(
                                            ""
                                        )
                                    }
                                >
                                    Dismiss
                                </button>

                            </div>
                        )}


                        {successMessage && (
                            <div className="live-alert live-alert-success">

                                <Check
                                    size={16}
                                />

                                <span>
                                    {successMessage}
                                </span>

                            </div>
                        )}

                    </div>
                )}


            {/* =================================================
                TOURNAMENT INFO
            ================================================= */}

            <section className="live-tournament-info">

                <div>
                    <span>
                        GAME
                    </span>

                    <strong>
                        {getGameName(
                            competition
                        )}
                    </strong>
                </div>


                <div>
                    <span>
                        FORMAT
                    </span>

                    <strong>
                        {competition.gameMode ||
                            competition.game_mode ||
                            competition.competitionType ||
                            competition.competition_type ||
                            "—"}
                    </strong>
                </div>


                <div>
                    <span>
                        STATUS
                    </span>

                    <strong>
                        {formatStatus(
                            competition.status
                        )}
                    </strong>
                </div>


                <div>
                    <span>
                        UPDATED
                    </span>

                    <strong>
                        LIVE
                    </strong>
                </div>

            </section>


            {/* =================================================
                NAVIGATION
            ================================================= */}

            <nav className="live-section-tabs">

                <button
                    type="button"
                    className={
                        activeSection ===
                            "overview"
                            ? "active"
                            : ""
                    }
                    onClick={() =>
                        setActiveSection(
                            "overview"
                        )
                    }
                >
                    <Activity
                        size={16}
                    />

                    Overview
                </button>


                <button
                    type="button"
                    className={
                        activeSection ===
                            "leaderboard"
                            ? "active"
                            : ""
                    }
                    onClick={() =>
                        setActiveSection(
                            "leaderboard"
                        )
                    }
                >
                    <Trophy
                        size={16}
                    />

                    Leaderboard
                </button>


                <button
                    type="button"
                    className={
                        activeSection ===
                            "matches"
                            ? "active"
                            : ""
                    }
                    onClick={() =>
                        setActiveSection(
                            "matches"
                        )
                    }
                >
                    <Swords
                        size={16}
                    />

                    Match Management
                </button>


                <button
                    type="button"
                    className={
                        activeSection ===
                            "results"
                            ? "active"
                            : ""
                    }
                    onClick={() =>
                        setActiveSection(
                            "results"
                        )
                    }
                >
                    <Medal
                        size={16}
                    />

                    Final Results
                </button>

            </nav>


            {/* =================================================
                CONTENT
            ================================================= */}

            <main className="live-tournament-content">

                {/* =================================================
                    OVERVIEW
                ================================================= */}

                {activeSection ===
                    "overview" && (

                        <section className="live-section">

                            <div className="live-section-heading">

                                <div>

                                    <span>
                                        TOURNAMENT CONTROL
                                    </span>

                                    <h2>
                                        Tournament Overview
                                    </h2>

                                    <p>
                                        Monitor the current
                                        tournament state,
                                        teams, players and
                                        matches.
                                    </p>

                                </div>

                            </div>


                            <div className="live-stat-grid">

                                <div className="live-stat-card">

                                    <div className="live-stat-icon">
                                        <Users
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <span>
                                            TEAMS
                                        </span>

                                        <strong>
                                            {teamCount}
                                        </strong>

                                    </div>

                                </div>


                                <div className="live-stat-card">

                                    <div className="live-stat-icon">
                                        <Users
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <span>
                                            PLAYERS
                                        </span>

                                        <strong>
                                            {playerCount}
                                        </strong>

                                    </div>

                                </div>


                                <div className="live-stat-card">

                                    <div className="live-stat-icon">
                                        <Swords
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <span>
                                            TOTAL MATCHES
                                        </span>

                                        <strong>
                                            {matchCount}
                                        </strong>

                                    </div>

                                </div>


                                <div className="live-stat-card">

                                    <div className="live-stat-icon">
                                        <Play
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <span>
                                            LIVE MATCHES
                                        </span>

                                        <strong>
                                            {liveMatchCount ||
                                                (liveMatchId
                                                    ? 1
                                                    : 0)}
                                        </strong>

                                    </div>

                                </div>


                                <div className="live-stat-card">

                                    <div className="live-stat-icon">
                                        <Clock3
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <span>
                                            UPCOMING
                                        </span>

                                        <strong>
                                            {
                                                upcomingMatchCount
                                            }
                                        </strong>

                                    </div>

                                </div>


                                <div className="live-stat-card">

                                    <div className="live-stat-icon">
                                        <Check
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <span>
                                            COMPLETED
                                        </span>

                                        <strong>
                                            {
                                                completedMatchCount
                                            }
                                        </strong>

                                    </div>

                                </div>

                            </div>


                            <div className="live-overview-layout">

                                <div className="live-panel">

                                    <div className="live-panel-header">

                                        <div>

                                            <span>
                                                CURRENT MATCH
                                            </span>

                                            <h3>
                                                Live Match
                                            </h3>

                                        </div>

                                    </div>


                                    {matches.filter(
                                        (match) =>
                                            String(
                                                match.status ||
                                                ""
                                            ).toUpperCase() ===
                                            "LIVE"
                                    ).length > 0 ? (

                                        <div className="live-current-match-list">

                                            {matches
                                                .filter(
                                                    (match) =>
                                                        String(
                                                            match.status ||
                                                            ""
                                                        ).toUpperCase() ===
                                                        "LIVE"
                                                )
                                                .map(
                                                    (
                                                        match
                                                    ) => (

                                                        <button
                                                            key={
                                                                match.id
                                                            }
                                                            type="button"
                                                            className="live-current-match"
                                                            onClick={() => {

                                                                setActiveSection(
                                                                    "matches"
                                                                );

                                                                handleSelectMatch(
                                                                    match.id
                                                                );

                                                            }}
                                                        >

                                                            <div>

                                                                <span>
                                                                    MATCH #
                                                                    {
                                                                        match.match_number ||
                                                                        match.matchNumber ||
                                                                        match.id
                                                                    }
                                                                </span>

                                                                <strong>
                                                                    {match.name ||
                                                                        `Match ${match.match_number ||
                                                                        match.matchNumber ||
                                                                        match.id
                                                                        }`}
                                                                </strong>

                                                            </div>


                                                            <div className="live-current-match-status">

                                                                <span className="live-status-dot" />

                                                                LIVE

                                                            </div>

                                                        </button>

                                                    )
                                                )}

                                        </div>

                                    ) : (

                                        <div className="live-empty-state">

                                            <Play
                                                size={22}
                                            />

                                            <strong>
                                                No match is live
                                            </strong>

                                            <p>
                                                Start a scheduled
                                                match from Match
                                                Management.
                                            </p>

                                        </div>

                                    )}

                                </div>


                                <div className="live-panel">

                                    <div className="live-panel-header">

                                        <div>

                                            <span>
                                                RECENT ACTIVITY
                                            </span>

                                            <h3>
                                                Match Status
                                            </h3>

                                        </div>

                                    </div>


                                    <div className="live-mini-match-list">

                                        {matches.length ===
                                            0 ? (

                                            <div className="live-empty-small">
                                                No matches have been
                                                generated yet.
                                            </div>

                                        ) : (

                                            matches
                                                .slice(
                                                    0,
                                                    6
                                                )
                                                .map(
                                                    (
                                                        match
                                                    ) => (

                                                        <div
                                                            className="live-mini-match"
                                                            key={
                                                                match.id
                                                            }
                                                        >

                                                            <div>

                                                                <strong>
                                                                    Match #
                                                                    {
                                                                        match.match_number ||
                                                                        match.matchNumber ||
                                                                        match.id
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {formatDate(
                                                                        match.updated_at ||
                                                                        match.updatedAt ||
                                                                        match.started_at ||
                                                                        match.startedAt ||
                                                                        match.scheduled_at ||
                                                                        match.scheduledAt
                                                                    )}
                                                                </span>

                                                            </div>


                                                            <span
                                                                className={`live-match-status status-${String(
                                                                    match.status ||
                                                                    ""
                                                                ).toLowerCase()}`}
                                                            >
                                                                {formatStatus(
                                                                    match.status
                                                                )}
                                                            </span>

                                                        </div>

                                                    )
                                                )

                                        )}

                                    </div>

                                </div>

                            </div>

                        </section>
                    )}


                {/* =================================================
                    LEADERBOARD
                ================================================= */}

                {activeSection ===
                    "leaderboard" && (

                        <section className="live-section">

                            <div className="live-section-heading">

                                <div>

                                    <span>
                                        LIVE STANDINGS
                                    </span>

                                    <h2>
                                        Leaderboard
                                    </h2>

                                    <p>
                                        Team points are
                                        automatically calculated
                                        from individual player
                                        points.
                                    </p>

                                </div>

                            </div>


                            <div className="live-leaderboard">

                                {leaderboard.length ===
                                    0 ? (

                                    <div className="live-empty-state large">

                                        <Trophy
                                            size={28}
                                        />

                                        <strong>
                                            No standings yet
                                        </strong>

                                        <p>
                                            Scores will appear
                                            here once matches
                                            begin.
                                        </p>

                                    </div>

                                ) : (

                                    leaderboard.map(
                                        (
                                            team,
                                            index
                                        ) => {

                                            const members =
                                                team.members ||
                                                team.players ||
                                                [];


                                            const calculatedTotal =
                                                members.reduce(
                                                    (
                                                        total,
                                                        player
                                                    ) =>
                                                        total +
                                                        numericValue(
                                                            player.points
                                                        ),
                                                    0
                                                );


                                            const teamTotal =
                                                calculatedTotal;


                                            return (

                                                <div
                                                    className="live-team-row"
                                                    key={
                                                        team.team_id ||
                                                        team.club_id ||
                                                        team.id ||
                                                        index
                                                    }
                                                >

                                                    <div className="live-team-rank">
                                                        {team.rank ||
                                                            index + 1}
                                                    </div>


                                                    <div className="live-team-main">

                                                        <div className="live-team-heading">

                                                            <div className="live-team-avatar">
                                                                {getInitials(
                                                                    team.team_name ||
                                                                    team.name ||
                                                                    "Team"
                                                                )}
                                                            </div>


                                                            <div>

                                                                <h3>
                                                                    {team.team_name ||
                                                                        team.name ||
                                                                        "Unnamed Team"}
                                                                </h3>

                                                                <span>
                                                                    {
                                                                        members.length
                                                                    }{" "}
                                                                    player
                                                                    {members.length !==
                                                                        1
                                                                        ? "s"
                                                                        : ""}
                                                                </span>

                                                            </div>

                                                        </div>


                                                        <div className="live-player-list">

                                                            {members.map(
                                                                (
                                                                    player,
                                                                    playerIndex
                                                                ) => (

                                                                    <div
                                                                        className="live-player-row"
                                                                        key={
                                                                            player.player_id ||
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
                                                                                        {
                                                                                            player.uid
                                                                                        }
                                                                                    </span>
                                                                                )}

                                                                            </div>

                                                                        </div>


                                                                        <div className="live-player-points">

                                                                            <strong>
                                                                                {
                                                                                    numericValue(
                                                                                        player.points
                                                                                    )
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                POINTS
                                                                            </span>

                                                                        </div>

                                                                    </div>

                                                                )
                                                            )}

                                                        </div>

                                                    </div>


                                                    <div className="live-team-total">

                                                        <span>
                                                            TEAM TOTAL
                                                        </span>

                                                        <strong>
                                                            {
                                                                teamTotal
                                                            }
                                                        </strong>

                                                        <small>
                                                            POINTS
                                                        </small>

                                                    </div>

                                                </div>

                                            );
                                        }
                                    )

                                )}

                            </div>

                        </section>
                    )}


                {/* =================================================
                    MATCH MANAGEMENT
                ================================================= */}

                {activeSection ===
                    "matches" && (

                        <section className="live-section">

                            <div className="live-section-heading">

                                <div>

                                    <span>
                                        MATCH CONTROL
                                    </span>

                                    <h2>
                                        Match Management
                                    </h2>

                                    <p>
                                        Start matches and enter
                                        live player scores.
                                        Players are managed by
                                        the existing tournament
                                        registration system.
                                    </p>

                                </div>

                            </div>


                            <div className="live-match-management">

                                {/* MATCH LIST */}

                                <div className="live-match-sidebar">

                                    <div className="live-panel-header">

                                        <div>

                                            <span>
                                                MATCHES
                                            </span>

                                            <h3>
                                                Tournament Matches
                                            </h3>

                                        </div>

                                    </div>


                                    <div className="live-match-list">

                                        {matches.length ===
                                            0 ? (

                                            <div className="live-empty-small">
                                                No matches available.
                                            </div>

                                        ) : (

                                            matches.map(
                                                (
                                                    match
                                                ) => (

                                                    <button
                                                        type="button"
                                                        key={
                                                            match.id
                                                        }
                                                        className={`live-match-list-item ${String(
                                                            selectedMatchId
                                                        ) ===
                                                            String(
                                                                match.id
                                                            )
                                                            ? "selected"
                                                            : ""
                                                            }`}
                                                        onClick={() =>
                                                            handleSelectMatch(
                                                                match.id
                                                            )
                                                        }
                                                    >

                                                        <div className="live-match-number">
                                                            {
                                                                match.match_number ||
                                                                match.matchNumber ||
                                                                match.id
                                                            }
                                                        </div>


                                                        <div className="live-match-list-info">

                                                            <strong>
                                                                {match.name ||
                                                                    `Match ${match.match_number ||
                                                                    match.matchNumber ||
                                                                    match.id
                                                                    }`}
                                                            </strong>

                                                            <span>
                                                                {formatStatus(
                                                                    match.status
                                                                )}
                                                            </span>

                                                        </div>


                                                        <ChevronDown
                                                            size={15}
                                                            className="live-match-chevron"
                                                        />

                                                    </button>

                                                )
                                            )

                                        )}

                                    </div>

                                </div>


                                {/* MATCH EDITOR */}

                                <div className="live-match-editor">

                                    {!selectedMatchId ? (

                                        <div className="live-empty-state large">

                                            <Swords
                                                size={30}
                                            />

                                            <strong>
                                                Select a match
                                            </strong>

                                            <p>
                                                Select a match from
                                                the list to manage
                                                it.
                                            </p>

                                        </div>

                                    ) : matchLoading ? (

                                        <div className="live-loading-inline">

                                            <div className="live-loading-spinner" />

                                            <p>
                                                Loading match...
                                            </p>

                                        </div>

                                    ) : selectedMatch ? (

                                        <>

                                            <div className="live-editor-header">

                                                <div>

                                                    <span>
                                                        MATCH #
                                                        {
                                                            selectedMatch.match_number ||
                                                            selectedMatch.matchNumber ||
                                                            selectedMatch.id
                                                        }
                                                    </span>

                                                    <h3>
                                                        {selectedMatch.name ||
                                                            `Match ${selectedMatch.match_number ||
                                                            selectedMatch.matchNumber ||
                                                            selectedMatch.id
                                                            }`}
                                                    </h3>

                                                    <p>
                                                        {formatStatus(
                                                            selectedMatch.status
                                                        )}
                                                    </p>

                                                </div>


                                                <div className="live-editor-actions">

                                                    {String(
                                                        selectedMatch.status ||
                                                        ""
                                                    ).toUpperCase() !==
                                                        "LIVE" &&
                                                        String(
                                                            selectedMatch.status ||
                                                            ""
                                                        ).toUpperCase() !==
                                                        "VERIFIED" && (

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

                                                                <Play
                                                                    size={
                                                                        16
                                                                    }
                                                                />

                                                                {startingMatch
                                                                    ? "Starting..."
                                                                    : "Start Match"}

                                                            </button>
                                                        )}


                                                    {String(
                                                        selectedMatch.status ||
                                                        ""
                                                    ).toUpperCase() ===
                                                        "LIVE" && (

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

                                                                    <Save
                                                                        size={
                                                                            16
                                                                        }
                                                                    />

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

                                                                    <Check
                                                                        size={
                                                                            16
                                                                        }
                                                                    />

                                                                    Finalize Match

                                                                </button>

                                                            </>
                                                        )}

                                                </div>

                                            </div>


                                            <div className="live-match-team-summary">

                                                {Object.entries(
                                                    selectedMatchTeamTotals
                                                ).map(
                                                    ([
                                                        teamId,
                                                        total,
                                                    ]) => {

                                                        const teamPlayers =
                                                            (
                                                                selectedMatch.participants ||
                                                                []
                                                            ).filter(
                                                                (
                                                                    player
                                                                ) =>
                                                                    String(
                                                                        player.team_id ??
                                                                        player.club_id ??
                                                                        player.teamId ??
                                                                        player.clubId ??
                                                                        "unknown"
                                                                    ) ===
                                                                    String(
                                                                        teamId
                                                                    )
                                                            );


                                                        const teamName =
                                                            teamPlayers[0]
                                                                ?.team_name ||
                                                            teamPlayers[0]
                                                                ?.club_name ||
                                                            teamPlayers[0]
                                                                ?.teamName ||
                                                            `Team ${teamId}`;


                                                        return (

                                                            <div
                                                                className="live-team-summary-card"
                                                                key={
                                                                    teamId
                                                                }
                                                            >

                                                                <span>
                                                                    {
                                                                        teamName
                                                                    }
                                                                </span>

                                                                <strong>
                                                                    {total}
                                                                </strong>

                                                                <small>
                                                                    TEAM POINTS
                                                                </small>

                                                            </div>

                                                        );
                                                    }
                                                )}

                                            </div>


                                            <div className="live-score-table-wrapper">

                                                <table className="live-score-table">

                                                    <thead>

                                                        <tr>

                                                            <th>
                                                                PLAYER
                                                            </th>

                                                            <th>
                                                                TEAM
                                                            </th>

                                                            <th>
                                                                POINTS
                                                            </th>

                                                            <th>
                                                                KILLS
                                                            </th>

                                                            <th>
                                                                ASSISTS
                                                            </th>

                                                            <th>
                                                                DEATHS
                                                            </th>

                                                        </tr>

                                                    </thead>


                                                    <tbody>

                                                        {(
                                                            selectedMatch.participants ||
                                                            []
                                                        ).length ===
                                                            0 ? (

                                                            <tr>

                                                                <td
                                                                    colSpan={
                                                                        6
                                                                    }
                                                                >
                                                                    No registered
                                                                    players found
                                                                    for this match.
                                                                </td>

                                                            </tr>

                                                        ) : (

                                                            (
                                                                selectedMatch.participants ||
                                                                []
                                                            ).map(
                                                                (
                                                                    player,
                                                                    index
                                                                ) => {

                                                                    const draft =
                                                                        scoreDraft[
                                                                        player.player_id
                                                                        ] ||
                                                                        {};

                                                                    const locked =
                                                                        String(
                                                                            selectedMatch.status ||
                                                                            ""
                                                                        ).toUpperCase() ===
                                                                        "VERIFIED";


                                                                    return (

                                                                        <tr
                                                                            key={
                                                                                player.player_id ||
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
                                                                                                {
                                                                                                    player.uid
                                                                                                }
                                                                                            </span>
                                                                                        )}

                                                                                    </div>

                                                                                </div>

                                                                            </td>


                                                                            <td>

                                                                                <span className="live-table-team">
                                                                                    {player.team_name ||
                                                                                        player.club_name ||
                                                                                        player.teamName ||
                                                                                        "—"}
                                                                                </span>

                                                                            </td>


                                                                            <td>

                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={
                                                                                        draft.points ??
                                                                                        0
                                                                                    }
                                                                                    disabled={
                                                                                        locked
                                                                                    }
                                                                                    onChange={(
                                                                                        event
                                                                                    ) =>
                                                                                        updatePlayerScore(
                                                                                            player.player_id,
                                                                                            "points",
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />

                                                                            </td>


                                                                            <td>

                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={
                                                                                        draft.kills ??
                                                                                        0
                                                                                    }
                                                                                    disabled={
                                                                                        locked
                                                                                    }
                                                                                    onChange={(
                                                                                        event
                                                                                    ) =>
                                                                                        updatePlayerScore(
                                                                                            player.player_id,
                                                                                            "kills",
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />

                                                                            </td>


                                                                            <td>

                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={
                                                                                        draft.assists ??
                                                                                        0
                                                                                    }
                                                                                    disabled={
                                                                                        locked
                                                                                    }
                                                                                    onChange={(
                                                                                        event
                                                                                    ) =>
                                                                                        updatePlayerScore(
                                                                                            player.player_id,
                                                                                            "assists",
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />

                                                                            </td>


                                                                            <td>

                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={
                                                                                        draft.deaths ??
                                                                                        0
                                                                                    }
                                                                                    disabled={
                                                                                        locked
                                                                                    }
                                                                                    onChange={(
                                                                                        event
                                                                                    ) =>
                                                                                        updatePlayerScore(
                                                                                            player.player_id,
                                                                                            "deaths",
                                                                                            event
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />

                                                                            </td>

                                                                        </tr>

                                                                    );
                                                                }
                                                            )

                                                        )}

                                                    </tbody>

                                                </table>

                                            </div>


                                            <div className="live-score-note">

                                                <Target
                                                    size={16}
                                                />

                                                <span>
                                                    Team points are
                                                    calculated
                                                    automatically from
                                                    the individual
                                                    player points.
                                                </span>

                                            </div>

                                        </>

                                    ) : (

                                        <div className="live-empty-state large">

                                            <Swords
                                                size={30}
                                            />

                                            <strong>
                                                Match unavailable
                                            </strong>

                                            <p>
                                                The selected match
                                                could not be loaded.
                                            </p>

                                        </div>

                                    )}

                                </div>

                            </div>

                        </section>
                    )}


                {/* =================================================
                    FINAL RESULTS
                ================================================= */}

                {activeSection ===
                    "results" && (

                        <section className="live-section">

                            <div className="live-section-heading">

                                <div>

                                    <span>
                                        TOURNAMENT OUTCOME
                                    </span>

                                    <h2>
                                        Final Results
                                    </h2>

                                    <p>
                                        Final standings based on
                                        verified match scores.
                                    </p>

                                </div>

                            </div>


                            <div className="live-results">

                                {leaderboard.length ===
                                    0 ? (

                                    <div className="live-empty-state large">

                                        <Medal
                                            size={30}
                                        />

                                        <strong>
                                            Results not available
                                        </strong>

                                        <p>
                                            Final standings will
                                            appear after matches
                                            are verified.
                                        </p>

                                    </div>

                                ) : (

                                    leaderboard.map(
                                        (
                                            team,
                                            index
                                        ) => {

                                            const members =
                                                team.members ||
                                                team.players ||
                                                [];


                                            const teamPoints =
                                                members.reduce(
                                                    (
                                                        total,
                                                        player
                                                    ) =>
                                                        total +
                                                        numericValue(
                                                            player.points
                                                        ),
                                                    0
                                                );


                                            return (

                                                <div
                                                    className={`live-result-row ${index ===
                                                        0
                                                        ? "result-first"
                                                        : ""
                                                        }`}
                                                    key={
                                                        team.team_id ||
                                                        team.club_id ||
                                                        team.id ||
                                                        index
                                                    }
                                                >

                                                    <div className="live-result-rank">

                                                        <span>
                                                            {team.rank ||
                                                                index +
                                                                1}
                                                        </span>

                                                    </div>


                                                    <div className="live-result-team">

                                                        <div className="live-team-avatar">

                                                            {getInitials(
                                                                team.team_name ||
                                                                team.name ||
                                                                "Team"
                                                            )}

                                                        </div>


                                                        <div>

                                                            <strong>
                                                                {team.team_name ||
                                                                    team.name ||
                                                                    "Unnamed Team"}
                                                            </strong>

                                                            <span>
                                                                {
                                                                    members.length
                                                                }{" "}
                                                                player
                                                                {members.length !==
                                                                    1
                                                                    ? "s"
                                                                    : ""}
                                                            </span>

                                                        </div>

                                                    </div>


                                                    <div className="live-result-members">

                                                        {members.map(
                                                            (
                                                                player,
                                                                playerIndex
                                                            ) => (

                                                                <div
                                                                    className="live-result-member"
                                                                    key={
                                                                        player.player_id ||
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
                                                                        {
                                                                            numericValue(
                                                                                player.points
                                                                            )
                                                                        }
                                                                    </strong>

                                                                </div>

                                                            )
                                                        )}

                                                    </div>


                                                    <div className="live-result-points">

                                                        <span>
                                                            FINAL POINTS
                                                        </span>

                                                        <strong>
                                                            {
                                                                teamPoints
                                                            }
                                                        </strong>

                                                    </div>

                                                </div>

                                            );
                                        }
                                    )

                                )}

                            </div>

                        </section>
                    )}

            </main>

        </div>
    );
}
