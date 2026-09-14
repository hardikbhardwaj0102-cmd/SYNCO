import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
    ArrowLeft,
    Shield,
    Users,
    Lock,
    Globe,
    UserPlus,
    Mail,
    MoreVertical,
    Crown,
    UserMinus,
    X,
    Search,
    Check,
    Send,
    Trophy,
    BarChart3,
    Target,
    UserRoundPlus,
    LogOut,
    Settings,
    Gamepad2,
    CalendarDays,
    Clock3,
    Swords,
    Award,
    ChevronRight,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const ClubProfile = () => {
    const navigate = useNavigate();
    const { clubId } = useParams();

    // =========================================================
    // STATE
    // =========================================================

    const [club, setClub] = useState(null);
    const [members, setMembers] = useState([]);

    const [loading, setLoading] = useState(true);
    const [membersLoading, setMembersLoading] = useState(true);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [activeTab, setActiveTab] = useState('overview');

    const [showMemberModal, setShowMemberModal] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const [actionLoading, setActionLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(null);

    const [incomingInvites, setIncomingInvites] = useState([]);
    const [invitesLoading, setInvitesLoading] = useState(false);

    const [showSettings, setShowSettings] = useState(false);

    // =========================================================
    // HELPERS
    // =========================================================

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };

    const showSuccess = (message) => {
        setError('');
        setSuccess(message);

        setTimeout(() => {
            setSuccess('');
        }, 3500);
    };

    const showError = (message) => {
        setSuccess('');
        setError(message);

        setTimeout(() => {
            setError('');
        }, 5000);
    };

    const getUserName = (user) => {
        if (!user) return 'Unknown Player';

        return (
            user.username ||
            user.name ||
            user.displayName ||
            'Unknown Player'
        );
    };

    const getUserInitials = (user) => {
        const name = getUserName(user);

        return name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    };

    const getAvatar = (user) => {
        return (
            user?.avatar ||
            user?.avatarUrl ||
            user?.avatar_url ||
            null
        );
    };

    const formatDate = (date) => {
        if (!date) return 'Unknown';

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return 'Unknown';
        }

        return parsed.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatRole = (role) => {
        if (!role) return 'Member';

        return (
            role.charAt(0) +
            role.slice(1).toLowerCase()
        );
    };

    // =========================================================
    // LOAD CLUB
    // =========================================================

    const loadClub = async () => {
        try {
            setLoading(true);

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}`,
                {
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to load club.'
                );
            }

            setClub(data.club);
        } catch (err) {
            console.error('Club load error:', err);

            setClub(null);

            showError(
                err.message || 'Unable to load club.'
            );
        } finally {
            setLoading(false);
        }
    };

    // =========================================================
    // LOAD MEMBERS
    // =========================================================

    const loadMembers = async () => {
        try {
            setMembersLoading(true);

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}/members`,
                {
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to load members.'
                );
            }

            setMembers(data.members || []);
        } catch (err) {
            console.error(
                'Members load error:',
                err
            );

            setMembers([]);

            showError(
                err.message ||
                'Unable to load members.'
            );
        } finally {
            setMembersLoading(false);
        }
    };

    // =========================================================
    // LOAD MY INVITES
    // =========================================================

    const loadIncomingInvites = async () => {
        try {
            setInvitesLoading(true);

            const response = await fetch(
                `${API_URL}/api/clubs/invites/mine`,
                {
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                return;
            }

            setIncomingInvites(data.invites || []);
        } catch (err) {
            console.error(
                'Incoming invite error:',
                err
            );
        } finally {
            setInvitesLoading(false);
        }
    };

    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {
        if (!clubId) return;

        loadClub();
        loadMembers();
        loadIncomingInvites();
    }, [clubId]);

    // =========================================================
    // SEARCH USERS
    // USERNAME OR UID ONLY
    // =========================================================

    useEffect(() => {
        if (!showMemberModal) return;

        const query = searchQuery.trim();

        if (!query) {
            setUsers([]);
            setSearchingUsers(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSearchingUsers(true);

                const response = await fetch(
                    `${API_URL}/api/clubs/users/search?q=${encodeURIComponent(
                        query
                    )}&clubId=${clubId}`,
                    {
                        credentials: 'include',
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        'Unable to search players.'
                    );
                }

                setUsers(data.users || []);
            } catch (err) {
                console.error(
                    'Player search error:',
                    err
                );

                setUsers([]);
            } finally {
                setSearchingUsers(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [
        searchQuery,
        showMemberModal,
        clubId,
    ]);

    // =========================================================
    // USER PERMISSIONS
    // =========================================================

    const currentUser = club?.currentUser || null;

    const isMember = Boolean(currentUser);

    const canManage = Boolean(club?.canManage);

    const isOwner =
        currentUser?.role === 'OWNER';

    const isAdmin =
        currentUser?.role === 'ADMIN';

    // =========================================================
    // MEMBER STATS
    // =========================================================

    const ownerCount = useMemo(() => {
        return members.filter(
            (member) => member.role === 'OWNER'
        ).length;
    }, [members]);

    const adminCount = useMemo(() => {
        return members.filter(
            (member) => member.role === 'ADMIN'
        ).length;
    }, [members]);

    // =========================================================
    // INVITE MODAL
    // =========================================================

    const openInviteModal = () => {
        clearMessages();

        setSearchQuery('');
        setUsers([]);

        setShowMemberModal(true);
    };

    const closeMemberModal = () => {
        if (actionLoading) return;

        setShowMemberModal(false);
        setSearchQuery('');
        setUsers([]);
    };

    // =========================================================
    // SEND INVITE
    // =========================================================

    const sendInvite = async (userId) => {
        if (!userId) return;

        try {
            setActionLoading(true);
            clearMessages();

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}/invites`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        inviteeId: userId,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to send invite.'
                );
            }

            showSuccess(
                'Invitation sent successfully.'
            );

            setSearchQuery('');
            setUsers([]);

            await loadClub();
        } catch (err) {
            console.error(
                'Invite error:',
                err
            );

            showError(
                err.message ||
                'Unable to send invitation.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // JOIN CLUB
    // =========================================================

    const joinClub = async () => {
        try {
            setActionLoading(true);
            clearMessages();

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}/join`,
                {
                    method: 'POST',
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to join club.'
                );
            }

            showSuccess(
                'You joined the club.'
            );

            await loadClub();
            await loadMembers();
        } catch (err) {
            console.error(
                'Join club error:',
                err
            );

            showError(
                err.message ||
                'Unable to join club.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // LEAVE CLUB
    // =========================================================

    const leaveClub = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to leave this club?'
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            clearMessages();

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}/leave`,
                {
                    method: 'POST',
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to leave club.'
                );
            }

            showSuccess(
                'You left the club.'
            );

            await loadClub();
            await loadMembers();
        } catch (err) {
            console.error(
                'Leave club error:',
                err
            );

            showError(
                err.message ||
                'Unable to leave club.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // REMOVE MEMBER
    // =========================================================

    const removeMember = async (member) => {
        if (!member?.userId) return;

        const name = getUserName(member.user);

        const confirmed = window.confirm(
            `Remove ${name} from this club?`
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            clearMessages();
            setMenuOpen(null);

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}/members/${member.userId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to remove member.'
                );
            }

            showSuccess(
                `${name} was removed from the club.`
            );

            await loadMembers();
            await loadClub();
        } catch (err) {
            console.error(
                'Remove member error:',
                err
            );

            showError(
                err.message ||
                'Unable to remove member.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // CHANGE ROLE
    // =========================================================

    const changeRole = async (
        member,
        role
    ) => {
        if (!member?.userId) return;

        try {
            setActionLoading(true);
            clearMessages();
            setMenuOpen(null);

            const response = await fetch(
                `${API_URL}/api/clubs/${clubId}/members/${member.userId}`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        role,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to change role.'
                );
            }

            showSuccess(
                role === 'ADMIN'
                    ? 'Member promoted to admin.'
                    : 'Admin role removed.'
            );

            await loadMembers();
            await loadClub();
        } catch (err) {
            console.error(
                'Role update error:',
                err
            );

            showError(
                err.message ||
                'Unable to change member role.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // ACCEPT INVITE
    // =========================================================

    const acceptInvite = async (invite) => {
        const inviteId = invite?.id;

        if (!inviteId) {
            return;
        }

        try {
            setActionLoading(true);
            clearMessages();

            const response = await fetch(
                `${API_URL}/api/clubs/invites/${inviteId}/accept`,
                {
                    method: 'POST',
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to accept invite.'
                );
            }

            showSuccess(
                'Club invitation accepted.'
            );

            await loadIncomingInvites();

            const targetClubId =
                invite?.club?.id;

            if (
                String(targetClubId) ===
                String(clubId)
            ) {
                await loadClub();
                await loadMembers();
            }
        } catch (err) {
            console.error(
                'Accept invite error:',
                err
            );

            showError(
                err.message ||
                'Unable to accept invitation.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // DECLINE INVITE
    // =========================================================

    const declineInvite = async (invite) => {
        const inviteId = invite?.id;

        if (!inviteId) {
            return;
        }

        try {
            setActionLoading(true);
            clearMessages();

            const response = await fetch(
                `${API_URL}/api/clubs/invites/${inviteId}/decline`,
                {
                    method: 'POST',
                    credentials: 'include',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    'Unable to decline invite.'
                );
            }

            showSuccess(
                'Invitation declined.'
            );

            await loadIncomingInvites();
        } catch (err) {
            console.error(
                'Decline invite error:',
                err
            );

            showError(
                err.message ||
                'Unable to decline invitation.'
            );
        } finally {
            setActionLoading(false);
        }
    };

    // =========================================================
    // TABS
    // =========================================================

    const tabs = [
        {
            id: 'overview',
            label: 'Overview',
            icon: BarChart3,
        },
        {
            id: 'members',
            label: 'Members',
            icon: Users,
        },
        {
            id: 'recruitment',
            label: 'Recruitment',
            icon: UserRoundPlus,
        },
        {
            id: 'tournaments',
            label: 'Tournaments',
            icon: Trophy,
        },
        {
            id: 'stats',
            label: 'Stats',
            icon: Target,
        },
    ];

    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-white text-black">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />

                        <p className="text-sm text-gray-500">
                            Loading club...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================
    // NOT FOUND
    // =========================================================

    if (!club) {
        return (
            <div className="min-h-screen bg-white px-6 text-black">
                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center">
                    <div className="w-full rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">

                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white">
                            <Shield size={30} />
                        </div>

                        <h2 className="text-2xl font-semibold tracking-tight">
                            Club not found
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                            This club may have been removed
                            or is no longer available.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                navigate('/clubs')
                            }
                            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
                        >
                            <ArrowLeft size={16} />
                            Back to Clubs
                        </button>

                    </div>
                </div>
            </div>
        );
    }

    // =========================================================
    // MAIN
    // =========================================================

    return (
        <div
            className="min-h-screen bg-white text-black"
            onClick={() => setMenuOpen(null)}
        >

            {/* =================================================
                TOP BAR
            ================================================= */}

            <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">

                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

                    <button
                        type="button"
                        onClick={() =>
                            navigate('/clubs')
                        }
                        className="group flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-black"
                    >
                        <ArrowLeft
                            size={17}
                            className="transition-transform group-hover:-translate-x-0.5"
                        />
                        Clubs
                    </button>

                    <div className="flex items-center gap-2">

                        {incomingInvites.length > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        'overview'
                                    )
                                }
                                className="hidden items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:flex"
                            >
                                <Mail size={15} />

                                Invitations

                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[10px] text-white">
                                    {
                                        incomingInvites.length
                                    }
                                </span>
                            </button>
                        )}

                        {isMember && canManage && (
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();

                                    setShowSettings(
                                        (prev) => !prev
                                    );
                                }}
                                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                            >
                                <Settings size={15} />

                                <span className="hidden sm:inline">
                                    Manage
                                </span>
                            </button>
                        )}

                    </div>

                </div>
            </div>

            {/* =================================================
                ALERTS
            ================================================= */}

            {(error || success) && (
                <div className="fixed left-1/2 top-20 z-50 w-[calc(100%-32px)] max-w-lg -translate-x-1/2">

                    {error && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-lg">

                            <X
                                size={17}
                                className="mt-0.5 shrink-0"
                            />

                            <span>{error}</span>

                        </div>
                    )}

                    {success && (
                        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-green-700 shadow-lg">

                            <Check
                                size={17}
                                className="mt-0.5 shrink-0"
                            />

                            <span>{success}</span>

                        </div>
                    )}

                </div>
            )}

            {/* =================================================
                HERO
            ================================================= */}

            <section className="relative overflow-hidden border-b border-gray-200 bg-gray-50">

                <div className="pointer-events-none absolute inset-0 opacity-[0.035]">

                    <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[70px] border-black" />

                    <div className="absolute -bottom-32 -left-24 h-80 w-80 rotate-45 border border-black" />

                </div>

                <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:px-8 lg:py-14">

                    <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center">

                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-sm sm:h-28 sm:w-28">
                            <Shield
                                size={48}
                                strokeWidth={1.5}
                            />
                        </div>

                        <div className="min-w-0">

                            <div className="mb-2 flex flex-wrap items-center gap-2">

                                <span className="rounded-md bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                                    Club
                                </span>

                                {club.isActive && (
                                    <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-gray-500">
                                        Active
                                    </span>
                                )}

                            </div>

                            <div className="flex flex-wrap items-center gap-3">

                                <h1 className="truncate text-3xl font-bold tracking-tight sm:text-4xl">
                                    {club.name}
                                </h1>

                                <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">
                                    #{club.tag}
                                </span>

                            </div>

                            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">

                                <span className="flex items-center gap-1.5">
                                    <Gamepad2 size={14} />

                                    {club.game?.name ||
                                        'Gaming'}
                                </span>

                                <span className="flex items-center gap-1.5">

                                    {club.privacy ===
                                        'Private' ? (
                                        <Lock size={14} />
                                    ) : (
                                        <Globe size={14} />
                                    )}

                                    {club.privacy}

                                </span>

                                <span className="flex items-center gap-1.5">
                                    <Users size={14} />

                                    {club.memberCount ??
                                        members.length}{' '}
                                    Members
                                </span>

                                <span className="flex items-center gap-1.5">
                                    <CalendarDays size={14} />

                                    Since{' '}

                                    {formatDate(
                                        club.createdAt
                                    )}
                                </span>

                            </div>

                            {club.description && (
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600">
                                    {club.description}
                                </p>
                            )}

                        </div>

                    </div>

                    {/* ACTIONS */}

                    <div className="flex shrink-0 flex-wrap gap-2">

                        {!isMember && (
                            <button
                                type="button"
                                onClick={joinClub}
                                disabled={
                                    actionLoading
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <UserPlus size={17} />

                                {actionLoading
                                    ? 'Joining...'
                                    : 'Join Club'}
                            </button>
                        )}

                        {isMember &&
                            !canManage && (
                                <button
                                    type="button"
                                    onClick={
                                        leaveClub
                                    }
                                    disabled={
                                        actionLoading
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                >
                                    <LogOut size={16} />
                                    Leave Club
                                </button>
                            )}

                        {canManage && (
                            <button
                                type="button"
                                onClick={
                                    openInviteModal
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                <Send size={16} />
                                Invite Player
                            </button>
                        )}

                    </div>

                </div>
            </section>

            {/* =================================================
                TABS
            ================================================= */}

            <div className="sticky top-16 z-30 border-b border-gray-200 bg-white">

                <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">

                    <div className="flex min-w-max">

                        {tabs.map((tab) => {
                            const Icon = tab.icon;

                            const active =
                                activeTab ===
                                tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() =>
                                        setActiveTab(
                                            tab.id
                                        )
                                    }
                                    className={`relative flex items-center gap-2 px-4 py-4 text-sm font-medium transition ${active
                                        ? 'text-black'
                                        : 'text-gray-500 hover:text-black'
                                        }`}
                                >
                                    <Icon size={16} />

                                    {tab.label}

                                    {active && (
                                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-black" />
                                    )}
                                </button>
                            );
                        })}

                    </div>

                </div>
            </div>

            {/* =================================================
                CONTENT
            ================================================= */}

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">

                {/* =================================================
                    OVERVIEW
                ================================================= */}

                {activeTab ===
                    'overview' && (
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

                            <div className="space-y-6">

                                {/* ABOUT */}

                                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <div className="mb-6 flex items-start justify-between">

                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                                Club
                                            </p>

                                            <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                                About the Club
                                            </h2>
                                        </div>

                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
                                            <Shield size={18} />
                                        </div>

                                    </div>

                                    <p className="max-w-3xl text-sm leading-7 text-gray-600">
                                        {club.description ||
                                            'This club has not added a description yet.'}
                                    </p>

                                </section>

                                {/* MEMBER PREVIEW */}

                                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <div className="mb-6 flex items-center justify-between">

                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                                Community
                                            </p>

                                            <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                                Members
                                            </h2>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setActiveTab(
                                                    'members'
                                                )
                                            }
                                            className="flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-black"
                                        >
                                            View all
                                            <ChevronRight
                                                size={14}
                                            />
                                        </button>

                                    </div>

                                    {membersLoading ? (
                                        <div className="flex h-24 items-center justify-center text-sm text-gray-400">
                                            Loading members...
                                        </div>
                                    ) : members.length ===
                                        0 ? (
                                        <div className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center">

                                            <Users
                                                size={28}
                                                className="mx-auto text-gray-300"
                                            />

                                            <p className="mt-3 text-sm text-gray-500">
                                                No members found.
                                            </p>

                                        </div>
                                    ) : (
                                        <div className="grid gap-2 sm:grid-cols-2">

                                            {members
                                                .slice(0, 6)
                                                .map(
                                                    (
                                                        member
                                                    ) => {
                                                        const user =
                                                            member.user;

                                                        const avatar =
                                                            getAvatar(
                                                                user
                                                            );

                                                        return (
                                                            <button
                                                                key={
                                                                    member.id
                                                                }
                                                                type="button"
                                                                onClick={() => {
                                                                    if (
                                                                        user?.id
                                                                    ) {
                                                                        navigate(
                                                                            `/profile/${user.id}`
                                                                        );
                                                                    }
                                                                }}
                                                                className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition hover:border-gray-200 hover:bg-gray-50"
                                                            >

                                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-xs font-semibold text-white">

                                                                    {avatar ? (
                                                                        <img
                                                                            src={
                                                                                avatar
                                                                            }
                                                                            alt=""
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        getUserInitials(
                                                                            user
                                                                        )
                                                                    )}

                                                                </div>

                                                                <div className="min-w-0">

                                                                    <p className="truncate text-sm font-semibold text-gray-900">
                                                                        {getUserName(
                                                                            user
                                                                        )}
                                                                    </p>

                                                                    <p className="mt-0.5 text-xs text-gray-500">
                                                                        {formatRole(
                                                                            member.role
                                                                        )}
                                                                    </p>

                                                                </div>

                                                            </button>
                                                        );
                                                    }
                                                )}

                                        </div>
                                    )}

                                </section>

                                {/* INVITATIONS */}

                                {incomingInvites.length >
                                    0 && (
                                        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                            <div className="mb-6 flex items-center justify-between">

                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                                        Invitations
                                                    </p>

                                                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                                        Club Invitations
                                                    </h2>
                                                </div>

                                                <Mail
                                                    size={20}
                                                    className="text-gray-400"
                                                />

                                            </div>

                                            <div className="space-y-3">

                                                {incomingInvites.map(
                                                    (
                                                        invite
                                                    ) => (
                                                        <div
                                                            key={
                                                                invite.id
                                                            }
                                                            className="flex flex-col gap-4 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                                                        >

                                                            <div className="flex items-center gap-3">

                                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                                                                    <Shield
                                                                        size={
                                                                            19
                                                                        }
                                                                    />
                                                                </div>

                                                                <div>

                                                                    <p className="text-sm font-semibold">
                                                                        {
                                                                            invite
                                                                                .club
                                                                                ?.name
                                                                        }
                                                                    </p>

                                                                    <p className="mt-1 text-xs text-gray-500">
                                                                        Invited by{' '}
                                                                        {getUserName(
                                                                            invite.inviter
                                                                        )}
                                                                    </p>

                                                                </div>

                                                            </div>

                                                            <div className="flex gap-2">

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        acceptInvite(
                                                                            invite
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        actionLoading
                                                                    }
                                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                                                                >
                                                                    <Check
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                    Accept
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        declineInvite(
                                                                            invite
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        actionLoading
                                                                    }
                                                                    className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                                                                >
                                                                    Decline
                                                                </button>

                                                            </div>

                                                        </div>
                                                    )
                                                )}

                                            </div>

                                        </section>
                                    )}

                                {/* ACTIVITY */}

                                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <div className="mb-6 flex items-center justify-between">

                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                                Activity
                                            </p>

                                            <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                                Recent Activity
                                            </h2>
                                        </div>

                                        <Clock3
                                            size={20}
                                            className="text-gray-400"
                                        />

                                    </div>

                                    <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">

                                        <Swords
                                            size={32}
                                            className="mx-auto text-gray-300"
                                        />

                                        <h3 className="mt-4 text-sm font-semibold">
                                            No activity yet
                                        </h3>

                                        <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-gray-500">
                                            Matches, tournaments
                                            and club activity
                                            will appear here
                                            once those systems
                                            are connected.
                                        </p>

                                    </div>

                                </section>

                            </div>

                            {/* SIDEBAR */}

                            <aside className="space-y-6">

                                {/* INFO */}

                                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <div className="mb-5">

                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                            Details
                                        </p>

                                        <h2 className="mt-1 text-lg font-semibold tracking-tight">
                                            Club Information
                                        </h2>

                                    </div>

                                    <div className="space-y-4">

                                        <div className="flex items-center justify-between gap-4">

                                            <span className="flex items-center gap-2 text-xs text-gray-500">
                                                <Gamepad2 size={15} />
                                                Game
                                            </span>

                                            <strong className="text-right text-xs font-semibold text-gray-900">
                                                {club.game
                                                    ?.name ||
                                                    'Not specified'}
                                            </strong>

                                        </div>

                                        <div className="h-px bg-gray-100" />

                                        <div className="flex items-center justify-between gap-4">

                                            <span className="flex items-center gap-2 text-xs text-gray-500">

                                                {club.privacy ===
                                                    'Private' ? (
                                                    <Lock size={15} />
                                                ) : (
                                                    <Globe size={15} />
                                                )}

                                                Privacy
                                            </span>

                                            <strong className="text-xs font-semibold text-gray-900">
                                                {club.privacy}
                                            </strong>

                                        </div>

                                        <div className="h-px bg-gray-100" />

                                        <div className="flex items-center justify-between gap-4">

                                            <span className="flex items-center gap-2 text-xs text-gray-500">
                                                <Users size={15} />
                                                Members
                                            </span>

                                            <strong className="text-xs font-semibold text-gray-900">
                                                {club.memberCount ??
                                                    members.length}
                                            </strong>

                                        </div>

                                        <div className="h-px bg-gray-100" />

                                        <div className="flex items-center justify-between gap-4">

                                            <span className="flex items-center gap-2 text-xs text-gray-500">
                                                <CalendarDays
                                                    size={15}
                                                />
                                                Created
                                            </span>

                                            <strong className="text-right text-xs font-semibold text-gray-900">
                                                {formatDate(
                                                    club.createdAt
                                                )}
                                            </strong>

                                        </div>

                                    </div>

                                </section>

                                {/* STATS */}

                                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <div className="mb-5">

                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                            Community
                                        </p>

                                        <h2 className="mt-1 text-lg font-semibold tracking-tight">
                                            Club Stats
                                        </h2>

                                    </div>

                                    <div className="grid grid-cols-2 gap-2">

                                        <div className="rounded-xl bg-gray-50 p-4">

                                            <Users
                                                size={16}
                                                className="text-gray-400"
                                            />

                                            <p className="mt-3 text-2xl font-bold tracking-tight">
                                                {members.length}
                                            </p>

                                            <p className="mt-1 text-[11px] text-gray-500">
                                                Members
                                            </p>

                                        </div>

                                        <div className="rounded-xl bg-gray-50 p-4">

                                            <Crown
                                                size={16}
                                                className="text-gray-400"
                                            />

                                            <p className="mt-3 text-2xl font-bold tracking-tight">
                                                {ownerCount}
                                            </p>

                                            <p className="mt-1 text-[11px] text-gray-500">
                                                Owner
                                            </p>

                                        </div>

                                        <div className="rounded-xl bg-gray-50 p-4">

                                            <Shield
                                                size={16}
                                                className="text-gray-400"
                                            />

                                            <p className="mt-3 text-2xl font-bold tracking-tight">
                                                {adminCount}
                                            </p>

                                            <p className="mt-1 text-[11px] text-gray-500">
                                                Admins
                                            </p>

                                        </div>

                                        <div className="rounded-xl bg-gray-50 p-4">

                                            <Gamepad2
                                                size={16}
                                                className="text-gray-400"
                                            />

                                            <p className="mt-3 truncate text-lg font-bold tracking-tight">
                                                {club.game
                                                    ?.shortName ||
                                                    club.game
                                                        ?.name ||
                                                    '—'}
                                            </p>

                                            <p className="mt-1 text-[11px] text-gray-500">
                                                Game
                                            </p>

                                        </div>

                                    </div>

                                </section>

                                {/* CURRENT ROLE */}

                                {isMember && (
                                    <section className="rounded-2xl border border-gray-200 bg-black p-5 text-white">

                                        <div className="flex items-center gap-3">

                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">

                                                {isOwner ? (
                                                    <Crown
                                                        size={19}
                                                    />
                                                ) : (
                                                    <Shield
                                                        size={19}
                                                    />
                                                )}

                                            </div>

                                            <div>

                                                <p className="text-sm font-semibold">
                                                    {isOwner
                                                        ? 'Club Owner'
                                                        : isAdmin
                                                            ? 'Club Admin'
                                                            : 'Club Member'}
                                                </p>

                                                <p className="mt-1 text-xs text-gray-400">
                                                    Your current
                                                    role in this
                                                    club
                                                </p>

                                            </div>

                                        </div>

                                    </section>
                                )}

                            </aside>

                        </div>
                    )}

                {/* =================================================
                    MEMBERS TAB
                ================================================= */}

                {activeTab ===
                    'members' && (
                        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">

                            <div className="flex flex-col gap-5 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">

                                <div>

                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                        Community
                                    </p>

                                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                        Club Members
                                    </h2>

                                    <p className="mt-1 text-xs text-gray-500">
                                        {members.length}{' '}
                                        members currently
                                        in this club.
                                    </p>

                                </div>

                                {canManage && (
                                    <button
                                        type="button"
                                        onClick={
                                            openInviteModal
                                        }
                                        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-800"
                                    >
                                        <Send size={15} />
                                        Invite Player
                                    </button>
                                )}

                            </div>

                            {membersLoading ? (
                                <div className="flex h-64 items-center justify-center text-sm text-gray-400">
                                    Loading members...
                                </div>
                            ) : members.length ===
                                0 ? (
                                <div className="p-12 text-center">

                                    <Users
                                        size={36}
                                        className="mx-auto text-gray-300"
                                    />

                                    <h3 className="mt-4 text-sm font-semibold">
                                        No members yet
                                    </h3>

                                    <p className="mt-2 text-xs text-gray-500">
                                        Start building your
                                        club community.
                                    </p>

                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">

                                    {members.map(
                                        (member) => {
                                            const user =
                                                member.user;

                                            const avatar =
                                                getAvatar(
                                                    user
                                                );

                                            const canEdit =
                                                canManage &&
                                                member.role !==
                                                'OWNER' &&
                                                member.userId !==
                                                currentUser?.id &&
                                                (
                                                    isOwner ||
                                                    (
                                                        isAdmin &&
                                                        member.role ===
                                                        'MEMBER'
                                                    )
                                                );

                                            return (
                                                <div
                                                    key={
                                                        member.id
                                                    }
                                                    className="relative flex items-center justify-between gap-4 px-6 py-4"
                                                >

                                                    <div className="flex min-w-0 items-center gap-3">

                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-xs font-semibold text-white">

                                                            {avatar ? (
                                                                <img
                                                                    src={
                                                                        avatar
                                                                    }
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                getUserInitials(
                                                                    user
                                                                )
                                                            )}

                                                        </div>

                                                        <div className="min-w-0">

                                                            <p className="truncate text-sm font-semibold">
                                                                {getUserName(
                                                                    user
                                                                )}
                                                            </p>

                                                            <p className="mt-0.5 truncate text-xs text-gray-500">
                                                                {user?.username
                                                                    ? `@${user.username}`
                                                                    : user?.uid
                                                                        ? `UID: ${user.uid}`
                                                                        : 'SYNCO Player'}
                                                            </p>

                                                        </div>

                                                    </div>

                                                    <div className="flex shrink-0 items-center gap-3">

                                                        <span
                                                            className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide sm:flex ${member.role ===
                                                                'OWNER'
                                                                ? 'bg-black text-white'
                                                                : member.role ===
                                                                    'ADMIN'
                                                                    ? 'bg-gray-100 text-gray-700'
                                                                    : 'border border-gray-200 text-gray-500'
                                                                }`}
                                                        >

                                                            {member.role ===
                                                                'OWNER' && (
                                                                    <Crown
                                                                        size={
                                                                            12
                                                                        }
                                                                    />
                                                                )}

                                                            {member.role ===
                                                                'ADMIN' && (
                                                                    <Shield
                                                                        size={
                                                                            12
                                                                        }
                                                                    />
                                                                )}

                                                            {formatRole(
                                                                member.role
                                                            )}

                                                        </span>

                                                        {canEdit ? (
                                                            <div
                                                                className="relative"
                                                                onClick={(
                                                                    event
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                            >

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setMenuOpen(
                                                                            menuOpen ===
                                                                                member.id
                                                                                ? null
                                                                                : member.id
                                                                        )
                                                                    }
                                                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-black"
                                                                >
                                                                    <MoreVertical
                                                                        size={
                                                                            18
                                                                        }
                                                                    />
                                                                </button>

                                                                {menuOpen ===
                                                                    member.id && (
                                                                        <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">

                                                                            {isOwner &&
                                                                                member.role ===
                                                                                'MEMBER' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            changeRole(
                                                                                                member,
                                                                                                'ADMIN'
                                                                                            )
                                                                                        }
                                                                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                                                                    >
                                                                                        <Shield
                                                                                            size={
                                                                                                15
                                                                                            }
                                                                                        />
                                                                                        Make Admin
                                                                                    </button>
                                                                                )}

                                                                            {isOwner &&
                                                                                member.role ===
                                                                                'ADMIN' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            changeRole(
                                                                                                member,
                                                                                                'MEMBER'
                                                                                            )
                                                                                        }
                                                                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                                                                    >
                                                                                        <Shield
                                                                                            size={
                                                                                                15
                                                                                            }
                                                                                        />
                                                                                        Remove Admin
                                                                                    </button>
                                                                                )}

                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    removeMember(
                                                                                        member
                                                                                    )
                                                                                }
                                                                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
                                                                            >
                                                                                <UserMinus
                                                                                    size={
                                                                                        15
                                                                                    }
                                                                                />
                                                                                Remove Member
                                                                            </button>

                                                                        </div>
                                                                    )}

                                                            </div>
                                                        ) : (
                                                            <div className="h-9 w-9" />
                                                        )}

                                                    </div>

                                                </div>
                                            );
                                        }
                                    )}

                                </div>
                            )}

                        </section>
                    )}

                {/* =================================================
                    RECRUITMENT
                ================================================= */}

                {activeTab ===
                    'recruitment' && (
                        <div className="grid gap-6 lg:grid-cols-2">

                            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white">
                                    <UserRoundPlus
                                        size={22}
                                    />
                                </div>

                                <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                    Recruitment
                                </p>

                                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                                    Find the right
                                    players
                                </h2>

                                <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
                                    Create recruitment posts
                                    for roles your club needs
                                    and let SYNCO players
                                    apply.
                                </p>

                                <button
                                    type="button"
                                    disabled
                                    className="mt-7 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white opacity-50"
                                >
                                    <UserRoundPlus
                                        size={16}
                                    />
                                    Create Recruitment
                                    Post
                                </button>

                                <p className="mt-3 text-[11px] text-gray-400">
                                    Recruitment backend coming
                                    next.
                                </p>

                            </section>

                            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                                    <Users size={22} />
                                </div>

                                <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                    Current Roster
                                </p>

                                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                                    Build your squad
                                </h2>

                                <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
                                    Manage your roster and
                                    invite SYNCO players directly
                                    into your club.
                                </p>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveTab(
                                            'members'
                                        )
                                    }
                                    className="mt-7 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium transition hover:bg-gray-50"
                                >
                                    <Users size={16} />
                                    Manage Members
                                </button>

                            </section>

                        </div>
                    )}

                {/* =================================================
                    TOURNAMENTS
                ================================================= */}

                {activeTab ===
                    'tournaments' && (
                        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white">
                                <Trophy size={23} />
                            </div>

                            <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                Competition
                            </p>

                            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                                Club Tournaments
                            </h2>

                            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">
                                Track your club's upcoming
                                competitions, tournament
                                results and competitive history
                                here.
                            </p>

                            <div className="mt-8 rounded-xl border border-dashed border-gray-200 px-6 py-14 text-center">

                                <Trophy
                                    size={36}
                                    className="mx-auto text-gray-300"
                                />

                                <h3 className="mt-4 text-sm font-semibold">
                                    No tournaments yet
                                </h3>

                                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-gray-500">
                                    Tournament participation will
                                    appear here once the SYNCO
                                    tournament system is connected
                                    to clubs.
                                </p>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            '/competitions'
                                        )
                                    }
                                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-medium transition hover:bg-gray-50"
                                >
                                    Explore Tournaments
                                    <ChevronRight
                                        size={14}
                                    />
                                </button>

                            </div>

                        </section>
                    )}

                {/* =================================================
                    STATS
                ================================================= */}

                {activeTab ===
                    'stats' && (
                        <div className="space-y-6">

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                    <Users
                                        size={19}
                                        className="text-gray-400"
                                    />

                                    <p className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                        Members
                                    </p>

                                    <p className="mt-2 text-3xl font-bold tracking-tight">
                                        {members.length}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Current club members
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <Shield
                                        size={19}
                                        className="text-gray-400"
                                    />

                                    <p className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                        Admins
                                    </p>

                                    <p className="mt-2 text-3xl font-bold tracking-tight">
                                        {adminCount}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Active administrators
                                    </p>

                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <Gamepad2
                                        size={19}
                                        className="text-gray-400"
                                    />

                                    <p className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                        Game
                                    </p>

                                    <p className="mt-2 truncate text-xl font-bold tracking-tight">
                                        {club.game
                                            ?.shortName ||
                                            club.game
                                                ?.name ||
                                            '—'}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Primary club game
                                    </p>

                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                                    <Award
                                        size={19}
                                        className="text-gray-400"
                                    />

                                    <p className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                        Status
                                    </p>

                                    <p className="mt-2 text-2xl font-bold tracking-tight">
                                        {club.isActive
                                            ? 'Active'
                                            : 'Inactive'}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Current club status
                                    </p>

                                </div>

                            </div>

                            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

                                <div className="flex items-center gap-3">

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                                        <BarChart3
                                            size={19}
                                        />
                                    </div>

                                    <div>

                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                            Performance
                                        </p>

                                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                            Competitive Statistics
                                        </h2>

                                    </div>

                                </div>

                                <div className="mt-8 rounded-xl border border-dashed border-gray-200 px-6 py-14 text-center">

                                    <Target
                                        size={36}
                                        className="mx-auto text-gray-300"
                                    />

                                    <h3 className="mt-4 text-sm font-semibold">
                                        Competitive stats are
                                        not connected yet
                                    </h3>

                                    <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-gray-500">
                                        Match results, win rate,
                                        tournament placements
                                        and player performance
                                        will be shown here once
                                        SYNCO's competitive
                                        backend is connected.
                                    </p>

                                </div>

                            </section>

                        </div>
                    )}

            </main>

            {/* =================================================
                INVITE PLAYER MODAL
            ================================================= */}

            {showMemberModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            closeMemberModal();
                        }
                    }}
                >

                    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

                        {/* MODAL HEADER */}

                        <div className="flex items-start justify-between border-b border-gray-100 p-6">

                            <div>

                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                    Club Invitation
                                </p>

                                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                    Invite a Player
                                </h2>

                                <p className="mt-1 text-xs text-gray-500">
                                    Find a SYNCO player using
                                    their username or UID.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeMemberModal
                                }
                                disabled={
                                    actionLoading
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-black disabled:opacity-50"
                            >
                                <X size={18} />
                            </button>

                        </div>

                        {/* SEARCH */}

                        <div className="p-6">

                            <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 focus-within:border-black">

                                <Search
                                    size={17}
                                    className="shrink-0 text-gray-400"
                                />

                                <input
                                    type="text"
                                    value={
                                        searchQuery
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setSearchQuery(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Search by username or UID..."
                                    autoFocus
                                    className="w-full bg-transparent text-sm text-black outline-none placeholder:text-gray-400"
                                />

                            </div>

                            {/* RESULTS */}

                            <div className="mt-4 max-h-80 overflow-y-auto">

                                {searchingUsers && (
                                    <div className="flex items-center justify-center py-10 text-xs text-gray-400">
                                        Searching
                                        players...
                                    </div>
                                )}

                                {!searchingUsers &&
                                    searchQuery.trim() &&
                                    users.length ===
                                    0 && (
                                        <div className="py-10 text-center">

                                            <Search
                                                size={28}
                                                className="mx-auto text-gray-300"
                                            />

                                            <p className="mt-3 text-sm font-medium">
                                                No players
                                                found
                                            </p>

                                            <p className="mt-1 text-xs text-gray-400">
                                                Try another
                                                username or
                                                UID.
                                            </p>

                                        </div>
                                    )}

                                {!searchQuery.trim() && (
                                    <div className="py-10 text-center">

                                        <Users
                                            size={30}
                                            className="mx-auto text-gray-300"
                                        />

                                        <p className="mt-3 text-sm font-medium">
                                            Search SYNCO
                                            players
                                        </p>

                                        <p className="mt-1 text-xs text-gray-400">
                                            Enter a username
                                            or UID above.
                                        </p>

                                    </div>
                                )}

                                {users.map(
                                    (user) => {
                                        const avatar =
                                            getAvatar(
                                                user
                                            );

                                        return (
                                            <div
                                                key={
                                                    user.id
                                                }
                                                className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0"
                                            >

                                                <div className="flex min-w-0 items-center gap-3">

                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-xs font-semibold text-white">

                                                        {avatar ? (
                                                            <img
                                                                src={
                                                                    avatar
                                                                }
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            getUserInitials(
                                                                user
                                                            )
                                                        )}

                                                    </div>

                                                    <div className="min-w-0">

                                                        <p className="truncate text-sm font-semibold">
                                                            {getUserName(
                                                                user
                                                            )}
                                                        </p>

                                                        <p className="mt-0.5 truncate text-xs text-gray-500">
                                                            {user.username
                                                                ? `@${user.username}`
                                                                : 'SYNCO Player'}
                                                        </p>

                                                        {user.uid && (
                                                            <p className="mt-0.5 truncate text-[11px] text-gray-400">
                                                                UID:{' '}
                                                                {
                                                                    user.uid
                                                                }
                                                            </p>
                                                        )}

                                                    </div>

                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        sendInvite(
                                                            user.id
                                                        )
                                                    }
                                                    disabled={
                                                        actionLoading
                                                    }
                                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                >

                                                    <Send
                                                        size={
                                                            14
                                                        }
                                                    />

                                                    {actionLoading
                                                        ? 'Sending...'
                                                        : 'Send Invite'}

                                                </button>

                                            </div>
                                        );
                                    }
                                )}

                            </div>

                        </div>

                    </div>

                </div>
            )}

            {/* =================================================
                MANAGE PANEL
            ================================================= */}

            {showSettings &&
                canManage && (
                    <div
                        className="fixed right-4 top-20 z-50 w-[calc(100%-32px)] max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:right-6"
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >

                        <div className="flex items-start justify-between border-b border-gray-100 p-5">

                            <div>

                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                    Club Management
                                </p>

                                <h3 className="mt-1 text-base font-semibold">
                                    Manage{' '}
                                    {club.name}
                                </h3>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowSettings(
                                        false
                                    )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-black"
                            >
                                <X size={17} />
                            </button>

                        </div>

                        <div className="p-2">

                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab(
                                        'members'
                                    );

                                    setShowSettings(
                                        false
                                    );
                                }}
                                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
                            >

                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                                    <Users size={16} />
                                </div>

                                <div>

                                    <p className="text-xs font-semibold">
                                        Manage Members
                                    </p>

                                    <p className="mt-0.5 text-[11px] text-gray-400">
                                        Roles and member
                                        permissions
                                    </p>

                                </div>

                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowSettings(
                                        false
                                    );

                                    openInviteModal();
                                }}
                                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
                            >

                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                                    <Mail size={16} />
                                </div>

                                <div>

                                    <p className="text-xs font-semibold">
                                        Invite Players
                                    </p>

                                    <p className="mt-0.5 text-[11px] text-gray-400">
                                        Send invitations to
                                        SYNCO players
                                    </p>

                                </div>

                            </button>

                            <button
                                type="button"
                                disabled
                                className="flex w-full items-center gap-3 rounded-xl p-3 text-left opacity-50"
                            >

                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                                    <Settings
                                        size={16}
                                    />
                                </div>

                                <div>

                                    <p className="text-xs font-semibold">
                                        Club Settings
                                    </p>

                                    <p className="mt-0.5 text-[11px] text-gray-400">
                                        Edit club details
                                    </p>

                                </div>

                            </button>

                        </div>

                        <div className="border-t border-gray-100 px-5 py-4">

                            <p className="text-[11px] leading-5 text-gray-400">
                                Club editing and ownership
                                transfer will be connected
                                when the settings backend is
                                added.
                            </p>

                        </div>

                    </div>
                )}

        </div>
    );
};

export default ClubProfile;