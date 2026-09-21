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
    ChevronRight,
    Clock3,
    Medal,
    Play,
    RefreshCw,
    Save,
    Swords,
    Trophy,
    Users,
} from "lucide-react";

import "../styles/pages/LiveTournamentDashboard.css";


const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";

const LIVE_POLL_INTERVAL = 5000;
const UPCOMING_POLL_INTERVAL = 1000;


function apiUrl(path) {
    return `${API_URL}${path}`;
}


async function apiRequest(path, options = {}) {
    const response = await fetch(
        apiUrl(path),
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
            `Request failed with status ${response.status}.`
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


function numberValue(value) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
}


function formatStatus(value) {
    if (!value) {
        return "UNKNOWN";
    }

    return String(value)
        .replaceAll("_", " ")
        .toUpperCase();
}


function formatDate(value) {
    if (!value) {
        return "Not scheduled";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZoneName: "short",
        }
    );
}


function formatCountdown(totalSeconds) {
    if (
        totalSeconds === null ||
        totalSeconds === undefined
    ) {
        return "Awaiting schedule";
    }

    const seconds = Math.max(
        0,
        Math.floor(numberValue(totalSeconds))
    );

    const days = Math.floor(
        seconds / 86400
    );

    const hours = Math.floor(
        (seconds % 86400) / 3600
    );

    const minutes = Math.floor(
        (seconds % 3600) / 60
    );

    const remainingSeconds =
        seconds % 60;

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
}


function getGameName(competition) {
    if (!competition) {
        return "—";
    }

    if (
        typeof competition.game === "object" &&
        competition.game
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
}


function getInitials(value = "") {
    const parts = String(value)
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
        `${parts[0][0]}${parts[parts.length - 1][0]}`
    ).toUpperCase();
}


function getTeamPlayers(match) {
    if (!match?.players) {
        return [];
    }

    return match.players.map(
        (player) => ({
            ...player,
            userId:
                player.userId ??
                player.playerId ??
                player.player_id,
            teamId:
                player.teamId ??
                player.team_id,
            teamName:
                player.teamName ??
                player.team_name,
        })
    );
}


function statusClass(status) {
    const value = String(
        status || ""
    ).toUpperCase();

    return value
        .toLowerCase()
        .replaceAll("_", "-");
}


