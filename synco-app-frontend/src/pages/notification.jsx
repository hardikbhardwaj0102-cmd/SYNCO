import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    Bell,
    Check,
    CheckCheck,
    ChevronRight,
    CircleAlert,
    Clock,
    Crown,
    Gamepad2,
    Loader2,
    RefreshCw,
    Shield,
    Trophy,
    UserPlus,
    Users,
    X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

const Notification = () => {
    const navigate = useNavigate();

    // =========================================================
    // STATE
    // =========================================================

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [filter, setFilter] = useState("all");

    const [actionId, setActionId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    // =========================================================
    // API HELPER
    // =========================================================

    const apiRequest = async (url, options = {}) => {
        const response = await fetch(`${API_URL}${url}`, {
            credentials: "include",

            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },

            ...options,
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Something went wrong."
            );
        }

        return data;
    };

    // =========================================================
    // LOAD NOTIFICATIONS
    // =========================================================

    const loadNotifications = async (
        showRefreshLoader = false
    ) => {
        try {
            if (showRefreshLoader) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const data = await apiRequest(
                "/api/notifications"
            );

            setNotifications(
                data.notifications ||
                data.data ||
                []
            );

            setUnreadCount(
                Number(data.unreadCount || 0)
            );

        } catch (err) {

            setError(
                err.message ||
                "Unable to load notifications."
            );

        } finally {

            setLoading(false);
            setRefreshing(false);
        }
    };

    // =========================================================
    // INITIAL LOAD
    // =========================================================

    useEffect(() => {
        loadNotifications();
    }, []);

    // =========================================================
    // MARK ONE AS READ
    // =========================================================

    const markAsRead = async (notification) => {

        if (
            notification.isRead ||
            notification.is_read
        ) {
            return;
        }

        const notificationId =
            notification.id;

        if (!notificationId) {
            return;
        }

        try {

            setActionId(notificationId);

            await apiRequest(
                `/api/notifications/${notificationId}/read`,
                {
                    method: "PATCH",
                }
            );

            setNotifications((previous) =>
                previous.map((item) =>
                    Number(item.id) ===
                        Number(notificationId)
                        ? {
                            ...item,
                            isRead: true,
                            is_read: true,
                        }
                        : item
                )
            );

            setUnreadCount((previous) =>
                Math.max(0, previous - 1)
            );

        } catch (err) {

            setError(
                err.message ||
                "Unable to mark notification as read."
            );

        } finally {

            setActionId(null);
        }
    };

    // =========================================================
    // MARK ALL AS READ
    // =========================================================

    const markAllAsRead = async () => {

        if (unreadCount === 0) {
            return;
        }

        try {

            setMarkingAll(true);
            setError("");
            setSuccess("");

            await apiRequest(
                "/api/notifications/read-all",
                {
                    method: "PATCH",
                }
            );

            setNotifications((previous) =>
                previous.map((item) => ({
                    ...item,
                    isRead: true,
                    is_read: true,
                }))
            );

            setUnreadCount(0);

            setSuccess(
                "All notifications marked as read."
            );

        } catch (err) {

            setError(
                err.message ||
                "Unable to mark notifications as read."
            );

        } finally {

            setMarkingAll(false);
        }
    };

    // =========================================================
    // CLUB INVITE ACTION
    // =========================================================

    const handleClubInvite = async (
        notification,
        action
    ) => {

        const data =
            notification?.data || {};

        const inviteId =
            data.inviteId ??
            data.invite_id ??
            notification.referenceId ??
            notification.reference_id;

        if (!inviteId) {

            setError(
                "This invitation is missing its invite ID."
            );

            return;
        }

        try {

            setActionId(
                `${action}-${notification.id}`
            );

            setError("");
            setSuccess("");

            const endpoint =
                action === "accept"
                    ? `/api/clubs/invites/${inviteId}/accept`
                    : `/api/clubs/invites/${inviteId}/decline`;

            await apiRequest(
                endpoint,
                {
                    method: "POST",
                }
            );

            // -------------------------------------------------
            // Mark notification as read locally
            // -------------------------------------------------

            setNotifications((previous) =>
                previous.map((item) =>
                    Number(item.id) ===
                        Number(notification.id)
                        ? {
                            ...item,
                            isRead: true,
                            is_read: true,
                        }
                        : item
                )
            );

            setUnreadCount((previous) => {

                const wasUnread =
                    !(
                        notification.isRead ||
                        notification.is_read
                    );

                return wasUnread
                    ? Math.max(0, previous - 1)
                    : previous;
            });

            if (action === "accept") {

                setSuccess(
                    `You joined ${data.clubName ||
                    data.club_name ||
                    "the club"
                    }.`
                );

                const clubId =
                    data.clubId ??
                    data.club_id;

                if (clubId) {

                    setTimeout(() => {

                        navigate(
                            `/clubs/${clubId}`
                        );

                    }, 500);
                }

            } else {

                setSuccess(
                    "Club invitation declined."
                );
            }

        } catch (err) {

            setError(
                err.message ||
                `Unable to ${action} invitation.`
            );

        } finally {

            setActionId(null);
        }
    };

    // =========================================================
    // NOTIFICATION CLICK
    // =========================================================

    const handleNotificationClick = async (
        notification
    ) => {

        const wasUnread =
            !(
                notification.isRead ||
                notification.is_read
            );

        if (wasUnread) {
            await markAsRead(notification);
        }

        const type =
            notification.type ||
            notification.notificationType ||
            notification.notification_type ||
            "";

        const normalizedType =
            String(type).toUpperCase();

        const data =
            notification.data || {};

        // -----------------------------------------------------
        // ORGANIZER APPLICATION
        // -----------------------------------------------------

        if (
            normalizedType ===
            "ORGANIZER_APPLICATION"
        ) {

            const applicationId =
                data.applicationId ??
                data.application_id ??
                notification.referenceId ??
                notification.reference_id;

            if (applicationId) {

                navigate(
                    `/admin/organizers/${applicationId}`
                );

            } else {

                setError(
                    "This organizer application notification is missing its application ID."
                );
            }

            return;
        }

        // -----------------------------------------------------
        // CLUB
        // -----------------------------------------------------

        const clubId =
            data.clubId ??
            data.club_id;

        if (
            normalizedType ===
            "CLUB_INVITE" &&
            clubId
        ) {

            navigate(
                `/clubs/${clubId}`
            );

            return;
        }

        if (
            normalizedType ===
            "CLUB" &&
            clubId
        ) {

            navigate(
                `/clubs/${clubId}`
            );

            return;
        }

        // -----------------------------------------------------
        // FRIEND REQUEST
        // -----------------------------------------------------

        if (
            normalizedType ===
            "FRIEND_REQUEST" ||
            normalizedType ===
            "FRIEND_ACCEPTED"
        ) {

            navigate("/friends");

            return;
        }

        // -----------------------------------------------------
        // TOURNAMENT
        // -----------------------------------------------------

        if (
            normalizedType ===
            "TOURNAMENT_INVITE" ||
            normalizedType ===
            "TOURNAMENT"
        ) {

            const tournamentId =
                data.tournamentId ??
                data.tournament_id;

            if (tournamentId) {

                navigate(
                    `/competitions/${tournamentId}`
                );
            }

            return;
        }
    };

    // =========================================================
    // FILTERED NOTIFICATIONS
    // =========================================================

    const filteredNotifications =
        useMemo(() => {

            if (filter === "unread") {

                return notifications.filter(
                    (notification) =>
                        !(
                            notification.isRead ||
                            notification.is_read
                        )
                );
            }

            return notifications;

        }, [
            notifications,
            filter,
        ]);

    // =========================================================
    // GROUP NOTIFICATIONS
    // =========================================================

    const groupedNotifications =
        useMemo(() => {

            const groups = [];

            const today = new Date();
            const yesterday = new Date();

            yesterday.setDate(
                today.getDate() - 1
            );

            filteredNotifications.forEach(
                (notification) => {

                    const dateValue =
                        notification.createdAt ||
                        notification.created_at;

                    if (!dateValue) {

                        const existing =
                            groups.find(
                                (group) =>
                                    group.label ===
                                    "Earlier"
                            );

                        if (existing) {

                            existing.items.push(
                                notification
                            );

                        } else {

                            groups.push({
                                label: "Earlier",
                                items: [
                                    notification,
                                ],
                            });
                        }

                        return;
                    }

                    const date =
                        new Date(dateValue);

                    let label =
                        "Earlier";

                    if (
                        date.toDateString() ===
                        today.toDateString()
                    ) {

                        label = "Today";

                    } else if (
                        date.toDateString() ===
                        yesterday.toDateString()
                    ) {

                        label = "Yesterday";
                    }

                    const existing =
                        groups.find(
                            (group) =>
                                group.label ===
                                label
                        );

                    if (existing) {

                        existing.items.push(
                            notification
                        );

                    } else {

                        groups.push({
                            label,
                            items: [
                                notification,
                            ],
                        });
                    }
                }
            );

            return groups;

        }, [
            filteredNotifications,
        ]);

    // =========================================================
    // HELPERS
    // =========================================================

    const getNotificationType = (
        notification
    ) => {

        return (
            notification.type ||
            notification.notificationType ||
            notification.notification_type ||
            "SYSTEM"
        ).toUpperCase();
    };

    const getNotificationTitle = (
        notification
    ) => {

        return (
            notification.title ||
            "Notification"
        );
    };

    const getNotificationMessage = (
        notification
    ) => {

        return (
            notification.message ||
            "You have a new notification."
        );
    };

    const getNotificationData = (
        notification
    ) => {

        return notification?.data || {};
    };

    const isUnread = (
        notification
    ) => {

        return !(
            notification.isRead ||
            notification.is_read
        );
    };

    const formatTime = (dateValue) => {

        if (!dateValue) {
            return "";
        }

        try {

            return new Date(
                dateValue
            ).toLocaleTimeString(
                "en-IN",
                {
                    hour: "numeric",
                    minute: "2-digit",
                }
            );

        } catch {

            return "";
        }
    };

    // =========================================================
    // ICON
    // =========================================================

    const getIcon = (notification) => {

        const type =
            getNotificationType(
                notification
            );

        switch (type) {

            case "CLUB_INVITE":
                return (
                    <Users size={19} />
                );

            case "FRIEND_REQUEST":
                return (
                    <UserPlus size={19} />
                );

            case "FRIEND_ACCEPTED":
                return (
                    <Check size={19} />
                );

            case "TOURNAMENT_INVITE":
                return (
                    <Trophy size={19} />
                );

            case "SQUAD_REQUEST":
                return (
                    <Gamepad2 size={19} />
                );

            case "ACHIEVEMENT":
                return (
                    <Crown size={19} />
                );

            case "ORGANIZER_APPLICATION":
                return (
                    <Shield size={19} />
                );

            case "SYSTEM":
                return (
                    <CircleAlert size={19} />
                );

            default:
                return (
                    <Bell size={19} />
                );
        }
    };

    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {

        return (
            <div className="min-h-screen bg-white flex items-center justify-center">

                <div className="flex items-center gap-3 text-neutral-500">

                    <Loader2
                        size={21}
                        className="animate-spin"
                    />

                    <span className="text-sm">
                        Loading notifications...
                    </span>

                </div>

            </div>
        );
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (

        <div className="min-h-screen bg-white text-neutral-900">

            <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">

                    <div>

                        <div className="flex items-center gap-3">

                            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">

                                <Bell size={19} />

                            </div>

                            <div>

                                <h1 className="text-2xl font-bold tracking-tight text-black">
                                    Notifications
                                </h1>

                                <p className="mt-1 text-sm text-neutral-500">
                                    Stay updated with
                                    your SYNCO activity.
                                </p>

                            </div>

                        </div>

                    </div>

                    <div className="flex items-center gap-2">

                        <button
                            onClick={() =>
                                loadNotifications(true)
                            }
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
                        >

                            <RefreshCw
                                size={16}
                                className={
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            Refresh

                        </button>

                        {unreadCount > 0 && (

                            <button
                                onClick={
                                    markAllAsRead
                                }
                                disabled={markingAll}
                                className="inline-flex items-center gap-2 rounded-lg bg-black px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition disabled:opacity-50"
                            >

                                {markingAll ? (

                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                    />

                                ) : (

                                    <CheckCheck
                                        size={16}
                                    />

                                )}

                                Mark all read

                            </button>

                        )}

                    </div>

                </div>

                {/* =================================================
                    ALERTS
                ================================================= */}

                {error && (

                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                        <div className="flex items-center justify-between gap-4">

                            <p className="text-sm text-red-700">
                                {error}
                            </p>

                            <button
                                onClick={() =>
                                    setError("")
                                }
                                className="text-red-500 hover:text-red-700"
                            >

                                <X size={16} />

                            </button>

                        </div>

                    </div>
                )}

                {success && (

                    <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">

                        <div className="flex items-center justify-between gap-4">

                            <p className="text-sm text-green-700">
                                {success}
                            </p>

                            <button
                                onClick={() =>
                                    setSuccess("")
                                }
                                className="text-green-600 hover:text-green-800"
                            >

                                <X size={16} />

                            </button>

                        </div>

                    </div>
                )}

                {/* =================================================
                    STATS
                ================================================= */}

                <div className="mt-7 grid grid-cols-2 gap-3 sm:max-w-md">

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">

                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                            Total
                        </p>

                        <p className="mt-1 text-xl font-bold text-black">
                            {notifications.length}
                        </p>

                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">

                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                            Unread
                        </p>

                        <p className="mt-1 text-xl font-bold text-black">
                            {unreadCount}
                        </p>

                    </div>

                </div>

                {/* =================================================
                    FILTERS
                ================================================= */}

                <div className="mt-8 flex items-center gap-2 border-b border-neutral-200 pb-3">

                    <button
                        onClick={() =>
                            setFilter("all")
                        }
                        className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${filter === "all"
                                ? "bg-black text-white"
                                : "text-neutral-500 hover:bg-neutral-100 hover:text-black"
                            }`}
                    >
                        All
                    </button>

                    <button
                        onClick={() =>
                            setFilter("unread")
                        }
                        className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${filter === "unread"
                                ? "bg-black text-white"
                                : "text-neutral-500 hover:bg-neutral-100 hover:text-black"
                            }`}
                    >
                        Unread

                        {unreadCount > 0 && (
                            <span className="ml-2">
                                {unreadCount}
                            </span>
                        )}

                    </button>

                </div>

                {/* =================================================
                    EMPTY
                ================================================= */}

                {filteredNotifications.length === 0 && (

                    <div className="py-24 text-center">

                        <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">

                            <Bell
                                size={25}
                                className="text-neutral-400"
                            />

                        </div>

                        <h2 className="mt-5 text-base font-semibold text-black">

                            {filter === "unread"
                                ? "You're all caught up"
                                : "No notifications yet"}

                        </h2>

                        <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-neutral-500">

                            {filter === "unread"
                                ? "You don't have any unread notifications."
                                : "Notifications about clubs, friends, tournaments and other SYNCO activity will appear here."}

                        </p>

                    </div>
                )}

                {/* =================================================
                    GROUPS
                ================================================= */}

                <div className="mt-7 space-y-8">

                    {groupedNotifications.map(
                        (group) => (

                            <section
                                key={group.label}
                            >

                                <div className="flex items-center gap-3 mb-3">

                                    <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                        {group.label}
                                    </h2>

                                    <div className="h-px flex-1 bg-neutral-200" />

                                </div>

                                <div className="rounded-xl border border-neutral-200 overflow-hidden">

                                    {group.items.map(
                                        (
                                            notification,
                                            index
                                        ) => {

                                            const unread =
                                                isUnread(
                                                    notification
                                                );

                                            const type =
                                                getNotificationType(
                                                    notification
                                                );

                                            const data =
                                                getNotificationData(
                                                    notification
                                                );

                                            const notificationId =
                                                notification.id;

                                            const isInvite =
                                                type ===
                                                "CLUB_INVITE";

                                            const inviteId =
                                                data.inviteId ??
                                                data.invite_id ??
                                                notification.referenceId ??
                                                notification.reference_id;

                                            const isOrganizerApplication =
                                                type ===
                                                "ORGANIZER_APPLICATION";

                                            const acceptLoading =
                                                actionId ===
                                                `accept-${notificationId}`;

                                            const declineLoading =
                                                actionId ===
                                                `decline-${notificationId}`;

                                            const anyInviteAction =
                                                acceptLoading ||
                                                declineLoading;

                                            return (

                                                <div
                                                    key={
                                                        notificationId ??
                                                        index
                                                    }
                                                    className={`relative ${index !==
                                                            group.items.length - 1
                                                            ? "border-b border-neutral-200"
                                                            : ""
                                                        }`}
                                                >

                                                    {/* Unread indicator */}

                                                    {unread && (

                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-black" />

                                                    )}

                                                    <div
                                                        className={`p-4 sm:p-5 transition ${unread
                                                                ? "bg-neutral-50"
                                                                : "bg-white"
                                                            }`}
                                                    >

                                                        <div className="flex items-start gap-4">

                                                            {/* Icon */}

                                                            <div
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unread
                                                                        ? "bg-black text-white"
                                                                        : "bg-neutral-100 text-neutral-500"
                                                                    }`}
                                                            >
                                                                {getIcon(
                                                                    notification
                                                                )}
                                                            </div>

                                                            {/* Content */}

                                                            <div className="flex-1 min-w-0">

                                                                <button
                                                                    onClick={() =>
                                                                        handleNotificationClick(
                                                                            notification
                                                                        )
                                                                    }
                                                                    className="w-full text-left"
                                                                >

                                                                    <div className="flex items-start justify-between gap-4">

                                                                        <div className="min-w-0">

                                                                            <h3
                                                                                className={`text-sm ${unread
                                                                                        ? "font-bold text-black"
                                                                                        : "font-semibold text-neutral-800"
                                                                                    }`}
                                                                            >
                                                                                {
                                                                                    getNotificationTitle(
                                                                                        notification
                                                                                    )
                                                                                }
                                                                            </h3>

                                                                            <p className="mt-1 text-sm leading-6 text-neutral-500">
                                                                                {
                                                                                    getNotificationMessage(
                                                                                        notification
                                                                                    )
                                                                                }
                                                                            </p>

                                                                        </div>

                                                                        <ChevronRight
                                                                            size={17}
                                                                            className="mt-0.5 shrink-0 text-neutral-300"
                                                                        />

                                                                    </div>

                                                                </button>

                                                                {/* Meta */}

                                                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">

                                                                    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">

                                                                        <Clock size={13} />

                                                                        {formatTime(
                                                                            notification.createdAt ||
                                                                            notification.created_at
                                                                        )}

                                                                    </span>

                                                                    {type && (

                                                                        <span className="rounded-md bg-neutral-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">

                                                                            {type.replace(
                                                                                /_/g,
                                                                                " "
                                                                            )}

                                                                        </span>

                                                                    )}

                                                                </div>

                                                                {/* =================================================
                                                                    ORGANIZER APPLICATION
                                                                ================================================= */}

                                                                {isOrganizerApplication && (

                                                                    <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">

                                                                        <div className="flex items-center justify-between gap-4">

                                                                            <div>

                                                                                <p className="text-xs font-semibold text-black">
                                                                                    Organizer application
                                                                                </p>

                                                                                <p className="mt-1 text-[11px] text-neutral-500">
                                                                                    {data.organizationName ||
                                                                                        "Application awaiting admin review"}
                                                                                </p>

                                                                            </div>

                                                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">

                                                                                Review

                                                                                <ChevronRight
                                                                                    size={13}
                                                                                />

                                                                            </span>

                                                                        </div>

                                                                    </div>

                                                                )}

                                                                {/* =================================================
                                                                    CLUB INVITE ACTIONS
                                                                ================================================= */}

                                                                {isInvite &&
                                                                    inviteId && (

                                                                        <div className="mt-4 flex flex-wrap gap-2">

                                                                            <button
                                                                                onClick={() =>
                                                                                    handleClubInvite(
                                                                                        notification,
                                                                                        "accept"
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    anyInviteAction
                                                                                }
                                                                                className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition disabled:opacity-50"
                                                                            >

                                                                                {acceptLoading ? (

                                                                                    <Loader2
                                                                                        size={14}
                                                                                        className="animate-spin"
                                                                                    />

                                                                                ) : (

                                                                                    <Check
                                                                                        size={14}
                                                                                    />

                                                                                )}

                                                                                Accept

                                                                            </button>

                                                                            <button
                                                                                onClick={() =>
                                                                                    handleClubInvite(
                                                                                        notification,
                                                                                        "decline"
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    anyInviteAction
                                                                                }
                                                                                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition disabled:opacity-50"
                                                                            >

                                                                                {declineLoading ? (

                                                                                    <Loader2
                                                                                        size={14}
                                                                                        className="animate-spin"
                                                                                    />

                                                                                ) : (

                                                                                    <X
                                                                                        size={14}
                                                                                    />

                                                                                )}

                                                                                Decline

                                                                            </button>

                                                                        </div>

                                                                    )}

                                                                {/* =================================================
                                                                    CLUB INFO
                                                                ================================================= */}

                                                                {isInvite &&
                                                                    (
                                                                        data.clubName ||
                                                                        data.clubTag
                                                                    ) && (

                                                                        <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-3.5 py-3">

                                                                            <div className="flex items-center gap-3">

                                                                                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">

                                                                                    <Users
                                                                                        size={15}
                                                                                        className="text-neutral-500"
                                                                                    />

                                                                                </div>

                                                                                <div>

                                                                                    {data.clubName && (
                                                                                        <p className="text-xs font-semibold text-black">
                                                                                            {
                                                                                                data.clubName
                                                                                            }
                                                                                        </p>
                                                                                    )}

                                                                                    {data.clubTag && (
                                                                                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                                                                                            {
                                                                                                data.clubTag
                                                                                            }
                                                                                        </p>
                                                                                    )}

                                                                                </div>

                                                                            </div>

                                                                        </div>

                                                                    )}

                                                            </div>

                                                            {/* Unread dot */}

                                                            {unread && (

                                                                <div className="w-2 h-2 rounded-full bg-black shrink-0 mt-2" />

                                                            )}

                                                        </div>

                                                    </div>

                                                </div>
                                            );
                                        }
                                    )}

                                </div>

                            </section>
                        )
                    )}

                </div>

            </main>

        </div>
    );
};

export default Notification;