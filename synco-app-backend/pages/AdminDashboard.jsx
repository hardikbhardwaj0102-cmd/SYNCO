import { useCallback, useEffect, useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileText,
    RefreshCw,
    ShieldCheck,
    UserRound,
    UserX,
    Users,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const API_URL = (
    import.meta.env.VITE_API_URL ||
    'https://synco-backend-vi7b.onrender.com'
).replace(/\/$/, '');


const apiRequest = async (path, options = {}) => {
    const response = await fetch(
        `${API_URL}${path}`,
        {
            credentials: 'include',
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body
                    ? { 'Content-Type': 'application/json' }
                    : {}),
                ...(options.headers || {}),
            },
        }
    );

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


const StatCard = ({
    icon: Icon,
    label,
    value,
    helper,
}) => (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                <Icon size={19} />
            </div>

            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                SYNCO
            </span>
        </div>

        <p className="mt-6 text-3xl font-black tracking-tight text-black">
            {value}
        </p>

        <p className="mt-1 text-sm font-semibold text-neutral-700">
            {label}
        </p>

        {helper && (
            <p className="mt-1 text-xs text-neutral-400">
                {helper}
            </p>
        )}
    </div>
);


const AccessCard = ({
    icon: Icon,
    eyebrow,
    title,
    description,
    onClick,
}) => (
    <button
        type="button"
        onClick={onClick}
        className="group w-full rounded-2xl border border-neutral-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_10px_35px_rgba(0,0,0,0.06)]"
    >
        <div className="flex items-start justify-between gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-[#D6C98A]">
                <Icon size={21} />
            </div>

            <ArrowRight
                size={18}
                className="text-neutral-300 transition-transform group-hover:translate-x-1 group-hover:text-black"
            />
        </div>

        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            {eyebrow}
        </p>

        <h2 className="mt-2 text-xl font-black tracking-tight text-black">
            {title}
        </h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {description}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black">
            Open section
            <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
            />
        </div>
    </button>
);


