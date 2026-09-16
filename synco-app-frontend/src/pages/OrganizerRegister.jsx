import React, { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    Globe2,
    Link2,
    Loader2,
    MapPin,
    ShieldCheck,
    Trophy,
    Users,
    X,
} from "lucide-react";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://synco-backend-vi7b.onrender.com";

const GAMES = [
    { value: "bgmi", label: "BGMI" },
    { value: "pubgm", label: "PUBG Mobile" },
    { value: "pubg", label: "PUBG" },
    { value: "valorant", label: "Valorant" },
    { value: "cs2", label: "Counter-Strike 2" },
    { value: "freefire", label: "Free Fire" },
    { value: "clash_royale", label: "Clash Royale" },
];

const ORGANIZER_TYPES = [
    "Individual Organizer",
    "Esports Organization",
    "Gaming Community",
    "College / University",
    "Tournament Platform",
    "Other",
];

const FREQUENCIES = [
    "One-time events",
    "Monthly",
    "2–3 events per month",
    "Weekly",
    "Multiple events every week",
];

const STEPS = [
    {
        id: 1,
        title: "Organizer",
        description: "Tell us who is organizing events.",
    },
    {
        id: 2,
        title: "Experience",
        description: "Give us your tournament background.",
    },
    {
        id: 3,
        title: "SYNCO Plans",
        description: "Tell us what you want to build.",
    },
    {
        id: 4,
        title: "Review",
        description: "Check everything before submitting.",
    },
];

const initialForm = {
    organization_name: "",
    organizer_type: "",
    country: "",
    city: "",
    contact_phone: "",
    games: [],
    website_url: "",
    discord_url: "",
    social_url: "",
    previous_event_url: "",
    experience_years: "",
    events_organized: "",
    largest_event_size: "",
    experience_description: "",
    planned_games: [],
    tournament_frequency: "",
    expected_participants: "",
    organizer_description: "",
};

function InputField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    required = false,
    helper,
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-900">
                {label}
                {required && <span className="ml-1 text-neutral-500">*</span>}
            </label>

            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/5"
            />

            {helper && (
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {helper}
                </p>
            )}
        </div>
    );
}

function TextareaField({
    label,
    value,
    onChange,
    placeholder,
    required = false,
    rows = 5,
    helper,
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-900">
                {label}
                {required && <span className="ml-1 text-neutral-500">*</span>}
            </label>

            <textarea
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/5"
            />

            {helper && (
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {helper}
                </p>
            )}
        </div>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
    placeholder,
    required = false,
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-900">
                {label}
                {required && <span className="ml-1 text-neutral-500">*</span>}
            </label>

            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/5"
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </div>
    );
}

function MultiSelect({
    label,
    selected,
    onToggle,
    options,
    required = false,
    helper,
}) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-neutral-900">
                    {label}
                    {required && (
                        <span className="ml-1 text-neutral-500">*</span>
                    )}
                </label>

                {selected.length > 0 && (
                    <span className="text-xs font-semibold text-neutral-500">
                        {selected.length} selected
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.map((game) => {
                    const active = selected.includes(game.value);

                    return (
                        <button
                            type="button"
                            key={game.value}
                            onClick={() => onToggle(game.value)}
                            className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left transition ${active
                                    ? "border-neutral-900 bg-neutral-900 text-white"
                                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                                }`}
                        >
                            <span className="text-sm font-semibold">
                                {game.label}
                            </span>

                            <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${active
                                        ? "border-white bg-white text-neutral-900"
                                        : "border-neutral-300 bg-white"
                                    }`}
                            >
                                {active && <Check size={13} strokeWidth={3} />}
                            </span>
                        </button>
                    );
                })}
            </div>

            {helper && (
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {helper}
                </p>
            )}
        </div>
    );
}

function SummaryRow({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-6 border-b border-neutral-100 py-4 last:border-b-0">
            <span className="text-sm text-neutral-500">{label}</span>
            <span className="max-w-[60%] text-right text-sm font-semibold text-neutral-900">
                {value || "Not provided"}
            </span>
        </div>
    );
}

