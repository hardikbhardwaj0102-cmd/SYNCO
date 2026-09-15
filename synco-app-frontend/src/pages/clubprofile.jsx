import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    ArrowLeft,
    Bell,
    Check,
    ChevronDown,
    ChevronLeft,
    Crown,
    Edit3,
    Globe,
    Image,
    Lock,
    MoreHorizontal,
    Plus,
    Search,
    Shield,
    Trash2,
    UserCheck,
    UserPlus,
    Users,
    X,
} from "lucide-react";

/* =========================================================
   API
========================================================= */

const API_BASE = (
    import.meta.env.VITE_API_URL ||
    "https://synco-backend-vi7b.onrender.com"
).replace(/\/$/, "");

const API = `${API_BASE}/api`;

/* =========================================================
   HELPERS
========================================================= */

const firstDefined = (...values) =>
    values.find(
        (value) =>
            value !== undefined &&
            value !== null &&
            value !== ""
    );

const getErrorMessage = (data, fallback = "Something went wrong.") =>
    data?.message ||
    data?.error ||
    data?.detail ||
    fallback;

const formatDate = (value) => {
    if (!value) return "Recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const getUserName = (user) =>
    firstDefined(
        user?.username,
        user?.name,
        user?.displayName,
        user?.fullName,
        "Player"
    );

const getUserInitials = (user) => {
    const name = getUserName(user);

    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return "P";

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
};

const getAvatar = (user) =>
    firstDefined(
        user?.avatar,
        user?.avatarUrl,
        user?.avatar_url,
        user?.profilePicture,
        user?.profile_picture
    );

const getGameName = (game) =>
    firstDefined(
        game?.name,
        game?.title,
        game?.displayName,
        game?.display_name,
        "Unknown Game"
    );

const formatRole = (role) => {
    if (!role) return "MEMBER";

    return String(role)
        .replaceAll("_", " ")
        .toUpperCase();
};

/* =========================================================
   UI COMPONENTS
========================================================= */

const Modal = ({
    title,
    subtitle,
    onClose,
    children,
    width = "max-w-2xl",
}) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div
                className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl border border-[#dedbd3] bg-white shadow-2xl`}
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#ebe8e1] bg-white px-6 py-5">
                    <div>
                        <h2 className="text-xl font-black tracking-tight">
                            {title}
                        </h2>

                        {subtitle && (
                            <p className="mt-1 text-xs leading-5 text-[#85878e]">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dedbd3] text-[#666] hover:bg-[#f6f4ef]"
                    >
                        <X size={17} />
                    </button>
                </div>

                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Input = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}) => {
    return (
        <label className="block">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#777]">
                {label}
            </span>

            <input
                type={type}
                value={value ?? ""}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full rounded-xl border border-[#dedbd3] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#9b8148]"
            />
        </label>
    );
};

const Textarea = ({
    label,
    value,
    onChange,
    placeholder,
    rows = 5,
}) => {
    return (
        <label className="block">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#777]">
                {label}
            </span>

            <textarea
                value={value ?? ""}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                className="w-full resize-none rounded-xl border border-[#dedbd3] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#9b8148]"
            />
        </label>
    );
};

const SelectField = ({
    label,
    value,
    onChange,
    children,
}) => {
    return (
        <label className="block">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#777]">
                {label}
            </span>

            <select
                value={value ?? ""}
                onChange={onChange}
                className="w-full rounded-xl border border-[#dedbd3] bg-white px-4 py-3 text-sm outline-none focus:border-[#9b8148]"
            >
                {children}
            </select>
        </label>
    );
};

const Toggle = ({
    label,
    description,
    checked,
    onChange,
}) => {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between rounded-xl border border-[#e1ded7] bg-[#faf9f6] p-4 text-left"
        >
            <div className="pr-4">
                <p className="text-sm font-black">
                    {label}
                </p>

                {description && (
                    <p className="mt-1 text-xs leading-5 text-[#85878e]">
                        {description}
                    </p>
                )}
            </div>

            <div
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked
                        ? "bg-[#171717]"
                        : "bg-[#d7d4cc]"
                    }`}
            >
                <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked
                            ? "left-6"
                            : "left-1"
                        }`}
                />
            </div>
        </button>
    );
};

/* =========================================================
   COMPONENT
========================================================= */

const ClubProfile = () => {
    const { clubId } = useParams();
    const navigate = useNavigate();

    /* -----------------------------------------------------
       DATA
    ----------------------------------------------------- */

    const [club, setClub] = useState(null);
    const [members, setMembers] = useState([]);
    const [joinRequests, setJoinRequests] = useState([]);
    const [recruitmentPosts, setRecruitmentPosts] = useState([]);
    const [incomingInvites, setIncomingInvites] = useState([]);

    /* -----------------------------------------------------
       LOADING
    ----------------------------------------------------- */

    const [loading, setLoading] = useState(true);
    const [membersLoading, setMembersLoading] =
        useState(false);
    const [joinRequestsLoading, setJoinRequestsLoading] =
        useState(false);
    const [recruitmentLoading, setRecruitmentLoading] =
        useState(false);
    const [actionLoading, setActionLoading] =
        useState(false);

    /* -----------------------------------------------------
       UI
    ----------------------------------------------------- */

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [activeTab, setActiveTab] =
        useState("overview");

    const [openMemberMenu, setOpenMemberMenu] =
        useState(null);

    /* -----------------------------------------------------
       JOIN REQUEST
    ----------------------------------------------------- */

    const [
        showJoinRequestModal,
        setShowJoinRequestModal,
    ] = useState(false);

    const [joinMessage, setJoinMessage] =
        useState("");

    /* -----------------------------------------------------
       SETTINGS
    ----------------------------------------------------- */

    const [showSettings, setShowSettings] =
        useState(false);

    const [settingsForm, setSettingsForm] = useState({
        name: "",
        tag: "",
        description: "",
        avatar: "",
        banner: "",
        region: "Global",
        gameId: "",
        privacy: "Public",
        allowMemberInvites: true,
        isActive: true,
    });

    /* -----------------------------------------------------
       RECRUITMENT
    ----------------------------------------------------- */

    const [
        showRecruitmentForm,
        setShowRecruitmentForm,
    ] = useState(false);

    const [
        editingRecruitment,
        setEditingRecruitment,
    ] = useState(null);

    const [recruitmentForm, setRecruitmentForm] =
        useState({
            title: "",
            description: "",
            gameId: "",
            role: "",
            rankRequirement: "",
            region: "",
            micRequired: false,
            status: "OPEN",
        });

    /* -----------------------------------------------------
       INVITES
    ----------------------------------------------------- */

    const [inviteModal, setInviteModal] =
        useState(false);

    const [inviteSearch, setInviteSearch] =
        useState("");

    const [inviteResults, setInviteResults] =
        useState([]);

    const [inviteSearching, setInviteSearching] =
        useState(false);

    const [
        showIncomingInvites,
        setShowIncomingInvites,
    ] = useState(false);

    /* =====================================================
       FETCH HELPER
    ===================================================== */

    const fetchJson = async (
        url,
        options = {}
    ) => {
        let response;

        try {
            response = await fetch(url, {
                credentials: "include",
                ...options,
                headers: {
                    Accept: "application/json",
                    ...(options.body
                        ? {
                            "Content-Type":
                                "application/json",
                        }
                        : {}),
                    ...(options.headers || {}),
                },
            });
        } catch (networkError) {
            throw new Error(
                "Unable to connect to the SYNCO backend."
            );
        }

        const data =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                getErrorMessage(
                    data,
                    `Request failed with status ${response.status}.`
                )
            );
        }

        return data;
    };

    /* =====================================================
       LOAD CLUB
    ===================================================== */

    const loadClub = async () => {
        const data = await fetchJson(
            `${API}/clubs/${clubId}`
        );

        if (!data?.club) {
            throw new Error("Club not found.");
        }

        /*
         * IMPORTANT FIX:
         *
         * Backend returns:
         *
         * {
         *   club: {...},
         *   currentUser: {...},
         *   canManage: true,
         *   isOwner: true,
         *   pendingJoinRequest: null
         * }
         *
         * Previously only data.club was stored.
         */

        const normalizedClub = {
            ...data.club,

            currentUser:
                data.currentUser || null,

            canManage:
                Boolean(data.canManage),

            isOwner:
                Boolean(data.isOwner),

            pendingJoinRequest:
                data.pendingJoinRequest || null,
        };

        setClub(normalizedClub);

        return normalizedClub;
    };

    /* =====================================================
       LOAD MEMBERS
    ===================================================== */

    const loadMembers = async () => {
        setMembersLoading(true);

        try {
            const data = await fetchJson(
                `${API}/clubs/${clubId}/members`
            );

            setMembers(
                Array.isArray(data?.members)
                    ? data.members
                    : []
            );
        } finally {
            setMembersLoading(false);
        }
    };

    /* =====================================================
       LOAD JOIN REQUESTS
    ===================================================== */

    const loadJoinRequests = async () => {
        if (!club?.canManage) {
            return;
        }

        setJoinRequestsLoading(true);

        try {
            const data = await fetchJson(
                `${API}/clubs/${clubId}/join-requests`
            );

            setJoinRequests(
                Array.isArray(data?.requests)
                    ? data.requests
                    : Array.isArray(
                        data?.joinRequests
                    )
                        ? data.joinRequests
                        : []
            );
        } finally {
            setJoinRequestsLoading(false);
        }
    };

    /* =====================================================
       LOAD RECRUITMENT
    ===================================================== */

    const loadRecruitment = async (
        includeClosed = false
    ) => {
        setRecruitmentLoading(true);

        try {
            const query = includeClosed
                ? "?includeClosed=true"
                : "";

            const data = await fetchJson(
                `${API}/clubs/${clubId}/recruitment${query}`
            );

            setRecruitmentPosts(
                Array.isArray(data?.posts)
                    ? data.posts
                    : Array.isArray(
                        data?.recruitment
                    )
                        ? data.recruitment
                        : []
            );
        } finally {
            setRecruitmentLoading(false);
        }
    };

    /* =====================================================
       LOAD INVITES
    ===================================================== */

    const loadInvites = async () => {
        try {
            const data = await fetchJson(
                `${API}/clubs/invites/mine`
            );

            setIncomingInvites(
                Array.isArray(data?.invites)
                    ? data.invites
                    : []
            );
        } catch (err) {
            console.error(
                "Invite loading error:",
                err
            );
        }
    };

    /* =====================================================
       INITIAL LOAD
    ===================================================== */

    useEffect(() => {
        if (!clubId) {
            setError("Invalid club ID.");
            setLoading(false);
            return;
        }

        let mounted = true;

        const run = async () => {
            try {
                setLoading(true);
                setError("");

                await Promise.all([
                    loadClub(),
                    loadMembers(),
                    loadInvites(),
                ]);
            } catch (err) {
                console.error(
                    "Club loading error:",
                    err
                );

                if (mounted) {
                    setError(
                        err?.message ||
                        "Failed to fetch club."
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        run();

        return () => {
            mounted = false;
        };
    }, [clubId]);

    /* =====================================================
       TAB LOADERS
    ===================================================== */

    useEffect(() => {
        if (!club) return;

        if (activeTab === "members") {
            loadMembers().catch((err) =>
                setError(err.message)
            );
        }

        if (activeTab === "recruitment") {
            loadRecruitment(
                Boolean(club.canManage)
            ).catch((err) =>
                setError(err.message)
            );
        }

        if (
            activeTab === "overview" &&
            club.canManage
        ) {
            loadJoinRequests().catch((err) =>
                setError(err.message)
            );
        }
    }, [
        activeTab,
        club?.canManage,
        clubId,
    ]);

    /* =====================================================
       PERMISSIONS
    ===================================================== */

    const currentUser =
        club?.currentUser || null;

    const isOwner =
        Boolean(club?.isOwner) ||
        Number(club?.ownerId) ===
        Number(currentUser?.id);

    const canManage =
        Boolean(club?.canManage) ||
        isOwner;

    const membership = useMemo(() => {
        if (!currentUser?.id) return null;

        return members.find(
            (member) =>
                Number(member.userId) ===
                Number(currentUser.id)
        );
    }, [members, currentUser]);

    const isMember =
        Boolean(membership) ||
        Boolean(currentUser?.role);

    const pendingJoinRequest =
        club?.pendingJoinRequest || null;

    const memberCount =
        Number(
            firstDefined(
                club?.memberCount,
                members.length
            )
        ) || 0;

    const adminCount = members.filter(
        (member) =>
            String(member.role).toUpperCase() ===
            "ADMIN"
    ).length;

    /* =====================================================
       OPEN SETTINGS
    ===================================================== */

    const openSettings = () => {
        setSettingsForm({
            name: club?.name || "",
            tag: club?.tag || "",
            description:
                club?.description || "",
            avatar: club?.avatar || "",
            banner: club?.banner || "",
            region:
                club?.region || "Global",
            gameId:
                club?.gameId ||
                club?.game?.id ||
                "",
            privacy:
                club?.privacy || "Public",
            allowMemberInvites:
                club?.allowMemberInvites !==
                false,
            isActive:
                club?.isActive !== false,
        });

        setShowSettings(true);
    };

    /* =====================================================
       JOIN CLUB
    ===================================================== */

    const sendJoinRequest = async () => {
        if (!clubId) return;

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            await fetchJson(
                `${API}/clubs/${clubId}/join`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        message:
                            joinMessage.trim(),
                    }),
                }
            );

            setShowJoinRequestModal(false);
            setJoinMessage("");

            await loadClub();

            setSuccess(
                "Join request sent successfully."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       CANCEL JOIN REQUEST
    ===================================================== */

    const cancelJoinRequest = async () => {
        if (!pendingJoinRequest?.id) {
            return;
        }

        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/join-requests/${pendingJoinRequest.id}/cancel`,
                {
                    method: "POST",
                }
            );

            await loadClub();

            setSuccess(
                "Join request cancelled."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       APPROVE JOIN REQUEST
    ===================================================== */

    const approveJoinRequest = async (
        requestId
    ) => {
        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/join-requests/${requestId}/approve`,
                {
                    method: "POST",
                }
            );

            await Promise.all([
                loadJoinRequests(),
                loadMembers(),
                loadClub(),
            ]);

            setSuccess(
                "Join request approved."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       REJECT JOIN REQUEST
    ===================================================== */

    const rejectJoinRequest = async (
        requestId
    ) => {
        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/join-requests/${requestId}/reject`,
                {
                    method: "POST",
                }
            );

            await loadJoinRequests();

            setSuccess(
                "Join request rejected."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       REMOVE MEMBER
    ===================================================== */

    const removeMember = async (userId) => {
        if (
            !window.confirm(
                "Remove this player from the club?"
            )
        ) {
            return;
        }

        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/${clubId}/members/${userId}`,
                {
                    method: "DELETE",
                }
            );

            setOpenMemberMenu(null);

            await Promise.all([
                loadMembers(),
                loadClub(),
            ]);

            setSuccess(
                "Member removed from the club."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       CHANGE ROLE
    ===================================================== */

    const changeRole = async (
        userId,
        role
    ) => {
        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/${clubId}/members/${userId}/role`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        role,
                    }),
                }
            );

            setOpenMemberMenu(null);

            await loadMembers();

            setSuccess(
                role === "ADMIN"
                    ? "Player promoted to admin."
                    : "Admin role removed."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       LEAVE CLUB
    ===================================================== */

    const leaveClub = async () => {
        if (isOwner) {
            setError(
                "The club owner cannot leave the club."
            );
            return;
        }

        if (
            !window.confirm(
                "Are you sure you want to leave this club?"
            )
        ) {
            return;
        }

        try {
            setActionLoading(true);

            await fetchJson(
                `${API}/clubs/${clubId}/leave`,
                {
                    method: "POST",
                }
            );

            await Promise.all([
                loadClub(),
                loadMembers(),
            ]);

            setSuccess(
                "You have left the club."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       SAVE SETTINGS
    ===================================================== */

    const saveSettings = async () => {
        if (!settingsForm.name.trim()) {
            setError(
                "Club name is required."
            );
            return;
        }

        if (!settingsForm.tag.trim()) {
            setError(
                "Club tag is required."
            );
            return;
        }

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            await fetchJson(
                `${API}/clubs/${clubId}/settings`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        name:
                            settingsForm.name.trim(),
                        tag:
                            settingsForm.tag
                                .trim()
                                .toUpperCase()
                                .slice(0, 5),
                        description:
                            settingsForm.description.trim(),
                        avatar:
                            settingsForm.avatar.trim() ||
                            null,
                        banner:
                            settingsForm.banner.trim() ||
                            null,
                        region:
                            settingsForm.region.trim() ||
                            "Global",
                        gameId:
                            settingsForm.gameId ||
                            club.gameId,
                        privacy:
                            settingsForm.privacy,
                        allowMemberInvites:
                            settingsForm.allowMemberInvites,
                        isActive:
                            settingsForm.isActive,
                    }),
                }
            );

            await loadClub();

            setShowSettings(false);

            setSuccess(
                "Club settings updated."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       CREATE RECRUITMENT
    ===================================================== */

    const openRecruitmentCreate = () => {
        setEditingRecruitment(null);

        setRecruitmentForm({
            title: "",
            description: "",
            gameId:
                club?.gameId ||
                club?.game?.id ||
                "",
            role: "",
            rankRequirement: "",
            region:
                club?.region || "",
            micRequired: false,
            status: "OPEN",
        });

        setShowRecruitmentForm(true);
    };

    /* =====================================================
       EDIT RECRUITMENT
    ===================================================== */

    const openRecruitmentEdit = (
        post
    ) => {
        setEditingRecruitment(post);

        setRecruitmentForm({
            title:
                post?.title || "",
            description:
                post?.description || "",
            gameId:
                post?.gameId ||
                post?.game?.id ||
                club?.gameId ||
                "",
            role:
                post?.role || "",
            rankRequirement:
                post?.rankRequirement ||
                "",
            region:
                post?.region ||
                club?.region ||
                "",
            micRequired:
                Boolean(post?.micRequired),
            status:
                post?.status || "OPEN",
        });

        setShowRecruitmentForm(true);
    };

    /* =====================================================
       SAVE RECRUITMENT
    ===================================================== */

    const saveRecruitment = async () => {
        if (
            !recruitmentForm.title.trim()
        ) {
            setError(
                "Recruitment title is required."
            );
            return;
        }

        if (
            !recruitmentForm.description.trim()
        ) {
            setError(
                "Recruitment description is required."
            );
            return;
        }

        if (!recruitmentForm.gameId) {
            setError(
                "Select a game."
            );
            return;
        }

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const body = {
                title:
                    recruitmentForm.title.trim(),
                description:
                    recruitmentForm.description.trim(),
                gameId:
                    recruitmentForm.gameId,
                role:
                    recruitmentForm.role.trim(),
                rankRequirement:
                    recruitmentForm.rankRequirement.trim(),
                region:
                    recruitmentForm.region.trim(),
                micRequired:
                    recruitmentForm.micRequired,
                status:
                    recruitmentForm.status,
            };

            if (editingRecruitment?.id) {
                await fetchJson(
                    `${API}/clubs/${clubId}/recruitment/${editingRecruitment.id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(
                            body
                        ),
                    }
                );
            } else {
                await fetchJson(
                    `${API}/clubs/${clubId}/recruitment`,
                    {
                        method: "POST",
                        body: JSON.stringify(
                            body
                        ),
                    }
                );
            }

            await loadRecruitment(true);

            setShowRecruitmentForm(false);
            setEditingRecruitment(null);

            setSuccess(
                editingRecruitment
                    ? "Recruitment post updated."
                    : "Recruitment post created."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       DELETE RECRUITMENT
    ===================================================== */

    const deleteRecruitment = async (
        post
    ) => {
        if (
            !window.confirm(
                "Delete this recruitment post?"
            )
        ) {
            return;
        }

        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/${clubId}/recruitment/${post.id}`,
                {
                    method: "DELETE",
                }
            );

            await loadRecruitment(true);

            setSuccess(
                "Recruitment post deleted."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       TOGGLE RECRUITMENT
    ===================================================== */

    const toggleRecruitment = async (
        post
    ) => {
        try {
            setActionLoading(true);
            setError("");

            const nextStatus =
                post.status === "OPEN"
                    ? "CLOSED"
                    : "OPEN";

            await fetchJson(
                `${API}/clubs/${clubId}/recruitment/${post.id}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status: nextStatus,
                    }),
                }
            );

            await loadRecruitment(true);

            setSuccess(
                nextStatus === "OPEN"
                    ? "Recruitment reopened."
                    : "Recruitment closed."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       SEND INVITE
    ===================================================== */

    const sendInvite = async (
        userId
    ) => {
        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/${clubId}/invite`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        inviteeId: userId,
                    }),
                }
            );

            setSuccess(
                "Invitation sent successfully."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       SEARCH PLAYERS
    ===================================================== */

    useEffect(() => {
        const search = async () => {
            const query =
                inviteSearch.trim();

            if (query.length < 2) {
                setInviteResults([]);
                return;
            }

            try {
                setInviteSearching(true);

                const data =
                    await fetchJson(
                        `${API}/clubs/users/search?q=${encodeURIComponent(
                            query
                        )}`
                    );

                setInviteResults(
                    Array.isArray(
                        data?.users
                    )
                        ? data.users
                        : []
                );
            } catch (err) {
                console.error(
                    "Player search error:",
                    err
                );

                setInviteResults([]);
            } finally {
                setInviteSearching(false);
            }
        };

        const timer =
            setTimeout(search, 350);

        return () =>
            clearTimeout(timer);
    }, [inviteSearch]);

    /* =====================================================
       ACCEPT INVITE
    ===================================================== */

    const acceptInvite = async (
        inviteId
    ) => {
        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/invites/${inviteId}/accept`,
                {
                    method: "POST",
                }
            );

            await loadInvites();

            setSuccess(
                "Club invitation accepted."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       DECLINE INVITE
    ===================================================== */

    const declineInvite = async (
        inviteId
    ) => {
        try {
            setActionLoading(true);
            setError("");

            await fetchJson(
                `${API}/clubs/invites/${inviteId}/decline`,
                {
                    method: "POST",
                }
            );

            await loadInvites();

            setSuccess(
                "Club invitation declined."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    /* =====================================================
       OPEN JOIN REQUESTS
    ===================================================== */

    const openJoinRequests = async () => {
        setActiveTab("overview");

        try {
            await loadJoinRequests();
        } catch (err) {
            setError(err.message);
        }
    };

    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f7f7f5] text-[#171717]">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="rounded-2xl border border-[#dedbd3] bg-white px-8 py-6 text-center shadow-sm">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#dedbd3] border-t-[#9b8148]" />

                        <p className="mt-4 text-xs font-black uppercase tracking-wider text-[#777]">
                            Loading club
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    /* =====================================================
       ERROR
    ===================================================== */

    if (!club) {
        return (
            <div className="min-h-screen bg-[#f7f7f5] text-[#171717]">
                <div className="flex min-h-screen items-center justify-center p-6">
                    <div className="w-full max-w-md rounded-2xl border border-[#dedbd3] bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2ede1]">
                            <Shield
                                size={24}
                                className="text-[#9b8148]"
                            />
                        </div>

                        <h1 className="mt-5 text-2xl font-black">
                            Club not found
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-[#85878e]">
                            {error ||
                                "We could not load this club."}
                        </p>

                        <p className="mt-4 break-all text-[10px] font-bold text-[#aaa]">
                            API: {API}/clubs/{clubId}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/clubs"
                                )
                            }
                            className="mt-6 rounded-xl bg-[#171717] px-5 py-3 text-xs font-black uppercase tracking-wider text-white"
                        >
                            Back to Clubs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* =====================================================
       MAIN
    ===================================================== */

    return (
        <div className="min-h-screen bg-[#f7f7f5] text-[#171717]">
            {/* =================================================
                TOP BAR
            ================================================= */}

            <header className="border-b border-[#dedbd3] bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/clubs"
                            )
                        }
                        className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#666] hover:text-[#171717]"
                    >
                        <ArrowLeft
                            size={16}
                        />
                        Clubs
                    </button>

                    <div className="flex items-center gap-2">
                        {incomingInvites.length >
                            0 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowIncomingInvites(
                                            true
                                        )
                                    }
                                    className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#dedbd3] hover:bg-[#f6f4ef]"
                                >
                                    <Bell
                                        size={17}
                                    />

                                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#171717] px-1 text-[8px] font-black text-white">
                                        {
                                            incomingInvites.length
                                        }
                                    </span>
                                </button>
                            )}

                        {canManage && (
                            <button
                                type="button"
                                onClick={
                                    openSettings
                                }
                                className="flex items-center gap-2 rounded-xl border border-[#dedbd3] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-[#f6f4ef]"
                            >
                                <Edit3
                                    size={14}
                                />
                                Manage Club
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* =================================================
                HERO
            ================================================= */}

            <section className="border-b border-[#dedbd3] bg-white">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div
                        className="relative overflow-hidden rounded-3xl border border-[#dedbd3] bg-[#171717]"
                    >
                        {club.banner && (
                            <img
                                src={
                                    club.banner
                                }
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover opacity-30"
                            />
                        )}

                        <div className="absolute inset-0 bg-black/40" />

                        <div className="relative p-6 sm:p-8 lg:p-10">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                <div className="flex min-w-0 items-center gap-5">
                                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/20 bg-white/10">
                                        {club.avatar ? (
                                            <img
                                                src={
                                                    club.avatar
                                                }
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Shield
                                                size={36}
                                                className="text-[#c6ad76]"
                                            />
                                        )}
                                    </div>

                                    <div className="min-w-0 text-white">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider">
                                                {club.tag}
                                            </span>

                                            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider">
                                                {club.privacy}
                                            </span>

                                            {!club.isActive && (
                                                <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-red-200">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>

                                        <h1 className="mt-3 truncate text-3xl font-black tracking-tight sm:text-4xl">
                                            {
                                                club.name
                                            }
                                        </h1>

                                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-white/65">
                                            <span>
                                                {getGameName(
                                                    club.game
                                                )}
                                            </span>

                                            <span>
                                                {club.region ||
                                                    "Global"}
                                            </span>

                                            <span>
                                                {
                                                    memberCount
                                                }{" "}
                                                members
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {!isMember &&
                                        club.privacy ===
                                        "Public" &&
                                        !pendingJoinRequest && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowJoinRequestModal(
                                                        true
                                                    )
                                                }
                                                className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black uppercase tracking-wider text-[#171717] hover:bg-[#f2efe8]"
                                            >
                                                <UserPlus
                                                    size={
                                                        15
                                                    }
                                                />
                                                Request to Join
                                            </button>
                                        )}

                                    {!isMember &&
                                        pendingJoinRequest && (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-white/60"
                                                >
                                                    <Check
                                                        size={
                                                            15
                                                        }
                                                    />
                                                    Request Pending
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={
                                                        actionLoading
                                                    }
                                                    onClick={
                                                        cancelJoinRequest
                                                    }
                                                    className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}

                                    {isMember &&
                                        !isOwner && (
                                            <button
                                                type="button"
                                                disabled={
                                                    actionLoading
                                                }
                                                onClick={
                                                    leaveClub
                                                }
                                                className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10"
                                            >
                                                Leave Club
                                            </button>
                                        )}

                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setInviteModal(
                                                    true
                                                )
                                            }
                                            className="flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10"
                                        >
                                            <UserPlus
                                                size={
                                                    15
                                                }
                                            />
                                            Invite
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* =================================================
                ALERTS
            ================================================= */}

            <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
                {error && (
                    <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                        <span>
                            {error}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                        >
                            <X
                                size={15}
                            />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-[#d7dfd5] bg-[#f0f5ef] px-4 py-3 text-xs font-bold text-[#47704e]">
                        <span>
                            {success}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setSuccess("")
                            }
                        >
                            <X
                                size={15}
                            />
                        </button>
                    </div>
                )}
            </div>

            {/* =================================================
                TABS
            ================================================= */}

            <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
                <div className="flex overflow-x-auto border-b border-[#dedbd3]">
                    {[
                        [
                            "overview",
                            "Overview",
                        ],
                        [
                            "members",
                            "Members",
                        ],
                        [
                            "recruitment",
                            "Recruitment",
                        ],
                        [
                            "tournaments",
                            "Tournaments",
                        ],
                        [
                            "stats",
                            "Stats",
                        ],
                    ].map(
                        ([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        id
                                    )
                                }
                                className={`whitespace-nowrap border-b-2 px-5 py-4 text-[10px] font-black uppercase tracking-wider transition ${activeTab ===
                                        id
                                        ? "border-[#9b8148] text-[#171717]"
                                        : "border-transparent text-[#85878e] hover:text-[#171717]"
                                    }`}
                            >
                                {label}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* =================================================
                CONTENT
            ================================================= */}

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* =================================================
                    OVERVIEW
                ================================================= */}

                {activeTab ===
                    "overview" && (
                        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                            <div className="space-y-6">
                                <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                        About
                                    </p>

                                    <h2 className="mt-1 text-2xl font-black">
                                        {
                                            club.name
                                        }
                                    </h2>

                                    <p className="mt-4 text-sm leading-7 text-[#66686e]">
                                        {club.description ||
                                            "This club has not added a description yet."}
                                    </p>

                                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-xl bg-[#f7f5f0] p-4">
                                            <Users
                                                size={
                                                    17
                                                }
                                                className="text-[#9b8148]"
                                            />

                                            <p className="mt-3 text-2xl font-black">
                                                {
                                                    memberCount
                                                }
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#999]">
                                                Members
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-[#f7f5f0] p-4">
                                            <Shield
                                                size={
                                                    17
                                                }
                                                className="text-[#9b8148]"
                                            />

                                            <p className="mt-3 text-2xl font-black">
                                                {club.level ||
                                                    club.clubLevel ||
                                                    1}
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#999]">
                                                Club Level
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-[#f7f5f0] p-4">
                                            <Globe
                                                size={
                                                    17
                                                }
                                                className="text-[#9b8148]"
                                            />

                                            <p className="mt-3 truncate text-lg font-black">
                                                {club.region ||
                                                    "Global"}
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#999]">
                                                Region
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* JOIN REQUESTS */}

                                {canManage && (
                                    <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                                    Management
                                                </p>

                                                <h2 className="mt-1 text-xl font-black">
                                                    Join Requests
                                                </h2>

                                                <p className="mt-1 text-xs text-[#85878e]">
                                                    Review players who want to join your club.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={
                                                    loadJoinRequests
                                                }
                                                className="rounded-lg border border-[#dedbd3] px-3 py-2 text-[9px] font-black uppercase tracking-wider hover:bg-[#f6f4ef]"
                                            >
                                                Refresh
                                            </button>
                                        </div>

                                        {joinRequestsLoading ? (
                                            <div className="py-10 text-center text-xs font-bold text-[#888]">
                                                Loading requests...
                                            </div>
                                        ) : joinRequests.length ===
                                            0 ? (
                                            <div className="mt-5 rounded-xl border border-dashed border-[#dedbd3] px-5 py-10 text-center">
                                                <UserCheck
                                                    size={
                                                        24
                                                    }
                                                    className="mx-auto text-[#aaa39a]"
                                                />

                                                <p className="mt-3 text-xs font-black uppercase tracking-wider">
                                                    No pending requests
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="mt-5 space-y-3">
                                                {joinRequests.map(
                                                    (
                                                        request
                                                    ) => {
                                                        const user =
                                                            request.user ||
                                                            request.applicant;

                                                        const avatar =
                                                            getAvatar(
                                                                user
                                                            );

                                                        return (
                                                            <div
                                                                key={
                                                                    request.id
                                                                }
                                                                className="rounded-xl border border-[#ebe8e1] p-4"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {avatar ? (
                                                                        <img
                                                                            src={
                                                                                avatar
                                                                            }
                                                                            alt=""
                                                                            className="h-11 w-11 rounded-xl object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ece9e2] text-xs font-black">
                                                                            {getUserInitials(
                                                                                user
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-sm font-black">
                                                                            {getUserName(
                                                                                user
                                                                            )}
                                                                        </p>

                                                                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#929398]">
                                                                            {formatDate(
                                                                                request.createdAt
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {request.message && (
                                                                    <div className="mt-4 rounded-xl bg-[#f7f5f0] p-3 text-xs leading-5 text-[#66686e]">
                                                                        {
                                                                            request.message
                                                                        }
                                                                    </div>
                                                                )}

                                                                <div className="mt-4 flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            actionLoading
                                                                        }
                                                                        onClick={() =>
                                                                            approveJoinRequest(
                                                                                request.id
                                                                            )
                                                                        }
                                                                        className="flex-1 rounded-lg bg-[#171717] px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                                                                    >
                                                                        Approve
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            actionLoading
                                                                        }
                                                                        onClick={() =>
                                                                            rejectJoinRequest(
                                                                                request.id
                                                                            )
                                                                        }
                                                                        className="flex-1 rounded-lg border border-[#dedbd3] px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-[#555] disabled:opacity-60"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>

                            {/* SIDEBAR */}

                            <aside className="space-y-6">
                                <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                        Club Details
                                    </p>

                                    <div className="mt-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#85878e]">
                                                Privacy
                                            </span>

                                            <span className="flex items-center gap-1.5 text-xs font-black">
                                                {club.privacy ===
                                                    "Private" ? (
                                                    <Lock
                                                        size={
                                                            13
                                                        }
                                                    />
                                                ) : (
                                                    <Globe
                                                        size={
                                                            13
                                                        }
                                                    />
                                                )}

                                                {
                                                    club.privacy
                                                }
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#85878e]">
                                                Game
                                            </span>

                                            <span className="text-xs font-black">
                                                {getGameName(
                                                    club.game
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#85878e]">
                                                Owner
                                            </span>

                                            <span className="max-w-[150px] truncate text-xs font-black">
                                                {getUserName(
                                                    club.owner
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#85878e]">
                                                Created
                                            </span>

                                            <span className="text-xs font-black">
                                                {formatDate(
                                                    club.createdAt
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                {canManage && (
                                    <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                            Administration
                                        </p>

                                        <button
                                            type="button"
                                            onClick={
                                                openJoinRequests
                                            }
                                            className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#f7f5f0] px-4 py-3 text-xs font-black hover:bg-[#f0ede5]"
                                        >
                                            <span>
                                                Review Join Requests
                                            </span>

                                            <ChevronRight
                                                size={
                                                    15
                                                }
                                            />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={
                                                openSettings
                                            }
                                            className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#f7f5f0] px-4 py-3 text-xs font-black hover:bg-[#f0ede5]"
                                        >
                                            <span>
                                                Manage Club Settings
                                            </span>

                                            <ChevronRight
                                                size={
                                                    15
                                                }
                                            />
                                        </button>
                                    </section>
                                )}
                            </aside>
                        </div>
                    )}

                {/* =================================================
                    MEMBERS
                ================================================= */}

                {activeTab ===
                    "members" && (
                        <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                        Club
                                    </p>

                                    <h2 className="mt-1 text-2xl font-black">
                                        Members
                                    </h2>

                                    <p className="mt-1 text-xs text-[#85878e]">
                                        Everyone currently inside the club.
                                    </p>
                                </div>

                                {canManage && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setInviteModal(
                                                true
                                            )
                                        }
                                        className="flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-xs font-black uppercase tracking-wider text-white"
                                    >
                                        <UserPlus
                                            size={
                                                15
                                            }
                                        />
                                        Invite Player
                                    </button>
                                )}
                            </div>

                            {membersLoading ? (
                                <div className="py-16 text-center text-xs font-bold text-[#888]">
                                    Loading members...
                                </div>
                            ) : members.length ===
                                0 ? (
                                <div className="py-16 text-center text-xs font-bold text-[#888]">
                                    No members found.
                                </div>
                            ) : (
                                <div className="mt-8 grid gap-3 md:grid-cols-2">
                                    {members.map(
                                        (
                                            member
                                        ) => {
                                            const avatar =
                                                getAvatar(
                                                    member.user
                                                );

                                            const memberIsOwner =
                                                Number(
                                                    member.userId
                                                ) ===
                                                Number(
                                                    club.ownerId
                                                );

                                            return (
                                                <div
                                                    key={
                                                        member.id
                                                    }
                                                    className="relative rounded-2xl border border-[#ebe8e1] p-4"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {avatar ? (
                                                            <img
                                                                src={
                                                                    avatar
                                                                }
                                                                alt=""
                                                                className="h-12 w-12 rounded-xl object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ece9e2] text-xs font-black">
                                                                {getUserInitials(
                                                                    member.user
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-black">
                                                                {getUserName(
                                                                    member.user
                                                                )}
                                                            </p>

                                                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#88898e]">
                                                                {formatRole(
                                                                    member.role
                                                                )}
                                                            </p>
                                                        </div>

                                                        {memberIsOwner ? (
                                                            <Crown
                                                                size={
                                                                    16
                                                                }
                                                                className="text-[#9b8148]"
                                                            />
                                                        ) : (
                                                            canManage &&
                                                            Number(
                                                                member.userId
                                                            ) !==
                                                            Number(
                                                                currentUser?.id
                                                            ) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setOpenMemberMenu(
                                                                            openMemberMenu ===
                                                                                member.id
                                                                                ? null
                                                                                : member.id
                                                                        )
                                                                    }
                                                                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f4f2ed]"
                                                                >
                                                                    <MoreHorizontal
                                                                        size={
                                                                            17
                                                                        }
                                                                    />
                                                                </button>
                                                            )
                                                        )}
                                                    </div>

                                                    {openMemberMenu ===
                                                        member.id && (
                                                            <div className="absolute right-4 top-14 z-20 w-44 rounded-xl border border-[#dedbd3] bg-white p-2 shadow-xl">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        changeRole(
                                                                            member.userId,
                                                                            member.role ===
                                                                                "ADMIN"
                                                                                ? "MEMBER"
                                                                                : "ADMIN"
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider hover:bg-[#f6f4ef]"
                                                                >
                                                                    <Shield
                                                                        size={
                                                                            14
                                                                        }
                                                                    />

                                                                    {member.role ===
                                                                        "ADMIN"
                                                                        ? "Remove Admin"
                                                                        : "Make Admin"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        removeMember(
                                                                            member.userId
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50"
                                                                >
                                                                    <Trash2
                                                                        size={
                                                                            14
                                                                        }
                                                                    />

                                                                    Remove
                                                                </button>
                                                            </div>
                                                        )}
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
                    "recruitment" && (
                        <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                        Team Building
                                    </p>

                                    <h2 className="mt-1 text-2xl font-black">
                                        Recruitment
                                    </h2>

                                    <p className="mt-1 text-xs text-[#85878e]">
                                        Find players for your club.
                                    </p>
                                </div>

                                {canManage && (
                                    <button
                                        type="button"
                                        onClick={
                                            openRecruitmentCreate
                                        }
                                        className="flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-[#2b2b2b]"
                                    >
                                        <Plus
                                            size={
                                                15
                                            }
                                        />
                                        Create Recruitment Post
                                    </button>
                                )}
                            </div>

                            {recruitmentLoading ? (
                                <div className="py-16 text-center text-xs font-bold text-[#888]">
                                    Loading recruitment...
                                </div>
                            ) : recruitmentPosts.length ===
                                0 ? (
                                <div className="mt-8 rounded-2xl border border-dashed border-[#dedbd3] px-6 py-16 text-center">
                                    <UserPlus
                                        size={
                                            28
                                        }
                                        className="mx-auto text-[#aaa39a]"
                                    />

                                    <h3 className="mt-4 text-sm font-black uppercase tracking-wider">
                                        No recruitment posts
                                    </h3>

                                    <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#8b8c91]">
                                        {canManage
                                            ? "Create a recruitment post to tell players exactly who your club is looking for."
                                            : "This club is not currently recruiting."}
                                    </p>

                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={
                                                openRecruitmentCreate
                                            }
                                            className="mt-5 rounded-xl bg-[#171717] px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white"
                                        >
                                            Create Post
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                                    {recruitmentPosts.map(
                                        (
                                            post
                                        ) => (
                                            <article
                                                key={
                                                    post.id
                                                }
                                                className="rounded-2xl border border-[#ebe8e1] p-5"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${post.status ===
                                                                        "OPEN"
                                                                        ? "bg-[#edf5ee] text-[#47704e]"
                                                                        : "bg-[#f0eeea] text-[#777]"
                                                                    }`}
                                                            >
                                                                {
                                                                    post.status
                                                                }
                                                            </span>

                                                            {post.role && (
                                                                <span className="rounded-full bg-[#f7f5f0] px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#777]">
                                                                    {
                                                                        post.role
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h3 className="mt-3 text-lg font-black">
                                                            {
                                                                post.title
                                                            }
                                                        </h3>
                                                    </div>

                                                    {canManage && (
                                                        <div className="flex shrink-0 gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openRecruitmentEdit(
                                                                        post
                                                                    )
                                                                }
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dedbd3] hover:bg-[#f6f4ef]"
                                                            >
                                                                <Edit3
                                                                    size={
                                                                        14
                                                                    }
                                                                />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    deleteRecruitment(
                                                                        post
                                                                    )
                                                                }
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                                            >
                                                                <Trash2
                                                                    size={
                                                                        14
                                                                    }
                                                                />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="mt-4 text-sm leading-6 text-[#66686e]">
                                                    {
                                                        post.description
                                                    }
                                                </p>

                                                <div className="mt-5 grid grid-cols-2 gap-2">
                                                    <div className="rounded-xl bg-[#f7f5f0] p-3">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#999]">
                                                            Game
                                                        </p>

                                                        <p className="mt-1 text-xs font-black">
                                                            {getGameName(
                                                                post.game
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f7f5f0] p-3">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#999]">
                                                            Rank
                                                        </p>

                                                        <p className="mt-1 text-xs font-black">
                                                            {post.rankRequirement ||
                                                                "Any"}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f7f5f0] p-3">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#999]">
                                                            Region
                                                        </p>

                                                        <p className="mt-1 text-xs font-black">
                                                            {post.region ||
                                                                "Any"}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f7f5f0] p-3">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#999]">
                                                            Mic
                                                        </p>

                                                        <p className="mt-1 text-xs font-black">
                                                            {post.micRequired
                                                                ? "Required"
                                                                : "Optional"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {canManage && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleRecruitment(
                                                                post
                                                            )
                                                        }
                                                        className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#dedbd3] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#555] hover:bg-[#f6f4ef]"
                                                    >
                                                        {post.status ===
                                                            "OPEN"
                                                            ? "Close Recruitment"
                                                            : "Reopen Recruitment"}
                                                    </button>
                                                )}
                                            </article>
                                        )
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                {/* =================================================
                    TOURNAMENTS
                ================================================= */}

                {activeTab ===
                    "tournaments" && (
                        <section className="rounded-2xl border border-[#dedbd3] bg-white p-10 text-center shadow-sm">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2ede1]">
                                <Crown
                                    size={
                                        24
                                    }
                                    className="text-[#9b8148]"
                                />
                            </div>

                            <h2 className="mt-5 text-xl font-black">
                                Club Tournaments
                            </h2>

                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#85878e]">
                                Tournament management for clubs will be connected here.
                            </p>
                        </section>
                    )}

                {/* =================================================
                    STATS
                ================================================= */}

                {activeTab ===
                    "stats" && (
                        <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                    Performance
                                </p>

                                <h2 className="mt-1 text-2xl font-black">
                                    Club Stats
                                </h2>
                            </div>

                            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl bg-[#f7f5f0] p-5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#999]">
                                        Members
                                    </p>

                                    <p className="mt-3 text-3xl font-black">
                                        {
                                            memberCount
                                        }
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-[#f7f5f0] p-5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#999]">
                                        Admins
                                    </p>

                                    <p className="mt-3 text-3xl font-black">
                                        {
                                            adminCount
                                        }
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-[#f7f5f0] p-5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#999]">
                                        Club Level
                                    </p>

                                    <p className="mt-3 text-3xl font-black">
                                        {club.level ||
                                            club.clubLevel ||
                                            1}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-[#f7f5f0] p-5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#999]">
                                        SYNCO Points
                                    </p>

                                    <p className="mt-3 text-3xl font-black">
                                        {club.syncoPoints ||
                                            0}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}
            </main>

            {/* =================================================
                JOIN REQUEST MODAL
            ================================================= */}

            {showJoinRequestModal && (
                <Modal
                    title="Request to Join"
                    subtitle={`Send a request to join ${club.name}.`}
                    onClose={() =>
                        setShowJoinRequestModal(
                            false
                        )
                    }
                    width="max-w-lg"
                >
                    <Textarea
                        label="Message (Optional)"
                        value={
                            joinMessage
                        }
                        onChange={(
                            event
                        ) =>
                            setJoinMessage(
                                event.target
                                    .value.slice(
                                        0,
                                        500
                                    )
                            )
                        }
                        placeholder="Tell the club why you want to join..."
                        rows={5}
                    />

                    <div className="mt-2 flex justify-between text-[9px] font-bold text-[#999]">
                        <span>
                            Optional
                        </span>

                        <span>
                            {
                                joinMessage.length
                            }
                            /500
                        </span>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() =>
                                setShowJoinRequestModal(
                                    false
                                )
                            }
                            className="rounded-xl border border-[#dedbd3] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#555]"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            disabled={
                                actionLoading
                            }
                            onClick={
                                sendJoinRequest
                            }
                            className="rounded-xl bg-[#171717] px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
                        >
                            {actionLoading
                                ? "Sending..."
                                : "Send Request"}
                        </button>
                    </div>
                </Modal>
            )}

            {/* =================================================
                SETTINGS MODAL
            ================================================= */}

            {showSettings && (
                <Modal
                    title="Club Settings"
                    subtitle="Manage the identity, visibility and access settings of your club."
                    onClose={() =>
                        setShowSettings(
                            false
                        )
                    }
                >
                    <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Club Name"
                                value={
                                    settingsForm.name
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            name: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                            />

                            <Input
                                label="Tag"
                                value={
                                    settingsForm.tag
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            tag: event
                                                .target
                                                .value
                                                .toUpperCase()
                                                .slice(
                                                    0,
                                                    5
                                                ),
                                        })
                                    )
                                }
                            />
                        </div>

                        <Textarea
                            label="Description"
                            value={
                                settingsForm.description
                            }
                            onChange={(
                                event
                            ) =>
                                setSettingsForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        description:
                                            event
                                                .target
                                                .value,
                                    })
                                )
                            }
                            placeholder="Describe your club..."
                            rows={5}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Avatar URL"
                                value={
                                    settingsForm.avatar
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            avatar: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                                placeholder="https://..."
                            />

                            <Input
                                label="Banner URL"
                                value={
                                    settingsForm.banner
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            banner: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                                placeholder="https://..."
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Region"
                                value={
                                    settingsForm.region
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            region: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                                placeholder="India"
                            />

                            <SelectField
                                label="Game"
                                value={
                                    settingsForm.gameId
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            gameId:
                                                event
                                                    .target
                                                    .value,
                                        })
                                    )
                                }
                            >
                                <option value="">
                                    Select game
                                </option>

                                {club.game && (
                                    <option
                                        value={
                                            club
                                                .game
                                                .id
                                        }
                                    >
                                        {getGameName(
                                            club.game
                                        )}
                                    </option>
                                )}
                            </SelectField>
                        </div>

                        <SelectField
                            label="Privacy"
                            value={
                                settingsForm.privacy
                            }
                            onChange={(
                                event
                            ) =>
                                setSettingsForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        privacy:
                                            event
                                                .target
                                                .value,
                                    })
                                )
                            }
                        >
                            <option value="Public">
                                Public
                            </option>

                            <option value="Private">
                                Private
                            </option>
                        </SelectField>

                        <div className="space-y-3">
                            <Toggle
                                label="Allow member invitations"
                                description="Allow club managers to invite players into the club."
                                checked={
                                    settingsForm.allowMemberInvites
                                }
                                onChange={(
                                    value
                                ) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            allowMemberInvites:
                                                value,
                                        })
                                    )
                                }
                            />

                            <div className="rounded-xl border border-[#e1ded7] bg-[#faf9f6] p-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0e9da]">
                                        <UserCheck
                                            size={
                                                15
                                            }
                                            className="text-[#9b8148]"
                                        />
                                    </div>

                                    <div>
                                        <p className="text-sm font-black">
                                            Join approval
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-[#85878e]">
                                            Players requesting to join must be approved by a club manager.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {isOwner && (
                                <Toggle
                                    label="Club active"
                                    description="Deactivate the club if you want to temporarily close it."
                                    checked={
                                        settingsForm.isActive
                                    }
                                    onChange={(
                                        value
                                    ) =>
                                        setSettingsForm(
                                            (
                                                previous
                                            ) => ({
                                                ...previous,
                                                isActive:
                                                    value,
                                            })
                                        )
                                    }
                                />
                            )}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-[#ebe8e1] pt-5">
                            <button
                                type="button"
                                onClick={() =>
                                    setShowSettings(
                                        false
                                    )
                                }
                                className="rounded-xl border border-[#dedbd3] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#555]"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={
                                    actionLoading
                                }
                                onClick={
                                    saveSettings
                                }
                                className="rounded-xl bg-[#171717] px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
                            >
                                {actionLoading
                                    ? "Saving..."
                                    : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* =================================================
                RECRUITMENT FORM
            ================================================= */}

            {showRecruitmentForm && (
                <Modal
                    title={
                        editingRecruitment
                            ? "Edit Recruitment Post"
                            : "Create Recruitment Post"
                    }
                    subtitle="Tell players exactly who your club needs."
                    onClose={() => {
                        setShowRecruitmentForm(
                            false
                        );

                        setEditingRecruitment(
                            null
                        );
                    }}
                >
                    <div className="space-y-5">
                        <Input
                            label="Title"
                            value={
                                recruitmentForm.title
                            }
                            onChange={(
                                event
                            ) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        title: event
                                            .target
                                            .value,
                                    })
                                )
                            }
                            placeholder="Looking for active players"
                        />

                        <Textarea
                            label="Description"
                            value={
                                recruitmentForm.description
                            }
                            onChange={(
                                event
                            ) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        description:
                                            event
                                                .target
                                                .value,
                                    })
                                )
                            }
                            placeholder="Describe the player you are looking for..."
                            rows={6}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <SelectField
                                label="Game"
                                value={
                                    recruitmentForm.gameId
                                }
                                onChange={(
                                    event
                                ) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            gameId:
                                                event
                                                    .target
                                                    .value,
                                        })
                                    )
                                }
                            >
                                <option value="">
                                    Select game
                                </option>

                                {club.game && (
                                    <option
                                        value={
                                            club
                                                .game
                                                .id
                                        }
                                    >
                                        {getGameName(
                                            club.game
                                        )}
                                    </option>
                                )}
                            </SelectField>

                            <Input
                                label="Role"
                                value={
                                    recruitmentForm.role
                                }
                                onChange={(
                                    event
                                ) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            role: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                                placeholder="Duelist / IGL / Support"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Rank Requirement"
                                value={
                                    recruitmentForm.rankRequirement
                                }
                                onChange={(
                                    event
                                ) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            rankRequirement:
                                                event
                                                    .target
                                                    .value,
                                        })
                                    )
                                }
                                placeholder="Ascendant+"
                            />

                            <Input
                                label="Region"
                                value={
                                    recruitmentForm.region
                                }
                                onChange={(
                                    event
                                ) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            region: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                                placeholder="India"
                            />
                        </div>

                        <Toggle
                            label="Microphone required"
                            description="Players should have a working microphone."
                            checked={
                                recruitmentForm.micRequired
                            }
                            onChange={(
                                value
                            ) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        micRequired:
                                            value,
                                    })
                                )
                            }
                        />

                        <SelectField
                            label="Status"
                            value={
                                recruitmentForm.status
                            }
                            onChange={(
                                event
                            ) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        status:
                                            event
                                                .target
                                                .value,
                                    })
                                )
                            }
                        >
                            <option value="OPEN">
                                Open
                            </option>

                            <option value="CLOSED">
                                Closed
                            </option>
                        </SelectField>

                        <div className="flex justify-end gap-3 border-t border-[#ebe8e1] pt-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRecruitmentForm(
                                        false
                                    );

                                    setEditingRecruitment(
                                        null
                                    );
                                }}
                                className="rounded-xl border border-[#dedbd3] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#555]"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={
                                    actionLoading
                                }
                                onClick={
                                    saveRecruitment
                                }
                                className="rounded-xl bg-[#171717] px-5 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
                            >
                                {actionLoading
                                    ? "Saving..."
                                    : editingRecruitment
                                        ? "Update Post"
                                        : "Create Post"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* =================================================
                INVITE MODAL
            ================================================= */}

            {inviteModal && (
                <Modal
                    title="Invite Players"
                    subtitle="Search for SYNCO players and invite them to this club."
                    onClose={() => {
                        setInviteModal(
                            false
                        );

                        setInviteSearch(
                            ""
                        );

                        setInviteResults(
                            []
                        );
                    }}
                    width="max-w-xl"
                >
                    <div className="relative">
                        <Search
                            size={
                                17
                            }
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999]"
                        />

                        <input
                            value={
                                inviteSearch
                            }
                            onChange={(
                                event
                            ) =>
                                setInviteSearch(
                                    event
                                        .target
                                        .value
                                )
                            }
                            placeholder="Search by username, name or SYNCO UID"
                            className="w-full rounded-xl border border-[#dedbd3] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#9b8148]"
                        />
                    </div>

                    <div className="mt-5">
                        {inviteSearching && (
                            <div className="py-8 text-center text-xs font-bold text-[#888]">
                                Searching...
                            </div>
                        )}

                        {!inviteSearching &&
                            inviteSearch.trim()
                                .length >=
                            2 &&
                            inviteResults.length ===
                            0 && (
                                <div className="rounded-xl border border-dashed border-[#dedbd3] py-10 text-center text-xs font-bold text-[#888]">
                                    No players found.
                                </div>
                            )}

                        {!inviteSearching &&
                            inviteResults.length >
                            0 && (
                                <div className="space-y-2">
                                    {inviteResults.map(
                                        (
                                            player
                                        ) => {
                                            const avatar =
                                                getAvatar(
                                                    player
                                                );

                                            return (
                                                <div
                                                    key={
                                                        player.id
                                                    }
                                                    className="flex items-center gap-3 rounded-xl border border-[#ebe8e1] p-3"
                                                >
                                                    {avatar ? (
                                                        <img
                                                            src={
                                                                avatar
                                                            }
                                                            alt=""
                                                            className="h-11 w-11 rounded-xl object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ece9e2] text-xs font-black">
                                                            {getUserInitials(
                                                                player
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-black">
                                                            {getUserName(
                                                                player
                                                            )}
                                                        </p>

                                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#929398]">
                                                            UID:{" "}
                                                            {player.uid ||
                                                                player.syncoUid ||
                                                                "—"}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            actionLoading
                                                        }
                                                        onClick={() =>
                                                            sendInvite(
                                                                player.id
                                                            )
                                                        }
                                                        className="rounded-lg bg-[#171717] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                                                    >
                                                        Invite
                                                    </button>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                    </div>
                </Modal>
            )}

            {/* =================================================
                INCOMING INVITES
            ================================================= */}

            {showIncomingInvites && (
                <Modal
                    title="Club Invitations"
                    subtitle="Clubs that have invited you to join."
                    onClose={() =>
                        setShowIncomingInvites(
                            false
                        )
                    }
                    width="max-w-xl"
                >
                    <div className="space-y-3">
                        {incomingInvites.length ===
                            0 ? (
                            <div className="py-10 text-center text-xs font-bold text-[#888]">
                                No pending invitations.
                            </div>
                        ) : (
                            incomingInvites.map(
                                (
                                    invite
                                ) => {
                                    const invitedClub =
                                        invite.club;

                                    return (
                                        <div
                                            key={
                                                invite.id
                                            }
                                            className="rounded-xl border border-[#ebe8e1] p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#ece9e2]">
                                                    {invitedClub?.avatar ? (
                                                        <img
                                                            src={
                                                                invitedClub.avatar
                                                            }
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Shield
                                                            size={
                                                                18
                                                            }
                                                            className="text-[#9b8148]"
                                                        />
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-black">
                                                        {invitedClub?.name ||
                                                            "Club"}
                                                    </p>

                                                    <p className="mt-1 text-[10px] font-bold text-[#898a8e]">
                                                        Invited by{" "}
                                                        {getUserName(
                                                            invite.inviter
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={
                                                        actionLoading
                                                    }
                                                    onClick={() =>
                                                        acceptInvite(
                                                            invite.id
                                                        )
                                                    }
                                                    className="flex-1 rounded-lg bg-[#171717] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                                                >
                                                    Accept
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={
                                                        actionLoading
                                                    }
                                                    onClick={() =>
                                                        declineInvite(
                                                            invite.id
                                                        )
                                                    }
                                                    className="flex-1 rounded-lg border border-[#dedbd3] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#555] disabled:opacity-60"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                            )
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ClubProfile;