const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const accountRole =
        user?.accountRole ??
        user?.account_role;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [users, setUsers] = useState([]);
    const [applications, setApplications] = useState([]);

    const loadOverview = useCallback(
        async (refresh = false) => {
            if (accountRole !== 'admin') {
                return;
            }

            try {
                if (refresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                setError('');

                const [usersResponse, applicationsResponse] =
                    await Promise.all([
                        apiRequest('/api/admin/users'),
                        apiRequest('/api/organizers/admin/applications'),
                    ]);

                setUsers(usersResponse.users || []);
                setApplications(
                    applicationsResponse.applications || []
                );
            } catch (err) {
                setError(
                    err.message ||
                    'Unable to load admin overview.'
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [accountRole]
    );

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    if (accountRole !== 'admin') {
        return (
            <div className="min-h-screen bg-white">
                <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-6 py-12">
                    <div className="w-full rounded-2xl border border-neutral-200 bg-white p-10 text-center">
                        <ShieldCheck
                            size={28}
                            className="mx-auto text-neutral-300"
                        />

                        <h1 className="mt-4 text-xl font-black text-black">
                            Admin access required
                        </h1>

                        <p className="mt-2 text-sm text-neutral-500">
                            This dashboard is available only to SYNCO administrators.
                        </p>

                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="mt-6 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                        >
                            Return to SYNCO
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const totalUsers = users.length;
    const activeUsers = users.filter(
        (item) => item.account_status !== 'suspended'
    ).length;
    const suspendedUsers = users.filter(
        (item) => item.account_status === 'suspended'
    ).length;

    const pendingApplications = applications.filter(
        (item) => item.status === 'pending'
    ).length;
    const reviewApplications = applications.filter(
        (item) => item.status === 'under_review'
    ).length;
    const approvedApplications = applications.filter(
        (item) => item.status === 'approved'
    ).length;
    const suspendedApplications = applications.filter(
        (item) => item.status === 'suspended'
    ).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-white">
                <main className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-5 py-12 sm:px-8">
                    <div className="flex items-center gap-3 text-neutral-500">
                        <RefreshCw
                            size={19}
                            className="animate-spin"
                        />
                        <span className="text-sm font-medium">
                            Loading admin dashboard...
                        </span>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-neutral-900">
            <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
                <div className="flex flex-col gap-5 border-b border-neutral-200 pb-7 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-[#D6C98A]">
                                <ShieldCheck size={20} />
                            </div>

                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">
                                SYNCO ADMIN
                            </span>
                        </div>

                        <h1 className="mt-4 text-3xl font-black tracking-tight text-black sm:text-4xl">
                            Admin Dashboard
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                            Manage platform users and organizer applications from one place.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadOverview(true)}
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 transition hover:border-neutral-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
                    >
                        <RefreshCw
                            size={15}
                            className={refreshing ? 'animate-spin' : ''}
                        />
                        Refresh
                    </button>
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
                        <p className="text-sm font-medium text-red-700">
                            {error}
                        </p>
                    </div>
                )}

                <section className="mt-7">
                    <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                            Platform overview
                        </p>
                        <h2 className="mt-1 text-lg font-black text-black">
                            Current platform status
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                            icon={Users}
                            label="Total Users"
                            value={totalUsers}
                            helper="Accounts returned by admin management"
                        />

                        <StatCard
                            icon={CheckCircle2}
                            label="Active Users"
                            value={activeUsers}
                            helper="Accounts currently active"
                        />

                        <StatCard
                            icon={UserX}
                            label="Suspended Users"
                            value={suspendedUsers}
                            helper="Accounts currently suspended"
                        />

                        <StatCard
                            icon={FileText}
                            label="Pending Organizer Applications"
                            value={pendingApplications}
                            helper="Applications waiting for review"
                        />
                    </div>
                </section>

                <section className="mt-7">
                    <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                            Organizer pipeline
                        </p>
                        <h2 className="mt-1 text-lg font-black text-black">
                            Application status
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-5">
                            <p className="text-2xl font-black text-black">
                                {pendingApplications}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-neutral-500">
                                Pending
                            </p>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-5">
                            <p className="text-2xl font-black text-black">
                                {reviewApplications}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-neutral-500">
                                Under Review
                            </p>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-5">
                            <p className="text-2xl font-black text-black">
                                {approvedApplications}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-neutral-500">
                                Approved
                            </p>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-5">
                            <p className="text-2xl font-black text-black">
                                {suspendedApplications}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-neutral-500">
                                Suspended
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mt-9">
                    <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                            Quick access
                        </p>
                        <h2 className="mt-1 text-lg font-black text-black">
                            Administration
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <AccessCard
                            icon={FileText}
                            eyebrow="ORGANIZER MANAGEMENT"
                            title="Organizer Applications"
                            description="Review pending applications, inspect applicant details, approve or reject applications, and manage organizer access."
                            onClick={() => navigate('/admin/organizers')}
                        />

                        <AccessCard
                            icon={UserRound}
                            eyebrow="ACCOUNT MANAGEMENT"
                            title="User Management"
                            description="Search SYNCO accounts, inspect account history, suspend or restore users, remove organizer access, and manage account records."
                            onClick={() => navigate('/admin/users')}
                        />
                    </div>
                </section>

                <section className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/organizers')}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-left transition hover:border-neutral-300 hover:bg-white"
                    >
                        <div className="flex items-center gap-3">
                            <Clock3 size={17} className="text-neutral-500" />
                            <span className="text-sm font-bold text-black">
                                Review queue
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-neutral-500">
                            {pendingApplications} application{pendingApplications === 1 ? '' : 's'} waiting for review
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/admin/users?status=suspended')}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-left transition hover:border-neutral-300 hover:bg-white"
                    >
                        <div className="flex items-center gap-3">
                            <UserX size={17} className="text-neutral-500" />
                            <span className="text-sm font-bold text-black">
                                Suspended accounts
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-neutral-500">
                            {suspendedUsers} currently suspended
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-left transition hover:border-neutral-300 hover:bg-white"
                    >
                        <div className="flex items-center gap-3">
                            <ArrowRight size={17} className="text-neutral-500" />
                            <span className="text-sm font-bold text-black">
                                Open SYNCO
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-neutral-500">
                            Return to the main platform
                        </p>
                    </button>
                </section>
            </main>
        </div>
    );
};


export default AdminDashboard;