export default function OrganizerRegister() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [accountRole, setAccountRole] = useState("player");
    const [existingApplication, setExistingApplication] = useState(null);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [submittedApplication, setSubmittedApplication] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadCurrentState() {
            try {
                setCheckingAuth(true);

                const response = await fetch(
                    `${API_URL}/api/organizers/application`,
                    {
                        method: "GET",
                        credentials: "include",
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                const data = await response.json().catch(() => ({}));

                if (cancelled) return;

                if (response.status === 401) {
                    setAuthenticated(false);
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Unable to load organizer registration."
                    );
                }

                setAuthenticated(true);
                setAccountRole(data.accountRole || "player");
                setExistingApplication(data.application || null);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.message ||
                        "Unable to connect to the organizer service."
                    );
                }
            } finally {
                if (!cancelled) {
                    setCheckingAuth(false);
                }
            }
        }

        loadCurrentState();

        return () => {
            cancelled = true;
        };
    }, []);

    const update = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
        setError("");
    };

    const toggleGame = (field, value) => {
        setForm((current) => {
            const values = current[field];
            const exists = values.includes(value);

            return {
                ...current,
                [field]: exists
                    ? values.filter((item) => item !== value)
                    : [...values, value],
            };
        });

        setError("");
    };

    const getGameLabels = (values) =>
        values
            .map(
                (value) =>
                    GAMES.find((game) => game.value === value)?.label || value
            )
            .join(", ");

    const validationMessage = useMemo(() => {
        if (step === 1) {
            if (!form.organization_name.trim()) {
                return "Enter your organizer or organization name.";
            }

            if (!form.organizer_type) {
                return "Select an organizer type.";
            }

            if (!form.country.trim()) {
                return "Enter your country.";
            }

            if (!form.city.trim()) {
                return "Enter your city.";
            }

            if (!form.contact_phone.trim()) {
                return "Enter a contact phone number.";
            }

            if (form.games.length === 0) {
                return "Select at least one game you organize.";
            }
        }

        if (step === 2) {
            if (form.experience_years === "") {
                return "Enter your years of organizing experience.";
            }

            if (Number(form.experience_years) < 0) {
                return "Years of experience cannot be negative.";
            }

            if (form.events_organized === "") {
                return "Enter how many events you have organized.";
            }

            if (Number(form.events_organized) < 0) {
                return "Events organized cannot be negative.";
            }

            if (
                form.largest_event_size !== "" &&
                Number(form.largest_event_size) <= 0
            ) {
                return "Largest event size must be greater than zero.";
            }

            if (!form.experience_description.trim()) {
                return "Describe your previous organizing experience.";
            }
        }

        if (step === 3) {
            if (form.planned_games.length === 0) {
                return "Select at least one game you plan to organize on SYNCO.";
            }

            if (!form.tournament_frequency) {
                return "Select your expected tournament frequency.";
            }

            if (form.expected_participants === "") {
                return "Enter your expected participant count.";
            }

            if (Number(form.expected_participants) <= 0) {
                return "Expected participants must be greater than zero.";
            }

            if (!form.organizer_description.trim()) {
                return "Tell us briefly what you want to build on SYNCO.";
            }
        }

        return "";
    }, [form, step]);

    const handleNext = () => {
        const message = validationMessage;

        if (message) {
            setError(message);
            return;
        }

        setError("");
        setStep((current) => Math.min(current + 1, STEPS.length));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleBack = () => {
        setError("");
        setStep((current) => Math.max(current - 1, 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const submitApplication = async () => {
        if (validationMessage) {
            setError(validationMessage);
            setStep(
                validationMessage.includes("organizer")
                    ? 1
                    : validationMessage.includes("experience")
                        ? 2
                        : 3
            );
            return;
        }

        try {
            setLoading(true);
            setError("");

            const payload = {
                organization_name: form.organization_name.trim(),
                organizer_type: form.organizer_type,
                country: form.country.trim(),
                city: form.city.trim(),
                contact_phone: form.contact_phone.trim(),
                games: form.games,
                website_url: form.website_url.trim(),
                discord_url: form.discord_url.trim(),
                social_url: form.social_url.trim(),
                previous_event_url: form.previous_event_url.trim(),
                experience_years:
                    form.experience_years === ""
                        ? 0
                        : Number(form.experience_years),
                events_organized:
                    form.events_organized === ""
                        ? 0
                        : Number(form.events_organized),
                largest_event_size:
                    form.largest_event_size === ""
                        ? null
                        : Number(form.largest_event_size),
                experience_description:
                    form.experience_description.trim(),
                planned_games: form.planned_games,
                tournament_frequency: form.tournament_frequency,
                expected_participants: Number(form.expected_participants),
                organizer_description:
                    form.organizer_description.trim(),
            };

            const response = await fetch(
                `${API_URL}/api/organizers/apply`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                throw new Error(
                    "Your session has expired. Please log in again."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to submit your application."
                );
            }

            setSubmittedApplication(data.application || null);
            setExistingApplication(data.application || null);
            setSuccess(true);
        } catch (err) {
            setError(
                err.message ||
                "Something went wrong while submitting your application."
            );
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-[#f7f7f5]">
                <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
                    <div className="flex items-center gap-3 text-sm font-semibold text-neutral-700">
                        <Loader2
                            size={18}
                            className="animate-spin"
                        />
                        Checking your account...
                    </div>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#f7f7f5]">
                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
                    <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.06)] sm:p-12">
                        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                            <ShieldCheck size={22} />
                        </div>

                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
                            SYNCO Organizer Program
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
                            Login required
                        </h1>

                        <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-500">
                            Sign in to your SYNCO account before applying to
                            become an organizer.
                        </p>

                        <a
                            href="/login"
                            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800"
                        >
                            Go to Login
                            <ArrowRight
                                size={17}
                                className="ml-2"
                            />
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (accountRole === "organizer") {
        return (
            <div className="min-h-screen bg-[#f7f7f5]">
                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
                    <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.06)] sm:p-12">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                            <Trophy size={24} />
                        </div>

                        <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
                            Organizer Account
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
                            You already have organizer access
                        </h1>

                        <p className="mt-4 text-sm leading-6 text-neutral-500">
                            Your SYNCO account is already registered as an
                            organizer. Open the organizer dashboard to create
                            and manage competitions.
                        </p>

                        <a
                            href="/dashboard"
                            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800"
                        >
                            Open Dashboard
                            <ArrowRight
                                size={17}
                                className="ml-2"
                            />
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (existingApplication && !success) {
        const status = existingApplication.status || "pending";

        return (
            <div className="min-h-screen bg-[#f7f7f5]">
                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
                    <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.06)] sm:p-12">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                            <ShieldCheck size={24} />
                        </div>

                        <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
                            Organizer Application
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
                            Application already submitted
                        </h1>

                        <p className="mt-4 text-sm leading-6 text-neutral-500">
                            Your organizer application is already in the SYNCO
                            review process.
                        </p>

                        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-sm font-semibold text-neutral-500">
                                    Status
                                </span>
                                <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                                    {status.replace("_", " ")}
                                </span>
                            </div>

                            {existingApplication.application_code && (
                                <div className="mt-4 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
                                    <span className="text-sm font-semibold text-neutral-500">
                                        Application ID
                                    </span>
                                    <span className="text-sm font-black text-neutral-900">
                                        {existingApplication.application_code}
                                    </span>
                                </div>
                            )}
                        </div>

                        {existingApplication.rejection_reason && (
                            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
                                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                                    Review Note
                                </p>
                                <p className="mt-2 text-sm leading-6 text-neutral-700">
                                    {existingApplication.rejection_reason}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#f7f7f5]">
                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
                    <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.06)] sm:p-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 text-white">
                            <CheckCircle2 size={30} />
                        </div>

                        <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
                            Application Submitted
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
                            Your organizer application is in review
                        </h1>

                        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-500">
                            Our team will review your information. Your SYNCO
                            account remains a player account until the
                            application is approved.
                        </p>

                        {submittedApplication?.application_code && (
                            <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                                    Application ID
                                </p>
                                <p className="mt-2 text-xl font-black tracking-tight text-neutral-950">
                                    {submittedApplication.application_code}
                                </p>
                            </div>
                        )}

                        <a
                            href="/"
                            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800"
                        >
                            Return to SYNCO
                            <ArrowRight
                                size={17}
                                className="ml-2"
                            />
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f7f7f5] text-neutral-950">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <a
                        href="/"
                        className="text-xl font-black tracking-tight text-neutral-950"
                    >
                        SYNCO
                    </a>

                    <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 sm:block">
                        Organizer Registration
                    </span>
                </div>

                <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
                    <aside className="lg:sticky lg:top-8 lg:h-fit">
                        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
                                Apply to organize
                            </p>

                            <div className="mt-6 space-y-2">
                                {STEPS.map((item) => {
                                    const complete = step > item.id;
                                    const current = step === item.id;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-2xl p-3 transition ${current
                                                    ? "bg-neutral-900 text-white"
                                                    : "text-neutral-500"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${current
                                                            ? "border-white/20 bg-white text-neutral-950"
                                                            : complete
                                                                ? "border-neutral-900 bg-neutral-900 text-white"
                                                                : "border-neutral-200 bg-neutral-50 text-neutral-400"
                                                        }`}
                                                >
                                                    {complete ? (
                                                        <Check size={14} strokeWidth={3} />
                                                    ) : (
                                                        item.id
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <p
                                                        className={`text-sm font-bold ${current
                                                                ? "text-white"
                                                                : "text-neutral-800"
                                                            }`}
                                                    >
                                                        {item.title}
                                                    </p>
                                                    <p
                                                        className={`mt-1 text-[11px] leading-4 ${current
                                                                ? "text-neutral-300"
                                                                : "text-neutral-400"
                                                            }`}
                                                    >
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-4 hidden rounded-3xl border border-neutral-200 bg-white p-5 lg:block">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">
                                    <ShieldCheck size={17} />
                                </div>
                                <p className="text-sm font-bold">
                                    What happens next?
                                </p>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-neutral-500">
                                Your application is reviewed by the SYNCO
                                team. Approval changes your platform role to
                                organizer.
                            </p>
                        </div>
                    </aside>

                    <main className="min-w-0">
                        <div className="rounded-[28px] border border-neutral-200 bg-white shadow-[0_20px_70px_rgba(0,0,0,0.05)]">
                            <div className="border-b border-neutral-100 px-6 py-7 sm:px-8">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                                            Step {step} of {STEPS.length}
                                        </p>

                                        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                                            {STEPS[step - 1].title}
                                        </h1>
                                    </div>

                                    <div className="hidden items-center gap-2 sm:flex">
                                        {STEPS.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`h-1.5 w-10 rounded-full ${item.id <= step
                                                        ? "bg-neutral-900"
                                                        : "bg-neutral-100"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-7 sm:px-8 sm:py-8">
                                {error && (
                                    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                        <div className="mt-0.5">
                                            <X size={17} />
                                        </div>
                                        <p className="text-sm font-semibold leading-5 text-neutral-800">
                                            {error}
                                        </p>
                                    </div>
                                )}

                                {step === 1 && (
                                    <div className="space-y-7">
                                        <div className="grid gap-5 sm:grid-cols-2">
                                            <InputField
                                                label="Organizer / Organization Name"
                                                value={
                                                    form.organization_name
                                                }
                                                onChange={(value) =>
                                                    update(
                                                        "organization_name",
                                                        value
                                                    )
                                                }
                                                placeholder="e.g. Nexa Esports"
                                                required
                                            />

                                            <SelectField
                                                label="Organizer Type"
                                                value={form.organizer_type}
                                                onChange={(value) =>
                                                    update(
                                                        "organizer_type",
                                                        value
                                                    )
                                                }
                                                options={ORGANIZER_TYPES}
                                                placeholder="Select organizer type"
                                                required
                                            />
                                        </div>

                                        <div className="grid gap-5 sm:grid-cols-2">
                                            <div className="relative">
                                                <InputField
                                                    label="Country"
                                                    value={form.country}
                                                    onChange={(value) =>
                                                        update(
                                                            "country",
                                                            value
                                                        )
                                                    }
                                                    placeholder="e.g. India"
                                                    required
                                                />
                                                <MapPin
                                                    size={16}
                                                    className="pointer-events-none absolute right-4 top-[42px] text-neutral-400"
                                                />
                                            </div>

                                            <div className="relative">
                                                <InputField
                                                    label="City"
                                                    value={form.city}
                                                    onChange={(value) =>
                                                        update("city", value)
                                                    }
                                                    placeholder="e.g. New Delhi"
                                                    required
                                                />
                                                <MapPin
                                                    size={16}
                                                    className="pointer-events-none absolute right-4 top-[42px] text-neutral-400"
                                                />
                                            </div>
                                        </div>

                                        <InputField
                                            label="Contact Phone"
                                            value={form.contact_phone}
                                            onChange={(value) =>
                                                update(
                                                    "contact_phone",
                                                    value
                                                )
                                            }
                                            placeholder="+91 98765 43210"
                                            type="tel"
                                            required
                                        />

                                        <MultiSelect
                                            label="Games You Organize"
                                            selected={form.games}
                                            onToggle={(value) =>
                                                toggleGame("games", value)
                                            }
                                            options={GAMES}
                                            required
                                        />

                                        <div className="border-t border-neutral-100 pt-7">
                                            <div className="mb-5">
                                                <p className="text-sm font-bold text-neutral-900">
                                                    Online Presence
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-neutral-500">
                                                    Optional links that help us
                                                    understand your organizer
                                                    presence.
                                                </p>
                                            </div>

                                            <div className="grid gap-5 sm:grid-cols-2">
                                                <InputField
                                                    label="Website"
                                                    value={form.website_url}
                                                    onChange={(value) =>
                                                        update(
                                                            "website_url",
                                                            value
                                                        )
                                                    }
                                                    placeholder="https://example.com"
                                                    type="url"
                                                />

                                                <InputField
                                                    label="Discord"
                                                    value={form.discord_url}
                                                    onChange={(value) =>
                                                        update(
                                                            "discord_url",
                                                            value
                                                        )
                                                    }
                                                    placeholder="https://discord.gg/..."
                                                    type="url"
                                                />

                                                <InputField
                                                    label="Social Profile"
                                                    value={form.social_url}
                                                    onChange={(value) =>
                                                        update(
                                                            "social_url",
                                                            value
                                                        )
                                                    }
                                                    placeholder="https://instagram.com/..."
                                                    type="url"
                                                />

                                                <InputField
                                                    label="Previous Event Link"
                                                    value={
                                                        form.previous_event_url
                                                    }
                                                    onChange={(value) =>
                                                        update(
                                                            "previous_event_url",
                                                            value
                                                        )
                                                    }
                                                    placeholder="https://..."
                                                    type="url"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-7">
                                        <div className="grid gap-5 sm:grid-cols-3">
                                            <InputField
                                                label="Years Organizing"
                                                value={
                                                    form.experience_years
                                                }
                                                onChange={(value) =>
                                                    update(
                                                        "experience_years",
                                                        value.replace(
                                                            /[^\d]/g,
                                                            ""
                                                        )
                                                    )
                                                }
                                                placeholder="0"
                                                type="number"
                                                required
                                            />

                                            <InputField
                                                label="Events Organized"
                                                value={
                                                    form.events_organized
                                                }
                                                onChange={(value) =>
                                                    update(
                                                        "events_organized",
                                                        value.replace(
                                                            /[^\d]/g,
                                                            ""
                                                        )
                                                    )
                                                }
                                                placeholder="0"
                                                type="number"
                                                required
                                            />

                                            <InputField
                                                label="Largest Event Size"
                                                value={
                                                    form.largest_event_size
                                                }
                                                onChange={(value) =>
                                                    update(
                                                        "largest_event_size",
                                                        value.replace(
                                                            /[^\d]/g,
                                                            ""
                                                        )
                                                    )
                                                }
                                                placeholder="e.g. 500"
                                                type="number"
                                                helper="Approximate number of participants."
                                            />
                                        </div>

                                        <TextareaField
                                            label="Organizing Experience"
                                            value={
                                                form.experience_description
                                            }
                                            onChange={(value) =>
                                                update(
                                                    "experience_description",
                                                    value
                                                )
                                            }
                                            placeholder="Tell us about the tournaments, leagues, communities, or esports events you have organized."
                                            required
                                            rows={7}
                                        />

                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                                <Trophy
                                                    size={18}
                                                    className="text-neutral-700"
                                                />
                                                <p className="mt-4 text-2xl font-black">
                                                    {form.events_organized ||
                                                        "0"}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-neutral-500">
                                                    Events organized
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                                <Users
                                                    size={18}
                                                    className="text-neutral-700"
                                                />
                                                <p className="mt-4 text-2xl font-black">
                                                    {form.largest_event_size ||
                                                        "—"}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-neutral-500">
                                                    Largest event
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                                <ShieldCheck
                                                    size={18}
                                                    className="text-neutral-700"
                                                />
                                                <p className="mt-4 text-2xl font-black">
                                                    {form.experience_years ||
                                                        "0"}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-neutral-500">
                                                    Years experience
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-7">
                                        <MultiSelect
                                            label="Games You Plan to Organize on SYNCO"
                                            selected={
                                                form.planned_games
                                            }
                                            onToggle={(value) =>
                                                toggleGame(
                                                    "planned_games",
                                                    value
                                                )
                                            }
                                            options={GAMES}
                                            required
                                            helper="Select the games you expect to run competitions for on SYNCO."
                                        />

                                        <div className="grid gap-5 sm:grid-cols-2">
                                            <SelectField
                                                label="Tournament Frequency"
                                                value={
                                                    form.tournament_frequency
                                                }
                                                onChange={(value) =>
                                                    update(
                                                        "tournament_frequency",
                                                        value
                                                    )
                                                }
                                                options={FREQUENCIES}
                                                placeholder="Select frequency"
                                                required
                                            />

                                            <InputField
                                                label="Expected Participants"
                                                value={
                                                    form.expected_participants
                                                }
                                                onChange={(value) =>
                                                    update(
                                                        "expected_participants",
                                                        value.replace(
                                                            /[^\d]/g,
                                                            ""
                                                        )
                                                    )
                                                }
                                                placeholder="e.g. 200"
                                                type="number"
                                                required
                                                helper="Typical expected participants for your SYNCO events."
                                            />
                                        </div>

                                        <TextareaField
                                            label="What Do You Plan to Build on SYNCO?"
                                            value={
                                                form.organizer_description
                                            }
                                            onChange={(value) =>
                                                update(
                                                    "organizer_description",
                                                    value
                                                )
                                            }
                                            placeholder="Describe the tournaments, leagues, community events, or competitive formats you want to run on SYNCO."
                                            required
                                            rows={7}
                                        />

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                                                    <Trophy size={18} />
                                                </div>
                                                <p className="mt-4 text-sm font-black">
                                                    Build competitions
                                                </p>
                                                <p className="mt-2 text-xs leading-5 text-neutral-500">
                                                    Create structured
                                                    tournaments and competitive
                                                    events for your selected
                                                    games.
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                                                    <Users size={18} />
                                                </div>
                                                <p className="mt-4 text-sm font-black">
                                                    Grow your community
                                                </p>
                                                <p className="mt-2 text-xs leading-5 text-neutral-500">
                                                    Bring your existing players
                                                    and gaming community into
                                                    SYNCO.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-6">
                                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white">
                                                    <ShieldCheck size={18} />
                                                </div>

                                                <div>
                                                    <p className="text-sm font-black">
                                                        Final review
                                                    </p>
                                                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                                                        Make sure the
                                                        information below is
                                                        accurate before
                                                        submitting.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <section className="rounded-2xl border border-neutral-200 bg-white px-5">
                                            <div className="flex items-center gap-3 py-5">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">
                                                    <Users size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black">
                                                        Organizer
                                                    </p>
                                                    <p className="text-xs text-neutral-500">
                                                        Basic organization
                                                        information
                                                    </p>
                                                </div>
                                            </div>

                                            <SummaryRow
                                                label="Organization"
                                                value={
                                                    form.organization_name
                                                }
                                            />
                                            <SummaryRow
                                                label="Type"
                                                value={
                                                    form.organizer_type
                                                }
                                            />
                                            <SummaryRow
                                                label="Location"
                                                value={`${form.city}, ${form.country}`}
                                            />
                                            <SummaryRow
                                                label="Contact"
                                                value={
                                                    form.contact_phone
                                                }
                                            />
                                            <SummaryRow
                                                label="Games"
                                                value={getGameLabels(
                                                    form.games
                                                )}
                                            />
                                        </section>

                                        <section className="rounded-2xl border border-neutral-200 bg-white px-5">
                                            <div className="flex items-center gap-3 py-5">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">
                                                    <Trophy size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black">
                                                        Experience
                                                    </p>
                                                    <p className="text-xs text-neutral-500">
                                                        Previous organizing
                                                        history
                                                    </p>
                                                </div>
                                            </div>

                                            <SummaryRow
                                                label="Years organizing"
                                                value={
                                                    form.experience_years
                                                }
                                            />
                                            <SummaryRow
                                                label="Events organized"
                                                value={
                                                    form.events_organized
                                                }
                                            />
                                            <SummaryRow
                                                label="Largest event"
                                                value={
                                                    form.largest_event_size
                                                        ? `${form.largest_event_size} participants`
                                                        : "Not provided"
                                                }
                                            />
                                            <SummaryRow
                                                label="Previous event"
                                                value={
                                                    form.previous_event_url
                                                }
                                            />
                                        </section>

                                        <section className="rounded-2xl border border-neutral-200 bg-white px-5">
                                            <div className="flex items-center gap-3 py-5">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">
                                                    <Globe2 size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black">
                                                        SYNCO Plans
                                                    </p>
                                                    <p className="text-xs text-neutral-500">
                                                        Your intended activity
                                                        on SYNCO
                                                    </p>
                                                </div>
                                            </div>

                                            <SummaryRow
                                                label="Planned games"
                                                value={getGameLabels(
                                                    form.planned_games
                                                )}
                                            />
                                            <SummaryRow
                                                label="Frequency"
                                                value={
                                                    form.tournament_frequency
                                                }
                                            />
                                            <SummaryRow
                                                label="Expected participants"
                                                value={
                                                    form.expected_participants
                                                }
                                            />
                                        </section>

                                        <section className="rounded-2xl border border-neutral-200 bg-white px-5">
                                            <div className="flex items-center gap-3 py-5">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">
                                                    <Link2 size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black">
                                                        Online Presence
                                                    </p>
                                                    <p className="text-xs text-neutral-500">
                                                        Optional links
                                                    </p>
                                                </div>
                                            </div>

                                            <SummaryRow
                                                label="Website"
                                                value={form.website_url}
                                            />
                                            <SummaryRow
                                                label="Discord"
                                                value={form.discord_url}
                                            />
                                            <SummaryRow
                                                label="Social"
                                                value={form.social_url}
                                            />
                                        </section>

                                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                                                Application note
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-neutral-700">
                                                Submitting this form does not
                                                immediately grant organizer
                                                access. Your application will
                                                enter the SYNCO review process.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-neutral-100 px-6 py-5 sm:px-8">
                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        disabled={step === 1 || loading}
                                        className={`inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition ${step === 1 || loading
                                                ? "cursor-not-allowed text-neutral-300"
                                                : "text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                    >
                                        <ArrowLeft
                                            size={17}
                                            className="mr-2"
                                        />
                                        Back
                                    </button>

                                    {step < STEPS.length ? (
                                        <button
                                            type="button"
                                            onClick={handleNext}
                                            className="inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800"
                                        >
                                            Continue
                                            <ArrowRight
                                                size={17}
                                                className="ml-2"
                                            />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={submitApplication}
                                            disabled={loading}
                                            className="inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2
                                                        size={17}
                                                        className="mr-2 animate-spin"
                                                    />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    Submit Application
                                                    <ChevronRight
                                                        size={17}
                                                        className="ml-2"
                                                    />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
