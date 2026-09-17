import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    ArrowLeft,
    Ban,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Loader2,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    UserCog,
    UserRound,
    UserX,
    X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";


const API_URL = (
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000"
).replace(/\/$/, "");


const apiRequest = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
        credentials: "include",
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body && !(options.body instanceof FormData)
                ? { "Content-Type": "application/json" }
                : {}),
            ...(options.headers || {}),
        },
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        const error = new Error(
            data.message ||
            data.error ||
            `Request failed with status ${response.status}.`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
};


const formatDate = (value) => {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};


const roleLabel = (role) => {
    if (role === "admin") return "Administrator";
    if (role === "organizer") return "Organizer";
    return "Player";
};


const roleClass = (role) => {
    if (role === "admin") {
        return "border-neutral-300 bg-neutral-100 text-neutral-800";
    }

    if (role === "organizer") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-neutral-200 bg-white text-neutral-600";
};


const statusClass = (status) => {
    if (status === "suspended") {
        return "border-red-200 bg-red-50 text-red-700";
    }

    return "border-green-200 bg-green-50 text-green-700";
};


const actionLabel = (action) => {
    switch (action) {
        case "REMOVE_ORGANIZER":
            return "Organizer access removed";
        case "SUSPEND_ACCOUNT":
            return "Account suspended";
        case "UNSUSPEND_ACCOUNT":
            return "Account restored";
        case "DELETE_ACCOUNT":
            return "Account deleted";
        default:
            return String(action || "Account action")
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
    }
};


const actionClass = (action) => {
    if (action === "DELETE_ACCOUNT") {
        return "border-red-200 bg-red-50 text-red-700";
    }

    if (action === "SUSPEND_ACCOUNT") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-neutral-200 bg-neutral-50 text-neutral-700";
};


const getDisplayName = (account) => {
    if (!account) return "Unnamed user";
    return account.username || account.name || "Unnamed user";
};


