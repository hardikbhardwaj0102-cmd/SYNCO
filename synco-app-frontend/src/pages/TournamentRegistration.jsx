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
    UserPlus,
    X,
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

function parseApiDate(value) {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    // Tournament datetimes were historically stored as naive UTC in the DB.
    // Treat timezone-less API values as UTC instead of browser-local time.
    const hasTimezone = /(?:Z|[+\-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(hasTimezone ? raw : `${raw}Z`);

    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    if (!value) return "—";
    const date = parseApiDate(value);
    if (!date) return value;
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

function formatRemaining(value, nowMs) {
    const expiry = parseApiDate(value);
    if (!expiry) return "—";

    const remainingMs = expiry.getTime() - nowMs;
    if (remainingMs <= 0) return "Expired";

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
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
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [replacementOutgoingUserId, setReplacementOutgoingUserId] = useState(null);
    const [replacementUserId, setReplacementUserId] = useState("");
    const [replacing, setReplacing] = useState(false);
    const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
    const [substitutionOutgoingUserId, setSubstitutionOutgoingUserId] = useState("");
    const [substitutionReplacementUserId, setSubstitutionReplacementUserId] = useState("");
    const [substitutionReason, setSubstitutionReason] = useState("");
    const [submittingSubstitution, setSubmittingSubstitution] = useState(false);
    const [substitutionActionId, setSubstitutionActionId] = useState(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
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

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        const pendingInvites = data?.myInvites || [];
        const roster = data?.myRegistration?.teamRoster || [];
        const hasPendingInvite = pendingInvites.some(
            (invite) => String(invite.status || "").toUpperCase() === "PENDING"
        );
        const hasPendingRosterInvite = roster.some(
            (member) => String(member.status || "").toUpperCase() === "PENDING"
        );

        if (!hasPendingInvite && !hasPendingRosterInvite) {
            return undefined;
        }

        // Keep captain and invitee views synchronized after an invitation is
        // accepted/declined from another browser or from the notification UI.
        const interval = window.setInterval(() => {
            loadRegistration(false);
        }, 12000);

        return () => window.clearInterval(interval);
    }, [
        data?.myInvites,
        data?.myRegistration?.teamRoster,
        loadRegistration,
    ]);

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
    const currentUserId = Number(data?.currentUserId || 0);
    const isCaptain = Boolean(
        data?.isCaptain ||
        (currentRegistration?.participantType === "TEAM" &&
            Number(currentRegistration?.captainId || currentRegistration?.userId || 0) === currentUserId)
    );

    const pendingInvites = (data?.myInvites || []).filter(
        (invite) => String(invite.status || "").toUpperCase() === "PENDING"
    );

    const replacementCandidates = useMemo(() => {
        if (!selectedClub || !currentRegistration || !isCaptain) return [];

        const currentRosterIds = new Set(
            (currentRegistration.teamRoster || [])
                .map((member) => Number(member.userId))
                .filter((id) => Number.isFinite(id))
        );

        return (selectedClub.members || []).filter((member) => {
            const memberId = Number(member.userId);
            if (!Number.isFinite(memberId)) return false;
            if (memberId === currentUserId) return false;
            if (memberId === Number(replacementOutgoingUserId)) return false;
            if (currentRosterIds.has(memberId)) return false;

            return (
                member.eligible !== false &&
                !member.committedParticipantId
            );
        });
    }, [
        selectedClub,
        currentRegistration,
        isCaptain,
        currentUserId,
        replacementOutgoingUserId,
    ]);

    const substitutionRequests = data?.substitutionRequests || [];
    const isHost = Boolean(data?.isHost);
    const registrationSettings = data?.registrationSettings || {};
    const maxSubstitutions = Number(registrationSettings.maxSubstitutions ?? 1);
    const completedSubstitutions = substitutionRequests.filter(
        (item) => String(item.status || "").toUpperCase() === "COMPLETED"
    ).length;
    const pendingSubstitutionRequest = substitutionRequests.find(
        (item) => String(item.status || "").toUpperCase() === "PENDING"
    );
    const substitutionCutoffDate = parseApiDate(data?.substitutionCutoff);
    const substitutionWindowOpen = !substitutionCutoffDate || nowMs < substitutionCutoffDate.getTime();

    const acceptedNonCaptainRoster = (currentRegistration?.teamRoster || []).filter(
        (member) =>
            String(member.status || "").toUpperCase() === "ACCEPTED" &&
            Number(member.userId) !== Number(currentRegistration?.captainId || currentRegistration?.userId || 0)
    );

    const substitutionReplacementCandidates = useMemo(() => {
        if (!selectedClub || !currentRegistration || !isCaptain) return [];

        const currentRosterIds = new Set(
            (currentRegistration.teamRoster || [])
                .map((member) => Number(member.userId))
                .filter((id) => Number.isFinite(id))
        );

        return (selectedClub.members || []).filter((member) => {
            const memberId = Number(member.userId);
            if (!Number.isFinite(memberId)) return false;
            if (memberId === currentUserId) return false;
            if (currentRosterIds.has(memberId)) return false;
            return member.eligible !== false && !member.committedParticipantId;
        });
    }, [selectedClub, currentRegistration, isCaptain, currentUserId]);

    const canRequestSubstitution =
        isTeamCompetition &&
        isCaptain &&
        currentStatus === "LOCKED" &&
        !pendingSubstitutionRequest &&
        completedSubstitutions < maxSubstitutions &&
        substitutionWindowOpen &&
        acceptedNonCaptainRoster.length > 0;

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
        Number(selectedClub.eligibleMemberCount || 0) >= teamSize &&
        !hasSelectedClubRegistration &&
        selectedMemberIds.length === teamSize;

    const handleClubSelect = (club) => {
        const registrationStatus = String(
            club.registration?.registrationStatus ||
            ""
        ).toUpperCase();

        if (
            club.registration &&
            registrationStatus !== "REJECTED" &&
            registrationStatus !== "CANCELLED"
        ) {
            return;
        }

        if (club.eligible === false) {
            setError(club.unavailableReason || "This club is not eligible for this tournament.");
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

    const respondToInvite = async (inviteId, action) => {
        setError("");
        setSuccess("");

        try {
            await apiRequest(
                `/api/competitions/${competitionId}/registration/invites/${inviteId}/${action}`,
                { method: "POST" }
            );

            setSuccess(
                action === "accept"
                    ? "Tournament invitation accepted."
                    : "Tournament invitation declined."
            );

            await loadRegistration(false);
        } catch (err) {
            console.error(`Tournament invitation ${action} failed:`, err);
            setError(
                err.message ||
                `Unable to ${action} the tournament invitation.`
            );

            // A response can race with another session. Refresh immediately
            // so the screen shows the authoritative server state.
            await loadRegistration(false);
        }
    };

    const openReplaceModal = (userId) => {
        setReplacementOutgoingUserId(Number(userId));
        setReplacementUserId("");
        setShowReplaceModal(true);
        setError("");
        setSuccess("");
    };

    const closeReplaceModal = () => {
        if (replacing) return;
        setShowReplaceModal(false);
        setReplacementOutgoingUserId(null);
        setReplacementUserId("");
    };

    const handleReplaceTeamPlayer = async () => {
        if (!replacementOutgoingUserId || !replacementUserId) {
            setError("Select a replacement player.");
            return;
        }

        setError("");
        setSuccess("");

        try {
            setReplacing(true);

            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/replace`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        outgoingUserId: replacementOutgoingUserId,
                        replacementUserId: Number(replacementUserId),
                    }),
                }
            );

            setSuccess(
                response.message ||
                "Replacement invitation sent. The current player remains until the replacement accepts."
            );

            setShowReplaceModal(false);
            setReplacementOutgoingUserId(null);
            setReplacementUserId("");
            await loadRegistration(false);
        } catch (err) {
            console.error("Tournament team replacement failed:", err);
            setError(
                err.message ||
                "Unable to send the replacement invitation."
            );
        } finally {
            setReplacing(false);
        }
    };

    const openSubstitutionModal = () => {
        const firstOutgoing = acceptedNonCaptainRoster[0];
        setSubstitutionOutgoingUserId(firstOutgoing ? String(firstOutgoing.userId) : "");
        setSubstitutionReplacementUserId("");
        setSubstitutionReason("");
        setShowSubstitutionModal(true);
        setError("");
        setSuccess("");
    };

    const closeSubstitutionModal = () => {
        if (submittingSubstitution) return;
        setShowSubstitutionModal(false);
        setSubstitutionOutgoingUserId("");
        setSubstitutionReplacementUserId("");
        setSubstitutionReason("");
    };

    const handleRequestSubstitution = async () => {
        if (!substitutionOutgoingUserId || !substitutionReplacementUserId) {
            setError("Select the outgoing player and a replacement.");
            return;
        }
        if (!substitutionReason.trim()) {
            setError("Enter a reason for the substitution.");
            return;
        }
        try {
            setSubmittingSubstitution(true);
            setError("");
            setSuccess("");
            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/substitution-requests`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        outgoingUserId: Number(substitutionOutgoingUserId),
                        replacementUserId: Number(substitutionReplacementUserId),
                        reason: substitutionReason.trim(),
                    }),
                }
            );
            setSuccess(response.message || "Substitution request sent to the host.");
            closeSubstitutionModal();
            await loadRegistration(false);
        } catch (err) {
            console.error("Substitution request failed:", err);
            setError(err.message || "Unable to request substitution.");
        } finally {
            setSubmittingSubstitution(false);
        }
    };

    const handleHostSubstitutionAction = async (requestId, action) => {
        try {
            setSubstitutionActionId(`${action}-${requestId}`);
            setError("");
            setSuccess("");
            let rejectReason = "";
            if (action === "reject") {
                rejectReason = window.prompt("Reason for rejecting this substitution:", "") || "";
            }
            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/substitution-requests/${requestId}/${action}`,
                {
                    method: "POST",
                    ...(action === "reject" ? { body: JSON.stringify({ reason: rejectReason.trim() }) } : {}),
                }
            );
            setSuccess(response.message || `Substitution ${action}ed.`);
            await loadRegistration(false);
        } catch (err) {
            console.error(`Host substitution ${action} failed:`, err);
            setError(err.message || `Unable to ${action} substitution.`);
            await loadRegistration(false);
        } finally {
            setSubstitutionActionId(null);
        }
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
        (!isTeamCompetition || isCaptain) &&
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

                        {pendingInvites.length > 0 && (
                            <section className="registration-invite-panel">
                                <div className="registration-invite-panel-heading">
                                    <div>
                                        <span>TOURNAMENT INVITATION</span>
                                        <strong>You have a team invitation waiting for your response.</strong>
                                    </div>
                                    <Clock3 size={17} />
                                </div>

                                <div className="registration-invite-list">
                                    {pendingInvites.map((invite) => (
                                        <div className="registration-invite-card" key={invite.id}>
                                            <div className="registration-invite-main">
                                                <div className="registration-invite-avatar">
                                                    {(invite.teamName || "TM").slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <strong>{invite.teamName || "Tournament Team"}</strong>
                                                    <span>
                                                        {invite.inviteType === "REPLACEMENT"
                                                            ? "Replacement invitation"
                                                            : invite.inviteType === "SUBSTITUTION"
                                                                ? "Substitution invitation"
                                                                : "Tournament team invitation"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="registration-invite-expiry">
                                                <span>TIME LEFT</span>
                                                <strong className={
                                                    formatRemaining(invite.expiresAt, nowMs) === "Expired"
                                                        ? "expired"
                                                        : ""
                                                }>
                                                    {formatRemaining(invite.expiresAt, nowMs)}
                                                </strong>
                                            </div>

                                            <div className="registration-invite-actions">
                                                <button
                                                    type="button"
                                                    className="registration-invite-accept"
                                                    onClick={() => respondToInvite(invite.id, "accept")}
                                                >
                                                    <Check size={14} />
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    className="registration-invite-decline"
                                                    onClick={() => respondToInvite(invite.id, "decline")}
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

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
                                            Number(club.eligibleMemberCount || 0) >= teamSize;

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
                                                    disabled={unavailable || !memberOk || club.eligible === false}
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
                                                                    : `${club.eligibleMemberCount || 0}/${club.memberCount} eligible member${club.memberCount === 1 ? "" : "s"}`}
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
                                                                        !isSelected || unavailable || member.eligible === false
                                                                            ? "locked"
                                                                            : ""
                                                                    } ${
                                                                        member.eligible === false ? "ineligible" : ""
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
                                                                            member.eligible === false ||
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
                                                                        {member.eligible === false && member.unavailableReason && (
                                                                            <small>{member.unavailableReason}</small>
                                                                        )}
                                                                    </div>

                                                                    <span className="registration-member-role">
                                                                        {member.eligible === false ? "UNAVAILABLE" : (member.role || "MEMBER")}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {(!memberOk || club.eligible === false) && !unavailable && (
                                                    <div className="registration-card-warning">
                                                        <AlertCircle size={14} />
                                                        <span>
                                                            {club.unavailableReason ||
                                                                `Only ${club.eligibleMemberCount || 0} eligible player${Number(club.eligibleMemberCount || 0) === 1 ? "" : "s"}; ${teamSize} required.`}
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
                                <div className="registration-current-state-top">
                                    <div>
                                        <span>CURRENT REGISTRATION</span>
                                        <strong>{statusLabel(currentStatus)}</strong>
                                    </div>

                                    {isCaptain && isTeamCompetition && (
                                        <span className="registration-captain-badge">CAPTAIN</span>
                                    )}
                                </div>

                                {isTeamCompetition && currentRegistration?.teamRoster?.length > 0 && (
                                    <div className="registration-team-management">
                                        <div className="registration-team-management-heading">
                                            <div>
                                                <span>TEAM ROSTER</span>
                                                <strong>
                                                    {currentRegistration.teamRoster.filter((member) =>
                                                        String(member.status || "").toUpperCase() === "ACCEPTED"
                                                    ).length}/{teamSize} accepted
                                                </strong>
                                            </div>
                                            {isCaptain && data?.registrationOpen && (
                                                <small>Captain can replace a roster player before the deadline. The old player stays until the replacement accepts.</small>
                                            )}
                                        </div>

                                        <div className="registration-team-management-list">
                                            {currentRegistration.teamRoster
                                                .slice()
                                                .sort((a, b) => Number(a.rosterOrder || 0) - Number(b.rosterOrder || 0))
                                                .map((member) => {
                                                    const memberStatus = String(member.status || "").toUpperCase();
                                                    const isCurrentCaptain = Number(member.userId) === Number(currentRegistration.captainId);
                                                    const replacementPending = (currentRegistration.pendingReplacementInvites || []).some(
                                                        (invite) => String(invite.replacesUserId) === String(member.userId) &&
                                                            String(invite.status || "").toUpperCase() === "PENDING"
                                                    );
                                                    const hasPendingInvite = memberStatus === "PENDING";
                                                    const inviteTimeLeft = formatRemaining(member.inviteExpiresAt, nowMs);

                                                    return (
                                                        <div className="registration-team-management-row" key={`${member.userId}-${member.rosterOrder}`}>
                                                            <div className="registration-team-player">
                                                                <div className="registration-mini-avatar">
                                                                    {(member.name || "P").slice(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <strong>{member.name || member.username || "Player"}</strong>
                                                                    <span>{isCurrentCaptain ? "CAPTAIN" : (member.role || "MEMBER")}</span>
                                                                </div>
                                                            </div>

                                                            <div className={`registration-team-player-status ${memberStatus.toLowerCase()}`}>
                                                                {hasPendingInvite ? (
                                                                    <>
                                                                        <span>Pending</span>
                                                                        <strong className={inviteTimeLeft === "Expired" ? "expired" : ""}>
                                                                            {inviteTimeLeft === "Expired"
                                                                                ? "Expired"
                                                                                : `${inviteTimeLeft} left`}
                                                                        </strong>
                                                                    </>
                                                                ) : (
                                                                    <span>{statusLabel(memberStatus)}</span>
                                                                )}
                                                            </div>

                                                            {isCaptain &&
                                                                data?.registrationOpen &&
                                                                !isCurrentCaptain &&
                                                                ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"].includes(memberStatus) && (
                                                                    replacementPending ? (
                                                                        <span className="registration-replacement-pending">Replacement Pending</span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className="registration-replace-button"
                                                                            onClick={() => openReplaceModal(member.userId)}
                                                                        >
                                                                            <UserPlus size={13} />
                                                                            Replace
                                                                        </button>
                                                                    )
                                                                )}
                                                        </div>
                                                    );
                                                })}
                                        </div>

                                        {isCaptain && (currentRegistration.pendingReplacementInvites || []).length > 0 && (
                                            <div className="registration-pending-replacement-list">
                                                <div className="registration-pending-replacement-heading">
                                                    <span>PENDING REPLACEMENT INVITES</span>
                                                    <small>Waiting for the replacement player to accept.</small>
                                                </div>
                                                {(currentRegistration.pendingReplacementInvites || []).map((invite) => (
                                                    <div className="registration-pending-replacement-row" key={invite.id}>
                                                        <div>
                                                            <strong>{invite.user?.name || invite.user?.username || `Player ${invite.invitedUserId}`}</strong>
                                                            <span>Replacing {invite.replacesUserId ? `player #${invite.replacesUserId}` : "roster slot"}</span>
                                                        </div>
                                                        <strong>{formatRemaining(invite.expiresAt, nowMs)} left</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {isCaptain && isTeamCompetition && currentStatus === "LOCKED" && (
                                            <div className="registration-substitution-tools">
                                                <div>
                                                    <span>POST-LOCK SUBSTITUTIONS</span>
                                                    <strong>{completedSubstitutions}/{maxSubstitutions} substitutions used</strong>
                                                    {substitutionCutoffDate && <small>Requests close {formatDate(data?.substitutionCutoff)}.</small>}
                                                </div>
                                                {canRequestSubstitution ? (
                                                    <button
                                                        type="button"
                                                        className="registration-substitution-button"
                                                        onClick={openSubstitutionModal}
                                                    >
                                                        <UserPlus size={14} />
                                                        Request Substitution
                                                    </button>
                                                ) : (
                                                    <span className="registration-substitution-closed">
                                                        {pendingSubstitutionRequest
                                                            ? "Awaiting host decision"
                                                            : completedSubstitutions >= maxSubstitutions
                                                                ? "Substitution limit reached"
                                                                : !substitutionWindowOpen
                                                                    ? "Substitution window closed"
                                                                    : "No eligible substitution available"}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

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

                    {isHost && isTeamCompetition && substitutionRequests.length > 0 && (
                        <section className="registration-host-panel">
                            <div className="registration-host-panel-heading">
                                <div><span>HOST CONTROL</span><strong>Substitution requests</strong></div>
                                <ShieldCheck size={17} />
                            </div>
                            <div className="registration-host-request-list">
                                {substitutionRequests.map((request) => {
                                    const requestStatus = String(request.status || "").toUpperCase();
                                    const isPending = requestStatus === "PENDING";
                                    return (
                                        <div className="registration-host-request-card" key={request.id}>
                                            <div className="registration-host-request-main">
                                                <strong>{request.teamName || "Tournament Team"}</strong>
                                                <span>
                                                    {request.outgoingUser?.name || request.outgoingUser?.username || `Player ${request.outgoingUserId || ""}`} → {request.replacementUser?.name || request.replacementUser?.username || `Player ${request.replacementUserId || ""}`}
                                                </span>
                                                <small>{request.reason || "No reason provided"}</small>
                                            </div>
                                            <div className={`registration-host-request-status ${requestStatus.toLowerCase()}`}>{statusLabel(requestStatus)}</div>
                                            {isPending && (
                                                <div className="registration-host-request-actions">
                                                    <button type="button" className="registration-host-approve" onClick={() => handleHostSubstitutionAction(request.id, "approve")} disabled={Boolean(substitutionActionId)}>
                                                        {substitutionActionId === `approve-${request.id}` ? "Approving..." : "Approve"}
                                                    </button>
                                                    <button type="button" className="registration-host-reject" onClick={() => handleHostSubstitutionAction(request.id, "reject")} disabled={Boolean(substitutionActionId)}>
                                                        {substitutionActionId === `reject-${request.id}` ? "Rejecting..." : "Reject"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

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
                                {isTeamCompetition ? (
                                    <>
                                        <div><Check size={13} /> <span>Any club member can start the team registration; the club owner has no special tournament role.</span></div>
                                        <div><Check size={13} /> <span>Select exactly {teamSize} eligible club members, including yourself as captain.</span></div>
                                        <div><Check size={13} /> <span>Each teammate receives a separate invite for up to 5 hours, capped by the registration deadline.</span></div>
                                        <div><Check size={13} /> <span>Declined or expired slots can be replaced by the captain before the deadline.</span></div>
                                        <div><Check size={13} /> <span>Rosters lock at the deadline; post-lock substitutions require host approval.</span></div>
                                    </>
                                ) : (
                                    <>
                                        <div><Check size={13} /> <span>Solo registration is direct from your existing SYNCO account.</span></div>
                                        <div><Check size={13} /> <span>The tournament game must be linked to your SYNCO profile.</span></div>
                                    </>
                                )}
                                <div><Check size={13} /> <span>Only confirmed full teams count toward tournament capacity.</span></div>
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

            {showReplaceModal && (
                <div
                    className="registration-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !replacing) {
                            closeReplaceModal();
                        }
                    }}
                >
                    <div
                        className="registration-confirm-modal registration-replace-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="replace-player-title"
                    >
                        <div className="registration-confirm-modal-header">
                            <div>
                                <span>TEAM MANAGEMENT</span>
                                <h3 id="replace-player-title">Replace team member</h3>
                            </div>
                            <button
                                type="button"
                                className="registration-modal-close"
                                onClick={closeReplaceModal}
                                disabled={replacing}
                                aria-label="Close replacement dialog"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="registration-replace-content">
                            <p>
                                The current player stays on the roster until the replacement accepts the new invitation.
                            </p>

                            <label className="registration-replace-field">
                                <span>REPLACEMENT PLAYER</span>
                                <select
                                    value={replacementUserId}
                                    onChange={(event) => setReplacementUserId(event.target.value)}
                                    disabled={replacing}
                                >
                                    <option value="">Select a club member</option>
                                    {replacementCandidates.map((member) => (
                                        <option key={member.userId} value={member.userId}>
                                            {member.name || member.username || `Player ${member.userId}`}
                                            {member.uid ? ` — ${member.uid}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {!replacementCandidates.length && (
                                <div className="registration-replace-empty">
                                    No eligible replacement player is currently available in this club.
                                </div>
                            )}
                        </div>

                        <div className="registration-confirm-modal-actions">
                            <button
                                type="button"
                                className="registration-modal-cancel"
                                onClick={closeReplaceModal}
                                disabled={replacing}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="registration-modal-confirm"
                                onClick={handleReplaceTeamPlayer}
                                disabled={replacing || !replacementUserId || !replacementCandidates.length}
                            >
                                {replacing ? (
                                    <>
                                        <Loader2 size={15} className="registration-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={15} />
                                        Send Replacement Invite
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSubstitutionModal && (
                <div
                    className="registration-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !submittingSubstitution) closeSubstitutionModal();
                    }}
                >
                    <div className="registration-confirm-modal registration-substitution-modal" role="dialog" aria-modal="true" aria-labelledby="substitution-title">
                        <div className="registration-confirm-modal-header">
                            <div>
                                <span>TEAM MANAGEMENT</span>
                                <h3 id="substitution-title">Request substitution</h3>
                            </div>
                            <button type="button" className="registration-modal-close" onClick={closeSubstitutionModal} disabled={submittingSubstitution} aria-label="Close substitution dialog">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="registration-replace-content">
                            <p>Host approval is required. The roster changes only after the replacement player accepts the approved invitation.</p>

                            <label className="registration-replace-field">
                                <span>PLAYER TO REMOVE</span>
                                <select value={substitutionOutgoingUserId} onChange={(event) => { setSubstitutionOutgoingUserId(event.target.value); setSubstitutionReplacementUserId(""); }} disabled={submittingSubstitution}>
                                    <option value="">Select player</option>
                                    {acceptedNonCaptainRoster.map((member) => <option key={member.userId} value={member.userId}>{member.name || member.username || `Player ${member.userId}`}</option>)}
                                </select>
                            </label>

                            <label className="registration-replace-field">
                                <span>REPLACEMENT PLAYER</span>
                                <select value={substitutionReplacementUserId} onChange={(event) => setSubstitutionReplacementUserId(event.target.value)} disabled={submittingSubstitution}>
                                    <option value="">Select eligible club member</option>
                                    {substitutionReplacementCandidates.map((member) => <option key={member.userId} value={member.userId}>{member.name || member.username || `Player ${member.userId}`}{member.uid ? ` — ${member.uid}` : ""}</option>)}
                                </select>
                            </label>

                            <label className="registration-replace-field">
                                <span>REASON</span>
                                <textarea value={substitutionReason} onChange={(event) => setSubstitutionReason(event.target.value)} placeholder="Why is this substitution required?" rows={4} disabled={submittingSubstitution} />
                            </label>
                        </div>
                        <div className="registration-confirm-modal-actions">
                            <button type="button" className="registration-modal-cancel" onClick={closeSubstitutionModal} disabled={submittingSubstitution}>Cancel</button>
                            <button type="button" className="registration-modal-confirm" onClick={handleRequestSubstitution} disabled={submittingSubstitution || !substitutionOutgoingUserId || !substitutionReplacementUserId || !substitutionReason.trim()}>
                                {submittingSubstitution ? <> <Loader2 size={15} className="registration-spin" /> Sending... </> : <> <UserPlus size={15} /> Send Request </>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
