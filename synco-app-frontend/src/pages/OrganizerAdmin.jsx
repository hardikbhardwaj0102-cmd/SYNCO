import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    ArrowLeft,
    Check,
    ChevronRight,
    Clock,
    ExternalLink,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    ShieldCheck,
    X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;


// =========================================================
// HELPERS
// =========================================================

const getValue = (object, ...keys) => {
    for (const key of keys) {
        if (
            object &&
            object[key] !== undefined &&
            object[key] !== null
        ) {
            return object[key];
        }
    }

    return null;
};


const formatDate = (value) => {
    if (!value) return "Not available";

    try {
        return new Date(value).toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }
        );
    } catch {
        return String(value);
    }
};


const displayValue = (value) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Not provided";
    }

    if (Array.isArray(value)) {
        return value.length
            ? value.join(", ")
            : "None";
    }

    return String(value);
};


const statusLabel = (status) => {
    if (!status) return "UNKNOWN";

    return String(status)
        .replace(/_/g, " ")
        .toUpperCase();
};


const statusClass = (status) => {
    switch (status) {
        case "pending":
            return "bg-amber-50 text-amber-700 border-amber-200";

        case "under_review":
            return "bg-neutral-100 text-neutral-700 border-neutral-300";

        case "approved":
            return "bg-green-50 text-green-700 border-green-200";

        case "rejected":
            return "bg-red-50 text-red-700 border-red-200";

        case "suspended":
            return "bg-neutral-100 text-neutral-600 border-neutral-200";

        default:
            return "bg-neutral-100 text-neutral-600 border-neutral-200";
    }
};


// =========================================================
// API
// =========================================================

const apiRequest = async (
    url,
    options = {}
) => {

    const response = await fetch(
        `${API_URL}${url}`,
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
            data.error ||
            "Something went wrong."
        );
    }

    return data;
};


// =========================================================
// MAIN COMPONENT
// =========================================================

