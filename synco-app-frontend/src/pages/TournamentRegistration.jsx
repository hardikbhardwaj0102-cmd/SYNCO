import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeft,
    CalendarClock,
    Check,
    ChevronRight,
    CircleDot,
    Clock3,
    Gamepad2,
    Loader2,
    LockKeyhole,
    RefreshCw,
    RotateCcw,
    Send,
    ShieldCheck,
    TimerReset,
    Trophy,
    UserCheck,
    UserPlus,
    UserX,
    Users,
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

function formatRemaining(value, now = Date.now()) {
    if (!value) return "No expiry";

    const target = new Date(value).getTime();
    if (Number.isNaN(target)) return "";

    const diff = target - now;
    if (diff <= 0) return "Expired";

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${Math.max(1, minutes)}m left`;
}

function statusLabel(status) {
    return String(status || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
    return String(status || "")
        .toLowerCase()
        .replaceAll("_", "-");
}

function getGameName(competition) {
    if (!competition) return "Tournament";

    if (competition.game && typeof competition.game === "object") {
        return competition.game.name || competition.game.slug || "Game";
    }

    return competition.game || competition.gameId || "Game";
}

function userDisplayName(user) {
    return user?.username || user?.name || `Player ${user?.id || ""}`.trim();
}

function avatarText(name) {
    return String(name || "P")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "P";
}

function teamStatusDescription(status) {
    switch (String(status || "").toUpperCase()) {
        case "PENDING":
            return "Waiting for selected teammates to accept their invitations.";
        case "ACCEPTED":
            return "Every required player has accepted. Your team is confirmed.";
        case "LOCKED":
            return "Roster locked for competition. Changes require host approval.";
        case "CANCELLED":
            return "This registration was cancelled before the roster was completed.";
        case "REJECTED":
            return "This registration was rejected.";
        default:
            return "";
    }
}

export default function TournamentRegistration() {
    const { competitionId } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [selectedClubId, setSelectedClubId] = useState(null);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [showReplace, setShowReplace] = useState(false);
    const [replaceTargetId, setReplaceTargetId] = useState(null);
    const [replacementUserId, setReplacementUserId] = useState(null);

    const [showSubstitution, setShowSubstitution] = useState(false);
    const [substitutionOutgoingId, setSubstitutionOutgoingId] = useState(null);
    const [substitutionReplacementId, setSubstitutionReplacementId] = useState(null);
    const [substitutionReason, setSubstitutionReason] = useState("");

    const [nowTick, setNowTick] = useState(Date.now());

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

            const registration = response?.myRegistration;
            if (registration?.clubId) {
                setSelectedClubId(registration.clubId);
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
        const timer = window.setInterval(() => {
            setNowTick(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    const competition = data?.competition || {};
    const clubs = data?.myClubs || [];
    const myInvites = data?.myInvites || [];
    const substitutionRequests = data?.substitutionRequests || [];
    const modeConfig = data?.modeConfig || {};
    const registrationSettings = data?.registrationSettings || {};

    const isTeamCompetition =
        String(competition.participantType || "").toUpperCase() === "TEAM";

    const teamSize = Number(competition.teamSize || 0);
    const currentRegistration = data?.myRegistration || null;
    const currentStatus = String(
        currentRegistration?.registrationStatus || ""
    ).toUpperCase();

    const selectedClub = useMemo(
        () => clubs.find(
            (club) => String(club.id) === String(selectedClubId)
        ) || null,
        [clubs, selectedClubId]
    );

    const currentRoster = currentRegistration?.teamRoster || [];

    const isCaptain =
        isTeamCompetition &&
        Number(currentRegistration?.captainId || currentRegistration?.userId) > 0;

    const canModifyPreDeadline =
        isTeamCompetition &&
        ["PENDING", "ACCEPTED"].includes(currentStatus) &&
        !!data?.registrationOpen;

    const canWithdraw =
        ["PENDING", "ACCEPTED"].includes(currentStatus) &&
        !!data?.registrationOpen;

    const acceptedRoster = useMemo(
        () => currentRoster.filter(
            (member) =>
                String(member.status || "ACCEPTED").toUpperCase() === "ACCEPTED"
        ),
        [currentRoster]
    );

    const pendingRoster = useMemo(
        () => currentRoster.filter(
            (member) =>
                String(member.status || "").toUpperCase() === "PENDING"
        ),
        [currentRoster]
    );

    const replaceableRoster = useMemo(
        () => currentRoster.filter((member) => {
            const status = String(member.status || "").toUpperCase();
            const isCaptainMember = String(member.role || "").toUpperCase() === "CAPTAIN";
            return !isCaptainMember && ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"].includes(status);
        }),
        [currentRoster]
    );

    const rosterUserIds = useMemo(
        () => new Set(
            currentRoster
                .map((member) => Number(member.userId))
                .filter((id) => Number.isFinite(id))
        ),
        [currentRoster]
    );

    const selectableMembers = useMemo(() => {
        if (!selectedClub) return [];

        return (selectedClub.members || []).filter((member) => {
            if (member.isCurrentUser) return true;
            return member.eligible !== false && !rosterUserIds.has(Number(member.userId));
        });
    }, [selectedClub, rosterUserIds]);

    const selectedMemberCount = selectedMemberIds.length;

    const selectedEligible =
        !!selectedClub &&
        selectedClub.eligible !== false &&
        selectedMemberCount === teamSize &&
        selectedMemberIds.every((id) => {
            const member = selectedClub.members?.find(
                (item) => Number(item.userId) === Number(id)
            );
            return member?.eligible !== false;
        });

    const replacementCandidates = useMemo(() => {
        if (!currentRegistration || !selectedClub) return [];

        return (selectedClub.members || []).filter((member) => {
            const memberId = Number(member.userId);
            return (
                member.eligible !== false &&
                !rosterUserIds.has(memberId) &&
                memberId !== Number(currentRegistration.captainId || currentRegistration.userId)
            );
        });
    }, [currentRegistration, selectedClub, rosterUserIds]);

    const substitutionCandidates = replacementCandidates;

    const currentSubstitutionRequest = substitutionRequests.find(
        (request) => String(request.status || "").toUpperCase() === "PENDING"
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        setSuccess("");
        try {
            await loadRegistration(false);
        } finally {
            setRefreshing(false);
        }
    };

    const handleClubSelect = (club) => {
        if (!club?.eligible) return;

        setSelectedClubId(club.id);

        const captain = (club.members || []).find(
            (member) => member.isCurrentUser
        );

        setSelectedMemberIds(
            captain ? [Number(captain.userId)] : []
        );

        setError("");
        setSuccess("");
    };

    const toggleMember = (member) => {
        const memberId = Number(member?.userId);
        if (!Number.isFinite(memberId) || member.eligible === false) return;

        if (member.isCurrentUser) return;

        setSelectedMemberIds((previous) => {
            if (previous.includes(memberId)) {
                return previous.filter((id) => id !== memberId);
            }

            if (teamSize && previous.length >= teamSize) {
                return previous;
            }

            return [...previous, memberId];
        });
    };

    const handleRegister = async () => {
        setError("");
        setSuccess("");

        if (!data?.registrationOpen) {
            setError("Registration is not currently open.");
            return;
        }

        if (!data?.currentUserGameLinked) {
            setError("Link the tournament game to your SYNCO profile before registering.");
            return;
        }

        if (isTeamCompetition) {
            if (!selectedClubId) {
                setError("Select a club first.");
                return;
            }

            if (selectedMemberIds.length !== teamSize) {
                setError(
                    `Select exactly ${teamSize} players including yourself as captain.`
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

            setSuccess(
                response.message || "Registration submitted successfully."
            );

            await loadRegistration(false);
        } catch (err) {
            console.error("Tournament registration failed:", err);
            setError(err.message || "Unable to register for this tournament.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleInviteAction = async (inviteId, action) => {
        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/invites/${inviteId}/${action}`,
                {
                    method: "POST",
                }
            );

            setSuccess(response.message || `Invitation ${action}ed.`);
            await loadRegistration(false);
        } catch (err) {
            console.error("Tournament invite action failed:", err);
            setError(err.message || "Unable to update the tournament invitation.");
            await loadRegistration(false);
        } finally {
            setActionLoading(false);
        }
    };

    const handleWithdraw = async () => {
        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/withdraw`,
                {
                    method: "DELETE",
                }
            );

            setShowWithdrawConfirm(false);
            setSuccess(response.message || "Tournament registration withdrawn.");
            setSelectedMemberIds([]);
            await loadRegistration(false);
        } catch (err) {
            setError(err.message || "Unable to withdraw registration.");
        } finally {
            setActionLoading(false);
        }
    };

    const openReplaceModal = (userId) => {
        setReplaceTargetId(Number(userId));
        setReplacementUserId(null);
        setError("");
        setSuccess("");
        setShowReplace(true);
    };

    const handleReplacement = async () => {
        if (!replaceTargetId || !replacementUserId) {
            setError("Select a replacement player.");
            return;
        }

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/replace`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        outgoingUserId: replaceTargetId,
                        replacementUserId,
                    }),
                }
            );

            setShowReplace(false);
            setReplaceTargetId(null);
            setReplacementUserId(null);
            setSuccess(response.message || "Replacement invitation sent.");
            await loadRegistration(false);
        } catch (err) {
            setError(err.message || "Unable to send replacement invitation.");
        } finally {
            setActionLoading(false);
        }
    };

    const openSubstitutionModal = () => {
        setSubstitutionOutgoingId(null);
        setSubstitutionReplacementId(null);
        setSubstitutionReason("");
        setError("");
        setSuccess("");
        setShowSubstitution(true);
    };

    const handleSubstitutionRequest = async () => {
        if (!substitutionOutgoingId || !substitutionReplacementId) {
            setError("Select both the outgoing player and replacement player.");
            return;
        }

        if (!substitutionReason.trim()) {
            setError("Enter a reason for the substitution request.");
            return;
        }

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                `/api/competitions/${competitionId}/registration/substitution-requests`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        outgoingUserId: substitutionOutgoingId,
                        replacementUserId: substitutionReplacementId,
                        reason: substitutionReason.trim(),
                    }),
                }
            );

            setShowSubstitution(false);
            setSuccess(
                response.message || "Substitution request sent to the host."
            );
            await loadRegistration(false);
        } catch (err) {
            setError(err.message || "Unable to submit the substitution request.");
        } finally {
            setActionLoading(false);
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
                            <button
                                onClick={() => loadRegistration(true)}
                                type="button"
                            >
                                <RefreshCw size={15} />
                                Retry
                            </button>
                            <button
                                onClick={() => navigate(-1)}
                                type="button"
                                className="secondary"
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
                    <RefreshCw
                        size={15}
                        className={refreshing ? "registration-spin" : ""}
                    />
                    Refresh
                </button>
            </header>

            {(error || success) && (
                <div className={`registration-alert ${error ? "error" : "success"}`}>
                    {error ? <AlertCircle size={15} /> : <Check size={15} />}
                    <span>{error || success}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setSuccess("");
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <main className="registration-content">
                <section className="registration-summary">
                    <div className="registration-game-block">
                        <div className="registration-icon-box">
                            <Gamepad2 size={20} />
                        </div>
                        <div>
                            <span>GAME</span>
                            <strong>{getGameName(competition)}</strong>
                        </div>
                    </div>

                    <div className="registration-summary-item">
                        <span>FORMAT</span>
                        <strong>
                            {competition.gameMode || competition.competitionType || "—"}
                        </strong>
                    </div>

                    <div className="registration-summary-item">
                        <span>{isTeamCompetition ? "TEAM SIZE" : "PARTICIPANT TYPE"}</span>
                        <strong>
                            {isTeamCompetition
                                ? `${teamSize} PLAYER${teamSize === 1 ? "" : "S"}`
                                : "PLAYER"}
                        </strong>
                    </div>

                    <div className="registration-summary-item">
                        <span>CONFIRMED</span>
                        <strong>
                            {Number(data?.registeredCount || 0)} / {Number(data?.capacity || 0)}
                        </strong>
                    </div>
                </section>

                <div className="registration-grid">
                    <section className="registration-main-card">
                        <div className="registration-card-heading">
                            <div>
                                <span>JOIN THIS TOURNAMENT</span>
                                <h2>
                                    {currentRegistration
                                        ? "Your tournament entry"
                                        : isTeamCompetition
                                            ? "Build your team"
                                            : "Confirm your participation"}
                                </h2>
                                <p>
                                    {isTeamCompetition
                                        ? "Choose a club you belong to, select the roster, and send invitations. You become captain automatically."
                                        : "Your SYNCO account will register directly once the tournament game is linked to your profile."}
                                </p>
                            </div>

                            <div
                                className={`registration-open-pill ${data?.registrationOpen ? "open" : "closed"}`}
                            >
                                {data?.registrationOpen
                                    ? "REGISTRATION OPEN"
                                    : currentStatus === "LOCKED"
                                        ? "ROSTER LOCKED"
                                        : "REGISTRATION CLOSED"}
                            </div>
                        </div>

                        {myInvites.length > 0 && (
                            <section className="registration-section-block registration-invite-section">
                                <div className="registration-section-heading">
                                    <div>
                                        <span>INVITATIONS FOR YOU</span>
                                        <h3>Pending team invites</h3>
                                    </div>
                                    <span className="registration-count-pill">
                                        {myInvites.length}
                                    </span>
                                </div>

                                <div className="registration-invite-list">
                                    {myInvites.map((invite) => (
                                        <div className="registration-invite-card" key={invite.id}>
                                            <div className="registration-invite-icon">
                                                {invite.inviteType === "SUBSTITUTION"
                                                    ? <RotateCcw size={17} />
                                                    : <UserPlus size={17} />}
                                            </div>

                                            <div className="registration-invite-copy">
                                                <strong>{invite.teamName || "Tournament Team"}</strong>
                                                <span>
                                                    {invite.inviteType === "SUBSTITUTION"
                                                        ? "Approved substitution invitation"
                                                        : invite.inviteType === "REPLACEMENT"
                                                            ? "Replacement invitation"
                                                            : "Tournament team invitation"}
                                                </span>
                                                <small>
                                                    {formatRemaining(invite.expiresAt, nowTick)}
                                                    {invite.expiresAt ? ` · expires ${formatDate(invite.expiresAt)}` : ""}
                                                </small>
                                            </div>

                                            <div className="registration-invite-actions">
                                                <button
                                                    type="button"
                                                    className="registration-primary-mini"
                                                    disabled={actionLoading}
                                                    onClick={() => handleInviteAction(invite.id, "accept")}
                                                >
                                                    <Check size={14} />
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    className="registration-secondary-mini"
                                                    disabled={actionLoading}
                                                    onClick={() => handleInviteAction(invite.id, "decline")}
                                                >
                                                    <X size={14} />
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {isTeamCompetition ? (
                            <>
                                {!currentRegistration && (
                                    <section className="registration-section-block">
                                        <div className="registration-section-heading">
                                            <div>
                                                <span>STEP 1</span>
                                                <h3>Choose a club</h3>
                                            </div>
                                            <span className="registration-section-meta">
                                                {clubs.length} available
                                            </span>
                                        </div>

                                        {!clubs.length ? (
                                            <div className="registration-empty compact">
                                                <Users size={21} />
                                                <strong>No clubs found for this game</strong>
                                                <p>
                                                    Join or create a {getGameName(competition)} club before starting a team registration.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="registration-club-list">
                                                {clubs.map((club) => {
                                                    const isSelected = String(selectedClubId) === String(club.id);
                                                    const disabled = !club.eligible;

                                                    return (
                                                        <div
                                                            className={`registration-club-card ${isSelected ? "selected" : ""} ${disabled ? "is-disabled" : ""}`}
                                                            key={club.id}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="registration-club-select-button"
                                                                onClick={() => handleClubSelect(club)}
                                                                disabled={disabled}
                                                            >
                                                                <div className="registration-club-top">
                                                                    <div className="registration-club-avatar">
                                                                        {avatarText(club.name)}
                                                                    </div>

                                                                    <div className="registration-club-name">
                                                                        <strong>{club.name}</strong>
                                                                        <span>
                                                                            #{club.tag || "CLUB"} · {club.isOwner ? "Owner" : club.membershipRole || "Member"}
                                                                        </span>
                                                                    </div>

                                                                    <div className="registration-club-status">
                                                                        {disabled ? (
                                                                            <CircleDot size={16} />
                                                                        ) : isSelected ? (
                                                                            <Check size={16} />
                                                                        ) : (
                                                                            <ChevronRight size={16} />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </button>

                                                            <div className="registration-club-availability">
                                                                <span>
                                                                    <UserCheck size={13} />
                                                                    {club.eligibleMemberCount} eligible players
                                                                </span>
                                                                {club.unavailableReason && (
                                                                    <strong>{club.unavailableReason}</strong>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                )}

                                {!currentRegistration && selectedClub && (
                                    <section className="registration-section-block">
                                        <div className="registration-section-heading">
                                            <div>
                                                <span>STEP 2</span>
                                                <h3>Select the roster</h3>
                                            </div>
                                            <span className="registration-count-pill">
                                                {selectedMemberCount} / {teamSize}
                                            </span>
                                        </div>

                                        <div className="registration-captain-note">
                                            <div className="registration-captain-icon">
                                                <ShieldCheck size={16} />
                                            </div>
                                            <div>
                                                <strong>You are the captain</strong>
                                                <p>
                                                    Your place is accepted automatically. Select {Math.max(0, teamSize - 1)} teammate{teamSize - 1 === 1 ? "" : "s"} from {selectedClub.name}.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="registration-member-grid">
                                            {(selectedClub.members || []).map((member) => {
                                                const memberId = Number(member.userId);
                                                const checked = selectedMemberIds.includes(memberId);
                                                const isCaptainMember = !!member.isCurrentUser;
                                                const disabled =
                                                    isCaptainMember ||
                                                    member.eligible === false ||
                                                    (!checked && selectedMemberCount >= teamSize);

                                                return (
                                                    <button
                                                        type="button"
                                                        key={member.id}
                                                        className={`registration-member-option ${checked ? "selected" : ""} ${member.eligible === false ? "is-unavailable" : ""}`}
                                                        disabled={disabled}
                                                        onClick={() => toggleMember(member)}
                                                    >
                                                        <div className="registration-member-check">
                                                            {checked ? <Check size={13} /> : null}
                                                        </div>

                                                        <div className="registration-mini-avatar">
                                                            {avatarText(member.name)}
                                                        </div>

                                                        <div className="registration-member-copy">
                                                            <strong>{member.name}</strong>
                                                            <span>
                                                                {isCaptainMember
                                                                    ? "CAPTAIN · YOU"
                                                                    : member.uid || member.role || "MEMBER"}
                                                            </span>
                                                            {member.unavailableReason && (
                                                                <small>{member.unavailableReason}</small>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="registration-selection-status">
                                            <span>{selectedMemberCount}/{teamSize} selected</span>
                                            <strong>
                                                {selectedEligible
                                                    ? "Ready to send invitations"
                                                    : `Select ${teamSize - selectedMemberCount} more eligible player${teamSize - selectedMemberCount === 1 ? "" : "s"}`}
                                            </strong>
                                        </div>
                                    </section>
                                )}

                                {currentRegistration && (
                                    <section className="registration-section-block">
                                        <div className="registration-team-header">
                                            <div className="registration-team-identity">
                                                <div className="registration-club-avatar large">
                                                    {avatarText(currentRegistration.club?.name || selectedClub?.name)}
                                                </div>
                                                <div>
                                                    <span>CLUB REPRESENTATION</span>
                                                    <h3>{currentRegistration.club?.name || selectedClub?.name || "Tournament Team"}</h3>
                                                    <p>{teamStatusDescription(currentStatus)}</p>
                                                </div>
                                            </div>

                                            <div className={`registration-status-badge ${statusClass(currentStatus)}`}>
                                                {currentStatus === "LOCKED" ? <LockKeyhole size={13} /> : <CircleDot size={13} />}
                                                {statusLabel(currentStatus)}
                                            </div>
                                        </div>

                                        <div className="registration-progress-strip">
                                            <div>
                                                <span>ROSTER</span>
                                                <strong>{acceptedRoster.length} / {teamSize} accepted</strong>
                                            </div>
                                            <div>
                                                <span>CAPTAIN</span>
                                                <strong>{userDisplayName(currentRegistration.user)}</strong>
                                            </div>
                                            <div>
                                                <span>REGISTERED</span>
                                                <strong>{formatDate(currentRegistration.registeredAt)}</strong>
                                            </div>
                                        </div>

                                        <div className="registration-roster-card">
                                            {currentRoster.map((member) => {
                                                const memberStatus = String(member.status || "ACCEPTED").toUpperCase();
                                                const isCaptainMember = String(member.role || "").toUpperCase() === "CAPTAIN";
                                                const replaceable = canModifyPreDeadline && !isCaptainMember && ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"].includes(memberStatus);

                                                return (
                                                    <div className="registration-roster-member" key={`${member.userId}-${member.rosterOrder}`}>
                                                        <div className="registration-mini-avatar">
                                                            {avatarText(member.name)}
                                                        </div>

                                                        <div className="registration-roster-member-copy">
                                                            <strong>{member.name}</strong>
                                                            <span>
                                                                {isCaptainMember
                                                                    ? "CAPTAIN"
                                                                    : member.uid || member.role || "MEMBER"}
                                                            </span>
                                                        </div>

                                                        <div className={`registration-member-state ${statusClass(memberStatus)}`}>
                                                            {memberStatus === "ACCEPTED" && <UserCheck size={13} />}
                                                            {memberStatus === "PENDING" && <Clock3 size={13} />}
                                                            {memberStatus === "DECLINED" && <UserX size={13} />}
                                                            {memberStatus === "EXPIRED" && <TimerReset size={13} />}
                                                            {statusLabel(memberStatus)}
                                                        </div>

                                                        {replaceable && (
                                                            <button
                                                                type="button"
                                                                className="registration-text-button"
                                                                onClick={() => openReplaceModal(member.userId)}
                                                            >
                                                                Replace
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {pendingRoster.length > 0 && (
                                            <div className="registration-pending-box">
                                                <div className="registration-pending-box-heading">
                                                    <Clock3 size={15} />
                                                    <strong>Waiting for player responses</strong>
                                                </div>
                                                {pendingRoster.map((member) => {
                                                    const matchingInvite = myInvites.find(
                                                        (invite) =>
                                                            Number(invite.invitedUserId) === Number(member.userId)
                                                    );

                                                    const expiry =
                                                        matchingInvite?.expiresAt ||
                                                        member.inviteExpiresAt;

                                                    const inviteStatus = String(
                                                        matchingInvite?.status ||
                                                        member.inviteStatus ||
                                                        "PENDING"
                                                    ).toUpperCase();

                                                    return (
                                                        <div className="registration-pending-row" key={member.userId}>
                                                            <span>{member.name}</span>
                                                            <strong>
                                                                {inviteStatus === "PENDING"
                                                                    ? formatRemaining(expiry, nowTick) || "Invitation sent"
                                                                    : statusLabel(inviteStatus)}
                                                            </strong>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {canModifyPreDeadline && (
                                            <div className="registration-entry-actions">
                                                <div>
                                                    <span>BEFORE DEADLINE</span>
                                                    <strong>Replace a rostered player without losing the team slot.</strong>
                                                </div>
                                                {canWithdraw && (
                                                    <button
                                                        type="button"
                                                        className="registration-danger-outline"
                                                        onClick={() => setShowWithdrawConfirm(true)}
                                                    >
                                                        Withdraw Registration
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {currentStatus === "LOCKED" && (
                                            <div className="registration-lock-panel">
                                                <div className="registration-lock-panel-icon">
                                                    <LockKeyhole size={17} />
                                                </div>
                                                <div>
                                                    <span>ROSTER LOCKED</span>
                                                    <strong>Changes now require host approval.</strong>
                                                    <p>
                                                        Substitution requests close {registrationSettings.substitutionCloseMinutes || 60} minutes before the next match. Team limit: {registrationSettings.maxSubstitutions ?? 1}.
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="registration-submit small"
                                                    disabled={!!currentSubstitutionRequest}
                                                    onClick={openSubstitutionModal}
                                                >
                                                    <RotateCcw size={15} />
                                                    {currentSubstitutionRequest ? "Request Pending" : "Request Substitution"}
                                                </button>
                                            </div>
                                        )}

                                        {substitutionRequests.length > 0 && (
                                            <div className="registration-substitution-list">
                                                <div className="registration-section-heading">
                                                    <div>
                                                        <span>SUBSTITUTION HISTORY</span>
                                                        <h3>Host decisions</h3>
                                                    </div>
                                                </div>

                                                {substitutionRequests.map((request) => (
                                                    <div className="registration-substitution-row" key={request.id}>
                                                        <div>
                                                            <strong>
                                                                {request.outgoingUser?.name || "Player"} → {request.replacementUser?.name || "Replacement"}
                                                            </strong>
                                                            <span>{request.reason}</span>
                                                        </div>
                                                        <div className={`registration-status-badge ${statusClass(request.status)}`}>
                                                            {statusLabel(request.status)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}
                            </>
                        ) : (
                            <section className="registration-section-block">
                                <div className="registration-player-confirm">
                                    <div className="registration-confirm-icon">
                                        <ShieldCheck size={22} />
                                    </div>
                                    <div>
                                        <span>SOLO ENTRY</span>
                                        <strong>
                                            {data?.currentUserGameLinked
                                                ? "Your game profile is eligible."
                                                : "Your game profile is not linked yet."}
                                        </strong>
                                        <p>
                                            {data?.currentUserGameLinked
                                                ? `You can register directly for ${getGameName(competition)}.`
                                                : `Link ${getGameName(competition)} in your profile first.`}
                                        </p>
                                    </div>
                                </div>

                                {currentRegistration && (
                                    <div className="registration-current-state">
                                        <div>
                                            <span>CURRENT REGISTRATION</span>
                                            <strong>{statusLabel(currentStatus)}</strong>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/competitions/${competitionId}`)}
                                        >
                                            View Tournament
                                            <ChevronRight size={15} />
                                        </button>
                                    </div>
                                )}
                            </section>
                        )}

                        {!currentRegistration && (
                            <button
                                type="button"
                                className="registration-submit"
                                onClick={handleRegister}
                                disabled={
                                    submitting ||
                                    !data?.registrationOpen ||
                                    !!data?.full ||
                                    !data?.currentUserGameLinked ||
                                    (isTeamCompetition && !selectedEligible)
                                }
                            >
                                {submitting ? (
                                    <Loader2 size={17} className="registration-spin" />
                                ) : (
                                    isTeamCompetition ? <Send size={17} /> : <Trophy size={17} />
                                )}
                                {submitting
                                    ? "Submitting..."
                                    : isTeamCompetition
                                        ? "Start Team Registration"
                                        : "Register for Tournament"}
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
                                <span>Registration deadline</span>
                                <strong>{formatDate(competition.registrationEnd)}</strong>
                            </div>

                            <div className="registration-time-row">
                                <span>Competition starts</span>
                                <strong>{formatDate(competition.competitionStart)}</strong>
                            </div>

                            <div className="registration-time-row">
                                <span>Competition ends</span>
                                <strong>{formatDate(competition.competitionEnd)}</strong>
                            </div>
                        </section>

                        <section className="registration-side-card">
                            <div className="registration-side-heading">
                                <ShieldCheck size={17} />
                                <span>REGISTRATION RULES</span>
                            </div>

                            <div className="registration-rule-list">
                                <div><Check size={13} /><span>Anyone can start a registration while the competition is open.</span></div>
                                <div><Check size={13} /><span>Team registration requires membership in the selected club.</span></div>
                                <div><Check size={13} /><span>Every selected teammate must have this game linked to their profile.</span></div>
                                <div><Check size={13} /><span>Accepted invites reserve that player's place for this competition.</span></div>
                                <div><Check size={13} /><span>Rosters lock at the registration deadline.</span></div>
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

                        {isTeamCompetition && (
                            <section className="registration-side-card">
                                <div className="registration-side-heading">
                                    <CalendarClock size={17} />
                                    <span>TEAM INVITE POLICY</span>
                                </div>

                                <div className="registration-policy-grid">
                                    <div>
                                        <strong>{registrationSettings.inviteDurationHours || 5}h</strong>
                                        <span>invite window</span>
                                    </div>
                                    <div>
                                        <strong>2</strong>
                                        <span>reminders</span>
                                    </div>
                                    <div>
                                        <strong>{registrationSettings.maxSubstitutions ?? 1}</strong>
                                        <span>substitutions</span>
                                    </div>
                                    <div>
                                        <strong>{registrationSettings.substitutionCloseMinutes || 60}m</strong>
                                        <span>match cutoff</span>
                                    </div>
                                </div>
                            </section>
                        )}
                    </aside>
                </div>
            </main>

            {showWithdrawConfirm && (
                <div className="registration-modal-backdrop" role="presentation">
                    <div className="registration-modal" role="dialog" aria-modal="true">
                        <div className="registration-modal-top">
                            <div>
                                <span>WITHDRAW REGISTRATION</span>
                                <h3>Leave this tournament?</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWithdrawConfirm(false)}
                                className="registration-modal-close"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <p>
                            Your active team entry will be cancelled and pending invitations will be closed. You can register again while registration remains open.
                        </p>

                        <div className="registration-modal-actions">
                            <button
                                type="button"
                                className="registration-secondary-mini"
                                disabled={actionLoading}
                                onClick={() => setShowWithdrawConfirm(false)}
                            >
                                Keep Registration
                            </button>
                            <button
                                type="button"
                                className="registration-danger-button"
                                disabled={actionLoading}
                                onClick={handleWithdraw}
                            >
                                {actionLoading ? <Loader2 size={15} className="registration-spin" /> : <UserX size={15} />}
                                Withdraw
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReplace && (
                <div className="registration-modal-backdrop" role="presentation">
                    <div className="registration-modal wide" role="dialog" aria-modal="true">
                        <div className="registration-modal-top">
                            <div>
                                <span>PRE-DEADLINE REPLACEMENT</span>
                                <h3>Choose a replacement</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowReplace(false)}
                                className="registration-modal-close"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <p>
                            The current player remains on your roster until the new player accepts. If the new invitation is declined or expires, nothing changes.
                        </p>

                        <div className="registration-replace-target">
                            <span>PLAYER TO REPLACE</span>
                            <strong>
                                {currentRoster.find((member) => Number(member.userId) === Number(replaceTargetId))?.name || "Selected player"}
                            </strong>
                        </div>

                        <div className="registration-modal-list">
                            {replacementCandidates.length ? (
                                replacementCandidates.map((member) => {
                                    const selected = Number(replacementUserId) === Number(member.userId);
                                    return (
                                        <button
                                            type="button"
                                            key={member.id}
                                            className={`registration-modal-player ${selected ? "selected" : ""}`}
                                            onClick={() => setReplacementUserId(Number(member.userId))}
                                        >
                                            <div className="registration-mini-avatar">
                                                {avatarText(member.name)}
                                            </div>
                                            <div>
                                                <strong>{member.name}</strong>
                                                <span>{member.uid || member.role || "MEMBER"}</span>
                                            </div>
                                            {selected && <Check size={16} />}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="registration-empty compact">
                                    <UserX size={20} />
                                    <strong>No eligible replacement players</strong>
                                    <p>
                                        Every other club member is either already on this roster, missing the game profile link, or committed elsewhere in this competition.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="registration-modal-actions">
                            <button
                                type="button"
                                className="registration-secondary-mini"
                                disabled={actionLoading}
                                onClick={() => setShowReplace(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="registration-primary-mini"
                                disabled={actionLoading || !replacementUserId}
                                onClick={handleReplacement}
                            >
                                {actionLoading ? <Loader2 size={15} className="registration-spin" /> : <Send size={15} />}
                                Send Replacement Invite
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSubstitution && (
                <div className="registration-modal-backdrop" role="presentation">
                    <div className="registration-modal wide" role="dialog" aria-modal="true">
                        <div className="registration-modal-top">
                            <div>
                                <span>HOST-APPROVED SUBSTITUTION</span>
                                <h3>Request a roster swap</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSubstitution(false)}
                                className="registration-modal-close"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <p>
                            Your current roster stays unchanged until the host approves the request and the replacement player accepts the resulting invitation.
                        </p>

                        <div className="registration-form-grid">
                            <label>
                                <span>PLAYER TO REMOVE</span>
                                <select
                                    value={substitutionOutgoingId || ""}
                                    onChange={(event) => setSubstitutionOutgoingId(Number(event.target.value) || null)}
                                >
                                    <option value="">Select player</option>
                                    {acceptedRoster
                                        .filter((member) => String(member.role || "").toUpperCase() !== "CAPTAIN")
                                        .map((member) => (
                                            <option key={member.userId} value={member.userId}>
                                                {member.name}
                                            </option>
                                        ))}
                                </select>
                            </label>

                            <label>
                                <span>REPLACEMENT</span>
                                <select
                                    value={substitutionReplacementId || ""}
                                    onChange={(event) => setSubstitutionReplacementId(Number(event.target.value) || null)}
                                >
                                    <option value="">Select player</option>
                                    {substitutionCandidates.map((member) => (
                                        <option key={member.userId} value={member.userId}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="registration-textarea-field">
                            <span>REASON</span>
                            <textarea
                                value={substitutionReason}
                                onChange={(event) => setSubstitutionReason(event.target.value)}
                                maxLength={1000}
                                placeholder="Explain why the substitution is required."
                            />
                            <small>{substitutionReason.length}/1000</small>
                        </label>

                        <div className="registration-substitution-note">
                            <LockKeyhole size={15} />
                            <span>
                                Requests close {registrationSettings.substitutionCloseMinutes || 60} minutes before the next scheduled match. No host response by the approval deadline counts as rejected.
                            </span>
                        </div>

                        <div className="registration-modal-actions">
                            <button
                                type="button"
                                className="registration-secondary-mini"
                                disabled={actionLoading}
                                onClick={() => setShowSubstitution(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="registration-primary-mini"
                                disabled={actionLoading || !!currentSubstitutionRequest}
                                onClick={handleSubstitutionRequest}
                            >
                                {actionLoading ? <Loader2 size={15} className="registration-spin" /> : <Send size={15} />}
                                Send to Host
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
