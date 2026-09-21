import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Check,
    ChevronRight,
    Clock3,
    Gamepad2,
    ShieldCheck,
    Users,
    Trophy,
    AlertCircle,
    Loader2,
    RefreshCw,
} from "lucide-react";
import "../styles/pages/TournamentRegistration.css";

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
            `Request failed with status ${response.status}`
        );
    }

    return data;
}

const valueOrDash = (value) => value ?? "—";

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function statusLabel(status) {
    return String(status || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function getGameName(competition) {
    if (!competition) return "Tournament";
    if (competition.game && typeof competition.game === "object") {
        return competition.game.name || competition.game.slug || "Game";
    }
    return competition.game || competition.gameId || "Game";
}

function getMemberCountLabel(count, teamSize) {
    if (!teamSize) return `${count} member${count === 1 ? "" : "s"}`;
    return `${count}/${teamSize} players`;
}

export default function TournamentRegistration() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [selectedClubId, setSelectedClubId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadRegistration = useCallback(async (showLoader = false) => {
        if (!competitionId) {
            setError("Competition ID is missing.");
            setLoading(false);
            return;
        }

        try {
            if (showLoader) setLoading(true);
            setError("");
            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration-info`
            );
            setData(response);

            const currentRegistration = response?.myRegistration;
            const currentClubId = currentRegistration?.clubId;
            if (currentClubId) {
                setSelectedClubId(currentClubId);
            }
        } catch (err) {
            console.error("Failed to load tournament registration:", err);
            setError(err.message || "Unable to load tournament registration.");
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [competitionId]);

    useEffect(() => {
        loadRegistration(true);
    }, [loadRegistration]);

    const handleRefresh = async () => {
        setRefreshing(true);
        setSuccess("");
        try {
            await loadRegistration(false);
        } finally {
            setRefreshing(false);
        }
    };

    const competition = data?.competition || {};
    const modeConfig = data?.modeConfig || {};
    const clubs = data?.myClubs || [];
    const teamSize = Number(competition.teamSize || 0);
    const isTeamCompetition =
        String(competition.participantType || "").toUpperCase() === "TEAM";

    const selectedClub = useMemo(
        () => clubs.find((club) => String(club.id) === String(selectedClubId)) || null,
        [clubs, selectedClubId]
    );

    const currentRegistration = data?.myRegistration || selectedClub?.registration || null;
    const currentStatus = String(currentRegistration?.registrationStatus || "").toUpperCase();

    const hasActiveRegistration = ["PENDING", "ACCEPTED", "LOCKED", "ELIMINATED"].includes(
        currentStatus
    );

    const selectedEligible =
        !!selectedClub &&
        (!teamSize || selectedClub.memberCount === teamSize) &&
        !selectedClub.registration;

    const handleRegister = async () => {
        setError("");
        setSuccess("");

        if (!data?.registrationOpen) {
            setError("Registration is not currently open.");
            return;
        }

        try {
            setSubmitting(true);

            const endpoint = isTeamCompetition
                ? `/api/competitions/${competitionId}/register/team`
                : `/api/competitions/${competitionId}/register/player`;

            const body = isTeamCompetition
                ? { clubId: selectedClubId }
                : {};

            const response = await apiRequest(endpoint, {
                method: "POST",
                body: JSON.stringify(body),
            });

            setSuccess(response.message || "Registration submitted successfully.");
            await loadRegistration(false);
        } catch (err) {
            console.error("Tournament registration failed:", err);
            setError(err.message || "Unable to register for this tournament.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="registration-page">
                <div className="registration-loading">
                    <Loader2 className="registration-loading-icon" size={22} />
                    <span>Loading tournament registration...</span>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="registration-page">
                <div className="registration-error-screen">
                    <div className="registration-error-card">
                        <AlertCircle size={24} />
                        <h2>Unable to load tournament</h2>
                        <p>{error}</p>
                        <div className="registration-action-row">
                            <button onClick={() => loadRegistration(true)} type="button">
                                <RefreshCw size={15} /> Retry
                            </button>
                            <button onClick={() => navigate(-1)} type="button" className="secondary">
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="registration-page">
            <header className="registration-header">
                <div className="registration-header-left">
                    <button
                        className="registration-back"
                        onClick={() => navigate(-1)}
                        type="button"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <span>TOURNAMENT REGISTRATION</span>
                        <h1>{competition.title || "Tournament"}</h1>
                    </div>
                </div>

                <button
                    type="button"
                    className="registration-refresh"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw size={15} className={refreshing ? "registration-spin" : ""} />
                    Refresh
                </button>
            </header>

            {(error || success) && (
                <div className={`registration-alert ${error ? "error" : "success"}`}>
                    {error ? <AlertCircle size={15} /> : <Check size={15} />}
                    <span>{error || success}</span>
                    <button type="button" onClick={() => { setError(""); setSuccess(""); }}>
                        Dismiss
                    </button>
                </div>
            )}

            <main className="registration-content">
                <section className="registration-summary">
                    <div className="registration-game-block">
                        <div className="registration-icon-box"><Gamepad2 size={20} /></div>
                        <div>
                            <span>GAME</span>
                            <strong>{getGameName(competition)}</strong>
                        </div>
                    </div>

                    <div className="registration-summary-item">
                        <span>FORMAT</span>
                        <strong>{valueOrDash(competition.gameMode || competition.competitionType)}</strong>
                    </div>
                    <div className="registration-summary-item">
                        <span>{isTeamCompetition ? "TEAM SIZE" : "PARTICIPANT TYPE"}</span>
                        <strong>{isTeamCompetition ? `${teamSize} PLAYER${teamSize === 1 ? "" : "S"}` : "PLAYER"}</strong>
                    </div>
                    <div className="registration-summary-item">
                        <span>AVAILABLE</span>
                        <strong>{Math.max(0, Number(data?.capacity || 0) - Number(data?.registeredCount || 0))}</strong>
                    </div>
                </section>

                <div className="registration-grid">
                    <section className="registration-main-card">
                        <div className="registration-card-heading">
                            <div>
                                <span>JOIN THIS TOURNAMENT</span>
                                <h2>{isTeamCompetition ? "Choose your team" : "Confirm your participation"}</h2>
                                <p>
                                    {isTeamCompetition
                                        ? "Select one of your eligible clubs. The registered club roster will be used for the tournament."
                                        : "Your authenticated SYNCO player account will be registered for this competition."}
                                </p>
                            </div>
                            <div className={`registration-open-pill ${data?.registrationOpen ? "open" : "closed"}`}>
                                {data?.registrationOpen ? "REGISTRATION OPEN" : "REGISTRATION CLOSED"}
                            </div>
                        </div>

                        {isTeamCompetition ? (
                            <div className="registration-club-list">
                                {!clubs.length ? (
                                    <div className="registration-empty">
                                        <Users size={22} />
                                        <strong>No eligible clubs found</strong>
                                        <p>Create a club for this game first, or make sure your existing club has exactly {teamSize} rostered player{teamSize === 1 ? "" : "s"}.</p>
                                    </div>
                                ) : (
                                    clubs.map((club) => {
                                        const isSelected = String(selectedClubId) === String(club.id);
                                        const memberOk = !teamSize || club.memberCount === teamSize;
                                        const registration = club.registration;
                                        const status = String(registration?.registrationStatus || "").toUpperCase();
                                        const unavailable = !!registration && !["REJECTED"].includes(status);

                                        return (
                                            <button
                                                type="button"
                                                key={club.id}
                                                className={`registration-club-card ${isSelected ? "selected" : ""} ${unavailable ? "registered" : ""}`}
                                                onClick={() => {
                                                    if (!unavailable) setSelectedClubId(club.id);
                                                }}
                                                disabled={unavailable}
                                            >
                                                <div className="registration-club-top">
                                                    <div className="registration-club-avatar">
                                                        {club.name?.slice(0, 2).toUpperCase() || "CL"}
                                                    </div>
                                                    <div className="registration-club-name">
                                                        <strong>{club.name}</strong>
                                                        <span>{club.tag ? `#${club.tag}` : "SYNCO CLUB"}</span>
                                                    </div>
                                                    <div className="registration-club-status">
                                                        {unavailable ? (
                                                            <span>{statusLabel(status)}</span>
                                                        ) : isSelected ? (
                                                            <Check size={16} />
                                                        ) : (
                                                            <ChevronRight size={16} />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="registration-roster">
                                                    <div className="registration-roster-heading">
                                                        <span>ROSTER</span>
                                                        <strong>{getMemberCountLabel(club.memberCount, teamSize)}</strong>
                                                    </div>
                                                    <div className="registration-roster-list">
                                                        {club.members?.map((member) => (
                                                            <div className="registration-roster-row" key={member.id}>
                                                                <div className="registration-mini-avatar">
                                                                    {(member.name || "P").slice(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <strong>{member.name}</strong>
                                                                    {member.uid && <span>{member.uid}</span>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {!memberOk && !unavailable && (
                                                    <div className="registration-card-warning">
                                                        <AlertCircle size={14} />
                                                        <span>Requires exactly {teamSize} rostered player{teamSize === 1 ? "" : "s"}.</span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="registration-player-confirm">
                                <div className="registration-confirm-icon"><ShieldCheck size={22} /></div>
                                <div>
                                    <span>PLAYER ACCOUNT</span>
                                    <strong>Register with your current SYNCO account</strong>
                                    <p>No extra player creation is required. The existing CompetitionParticipant record is used.</p>
                                </div>
                            </div>
                        )}

                        {hasActiveRegistration ? (
                            <div className="registration-current-state">
                                <div>
                                    <span>CURRENT REGISTRATION</span>
                                    <strong>{statusLabel(currentStatus)}</strong>
                                </div>
                                <button type="button" onClick={() => navigate(`/competitions/${competitionId}`)}>
                                    View Tournament
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="registration-submit"
                                onClick={handleRegister}
                                disabled={
                                    submitting ||
                                    !data?.registrationOpen ||
                                    !!data?.full ||
                                    (isTeamCompetition && !selectedEligible)
                                }
                            >
                                {submitting ? <Loader2 size={17} className="registration-spin" /> : <Trophy size={17} />}
                                {submitting ? "Submitting..." : "Register for Tournament"}
                            </button>
                        )}
                    </section>

                    <aside className="registration-side">
                        <section className="registration-side-card">
                            <div className="registration-side-heading">
                                <Clock3 size={17} />
                                <span>TOURNAMENT SCHEDULE</span>
                            </div>
                            <div className="registration-time-row">
                                <span>Registration</span>
                                <strong>{formatDate(competition.registrationStart)} — {formatDate(competition.registrationEnd)}</strong>
                            </div>
                            <div className="registration-time-row">
                                <span>Starts</span>
                                <strong>{formatDate(competition.competitionStart)}</strong>
                            </div>
                            <div className="registration-time-row">
                                <span>Ends</span>
                                <strong>{formatDate(competition.competitionEnd)}</strong>
                            </div>
                        </section>

                        <section className="registration-side-card">
                            <div className="registration-side-heading">
                                <ShieldCheck size={17} />
                                <span>TOURNAMENT RULES</span>
                            </div>
                            <div className="registration-rule-list">
                                <div><Check size={13} /> <span>Only registered SYNCO teams/players can participate.</span></div>
                                <div><Check size={13} /> <span>Team roster is taken from the existing club roster.</span></div>
                                <div><Check size={13} /> <span>Organizer approval and tournament locking happen in the Competition Engine.</span></div>
                                <div><Check size={13} /> <span>Matches are generated from the selected game format after registration closes.</span></div>
                            </div>
                        </section>

                        {modeConfig && Object.keys(modeConfig).length > 0 && (
                            <section className="registration-side-card">
                                <div className="registration-side-heading">
                                    <Gamepad2 size={17} />
                                    <span>FORMAT CONFIGURATION</span>
                                </div>
                                <div className="registration-format-grid">
                                    <div><span>TYPE</span><strong>{modeConfig.type || "—"}</strong></div>
                                    <div><span>STRUCTURE</span><strong>{modeConfig.structure || "—"}</strong></div>
                                    <div><span>MATCHES</span><strong>{competition.numberOfMatches || modeConfig.default_matches || 1}</strong></div>
                                    <div><span>PARTICIPANTS</span><strong>{modeConfig.participant_type || competition.participantType || "—"}</strong></div>
                                </div>
                            </section>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    );
}
