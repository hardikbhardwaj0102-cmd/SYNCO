import { useCallback, useEffect, useState } from "react";
import {
    Search,
    UserPlus,
    UserCheck,
    Clock3,
    Check,
    X,
    UserMinus,
    RefreshCw,
    Users,
    Copy,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;


// =========================================================
// ADD FRIENDS
// =========================================================

const AddFriends = () => {

    const navigate = useNavigate();

    // -----------------------------------------------------
    // SEARCH
    // -----------------------------------------------------

    const [searchQuery, setSearchQuery] = useState("");
    const [players, setPlayers] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState("");

    // -----------------------------------------------------
    // FRIEND REQUESTS
    // -----------------------------------------------------

    const [receivedRequests, setReceivedRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(true);

    // -----------------------------------------------------
    // FRIENDS
    // -----------------------------------------------------

    const [friends, setFriends] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(true);

    // -----------------------------------------------------
    // ACTION STATES
    // -----------------------------------------------------

    const [actionLoading, setActionLoading] = useState({});
    const [message, setMessage] = useState({
        type: "",
        text: "",
    });

    // -----------------------------------------------------
    // COPIED UID
    // -----------------------------------------------------

    const [copiedUid, setCopiedUid] = useState(null);


    // =====================================================
    // SHOW MESSAGE
    // =====================================================

    const showMessage = (type, text) => {

        setMessage({
            type,
            text,
        });

        setTimeout(() => {

            setMessage({
                type: "",
                text: "",
            });

        }, 3500);
    };


    // =====================================================
    // API HELPER
    // =====================================================

    const apiRequest = async (
        endpoint,
        options = {}
    ) => {

        const response = await fetch(
            `${API_URL}${endpoint}`,
            {
                credentials: "include",

                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {}),
                },

                ...options,
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Something went wrong"
            );
        }

        return data;
    };


    // =====================================================
    // SEARCH PLAYERS
    // =====================================================

    const searchPlayers = useCallback(
        async (query) => {

            const trimmedQuery = query.trim();

            if (!trimmedQuery) {

                setPlayers([]);
                setSearchError("");

                return;
            }

            setSearchLoading(true);
            setSearchError("");

            try {

                const data = await apiRequest(
                    `/api/friends/search?q=${encodeURIComponent(
                        trimmedQuery
                    )}`
                );

                setPlayers(
                    data.players || []
                );

            } catch (error) {

                console.error(
                    "Player search error:",
                    error
                );

                setPlayers([]);

                setSearchError(
                    error.message ||
                    "Unable to search players"
                );

            } finally {

                setSearchLoading(false);
            }

        },
        []
    );


    // =====================================================
    // SEARCH DEBOUNCE
    // =====================================================

    useEffect(() => {

        const trimmedQuery =
            searchQuery.trim();

        if (!trimmedQuery) {

            setPlayers([]);
            setSearchLoading(false);
            setSearchError("");

            return;
        }

        const timer = setTimeout(() => {

            searchPlayers(
                trimmedQuery
            );

        }, 350);

        return () => clearTimeout(timer);

    }, [
        searchQuery,
        searchPlayers,
    ]);


    // =====================================================
    // LOAD FRIEND REQUESTS
    // =====================================================

    const loadRequests = useCallback(
        async () => {

            setRequestsLoading(true);

            try {

                const data = await apiRequest(
                    "/api/friends/requests"
                );

                setReceivedRequests(
                    data.received || []
                );

                setSentRequests(
                    data.sent || []
                );

            } catch (error) {

                console.error(
                    "Friend requests error:",
                    error
                );

            } finally {

                setRequestsLoading(false);
            }

        },
        []
    );


    // =====================================================
    // LOAD FRIENDS
    // =====================================================

    const loadFriends = useCallback(
        async () => {

            setFriendsLoading(true);

            try {

                const data = await apiRequest(
                    "/api/friends"
                );

                setFriends(
                    data.friends || []
                );

            } catch (error) {

                console.error(
                    "Friends error:",
                    error
                );

            } finally {

                setFriendsLoading(false);
            }

        },
        []
    );


    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {

        loadRequests();
        loadFriends();

    }, [
        loadRequests,
        loadFriends,
    ]);


    // =====================================================
    // REFRESH ALL
    // =====================================================

    const refreshAll = async () => {

        await Promise.all([
            loadRequests(),
            loadFriends(),
        ]);

        if (searchQuery.trim()) {

            await searchPlayers(
                searchQuery.trim()
            );
        }
    };


    // =====================================================
    // SEND FRIEND REQUEST
    // =====================================================

    const sendFriendRequest = async (
        player
    ) => {

        const playerId = player.id;

        setActionLoading(
            previous => ({
                ...previous,
                [`add-${playerId}`]: true,
            })
        );

        try {

            const data = await apiRequest(
                "/api/friends/request",
                {
                    method: "POST",

                    body: JSON.stringify({
                        uid: player.uid,
                    }),
                }
            );

            showMessage(
                "success",
                data.message ||
                "Friend request sent"
            );

            // Update current search result
            setPlayers(
                previous =>
                    previous.map(
                        item =>
                            item.id === playerId
                                ? {
                                    ...item,
                                    friendStatus:
                                        "PENDING",
                                    requestDirection:
                                        "SENT",
                                }
                                : item
                    )
            );

            await loadRequests();

        } catch (error) {

            console.error(
                "Send friend request error:",
                error
            );

            showMessage(
                "error",
                error.message ||
                "Unable to send friend request"
            );

        } finally {

            setActionLoading(
                previous => ({
                    ...previous,
                    [`add-${playerId}`]: false,
                })
            );
        }
    };


    // =====================================================
    // ACCEPT FRIEND REQUEST
    // =====================================================

    const acceptRequest = async (
        requestId
    ) => {

        setActionLoading(
            previous => ({
                ...previous,
                [`accept-${requestId}`]: true,
            })
        );

        try {

            const data = await apiRequest(
                `/api/friends/request/${requestId}/accept`,
                {
                    method: "POST",
                }
            );

            showMessage(
                "success",
                data.message ||
                "Friend request accepted"
            );

            await Promise.all([
                loadRequests(),
                loadFriends(),
            ]);

            if (searchQuery.trim()) {

                await searchPlayers(
                    searchQuery.trim()
                );
            }

        } catch (error) {

            console.error(
                "Accept request error:",
                error
            );

            showMessage(
                "error",
                error.message ||
                "Unable to accept request"
            );

        } finally {

            setActionLoading(
                previous => ({
                    ...previous,
                    [`accept-${requestId}`]: false,
                })
            );
        }
    };


    // =====================================================
    // DECLINE FRIEND REQUEST
    // =====================================================

    const declineRequest = async (
        requestId
    ) => {

        setActionLoading(
            previous => ({
                ...previous,
                [`decline-${requestId}`]: true,
            })
        );

        try {

            const data = await apiRequest(
                `/api/friends/request/${requestId}/decline`,
                {
                    method: "POST",
                }
            );

            showMessage(
                "success",
                data.message ||
                "Friend request declined"
            );

            await loadRequests();

            if (searchQuery.trim()) {

                await searchPlayers(
                    searchQuery.trim()
                );
            }

        } catch (error) {

            console.error(
                "Decline request error:",
                error
            );

            showMessage(
                "error",
                error.message ||
                "Unable to decline request"
            );

        } finally {

            setActionLoading(
                previous => ({
                    ...previous,
                    [`decline-${requestId}`]: false,
                })
            );
        }
    };


    // =====================================================
    // CANCEL FRIEND REQUEST
    // =====================================================

    const cancelRequest = async (
        requestId
    ) => {

        setActionLoading(
            previous => ({
                ...previous,
                [`cancel-${requestId}`]: true,
            })
        );

        try {

            const data = await apiRequest(
                `/api/friends/request/${requestId}/cancel`,
                {
                    method: "POST",
                }
            );

            showMessage(
                "success",
                data.message ||
                "Friend request cancelled"
            );

            await loadRequests();

            if (searchQuery.trim()) {

                await searchPlayers(
                    searchQuery.trim()
                );
            }

        } catch (error) {

            console.error(
                "Cancel request error:",
                error
            );

            showMessage(
                "error",
                error.message ||
                "Unable to cancel request"
            );

        } finally {

            setActionLoading(
                previous => ({
                    ...previous,
                    [`cancel-${requestId}`]: false,
                })
            );
        }
    };


    // =====================================================
    // REMOVE FRIEND
    // =====================================================

    const removeFriend = async (
        friendId
    ) => {

        const confirmed =
            window.confirm(
                "Remove this player from your friends?"
            );

        if (!confirmed) {
            return;
        }

        setActionLoading(
            previous => ({
                ...previous,
                [`remove-${friendId}`]: true,
            })
        );

        try {

            const data = await apiRequest(
                `/api/friends/${friendId}`,
                {
                    method: "DELETE",
                }
            );

            showMessage(
                "success",
                data.message ||
                "Friend removed"
            );

            await loadFriends();

            if (searchQuery.trim()) {

                await searchPlayers(
                    searchQuery.trim()
                );
            }

        } catch (error) {

            console.error(
                "Remove friend error:",
                error
            );

            showMessage(
                "error",
                error.message ||
                "Unable to remove friend"
            );

        } finally {

            setActionLoading(
                previous => ({
                    ...previous,
                    [`remove-${friendId}`]: false,
                })
            );
        }
    };


    // =====================================================
    // COPY UID
    // =====================================================

    const copyUid = async (
        uid
    ) => {

        try {

            await navigator.clipboard.writeText(
                uid
            );

            setCopiedUid(uid);

            setTimeout(() => {
                setCopiedUid(null);
            }, 1800);

        } catch (error) {

            console.error(
                "Copy UID error:",
                error
            );
        }
    };


    // =====================================================
    // PLAYER AVATAR
    // =====================================================

    const PlayerAvatar = ({
        player,
        size = "normal"
    }) => {

        const sizeClasses =
            size === "small"
                ? "h-10 w-10"
                : size === "large"
                    ? "h-14 w-14"
                    : "h-12 w-12";

        const initials =
            (
                player?.username ||
                player?.name ||
                "?"
            )
                .charAt(0)
                .toUpperCase();

        if (player?.avatar) {

            return (
                <img
                    src={player.avatar}
                    alt={
                        player.username ||
                        player.name ||
                        "Player"
                    }
                    className={`${sizeClasses} rounded-full object-cover border border-black/10`}
                />
            );
        }

        return (
            <div
                className={`${sizeClasses} flex items-center justify-center rounded-full bg-black text-white font-semibold`}
            >
                {initials}
            </div>
        );
    };


    // =====================================================
    // SEARCH RESULT ACTION
    // =====================================================

    const renderPlayerAction = (
        player
    ) => {

        const loading =
            actionLoading[
            `add-${player.id}`
            ];

        if (
            player.friendStatus ===
            "FRIENDS"
        ) {

            return (
                <div className="inline-flex items-center gap-2 rounded-lg bg-black/[0.04] px-4 py-2.5 text-sm font-medium text-black/60">
                    <UserCheck
                        size={16}
                    />
                    Friends
                </div>
            );
        }

        if (
            player.friendStatus ===
            "PENDING"
        ) {

            if (
                player.requestDirection ===
                "RECEIVED"
            ) {

                return (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-2 text-xs font-medium text-black/60">
                            <Clock3
                                size={14}
                            />
                            Incoming request
                        </span>
                    </div>
                );
            }

            return (
                <div className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-black/50">
                    <Clock3
                        size={16}
                    />
                    Request Sent
                </div>
            );
        }

        return (
            <button
                type="button"
                onClick={() =>
                    sendFriendRequest(
                        player
                    )
                }
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? (
                    <>
                        <RefreshCw
                            size={16}
                            className="animate-spin"
                        />
                        Sending
                    </>
                ) : (
                    <>
                        <UserPlus
                            size={16}
                        />
                        Add Friend
                    </>
                )}
            </button>
        );
    };


    // =====================================================
    // RENDER
    // =====================================================

    return (
        <div className="min-h-screen bg-[#f7f7f5] px-4 py-6 text-[#111111] sm:px-6 lg:px-8">

            <div className="mx-auto max-w-7xl">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-4">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(-1)
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-white transition hover:bg-black/[0.03]"
                            aria-label="Go back"
                        >
                            <ChevronLeft
                                size={20}
                            />
                        </button>

                        <div>

                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
                                SYNCO NETWORK
                            </p>

                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                Add Friends
                            </h1>

                            <p className="mt-1 text-sm text-black/50">
                                Find players and build your network.
                            </p>

                        </div>

                    </div>

                    <button
                        type="button"
                        onClick={refreshAll}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-black/[0.03]"
                    >
                        <RefreshCw
                            size={16}
                        />
                        Refresh
                    </button>

                </div>


                {/* =================================================
                    GLOBAL MESSAGE
                ================================================= */}

                {message.text && (

                    <div
                        className={`mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${message.type === "success"
                            ? "border-black/10 bg-white text-black"
                            : "border-red-200 bg-red-50 text-red-700"
                            }`}
                    >

                        {message.type ===
                            "success" ? (
                            <CheckCircle2
                                size={18}
                            />
                        ) : (
                            <AlertCircle
                                size={18}
                            />
                        )}

                        <span>
                            {message.text}
                        </span>

                    </div>
                )}


                {/* =================================================
                    SEARCH CARD
                ================================================= */}

                <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">

                    <div className="mb-5">

                        <div className="flex items-center gap-2">

                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white">
                                <Search
                                    size={18}
                                />
                            </div>

                            <div>

                                <h2 className="font-semibold">
                                    Find Players
                                </h2>

                                <p className="text-xs text-black/45">
                                    Search by username or SYNCO UID
                                </p>

                            </div>

                        </div>

                    </div>


                    {/* SEARCH INPUT */}

                    <div className="relative">

                        <Search
                            size={19}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/35"
                        />

                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(
                                    event.target.value
                                )
                            }
                            placeholder="Enter username or 10-character SYNCO UID"
                            className="h-12 w-full rounded-xl border border-black/10 bg-[#fafafa] pl-11 pr-12 text-sm outline-none transition placeholder:text-black/30 focus:border-black/30 focus:bg-white"
                            autoComplete="off"
                            spellCheck="false"
                        />

                        {searchLoading && (

                            <RefreshCw
                                size={18}
                                className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-black/40"
                            />

                        )}

                    </div>


                    {/* UID HINT */}

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/40">

                        <span>
                            Example UID:
                        </span>

                        <span className="font-mono font-medium text-black/60">
                            A7K29X4P9Q
                        </span>

                        <span>
                            •
                        </span>

                        <span>
                            Username search also works
                        </span>

                    </div>


                    {/* SEARCH ERROR */}

                    {searchError && (

                        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {searchError}
                        </div>

                    )}


                    {/* =================================================
                        SEARCH RESULTS
                    ================================================= */}

                    {searchQuery.trim() && !searchLoading && (

                        <div className="mt-6">

                            <div className="mb-3 flex items-center justify-between">

                                <h3 className="text-sm font-semibold">
                                    Search Results
                                </h3>

                                <span className="text-xs text-black/40">
                                    {players.length}{" "}
                                    {players.length === 1
                                        ? "player"
                                        : "players"}
                                </span>

                            </div>


                            {players.length > 0 ? (

                                <div className="divide-y divide-black/[0.07] rounded-xl border border-black/[0.08]">

                                    {players.map(
                                        player => (

                                            <div
                                                key={
                                                    player.id
                                                }
                                                className="flex flex-col gap-4 p-4 transition hover:bg-black/[0.015] sm:flex-row sm:items-center sm:justify-between"
                                            >

                                                <div className="flex min-w-0 items-center gap-3">

                                                    <PlayerAvatar
                                                        player={
                                                            player
                                                        }
                                                    />

                                                    <div className="min-w-0">

                                                        <div className="flex flex-wrap items-center gap-2">

                                                            <h4 className="truncate text-sm font-semibold">
                                                                {player.name ||
                                                                    "Player"}
                                                            </h4>

                                                            {player.username && (

                                                                <span className="text-xs text-black/40">
                                                                    @
                                                                    {
                                                                        player.username
                                                                    }
                                                                </span>

                                                            )}

                                                        </div>

                                                        <div className="mt-1 flex flex-wrap items-center gap-2">

                                                            <span className="font-mono text-xs text-black/45">
                                                                {player.uid}
                                                            </span>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    copyUid(
                                                                        player.uid
                                                                    )
                                                                }
                                                                className="inline-flex items-center gap-1 text-xs text-black/40 transition hover:text-black"
                                                                title="Copy UID"
                                                            >

                                                                {copiedUid ===
                                                                    player.uid ? (
                                                                    <>
                                                                        <Check
                                                                            size={12}
                                                                        />
                                                                        Copied
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy
                                                                            size={12}
                                                                        />
                                                                        Copy
                                                                    </>
                                                                )}

                                                            </button>

                                                        </div>

                                                        <div className="mt-1 text-xs text-black/35">
                                                            Level{" "}
                                                            {player.level ||
                                                                1}
                                                        </div>

                                                    </div>

                                                </div>


                                                <div className="shrink-0">
                                                    {renderPlayerAction(
                                                        player
                                                    )}
                                                </div>

                                            </div>

                                        )
                                    )}

                                </div>

                            ) : (

                                <div className="rounded-xl border border-dashed border-black/10 bg-[#fafafa] px-5 py-10 text-center">

                                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.05]">

                                        <Search
                                            size={19}
                                            className="text-black/40"
                                        />

                                    </div>

                                    <h3 className="text-sm font-semibold">
                                        No players found
                                    </h3>

                                    <p className="mt-1 text-xs text-black/40">
                                        Try a different username or check the SYNCO UID.
                                    </p>

                                </div>

                            )}

                        </div>

                    )}

                </section>


                {/* =================================================
                    TWO COLUMN SECTION
                ================================================= */}

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">


                    {/* =================================================
                        FRIEND REQUESTS
                    ================================================= */}

                    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">

                        <div className="mb-5 flex items-center justify-between">

                            <div className="flex items-center gap-3">

                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white">

                                    <UserPlus
                                        size={17}
                                    />

                                </div>

                                <div>

                                    <h2 className="font-semibold">
                                        Friend Requests
                                    </h2>

                                    <p className="text-xs text-black/45">
                                        Manage your pending requests
                                    </p>

                                </div>

                            </div>

                            {receivedRequests.length > 0 && (

                                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-xs font-semibold text-white">
                                    {
                                        receivedRequests.length
                                    }
                                </span>

                            )}

                        </div>


                        {requestsLoading ? (

                            <div className="flex items-center justify-center py-12">

                                <RefreshCw
                                    size={20}
                                    className="animate-spin text-black/40"
                                />

                            </div>

                        ) : receivedRequests.length > 0 ? (

                            <div className="space-y-3">

                                {receivedRequests.map(
                                    requestItem => {

                                        const player =
                                            requestItem.player;

                                        const acceptLoading =
                                            actionLoading[
                                            `accept-${requestItem.id}`
                                            ];

                                        const declineLoading =
                                            actionLoading[
                                            `decline-${requestItem.id}`
                                            ];

                                        return (

                                            <div
                                                key={
                                                    requestItem.id
                                                }
                                                className="rounded-xl border border-black/[0.08] p-4"
                                            >

                                                <div className="flex items-center gap-3">

                                                    <PlayerAvatar
                                                        player={
                                                            player
                                                        }
                                                        size="small"
                                                    />

                                                    <div className="min-w-0 flex-1">

                                                        <h4 className="truncate text-sm font-semibold">
                                                            {player.name ||
                                                                "Player"}
                                                        </h4>

                                                        {player.username && (

                                                            <p className="truncate text-xs text-black/40">
                                                                @
                                                                {
                                                                    player.username
                                                                }
                                                            </p>

                                                        )}

                                                        <p className="mt-1 font-mono text-[11px] text-black/35">
                                                            {
                                                                player.uid
                                                            }
                                                        </p>

                                                    </div>

                                                </div>


                                                <div className="mt-4 flex gap-2">

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            acceptRequest(
                                                                requestItem.id
                                                            )
                                                        }
                                                        disabled={
                                                            acceptLoading ||
                                                            declineLoading
                                                        }
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-black px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-black/80 disabled:opacity-50"
                                                    >

                                                        {acceptLoading ? (
                                                            <RefreshCw
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
                                                        type="button"
                                                        onClick={() =>
                                                            declineRequest(
                                                                requestItem.id
                                                            )
                                                        }
                                                        disabled={
                                                            acceptLoading ||
                                                            declineLoading
                                                        }
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2.5 text-xs font-semibold text-black/70 transition hover:bg-black/[0.03] disabled:opacity-50"
                                                    >

                                                        {declineLoading ? (
                                                            <RefreshCw
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

                                            </div>

                                        );
                                    }
                                )}

                            </div>

                        ) : (

                            <div className="rounded-xl border border-dashed border-black/10 bg-[#fafafa] px-5 py-10 text-center">

                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.05]">

                                    <UserPlus
                                        size={18}
                                        className="text-black/40"
                                    />

                                </div>

                                <h3 className="text-sm font-semibold">
                                    No pending requests
                                </h3>

                                <p className="mt-1 text-xs text-black/40">
                                    New friend requests will appear here.
                                </p>

                            </div>

                        )}


                        {/* SENT REQUESTS */}

                        {sentRequests.length > 0 && (

                            <div className="mt-6 border-t border-black/[0.07] pt-5">

                                <div className="mb-3 flex items-center justify-between">

                                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">
                                        Sent Requests
                                    </h3>

                                    <span className="text-xs text-black/35">
                                        {
                                            sentRequests.length
                                        }
                                    </span>

                                </div>


                                <div className="space-y-2">

                                    {sentRequests.map(
                                        requestItem => {

                                            const player =
                                                requestItem.player;

                                            const loading =
                                                actionLoading[
                                                `cancel-${requestItem.id}`
                                                ];

                                            return (

                                                <div
                                                    key={
                                                        requestItem.id
                                                    }
                                                    className="flex items-center gap-3 rounded-lg border border-black/[0.07] p-3"
                                                >

                                                    <PlayerAvatar
                                                        player={
                                                            player
                                                        }
                                                        size="small"
                                                    />

                                                    <div className="min-w-0 flex-1">

                                                        <p className="truncate text-xs font-semibold">
                                                            {player.name ||
                                                                "Player"}
                                                        </p>

                                                        <p className="truncate text-[11px] text-black/40">
                                                            @
                                                            {
                                                                player.username ||
                                                                "unknown"
                                                            }
                                                        </p>

                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            cancelRequest(
                                                                requestItem.id
                                                            )
                                                        }
                                                        disabled={
                                                            loading
                                                        }
                                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-[11px] font-medium text-black/55 transition hover:bg-black/[0.03] disabled:opacity-50"
                                                    >

                                                        {loading ? (
                                                            <RefreshCw
                                                                size={13}
                                                                className="animate-spin"
                                                            />
                                                        ) : (
                                                            <X
                                                                size={13}
                                                            />
                                                        )}

                                                        Cancel

                                                    </button>

                                                </div>

                                            );
                                        }
                                    )}

                                </div>

                            </div>

                        )}

                    </section>


                    {/* =================================================
                        FRIENDS LIST
                    ================================================= */}

                    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">

                        <div className="mb-5 flex items-center justify-between">

                            <div className="flex items-center gap-3">

                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white">

                                    <Users
                                        size={17}
                                    />

                                </div>

                                <div>

                                    <h2 className="font-semibold">
                                        Your Friends
                                    </h2>

                                    <p className="text-xs text-black/45">
                                        Players in your network
                                    </p>

                                </div>

                            </div>

                            <span className="text-xs font-medium text-black/40">
                                {friends.length}
                            </span>

                        </div>


                        {friendsLoading ? (

                            <div className="flex items-center justify-center py-12">

                                <RefreshCw
                                    size={20}
                                    className="animate-spin text-black/40"
                                />

                            </div>

                        ) : friends.length > 0 ? (

                            <div className="space-y-2">

                                {friends.map(
                                    friendship => {

                                        const player =
                                            friendship.friend;

                                        const loading =
                                            actionLoading[
                                            `remove-${player?.id}`
                                            ];

                                        if (!player) {
                                            return null;
                                        }

                                        return (

                                            <div
                                                key={
                                                    friendship.id
                                                }
                                                className="group flex items-center gap-3 rounded-xl border border-black/[0.07] p-3 transition hover:bg-black/[0.015]"
                                            >

                                                <PlayerAvatar
                                                    player={
                                                        player
                                                    }
                                                    size="small"
                                                />

                                                <div className="min-w-0 flex-1">

                                                    <div className="flex items-center gap-2">

                                                        <p className="truncate text-sm font-semibold">
                                                            {player.name ||
                                                                "Player"}
                                                        </p>

                                                        <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium text-black/50">
                                                            Lvl{" "}
                                                            {
                                                                player.level ||
                                                                1
                                                            }
                                                        </span>

                                                    </div>

                                                    <p className="truncate text-xs text-black/40">
                                                        @
                                                        {
                                                            player.username ||
                                                            "unknown"
                                                        }
                                                    </p>

                                                    <p className="mt-0.5 truncate font-mono text-[10px] text-black/30">
                                                        {
                                                            player.uid
                                                        }
                                                    </p>

                                                </div>


                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeFriend(
                                                            player.id
                                                        )
                                                    }
                                                    disabled={
                                                        loading
                                                    }
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/30 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                                    title="Remove friend"
                                                >

                                                    {loading ? (
                                                        <RefreshCw
                                                            size={15}
                                                            className="animate-spin"
                                                        />
                                                    ) : (
                                                        <UserMinus
                                                            size={16}
                                                        />
                                                    )}

                                                </button>

                                            </div>

                                        );
                                    }
                                )}

                            </div>

                        ) : (

                            <div className="rounded-xl border border-dashed border-black/10 bg-[#fafafa] px-5 py-10 text-center">

                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.05]">

                                    <Users
                                        size={18}
                                        className="text-black/40"
                                    />

                                </div>

                                <h3 className="text-sm font-semibold">
                                    No friends yet
                                </h3>

                                <p className="mt-1 text-xs text-black/40">
                                    Search for players above to start building your network.
                                </p>

                            </div>

                        )}

                    </section>

                </div>

            </div>

        </div>
    );
};


export default AddFriends;