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
            data?.error ||
            data?.message ||
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
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
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
                setSelectedMemberIds(
                    (currentRegistration?.teamRoster || [])
                        .map((member) => Number(member.userId))
                        .filter((id) => Number.isFinite(id))
                );
            } else {
                setSelectedMemberIds([]);
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

    const activeRegistrationStatus = String(
        selectedClub?.registration?.registrationStatus ||
        currentRegistration?.registrationStatus ||
        ""
    ).toUpperCase();

    const hasSelectedClubRegistration = [
        "PENDING",
        "ACCEPTED",
        "LOCKED",
        "ELIMINATED",
    ].includes(activeRegistrationStatus);

    const selectedEligible =
        !!selectedClub &&
        selectedClub.eligible !== false &&
        !hasSelectedClubRegistration &&
        selectedMemberIds.length === teamSize;

    const handleClubSelect = (club) => {
        const registrationStatus = String(
            club.registration?.registrationStatus ||
            ""
        ).toUpperCase();

        if (
            club.registration &&
            registrationStatus !== "REJECTED"
        ) {
            return;
        }

        setSelectedClubId(club.id);

        const existingRoster =
            club.registration?.teamRoster || [];

        if (existingRoster.length > 0) {
            setSelectedMemberIds(
                existingRoster
                    .map((member) => Number(member.userId))
                    .filter((id) => Number.isFinite(id))
            );
        } else {
            setSelectedMemberIds([]);
        }

        setError("");
        setSuccess("");
    };

    const toggleMember = (memberUserId) => {
        const memberId = Number(memberUserId);

        if (!Number.isFinite(memberId)) {
            return;
        }

        setSelectedMemberIds((previous) => {
            if (previous.includes(memberId)) {
                return previous.filter((id) => id !== memberId);
            }

            if (teamSize && previous.length >= teamSize) {
                return previous;
            }

            return [...previous, memberId];
        });

        setError("");
    };

    const handleWithdrawRegistration = async () => {
        setError("");
        setSuccess("");

        try {
            setWithdrawing(true);

            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/withdraw`,
                {
                    method: "DELETE",
                }
            );

            setShowWithdrawConfirm(false);
            setSelectedMemberIds([]);
            setSuccess(response.message || "Registration withdrawn successfully.");

            await loadRegistration(false);
        } catch (err) {
            console.error("Tournament registration withdrawal failed:", err);
            setError(
                err.message ||
                "Unable to withdraw tournament registration."
            );
        } finally {
            setWithdrawing(false);
        }
    };

    const canWithdrawRegistration =
        ["PENDING", "ACCEPTED"].includes(currentStatus) &&
        ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(
            String(competition.status || "").toUpperCase()
        );

    const handleRegister = async () => {
        setError("");
        setSuccess("");

        if (!data?.registrationOpen) {
            setError("Registration is not currently open.");
            return;
        }

        if (isTeamCompetition) {
            if (!selectedClubId) {
                setError("Select a club first.");
                return;
            }

            if (selectedMemberIds.length !== teamSize) {
                setError(
                    `Select exactly ${teamSize} player${teamSize === 1 ? "" : "s"} for this tournament.`
                );
                return;
            }
        }

        try {
            setSubmitting(true);

            const endpoint = isTeamCompetition
                ? `/api/competitions/${competitionId}/register/team`
                : `/api/competitions/${competitionId}/register/player`;

            const body = isTeamCompetition
                ? {
                    clubId: selectedClubId,
                    memberIds: selectedMemberIds,
                }
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
                                        ? "Select a club, then choose the exact players who will represent it in this tournament."
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
                                        <strong>No clubs found for this game</strong>
                                        <p>
                                            Create a club for {getGameName(competition)} first.
                                        </p>
                                    </div>
                                ) : (
                                    clubs.map((club) => {
                                        const isSelected =
                                            String(selectedClubId) === String(club.id);

                                        const registration = club.registration;
                                        const status = String(
                                            registration?.registrationStatus || ""
                                        ).toUpperCase();

                                        const unavailable =
                                            !!registration &&
                                            status !== "REJECTED";

                                        const selectedCount =
                                            isSelected
                                                ? selectedMemberIds.length
                                                : 0;

                                        const memberOk =
                                            club.memberCount >= teamSize;

                                        const selectedRosterIds =
                                            isSelected
                                                ? new Set(selectedMemberIds)
                                                : new Set();

                                        return (
                                            <div
                                                className={`registration-club-card ${
                                                    isSelected ? "selected" : ""
                                                } ${
                                                    unavailable ? "registered" : ""
                                                }`}
                                                key={club.id}
                                            >

                                                <button
                                                    type="button"
                                                    className="registration-club-select-button"
                                                    onClick={() => handleClubSelect(club)}
                                                    disabled={unavailable || !memberOk}
                                                >
                                                    <div className="registration-club-top">
                                                        <div className="registration-club-avatar">
                                                            {club.name?.slice(0, 2).toUpperCase() || "CL"}
                                                        </div>

                                                        <div className="registration-club-name">
                                                            <strong>{club.name}</strong>
                                                            <span>
                                                                {club.tag
                                                                    ? `#${club.tag}`
                                                                    : "SYNCO CLUB"}
                                                            </span>
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
                                                </button>

                                                <div className="registration-roster">
                                                    <div className="registration-roster-heading">
                                                        <div>
                                                            <span>TOURNAMENT SQUAD</span>
                                                            <strong>
                                                                {isSelected
                                                                    ? `${selectedCount}/${teamSize} selected`
                                                                    : `${club.memberCount} club member${club.memberCount === 1 ? "" : "s"}`}
                                                            </strong>
                                                        </div>

                                                        {!unavailable && memberOk && (
                                                            <span className="registration-roster-hint">
                                                                {isSelected
                                                                    ? "Choose players below"
                                                                    : "Select club first"}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="registration-roster-list">
                                                        {club.members?.map((member) => {
                                                            const memberUserId = Number(member.userId);
                                                            const checked = selectedRosterIds.has(memberUserId);

                                                            return (
                                                                <label
                                                                    className={`registration-member-select ${
                                                                        checked ? "selected" : ""
                                                                    } ${
                                                                        !isSelected || unavailable
                                                                            ? "locked"
                                                                            : ""
                                                                    }`}
                                                                    key={member.id || member.userId}
                                                                    onClick={(event) => event.stopPropagation()}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        disabled={
                                                                            !isSelected ||
                                                                            unavailable ||
                                                                            (!checked &&
                                                                                selectedMemberIds.length >= teamSize)
                                                                        }
                                                                        onChange={() =>
                                                                            toggleMember(memberUserId)
                                                                        }
                                                                    />

                                                                    <div className="registration-mini-avatar">
                                                                        {(member.name || "P").slice(0, 2).toUpperCase()}
                                                                    </div>

                                                                    <div className="registration-member-select-info">
                                                                        <strong>{member.name}</strong>
                                                                        {member.uid && (
                                                                            <span>{member.uid}</span>
                                                                        )}
                                                                    </div>

                                                                    <span className="registration-member-role">
                                                                        {member.role || "MEMBER"}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {!memberOk && !unavailable && (
                                                    <div className="registration-card-warning">
                                                        <AlertCircle size={14} />
                                                        <span>
                                                            This club has only {club.memberCount} member{club.memberCount === 1 ? "" : "s"};
                                                            this tournament requires {teamSize}.
                                                        </span>
                                                    </div>
                                                )}

                                                {isSelected && !unavailable && memberOk && (
                                                    <div className={`registration-selection-status ${
                                                        selectedCount === teamSize
                                                            ? "complete"
                                                            : "incomplete"
                                                    }`}>
                                                        <span>
                                                            {selectedCount === teamSize
                                                                ? "Tournament roster ready"
                                                                : `${teamSize - selectedCount} more player${teamSize - selectedCount === 1 ? "" : "s"} required`}
                                                        </span>
                                                    </div>
                                                )}

                                                {unavailable && registration?.teamRoster?.length > 0 && (
                                                    <div className="registration-locked-roster">
                                                        <span>REGISTERED TOURNAMENT ROSTER</span>
                                                        <div>
                                                            {registration.teamRoster.map((member) => (
                                                                <span key={member.userId}>
                                                                    {member.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
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

                                <div className="registration-current-actions">
                                    <button
                                        type="button"
                                        className="registration-view-button"
                                        onClick={() => navigate(`/competitions/${competitionId}`)}
                                    >
                                        View Tournament
                                        <ChevronRight size={15} />
                                    </button>

                                    {canWithdrawRegistration && (
                                        <button
                                            type="button"
                                            className="registration-withdraw-button"
                                            onClick={() => setShowWithdrawConfirm(true)}
                                            disabled={withdrawing}
                                        >
                                            Withdraw Registration
                                        </button>
                                    )}
                                </div>
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
                                <div><Check size={13} /> <span>The club owner selects the exact tournament roster from current club members.</span></div>
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

            {showWithdrawConfirm && (
                <div
                    className="registration-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !withdrawing) {
                            setShowWithdrawConfirm(false);
                        }
                    }}
                >
                    <div
                        className="registration-confirm-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="withdraw-registration-title"
                    >
                        <div className="registration-confirm-modal-header">
                            <div>
                                <span>TOURNAMENT REGISTRATION</span>
                                <h3 id="withdraw-registration-title">Withdraw registration?</h3>
                            </div>
                            <button
                                type="button"
                                className="registration-modal-close"
                                onClick={() => setShowWithdrawConfirm(false)}
                                disabled={withdrawing}
                                aria-label="Close confirmation"
                            >
                                ×
                            </button>
                        </div>

                        <p className="registration-confirm-modal-copy">
                            Your {isTeamCompetition ? "team" : "player"} registration will be removed from this tournament.
                            You can register again while registration remains available.
                        </p>

                        {isTeamCompetition && currentRegistration?.club && (
                            <div className="registration-confirm-modal-summary">
                                <span>TEAM</span>
                                <strong>{currentRegistration.club.name}</strong>
                                {currentRegistration.teamRoster?.length > 0 && (
                                    <small>
                                        {currentRegistration.teamRoster.length} selected player{
                                            currentRegistration.teamRoster.length === 1 ? "" : "s"
                                        }
                                    </small>
                                )}
                            </div>
                        )}

                        <div className="registration-confirm-modal-actions">
                            <button
                                type="button"
                                className="registration-modal-cancel"
                                onClick={() => setShowWithdrawConfirm(false)}
                                disabled={withdrawing}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="registration-modal-confirm"
                                onClick={handleWithdrawRegistration}
                                disabled={withdrawing}
                            >
                                {withdrawing ? (
                                    <>
                                        <Loader2 size={15} className="registration-spin" />
                                        Withdrawing...
                                    </>
                                ) : (
                                    "Withdraw Registration"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
