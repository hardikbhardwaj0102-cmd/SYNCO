import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    Clock3,
    Crown,
    Edit3,
    MoreHorizontal,
    Plus,
    Search,
    Settings,
    Shield,
    Trash2,
    UserCheck,
    UserPlus,
    Users,
    X,
} from "lucide-react";

// =========================================================
// API
// =========================================================

const RAW_API_URL =
    import.meta.env.VITE_API_URL ||
    "https://synco-backend-vi7b.onrender.com";

const API = RAW_API_URL
    .replace(/\/+$/, "")
    .replace(/\/api$/, "") + "/api";

// =========================================================
// HELPERS
// =========================================================

function firstDefined(...values) {
    return values.find(
        (value) =>
            value !== undefined &&
            value !== null &&
            value !== ""
    );
}


function getErrorMessage(data, fallback) {
    return firstDefined(
        data?.message,
        data?.error,
        fallback
    );
}


function formatDate(value) {
    if (!value) {
        return "Unknown";
    }

    try {
        return new Date(value).toLocaleDateString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                year: "numeric",
            }
        );
    } catch {
        return "Unknown";
    }
}


function getUserName(user) {
    if (!user) {
        return "Unknown Player";
    }

    return (
        user.username ||
        user.name ||
        "Unknown Player"
    );
}


function getUserInitials(user) {
    const name = getUserName(user);

    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(
            (part) =>
                part.charAt(0).toUpperCase()
        )
        .join("");
}


function getAvatar(user) {
    return firstDefined(
        user?.avatar,
        user?.avatarUrl,
        ""
    );
}


function getGameName(game) {
    if (!game) {
        return "Unknown Game";
    }

    return firstDefined(
        game.name,
        game.shortName,
        game.id,
        "Unknown Game"
    );
}


function formatRole(role) {
    const normalized =
        String(role || "MEMBER")
            .toUpperCase();

    if (normalized === "OWNER") {
        return "Owner";
    }

    if (normalized === "ADMIN") {
        return "Admin";
    }

    return "Member";
}


// =========================================================
// MODAL
// =========================================================

