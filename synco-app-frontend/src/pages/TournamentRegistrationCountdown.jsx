import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, Gamepad2, Loader2, RefreshCw } from "lucide-react";
import "../styles/pages/TournamentRegistrationCountdown.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok || data?.success === false) {
        throw new Error(
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

function parseApiDate(value) {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasTimezone ? raw : `${raw}Z`);

    return Number.isNaN(date.getTime()) ? null : date;
}

function getGameName(competition) {
    if (!competition) return "Tournament";

    if (competition.game && typeof competition.game === "object") {
        return competition.game.name || competition.game.shortName || competition.game.id || "Game";
    }

    return competition.game || competition.gameId || "Game";
}

function formatDate(value) {
    const date = parseApiDate(value);
    if (!date) return "Schedule unavailable";

    return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
    });
}

function buildCountdown(targetMs, nowMs) {
    if (!Number.isFinite(targetMs)) return null;

    const remainingMs = Math.max(0, targetMs - nowMs);
    const totalSeconds = Math.floor(remainingMs / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
        days,
        hours,
        minutes,
        seconds,
        totalSeconds,
    };
}

function countdownText(countdown) {
    if (!countdown) return "—";

    const parts = [];

    if (countdown.days > 0) {
        parts.push(`${String(countdown.days).padStart(2, "0")}d`);
    }

    parts.push(`${String(countdown.hours).padStart(2, "0")}h`);
    parts.push(`${String(countdown.minutes).padStart(2, "0")}m`);
    parts.push(`${String(countdown.seconds).padStart(2, "0")}s`);

    return parts.join(" ");
}

function isLiveStatus(status) {
    return ["LIVE", "IN_PROGRESS", "ONGOING"].includes(
        String(status || "").toUpperCase()
    );
}

export default function TournamentRegistrationCountdown() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [competition, setCompetition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [nowMs, setNowMs] = useState(() => Date.now());

    const loadCompetition = useCallback(async (showLoader = false) => {
        if (!competitionId) {
            setError("Competition ID is missing.");
            setLoading(false);
            return;
        }

        try {
            if (showLoader) setLoading(true);
            setError("");

            const response = await apiRequest(
                `/api/competitions/${competitionId}`
            );

            setCompetition(response?.competition || null);
        } catch (err) {
            console.error("Failed to load competition phase:", err);
            setError(err.message || "Unable to load tournament.");
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [competitionId]);

    useEffect(() => {
        loadCompetition(true);
    }, [loadCompetition]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, []);

    const registrationStart = useMemo(
        () => parseApiDate(competition?.registrationStart),
        [competition?.registrationStart]
    );

    const competitionStart = useMemo(
        () => parseApiDate(competition?.competitionStart),
        [competition?.competitionStart]
    );

    const registrationStartMs = registrationStart?.getTime() ?? null;
    const competitionStartMs = competitionStart?.getTime() ?? null;

    const registrationCountdown = useMemo(
        () => buildCountdown(registrationStartMs, nowMs),
        [registrationStartMs, nowMs]
    );

    useEffect(() => {
        if (!competition) return;

        // IMPORTANT: registrationStart is the first and highest-priority
        // phase boundary. Even if the backend competition status was already
        // marked LIVE, do NOT send the user to the live dashboard while the
        // scheduled registration window has not started yet.
        if (
            Number.isFinite(registrationStartMs) &&
            nowMs < registrationStartMs
        ) {
            return;
        }

        // Registration has opened. Keep the user on the normal registration
        // page until the tournament/match start time is actually reached.
        if (
            Number.isFinite(competitionStartMs) &&
            nowMs >= competitionStartMs
        ) {
            navigate(`/live-tournament/${competitionId}`, { replace: true });
            return;
        }

        if (
            Number.isFinite(registrationStartMs) &&
            nowMs >= registrationStartMs
        ) {
            navigate(`/competitions/${competitionId}/register`, { replace: true });
        }
    }, [
        competition,
        competitionId,
        competitionStartMs,
        navigate,
        nowMs,
        registrationStartMs,
    ]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadCompetition(false);
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div className="registration-countdown-page">
                <div className="registration-countdown-state">
                    <Loader2 size={22} className="registration-countdown-spin" />
                    <span>Loading tournament schedule...</span>
                </div>
            </div>
        );
    }

    if (error || !competition) {
        return (
            <div className="registration-countdown-page">
                <header className="registration-countdown-header">
                    <button
                        type="button"
                        className="registration-countdown-back"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <span>TOURNAMENT</span>
                        <h1>{competition?.title || "Unavailable"}</h1>
                    </div>
                    <button
                        type="button"
                        className="registration-countdown-refresh"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw size={15} className={refreshing ? "registration-countdown-spin" : ""} />
                        Refresh
                    </button>
                </header>

                <main className="registration-countdown-shell">
                    <section className="registration-countdown-card registration-countdown-error">
                        <Clock3 size={24} />
                        <span>TOURNAMENT SCHEDULE</span>
                        <h2>Unable to load tournament</h2>
                        <p>{error || "Tournament not found."}</p>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="registration-countdown-page">
            <header className="registration-countdown-header">
                <div className="registration-countdown-header-left">
                    <button
                        type="button"
                        className="registration-countdown-back"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div>
                        <span>TOURNAMENT</span>
                        <h1>{competition.title || "Tournament"}</h1>
                    </div>
                </div>

                <button
                    type="button"
                    className="registration-countdown-refresh"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw size={15} className={refreshing ? "registration-countdown-spin" : ""} />
                    Refresh
                </button>
            </header>

            <main className="registration-countdown-shell">
                <section className="registration-countdown-card">
                    <div className="registration-countdown-icon">
                        <Clock3 size={24} />
                    </div>

                    <span className="registration-countdown-eyebrow">
                        REGISTRATION NOT OPEN
                    </span>

                    <h2>Registration opens soon</h2>

                    <p className="registration-countdown-copy">
                        The tournament registration screen will open automatically at the scheduled time.
                    </p>

                    <div className="registration-countdown-value">
                        <span>REGISTRATION STARTS IN</span>
                        <strong>{countdownText(registrationCountdown)}</strong>
                    </div>

                    <div className="registration-countdown-meta">
                        <div>
                            <span>GAME</span>
                            <strong>{getGameName(competition)}</strong>
                        </div>
                        <div>
                            <span>START TIME</span>
                            <strong>{formatDate(competition.registrationStart)}</strong>
                        </div>
                    </div>

                    <div className="registration-countdown-note">
                        <Gamepad2 size={15} />
                        <span>
                            When the countdown reaches zero, you will be moved to the existing tournament registration page automatically.
                        </span>
                    </div>
                </section>
            </main>
        </div>
    );
}