const AdminUsers = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [users, setUsers] = useState([]);
    const [selectedUid, setSelectedUid] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [actions, setActions] = useState([]);

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [modal, setModal] = useState(null);
    const [reason, setReason] = useState("");


    useEffect(() => {
        if (!user) return;

        if (user.account_role !== "admin") {
            navigate("/home", { replace: true });
        }
    }, [navigate, user]);


    const loadUsers = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const params = new URLSearchParams();

            if (search.trim()) {
                params.set("search", search.trim());
            }

            if (roleFilter !== "all") {
                params.set("role", roleFilter);
            }

            if (statusFilter !== "all") {
                params.set("status", statusFilter);
            }

            const query = params.toString();
            const endpoint = query
                ? `/api/admin/users?${query}`
                : "/api/admin/users";

            const data = await apiRequest(endpoint);
            const nextUsers = Array.isArray(data.users)
                ? data.users
                : [];

            setUsers(nextUsers);

            if (
                selectedUid &&
                !nextUsers.some((item) => item.uid === selectedUid)
            ) {
                setSelectedUid("");
                setSelectedUser(null);
                setActions([]);
            }
        } catch (err) {
            setError(
                err.message ||
                "Unable to load SYNCO accounts."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [roleFilter, search, selectedUid, statusFilter]);


    useEffect(() => {
        if (user?.account_role !== "admin") return undefined;

        const timer = window.setTimeout(() => {
            loadUsers(false);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [loadUsers, user]);


    const loadSelectedUser = useCallback(async (uid, showSpinner = true) => {
        if (!uid) return;

        try {
            if (showSpinner) {
                setDetailsLoading(true);
            }

            setError("");

            const encodedUid = encodeURIComponent(uid);

            const [userData, actionData] = await Promise.all([
                apiRequest(`/api/admin/users/${encodedUid}`),
                apiRequest(`/api/admin/users/${encodedUid}/actions`),
            ]);

            setSelectedUser(userData.user || null);
            setActions(
                Array.isArray(actionData.actions)
                    ? actionData.actions
                    : []
            );
        } catch (err) {
            setError(
                err.message ||
                "Unable to load this account."
            );
        } finally {
            setDetailsLoading(false);
        }
    }, []);


    useEffect(() => {
        if (!selectedUid) {
            setSelectedUser(null);
            setActions([]);
            return;
        }

        loadSelectedUser(selectedUid);
    }, [loadSelectedUser, selectedUid]);


    const openUser = (uid) => {
        if (!uid) return;
        setError("");
        setSuccess("");
        setSelectedUid(uid);
    };


    const closeDetails = () => {
        if (actionLoading) return;
        setSelectedUid("");
        setSelectedUser(null);
        setActions([]);
    };


    const openActionModal = (type) => {
        if (!selectedUser) return;

        if (selectedUser.account_role === "admin") {
            setError("Administrator accounts are protected.");
            return;
        }

        setModal(type);
        setReason("");
        setError("");
        setSuccess("");
    };


    const closeModal = () => {
        if (actionLoading) return;

        setModal(null);
        setReason("");
    };


    const performAction = async (action) => {
        if (!selectedUser || !action) return;

        const needsReason = action !== "unsuspend";
        const cleanReason = reason.trim();

        if (needsReason && !cleanReason) {
            setError("A reason is required for this action.");
            return;
        }

        if (cleanReason.length > 2000) {
            setError("Reason must be 2000 characters or fewer.");
            return;
        }

        const encodedUid = encodeURIComponent(selectedUser.uid);
        let endpoint = "";
        let options = { method: "POST" };

        if (action === "remove-organizer") {
            endpoint = `/api/admin/users/${encodedUid}/remove-organizer`;
            options = {
                method: "POST",
                body: JSON.stringify({ reason: cleanReason }),
            };
        }

        if (action === "suspend") {
            endpoint = `/api/admin/users/${encodedUid}/suspend`;
            options = {
                method: "POST",
                body: JSON.stringify({ reason: cleanReason }),
            };
        }

        if (action === "unsuspend") {
            endpoint = `/api/admin/users/${encodedUid}/unsuspend`;
        }

        if (action === "delete") {
            endpoint = `/api/admin/users/${encodedUid}`;
            options = {
                method: "DELETE",
                body: JSON.stringify({ reason: cleanReason }),
            };
        }

        if (!endpoint) {
            setError("Unknown administrative action.");
            return;
        }

        try {
            setActionLoading(action);
            setError("");
            setSuccess("");

            const data = await apiRequest(endpoint, options);

            setSuccess(
                data.message ||
                "Account updated successfully."
            );

            setModal(null);
            setReason("");

            if (action === "delete") {
                setSelectedUid("");
                setSelectedUser(null);
                setActions([]);
                await loadUsers(true);
                return;
            }

            await Promise.all([
                loadUsers(true),
                loadSelectedUser(selectedUser.uid, false),
            ]);
        } catch (err) {
            const blockers = Array.isArray(err.data?.blockers)
                ? err.data.blockers
                : [];

            const blockerText = blockers.length
                ? ` ${blockers
                    .map((blocker) => blocker.message)
                    .filter(Boolean)
                    .join("; ")}`
                : "";

            setError(
                `${err.message || "Unable to update account."}${blockerText}`
            );
        } finally {
            setActionLoading("");
        }
    };


    if (!user) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2
                    size={22}
                    className="animate-spin text-neutral-500"
                />
            </div>
        );
    }


    if (user.account_role !== "admin") {
        return null;
    }


    return (
        <div className="min-h-screen bg-[#f7f7f5] text-neutral-900">
            <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 transition hover:text-black"
                        >
                            <ArrowLeft size={15} />
                            Back
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white">
                                <ShieldCheck size={20} />
                            </div>

                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">
                                    SYNCO Administration
                                </p>
                                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                                    Account Management
                                </h1>
                            </div>
                        </div>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
                            Search, review and manage SYNCO accounts from one place.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadUsers(true)}
                        disabled={refreshing || Boolean(actionLoading)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw
                            size={16}
                            className={refreshing ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>
                </div>


                {error && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1 leading-6">
                            {error}
                        </div>
                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="shrink-0 text-red-500 hover:text-red-800"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1 leading-6">
                            {success}
                        </div>
                        <button
                            type="button"
                            onClick={() => setSuccess("")}
                            className="shrink-0 text-green-500 hover:text-green-800"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}


                <section className="mb-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                        <div className="relative">
                            <Search
                                size={17}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search UID, username, email or name"
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
                            />
                        </div>

                        <select
                            value={roleFilter}
                            onChange={(event) => setRoleFilter(event.target.value)}
                            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm font-medium text-neutral-700 outline-none transition focus:border-neutral-400 focus:bg-white"
                        >
                            <option value="all">All roles</option>
                            <option value="player">Players</option>
                            <option value="organizer">Organizers</option>
                            <option value="admin">Administrators</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm font-medium text-neutral-700 outline-none transition focus:border-neutral-400 focus:bg-white"
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>
                </section>


                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_470px]">
                    <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-neutral-900">
                                    Accounts
                                </p>
                                <p className="mt-1 text-xs text-neutral-400">
                                    {users.length} result{users.length === 1 ? "" : "s"}
                                </p>
                            </div>

                            {loading && (
                                <Loader2
                                    size={18}
                                    className="animate-spin text-neutral-400"
                                />
                            )}
                        </div>

                        {loading && users.length === 0 ? (
                            <div className="flex min-h-[420px] items-center justify-center">
                                <div className="flex items-center gap-3 text-sm text-neutral-500">
                                    <Loader2 size={20} className="animate-spin" />
                                    Loading accounts...
                                </div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500">
                                    <UserRound size={20} />
                                </div>
                                <p className="mt-4 text-sm font-bold text-neutral-800">
                                    No accounts found
                                </p>
                                <p className="mt-1 max-w-sm text-xs leading-5 text-neutral-400">
                                    Try a different search term or filter.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {users.map((item, index) => {
                                    const isSelected = item.uid === selectedUid;

                                    return (
                                        <button
                                            key={item.uid || item.id}
                                            type="button"
                                            onClick={() => openUser(item.uid)}
                                            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 text-left transition sm:grid-cols-[minmax(0,1fr)_130px_130px_auto] ${index < users.length - 1 ? "border-b border-neutral-100" : ""} ${isSelected ? "bg-neutral-50" : "hover:bg-neutral-50/70"}`}
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                                                    {item.avatar ? (
                                                        <img
                                                            src={item.avatar}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <UserRound size={17} className="text-neutral-500" />
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-neutral-900">
                                                        {getDisplayName(item)}
                                                    </p>
                                                    <p className="mt-1 truncate font-mono text-[10px] tracking-wide text-neutral-400">
                                                        {item.uid || "No UID"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="hidden items-center sm:flex">
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${roleClass(item.account_role)}`}>
                                                    {roleLabel(item.account_role)}
                                                </span>
                                            </div>

                                            <div className="hidden items-center sm:flex">
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass(item.account_status)}`}>
                                                    {item.account_status === "suspended" ? "Suspended" : "Active"}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-end gap-3 text-neutral-400">
                                                <span className="hidden max-w-[180px] truncate text-[11px] sm:inline">
                                                    {item.email}
                                                </span>
                                                <ChevronRight size={17} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>


                    <aside className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                        {!selectedUid ? (
                            <div className="flex min-h-[620px] flex-col items-center justify-center px-8 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-500">
                                    <UserCog size={22} />
                                </div>
                                <h2 className="mt-5 text-base font-bold text-neutral-900">
                                    Select an account
                                </h2>
                                <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-400">
                                    Select an account from the list to review its status, history and available actions.
                                </p>
                            </div>
                        ) : detailsLoading || !selectedUser ? (
                            <div className="flex min-h-[620px] items-center justify-center">
                                <div className="flex items-center gap-3 text-sm text-neutral-500">
                                    <Loader2 size={20} className="animate-spin" />
                                    Loading account...
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="border-b border-neutral-200 px-5 py-5 sm:px-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                                                {selectedUser.avatar ? (
                                                    <img
                                                        src={selectedUser.avatar}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <UserRound size={19} className="text-neutral-500" />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <p className="truncate text-base font-black text-neutral-900">
                                                    {getDisplayName(selectedUser)}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-neutral-400">
                                                    {selectedUser.email || "No email"}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={closeDetails}
                                            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${roleClass(selectedUser.account_role)}`}>
                                            {roleLabel(selectedUser.account_role)}
                                        </span>
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass(selectedUser.account_status)}`}>
                                            {selectedUser.account_status === "suspended" ? "Suspended" : "Active"}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-5 p-5 sm:p-6">
                                    <section>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                            Account
                                        </p>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <Info label="SYNCO UID" value={selectedUser.uid} mono />
                                            <Info label="Account ID" value={selectedUser.id} />
                                            <Info label="Name" value={selectedUser.name} />
                                            <Info label="Username" value={selectedUser.username || "Not set"} />
                                            <Info label="Email" value={selectedUser.email} />
                                            <Info label="Created" value={formatDate(selectedUser.created_at)} />
                                        </div>
                                    </section>

                                    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                                        <div className="flex items-center gap-2">
                                            <Clock3 size={16} className="text-neutral-500" />
                                            <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                                                Account status
                                            </p>
                                        </div>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <Info
                                                label="Status"
                                                value={selectedUser.account_status === "suspended" ? "Suspended" : "Active"}
                                            />
                                            <Info
                                                label="Changed"
                                                value={formatDate(selectedUser.account_status_changed_at)}
                                            />
                                        </div>

                                        {selectedUser.account_status_reason && (
                                            <div className="mt-3 rounded-lg border border-red-100 bg-white p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                                                    Suspension reason
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-neutral-700">
                                                    {selectedUser.account_status_reason}
                                                </p>
                                            </div>
                                        )}
                                    </section>

                                    <section>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                            Activity
                                        </p>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <Stat label="Clubs owned" value={selectedUser.counts?.clubsOwned} />
                                            <Stat label="Club memberships" value={selectedUser.counts?.clubMemberships} />
                                            <Stat label="Competitions organized" value={selectedUser.counts?.competitionsOrganized} />
                                            <Stat label="Competition entries" value={selectedUser.counts?.competitionParticipations} />
                                            <Stat label="Match results" value={selectedUser.counts?.matchResultsSubmitted} />
                                            <Stat label="Match stats" value={selectedUser.counts?.playerMatchStats} />
                                            <Stat label="Clips" value={selectedUser.counts?.clips} />
                                            <Stat label="Friendships" value={selectedUser.counts?.friendships} />
                                        </div>
                                    </section>

                                    {selectedUser.organizerApplication && (
                                        <section>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                                Organizer application
                                            </p>

                                            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-neutral-900">
                                                            {selectedUser.organizerApplication.organization_name ||
                                                                selectedUser.organizerApplication.organizationName ||
                                                                "Organizer application"}
                                                        </p>
                                                        <p className="mt-1 text-xs text-neutral-400">
                                                            {selectedUser.organizerApplication.application_code ||
                                                                selectedUser.organizerApplication.applicationCode ||
                                                                `Application #${selectedUser.organizerApplication.id}`}
                                                        </p>
                                                    </div>

                                                    <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                                                        {String(selectedUser.organizerApplication.status || "unknown")
                                                            .replace(/_/g, " ")
                                                            .toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    <section>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                            Administrative actions
                                        </p>

                                        <div className="mt-3 space-y-2">
                                            {selectedUser.account_role === "organizer" && (
                                                <button
                                                    type="button"
                                                    onClick={() => openActionModal("remove-organizer")}
                                                    disabled={Boolean(actionLoading)}
                                                    className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <span className="flex items-center gap-3">
                                                        <UserX size={17} className="text-neutral-600" />
                                                        <span>
                                                            <span className="block text-sm font-bold text-neutral-900">
                                                                Remove organizer access
                                                            </span>
                                                            <span className="mt-0.5 block text-xs text-neutral-400">
                                                                Changes the platform role to player.
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <ChevronRight size={16} className="text-neutral-400" />
                                                </button>
                                            )}

                                            {selectedUser.account_status === "suspended" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => performAction("unsuspend")}
                                                    disabled={Boolean(actionLoading)}
                                                    className="flex w-full items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <span className="flex items-center gap-3">
                                                        {actionLoading === "unsuspend" ? (
                                                            <Loader2 size={17} className="animate-spin text-green-700" />
                                                        ) : (
                                                            <CheckCircle2 size={17} className="text-green-700" />
                                                        )}
                                                        <span>
                                                            <span className="block text-sm font-bold text-green-800">
                                                                Restore account
                                                            </span>
                                                            <span className="mt-0.5 block text-xs text-green-700/70">
                                                                Reactivates the account with its current role.
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <ChevronRight size={16} className="text-green-700/60" />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => openActionModal("suspend")}
                                                    disabled={Boolean(actionLoading)}
                                                    className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <span className="flex items-center gap-3">
                                                        <Ban size={17} className="text-amber-700" />
                                                        <span>
                                                            <span className="block text-sm font-bold text-amber-800">
                                                                Suspend account
                                                            </span>
                                                            <span className="mt-0.5 block text-xs text-amber-700/70">
                                                                Blocks authentication and platform access.
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <ChevronRight size={16} className="text-amber-700/60" />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => openActionModal("delete")}
                                                disabled={Boolean(actionLoading)}
                                                className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <span className="flex items-center gap-3">
                                                    <Trash2 size={17} className="text-red-700" />
                                                    <span>
                                                        <span className="block text-sm font-bold text-red-800">
                                                            Delete account permanently
                                                        </span>
                                                        <span className="mt-0.5 block text-xs text-red-700/70">
                                                            Protected competition records can prevent deletion.
                                                        </span>
                                                    </span>
                                                </span>
                                                <ChevronRight size={16} className="text-red-700/60" />
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                                    Action history
                                                </p>
                                                <p className="mt-1 text-xs text-neutral-400">
                                                    Recent administrator actions for this account.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => loadSelectedUser(selectedUser.uid)}
                                                disabled={detailsLoading}
                                                className="rounded-lg border border-neutral-200 p-2 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800 disabled:opacity-50"
                                            >
                                                <RefreshCw
                                                    size={15}
                                                    className={detailsLoading ? "animate-spin" : ""}
                                                />
                                            </button>
                                        </div>

                                        <div className="mt-3 space-y-2">
                                            {actions.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-400">
                                                    No administrator actions recorded.
                                                </div>
                                            ) : (
                                                actions.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="rounded-xl border border-neutral-200 bg-white p-4"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${actionClass(item.action)}`}>
                                                                    {actionLabel(item.action)}
                                                                </p>
                                                                <p className="mt-2 text-xs leading-5 text-neutral-600">
                                                                    {item.reason || "No reason provided."}
                                                                </p>
                                                            </div>
                                                            <span className="shrink-0 text-[10px] text-neutral-400">
                                                                {formatDate(item.createdAt || item.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </main>


            {modal && selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
                    <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-5 sm:px-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                                    Confirm administrative action
                                </p>
                                <h2 className="mt-1 text-lg font-black tracking-tight text-neutral-900">
                                    {modal === "suspend"
                                        ? "Suspend this account?"
                                        : modal === "remove-organizer"
                                            ? "Remove organizer access?"
                                            : "Delete this account permanently?"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={Boolean(actionLoading)}
                                className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-5 py-5 sm:px-6">
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                                <p className="text-sm font-bold text-neutral-900">
                                    {getDisplayName(selectedUser)}
                                </p>
                                <p className="mt-1 break-all text-xs text-neutral-400">
                                    {selectedUser.uid} · {selectedUser.email}
                                </p>
                            </div>

                            {modal === "delete" && (
                                <div className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                                    <p className="leading-6">
                                        Permanent deletion cannot be undone. The backend may reject deletion when protected competition history exists.
                                    </p>
                                </div>
                            )}

                            <label className="mt-5 block">
                                <span className="text-xs font-bold text-neutral-800">
                                    Reason
                                </span>
                                <textarea
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    rows={5}
                                    maxLength={2000}
                                    placeholder={
                                        modal === "suspend"
                                            ? "Explain why the account is being suspended..."
                                            : modal === "remove-organizer"
                                                ? "Explain why organizer access is being removed..."
                                                : "Explain why the account is being permanently deleted..."
                                    }
                                    className="mt-2 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                                />
                                <span className="mt-1 flex justify-end text-[10px] text-neutral-400">
                                    {reason.length}/2000
                                </span>
                            </label>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={Boolean(actionLoading)}
                                className="rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() => performAction(modal)}
                                disabled={Boolean(actionLoading)}
                                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${modal === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-neutral-900 hover:bg-black"}`}
                            >
                                {actionLoading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : modal === "delete" ? (
                                    <Trash2 size={16} />
                                ) : modal === "suspend" ? (
                                    <Ban size={16} />
                                ) : (
                                    <UserX size={16} />
                                )}

                                {modal === "suspend"
                                    ? "Suspend account"
                                    : modal === "remove-organizer"
                                        ? "Remove organizer"
                                        : "Delete permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const Info = ({ label, value, mono = false }) => (
    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-400">
            {label}
        </p>
        <p
            className={`mt-1 truncate text-xs font-semibold text-neutral-800 ${mono ? "font-mono tracking-wide" : ""}`}
        >
            {value === null || value === undefined || value === ""
                ? "Not available"
                : value}
        </p>
    </div>
);


const Stat = ({ label, value }) => (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">
            {label}
        </p>
        <p className="mt-1.5 text-lg font-black tracking-tight text-neutral-900">
            {Number(value || 0).toLocaleString("en-IN")}
        </p>
    </div>
);


export default AdminUsers;