const OrganizerAdmin = () => {

    const navigate = useNavigate();

    const { applicationId } = useParams();

    const isDetailPage = Boolean(
        applicationId
    );


    // =====================================================
    // STATE
    // =====================================================

    const [applications, setApplications] =
        useState([]);

    const [application, setApplication] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [actionLoading, setActionLoading] =
        useState("");

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [filter, setFilter] =
        useState("all");

    const [showReject, setShowReject] =
        useState(false);

    const [rejectReason, setRejectReason] =
        useState("");


    // =====================================================
    // LOAD APPLICATIONS
    // =====================================================

    const loadApplications = async (
        refresh = false
    ) => {

        try {

            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const query =
                filter !== "all"
                    ? `?status=${encodeURIComponent(filter)}`
                    : "";

            const data =
                await apiRequest(
                    `/api/organizers/admin/applications${query}`
                );

            setApplications(
                data.applications || []
            );

        } catch (err) {

            setError(
                err.message ||
                "Unable to load organizer applications."
            );

        } finally {

            setLoading(false);
            setRefreshing(false);
        }
    };


    // =====================================================
    // LOAD SINGLE APPLICATION
    // =====================================================

    const loadApplication = async (
        refresh = false
    ) => {

        if (!applicationId) {
            return;
        }

        try {

            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const data =
                await apiRequest(
                    `/api/organizers/admin/applications/${applicationId}`
                );

            setApplication(data);

        } catch (err) {

            setError(
                err.message ||
                "Unable to load organizer application."
            );

        } finally {

            setLoading(false);
            setRefreshing(false);
        }
    };


    // =====================================================
    // LOAD
    // =====================================================

    useEffect(() => {

        if (isDetailPage) {
            loadApplication();
        } else {
            loadApplications();
        }

    }, [
        applicationId,
        filter,
    ]);


    // =====================================================
    // ACTION
    // =====================================================

    const performAction = async (
        action
    ) => {

        if (!applicationId) {
            return;
        }

        try {

            setActionLoading(action);
            setError("");
            setSuccess("");

            if (
                action === "reject" &&
                !rejectReason.trim()
            ) {

                setError(
                    "A rejection reason is required."
                );

                return;
            }

            let options = {
                method: "POST",
            };

            if (action === "reject") {

                options.body = JSON.stringify({
                    reason: rejectReason.trim(),
                });
            }

            const data =
                await apiRequest(
                    `/api/organizers/admin/applications/${applicationId}/${action}`,
                    options
                );

            setApplication(
                (previous) => {

                    if (!previous) {
                        return previous;
                    }

                    return {
                        ...previous,
                        ...(
                            data.application || {}
                        ),
                    };
                }
            );

            setSuccess(
                data.message ||
                "Application updated successfully."
            );

            setShowReject(false);
            setRejectReason("");

        } catch (err) {

            setError(
                err.message ||
                "Unable to update application."
            );

        } finally {

            setActionLoading("");
        }
    };


    // =====================================================
    // FILTER LIST
    // =====================================================

    const filteredApplications =
        useMemo(() => {

            const query =
                search.trim().toLowerCase();

            if (!query) {
                return applications;
            }

            return applications.filter(
                (item) => {

                    const applicant =
                        item.applicant || {};

                    const values = [

                        item.organization_name,

                        item.organizationName,

                        item.application_code,

                        item.applicationCode,

                        applicant.name,

                        applicant.username,

                        applicant.email,

                        applicant.uid,

                    ];

                    return values.some(
                        (value) =>
                            String(
                                value || ""
                            )
                                .toLowerCase()
                                .includes(query)
                    );
                }
            );

        }, [
            applications,
            search,
        ]);


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (
            <div className="min-h-screen bg-white flex items-center justify-center">

                <div className="flex items-center gap-3 text-neutral-500">

                    <Loader2
                        size={22}
                        className="animate-spin"
                    />

                    <span className="text-sm">
                        Loading organizer applications...
                    </span>

                </div>

            </div>
        );
    }


    // =====================================================
    // DETAIL PAGE
    // =====================================================

    if (isDetailPage) {

        if (!application) {

            return (
                <div className="min-h-screen bg-white">

                    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

                        <button
                            onClick={() =>
                                navigate(
                                    "/admin/organizers"
                                )
                            }
                            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-black transition"
                        >
                            <ArrowLeft size={16} />
                            Back to applications
                        </button>

                        <div className="mt-10 rounded-2xl border border-neutral-200 p-10 text-center">

                            <FileText
                                size={32}
                                className="mx-auto text-neutral-300"
                            />

                            <h2 className="mt-4 text-lg font-semibold text-black">
                                Application not found
                            </h2>

                            <p className="mt-2 text-sm text-neutral-500">
                                The organizer application could not be loaded.
                            </p>

                        </div>

                    </main>
                </div>
            );
        }


        const applicant =
            application.applicant || {};

        const status =
            getValue(
                application,
                "status"
            );

        const organizationName =
            getValue(
                application,
                "organization_name",
                "organizationName"
            );

        const organizerType =
            getValue(
                application,
                "organizer_type",
                "organizerType"
            );

        const country =
            getValue(
                application,
                "country"
            );

        const city =
            getValue(
                application,
                "city"
            );

        const phone =
            getValue(
                application,
                "contact_phone",
                "contactPhone"
            );

        const experienceYears =
            getValue(
                application,
                "experience_years",
                "experienceYears"
            );

        const eventsOrganized =
            getValue(
                application,
                "events_organized",
                "eventsOrganized"
            );

        const largestEventSize =
            getValue(
                application,
                "largest_event_size",
                "largestEventSize"
            );

        const games =
            getValue(
                application,
                "games"
            ) || [];

        const plannedGames =
            getValue(
                application,
                "planned_games",
                "plannedGames"
            ) || [];

        const website =
            getValue(
                application,
                "website_url",
                "websiteUrl"
            );

        const discord =
            getValue(
                application,
                "discord_url",
                "discordUrl"
            );

        const social =
            getValue(
                application,
                "social_url",
                "socialUrl"
            );

        const previousEvent =
            getValue(
                application,
                "previous_event_url",
                "previousEventUrl"
            );

        const experienceDescription =
            getValue(
                application,
                "experience_description",
                "experienceDescription"
            );

        const tournamentFrequency =
            getValue(
                application,
                "tournament_frequency",
                "tournamentFrequency"
            );

        const expectedParticipants =
            getValue(
                application,
                "expected_participants",
                "expectedParticipants"
            );

        const organizerDescription =
            getValue(
                application,
                "organizer_description",
                "organizerDescription"
            );

        const applicationCode =
            getValue(
                application,
                "application_code",
                "applicationCode"
            );

        const submittedAt =
            getValue(
                application,
                "submitted_at",
                "submittedAt"
            );

        const reviewedAt =
            getValue(
                application,
                "reviewed_at",
                "reviewedAt"
            );

        const rejectionReason =
            getValue(
                application,
                "rejection_reason",
                "rejectionReason"
            );

        const auditLogs =
            getValue(
                application,
                "audit_logs",
                "auditLogs"
            ) || [];


        return (

            <div className="min-h-screen bg-white text-neutral-900">

                <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">

                    {/* =============================================
                        TOP BAR
                    ============================================= */}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                        <button
                            onClick={() =>
                                navigate(
                                    "/admin/organizers"
                                )
                            }
                            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-black transition"
                        >

                            <ArrowLeft size={17} />

                            Back to applications

                        </button>

                        <button
                            onClick={() =>
                                loadApplication(true)
                            }
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
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

                    </div>


                    {/* =============================================
                        HEADER
                    ============================================= */}

                    <div className="mt-8">

                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">

                            <div>

                                <div className="flex flex-wrap items-center gap-3">

                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
                                        {organizationName ||
                                            "Organizer Application"}
                                    </h1>

                                    {status && (

                                        <span
                                            className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-[10px] font-bold tracking-wider ${statusClass(
                                                status
                                            )}`}
                                        >
                                            {statusLabel(status)}
                                        </span>

                                    )}

                                </div>

                                <p className="mt-2 text-sm text-neutral-500">
                                    Application{" "}
                                    {applicationCode ||
                                        `#${applicationId}`}
                                </p>

                            </div>


                            {/* ACTIONS */}

                            <div className="flex flex-wrap gap-2">

                                {status !==
                                    "approved" &&
                                    status !==
                                    "rejected" && (

                                        <>

                                            <button
                                                onClick={() =>
                                                    performAction(
                                                        "review"
                                                    )
                                                }
                                                disabled={
                                                    Boolean(
                                                        actionLoading
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                                            >

                                                {actionLoading ===
                                                    "review" ? (

                                                    <Loader2
                                                        size={15}
                                                        className="animate-spin"
                                                    />

                                                ) : (

                                                    <Clock
                                                        size={15}
                                                    />

                                                )}

                                                Under Review

                                            </button>


                                            <button
                                                onClick={() =>
                                                    performAction(
                                                        "approve"
                                                    )
                                                }
                                                disabled={
                                                    Boolean(
                                                        actionLoading
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                                            >

                                                {actionLoading ===
                                                    "approve" ? (

                                                    <Loader2
                                                        size={15}
                                                        className="animate-spin"
                                                    />

                                                ) : (

                                                    <Check
                                                        size={15}
                                                    />

                                                )}

                                                Approve

                                            </button>


                                            <button
                                                onClick={() =>
                                                    setShowReject(
                                                        true
                                                    )
                                                }
                                                disabled={
                                                    Boolean(
                                                        actionLoading
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                            >

                                                <X
                                                    size={15}
                                                />

                                                Reject

                                            </button>

                                        </>
                                    )}

                            </div>

                        </div>

                    </div>


                    {/* =============================================
                        ALERTS
                    ============================================= */}

                    {error && (

                        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                            <p className="text-sm text-red-700">
                                {error}
                            </p>

                        </div>

                    )}

                    {success && (

                        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">

                            <p className="text-sm text-green-700">
                                {success}
                            </p>

                        </div>

                    )}


                    {/* =============================================
                        REJECT PANEL
                    ============================================= */}

                    {showReject && (

                        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">

                            <div className="flex items-start justify-between gap-4">

                                <div>

                                    <h2 className="text-sm font-bold text-red-800">
                                        Reject organizer application
                                    </h2>

                                    <p className="mt-1 text-xs leading-5 text-red-700">
                                        Enter the reason that should be
                                        recorded with this application.
                                    </p>

                                </div>

                                <button
                                    onClick={() =>
                                        setShowReject(
                                            false
                                        )
                                    }
                                    className="text-red-500 hover:text-red-800"
                                >
                                    <X size={17} />
                                </button>

                            </div>

                            <textarea
                                value={
                                    rejectReason
                                }
                                onChange={(event) =>
                                    setRejectReason(
                                        event.target.value
                                    )
                                }
                                rows={4}
                                placeholder="Enter rejection reason..."
                                className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400"
                            />

                            <div className="mt-3 flex justify-end gap-2">

                                <button
                                    onClick={() =>
                                        setShowReject(
                                            false
                                        )
                                    }
                                    className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={() =>
                                        performAction(
                                            "reject"
                                        )
                                    }
                                    disabled={
                                        actionLoading ===
                                        "reject"
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >

                                    {actionLoading ===
                                        "reject" && (

                                            <Loader2
                                                size={15}
                                                className="animate-spin"
                                            />

                                        )}

                                    Confirm Rejection

                                </button>

                            </div>

                        </div>
                    )}


                    {/* =============================================
                        APPLICANT
                    ============================================= */}

                    <section className="mt-8">

                        <div className="rounded-2xl border border-neutral-200 overflow-hidden">

                            <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">

                                <h2 className="text-sm font-bold text-black">
                                    Applicant
                                </h2>

                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6 p-5">

                                <Info
                                    label="Name"
                                    value={
                                        applicant.name
                                    }
                                />

                                <Info
                                    label="Username"
                                    value={
                                        applicant.username
                                    }
                                />

                                <Info
                                    label="SYNCO UID"
                                    value={
                                        applicant.uid
                                    }
                                />

                                <Info
                                    label="Email"
                                    value={
                                        applicant.email
                                    }
                                />

                                <Info
                                    label="User ID"
                                    value={
                                        applicant.id
                                    }
                                />

                                <Info
                                    label="Account Role"
                                    value={
                                        applicant.accountRole ||
                                        applicant.account_role
                                    }
                                />

                            </div>

                        </div>

                    </section>


                    {/* =============================================
                        ORGANIZER DETAILS
                    ============================================= */}

                    <section className="mt-5">

                        <Section
                            title="Organization Details"
                        >

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">

                                <Info
                                    label="Organization"
                                    value={
                                        organizationName
                                    }
                                />

                                <Info
                                    label="Organizer Type"
                                    value={
                                        organizerType
                                    }
                                />

                                <Info
                                    label="Country"
                                    value={
                                        country
                                    }
                                />

                                <Info
                                    label="City"
                                    value={
                                        city
                                    }
                                />

                                <Info
                                    label="Contact Phone"
                                    value={
                                        phone
                                    }
                                />

                            </div>

                        </Section>

                    </section>


                    {/* =============================================
                        EXPERIENCE
                    ============================================= */}

                    <section className="mt-5">

                        <Section
                            title="Experience"
                        >

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">

                                <Info
                                    label="Experience"
                                    value={
                                        experienceYears !==
                                            null
                                            ? `${experienceYears} years`
                                            : null
                                    }
                                />

                                <Info
                                    label="Events Organized"
                                    value={
                                        eventsOrganized
                                    }
                                />

                                <Info
                                    label="Largest Event"
                                    value={
                                        largestEventSize
                                    }
                                />

                                <Info
                                    label="Games Organized"
                                    value={
                                        games
                                    }
                                />

                            </div>

                            <LongText
                                label="Experience Description"
                                value={
                                    experienceDescription
                                }
                            />

                        </Section>

                    </section>


                    {/* =============================================
                        SYNCO PLANS
                    ============================================= */}

                    <section className="mt-5">

                        <Section
                            title="SYNCO Plans"
                        >

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">

                                <Info
                                    label="Planned Games"
                                    value={
                                        plannedGames
                                    }
                                />

                                <Info
                                    label="Tournament Frequency"
                                    value={
                                        tournamentFrequency
                                    }
                                />

                                <Info
                                    label="Expected Participants"
                                    value={
                                        expectedParticipants
                                    }
                                />

                            </div>

                            <LongText
                                label="Organizer Description"
                                value={
                                    organizerDescription
                                }
                            />

                        </Section>

                    </section>


                    {/* =============================================
                        LINKS
                    ============================================= */}

                    <section className="mt-5">

                        <Section
                            title="External Links"
                        >

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                <LinkBox
                                    label="Website"
                                    value={website}
                                />

                                <LinkBox
                                    label="Discord"
                                    value={discord}
                                />

                                <LinkBox
                                    label="Social Profile"
                                    value={social}
                                />

                                <LinkBox
                                    label="Previous Event"
                                    value={previousEvent}
                                />

                            </div>

                        </Section>

                    </section>


                    {/* =============================================
                        APPLICATION META
                    ============================================= */}

                    <section className="mt-5">

                        <Section
                            title="Application Record"
                        >

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">

                                <Info
                                    label="Application Code"
                                    value={
                                        applicationCode
                                    }
                                />

                                <Info
                                    label="Submitted"
                                    value={
                                        formatDate(
                                            submittedAt
                                        )
                                    }
                                />

                                <Info
                                    label="Reviewed"
                                    value={
                                        formatDate(
                                            reviewedAt
                                        )
                                    }
                                />

                                <Info
                                    label="Reviewed By"
                                    value={
                                        getValue(
                                            application,
                                            "reviewed_by",
                                            "reviewedBy"
                                        )
                                    }
                                />

                            </div>

                            {rejectionReason && (

                                <LongText
                                    label="Rejection Reason"
                                    value={
                                        rejectionReason
                                    }
                                />

                            )}

                        </Section>

                    </section>


                    {/* =============================================
                        AUDIT LOG
                    ============================================= */}

                    <section className="mt-5 mb-10">

                        <Section
                            title="Review History"
                        >

                            {auditLogs.length === 0 ? (

                                <p className="text-sm text-neutral-500">
                                    No review history is available.
                                </p>

                            ) : (

                                <div className="space-y-3">

                                    {auditLogs.map(
                                        (
                                            log,
                                            index
                                        ) => (

                                            <div
                                                key={
                                                    log.id ||
                                                    index
                                                }
                                                className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
                                            >

                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                                                    <div>

                                                        <p className="text-sm font-bold text-black">
                                                            {statusLabel(
                                                                getValue(
                                                                    log,
                                                                    "action"
                                                                )
                                                            )}
                                                        </p>

                                                        <p className="mt-1 text-xs text-neutral-500">
                                                            Actor:{" "}
                                                            {getValue(
                                                                log,
                                                                "actor_id",
                                                                "actorId"
                                                            ) ||
                                                                "Unknown"}
                                                        </p>

                                                    </div>

                                                    <p className="text-xs text-neutral-400">
                                                        {formatDate(
                                                            getValue(
                                                                log,
                                                                "created_at",
                                                                "createdAt"
                                                            )
                                                        )}
                                                    </p>

                                                </div>

                                                {getValue(
                                                    log,
                                                    "reason"
                                                ) && (

                                                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                                                            {getValue(
                                                                log,
                                                                "reason"
                                                            )}
                                                        </p>

                                                    )}

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </Section>

                    </section>

                </main>

            </div>
        );
    }


    // =====================================================
    // LIST PAGE
    // =====================================================

    const pendingCount =
        applications.filter(
            (item) =>
                getValue(
                    item,
                    "status"
                ) === "pending"
        ).length;

    const reviewCount =
        applications.filter(
            (item) =>
                getValue(
                    item,
                    "status"
                ) === "under_review"
        ).length;


    return (

        <div className="min-h-screen bg-white text-neutral-900">

            <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">

                {/* =============================================
                    HEADER
                ============================================= */}

                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

                    <div>

                        <div className="flex items-center gap-3">

                            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
                                <ShieldCheck size={19} />
                            </div>

                            <div>

                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
                                    Organizer Applications
                                </h1>

                                <p className="mt-1 text-sm text-neutral-500">
                                    Review and manage SYNCO organizer applications.
                                </p>

                            </div>

                        </div>

                    </div>

                    <button
                        onClick={() =>
                            loadApplications(true)
                        }
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
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

                </div>


                {/* =============================================
                    STATS
                ============================================= */}

                <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">

                    <Stat
                        label="Applications"
                        value={
                            applications.length
                        }
                    />

                    <Stat
                        label="Pending"
                        value={
                            pendingCount
                        }
                    />

                    <Stat
                        label="Under Review"
                        value={
                            reviewCount
                        }
                    />

                </div>


                {/* =============================================
                    FILTERS
                ============================================= */}

                <div className="mt-7 flex flex-col sm:flex-row gap-3">

                    <div className="relative flex-1">

                        <Search
                            size={17}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />

                        <input
                            value={search}
                            onChange={(event) =>
                                setSearch(
                                    event.target.value
                                )
                            }
                            placeholder="Search organization, username, UID or application code..."
                            className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-neutral-400"
                        />

                    </div>

                    <select
                        value={filter}
                        onChange={(event) =>
                            setFilter(
                                event.target.value
                            )
                        }
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-neutral-400"
                    >

                        <option value="all">
                            All applications
                        </option>

                        <option value="pending">
                            Pending
                        </option>

                        <option value="under_review">
                            Under Review
                        </option>

                        <option value="approved">
                            Approved
                        </option>

                        <option value="rejected">
                            Rejected
                        </option>

                        <option value="suspended">
                            Suspended
                        </option>

                    </select>

                </div>


                {/* =============================================
                    ERROR
                ============================================= */}

                {error && (

                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">

                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                    </div>

                )}


                {/* =============================================
                    EMPTY
                ============================================= */}

                {filteredApplications.length === 0 ? (

                    <div className="mt-8 rounded-2xl border border-neutral-200 p-12 text-center">

                        <FileText
                            size={30}
                            className="mx-auto text-neutral-300"
                        />

                        <h2 className="mt-4 text-base font-semibold text-black">
                            No organizer applications
                        </h2>

                        <p className="mt-2 text-sm text-neutral-500">
                            {search
                                ? "No applications match your search."
                                : "Applications submitted by players will appear here."
                            }
                        </p>

                    </div>

                ) : (

                    <div className="mt-8 rounded-2xl border border-neutral-200 overflow-hidden">

                        <div className="hidden md:grid grid-cols-[1.4fr_1fr_1fr_130px_40px] gap-4 border-b border-neutral-200 bg-neutral-50 px-5 py-3">

                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                Organization
                            </span>

                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                Applicant
                            </span>

                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                Submitted
                            </span>

                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                Status
                            </span>

                            <span />

                        </div>


                        {filteredApplications.map(
                            (
                                item,
                                index
                            ) => {

                                const itemApplicant =
                                    item.applicant ||
                                    {};

                                const itemStatus =
                                    getValue(
                                        item,
                                        "status"
                                    );

                                const itemOrganization =
                                    getValue(
                                        item,
                                        "organization_name",
                                        "organizationName"
                                    );

                                const itemCode =
                                    getValue(
                                        item,
                                        "application_code",
                                        "applicationCode"
                                    );

                                const itemSubmitted =
                                    getValue(
                                        item,
                                        "submitted_at",
                                        "submittedAt"
                                    );

                                return (

                                    <button
                                        key={
                                            item.id ||
                                            itemCode ||
                                            index
                                        }
                                        onClick={() =>
                                            navigate(
                                                `/admin/organizers/${item.id}`
                                            )
                                        }
                                        className={`w-full text-left grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_130px_40px] gap-3 md:gap-4 px-5 py-4 hover:bg-neutral-50 transition ${index !==
                                                filteredApplications.length - 1
                                                ? "border-b border-neutral-200"
                                                : ""
                                            }`}
                                    >

                                        <div>

                                            <p className="text-sm font-semibold text-black">
                                                {itemOrganization ||
                                                    "Unnamed Organization"}
                                            </p>

                                            <p className="mt-1 text-[11px] text-neutral-400">
                                                {itemCode ||
                                                    `Application #${item.id}`}
                                            </p>

                                        </div>


                                        <div>

                                            <p className="text-sm font-medium text-neutral-800">
                                                {itemApplicant.name ||
                                                    itemApplicant.username ||
                                                    "Unknown"}
                                            </p>

                                            <p className="mt-1 text-[11px] text-neutral-400">
                                                {itemApplicant.uid ||
                                                    "No UID"}
                                            </p>

                                        </div>


                                        <div className="flex items-center">

                                            <p className="text-xs text-neutral-500">
                                                {formatDate(
                                                    itemSubmitted
                                                )}
                                            </p>

                                        </div>


                                        <div className="flex items-center">

                                            <span
                                                className={`inline-flex rounded-md border px-2.5 py-1.5 text-[10px] font-bold tracking-wider ${statusClass(
                                                    itemStatus
                                                )}`}
                                            >
                                                {statusLabel(
                                                    itemStatus
                                                )}
                                            </span>

                                        </div>


                                        <div className="hidden md:flex items-center justify-end">

                                            <ChevronRight
                                                size={17}
                                                className="text-neutral-300"
                                            />

                                        </div>

                                    </button>
                                );
                            }
                        )}

                    </div>

                )}

            </main>

        </div>
    );
};


// =========================================================
// SMALL COMPONENTS
// =========================================================

const Section = ({
    title,
    children,
}) => {

    return (
        <div className="rounded-2xl border border-neutral-200 overflow-hidden">

            <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">

                <h2 className="text-sm font-bold text-black">
                    {title}
                </h2>

            </div>

            <div className="p-5">
                {children}
            </div>

        </div>
    );
};


const Info = ({
    label,
    value,
}) => {

    return (
        <div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                {label}
            </p>

            <p className="mt-1.5 text-sm font-medium text-neutral-800 break-words">
                {displayValue(value)}
            </p>

        </div>
    );
};


const LongText = ({
    label,
    value,
}) => {

    return (
        <div className="mt-7">

            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                {label}
            </p>

            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">

                <p className="text-sm leading-6 text-neutral-700 whitespace-pre-wrap">
                    {displayValue(value)}
                </p>

            </div>

        </div>
    );
};


const LinkBox = ({
    label,
    value,
}) => {

    if (!value) {

        return (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">

                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    {label}
                </p>

                <p className="mt-1 text-sm text-neutral-400">
                    Not provided
                </p>

            </div>
        );
    }


    return (

        <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 hover:bg-white transition"
        >

            <div className="flex items-center justify-between gap-3">

                <div className="min-w-0">

                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        {label}
                    </p>

                    <p className="mt-1 text-sm font-medium text-neutral-800 truncate">
                        {value}
                    </p>

                </div>

                <ExternalLink
                    size={15}
                    className="shrink-0 text-neutral-400 group-hover:text-black"
                />

            </div>

        </a>
    );
};


const Stat = ({
    label,
    value,
}) => {

    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">

            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                {label}
            </p>

            <p className="mt-1 text-2xl font-bold tracking-tight text-black">
                {value}
            </p>

        </div>
    );
};


export default OrganizerAdmin;