function Modal({
    title,
    subtitle,
    onClose,
    children,
    width = "max-w-2xl",
}) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div
                className={`w-full ${width} max-h-[92vh] overflow-hidden rounded-2xl border border-[#dedbd3] bg-white shadow-2xl`}
            >
                <div className="flex items-start justify-between border-b border-[#ebe8e1] px-6 py-5">
                    <div>
                        <h2 className="text-lg font-black tracking-tight text-[#151515]">
                            {title}
                        </h2>

                        {subtitle && (
                            <p className="mt-1 text-xs font-medium text-[#85878e]">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e0d9] text-[#777] transition hover:bg-[#f6f4ef] hover:text-black"
                    >
                        <X size={17} />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}


// =========================================================
// INPUT
// =========================================================

function Input({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    disabled = false,
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#777a82]">
                {label}
            </span>

            <input
                type={type}
                value={value}
                disabled={disabled}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full rounded-xl border border-[#dedbd3] bg-white px-4 py-3 text-sm font-medium text-[#171717] outline-none transition placeholder:text-[#aaa9a4] focus:border-[#9b8148] focus:ring-2 focus:ring-[#9b8148]/10 disabled:bg-[#f4f2ed]"
            />
        </label>
    );
}


// =========================================================
// TEXTAREA
// =========================================================

function Textarea({
    label,
    value,
    onChange,
    placeholder,
    rows = 4,
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#777a82]">
                {label}
            </span>

            <textarea
                rows={rows}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full resize-none rounded-xl border border-[#dedbd3] bg-white px-4 py-3 text-sm font-medium text-[#171717] outline-none transition placeholder:text-[#aaa9a4] focus:border-[#9b8148] focus:ring-2 focus:ring-[#9b8148]/10"
            />
        </label>
    );
}


// =========================================================
// SELECT
// =========================================================

function SelectField({
    label,
    value,
    onChange,
    children,
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#777a82]">
                {label}
            </span>

            <div className="relative">
                <select
                    value={value}
                    onChange={onChange}
                    className="w-full appearance-none rounded-xl border border-[#dedbd3] bg-white px-4 py-3 pr-10 text-sm font-medium text-[#171717] outline-none transition focus:border-[#9b8148] focus:ring-2 focus:ring-[#9b8148]/10"
                >
                    {children}
                </select>

                <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#85878e]"
                />
            </div>
        </label>
    );
}


// =========================================================
// TOGGLE
// =========================================================

function Toggle({
    label,
    description,
    checked,
    onChange,
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between rounded-xl border border-[#e1ded7] bg-[#faf9f6] p-4 text-left transition hover:border-[#cfc9bb]"
        >
            <div className="pr-5">
                <p className="text-sm font-black text-[#191919]">
                    {label}
                </p>

                {description && (
                    <p className="mt-1 text-xs leading-5 text-[#85878e]">
                        {description}
                    </p>
                )}
            </div>

            <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked
                    ? "bg-[#9b8148]"
                    : "bg-[#d5d2cb]"
                    }`}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked
                        ? "left-6"
                        : "left-1"
                        }`}
                />
            </span>
        </button>
    );
}


// =========================================================
// MAIN
// =========================================================

export default function ClubProfile() {

    const params = useParams();

    const clubId =
        params.clubId ||
        params.id;
    const navigate = useNavigate();


    // =====================================================
    // STATE
    // =====================================================

    const [club, setClub] = useState(null);

    const [members, setMembers] =
        useState([]);

    const [joinRequests, setJoinRequests] =
        useState([]);

    const [recruitmentPosts, setRecruitmentPosts] =
        useState([]);

    const [incomingInvites, setIncomingInvites] =
        useState([]);


    const [loading, setLoading] =
        useState(true);

    const [membersLoading, setMembersLoading] =
        useState(false);

    const [requestsLoading, setRequestsLoading] =
        useState(false);

    const [recruitmentLoading, setRecruitmentLoading] =
        useState(false);


    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");


    const [activeTab, setActiveTab] =
        useState("overview");


    const [inviteModal, setInviteModal] =
        useState(false);

    const [inviteSearch, setInviteSearch] =
        useState("");

    const [inviteResults, setInviteResults] =
        useState([]);

    const [inviteSearching, setInviteSearching] =
        useState(false);


    const [actionLoading, setActionLoading] =
        useState(false);

    const [openMemberMenu, setOpenMemberMenu] =
        useState(null);


    const [showSettings, setShowSettings] =
        useState(false);


    const [showDeleteClubConfirm, setShowDeleteClubConfirm] =
        useState(false);


    const [showJoinRequestModal, setShowJoinRequestModal] =
        useState(false);

    const [joinMessage, setJoinMessage] =
        useState("");


    const [showRecruitmentForm, setShowRecruitmentForm] =
        useState(false);

    const [editingRecruitment, setEditingRecruitment] =
        useState(null);


    const [showIncomingInvites, setShowIncomingInvites] =
        useState(false);


    const [settingsForm, setSettingsForm] =
        useState({
            name: "",
            tag: "",
            description: "",
            avatar: "",
            banner: "",
            region: "Global",
            gameId: "",
            isActive: true,
        });


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


    // =====================================================
    // MESSAGES
    // =====================================================

    function clearMessages() {
        setError("");
        setSuccess("");
    }


    function showSuccessMessage(message) {
        setError("");
        setSuccess(message);

        window.setTimeout(() => {
            setSuccess("");
        }, 3500);
    }


    function showErrorMessage(message) {
        setSuccess("");
        setError(message);

        window.setTimeout(() => {
            setError("");
        }, 5000);
    }
    // =========================================================
    // FETCH HELPER
    // =========================================================

    async function fetchJson(
        url,
        options = {}
    ) {
        let response;

        try {
            response = await fetch(
                url,
                {
                    credentials: "include",
                    ...options,
                    headers: {
                        "Content-Type":
                            "application/json",
                        ...(options.headers || {}),
                    },
                }
            );
        } catch (error) {
            console.error(
                "SYNCO API NETWORK ERROR:",
                {
                    url,
                    error,
                }
            );

            throw new Error(
                `Unable to connect to SYNCO backend. Check backend URL, CORS and Render status.`
            );
        }

        const data =
            await response
                .json()
                .catch(() => ({}));

        if (!response.ok) {
            console.error(
                "SYNCO API ERROR:",
                {
                    url,
                    status: response.status,
                    data,
                }
            );

            throw new Error(
                getErrorMessage(
                    data,
                    `Request failed with status ${response.status}.`
                )
            );
        }

        return data;
    }
    // =====================================================
    // NORMALIZE CLUB RESPONSE
    // =====================================================

    function normalizeClubResponse(data) {
        if (!data?.club) {
            return null;
        }

        return {
            ...data.club,

            currentUser:
                data.currentUser ||
                null,

            canManage:
                Boolean(
                    data.canManage
                ),

            isOwner:
                Boolean(
                    data.isOwner
                ),

            pendingJoinRequest:
                data.pendingJoinRequest ||
                null,
        };
    }


    // =====================================================
    // LOAD CLUB
    // =====================================================

    async function loadClub() {

        if (!clubId) {
            throw new Error(
                "Club ID is missing."
            );
        }


        try {

            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}`
                );


            const normalizedClub =
                normalizeClubResponse(
                    data
                );


            if (!normalizedClub) {
                throw new Error(
                    "Club not found."
                );
            }


            setClub(
                normalizedClub
            );


            return normalizedClub;

        } catch (err) {

            showErrorMessage(
                err.message
            );

            throw err;
        }
    }


    // =====================================================
    // LOAD MEMBERS
    // =====================================================

    async function loadMembers() {

        try {

            setMembersLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/members`
                );


            setMembers(
                data.members || []
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setMembersLoading(false);
        }
    }


    // =====================================================
    // LOAD JOIN REQUESTS
    // =====================================================

    async function loadJoinRequests(
        showErrorOnFailure = false
    ) {

        try {

            setRequestsLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/join-requests`
                );


            setJoinRequests(
                data.requests || []
            );

        } catch (err) {

            if (showErrorOnFailure) {
                showErrorMessage(
                    err.message
                );
            }

        } finally {

            setRequestsLoading(false);
        }
    }


    // =====================================================
    // LOAD RECRUITMENT
    // =====================================================

    async function loadRecruitment(
        includeClosed = false
    ) {

        try {

            setRecruitmentLoading(true);


            const query =
                includeClosed
                    ? "?includeClosed=true"
                    : "";


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/recruitment${query}`
                );


            setRecruitmentPosts(
                data.posts || []
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setRecruitmentLoading(false);
        }
    }


    // =====================================================
    // LOAD INVITES
    // =====================================================

    async function loadInvites() {

        try {

            const data =
                await fetchJson(
                    `${API}/clubs/invites/mine`
                );


            setIncomingInvites(
                data.invites || []
            );

        } catch {
            // Non-critical.
        }
    }


    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {

        let mounted = true;


        async function load() {

            try {

                setLoading(true);
                setError("");


                const [
                    clubResponse,
                    membersResponse,
                    inviteResponse,
                ] =
                    await Promise.all([
                        fetchJson(
                            `${API}/clubs/${clubId}`
                        ),

                        fetchJson(
                            `${API}/clubs/${clubId}/members`
                        ),

                        fetchJson(
                            `${API}/clubs/invites/mine`
                        ),
                    ]);


                if (!mounted) {
                    return;
                }


                const normalizedClub =
                    normalizeClubResponse(
                        clubResponse
                    );


                if (!normalizedClub) {
                    throw new Error(
                        "Club not found."
                    );
                }


                setClub(
                    normalizedClub
                );


                setMembers(
                    membersResponse.members ||
                    []
                );


                setIncomingInvites(
                    inviteResponse.invites ||
                    []
                );

            } catch (err) {

                if (mounted) {

                    setClub(null);

                    setError(
                        err.message ||
                        "Unable to load club."
                    );
                }

            } finally {

                if (mounted) {
                    setLoading(false);
                }
            }
        }


        if (clubId) {
            load();
        } else {
            setLoading(false);
            setError(
                "Club ID is missing."
            );
        }


        return () => {
            mounted = false;
        };

    }, [clubId]);


    // =====================================================
    // CURRENT USER / PERMISSIONS
    // =====================================================

    const currentUser =
        club?.currentUser ||
        null;


    const currentMembership =
        members.find(
            (member) =>
                String(
                    member.userId
                ) ===
                String(
                    currentUser?.id
                )
        );


    const isMember =
        Boolean(
            currentMembership
        );


    const isOwner =
        Boolean(
            club?.isOwner ||
            currentMembership?.role ===
            "OWNER"
        );


    const isAdmin =
        String(
            currentMembership?.role ||
            ""
        ).toUpperCase() ===
        "ADMIN";


    const canManage =
        Boolean(
            club?.canManage ||
            isOwner ||
            isAdmin
        );


    const pendingJoinRequest =
        club?.pendingJoinRequest ||
        null;


    const hasPendingRequest =
        Boolean(
            pendingJoinRequest
        );


    // =====================================================
    // RECRUITMENT TAB LOAD
    // =====================================================

    useEffect(() => {

        if (
            activeTab !==
            "recruitment"
        ) {
            return;
        }


        loadRecruitment(
            canManage
        );

    }, [
        activeTab,
        clubId,
        canManage,
    ]);


    // =====================================================
    // STATS
    // =====================================================

    const ownerCount =
        members.filter(
            (member) =>
                String(
                    member.role
                ).toUpperCase() ===
                "OWNER"
        ).length;


    const adminCount =
        members.filter(
            (member) =>
                String(
                    member.role
                ).toUpperCase() ===
                "ADMIN"
        ).length;


    const memberCount =
        members.length;


    // =====================================================
    // JOIN REQUEST
    // =====================================================

    function openJoinRequest() {

        clearMessages();

        setJoinMessage("");

        setShowJoinRequestModal(
            true
        );
    }


    async function sendJoinRequest() {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/join`,
                    {
                        method: "POST",
                        body:
                            JSON.stringify({
                                message:
                                    joinMessage.trim() ||
                                    null,
                            }),
                    }
                );


            setShowJoinRequestModal(
                false
            );

            setJoinMessage("");


            await loadClub();


            showSuccessMessage(
                data.message ||
                "Join request sent."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // CANCEL JOIN REQUEST
    // =====================================================

    async function cancelJoinRequest() {

        if (
            !pendingJoinRequest?.id
        ) {
            return;
        }


        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/join-requests/${pendingJoinRequest.id}/cancel`,
                    {
                        method: "POST",
                    }
                );


            await loadClub();


            showSuccessMessage(
                data.message ||
                "Join request cancelled."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // OPEN JOIN REQUESTS
    // =====================================================

    async function openJoinRequests() {

        clearMessages();

        setActiveTab(
            "overview"
        );


        await loadJoinRequests(
            true
        );
    }


    // =====================================================
    // APPROVE JOIN REQUEST
    // =====================================================

    async function approveJoinRequest(
        requestId
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/join-requests/${requestId}/approve`,
                    {
                        method: "POST",
                    }
                );


            await Promise.all([
                loadClub(),
                loadMembers(),
                loadJoinRequests(),
            ]);


            showSuccessMessage(
                data.message ||
                "Player approved."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // DISMISS JOIN REQUEST
    // =====================================================

    async function dismissJoinRequest(
        requestId
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/join-requests/${requestId}/dismiss`,
                    {
                        method: "POST",
                    }
                );


            await loadJoinRequests();


            showSuccessMessage(
                data.message ||
                "Join request dismissed."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // LEAVE CLUB
    // =====================================================

    async function leaveClub() {

        const confirmed =
            window.confirm(
                "Are you sure you want to leave this club?"
            );


        if (!confirmed) {
            return;
        }


        try {

            setActionLoading(true);


            const data =
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


            showSuccessMessage(
                data.message ||
                "You left the club."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // REMOVE MEMBER
    // =====================================================

    async function removeMember(
        userId
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/members/${userId}`,
                    {
                        method: "DELETE",
                    }
                );


            setOpenMemberMenu(
                null
            );


            await Promise.all([
                loadMembers(),
                loadClub(),
            ]);


            showSuccessMessage(
                data.message ||
                "Member removed."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // CHANGE ROLE
    // =====================================================

    async function changeRole(
        userId,
        role
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/members/${userId}/role`,
                    {
                        method: "PATCH",
                        body:
                            JSON.stringify({
                                role,
                            }),
                    }
                );


            setOpenMemberMenu(
                null
            );


            await loadMembers();


            showSuccessMessage(
                data.message ||
                "Member role updated."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // INVITE SEARCH
    // =====================================================

    useEffect(() => {

        if (
            !inviteModal ||
            inviteSearch.trim().length <
            2
        ) {

            setInviteResults([]);

            return;
        }


        const timer =
            window.setTimeout(
                async () => {

                    try {

                        setInviteSearching(
                            true
                        );


                        const data =
                            await fetchJson(
                                `${API}/clubs/users/search?q=${encodeURIComponent(
                                    inviteSearch.trim()
                                )}&clubId=${clubId}`
                            );


                        setInviteResults(
                            data.users ||
                            []
                        );

                    } catch (err) {

                        showErrorMessage(
                            err.message
                        );

                    } finally {

                        setInviteSearching(
                            false
                        );
                    }
                },
                300
            );


        return () => {
            window.clearTimeout(
                timer
            );
        };

    }, [
        inviteSearch,
        inviteModal,
        clubId,
    ]);


    // =====================================================
    // SEND INVITE
    // =====================================================

    async function sendInvite(
        userId
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/invites`,
                    {
                        method: "POST",
                        body:
                            JSON.stringify({
                                userId,
                            }),
                    }
                );


            setInviteSearch("");

            setInviteResults([]);


            showSuccessMessage(
                data.message ||
                "Invitation sent."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // ACCEPT INVITE
    // =====================================================

    async function acceptInvite(
        inviteId
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/invites/${inviteId}/accept`,
                    {
                        method: "POST",
                    }
                );


            await Promise.all([
                loadInvites(),
                loadClub(),
                loadMembers(),
            ]);


            showSuccessMessage(
                data.message ||
                "You joined the club."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // DECLINE INVITE
    // =====================================================

    async function declineInvite(
        inviteId
    ) {

        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/invites/${inviteId}/decline`,
                    {
                        method: "POST",
                    }
                );


            await loadInvites();


            showSuccessMessage(
                data.message ||
                "Invitation declined."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // SETTINGS
    // =====================================================

    function openSettings() {

        setSettingsForm({
            name:
                club?.name ||
                "",

            tag:
                club?.tag ||
                "",

            description:
                club?.description ||
                "",

            avatar:
                club?.avatar ||
                "",

            banner:
                club?.banner ||
                "",

            region:
                club?.region ||
                "Global",

            gameId:
                club?.gameId ||
                "",

            isActive:
                club?.isActive !==
                false,
        });


        setShowSettings(
            true
        );
    }


    async function saveSettings() {

        if (
            !settingsForm.name.trim()
        ) {
            showErrorMessage(
                "Club name is required."
            );

            return;
        }


        if (
            !settingsForm.tag.trim()
        ) {
            showErrorMessage(
                "Club tag is required."
            );

            return;
        }


        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}/settings`,
                    {
                        method: "PATCH",
                        body:
                            JSON.stringify({
                                ...settingsForm,
                            }),
                    }
                );


            const normalized =
                normalizeClubResponse(
                    data
                );


            if (normalized) {
                setClub(
                    normalized
                );
            } else if (data.club) {
                setClub({
                    ...club,
                    ...data.club,
                });
            }


            setShowSettings(
                false
            );


            showSuccessMessage(
                data.message ||
                "Club settings updated."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // DELETE CLUB
    // OWNER / CREATOR ONLY
    // =====================================================

    async function deleteClub() {

        if (!clubId || !isOwner) {
            return;
        }

        try {

            setActionLoading(true);

            const data =
                await fetchJson(
                    `${API}/clubs/${clubId}`,
                    {
                        method: "DELETE",
                    }
                );

            setShowDeleteClubConfirm(false);

            showSuccessMessage(
                data.message ||
                "Club deleted successfully."
            );

            navigate("/clubs");

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // RECRUITMENT CREATE
    // =====================================================

    function openRecruitmentCreate() {

        setEditingRecruitment(
            null
        );


        setRecruitmentForm({
            title: "",
            description: "",
            gameId:
                club?.gameId ||
                "",
            role: "",
            rankRequirement: "",
            region:
                club?.region ||
                "",
            micRequired: false,
            status: "OPEN",
        });


        setShowRecruitmentForm(
            true
        );
    }


    // =====================================================
    // RECRUITMENT EDIT
    // =====================================================

    function openRecruitmentEdit(
        post
    ) {

        setEditingRecruitment(
            post
        );


        setRecruitmentForm({
            title:
                post.title ||
                "",

            description:
                post.description ||
                "",

            gameId:
                post.gameId ||
                club?.gameId ||
                "",

            role:
                post.role ||
                "",

            rankRequirement:
                post.rankRequirement ||
                "",

            region:
                post.region ||
                club?.region ||
                "",

            micRequired:
                Boolean(
                    post.micRequired
                ),

            status:
                post.status ||
                "OPEN",
        });


        setShowRecruitmentForm(
            true
        );
    }


    // =====================================================
    // SAVE RECRUITMENT
    // =====================================================

    async function saveRecruitment() {

        if (
            !recruitmentForm.title.trim()
        ) {
            showErrorMessage(
                "Recruitment title is required."
            );

            return;
        }


        if (
            !recruitmentForm.description.trim()
        ) {
            showErrorMessage(
                "Recruitment description is required."
            );

            return;
        }


        if (
            !recruitmentForm.gameId
        ) {
            showErrorMessage(
                "Please select a game."
            );

            return;
        }


        try {

            setActionLoading(true);


            const isEditing =
                Boolean(
                    editingRecruitment
                );


            const endpoint =
                isEditing
                    ? `${API}/clubs/recruitment/${editingRecruitment.id}`
                    : `${API}/clubs/${clubId}/recruitment`;


            const data =
                await fetchJson(
                    endpoint,
                    {
                        method:
                            isEditing
                                ? "PATCH"
                                : "POST",

                        body:
                            JSON.stringify(
                                recruitmentForm
                            ),
                    }
                );


            setShowRecruitmentForm(
                false
            );

            setEditingRecruitment(
                null
            );


            await loadRecruitment(
                canManage
            );


            showSuccessMessage(
                data.message ||
                (
                    isEditing
                        ? "Recruitment post updated."
                        : "Recruitment post created."
                )
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // TOGGLE RECRUITMENT
    // =====================================================

    async function toggleRecruitment(
        post
    ) {

        try {

            setActionLoading(true);


            const action =
                post.status ===
                    "OPEN"
                    ? "close"
                    : "open";


            const data =
                await fetchJson(
                    `${API}/clubs/recruitment/${post.id}/${action}`,
                    {
                        method: "POST",
                    }
                );


            await loadRecruitment(
                canManage
            );


            showSuccessMessage(
                data.message ||
                "Recruitment updated."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // DELETE RECRUITMENT
    // =====================================================

    async function deleteRecruitment(
        post
    ) {

        const confirmed =
            window.confirm(
                "Delete this recruitment post?"
            );


        if (!confirmed) {
            return;
        }


        try {

            setActionLoading(true);


            const data =
                await fetchJson(
                    `${API}/clubs/recruitment/${post.id}`,
                    {
                        method: "DELETE",
                    }
                );


            await loadRecruitment(
                canManage
            );


            showSuccessMessage(
                data.message ||
                "Recruitment post deleted."
            );

        } catch (err) {

            showErrorMessage(
                err.message
            );

        } finally {

            setActionLoading(false);
        }
    }


    // =====================================================
    // TABS
    // =====================================================

    const tabs = [
        {
            id: "overview",
            label: "Overview",
        },
        {
            id: "members",
            label: "Members",
        },
        {
            id: "recruitment",
            label: "Recruitment",
        },
        {
            id: "tournaments",
            label: "Tournaments",
        },
        {
            id: "stats",
            label: "Stats",
        },
    ];


    // =====================================================
    // MEMBER PREVIEW
    // =====================================================

    const memberPreview =
        useMemo(
            () =>
                members.slice(
                    0,
                    6
                ),
            [members]
        );


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (
            <div className="min-h-screen bg-[#f6f5f1] px-6 py-10">
                <div className="mx-auto max-w-7xl animate-pulse">

                    <div className="h-72 rounded-3xl bg-[#e8e5dd]" />

                    <div className="mt-6 h-16 rounded-2xl bg-[#e8e5dd]" />

                    <div className="mt-6 grid gap-6 lg:grid-cols-3">

                        <div className="h-80 rounded-2xl bg-[#e8e5dd]" />

                        <div className="h-80 rounded-2xl bg-[#e8e5dd] lg:col-span-2" />

                    </div>

                </div>
            </div>
        );
    }


    // =====================================================
    // ERROR / NOT FOUND
    // =====================================================

    if (!club) {

        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-6">

                <div className="w-full max-w-md rounded-2xl border border-[#dedbd3] bg-white p-8 text-center shadow-sm">

                    <h1 className="text-xl font-black">
                        Club not found
                    </h1>

                    <p className="mt-2 text-sm text-[#85878e]">
                        {error ||
                            "This club may have been removed or is no longer available."}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/clubs")
                        }
                        className="mt-6 rounded-xl bg-[#171717] px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#2b2b2b]"
                    >
                        Back to Clubs
                    </button>

                </div>

            </div>
        );
    }


    // =====================================================
    // RENDER
    // =====================================================

    return (
        <div className="min-h-screen bg-[#f6f5f1] text-[#171717]">


            {/* =================================================
                TOP NAV
            ================================================= */}

            <div className="border-b border-[#e1ded7] bg-white">

                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">

                    <button
                        type="button"
                        onClick={() =>
                            navigate("/clubs")
                        }
                        className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#777a82] transition hover:text-black"
                    >
                        <ArrowLeft size={16} />
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
                                    className="relative flex items-center gap-2 rounded-xl border border-[#dedbd3] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider transition hover:bg-[#f7f5f0]"
                                >
                                    <UserPlus
                                        size={15}
                                    />

                                    Invitations

                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#9b8148] px-1 text-[9px] font-black text-white">
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
                                className="flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#2b2b2b]"
                            >
                                <Settings
                                    size={15}
                                />
                                Settings
                            </button>
                        )}

                    </div>

                </div>

            </div>


            {/* =================================================
                HERO
            ================================================= */}

            <section className="border-b border-[#e1ded7] bg-white">

                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                    <div className="relative overflow-hidden rounded-b-3xl border-x border-b border-[#e1ded7] bg-[#181818]">

                        {club.banner ? (

                            <img
                                src={club.banner}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover opacity-45"
                            />

                        ) : (

                            <div className="absolute inset-0 bg-[linear-gradient(135deg,#191919_0%,#24231f_55%,#151515_100%)]" />

                        )}


                        <div className="absolute inset-0 bg-black/45" />


                        <div className="relative px-6 py-12 sm:px-10 lg:px-14 lg:py-16">

                            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">


                                <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center">


                                    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-[#252525] shadow-2xl">

                                        {club.avatar ? (

                                            <img
                                                src={club.avatar}
                                                alt={club.name}
                                                className="h-full w-full object-cover"
                                            />

                                        ) : (

                                            <Shield
                                                size={46}
                                                className="text-[#c7aa6a]"
                                            />

                                        )}

                                    </div>


                                    <div className="min-w-0">

                                        <div className="mb-3 flex flex-wrap items-center gap-2">

                                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/80">
                                                [
                                                {
                                                    club.tag
                                                }
                                                ]
                                            </span>




                                        </div>


                                        <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-5xl">
                                            {
                                                club.name
                                            }
                                        </h1>


                                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-white/65">

                                            <span>
                                                {
                                                    getGameName(
                                                        club.game
                                                    )
                                                }
                                            </span>

                                            <span className="h-1 w-1 rounded-full bg-white/30" />

                                            <span>
                                                {
                                                    club.region ||
                                                    "Global"
                                                }
                                            </span>

                                            <span className="h-1 w-1 rounded-full bg-white/30" />

                                            <span>
                                                {
                                                    memberCount
                                                }{" "}
                                                members
                                            </span>

                                            <span className="h-1 w-1 rounded-full bg-white/30" />

                                            <span>
                                                Since{" "}
                                                {
                                                    formatDate(
                                                        club.createdAt
                                                    )
                                                }
                                            </span>

                                        </div>


                                        {club.description && (

                                            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/65">
                                                {
                                                    club.description
                                                }
                                            </p>

                                        )}

                                    </div>

                                </div>


                                <div className="flex flex-wrap gap-3">

                                    {!isMember &&
                                        !isOwner &&
                                        !hasPendingRequest && (

                                            <button
                                                type="button"
                                                disabled={
                                                    actionLoading
                                                }
                                                onClick={
                                                    openJoinRequest
                                                }
                                                className="rounded-xl bg-white px-5 py-3 text-xs font-black uppercase tracking-wider text-[#171717] transition hover:bg-[#f0ede6] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Request to Join
                                            </button>

                                        )}


                                    {!isMember &&
                                        !isOwner &&
                                        hasPendingRequest && (

                                            <>
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-white/70"
                                                >
                                                    <Clock3
                                                        size={15}
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
                                                    className="rounded-xl border border-white/15 bg-transparent px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-white/10 disabled:opacity-60"
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
                                                className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-white/15 disabled:opacity-60"
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
                                            className="flex items-center gap-2 rounded-xl border border-[#c7aa6a]/30 bg-[#c7aa6a]/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-[#e0c78e] transition hover:bg-[#c7aa6a]/20"
                                        >
                                            <UserPlus
                                                size={15}
                                            />
                                            Invite Friends
                                        </button>

                                    )}


                                    {isOwner && (

                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() =>
                                                setShowDeleteClubConfirm(
                                                    true
                                                )
                                            }
                                            className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Trash2
                                                size={15}
                                            />
                                            Delete Club
                                        </button>

                                    )}

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </section>


            {/* =================================================
                MESSAGES
            ================================================= */}

            {(error || success) && (

                <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">

                    {error && (

                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {error}
                        </div>

                    )}


                    {success && (

                        <div className="rounded-xl border border-[#d9cfb7] bg-[#f8f4ea] px-4 py-3 text-sm font-semibold text-[#806a3c]">
                            {success}
                        </div>

                    )}

                </div>

            )}


            {/* =================================================
                TABS
            ================================================= */}

            <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">

                <div className="flex overflow-x-auto border-b border-[#dedbd3]">

                    {tabs.map(
                        (tab) => (

                            <button
                                key={tab.id}
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        tab.id
                                    )
                                }
                                className={`whitespace-nowrap border-b-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${activeTab ===
                                    tab.id
                                    ? "border-[#9b8148] text-[#9b8148]"
                                    : "border-transparent text-[#85878e] hover:text-[#222]"
                                    }`}
                            >
                                {
                                    tab.label
                                }
                            </button>

                        )
                    )}

                </div>

            </div>


            {/* =================================================
                MAIN
            ================================================= */}

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">


                {/* =================================================
                    OVERVIEW
                ================================================= */}

                {activeTab ===
                    "overview" && (

                        <div className="grid gap-6 lg:grid-cols-3">

                            <div className="space-y-6 lg:col-span-2">


                                {/* ABOUT */}

                                <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">

                                    <div className="flex items-center justify-between">

                                        <div>

                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                                Club
                                            </p>

                                            <h2 className="mt-1 text-xl font-black">
                                                About
                                            </h2>

                                        </div>


                                        <Shield
                                            size={19}
                                            className="text-[#9b8148]"
                                        />

                                    </div>


                                    <p className="mt-5 text-sm leading-7 text-[#66686e]">
                                        {
                                            club.description ||
                                            "This club has not added a description yet."
                                        }
                                    </p>

                                </section>


                                {/* MEMBERS PREVIEW */}

                                <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">

                                    <div className="flex items-center justify-between">

                                        <div>

                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                                Community
                                            </p>

                                            <h2 className="mt-1 text-xl font-black">
                                                Members
                                            </h2>

                                        </div>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                setActiveTab(
                                                    "members"
                                                )
                                            }
                                            className="text-[10px] font-black uppercase tracking-wider text-[#9b8148]"
                                        >
                                            View All
                                        </button>

                                    </div>


                                    <div className="mt-6 grid gap-3 sm:grid-cols-2">

                                        {memberPreview.map(
                                            (member) => {

                                                const avatar =
                                                    getAvatar(
                                                        member.user
                                                    );


                                                return (

                                                    <div
                                                        key={
                                                            member.id
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
                                                                {
                                                                    getUserInitials(
                                                                        member.user
                                                                    )
                                                                }
                                                            </div>

                                                        )}


                                                        <div className="min-w-0 flex-1">

                                                            <p className="truncate text-sm font-black">
                                                                {
                                                                    getUserName(
                                                                        member.user
                                                                    )
                                                                }
                                                            </p>

                                                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#8a8b90]">
                                                                {
                                                                    formatRole(
                                                                        member.role
                                                                    )
                                                                }
                                                            </p>

                                                        </div>

                                                    </div>

                                                );
                                            }
                                        )}


                                        {memberPreview.length ===
                                            0 && (

                                                <div className="col-span-full rounded-xl border border-dashed border-[#dedbd3] py-10 text-center text-xs font-bold text-[#999]">
                                                    No members yet.
                                                </div>

                                            )}

                                    </div>

                                </section>


                                {/* JOIN REQUESTS */}

                                {canManage && (

                                    <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">

                                        <div className="flex items-start justify-between">

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
                                                onClick={() =>
                                                    loadJoinRequests(
                                                        true
                                                    )
                                                }
                                                className="rounded-lg border border-[#dedbd3] p-2 text-[#777] hover:bg-[#f5f3ee]"
                                            >
                                                <Search
                                                    size={16}
                                                />
                                            </button>

                                        </div>


                                        <div className="mt-5">

                                            {requestsLoading ? (

                                                <div className="py-8 text-center text-xs font-bold text-[#888]">
                                                    Loading requests...
                                                </div>

                                            ) : joinRequests.length ===
                                                0 ? (

                                                <div className="rounded-xl border border-dashed border-[#dedbd3] px-5 py-8 text-center">

                                                    <UserCheck
                                                        size={22}
                                                        className="mx-auto text-[#aaa]"
                                                    />

                                                    <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#777]">
                                                        No pending requests
                                                    </p>

                                                </div>

                                            ) : (

                                                <div className="space-y-3">

                                                    {joinRequests.map(
                                                        (
                                                            request
                                                        ) => {

                                                            const requester =
                                                                request.user;


                                                            return (

                                                                <div
                                                                    key={
                                                                        request.id
                                                                    }
                                                                    className="rounded-xl border border-[#ebe8e1] p-4"
                                                                >

                                                                    <div className="flex items-start gap-3">

                                                                        {getAvatar(
                                                                            requester
                                                                        ) ? (

                                                                            <img
                                                                                src={getAvatar(
                                                                                    requester
                                                                                )}
                                                                                alt=""
                                                                                className="h-11 w-11 rounded-xl object-cover"
                                                                            />

                                                                        ) : (

                                                                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ece9e2] text-xs font-black">
                                                                                {
                                                                                    getUserInitials(
                                                                                        requester
                                                                                    )
                                                                                }
                                                                            </div>

                                                                        )}


                                                                        <div className="min-w-0 flex-1">

                                                                            <p className="text-sm font-black">
                                                                                {
                                                                                    getUserName(
                                                                                        requester
                                                                                    )
                                                                                }
                                                                            </p>

                                                                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#929398]">
                                                                                Requested{" "}
                                                                                {
                                                                                    formatDate(
                                                                                        request.createdAt
                                                                                    )
                                                                                }
                                                                            </p>


                                                                            {request.message && (

                                                                                <p className="mt-3 rounded-lg bg-[#f7f5f0] p-3 text-xs leading-5 text-[#67696f]">
                                                                                    {
                                                                                        request.message
                                                                                    }
                                                                                </p>

                                                                            )}

                                                                        </div>

                                                                    </div>


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
                                                                            className="flex-1 rounded-lg bg-[#171717] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-[#2b2b2b] disabled:opacity-60"
                                                                        >
                                                                            Approve
                                                                        </button>


                                                                        <button
                                                                            type="button"
                                                                            disabled={
                                                                                actionLoading
                                                                            }
                                                                            onClick={() =>
                                                                                dismissJoinRequest(
                                                                                    request.id
                                                                                )
                                                                            }
                                                                            className="flex-1 rounded-lg border border-[#dedbd3] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#555] hover:bg-[#f6f4ef] disabled:opacity-60"
                                                                        >
                                                                            Dismiss
                                                                        </button>

                                                                    </div>

                                                                </div>

                                                            );
                                                        }
                                                    )}

                                                </div>

                                            )}

                                        </div>

                                    </section>

                                )}

                            </div>


                            {/* SIDEBAR */}

                            <aside className="space-y-6">


                                <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">

                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                        Club Info
                                    </p>


                                    <div className="mt-5 space-y-4">

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[#85878e]">
                                                Game
                                            </span>

                                            <span className="text-xs font-black">
                                                {
                                                    getGameName(
                                                        club.game
                                                    )
                                                }
                                            </span>
                                        </div>


                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[#85878e]">
                                                Region
                                            </span>

                                            <span className="text-xs font-black">
                                                {
                                                    club.region ||
                                                    "Global"
                                                }
                                            </span>
                                        </div>





                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[#85878e]">
                                                Club Level
                                            </span>

                                            <span className="text-xs font-black">
                                                {
                                                    club.level ||
                                                    club.clubLevel ||
                                                    1
                                                }
                                            </span>
                                        </div>


                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[#85878e]">
                                                SYNCO Points
                                            </span>

                                            <span className="text-xs font-black">
                                                {
                                                    club.syncoPoints ||
                                                    0
                                                }
                                            </span>
                                        </div>

                                    </div>

                                </section>


                                <section className="rounded-2xl border border-[#dedbd3] bg-white p-6 shadow-sm">

                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b8148]">
                                        Statistics
                                    </p>


                                    <div className="mt-5 grid grid-cols-2 gap-3">


                                        <div className="rounded-xl bg-[#f7f5f0] p-4">

                                            <Users
                                                size={16}
                                                className="text-[#8a8a86]"
                                            />

                                            <p className="mt-3 text-2xl font-black">
                                                {
                                                    memberCount
                                                }
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#898a8e]">
                                                Members
                                            </p>

                                        </div>


                                        <div className="rounded-xl bg-[#f7f5f0] p-4">

                                            <Shield
                                                size={16}
                                                className="text-[#8a8a86]"
                                            />

                                            <p className="mt-3 text-2xl font-black">
                                                {
                                                    adminCount
                                                }
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#898a8e]">
                                                Admins
                                            </p>

                                        </div>


                                        <div className="rounded-xl bg-[#f7f5f0] p-4">

                                            <Crown
                                                size={16}
                                                className="text-[#8a8a86]"
                                            />

                                            <p className="mt-3 text-2xl font-black">
                                                {
                                                    ownerCount
                                                }
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#898a8e]">
                                                Owners
                                            </p>

                                        </div>


                                        <div className="rounded-xl bg-[#f7f5f0] p-4">

                                            <Clock3
                                                size={16}
                                                className="text-[#8a8a86]"
                                            />

                                            <p className="mt-3 text-sm font-black">
                                                {
                                                    formatDate(
                                                        club.createdAt
                                                    )
                                                }
                                            </p>

                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#8a8a8e]">
                                                Created
                                            </p>

                                        </div>

                                    </div>

                                </section>

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
                                        Community
                                    </p>

                                    <h2 className="mt-1 text-2xl font-black">
                                        Club Members
                                    </h2>

                                    <p className="mt-1 text-xs text-[#85878e]">
                                        {
                                            memberCount
                                        }{" "}
                                        members in this club.
                                    </p>

                                </div>


                                {canManage && (

                                    <div className="flex gap-2">

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setInviteModal(
                                                    true
                                                )
                                            }
                                            className="flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-[#2b2b2b]"
                                        >
                                            <UserPlus
                                                size={15}
                                            />
                                            Invite Friend
                                        </button>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                loadJoinRequests(
                                                    true
                                                )
                                            }
                                            className="flex items-center gap-2 rounded-xl border border-[#dedbd3] px-4 py-3 text-xs font-black uppercase tracking-wider text-[#555] hover:bg-[#f7f5f0]"
                                        >
                                            <UserCheck
                                                size={15}
                                            />
                                            Requests
                                        </button>

                                    </div>

                                )}

                            </div>


                            {membersLoading ? (

                                <div className="py-16 text-center text-xs font-bold text-[#888]">
                                    Loading members...
                                </div>

                            ) : (

                                <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">

                                    {members.map(
                                        (member) => {

                                            const avatar =
                                                getAvatar(
                                                    member.user
                                                );


                                            const memberIsOwner =
                                                String(
                                                    member.role
                                                ).toUpperCase() ===
                                                "OWNER";


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
                                                                {
                                                                    getUserInitials(
                                                                        member.user
                                                                    )
                                                                }
                                                            </div>

                                                        )}


                                                        <div className="min-w-0 flex-1">

                                                            <p className="truncate text-sm font-black">
                                                                {
                                                                    getUserName(
                                                                        member.user
                                                                    )
                                                                }
                                                            </p>

                                                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#88898e]">
                                                                {
                                                                    formatRole(
                                                                        member.role
                                                                    )
                                                                }
                                                            </p>

                                                        </div>


                                                        {memberIsOwner ? (

                                                            <Crown
                                                                size={16}
                                                                className="text-[#9b8148]"
                                                            />

                                                        ) : (

                                                            canManage &&
                                                            String(
                                                                member.userId
                                                            ) !==
                                                            String(
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
                                                                        size={17}
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
                                                                            String(
                                                                                member.role
                                                                            ).toUpperCase() ===
                                                                                "ADMIN"
                                                                                ? "MEMBER"
                                                                                : "ADMIN"
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider hover:bg-[#f6f4ef]"
                                                                >

                                                                    <Shield
                                                                        size={14}
                                                                    />

                                                                    {String(
                                                                        member.role
                                                                    ).toUpperCase() ===
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
                                                                        size={14}
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
                                            size={15}
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
                                        size={28}
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
                                        (post) => (

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
                                                                    size={14}
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
                                                                    size={14}
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
                                                            {
                                                                getGameName(
                                                                    post.game
                                                                )
                                                            }
                                                        </p>

                                                    </div>


                                                    <div className="rounded-xl bg-[#f7f5f0] p-3">

                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#999]">
                                                            Rank
                                                        </p>

                                                        <p className="mt-1 text-xs font-black">
                                                            {
                                                                post.rankRequirement ||
                                                                "Any"
                                                            }
                                                        </p>

                                                    </div>


                                                    <div className="rounded-xl bg-[#f7f5f0] p-3">

                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#999]">
                                                            Region
                                                        </p>

                                                        <p className="mt-1 text-xs font-black">
                                                            {
                                                                post.region ||
                                                                "Any"
                                                            }
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
                                                        disabled={
                                                            actionLoading
                                                        }
                                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dedbd3] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#555] hover:bg-[#f6f4ef] disabled:opacity-60"
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
                                    size={24}
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
                                        {
                                            club.level ||
                                            club.clubLevel ||
                                            1
                                        }
                                    </p>

                                </div>


                                <div className="rounded-2xl bg-[#f7f5f0] p-5">

                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#999]">
                                        SYNCO Points
                                    </p>

                                    <p className="mt-3 text-3xl font-black">
                                        {
                                            club.syncoPoints ||
                                            0
                                        }
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
                        onChange={(event) =>
                            setJoinMessage(
                                event.target.value.slice(
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
                                onChange={(event) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            name:
                                                event.target.value,
                                        })
                                    )
                                }
                            />


                            <Input
                                label="Tag"
                                value={
                                    settingsForm.tag
                                }
                                onChange={(event) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            tag:
                                                event.target.value
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
                            onChange={(event) =>
                                setSettingsForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        description:
                                            event.target.value,
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
                                onChange={(event) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            avatar:
                                                event.target.value,
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
                                onChange={(event) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            banner:
                                                event.target.value,
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
                                onChange={(event) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            region:
                                                event.target.value,
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
                                onChange={(event) =>
                                    setSettingsForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            gameId:
                                                event.target.value,
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
                                            club.game.id
                                        }
                                    >
                                        {
                                            getGameName(
                                                club.game
                                            )
                                        }
                                    </option>

                                )}

                            </SelectField>

                        </div>





                        <div className="space-y-3">





                            <div className="rounded-xl border border-[#e1ded7] bg-[#faf9f6] p-4">

                                <div className="flex items-start gap-3">

                                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0e9da]">

                                        <UserCheck
                                            size={15}
                                            className="text-[#9b8148]"
                                        />

                                    </div>


                                    <div>

                                        <p className="text-sm font-black">
                                            Join approval
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-[#85878e]">
                                            Every player who requests to join is reviewed by the owner or an admin.
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
                                    onChange={(value) =>
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
                DELETE CLUB CONFIRMATION
            ================================================= */}

            {showDeleteClubConfirm && (

                <Modal
                    title="Delete Club"
                    subtitle="This action is permanent."
                    onClose={() => {
                        if (!actionLoading) {
                            setShowDeleteClubConfirm(
                                false
                            );
                        }
                    }}
                    width="max-w-lg"
                >

                    <div className="space-y-6">

                        <div className="rounded-xl border border-red-200 bg-red-50 p-5">

                            <div className="flex items-start gap-3">

                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm">
                                    <Trash2
                                        size={18}
                                    />
                                </div>

                                <div>

                                    <p className="text-sm font-black text-[#171717]">
                                        Permanently delete {club.name}?
                                    </p>

                                    <p className="mt-2 text-xs leading-5 text-[#777a82]">
                                        This will permanently remove the club and its club data. This action cannot be undone.
                                    </p>

                                </div>

                            </div>

                        </div>


                        {error && (

                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                                {error}
                            </div>

                        )}


                        <div className="flex justify-end gap-3 border-t border-[#ebe8e1] pt-5">

                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                    setShowDeleteClubConfirm(
                                        false
                                    )
                                }
                                className="rounded-xl border border-[#dedbd3] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#555] disabled:opacity-60"
                            >
                                Cancel
                            </button>


                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={
                                    deleteClub
                                }
                                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Trash2
                                    size={14}
                                />

                                {actionLoading
                                    ? "Deleting..."
                                    : "Delete Club"}
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
                            onChange={(event) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        title:
                                            event.target.value,
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
                            onChange={(event) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        description:
                                            event.target.value,
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
                                onChange={(event) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            gameId:
                                                event.target.value,
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
                                            club.game.id
                                        }
                                    >
                                        {
                                            getGameName(
                                                club.game
                                            )
                                        }
                                    </option>

                                )}

                            </SelectField>


                            <Input
                                label="Role"
                                value={
                                    recruitmentForm.role
                                }
                                onChange={(event) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            role:
                                                event.target.value,
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
                                onChange={(event) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            rankRequirement:
                                                event.target.value,
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
                                onChange={(event) =>
                                    setRecruitmentForm(
                                        (
                                            previous
                                        ) => ({
                                            ...previous,
                                            region:
                                                event.target.value,
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
                            onChange={(value) =>
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
                            onChange={(event) =>
                                setRecruitmentForm(
                                    (
                                        previous
                                    ) => ({
                                        ...previous,
                                        status:
                                            event.target.value,
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
                    title="Invite Friends"
                    subtitle="Search your friends and invite them to this club."
                    onClose={() => {
                        setInviteModal(
                            false
                        );

                        setInviteSearch("");

                        setInviteResults([]);
                    }}
                    width="max-w-xl"
                >

                    <div className="relative">

                        <Search
                            size={17}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999]"
                        />


                        <input
                            value={
                                inviteSearch
                            }
                            onChange={(event) =>
                                setInviteSearch(
                                    event.target.value
                                )
                            }
                            placeholder="Search your friends by username, name or SYNCO UID"
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
                            inviteSearch.trim().length >=
                            2 &&
                            inviteResults.length ===
                            0 && (

                                <div className="rounded-xl border border-dashed border-[#dedbd3] py-10 text-center text-xs font-bold text-[#888]">
                                    No friends found.
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
                                                            {
                                                                getUserInitials(
                                                                    player
                                                                )
                                                            }
                                                        </div>

                                                    )}


                                                    <div className="min-w-0 flex-1">

                                                        <p className="truncate text-sm font-black">
                                                            {
                                                                getUserName(
                                                                    player
                                                                )
                                                            }
                                                        </p>

                                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#929398]">
                                                            UID:{" "}
                                                            {
                                                                player.uid ||
                                                                "—"
                                                            }
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
                                                            size={18}
                                                            className="text-[#9b8148]"
                                                        />

                                                    )}

                                                </div>


                                                <div className="min-w-0 flex-1">

                                                    <p className="truncate text-sm font-black">
                                                        {
                                                            invitedClub?.name ||
                                                            "Club"
                                                        }
                                                    </p>

                                                    <p className="mt-1 text-[10px] font-bold text-[#898a8e]">
                                                        Invited by{" "}
                                                        {
                                                            getUserName(
                                                                invite.inviter
                                                            )
                                                        }
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
}