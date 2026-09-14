import React, { useEffect, useMemo, useState } from "react";
import {
    Trophy,
    Gift,
    Zap,
    Target,
    Flame,
    ChevronRight,
    Check,
    Lock,
    ShoppingBag,
    Award,
    Clock3,
    TrendingUp,
    RefreshCw,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

const Reward = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [claimingId, setClaimingId] = useState(null);
    const [redeemingId, setRedeemingId] = useState(null);
    const [message, setMessage] = useState("");

    // =========================================================
    // ICON MAPPING
    // =========================================================

    const getChallengeIcon = (challenge) => {
        const text = `${challenge?.title || ""} ${challenge?.description || ""}`.toLowerCase();

        if (
            text.includes("win") ||
            text.includes("victory") ||
            text.includes("match")
        ) {
            return Trophy;
        }

        if (
            text.includes("party") ||
            text.includes("team") ||
            text.includes("squad")
        ) {
            return Zap;
        }

        return Target;
    };

    const getRewardIcon = (item) => {
        const type = `${item?.type || ""} ${item?.category || ""} ${item?.title || ""}`.toLowerCase();

        if (type.includes("badge") || type.includes("achievement")) {
            return Trophy;
        }

        if (type.includes("boost") || type.includes("xp")) {
            return Zap;
        }

        if (type.includes("title")) {
            return Target;
        }

        return Award;
    };

    // =========================================================
    // HELPERS
    // =========================================================

    const firstDefined = (...values) => {
        return values.find(
            (value) => value !== undefined && value !== null
        );
    };

    const numberValue = (value, fallback = 0) => {
        const number = Number(value);

        return Number.isFinite(number) ? number : fallback;
    };

    const formatNumber = (value) => {
        return numberValue(value).toLocaleString();
    };

    const formatReward = (challenge) => {
        const xp = numberValue(
            firstDefined(
                challenge?.rewardXp,
                challenge?.reward_xp,
                challenge?.xpReward,
                challenge?.xp_reward
            )
        );

        const credits = numberValue(
            firstDefined(
                challenge?.rewardCredits,
                challenge?.reward_credits,
                challenge?.creditReward,
                challenge?.credit_reward
            )
        );

        const rewardAmount = firstDefined(
            challenge?.reward,
            challenge?.rewardAmount,
            challenge?.reward_amount
        );

        if (xp > 0 && credits > 0) {
            return `+${formatNumber(xp)} XP • +${formatNumber(credits)} Credits`;
        }

        if (xp > 0) {
            return `+${formatNumber(xp)} XP`;
        }

        if (credits > 0) {
            return `+${formatNumber(credits)} Credits`;
        }

        if (rewardAmount !== undefined && rewardAmount !== null) {
            return String(rewardAmount);
        }

        return "Reward";
    };

    const getProgress = (challenge) => {
        const progress = numberValue(
            firstDefined(
                challenge?.progress,
                challenge?.currentProgress,
                challenge?.current_progress,
                challenge?.completedCount,
                challenge?.completed_count
            )
        );

        const total = Math.max(
            1,
            numberValue(
                firstDefined(
                    challenge?.total,
                    challenge?.target,
                    challenge?.targetValue,
                    challenge?.target_value
                ),
                1
            )
        );

        return {
            progress: Math.min(progress, total),
            total,
            percentage: Math.min(100, (progress / total) * 100),
        };
    };

    const isCompleted = (challenge) => {
        const progressData = getProgress(challenge);

        return Boolean(
            challenge?.completed ||
            challenge?.isCompleted ||
            challenge?.is_completed ||
            challenge?.claimed ||
            challenge?.is_claimed ||
            progressData.progress >= progressData.total
        );
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "Recently";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return String(dateValue);
        }

        return date.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getItemId = (item) => {
        return firstDefined(
            item?.id,
            item?.itemId,
            item?.item_id
        );
    };

    const getChallengeId = (challenge) => {
        return firstDefined(
            challenge?.id,
            challenge?.challengeId,
            challenge?.challenge_id
        );
    };

    // =========================================================
    // NORMALIZE BACKEND RESPONSE
    // =========================================================

    const normalizeData = (response) => {
        const payload = response?.data || response || {};

        const user =
            payload.user ||
            payload.profile ||
            payload.stats?.user ||
            {};

        const dailyChallenges =
            payload.dailyChallenges ||
            payload.daily_challenges ||
            payload.challenges?.daily ||
            [];

        const weeklyChallenges =
            payload.weeklyChallenges ||
            payload.weekly_challenges ||
            payload.challenges?.weekly ||
            [];

        const storeRewards =
            payload.storeRewards ||
            payload.store_rewards ||
            payload.store ||
            payload.items ||
            [];

        const achievements =
            payload.achievements ||
            [];

        const recentRewards =
            payload.recentRewards ||
            payload.recent_rewards ||
            payload.history ||
            [];

        const inventory =
            payload.inventory ||
            [];

        const stats =
            payload.stats ||
            {};

        return {
            user,
            stats,
            dailyChallenges: Array.isArray(dailyChallenges)
                ? dailyChallenges
                : [],
            weeklyChallenges: Array.isArray(weeklyChallenges)
                ? weeklyChallenges
                : [],
            storeRewards: Array.isArray(storeRewards)
                ? storeRewards
                : [],
            achievements: Array.isArray(achievements)
                ? achievements
                : [],
            recentRewards: Array.isArray(recentRewards)
                ? recentRewards
                : [],
            inventory: Array.isArray(inventory)
                ? inventory
                : [],
        };
    };

    // =========================================================
    // LOAD REWARDS
    // =========================================================

    const loadRewards = async (showRefreshing = false) => {
        try {
            if (showRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const response = await fetch(
                `${API_URL}/api/rewards`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error ||
                    "Unable to load rewards."
                );
            }

            setData(normalizeData(result));
        } catch (err) {
            console.error("Rewards loading error:", err);

            setError(
                err?.message ||
                "Unable to connect to the rewards service."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadRewards();
    }, []);

    // =========================================================
    // CLAIM CHALLENGE
    // =========================================================

    const handleClaimChallenge = async (challenge) => {
        const challengeId = getChallengeId(challenge);

        if (!challengeId) {
            return;
        }

        try {
            setClaimingId(challengeId);
            setMessage("");

            const response = await fetch(
                `${API_URL}/api/rewards/challenges/${challengeId}/claim`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error ||
                    "Unable to claim this challenge."
                );
            }

            setMessage(
                result?.message ||
                "Challenge reward claimed successfully."
            );

            await loadRewards(true);
        } catch (err) {
            console.error("Challenge claim error:", err);

            setMessage(
                err?.message ||
                "Unable to claim the challenge reward."
            );
        } finally {
            setClaimingId(null);
        }
    };

    // =========================================================
    // REDEEM STORE ITEM
    // =========================================================

    const handleRedeem = async (item) => {
        const itemId = getItemId(item);

        if (!itemId) {
            return;
        }

        try {
            setRedeemingId(itemId);
            setMessage("");

            const response = await fetch(
                `${API_URL}/api/rewards/store/${itemId}/redeem`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error ||
                    "Unable to redeem this reward."
                );
            }

            setMessage(
                result?.message ||
                "Reward redeemed successfully."
            );

            await loadRewards(true);
        } catch (err) {
            console.error("Reward redemption error:", err);

            setMessage(
                err?.message ||
                "Unable to redeem this reward."
            );
        } finally {
            setRedeemingId(null);
        }
    };

    // =========================================================
    // USER DATA
    // =========================================================

    const user = data?.user || {};
    const stats = data?.stats || {};

    const xp = numberValue(
        firstDefined(
            user?.xp,
            stats?.xp
        )
    );

    const level = Math.max(
        1,
        numberValue(
            firstDefined(
                user?.level,
                stats?.level
            ),
            1
        )
    );

    const credits = numberValue(
        firstDefined(
            user?.credits,
            stats?.credits
        )
    );

    const streak = numberValue(
        firstDefined(
            user?.currentStreak,
            user?.current_streak,
            stats?.currentStreak,
            stats?.current_streak
        )
    );

    const longestStreak = numberValue(
        firstDefined(
            user?.longestStreak,
            user?.longest_streak,
            stats?.longestStreak,
            stats?.longest_streak
        )
    );

    const totalEarned = numberValue(
        firstDefined(
            stats?.totalXpEarned,
            stats?.total_xp_earned,
            user?.totalXpEarned,
            user?.total_xp_earned,
            xp
        )
    );

    // =========================================================
    // LEVEL PROGRESS
    // =========================================================

    const nextLevelXp = Math.max(
        1,
        (level + 1) * 100
    );

    const xpProgress = Math.min(
        100,
        (xp / nextLevelXp) * 100
    );

    const xpRemaining = Math.max(
        0,
        nextLevelXp - xp
    );

    // =========================================================
    // CHALLENGES
    // =========================================================

    const dailyChallenges = data?.dailyChallenges || [];
    const weeklyChallenges = data?.weeklyChallenges || [];

    // =========================================================
    // ACHIEVEMENTS
    // =========================================================

    const achievements = data?.achievements || [];

    const unlockedAchievements = achievements.filter(
        (achievement) =>
            Boolean(
                achievement?.unlocked ||
                achievement?.isUnlocked ||
                achievement?.is_unlocked
            )
    );

    // =========================================================
    // STORE
    // =========================================================

    const storeRewards = data?.storeRewards || [];

    // =========================================================
    // HISTORY
    // =========================================================

    const recentRewards = data?.recentRewards || [];

    // =========================================================
    // STREAK PROGRESS
    // =========================================================

    const streakMilestone = useMemo(() => {
        if (streak < 3) return 3;
        if (streak < 7) return 7;
        if (streak < 14) return 14;
        if (streak < 30) return 30;
        if (streak < 60) return 60;
        if (streak < 100) return 100;

        return Math.ceil((streak + 1) / 25) * 25;
    }, [streak]);

    const streakPercentage = Math.min(
        100,
        (streak / streakMilestone) * 100
    );

    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f7f7f5] text-[#111111]">
                <div className="flex min-h-screen items-center justify-center">
                    <div className="flex items-center gap-3 rounded-xl border border-[#dfdcd4] bg-white px-6 py-4 shadow-sm">
                        <RefreshCw
                            size={17}
                            className="animate-spin text-[#9b8148]"
                        />

                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#73767d]">
                            Loading rewards
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================
    // PAGE
    // =========================================================

    return (
        <div className="min-h-screen bg-[#f7f7f5] text-[#111111]">

            {/* =====================================================
                BACKGROUND DESIGN
            ====================================================== */}

            <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">

                <div className="absolute -right-40 top-20 h-[500px] w-[500px] rotate-45 border border-[#e6e2d7]" />

                <div className="absolute -right-20 top-52 h-[420px] w-[420px] rotate-45 border border-[#ece9e1]" />

                <div className="absolute bottom-[-250px] left-[20%] h-[600px] w-[600px] rotate-45 border border-[#ebe8e0]" />

                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        backgroundImage:
                            "linear-gradient(135deg, transparent 49.5%, #e8e6df 50%, transparent 50.5%)",
                        backgroundSize: "85px 85px",
                    }}
                />

            </div>

            {/* =====================================================
                PAGE
            ====================================================== */}

            <main className="relative z-10 mx-auto w-full max-w-[1250px] px-5 py-8 lg:px-8">

                {/* =================================================
                    HEADER
                ================================================== */}

                <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">

                    <div>

                        <div className="mb-2 flex items-center gap-2">

                            <div className="h-[2px] w-8 bg-[#b69a5a]" />

                            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#9b8148]">
                                SYNCO REWARDS
                            </span>

                        </div>

                        <h1 className="text-4xl font-black uppercase tracking-[-0.03em] text-[#111111] md:text-5xl">
                            Earn. Unlock. Compete.
                        </h1>

                        <p className="mt-2 max-w-xl text-sm font-medium text-[#737989]">
                            Complete challenges, build your level, and unlock exclusive
                            rewards through your competitive journey.
                        </p>

                    </div>

                    {/* Credits */}

                    <div className="flex items-center gap-3">

                        <div className="flex items-center gap-3 rounded-xl border border-[#dedbd2] bg-white px-5 py-3 shadow-sm">

                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#151515]">
                                <Gift
                                    size={17}
                                    className="text-[#d5bd7d]"
                                />
                            </div>

                            <div>

                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8c8d91]">
                                    SYNCO Credits
                                </p>

                                <p className="text-lg font-black tracking-tight">
                                    {formatNumber(credits)}
                                </p>

                            </div>

                        </div>

                        <button
                            onClick={() => {
                                document
                                    .getElementById("synco-store")
                                    ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                    });
                            }}
                            className="flex h-[58px] items-center gap-2 rounded-xl bg-[#111111] px-5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#252525]"
                        >
                            <ShoppingBag size={16} />
                            Store
                        </button>

                    </div>

                </div>

                {/* =================================================
                    STATUS / ERROR
                ================================================== */}

                {error && (
                    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#e1cccc] bg-[#fff8f8] px-4 py-3">

                        <p className="text-xs font-bold text-[#8a5f5f]">
                            {error}
                        </p>

                        <button
                            onClick={() => loadRewards(true)}
                            className="flex items-center gap-2 rounded-lg bg-[#111111] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white"
                        >
                            <RefreshCw size={12} />
                            Retry
                        </button>

                    </div>
                )}

                {message && (
                    <div className="mb-6 flex items-center justify-between rounded-xl border border-[#ded7c5] bg-[#fbfaf6] px-4 py-3">

                        <p className="text-xs font-bold text-[#75613a]">
                            {message}
                        </p>

                        <button
                            onClick={() => setMessage("")}
                            className="text-[9px] font-black uppercase tracking-wider text-[#8c8e94]"
                        >
                            Dismiss
                        </button>

                    </div>
                )}

                {/* =================================================
                    LEVEL / STREAK / STATS
                ================================================== */}

                <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr_1fr]">

                    {/* LEVEL */}

                    <div className="relative overflow-hidden rounded-2xl bg-[#111111] p-6 text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]">

                        <div className="absolute -right-16 -top-16 h-44 w-44 rotate-45 border border-[#343434]" />

                        <div className="absolute -right-8 -top-8 h-32 w-32 rotate-45 border border-[#292929]" />

                        <div className="relative">

                            <div className="mb-5 flex items-start justify-between">

                                <div>

                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#b9a06a]">
                                        PLAYER PROGRESSION
                                    </p>

                                    <div className="mt-2 flex items-end gap-3">

                                        <h2 className="text-4xl font-black">
                                            LEVEL {level}
                                        </h2>

                                        <span className="mb-1 rounded-md border border-[#51472e] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#d1bb7e]">
                                            {firstDefined(
                                                user?.levelTitle,
                                                user?.level_title,
                                                stats?.levelTitle,
                                                stats?.level_title,
                                                "Competitor"
                                            )}
                                        </span>

                                    </div>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#51472e] bg-[#191919]">
                                    <Zap
                                        size={19}
                                        className="text-[#d1bb7e]"
                                    />
                                </div>

                            </div>

                            <div className="mb-2 flex items-center justify-between text-[11px] font-bold">

                                <span className="text-[#999999]">
                                    {formatNumber(xp)} XP
                                </span>

                                <span className="text-[#d1bb7e]">
                                    {formatNumber(nextLevelXp)} XP
                                </span>

                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-[#292929]">

                                <div
                                    className="h-full rounded-full bg-[#c8ae6d] transition-all duration-500"
                                    style={{
                                        width: `${xpProgress}%`,
                                    }}
                                />

                            </div>

                            <div className="mt-4 flex items-center justify-between">

                                <p className="text-[10px] font-semibold text-[#858585]">
                                    {formatNumber(xpRemaining)} XP required for Level{" "}
                                    {level + 1}
                                </p>

                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#bda66e]">
                                    {Math.round(xpProgress)}% Complete
                                </p>

                            </div>

                        </div>

                    </div>

                    {/* STREAK */}

                    <div className="rounded-2xl border border-[#dfdcd4] bg-white p-6 shadow-sm">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#888b92]">
                                    CURRENT STREAK
                                </p>

                                <div className="mt-3 flex items-center gap-3">

                                    <h2 className="text-4xl font-black">
                                        {formatNumber(streak)}
                                    </h2>

                                    <span className="text-sm font-bold uppercase tracking-wide text-[#777a82]">
                                        Days
                                    </span>

                                </div>

                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f2ede1]">
                                <Flame
                                    size={20}
                                    className="text-[#a78a4b]"
                                />
                            </div>

                        </div>

                        <div className="mt-5 flex items-center justify-between">

                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8d94]">
                                Next milestone
                            </span>

                            <span className="text-xs font-black">
                                {formatNumber(streakMilestone)} Days
                            </span>

                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e9e7e1]">

                            <div
                                className="h-full rounded-full bg-[#b69a5a] transition-all"
                                style={{
                                    width: `${streakPercentage}%`,
                                }}
                            />

                        </div>

                        {longestStreak > 0 && (
                            <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#999ba0]">
                                Longest streak: {formatNumber(longestStreak)} days
                            </p>
                        )}

                    </div>

                    {/* TOTAL XP */}

                    <div className="rounded-2xl border border-[#dfdcd4] bg-white p-6 shadow-sm">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#888b92]">
                                    XP EARNED
                                </p>

                                <h2 className="mt-3 text-4xl font-black">
                                    {formatNumber(totalEarned)}
                                </h2>

                                <p className="mt-1 text-[10px] font-semibold text-[#85878d]">
                                    Total progression earned
                                </p>

                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f2ede1]">
                                <TrendingUp
                                    size={19}
                                    className="text-[#a78a4b]"
                                />
                            </div>

                        </div>

                    </div>

                </section>

                {/* =================================================
                    DAILY + WEEKLY
                ================================================== */}

                <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">

                    {/* DAILY */}

                    <div className="rounded-2xl border border-[#dfdcd4] bg-white p-6 shadow-sm">

                        <div className="mb-6 flex items-center justify-between">

                            <div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b8148]">
                                    DAILY MISSIONS
                                </p>

                                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
                                    Today's Challenges
                                </h2>

                            </div>

                            <div className="flex items-center gap-2 rounded-lg bg-[#f5f3ee] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#777a82]">
                                <Clock3 size={13} />
                                Daily
                            </div>

                        </div>

                        <div className="space-y-3">

                            {dailyChallenges.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#dedbd3] px-5 py-8 text-center">

                                    <Target
                                        size={22}
                                        className="mx-auto text-[#aaa39a]"
                                    />

                                    <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#777a82]">
                                        No daily challenges
                                    </p>

                                    <p className="mt-1 text-[10px] font-medium text-[#999ba0]">
                                        Check back when new missions are available.
                                    </p>

                                </div>
                            ) : (
                                dailyChallenges.map((challenge) => {

                                    const Icon = getChallengeIcon(challenge);
                                    const progress = getProgress(challenge);
                                    const completed = isCompleted(challenge);
                                    const challengeId = getChallengeId(challenge);

                                    const claimed = Boolean(
                                        challenge?.claimed ||
                                        challenge?.isClaimed ||
                                        challenge?.is_claimed
                                    );

                                    const canClaim =
                                        completed &&
                                        !claimed &&
                                        challengeId;

                                    return (
                                        <div
                                            key={challengeId || challenge?.title}
                                            className="group rounded-xl border border-[#e6e3dc] p-4 transition hover:border-[#c9b47d] hover:bg-[#fcfbf8]"
                                        >

                                            <div className="flex items-center gap-4">

                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2efe7]">
                                                    <Icon
                                                        size={18}
                                                        className="text-[#8f7640]"
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">

                                                    <div className="flex items-center justify-between gap-3">

                                                        <div>

                                                            <p className="text-sm font-black">
                                                                {firstDefined(
                                                                    challenge?.title,
                                                                    challenge?.name,
                                                                    "Challenge"
                                                                )}
                                                            </p>

                                                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#8b8e95]">
                                                                Reward {formatReward(challenge)}
                                                            </p>

                                                        </div>

                                                        {completed ? (
                                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111111]">
                                                                <Check
                                                                    size={14}
                                                                    className="text-white"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-black text-[#777a82]">
                                                                {formatNumber(progress.progress)}/
                                                                {formatNumber(progress.total)}
                                                            </span>
                                                        )}

                                                    </div>

                                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe9e3]">

                                                        <div
                                                            className="h-full rounded-full bg-[#b69a5a] transition-all duration-500"
                                                            style={{
                                                                width: `${progress.percentage}%`,
                                                            }}
                                                        />

                                                    </div>

                                                    {canClaim && (
                                                        <button
                                                            onClick={() =>
                                                                handleClaimChallenge(
                                                                    challenge
                                                                )
                                                            }
                                                            disabled={
                                                                claimingId ===
                                                                challengeId
                                                            }
                                                            className="mt-3 flex items-center gap-2 rounded-lg bg-[#111111] px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {claimingId ===
                                                                challengeId ? (
                                                                <>
                                                                    <RefreshCw
                                                                        size={11}
                                                                        className="animate-spin"
                                                                    />
                                                                    Claiming
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Claim Reward
                                                                    <ChevronRight
                                                                        size={12}
                                                                    />
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {claimed && (
                                                        <p className="mt-3 text-[9px] font-black uppercase tracking-wider text-[#8c7440]">
                                                            Reward claimed
                                                        </p>
                                                    )}

                                                </div>

                                            </div>

                                        </div>
                                    );
                                })
                            )}

                        </div>

                    </div>

                    {/* WEEKLY */}

                    <div className="rounded-2xl border border-[#dfdcd4] bg-[#111111] p-6 text-white shadow-sm">

                        <div className="mb-6 flex items-start justify-between">

                            <div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#b69a5a]">
                                    WEEKLY PROGRESSION
                                </p>

                                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
                                    Weekly Goals
                                </h2>

                            </div>

                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#403925] bg-[#191919]">
                                <Target
                                    size={17}
                                    className="text-[#d1b979]"
                                />
                            </div>

                        </div>

                        <div className="space-y-6">

                            {weeklyChallenges.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#3b3b3b] px-5 py-8 text-center">

                                    <Target
                                        size={21}
                                        className="mx-auto text-[#777777]"
                                    />

                                    <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#999999]">
                                        No weekly goals
                                    </p>

                                </div>
                            ) : (
                                weeklyChallenges.map((challenge) => {

                                    const progress = getProgress(challenge);
                                    const challengeId = getChallengeId(challenge);
                                    const completed = isCompleted(challenge);

                                    return (
                                        <div
                                            key={
                                                challengeId ||
                                                challenge?.title
                                            }
                                        >

                                            <div className="flex justify-between gap-4">

                                                <p className="max-w-[220px] text-sm font-bold leading-5">
                                                    {firstDefined(
                                                        challenge?.title,
                                                        challenge?.name,
                                                        "Weekly Goal"
                                                    )}
                                                </p>

                                                <span className="shrink-0 text-[10px] font-black text-[#d1b979]">
                                                    {formatReward(challenge)}
                                                </span>

                                            </div>

                                            <div className="mt-3 flex items-center gap-3">

                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2c2c2c]">

                                                    <div
                                                        className="h-full rounded-full bg-[#b69a5a] transition-all duration-500"
                                                        style={{
                                                            width: `${progress.percentage}%`,
                                                        }}
                                                    />

                                                </div>

                                                <span className="text-[10px] font-bold text-[#858585]">
                                                    {formatNumber(progress.progress)}/
                                                    {formatNumber(progress.total)}
                                                </span>

                                            </div>

                                            {completed && (
                                                <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#b69a5a]">
                                                    Completed
                                                </p>
                                            )}

                                        </div>
                                    );
                                })
                            )}

                        </div>

                    </div>

                </section>

                {/* =================================================
                    STORE
                ================================================== */}

                <section
                    id="synco-store"
                    className="mb-6 rounded-2xl border border-[#dfdcd4] bg-white p-6 shadow-sm"
                >

                    <div className="mb-6 flex items-end justify-between">

                        <div>

                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b8148]">
                                SYNCO STORE
                            </p>

                            <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
                                Redeem Rewards
                            </h2>

                        </div>

                        <div className="flex items-center gap-2 rounded-lg bg-[#f5f3ee] px-3 py-2">

                            <Gift
                                size={13}
                                className="text-[#927941]"
                            />

                            <span className="text-[10px] font-black text-[#777a82]">
                                {formatNumber(credits)} C
                            </span>

                        </div>

                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                        {storeRewards.length === 0 ? (
                            <div className="col-span-full rounded-xl border border-dashed border-[#dedbd3] px-5 py-10 text-center">

                                <ShoppingBag
                                    size={24}
                                    className="mx-auto text-[#aaa39a]"
                                />

                                <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#777a82]">
                                    Store is empty
                                </p>

                                <p className="mt-1 text-[10px] font-medium text-[#999ba0]">
                                    New rewards will appear here.
                                </p>

                            </div>
                        ) : (
                            storeRewards.map((reward) => {

                                const Icon = getRewardIcon(reward);

                                const itemId = getItemId(reward);

                                const price = numberValue(
                                    firstDefined(
                                        reward?.price,
                                        reward?.cost,
                                        reward?.credits,
                                        reward?.creditCost,
                                        reward?.credit_cost
                                    )
                                );

                                const owned = Boolean(
                                    reward?.owned ||
                                    reward?.isOwned ||
                                    reward?.is_owned
                                );

                                const canAfford =
                                    credits >= price;

                                return (
                                    <div
                                        key={
                                            itemId ||
                                            reward?.title ||
                                            reward?.name
                                        }
                                        className="group overflow-hidden rounded-xl border border-[#e2dfd7] bg-[#faf9f6] transition duration-200 hover:-translate-y-1 hover:border-[#c5ad72] hover:shadow-md"
                                    >

                                        <div className="flex h-36 items-center justify-center bg-[#121212]">

                                            <div className="relative flex h-20 w-20 rotate-45 items-center justify-center border border-[#655632]">

                                                <Icon
                                                    size={30}
                                                    className="-rotate-45 text-[#d1b979]"
                                                    strokeWidth={1.5}
                                                />

                                            </div>

                                        </div>

                                        <div className="p-4">

                                            <div className="mb-2 flex items-center justify-between">

                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#9a8047]">
                                                    {firstDefined(
                                                        reward?.type,
                                                        reward?.category,
                                                        "REWARD"
                                                    )}
                                                </span>

                                                <span className="text-[10px] font-bold text-[#8c8e94]">
                                                    {formatNumber(price)} C
                                                </span>

                                            </div>

                                            <h3 className="text-sm font-black">
                                                {firstDefined(
                                                    reward?.title,
                                                    reward?.name,
                                                    "Reward"
                                                )}
                                            </h3>

                                            <p className="mt-1 min-h-[34px] text-[10px] font-medium leading-4 text-[#85878e]">
                                                {firstDefined(
                                                    reward?.description,
                                                    "Unlock this reward using SYNCO Credits."
                                                )}
                                            </p>

                                            {owned ? (
                                                <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#ded7c5] bg-[#f3f0e7] py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-[#8c7440]">
                                                    <Check size={12} />
                                                    Owned
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleRedeem(reward)
                                                    }
                                                    disabled={
                                                        !itemId ||
                                                        !canAfford ||
                                                        redeemingId === itemId
                                                    }
                                                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:bg-[#d8d6d0] disabled:text-[#8c8e94]"
                                                >
                                                    {redeemingId === itemId ? (
                                                        <>
                                                            <RefreshCw
                                                                size={11}
                                                                className="animate-spin"
                                                            />
                                                            Redeeming
                                                        </>
                                                    ) : !canAfford ? (
                                                        <>
                                                            Insufficient Credits
                                                        </>
                                                    ) : (
                                                        <>
                                                            Redeem
                                                            <ChevronRight
                                                                size={12}
                                                            />
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                        </div>

                                    </div>
                                );
                            })
                        )}

                    </div>

                </section>

                {/* =================================================
                    ACHIEVEMENTS + HISTORY
                ================================================== */}

                <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">

                    {/* ACHIEVEMENTS */}

                    <div className="rounded-2xl border border-[#dfdcd4] bg-white p-6 shadow-sm">

                        <div className="mb-6 flex items-center justify-between">

                            <div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b8148]">
                                    MILESTONES
                                </p>

                                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
                                    Achievements
                                </h2>

                            </div>

                            <span className="text-[10px] font-black uppercase tracking-wider text-[#8b8e95]">
                                {unlockedAchievements.length} / {achievements.length}{" "}
                                Unlocked
                            </span>

                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                            {achievements.length === 0 ? (
                                <div className="col-span-full rounded-xl border border-dashed border-[#dedbd3] px-5 py-8 text-center">

                                    <Award
                                        size={22}
                                        className="mx-auto text-[#aaa39a]"
                                    />

                                    <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#777a82]">
                                        No achievements yet
                                    </p>

                                </div>
                            ) : (
                                achievements.map((achievement) => {

                                    const unlocked = Boolean(
                                        achievement?.unlocked ||
                                        achievement?.isUnlocked ||
                                        achievement?.is_unlocked
                                    );

                                    return (
                                        <div
                                            key={
                                                achievement?.id ||
                                                achievement?.title ||
                                                achievement?.name
                                            }
                                            className={`flex items-center gap-4 rounded-xl border p-4 ${unlocked
                                                ? "border-[#ded7c5] bg-[#fbfaf6]"
                                                : "border-[#e5e3de] bg-[#f8f8f6]"
                                                }`}
                                        >

                                            <div
                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${unlocked
                                                    ? "bg-[#171717]"
                                                    : "bg-[#e7e6e2]"
                                                    }`}
                                            >

                                                {unlocked ? (
                                                    <Award
                                                        size={18}
                                                        className="text-[#d1b979]"
                                                    />
                                                ) : (
                                                    <Lock
                                                        size={16}
                                                        className="text-[#9b9c9f]"
                                                    />
                                                )}

                                            </div>

                                            <div className="min-w-0">

                                                <p className="text-sm font-black">
                                                    {firstDefined(
                                                        achievement?.title,
                                                        achievement?.name,
                                                        "Achievement"
                                                    )}
                                                </p>

                                                <p className="mt-1 text-[10px] font-medium leading-4 text-[#85878e]">
                                                    {firstDefined(
                                                        achievement?.description,
                                                        "Complete the required milestone to unlock this achievement."
                                                    )}
                                                </p>

                                                {achievement?.unlockedAt && (
                                                    <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-[#9b8148]">
                                                        Unlocked{" "}
                                                        {formatDate(
                                                            achievement.unlockedAt
                                                        )}
                                                    </p>
                                                )}

                                            </div>

                                        </div>
                                    );
                                })
                            )}

                        </div>

                    </div>

                    {/* HISTORY */}

                    <div className="rounded-2xl border border-[#dfdcd4] bg-white p-6 shadow-sm">

                        <div className="mb-6 flex items-center justify-between">

                            <div>

                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b8148]">
                                    ACTIVITY
                                </p>

                                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
                                    Recent Rewards
                                </h2>

                            </div>

                            <Clock3
                                size={18}
                                className="text-[#9b8148]"
                            />

                        </div>

                        <div className="space-y-1">

                            {recentRewards.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#dedbd3] px-5 py-8 text-center">

                                    <Clock3
                                        size={21}
                                        className="mx-auto text-[#aaa39a]"
                                    />

                                    <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#777a82]">
                                        No reward activity
                                    </p>

                                    <p className="mt-1 text-[10px] font-medium text-[#999ba0]">
                                        Your reward activity will appear here.
                                    </p>

                                </div>
                            ) : (
                                recentRewards.map((reward, index) => {

                                    const amount = firstDefined(
                                        reward?.amount,
                                        reward?.value,
                                        reward?.reward,
                                        reward?.credits,
                                        reward?.xp
                                    );

                                    const numericAmount =
                                        typeof amount === "number"
                                            ? amount
                                            : Number(
                                                String(amount || "")
                                                    .replace(
                                                        /[^0-9.-]/g,
                                                        ""
                                                    )
                                            );

                                    const positive =
                                        reward?.positive !== undefined
                                            ? Boolean(reward.positive)
                                            : numericAmount >= 0;

                                    return (
                                        <div
                                            key={
                                                reward?.id ||
                                                `${reward?.title || reward?.description || "reward"}-${index}`
                                            }
                                            className="flex items-center justify-between border-b border-[#eeeae2] py-3 last:border-0"
                                        >

                                            <div className="flex items-center gap-3">

                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f0e8]">
                                                    <Gift
                                                        size={14}
                                                        className="text-[#927941]"
                                                    />
                                                </div>

                                                <div>

                                                    <p className="text-xs font-black">
                                                        {firstDefined(
                                                            reward?.title,
                                                            reward?.description,
                                                            reward?.reason,
                                                            "Reward activity"
                                                        )}
                                                    </p>

                                                    <p className="mt-0.5 text-[9px] font-semibold text-[#999ba0]">
                                                        {formatDate(
                                                            firstDefined(
                                                                reward?.createdAt,
                                                                reward?.created_at,
                                                                reward?.timestamp,
                                                                reward?.date
                                                            )
                                                        )}
                                                    </p>

                                                </div>

                                            </div>

                                            <span
                                                className={`text-[10px] font-black ${positive
                                                    ? "text-[#8c7440]"
                                                    : "text-[#8a5f5f]"
                                                    }`}
                                            >
                                                {typeof amount === "number"
                                                    ? `${amount >= 0 ? "+" : ""}${formatNumber(
                                                        amount
                                                    )}`
                                                    : firstDefined(
                                                        amount,
                                                        "—"
                                                    )}
                                            </span>

                                        </div>
                                    );
                                })
                            )}

                        </div>

                        {recentRewards.length > 0 && (
                            <button
                                onClick={() => {
                                    window.dispatchEvent(
                                        new CustomEvent(
                                            "synco:open-reward-history"
                                        )
                                    );
                                }}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#dedbd3] py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-[#6f7278] transition hover:bg-[#f8f7f3]"
                            >
                                View Reward History
                                <ChevronRight size={12} />
                            </button>
                        )}

                    </div>

                </section>

            </main>

            {/* =====================================================
                REFRESH BUTTON
            ====================================================== */}

            <button
                onClick={() => loadRewards(true)}
                disabled={refreshing}
                title="Refresh rewards"
                className="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d5cc] bg-white text-[#777a82] shadow-lg transition hover:bg-[#f5f3ee] disabled:opacity-50"
            >
                <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                />
            </button>

        </div>
    );
};

export default Reward;