export default function LiveTournamentDashboard() {
    const { competitionId } =
        useParams();

    const navigate =
        useNavigate();

    const [dashboard, setDashboard] =
        useState(null);

    const [resultsData, setResultsData] =
        useState(null);

    const [activeSection, setActiveSection] =
        useState("overview");

    const [selectedMatchId, setSelectedMatchId] =
        useState(null);

    const [selectedMatch, setSelectedMatch] =
        useState(null);

    const [scoreDraft, setScoreDraft] =
        useState({});

    const [loading, setLoading] =
        useState(true);

    const [matchLoading, setMatchLoading] =
        useState(false);

    const [refreshing, setRefreshing] =
        useState(false);

    const [savingScores, setSavingScores] =
        useState(false);

    const [startingMatch, setStartingMatch] =
        useState(false);

    const [finalizingTournament, setFinalizingTournament] =
        useState(false);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");


    const competition =
        dashboard?.competition || {};

    const access =
        dashboard?.access || {};

    const overview =
        dashboard?.overview || {};

    const leaderboard =
        dashboard?.leaderboard || [];

    const matches =
        dashboard?.matches || [];

    const isOrganizer =
        Boolean(access.isOrganizer);


    const loadDashboard =
        useCallback(
            async (showLoader = false) => {
                if (!competitionId) {
                    setError(
                        "Competition ID is missing."
                    );
                    setLoading(false);
                    return null;
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

                    if (
                        !data?.success ||
                        !data?.dashboard
                    ) {
                        throw new Error(
                            data?.message ||
                            "Invalid tournament dashboard response."
                        );
                    }

                    const nextDashboard =
                        data.dashboard;

                    setDashboard(
                        nextDashboard
                    );

                    return nextDashboard;
                } catch (err) {
                    console.error(
                        "Failed to load tournament dashboard:",
                        err
                    );

                    setError(
                        err.message ||
                        "Unable to load tournament."
                    );

                    return null;
                } finally {
                    if (showLoader) {
                        setLoading(false);
                    }
                }
            },
            [competitionId]
        );


    const loadMatch =
        useCallback(
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

                    setSelectedMatch(
                        match
                    );

                    const nextDraft = {};

                    getTeamPlayers(match)
                        .forEach(
                            (player) => {
                                const playerId =
                                    player.userId;

                                nextDraft[playerId] = {
                                    kills:
                                        numberValue(
                                            player.kills
                                        ),
                                    placement:
                                        player.placement ??
                                        "",
                                    points:
                                        numberValue(
                                            player.points
                                        ),
                                    assists:
                                        numberValue(
                                            player.assists
                                        ),
                                    deaths:
                                        numberValue(
                                            player.deaths
                                        ),
                                };
                            }
                        );

                    setScoreDraft(
                        nextDraft
                    );
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


    const loadResults =
        useCallback(
            async () => {
                if (!competitionId) {
                    return;
                }

                try {
                    const data =
                        await apiRequest(
                            `/api/live-tournaments/${competitionId}/results`
                        );

                    setResultsData(
                        data
                    );
                } catch (err) {
                    console.error(
                        "Failed to load final results:",
                        err
                    );

                    setError(
                        err.message ||
                        "Unable to load final results."
                    );
                }
            },
            [competitionId]
        );


    useEffect(() => {
        loadDashboard(true);
    }, [loadDashboard]);


    useEffect(() => {
        if (!competitionId) {
            return undefined;
        }

        const intervalMs =
            access.phase === "UPCOMING"
                ? UPCOMING_POLL_INTERVAL
                : LIVE_POLL_INTERVAL;

        const intervalId =
            window.setInterval(
                async () => {
                    const previousPhase =
                        access.phase;

                    const nextDashboard =
                        await loadDashboard(
                            false
                        );

                    if (
                        previousPhase ===
                        "UPCOMING" &&
                        nextDashboard?.access?.phase ===
                        "LIVE"
                    ) {
                        setActiveSection(
                            "overview"
                        );
                    }
                },
                intervalMs
            );

        return () => {
            window.clearInterval(
                intervalId
            );
        };
    }, [
        access.phase,
        competitionId,
        loadDashboard,
    ]);


    useEffect(() => {
        if (
            activeSection !==
            "results"
        ) {
            return;
        }

        loadResults();
    }, [
        activeSection,
        loadResults,
    ]);


    useEffect(() => {
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
    }, [
        matches,
        selectedMatchId,
    ]);


    const handleRefresh =
        async () => {
            try {
                setRefreshing(true);
                setSuccessMessage("");

                await loadDashboard(
                    false
                );

                if (
                    selectedMatchId &&
                    access.phase ===
                    "LIVE"
                ) {
                    await loadMatch(
                        selectedMatchId,
                        false
                    );
                }

                if (
                    activeSection ===
                    "results"
                ) {
                    await loadResults();
                }
            } finally {
                setRefreshing(false);
            }
        };


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


    const handleStartMatch =
        async () => {
            if (
                !selectedMatchId
            ) {
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

                setSelectedMatch(
                    data.match
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


    const updatePlayerStat =
        (
            playerId,
            field,
            value
        ) => {
            setScoreDraft(
                (previous) => ({
                    ...previous,
                    [playerId]: {
                        ...(
                            previous[playerId] ||
                            {}
                        ),
                        [field]: value,
                    },
                })
            );
        };


    const handleSaveScores =
        async (
            finalize = false
        ) => {
            if (!selectedMatchId) {
                return;
            }

            const players =
                Object.entries(
                    scoreDraft
                ).map(
                    ([
                        userId,
                        stats,
                    ]) => ({
                        userId:
                            Number(userId),
                        kills:
                            numberValue(
                                stats.kills
                            ),
                        placement:
                            stats.placement ===
                            ""
                                ? null
                                : numberValue(
                                    stats.placement
                                ),
                        points:
                            numberValue(
                                stats.points
                            ),
                        assists:
                            numberValue(
                                stats.assists
                            ),
                        deaths:
                            numberValue(
                                stats.deaths
                            ),
                    })
                );

            try {
                setSavingScores(true);
                setError("");
                setSuccessMessage("");

                const data =
                    await apiRequest(
                        `/api/live-tournaments/${competitionId}/matches/${selectedMatchId}/scores`,
                        {
                            method: "POST",
                            body: JSON.stringify({
                                players,
                                finalize,
                            }),
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

                if (activeSection === "results") {
                    await loadResults();
                }

                setSuccessMessage(
                    finalize
                        ? "Match finalized successfully."
                        : "Match scores saved successfully."
                );

                if (finalize) {
                    setSelectedMatchId(
                        selectedMatchId
                    );
                }
            } catch (err) {
                console.error(
                    "Failed to save scores:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to save match scores."
                );
            } finally {
                setSavingScores(false);
            }
        };


    const handleFinalizeTournament =
        async () => {
            try {
                setFinalizingTournament(
                    true
                );
                setError("");
                setSuccessMessage("");

                await apiRequest(
                    `/api/live-tournaments/${competitionId}/finalize`,
                    {
                        method: "POST",
                    }
                );

                await loadDashboard(
                    false
                );

                await loadResults();

                setSuccessMessage(
                    "Tournament finalized successfully."
                );
            } catch (err) {
                console.error(
                    "Failed to finalize tournament:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to finalize tournament."
                );
            } finally {
                setFinalizingTournament(
                    false
                );
            }
        };


    const teamCount =
        numberValue(
            overview.teams
        );

    const playerCount =
        numberValue(
            overview.players
        );

    const matchCount =
        numberValue(
            overview.matches
        );

    const completedMatchCount =
        numberValue(
            overview.completedMatches
        );

    const liveMatchCount =
        numberValue(
            overview.liveMatches
        );

    const selectedPlayers =
        useMemo(
            () =>
                getTeamPlayers(
                    selectedMatch
                ),
            [selectedMatch]
        );


    const selectedTeamSummary =
        useMemo(() => {
            const groups = {};

            selectedPlayers.forEach(
                (player) => {
                    const key =
                        player.teamId ??
                        "unknown";

                    if (!groups[key]) {
                        groups[key] = {
                            id: key,
                            name:
                                player.teamName ||
                                "Team",
                            kills: 0,
                            points: 0,
                            placement:
                                null,
                        };
                    }

                    const draft =
                        scoreDraft[
                            player.userId
                        ] || {};

                    groups[key].kills +=
                        numberValue(
                            draft.kills
                        );

                    groups[key].points +=
                        numberValue(
                            draft.points
                        );

                    if (
                        groups[key].placement ===
                        null &&
                        draft.placement !==
                        ""
                    ) {
                        groups[key].placement =
                            numberValue(
                                draft.placement
                            );
                    }
                }
            );

            return Object.values(
                groups
            );
        }, [
            scoreDraft,
            selectedPlayers,
        ]);


    const tournamentCanBeFinalized =
        isOrganizer &&
        matchCount > 0 &&
        matches.every(
            (match) =>
                [
                    "VERIFIED",
                    "CANCELLED",
                ].includes(
                    String(
                        match.status ||
                        ""
                    ).toUpperCase()
                )
        ) &&
        String(
            competition.status ||
            ""
        ).toUpperCase() !==
        "COMPLETED";


    if (loading) {
        return (
            <div className="live-page">
                <div className="live-loading-screen">
                    <div className="live-spinner" />
                    <strong>
                        Loading tournament...
                    </strong>
                    <span>
                        Connecting to the SYNCO tournament system
                    </span>
                </div>
            </div>
        );
    }


    if (
        error &&
        !dashboard
    ) {
        return (
            <div className="live-page">
                <div className="live-error-screen">
                    <div className="live-panel live-error-panel">
                        <span className="live-eyebrow">
                            TOURNAMENT
                        </span>
                        <h2>
                            Unable to load tournament
                        </h2>
                        <p>
                            {error}
                        </p>

                        <div className="live-actions">
                            <button
                                type="button"
                                className="live-button primary"
                                onClick={() =>
                                    loadDashboard(
                                        true
                                    )
                                }
                            >
                                <RefreshCw
                                    size={15}
                                />
                                Retry
                            </button>

                            <button
                                type="button"
                                className="live-button secondary"
                                onClick={() =>
                                    navigate(-1)
                                }
                            >
                                <ArrowLeft
                                    size={15}
                                />
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    const phase =
        access.phase || "UPCOMING";


    if (
        phase ===
        "UPCOMING"
    ) {
        return (
            <div className="live-page">
                <header className="live-header">
                    <div className="live-header-left">
                        <button
                            type="button"
                            className="live-icon-button"
                            onClick={() =>
                                navigate(-1)
                            }
                        >
                            <ArrowLeft
                                size={18}
                            />
                        </button>

                        <div>
                            <span className="live-eyebrow">
                                TOURNAMENT
                            </span>
                            <h1>
                                {competition.title ||
                                    "Tournament"}
                            </h1>
                        </div>
                    </div>

                    <div className="live-header-status upcoming">
                        <Clock3
                            size={14}
                        />
                        STARTS SOON
                    </div>
                </header>

                <main className="live-locked-content">
                    <section className="live-lock-card">
                        <div className="live-lock-icon">
                            <Clock3
                                size={30}
                            />
                        </div>

                        <span className="live-eyebrow">
                            TOURNAMENT NOT STARTED
                        </span>

                        <h2>
                            The tournament will open automatically
                        </h2>

                        <p>
                            The live dashboard is locked until the
                            scheduled start time. This page will
                            unlock automatically when the server
                            reaches that time.
                        </p>

                        <div className="live-countdown">
                            <span>
                                STARTS IN
                            </span>
                            <strong>
                                {formatCountdown(
                                    access.secondsUntilStart
                                )}
                            </strong>
                            {access.startAt && (
                                <small>
                                    {formatDate(
                                        access.startAt
                                    )}
                                </small>
                            )}
                        </div>

                        <div className="live-lock-meta">
                            <div>
                                <span>GAME</span>
                                <strong>
                                    {getGameName(
                                        competition
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>FORMAT</span>
                                <strong>
                                    {competition.gameMode ||
                                        competition.competitionType ||
                                        "—"}
                                </strong>
                            </div>

                            <div>
                                <span>TEAMS</span>
                                <strong>
                                    {teamCount}
                                </strong>
                            </div>

                            <div>
                                <span>MATCHES</span>
                                <strong>
                                    {matchCount}
                                </strong>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        );
    }


    if (
        phase ===
        "CANCELLED"
    ) {
        return (
            <div className="live-page">
                <div className="live-error-screen">
                    <div className="live-panel live-error-panel">
                        <span className="live-eyebrow">
                            TOURNAMENT
                        </span>
                        <h2>
                            Tournament unavailable
                        </h2>
                        <p>
                            This tournament has been cancelled.
                        </p>
                        <button
                            type="button"
                            className="live-button secondary"
                            onClick={() =>
                                navigate(-1)
                            }
                        >
                            <ArrowLeft
                                size={15}
                            />
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="live-page">
            <header className="live-header">
                <div className="live-header-left">
                    <button
                        type="button"
                        className="live-icon-button"
                        onClick={() =>
                            navigate(-1)
                        }
                        aria-label="Go back"
                    >
                        <ArrowLeft
                            size={18}
                        />
                    </button>

                    <div>
                        <span className="live-eyebrow">
                            {phase === "COMPLETED"
                                ? "COMPLETED TOURNAMENT"
                                : "LIVE TOURNAMENT"}
                        </span>

                        <h1>
                            {competition.title ||
                                "Tournament"}
                        </h1>
                    </div>
                </div>

                <div className="live-header-right">
                    <div
                        className={`live-header-status ${phase === "COMPLETED"
                            ? "completed"
                            : "live"
                            }`}
                    >
                        <span className="live-status-dot" />
                        {phase ===
                            "COMPLETED"
                            ? "COMPLETED"
                            : "LIVE"}
                    </div>

                    <button
                        type="button"
                        className="live-button secondary"
                        onClick={
                            handleRefresh
                        }
                        disabled={
                            refreshing
                        }
                    >
                        <RefreshCw
                            size={15}
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


            {(error ||
                successMessage) && (
                <div className="live-alert-wrap">
                    {error && (
                        <div className="live-alert error">
                            <span>
                                {error}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setError("")
                                }
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {successMessage && (
                        <div className="live-alert success">
                            <Check
                                size={15}
                            />
                            <span>
                                {successMessage}
                            </span>
                        </div>
                    )}
                </div>
            )}


            <section className="live-info-grid">
                <div>
                    <span>GAME</span>
                    <strong>
                        {getGameName(
                            competition
                        )}
                    </strong>
                </div>

                <div>
                    <span>FORMAT</span>
                    <strong>
                        {competition.gameMode ||
                            competition.competitionType ||
                            "—"}
                    </strong>
                </div>

                <div>
                    <span>STARTED</span>
                    <strong>
                        {formatDate(
                            competition.start
                        )}
                    </strong>
                </div>

                <div>
                    <span>TEAMS</span>
                    <strong>
                        {teamCount}
                    </strong>
                </div>

                <div>
                    <span>PLAYERS</span>
                    <strong>
                        {playerCount}
                    </strong>
                </div>

                <div>
                    <span>MATCHES</span>
                    <strong>
                        {completedMatchCount}/
                        {matchCount}
                    </strong>
                </div>
            </section>


            <nav className="live-tabs">
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
                        size={15}
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
                        size={15}
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
                        size={15}
                    />
                    {isOrganizer
                        ? "Match Control"
                        : "Matches"}
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
                        size={15}
                    />
                    Final Results
                </button>
            </nav>


            <main className="live-content">
                {activeSection ===
                    "overview" && (
                    <section className="live-section">
                        <div className="live-section-heading">
                            <div>
                                <span>
                                    TOURNAMENT OVERVIEW
                                </span>
                                <h2>
                                    Control Center
                                </h2>
                                <p>
                                    All tournament information comes
                                    directly from the SYNCO competition
                                    and match records.
                                </p>
                            </div>
                        </div>

                        <div className="live-stat-grid">
                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Users
                                        size={18}
                                    />
                                </div>
                                <div>
                                    <span>TEAMS</span>
                                    <strong>
                                        {teamCount}
                                    </strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Users
                                        size={18}
                                    />
                                </div>
                                <div>
                                    <span>PLAYERS</span>
                                    <strong>
                                        {playerCount}
                                    </strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Swords
                                        size={18}
                                    />
                                </div>
                                <div>
                                    <span>MATCHES</span>
                                    <strong>
                                        {matchCount}
                                    </strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Check
                                        size={18}
                                    />
                                </div>
                                <div>
                                    <span>VERIFIED</span>
                                    <strong>
                                        {completedMatchCount}
                                    </strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Play
                                        size={18}
                                    />
                                </div>
                                <div>
                                    <span>LIVE MATCHES</span>
                                    <strong>
                                        {liveMatchCount}
                                    </strong>
                                </div>
                            </div>

                            <div className="live-stat-card">
                                <div className="live-stat-icon">
                                    <Activity
                                        size={18}
                                    />
                                </div>
                                <div>
                                    <span>ROLE</span>
                                    <strong>
                                        {isOrganizer
                                            ? "ORGANIZER"
                                            : "VIEWER"}
                                    </strong>
                                </div>
                            </div>
                        </div>


                        <div className="live-two-column">
                            <div className="live-panel">
                                <div className="live-panel-header">
                                    <div>
                                        <span>
                                            CURRENT STATE
                                        </span>
                                        <h3>
                                            Tournament Status
                                        </h3>
                                    </div>

                                    <div
                                        className={`live-small-status ${statusClass(
                                            competition.status
                                        )}`}
                                    >
                                        {formatStatus(
                                            competition.status
                                        )}
                                    </div>
                                </div>

                                <div className="live-detail-list">
                                    <div>
                                        <span>Start time</span>
                                        <strong>
                                            {formatDate(
                                                competition.start
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Game mode</span>
                                        <strong>
                                            {competition.gameMode ||
                                                "—"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Team size</span>
                                        <strong>
                                            {competition.teamSize ||
                                                "—"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Competition format</span>
                                        <strong>
                                            {competition.competitionType ||
                                                "—"}
                                        </strong>
                                    </div>
                                </div>
                            </div>


                            <div className="live-panel">
                                <div className="live-panel-header">
                                    <div>
                                        <span>
                                            MATCH PROGRESS
                                        </span>
                                        <h3>
                                            Active Matches
                                        </h3>
                                    </div>

                                    <button
                                        type="button"
                                        className="live-text-button"
                                        onClick={() =>
                                            setActiveSection(
                                                "matches"
                                            )
                                        }
                                    >
                                        Open Matches
                                        <ChevronRight
                                            size={14}
                                        />
                                    </button>
                                </div>

                                <div className="live-match-overview-list">
                                    {matches
                                        .filter(
                                            (match) =>
                                                [
                                                    "LIVE",
                                                    "SCHEDULED",
                                                    "READY",
                                                    "VERIFIED",
                                                ].includes(
                                                    String(
                                                        match.status ||
                                                        ""
                                                    ).toUpperCase()
                                                )
                                        )
                                        .slice(0, 6)
                                        .map(
                                            (match) => (
                                                <button
                                                    type="button"
                                                    key={match.id}
                                                    className="live-match-overview-item"
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
                                                        <strong>
                                                            Match{" "}
                                                            {match.matchNumber ??
                                                                match.id}
                                                        </strong>
                                                        <span>
                                                            {formatStatus(
                                                                match.status
                                                            )}
                                                        </span>
                                                    </div>
                                                    <ChevronRight
                                                        size={15}
                                                    />
                                                </button>
                                            )
                                        )}

                                    {!matches.length && (
                                        <div className="live-empty">
                                            No matches have been created
                                            for this tournament yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}


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
                                    Rankings use the existing SYNCO
                                    tournament score. Kills and
                                    placement are shown as additional
                                    match information.
                                </p>
                            </div>
                        </div>

                        <div className="live-leaderboard">
                            {!leaderboard.length ? (
                                <div className="live-empty large">
                                    <Trophy
                                        size={28}
                                    />
                                    <strong>
                                        No leaderboard data yet
                                    </strong>
                                    <span>
                                        Enter and save a match result
                                        to update the standings.
                                    </span>
                                </div>
                            ) : (
                                leaderboard.map(
                                    (team) => (
                                        <article
                                            className="live-team-row"
                                            key={
                                                team.participantId
                                            }
                                        >
                                            <div className="live-rank">
                                                {team.rank}
                                            </div>

                                            <div className="live-team-main">
                                                <div className="live-team-heading">
                                                    <div className="live-team-avatar">
                                                        {getInitials(
                                                            team.teamName
                                                        )}
                                                    </div>

                                                    <div>
                                                        <h3>
                                                            {team.teamName ||
                                                                "Unnamed Team"}
                                                        </h3>
                                                        <span>
                                                            {team.members?.length ||
                                                                0}{" "}
                                                            players
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="live-player-list">
                                                    {(
                                                        team.members ||
                                                        []
                                                    ).map(
                                                        (
                                                            player
                                                        ) => (
                                                            <div
                                                                className="live-player-row"
                                                                key={
                                                                    player.userId
                                                                }
                                                            >
                                                                <div className="live-player-info">
                                                                    <div className="live-player-avatar">
                                                                        {getInitials(
                                                                            player.name
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

                                                                <div className="live-player-metrics">
                                                                    <div>
                                                                        <strong>
                                                                            {numberValue(
                                                                                player.totalKills
                                                                            )}
                                                                        </strong>
                                                                        <span>
                                                                            KILLS
                                                                        </span>
                                                                    </div>

                                                                    <div>
                                                                        <strong>
                                                                            {player.latestPlacement ??
                                                                                "—"}
                                                                        </strong>
                                                                        <span>
                                                                            LAST PLACE
                                                                        </span>
                                                                    </div>

                                                                    <div>
                                                                        <strong>
                                                                            {numberValue(
                                                                                player.points
                                                                            )}
                                                                        </strong>
                                                                        <span>
                                                                            POINTS
                                                                        </span>
                                                                    </div>
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
                                                    {numberValue(
                                                        team.totalPoints
                                                    )}
                                                </strong>
                                                <small>
                                                    {numberValue(
                                                        team.totalKills
                                                    )}{" "}
                                                    total kills
                                                </small>
                                            </div>
                                        </article>
                                    )
                                )
                            )}
                        </div>
                    </section>
                )}


                {activeSection ===
                    "matches" && (
                    <section className="live-section">
                        <div className="live-section-heading">
                            <div>
                                <span>
                                    {isOrganizer
                                        ? "ORGANIZER CONTROL"
                                        : "MATCH RESULTS"}
                                </span>
                                <h2>
                                    {isOrganizer
                                        ? "Match Control"
                                        : "Matches"}
                                </h2>
                                <p>
                                    {isOrganizer
                                        ? "Start a match, enter each player's kills and placement, and save or finalize the result."
                                        : "Review match status, player performance, kills, placement and points."}
                                </p>
                            </div>
                        </div>

                        <div className="live-match-layout">
                            <aside className="live-panel live-match-list">
                                <div className="live-panel-header">
                                    <div>
                                        <span>
                                            TOURNAMENT MATCHES
                                        </span>
                                        <h3>
                                            {matches.length} matches
                                        </h3>
                                    </div>
                                </div>

                                <div className="live-match-list-items">
                                    {matches.map(
                                        (match) => (
                                            <button
                                                type="button"
                                                key={match.id}
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
                                                <span className="live-match-number">
                                                    {match.matchNumber ??
                                                        match.id}
                                                </span>

                                                <span className="live-match-list-copy">
                                                    <strong>
                                                        Match{" "}
                                                        {match.matchNumber ??
                                                            match.id}
                                                    </strong>
                                                    <small>
                                                        {formatStatus(
                                                            match.status
                                                        )}
                                                    </small>
                                                </span>

                                                <ChevronRight
                                                    size={15}
                                                />
                                            </button>
                                        )
                                    )}

                                    {!matches.length && (
                                        <div className="live-empty">
                                            No matches available.
                                        </div>
                                    )}
                                </div>
                            </aside>


                            <section className="live-panel live-match-editor">
                                {!selectedMatchId ? (
                                    <div className="live-empty large">
                                        <Swords
                                            size={28}
                                        />
                                        <strong>
                                            Select a match
                                        </strong>
                                        <span>
                                            Choose a match from the list
                                            to manage or review its data.
                                        </span>
                                    </div>
                                ) : matchLoading ? (
                                    <div className="live-empty large">
                                        <div className="live-spinner" />
                                        <strong>
                                            Loading match...
                                        </strong>
                                    </div>
                                ) : !selectedMatch ? (
                                    <div className="live-empty large">
                                        <strong>
                                            Match unavailable
                                        </strong>
                                        <span>
                                            The selected match could not
                                            be loaded.
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="live-editor-header">
                                            <div>
                                                <span>
                                                    MATCH{" "}
                                                    {selectedMatch.matchNumber ??
                                                        selectedMatch.id}
                                                </span>

                                                <h3>
                                                    Match{" "}
                                                    {selectedMatch.matchNumber ??
                                                        selectedMatch.id}
                                                </h3>

                                                <p>
                                                    {formatStatus(
                                                        selectedMatch.status
                                                    )}
                                                </p>
                                            </div>

                                            {isOrganizer && (
                                                <div className="live-editor-actions">
                                                    {![
                                                        "LIVE",
                                                        "VERIFIED",
                                                    ].includes(
                                                        String(
                                                            selectedMatch.status ||
                                                            ""
                                                        ).toUpperCase()
                                                    ) && (
                                                        <button
                                                            type="button"
                                                            className="live-button primary"
                                                            onClick={
                                                                handleStartMatch
                                                            }
                                                            disabled={
                                                                startingMatch
                                                            }
                                                        >
                                                            <Play
                                                                size={15}
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
                                                                className="live-button secondary"
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
                                                                    size={15}
                                                                />
                                                                Save Scores
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="live-button primary"
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
                                                                    size={15}
                                                                />
                                                                Finalize Match
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>


                                        {isOrganizer &&
                                            String(
                                                selectedMatch.status ||
                                                ""
                                            ).toUpperCase() ===
                                            "LIVE" && (
                                                <div className="live-editor-note">
                                                    <strong>
                                                        Enter match data
                                                    </strong>
                                                    <span>
                                                        Kills and placement are
                                                        stored per player.
                                                        Points remain compatible
                                                        with your existing SYNCO
                                                        scoring field.
                                                    </span>
                                                </div>
                                            )}


                                        <div className="live-team-summary">
                                            {selectedTeamSummary.map(
                                                (team) => (
                                                    <div
                                                        className="live-team-summary-card"
                                                        key={team.id}
                                                    >
                                                        <span>
                                                            {team.name}
                                                        </span>
                                                        <strong>
                                                            {team.placement ??
                                                                "—"}
                                                        </strong>
                                                        <small>
                                                            PLACE
                                                        </small>
                                                        <div>
                                                            {team.kills} kills
                                                            <span />
                                                            {team.points} points
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>


                                        <div className="live-table-wrap">
                                            <table className="live-data-table">
                                                <thead>
                                                    <tr>
                                                        <th>
                                                            PLAYER
                                                        </th>
                                                        <th>
                                                            TEAM
                                                        </th>
                                                        <th>
                                                            KILLS
                                                        </th>
                                                        <th>
                                                            PLACEMENT
                                                        </th>
                                                        <th>
                                                            POINTS
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
                                                    {selectedPlayers.length ===
                                                        0 ? (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="table-empty"
                                                            >
                                                                No players are
                                                                attached to this
                                                                match.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        selectedPlayers.map(
                                                            (
                                                                player
                                                            ) => {
                                                                const playerId =
                                                                    player.userId;

                                                                const draft =
                                                                    scoreDraft[
                                                                        playerId
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
                                                                            playerId
                                                                        }
                                                                    >
                                                                        <td>
                                                                            <div className="table-player">
                                                                                <div className="live-player-avatar">
                                                                                    {getInitials(
                                                                                        player.name
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
                                                                            {player.teamName ||
                                                                                "—"}
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
                                                                                    locked ||
                                                                                    !isOrganizer
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updatePlayerStat(
                                                                                        playerId,
                                                                                        "kills",
                                                                                        event.target.value
                                                                                    )
                                                                                }
                                                                            />
                                                                        </td>

                                                                        <td>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                value={
                                                                                    draft.placement ??
                                                                                    ""
                                                                                }
                                                                                placeholder="—"
                                                                                disabled={
                                                                                    locked ||
                                                                                    !isOrganizer
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updatePlayerStat(
                                                                                        playerId,
                                                                                        "placement",
                                                                                        event.target.value
                                                                                    )
                                                                                }
                                                                            />
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
                                                                                    locked ||
                                                                                    !isOrganizer
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updatePlayerStat(
                                                                                        playerId,
                                                                                        "points",
                                                                                        event.target.value
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
                                                                                    locked ||
                                                                                    !isOrganizer
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updatePlayerStat(
                                                                                        playerId,
                                                                                        "assists",
                                                                                        event.target.value
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
                                                                                    locked ||
                                                                                    !isOrganizer
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updatePlayerStat(
                                                                                        playerId,
                                                                                        "deaths",
                                                                                        event.target.value
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

                                        <div className="live-table-footer">
                                            <span>
                                                {selectedPlayers.length} players
                                                attached to this match
                                            </span>
                                            <span>
                                                {String(
                                                    selectedMatch.status ||
                                                    ""
                                                ).toUpperCase() ===
                                                    "VERIFIED"
                                                    ? "Locked after verification"
                                                    : isOrganizer
                                                        ? "Organizer can edit scores"
                                                        : "Read-only result view"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </section>
                        </div>
                    </section>
                )}


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
                                    Verified match results and final
                                    tournament standings.
                                </p>
                            </div>

                            {tournamentCanBeFinalized && (
                                <button
                                    type="button"
                                    className="live-button primary"
                                    onClick={
                                        handleFinalizeTournament
                                    }
                                    disabled={
                                        finalizingTournament
                                    }
                                >
                                    <Check
                                        size={15}
                                    />
                                    {finalizingTournament
                                        ? "Finalizing..."
                                        : "Finalize Tournament"}
                                </button>
                            )}
                        </div>

                        <div className="live-results">
                            {(resultsData?.results ||
                                leaderboard).length ===
                                0 ? (
                                <div className="live-empty large">
                                    <Medal
                                        size={28}
                                    />
                                    <strong>
                                        Final results not available
                                    </strong>
                                    <span>
                                        Verify the match results first.
                                    </span>
                                </div>
                            ) : (
                                (
                                    resultsData?.results ||
                                    leaderboard
                                ).map(
                                    (
                                        team,
                                        index
                                    ) => (
                                        <article
                                            className="live-result-row"
                                            key={
                                                team.participantId ||
                                                index
                                            }
                                        >
                                            <div className="live-result-rank">
                                                {team.finalRank ||
                                                    team.rank ||
                                                    index +
                                                    1}
                                            </div>

                                            <div className="live-result-team">
                                                <div className="live-team-avatar">
                                                    {getInitials(
                                                        team.teamName
                                                    )}
                                                </div>

                                                <div>
                                                    <strong>
                                                        {team.teamName ||
                                                            "Unnamed Team"}
                                                    </strong>
                                                    <span>
                                                        {team.members?.length ||
                                                            0}{" "}
                                                        players
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="live-result-stats">
                                                <div>
                                                    <span>
                                                        KILLS
                                                    </span>
                                                    <strong>
                                                        {numberValue(
                                                            team.totalKills
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        BEST PLACE
                                                    </span>
                                                    <strong>
                                                        {team.bestPlacement ??
                                                            "—"}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="live-result-points">
                                                <span>
                                                    POINTS
                                                </span>
                                                <strong>
                                                    {numberValue(
                                                        team.totalPoints
                                                    )}
                                                </strong>
                                            </div>
                                        </article>
                                    )
                                )
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
