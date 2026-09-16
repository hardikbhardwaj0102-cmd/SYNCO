import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    ChevronDown,
    ArrowDown,
    ArrowUp,
    Clock3,
    Gamepad2,
    Info,
    Layers3,
    Loader2,
    ShieldCheck,
    Swords,
    Trophy,
    Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'https://synco-backend-vi7b.onrender.com';

/* =========================================================
   FALLBACK CONFIG
========================================================= */

const FALLBACK_CONFIG = {
    bgmi: {
        game_names: ['BGMI', 'Battlegrounds Mobile India'],
        modes: {
            CLASSIC: {
                type: 'CLASSIC',
                structure: 'POINTS',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: 3,
            },
            VERSUS: {
                type: 'VERSUS',
                structure: 'KNOCKOUT',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: null,
            },
        },
    },
    pubg: {
        game_names: ['PUBG'],
        modes: {
            CLASSIC: {
                type: 'CLASSIC',
                structure: 'POINTS',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: 3,
            },
            VERSUS: {
                type: 'VERSUS',
                structure: 'KNOCKOUT',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: null,
            },
        },
    },
    'pubg-mobile': {
        game_names: ['PUBG Mobile', 'PUBG MOBILE'],
        modes: {
            CLASSIC: {
                type: 'CLASSIC',
                structure: 'POINTS',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: 3,
            },
            VERSUS: {
                type: 'VERSUS',
                structure: 'KNOCKOUT',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: null,
            },
        },
    },
    'free-fire': {
        game_names: ['Free Fire', 'Free Fire MAX'],
        modes: {
            CLASSIC: {
                type: 'CLASSIC',
                structure: 'POINTS',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: 3,
            },
            VERSUS: {
                type: 'VERSUS',
                structure: 'KNOCKOUT',
                participant_type: 'TEAM',
                team_sizes: [1, 2, 3, 4],
                default_matches: null,
            },
        },
    },
    valorant: {
        game_names: ['Valorant', 'VALORANT'],
        modes: {
            ARENA: {
                type: 'VERSUS',
                structure: 'KNOCKOUT',
                participant_type: 'TEAM',
                team_sizes: [5],
                default_matches: null,
            },
        },
    },
    'clash-royale': {
        game_names: ['Clash Royale'],
        modes: {
            COMPETITIVE: {
                type: 'VERSUS',
                structure: 'KNOCKOUT',
                participant_type: 'TEAM',
                team_sizes: [1, 2],
                default_matches: null,
            },
        },
    },
};

const DEFAULT_PLACEMENT_POINTS = {
    1: 15,
    2: 12,
    3: 10,
    4: 8,
    5: 6,
    6: 5,
    7: 4,
    8: 3,
    9: 2,
    10: 1,
};

const TIEBREAKER_OPTIONS = [
    {
        id: 'PLACEMENT_POINTS',
        label: 'Placement Points',
        description: 'Higher cumulative placement points rank higher.',
    },
    {
        id: 'KILLS',
        label: 'Kills',
        description: 'Higher cumulative kills rank higher.',
    },
    {
        id: 'MATCH_WINS',
        label: 'Match Wins',
        description: 'More first-place match finishes rank higher.',
    },
    {
        id: 'BEST_MATCH_SCORE',
        label: 'Best Match Score',
        description: 'Higher single-match score ranks higher.',
    },
];

/* =========================================================
   HELPERS
========================================================= */

const slugifyGame = (value) => {
    const normalized = String(value || '').trim().toLowerCase();

    const aliases = {
        bgmi: 'bgmi',
        'battlegrounds mobile india': 'bgmi',
        pubg: 'pubg',
        'pubg mobile': 'pubg-mobile',
        'pubg mobile india': 'pubg-mobile',
        'free fire': 'free-fire',
        'free fire max': 'free-fire',
        valorant: 'valorant',
        'clash royale': 'clash-royale',
    };

    return aliases[normalized] || normalized.replace(/[^a-z0-9]+/g, '-');
};

const formatLabel = (value) => {
    if (!value) return '';
    return String(value)
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const localDateTimeValue = (date) => {
    if (!date) return '';
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getDefaultRegistrationStart = () => {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return localDateTimeValue(date);
};

const getDefaultRegistrationEnd = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    date.setHours(23, 0, 0, 0);
    return localDateTimeValue(date);
};

const getDefaultCompetitionStart = () => {
    const date = new Date();
    date.setDate(date.getDate() + 4);
    date.setHours(19, 0, 0, 0);
    return localDateTimeValue(date);
};

const getDefaultCompetitionEnd = () => {
    const date = new Date();
    date.setDate(date.getDate() + 4);
    date.setHours(22, 0, 0, 0);
    return localDateTimeValue(date);
};

const nextPowerOfTwo = (value) => {
    let size = 1;
    while (size < value) size *= 2;
    return Math.max(2, size);
};

const getRoundName = (roundNumber, totalRounds) => {
    const remaining = totalRounds - roundNumber;
    if (remaining === 0) return 'Final';
    if (remaining === 1) return 'Semi Finals';
    if (remaining === 2) return 'Quarter Finals';
    if (remaining === 3) return 'Round of 16';
    return `Round ${roundNumber}`;
};

const getBracketStats = (teamCount) => {
    const teams = Math.max(2, Number(teamCount) || 2);
    const slots = nextPowerOfTwo(teams);
    const rounds = Math.log2(slots);
    return {
        teams,
        slots,
        byes: slots - teams,
        matches: teams - 1,
        rounds,
    };
};

const getSeedPairing = (slotCount) => {
    let seeds = [1, 2];
    while (seeds.length < slotCount) {
        const nextSize = seeds.length * 2;
        seeds = seeds.flatMap((seed) => [seed, nextSize + 1 - seed]);
    }
    return seeds;
};

/*
 * Preview helper intentionally mirrors the backend's important
 * bracket property: a single-elimination bracket expands to the
 * next power-of-two size, and empty slots become byes.
 */
const buildBracketPreview = (teamCount) => {
    const stats = getBracketStats(teamCount);
    const seedSlots = getSeedPairing(stats.slots);

    const firstRound = [];

    for (let i = 0; i < stats.slots / 2; i += 1) {
        const seedA = seedSlots[i * 2];
        const seedB = seedSlots[i * 2 + 1];
        const aActive = seedA <= stats.teams;
        const bActive = seedB <= stats.teams;

        firstRound.push({
            number: i + 1,
            seedA,
            seedB,
            teamA: aActive ? `Seed ${seedA}` : 'BYE',
            teamB: bActive ? `Seed ${seedB}` : 'BYE',
            bye:
                (aActive && !bActive) || (!aActive && bActive),
        });
    }

    const rounds = [firstRound];
    let previousCount = firstRound.length;

    while (previousCount > 1) {
        const currentCount = previousCount / 2;
        const currentRound = [];
        for (let index = 0; index < currentCount; index += 1) {
            currentRound.push({
                number: index + 1,
                teamA: `Winner M${index * 2 + 1}`,
                teamB: `Winner M${index * 2 + 2}`,
            });
        }
        rounds.push(currentRound);
        previousCount = currentCount;
    }

    return { stats, rounds };
};

/* =========================================================
   REUSABLE UI
========================================================= */

const SectionHeader = ({ icon: Icon, eyebrow, title, description }) => (
    <div className="mb-8 flex items-start gap-4 border-b border-[#eeeeef] pb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111114] text-white shadow-sm">
            <Icon size={18} strokeWidth={2} />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8b90]">
                {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#111114]">
                {title}
            </h2>
            {description && (
                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#77787e]">
                    {description}
                </p>
            )}
        </div>
    </div>
);

const FieldLabel = ({ children, required = false, hint }) => (
    <div className="mb-2 flex items-center justify-between gap-4">
        <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#37383d]">
            {children}
            {required && <span className="ml-1 text-[#bcae67]">*</span>}
        </label>
        {hint && (
            <span className="text-[10px] font-semibold text-[#9a9ba0]">
                {hint}
            </span>
        )}
    </div>
);

const inputClass =
    'h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm font-semibold text-[#111114] outline-none transition duration-200 placeholder:text-[#aaaab0] hover:border-[#d3d3d6] focus:border-[#111114] focus:bg-white';

const textareaClass =
    'min-h-[120px] w-full resize-none rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm font-semibold leading-6 text-[#111114] outline-none transition duration-200 placeholder:text-[#aaaab0] hover:border-[#d3d3d6] focus:border-[#111114] focus:bg-white';

const selectClass =
    'h-12 w-full appearance-none rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 pr-10 text-sm font-semibold text-[#111114] outline-none transition duration-200 hover:border-[#d3d3d6] focus:border-[#111114] focus:bg-white';

const StepPill = ({ number, title, active, complete }) => (
    <div
        className={`flex items-center gap-3 ${active ? 'text-[#111114]' : 'text-[#a0a1a6]'
            }`}
    >
        <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${complete
                ? 'border-[#111114] bg-[#111114] text-white'
                : active
                    ? 'border-[#111114] bg-white text-[#111114]'
                    : 'border-[#dedee1] bg-white text-[#a0a1a6]'
                }`}
        >
            {complete ? <Check size={14} strokeWidth={3} /> : number}
        </div>
        <span className="hidden text-[10px] font-black uppercase tracking-[0.14em] md:block">
            {title}
        </span>
    </div>
);

const InfoBox = ({ children }) => (
    <div className="rounded-xl border border-[#e6e2cc] bg-[#fbf9ef] p-4">
        <div className="flex items-start gap-3">
            <Info size={16} className="mt-0.5 shrink-0 text-[#9f934d]" />
            <div className="text-xs font-medium leading-5 text-[#69664f]">
                {children}
            </div>
        </div>
    </div>
);

const StatCard = ({ label, value, hint }) => (
    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a9ba0]">
            {label}
        </p>
        <p className="mt-1 text-2xl font-black tracking-tight text-[#111114]">
            {value}
        </p>
        {hint && <p className="mt-1 text-[10px] font-semibold text-[#8b8c91]">{hint}</p>}
    </div>
);

/* =========================================================
   COMPONENT
========================================================= */

const CreateCompetition = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [games, setGames] = useState([]);
    const [config, setConfig] = useState(FALLBACK_CONFIG);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [form, setForm] = useState({
        title: '',
        description: '',
        gameId: 'bgmi',
        competitionType: 'CLASSIC',
        gameMode: 'CLASSIC',
        participantType: 'TEAM',
        teamSize: 4,
        maxTeams: 16,
        numberOfMatches: 3,
        bestOf: 1,
        seedingMethod: 'BALANCED_SEEDING',
        allowAutomaticByes: true,
        registrationStart: getDefaultRegistrationStart(),
        registrationEnd: getDefaultRegistrationEnd(),
        competitionStart: getDefaultCompetitionStart(),
        competitionEnd: getDefaultCompetitionEnd(),
        competitionRules: '',
        matchRules: '',
        eligibilityRules: '',
        killPoints: 1,
        placementPoints: DEFAULT_PLACEMENT_POINTS,
        tiebreakers: ['PLACEMENT_POINTS', 'KILLS', 'MATCH_WINS'],
    });

    /* =====================================================
       LOAD CONFIG
    ===================================================== */

    useEffect(() => {
        const loadConfiguration = async () => {
            try {
                setLoadingConfig(true);
                const response = await fetch(`${API_URL}/api/competitions/config`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });

                if (!response.ok) throw new Error('Unable to load competition configuration.');

                const data = await response.json();
                setConfig(data?.games && typeof data.games === 'object' ? data.games : FALLBACK_CONFIG);
                setGames(Array.isArray(data?.gamesList) ? data.gamesList : []);
            } catch (loadError) {
                console.warn('Competition configuration fallback:', loadError);
                setConfig(FALLBACK_CONFIG);
            } finally {
                setLoadingConfig(false);
            }
        };

        loadConfiguration();
    }, []);

    const gameList = useMemo(() => {
        if (Array.isArray(games) && games.length) return games;

        return Object.entries(config || {}).map(([id, gameConfig]) => ({
            id,
            name: gameConfig?.game_names?.[0] || formatLabel(id),
            ...gameConfig,
        }));
    }, [games, config]);

    const selectedGame = useMemo(() => {
        const direct = gameList.find(
            (game) => String(game.id) === String(form.gameId)
        );
        if (direct) return direct;

        const fallbackKey = slugifyGame(form.gameId);
        const fallback = config?.[fallbackKey];
        return {
            id: form.gameId,
            name: fallback?.game_names?.[0] || formatLabel(form.gameId),
            ...fallback,
        };
    }, [gameList, config, form.gameId]);

    const modeList = useMemo(() => {
        const modes = selectedGame?.modes || config?.[slugifyGame(form.gameId)]?.modes || {};
        return Object.entries(modes).map(([id, mode]) => ({ id, ...mode }));
    }, [selectedGame, config, form.gameId]);

    const selectedMode = useMemo(
        () => modeList.find((mode) => mode.id === form.gameMode) || modeList[0] || null,
        [modeList, form.gameMode]
    );

    const isVersus = form.competitionType === 'VERSUS';
    const bracketPreview = useMemo(
        () => buildBracketPreview(Number(form.maxTeams)),
        [form.maxTeams]
    );

    const totalRoundsName = useMemo(() => {
        const stats = bracketPreview.stats;
        return stats.rounds === 1 ? 'Final' : `${stats.rounds} rounds`;
    }, [bracketPreview]);

    useEffect(() => {
        if (!selectedMode) return;

        const nextType = selectedMode.type || selectedMode.competition_type || 'CLASSIC';
        const nextStructure = selectedMode.structure || (nextType === 'VERSUS' ? 'KNOCKOUT' : 'POINTS');
        const supportedSizes = Array.isArray(selectedMode.team_sizes)
            ? selectedMode.team_sizes
            : [1, 2, 3, 4];
        const nextTeamSize = supportedSizes.includes(Number(form.teamSize))
            ? Number(form.teamSize)
            : Number(supportedSizes[0]);

        setForm((previous) => {
            const nextMatches = selectedMode.default_matches || (nextType === 'CLASSIC' ? 3 : 1);
            const needsTypeUpdate = previous.competitionType !== nextType;
            const needsModeUpdate = previous.gameMode !== selectedMode.id;
            const needsTeamSizeUpdate = Number(previous.teamSize) !== nextTeamSize;
            const needsMatchesUpdate = Number(previous.numberOfMatches) !== Number(nextMatches);

            if (!needsTypeUpdate && !needsModeUpdate && !needsTeamSizeUpdate && !needsMatchesUpdate) {
                return previous;
            }

            return {
                ...previous,
                competitionType: nextType,
                gameMode: selectedMode.id,
                teamSize: nextTeamSize,
                numberOfMatches: nextMatches,
            };
        });
    }, [selectedMode]);

    const updateForm = (field, value) => {
        setError('');
        setForm((previous) => ({ ...previous, [field]: value }));
    };

    const handleGameChange = (value) => {
        const game = gameList.find((item) => String(item.id) === String(value));
        const nextModes = game?.modes || config?.[slugifyGame(value)]?.modes || {};
        const [firstModeId, firstModeConfig] = Object.entries(nextModes)[0] || ['CLASSIC', null];
        const nextType = firstModeConfig?.type || 'CLASSIC';
        const supportedSizes = Array.isArray(firstModeConfig?.team_sizes)
            ? firstModeConfig.team_sizes
            : [1, 2, 3, 4];

        setError('');
        setForm((previous) => ({
            ...previous,
            gameId: value,
            gameMode: firstModeId,
            competitionType: nextType,
            teamSize: Number(supportedSizes[0] || 1),
            numberOfMatches: firstModeConfig?.default_matches || (nextType === 'CLASSIC' ? 3 : 1),
        }));
    };

    const handleCompetitionTypeChange = (type) => {
        const matchingMode = modeList.find(
            (mode) => String(mode.type || mode.competition_type || '').toUpperCase() === type
        );

        if (!matchingMode) return;

        const supportedSizes = Array.isArray(matchingMode.team_sizes)
            ? matchingMode.team_sizes
            : [1, 2, 3, 4];

        setError('');
        setForm((previous) => ({
            ...previous,
            competitionType: type,
            gameMode: matchingMode.id,
            teamSize: supportedSizes.includes(Number(previous.teamSize))
                ? Number(previous.teamSize)
                : Number(supportedSizes[0] || 1),
            numberOfMatches:
                matchingMode.default_matches || (type === 'CLASSIC' ? 3 : 1),
        }));
    };

    const updatePlacementPoints = (place, value) => {
        setError('');
        setForm((previous) => ({
            ...previous,
            placementPoints: {
                ...previous.placementPoints,
                [place]: value,
            },
        }));
    };

    const moveTiebreaker = (index, direction) => {
        setForm((previous) => {
            const next = [...previous.tiebreakers];
            const target = index + direction;
            if (target < 0 || target >= next.length) return previous;
            [next[index], next[target]] = [next[target], next[index]];
            return { ...previous, tiebreakers: next };
        });
    };

    const validateStep = (stepNumber) => {
        setError('');

        if (stepNumber === 1) {
            if (!form.title.trim()) {
                setError('Competition title is required.');
                return false;
            }
            if (!form.gameId) {
                setError('Select a game.');
                return false;
            }
        }

        if (stepNumber === 2) {
            const maxTeams = Number(form.maxTeams);
            if (!Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 25) {
                setError('Maximum teams must be between 2 and 25.');
                return false;
            }

            if (!Number(form.teamSize) || Number(form.teamSize) < 1) {
                setError('Select a valid team size.');
                return false;
            }

            if (form.competitionType === 'CLASSIC') {
                const matches = Number(form.numberOfMatches);
                if (!Number.isInteger(matches) || matches < 1 || matches > 50) {
                    setError('Classic competitions need between 1 and 50 matches.');
                    return false;
                }
            }
        }

        if (stepNumber === 3) {
            const start = new Date(form.registrationStart);
            const registrationEnd = new Date(form.registrationEnd);
            const competitionStart = new Date(form.competitionStart);
            const competitionEnd = new Date(form.competitionEnd);

            if ([start, registrationEnd, competitionStart, competitionEnd].some((date) => Number.isNaN(date.getTime()))) {
                setError('Please provide all schedule dates.');
                return false;
            }
            if (registrationEnd <= start) {
                setError('Registration must end after it starts.');
                return false;
            }
            if (competitionStart < registrationEnd) {
                setError('Competition should start after registration closes.');
                return false;
            }
            if (competitionEnd <= competitionStart) {
                setError('Competition must end after it starts.');
                return false;
            }
        }

        if (stepNumber === 4) {
            if (!form.competitionRules.trim()) {
                setError('Add the competition rules.');
                return false;
            }
        }

        if (stepNumber === 5 && isVersus) {
            if (!form.seedingMethod) {
                setError('Select a seeding method.');
                return false;
            }
        }

        if (stepNumber === 6 && !isVersus) {
            const placementValues = Object.values(form.placementPoints).map(Number);
            if (placementValues.some((value) => !Number.isFinite(value) || value < 0)) {
                setError('Placement points must be zero or greater.');
                return false;
            }
            if (!Number.isFinite(Number(form.killPoints)) || Number(form.killPoints) < 0) {
                setError('Kill points must be zero or greater.');
                return false;
            }
            const allowedTiebreakers = new Set(TIEBREAKER_OPTIONS.map((item) => item.id));
            const uniqueTiebreakers = new Set(form.tiebreakers || []);

            if (
                !Array.isArray(form.tiebreakers) ||
                form.tiebreakers.length !== 3 ||
                uniqueTiebreakers.size !== 3 ||
                form.tiebreakers.some((id) => !allowedTiebreakers.has(id))
            ) {
                setError('Choose three different leaderboard tiebreakers.');
                return false;
            }
        }

        return true;
    };

    const goNext = () => {
        if (!validateStep(step)) return;
        const lastStep = isVersus ? 6 : 6;
        setStep((previous) => Math.min(previous + 1, lastStep));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goBack = () => {
        setError('');
        setStep((previous) => Math.max(previous - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCreate = async () => {
        if (!validateStep(4)) {
            setStep(4);
            return;
        }

        if (!validateStep(5)) {
            setStep(5);
            return;
        }

        if (!isVersus && !validateStep(6)) {
            setStep(6);
            return;
        }

        setCreating(true);
        setError('');
        setSuccessMessage('');

        const structure = selectedMode?.structure || (isVersus ? 'KNOCKOUT' : 'POINTS');
        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            gameId: form.gameId,
            competitionType: form.competitionType,
            gameMode: form.gameMode,
            participantType: form.participantType,
            teamSize: Number(form.teamSize),

            /*
             * New public contract: maxTeams.
             * maxParticipants is retained for compatibility with the
             * existing Competition SQLAlchemy model/backend.
             */
            maxTeams: Number(form.maxTeams),
            maxParticipants: Number(form.maxTeams),

            numberOfMatches: isVersus ? 1 : Number(form.numberOfMatches),
            configuration: {
                structure,
                bracket: isVersus
                    ? {
                        type: 'SINGLE_ELIMINATION',
                        seeding: form.seedingMethod,
                        allowByes: Boolean(form.allowAutomaticByes),
                        maxTeams: Number(form.maxTeams),
                        bracketSlots: bracketPreview.stats.slots,
                        expectedByes: bracketPreview.stats.byes,
                        expectedMatches: bracketPreview.stats.matches,
                        expectedRounds: bracketPreview.stats.rounds,
                        bestOf: Number(form.bestOf),
                    }
                    : null,
                scoring: !isVersus
                    ? {
                        placementPoints: form.placementPoints,
                        killPoints: Number(form.killPoints),
                        tiebreakers: ['TOTAL_POINTS', ...form.tiebreakers],
                    }
                    : null,
                leaderboard: !isVersus
                    ? {
                        primary: 'TOTAL_POINTS',
                        tiebreakers: form.tiebreakers,
                    }
                    : null,
            },
            competitionRules: form.competitionRules.trim(),
            matchRules: form.matchRules.trim(),
            eligibilityRules: form.eligibilityRules.trim(),
            registrationStart: form.registrationStart,
            registrationEnd: form.registrationEnd,
            competitionStart: form.competitionStart,
            competitionEnd: form.competitionEnd,
        };

        try {
            const response = await fetch(`${API_URL}/api/competitions`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`Server returned ${response.status} instead of JSON.`);
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Unable to create competition.');
            }
            if (!data?.success) {
                throw new Error(data?.message || 'Competition creation failed.');
            }

            const createdCompetition = data?.competition;
            setSuccessMessage('Competition created successfully.');

            window.setTimeout(() => {
                if (createdCompetition?.id) {
                    navigate(`/competitions/${createdCompetition.id}`);
                } else {
                    navigate('/competitions');
                }
            }, 700);
        } catch (createError) {
            console.error('Competition creation failed:', createError);
            setError(createError?.message || 'Unable to create competition.');
        } finally {
            setCreating(false);
        }
    };

    const stepTitle =
        {
            1: 'Competition basics',
            2: 'Format & teams',
            3: 'Schedule',
            4: 'Rules',
            5: isVersus ? 'Bracket setup' : 'Tournament structure',
            6: isVersus ? 'Review' : 'Points & leaderboard',
        }[step] || 'Create competition';


    return (
        <div className="min-h-screen bg-[#f5f5f4] text-[#111114]">
            {/* TOP BAR */}
            <div className="sticky top-0 z-40 border-b border-black/10 bg-white/95 shadow-sm backdrop-blur">
                <div className="mx-auto flex h-[76px] max-w-[1400px] items-center justify-between px-5 lg:px-8">
                    <button
                        type="button"
                        onClick={() => navigate('/competitions')}
                        className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[#fafafa]"
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111114] text-white shadow-sm transition group-hover:bg-[#2a2a2e]">
                            <ArrowLeft size={16} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#999a9f]">
                                SYNCO
                            </p>
                            <p className="text-sm font-black tracking-tight">
                                Create Competition
                            </p>
                        </div>
                    </button>

                    <div className="hidden items-center gap-4 md:flex">
                        {[
                            ['1', 'Basics'],
                            ['2', 'Format'],
                            ['3', 'Schedule'],
                            ['4', 'Rules'],
                            ['5', isVersus ? 'Bracket' : 'Points'],
                            ['6', 'Review'],
                        ].map(([number, title], index) => (
                            <div key={number} className="flex items-center gap-4">
                                <StepPill
                                    number={number}
                                    title={title}
                                    active={step === Number(number)}
                                    complete={step > Number(number)}
                                />
                                {index < 5 && <div className="h-px w-5 bg-[#dedee1]" />}
                            </div>
                        ))}
                    </div>

                    <div className="hidden rounded-full border border-[#e5e5e7] bg-[#fafafa] px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#77787e] sm:block">
                        Organizer
                    </div>
                </div>
            </div>

            <div className="border-b border-black/10 bg-white md:hidden">
                <div className="mx-auto max-w-[1320px] px-5 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a9ba0]">
                                Step {step} of 6
                            </p>
                            <p className="mt-1 text-xs font-black text-[#111114]">
                                {stepTitle}
                            </p>
                        </div>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e7e7e9]">
                            <div
                                className="h-full rounded-full bg-[#111114] transition-all duration-300"
                                style={{ width: `${(step / 6) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-11">
                {/* HEADER */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7f45]">
                        <Swords size={13} />
                        Competition Engine
                    </div>

                    <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                        <div>
                            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                                {stepTitle}
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#77787e]">
                                Build a competition with a clear progression path, transparent scoring, and rules that SYNCO can enforce consistently.
                            </p>
                        </div>

                        <div className="rounded-xl border border-[#dedee1] bg-white px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a9ba0]">
                                Current format
                            </p>
                            <p className="mt-1 text-sm font-black">
                                {formatLabel(form.competitionType)}
                                <span className="mx-2 text-[#c7c7ca]">/</span>
                                {formatLabel(form.gameMode)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ALERTS */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        <Info size={17} className="mt-0.5 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#e6e2cc] bg-[#fbf9ef] px-4 py-3 text-sm font-semibold text-[#6d643a]">
                        <Check size={17} className="mt-0.5 shrink-0" />
                        <p>{successMessage}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                        {/* STEP 1 */}
                        {step === 1 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={Gamepad2}
                                    eyebrow="01 / Basics"
                                    title="Start with the competition identity"
                                    description="Give players enough information to understand what they are joining before they register."
                                />

                                <div className="grid gap-6">
                                    <div>
                                        <FieldLabel required>Competition title</FieldLabel>
                                        <input
                                            value={form.title}
                                            onChange={(event) => updateForm('title', event.target.value)}
                                            className={inputClass}
                                            placeholder="SYNCO BGMI Open #01"
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel>Description</FieldLabel>
                                        <textarea
                                            value={form.description}
                                            onChange={(event) => updateForm('description', event.target.value)}
                                            className={textareaClass}
                                            placeholder="Explain the competition format, audience, and what players are competing for."
                                        />
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div>
                                            <FieldLabel required>Game</FieldLabel>
                                            <div className="relative">
                                                <select
                                                    value={form.gameId}
                                                    onChange={(event) => handleGameChange(event.target.value)}
                                                    className={selectClass}
                                                    disabled={loadingConfig}
                                                >
                                                    {gameList.map((game) => (
                                                        <option key={game.id} value={game.id}>
                                                            {game.name || formatLabel(game.id)}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8d8e93]" size={16} />
                                            </div>
                                        </div>

                                        <div>
                                            <FieldLabel>Mode</FieldLabel>
                                            <div className="relative">
                                                <select
                                                    value={form.gameMode}
                                                    onChange={(event) => updateForm('gameMode', event.target.value)}
                                                    className={selectClass}
                                                >
                                                    {modeList.map((mode) => (
                                                        <option key={mode.id} value={mode.id}>
                                                            {formatLabel(mode.id)}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8d8e93]" size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    <InfoBox>
                                        <span className="font-black">{selectedGame?.name || formatLabel(form.gameId)}</span>{' '}
                                        is configured as a <span className="font-black">{formatLabel(form.competitionType)}</span> competition in this setup.
                                    </InfoBox>
                                </div>
                            </div>
                        )}

                        {/* STEP 2 */}
                        {step === 2 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={Users}
                                    eyebrow="02 / Format"
                                    title="Define teams and field size"
                                    description="Maximum teams is the organizer-facing limit. SYNCO uses the actual registered teams when the bracket is generated."
                                />

                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <FieldLabel required>Competition format</FieldLabel>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {[
                                                {
                                                    id: 'CLASSIC',
                                                    title: 'Points / League',
                                                    description: 'Teams play multiple matches and accumulate points.',
                                                },
                                                {
                                                    id: 'VERSUS',
                                                    title: 'Single Elimination',
                                                    description: 'Teams are eliminated after losing a pairing.',
                                                },
                                            ]
                                                .filter((item) =>
                                                    modeList.some(
                                                        (mode) =>
                                                            String(mode.type || mode.competition_type || '').toUpperCase() === item.id
                                                    )
                                                )
                                                .map((item) => {
                                                    const active = form.competitionType === item.id;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleCompetitionTypeChange(item.id)}
                                                            className={`rounded-xl border p-4 text-left transition ${active
                                                                ? 'border-[#111114] bg-[#111114] text-white'
                                                                : 'border-[#e4e4e7] bg-[#fafafa] hover:border-[#bbbcc0]'
                                                                }`}
                                                        >
                                                            <p className="text-sm font-black">{item.title}</p>
                                                            <p
                                                                className={`mt-1 text-xs font-medium leading-5 ${active ? 'text-white/70' : 'text-[#85868c]'
                                                                    }`}
                                                            >
                                                                {item.description}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    <div>
                                        <FieldLabel required hint="2–25">Maximum teams</FieldLabel>
                                        <input
                                            type="number"
                                            min="2"
                                            max="25"
                                            step="1"
                                            value={form.maxTeams}
                                            onChange={(event) =>
                                                updateForm('maxTeams', Math.min(25, Math.max(2, Number(event.target.value) || 2)))
                                            }
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel required>Team size</FieldLabel>
                                        <div className="relative">
                                            <select
                                                value={form.teamSize}
                                                onChange={(event) => updateForm('teamSize', Number(event.target.value))}
                                                className={selectClass}
                                            >
                                                {(selectedMode?.team_sizes || [1, 2, 3, 4]).map((size) => (
                                                    <option key={size} value={size}>
                                                        {size === 1 ? 'Solo' : `${size} players`}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8d8e93]" size={16} />
                                        </div>
                                    </div>

                                    {!isVersus && (
                                        <div>
                                            <FieldLabel required hint="1–50">Matches per team</FieldLabel>
                                            <input
                                                type="number"
                                                min="1"
                                                max="50"
                                                step="1"
                                                value={form.numberOfMatches}
                                                onChange={(event) =>
                                                    updateForm('numberOfMatches', Math.min(50, Math.max(1, Number(event.target.value) || 1)))
                                                }
                                                className={inputClass}
                                            />
                                        </div>
                                    )}

                                    {isVersus && (
                                        <div>
                                            <FieldLabel>Match length</FieldLabel>
                                            <div className="relative">
                                                <select
                                                    value={form.bestOf}
                                                    onChange={(event) => updateForm('bestOf', Number(event.target.value))}
                                                    className={selectClass}
                                                >
                                                    <option value="1">Best of 1</option>
                                                    <option value="3">Best of 3</option>
                                                    <option value="5">Best of 5</option>
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8d8e93]" size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <InfoBox>
                                        A 25-team knockout does <span className="font-black">not</span> mean 25 opening matches. SYNCO expands the bracket to the next power of two, distributes the empty slots as byes, and keeps the total elimination match count at <span className="font-black">teams − 1</span>.
                                    </InfoBox>
                                </div>
                            </div>
                        )}

                        {/* STEP 3 */}
                        {step === 3 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={CalendarDays}
                                    eyebrow="03 / Schedule"
                                    title="Set the registration and match window"
                                    description="Registration should close before competition begins so the final field can be locked before brackets are generated."
                                />

                                <div className="grid gap-6 md:grid-cols-2">
                                    {[
                                        ['registrationStart', 'Registration opens'],
                                        ['registrationEnd', 'Registration closes'],
                                        ['competitionStart', 'Competition starts'],
                                        ['competitionEnd', 'Competition ends'],
                                    ].map(([field, label]) => (
                                        <div key={field}>
                                            <FieldLabel required>{label}</FieldLabel>
                                            <div className="relative">
                                                <input
                                                    type="datetime-local"
                                                    value={form[field]}
                                                    onChange={(event) => updateForm(field, event.target.value)}
                                                    className={`${inputClass} pr-12`}
                                                />
                                                <Clock3 className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8d8e93]" size={16} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                                    <StatCard label="Registration" value={form.registrationEnd ? new Date(form.registrationEnd).toLocaleDateString() : '—'} hint="Closes before competition" />
                                    <StatCard label="Start" value={form.competitionStart ? new Date(form.competitionStart).toLocaleDateString() : '—'} hint="Competition begins" />
                                    <StatCard label="End" value={form.competitionEnd ? new Date(form.competitionEnd).toLocaleDateString() : '—'} hint="Competition ends" />
                                </div>
                            </div>
                        )}

                        {/* STEP 4 */}
                        {step === 4 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={ShieldCheck}
                                    eyebrow="04 / Governance"
                                    title="Write the rules SYNCO will publish"
                                    description="Keep rules explicit. The same rules should be visible to organizers and players before registration."
                                />

                                <div className="grid gap-6">
                                    <div>
                                        <FieldLabel required>Competition rules</FieldLabel>
                                        <textarea
                                            value={form.competitionRules}
                                            onChange={(event) => updateForm('competitionRules', event.target.value)}
                                            className={textareaClass}
                                            placeholder="Entry requirements, scoring disputes, no-show policy, cheating rules, result verification..."
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Match rules</FieldLabel>
                                        <textarea
                                            value={form.matchRules}
                                            onChange={(event) => updateForm('matchRules', event.target.value)}
                                            className={textareaClass}
                                            placeholder="Lobby rules, map selection, rematch policy, disconnect handling..."
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Eligibility rules</FieldLabel>
                                        <textarea
                                            value={form.eligibilityRules}
                                            onChange={(event) => updateForm('eligibilityRules', event.target.value)}
                                            className={textareaClass}
                                            placeholder="Age, account requirements, region restrictions, roster requirements..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 5 VERSUS */}
                        {isVersus && step === 5 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={Layers3}
                                    eyebrow="05 / Bracket"
                                    title="Build a fair single-elimination bracket"
                                    description="This is a live preview of the structure SYNCO will generate after registration closes and the final teams are locked."
                                />

                                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                                    <div className="space-y-5">
                                        <div>
                                            <FieldLabel>Seeding method</FieldLabel>
                                            <div className="relative">
                                                <select
                                                    value={form.seedingMethod}
                                                    onChange={(event) => updateForm('seedingMethod', event.target.value)}
                                                    className={selectClass}
                                                >
                                                    <option value="BALANCED_SEEDING">Balanced seeding</option>
                                                    <option value="REGISTRATION_ORDER">Registration order</option>
                                                    <option value="RANDOM">Random seeding</option>
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8d8e93]" size={16} />
                                            </div>
                                        </div>

                                        <div>
                                            <FieldLabel>Bracket type</FieldLabel>
                                            <div className="flex h-12 items-center rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm font-semibold">
                                                Single Elimination
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-black">Automatic byes</p>
                                                    <p className="mt-1 text-[10px] font-semibold text-[#8a8b90]">
                                                        Spread empty slots into the first round.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-pressed={form.allowAutomaticByes}
                                                    onClick={() => updateForm('allowAutomaticByes', !form.allowAutomaticByes)}
                                                    className={`relative h-6 w-11 rounded-full transition ${form.allowAutomaticByes ? 'bg-[#d6c98a]' : 'bg-[#d6d6da]'}`}
                                                >
                                                    <span
                                                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${form.allowAutomaticByes ? 'left-6' : 'left-1'}`}
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <StatCard label="Teams" value={bracketPreview.stats.teams} />
                                            <StatCard label="Slots" value={bracketPreview.stats.slots} />
                                            <StatCard label="Byes" value={bracketPreview.stats.byes} />
                                            <StatCard label="Matches" value={bracketPreview.stats.matches} />
                                        </div>

                                        <InfoBox>
                                            <span className="font-black">Fairness rule:</span> every active team must lose exactly once to be eliminated. Empty slots are handled as byes, so no fake matches are added just to fill the bracket.
                                        </InfoBox>
                                    </div>

                                    <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5 sm:p-6">
                                        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#eeeeef] pb-4">
                                            <div>
                                                <p className="text-sm font-black">Bracket map</p>
                                                <p className="mt-1 text-[10px] font-semibold text-[#8a8b90]">
                                                    {bracketPreview.stats.teams} teams → {bracketPreview.stats.slots} slots → {bracketPreview.stats.matches} matches → champion
                                                </p>
                                            </div>
                                            <div className="rounded-full border border-[#e0dfd0] bg-[#fbf9ef] px-3 py-1.5 text-[10px] font-black text-[#736a3f]">
                                                {totalRoundsName}
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto pb-3">
                                            <div
                                                className="flex min-w-max items-stretch gap-7"
                                                style={{ minHeight: Math.max(320, bracketPreview.rounds[0].length * 68) }}
                                            >
                                                {bracketPreview.rounds.map((round, roundIndex) => (
                                                    <div key={roundIndex} className="flex shrink-0 items-stretch gap-3">
                                                        <div
                                                            className="flex w-[204px] shrink-0 flex-col"
                                                            style={{
                                                                justifyContent: roundIndex === 0 ? 'space-between' : 'space-around',
                                                            }}
                                                        >
                                                            <div className="mb-3 text-center">
                                                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#9a9ba0]">
                                                                    {getRoundName(roundIndex + 1, bracketPreview.stats.rounds)}
                                                                </p>
                                                                <p className="mt-1 text-[10px] font-semibold text-[#8b8c91]">
                                                                    {round.length} {round.length === 1 ? 'match' : 'matches'}
                                                                </p>
                                                            </div>

                                                            <div className="flex flex-1 flex-col justify-around gap-2">
                                                                {round.map((match) => (
                                                                    <div key={`${roundIndex}-${match.number}`} className="overflow-hidden rounded-xl border border-[#dedee1] bg-white shadow-sm transition duration-200 hover:border-[#cfcfd2]">
                                                                        <div className="flex items-center justify-between border-b border-[#eeeeef] px-3 py-2">
                                                                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                                                M{roundIndex === 0 ? match.number : `${roundIndex + 1}.${match.number}`}
                                                                            </span>
                                                                            {match.bye && (
                                                                                <span className="rounded-full bg-[#fbf9ef] px-2 py-0.5 text-[8px] font-black uppercase text-[#8b7f45]">
                                                                                    BYE
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="px-3 py-2">
                                                                            <div className="flex items-center justify-between gap-2 border-b border-[#f0f0f1] pb-2">
                                                                                <span className="truncate text-[10px] font-bold text-[#33343a]">{match.teamA}</span>
                                                                                {roundIndex === 0 && match.seedA <= bracketPreview.stats.teams && (
                                                                                    <span className="text-[8px] font-black text-[#9a9ba0]">S{match.seedA}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-between gap-2 pt-2">
                                                                                <span className="truncate text-[10px] font-bold text-[#33343a]">{match.teamB}</span>
                                                                                {roundIndex === 0 && match.seedB <= bracketPreview.stats.teams && (
                                                                                    <span className="text-[8px] font-black text-[#9a9ba0]">S{match.seedB}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {roundIndex < bracketPreview.rounds.length - 1 && (
                                                                <div className="flex w-8 shrink-0 items-center justify-center">
                                                                    <ArrowRight size={16} className="text-[#b1b1b5]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="flex w-[120px] shrink-0 flex-col justify-center">
                                                    <div className="rounded-2xl border border-[#ded5a1] bg-[#fbf9ef] p-4 text-center">
                                                        <Trophy className="mx-auto text-[#a59755]" size={22} />
                                                        <p className="mt-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#7b713e]">
                                                            Champion
                                                        </p>
                                                        <p className="mt-1 text-[10px] font-semibold text-[#8b8464]">
                                                            Winner of Final
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a9ba0]">Stage 1</p>
                                                <p className="mt-1 text-xs font-bold text-[#55565c]">Teams enter by seed</p>
                                            </div>
                                            <div className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a9ba0]">Stage 2</p>
                                                <p className="mt-1 text-xs font-bold text-[#55565c]">Winners advance</p>
                                            </div>
                                            <div className="rounded-xl border border-[#ded5a1] bg-[#fbf9ef] px-4 py-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7b713e]">Finish</p>
                                                <p className="mt-1 text-xs font-black text-[#5c5536]">Final winner is champion</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-4">
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-semibold text-[#77787e]">
                                                <span><strong className="text-[#111114]">1.</strong> teams are seeded</span>
                                                <span><strong className="text-[#111114]">2.</strong> first-round byes fill unused slots</span>
                                                <span><strong className="text-[#111114]">3.</strong> winners advance automatically</span>
                                                <span><strong className="text-[#111114]">4.</strong> final winner is champion</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 5 CLASSIC */}
                        {!isVersus && step === 5 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={Trophy}
                                    eyebrow="05 / Points"
                                    title="Set the points table"
                                    description="Classic tournaments are decided by cumulative points across multiple matches. No bracket is used."
                                />

                                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                                    <div>
                                        <div className="mb-4 flex items-end justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-black">Placement points</p>
                                                <p className="mt-1 text-xs font-medium text-[#8a8b90]">
                                                    Enter the points awarded for each final placement.
                                                </p>
                                            </div>
                                            <div className="rounded-full border border-[#e0dfd0] bg-[#fbf9ef] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#736a3f]">
                                                {Object.keys(form.placementPoints).length} places configured
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                                            {Object.entries(form.placementPoints).map(([place, points]) => (
                                                <div key={place} className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                            #{place}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-[#b2b2b6]">pts</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={points}
                                                        onChange={(event) => updatePlacementPoints(place, event.target.value)}
                                                        className="mt-2 h-10 w-full rounded-lg border border-[#dddddf] bg-white px-3 text-sm font-black outline-none focus:border-[#111114]"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4">
                                            <p className="text-sm font-black">Kills</p>
                                            <p className="mt-1 text-[10px] font-semibold leading-5 text-[#85868c]">
                                                Fixed points awarded for each verified kill in a match.
                                            </p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={form.killPoints}
                                                    onChange={(event) => updateForm('killPoints', event.target.value)}
                                                    className="h-11 flex-1 rounded-xl border border-[#dddddf] bg-white px-3 text-sm font-black outline-none focus:border-[#111114]"
                                                />
                                                <span className="text-xs font-black text-[#77787e]">/ kill</span>
                                            </div>
                                        </div>

                                        <InfoBox>
                                            Each match contributes to one cumulative table. The final leaderboard is ordered by total points, then the tiebreakers below.
                                        </InfoBox>
                                    </div>
                                </div>

                                <div className="mt-8 border-t border-[#eeeeef] pt-8">
                                    <div className="mb-4">
                                        <p className="text-sm font-black">Leaderboard tiebreakers</p>
                                        <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-[#85868c]">
                                            Total Points is always the primary leaderboard value. When two teams finish on the same total, SYNCO checks these rules from top to bottom.
                                        </p>
                                    </div>

                                    <div className="grid gap-3">
                                        <div className="flex items-center gap-4 rounded-xl border border-[#dedee1] bg-[#111114] px-4 py-4 text-white">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-black">1</div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black">Total Points</p>
                                                <p className="mt-0.5 text-[10px] font-semibold text-white/60">
                                                    Always checked first. Higher total ranks higher.
                                                </p>
                                            </div>
                                            <Trophy size={17} className="text-[#d6c98a]" />
                                        </div>

                                        {form.tiebreakers.map((id, index) => {
                                            const option = TIEBREAKER_OPTIONS.find((item) => item.id === id);
                                            return (
                                                <div key={id} className="flex items-center gap-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#dedee1] bg-white text-xs font-black text-[#55565c]">
                                                        {index + 2}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-black">{option?.label || formatLabel(id)}</p>
                                                        <p className="mt-0.5 text-[10px] font-semibold leading-4 text-[#8a8b90]">
                                                            {option?.description || 'Higher value wins the tie.'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => moveTiebreaker(index, -1)}
                                                            disabled={index === 0}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dedee1] bg-white text-[#55565c] disabled:cursor-not-allowed disabled:opacity-30"
                                                            aria-label="Move tiebreaker up"
                                                        >
                                                            <ArrowUp size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => moveTiebreaker(index, 1)}
                                                            disabled={index === form.tiebreakers.length - 1}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dedee1] bg-white text-[#55565c] disabled:cursor-not-allowed disabled:opacity-30"
                                                            aria-label="Move tiebreaker down"
                                                        >
                                                            <ArrowDown size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a8b90]">
                                            Final ranking rule
                                        </p>
                                        <p className="mt-2 text-xs font-semibold leading-5 text-[#55565c]">
                                            Total Points → {form.tiebreakers.map((id) => TIEBREAKER_OPTIONS.find((item) => item.id === id)?.label).join(' → ')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 6 REVIEW */}
                        {step === 6 && (
                            <div className="p-6 sm:p-9">
                                <SectionHeader
                                    icon={Check}
                                    eyebrow="06 / Review"
                                    title="Review before publishing"
                                    description="The competition is created as a draft. You can then publish registration and manage participants from the organizer controls."
                                />

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-5 sm:col-span-2">
                                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a9ba0]">Competition</p>
                                        <p className="mt-1 text-lg font-black">{form.title || 'Untitled competition'}</p>
                                        <p className="mt-1 text-xs font-semibold text-[#85868c]">
                                            {selectedGame?.name || formatLabel(form.gameId)} · {formatLabel(form.gameMode)} · {formatLabel(form.competitionType)}
                                        </p>
                                    </div>

                                    <StatCard label="Teams" value={form.maxTeams} hint="Organizer limit" />
                                    <StatCard label="Team size" value={form.teamSize} hint="Players per team" />

                                    {isVersus ? (
                                        <>
                                            <StatCard label="Bracket slots" value={bracketPreview.stats.slots} hint={`${bracketPreview.stats.byes} automatic byes`} />
                                            <StatCard label="Matches" value={bracketPreview.stats.matches} hint="Minimum elimination matches" />
                                            <StatCard label="Seeding" value={formatLabel(form.seedingMethod)} hint="Applied when bracket is generated" />
                                            <StatCard label="Match length" value={`BO${form.bestOf}`} hint="Per pairing" />
                                        </>
                                    ) : (
                                        <>
                                            <StatCard label="Matches / team" value={form.numberOfMatches} hint="Points-stage matches" />
                                            <StatCard label="Kill points" value={form.killPoints} hint="Points per verified kill" />
                                        </>
                                    )}
                                </div>

                                {isVersus ? (
                                    <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">
                                        <p className="text-sm font-black">Bracket flow</p>
                                        <div className="mt-4 overflow-x-auto pb-2">
                                            <div className="flex min-w-max items-center gap-3">
                                                {bracketPreview.rounds.map((round, index) => (
                                                    <div key={index} className="flex items-center gap-3">
                                                        <div className="rounded-xl border border-[#dedee1] bg-white px-4 py-3 text-center">
                                                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a9ba0]">
                                                                {getRoundName(index + 1, bracketPreview.stats.rounds)}
                                                            </p>
                                                            <p className="mt-1 text-sm font-black">
                                                                {round.length} {round.length === 1 ? 'match' : 'matches'}
                                                            </p>
                                                        </div>
                                                        {index < bracketPreview.rounds.length - 1 && <ArrowRight size={15} className="text-[#aaaab0]" />}
                                                    </div>
                                                ))}
                                                <ArrowRight size={15} className="text-[#aaaab0]" />
                                                <div className="rounded-xl border border-[#ded5a1] bg-[#fbf9ef] px-4 py-3 text-center">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7b713e]">Champion</p>
                                                    <p className="mt-1 text-sm font-black text-[#5c5536]">1 winner</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">
                                        <p className="text-sm font-black">Leaderboard flow</p>
                                        <p className="mt-2 text-xs font-semibold leading-5 text-[#77787e]">
                                            Total Points → {form.tiebreakers.map((id) => TIEBREAKER_OPTIONS.find((item) => item.id === id)?.label).join(' → ')}
                                        </p>
                                    </div>
                                )}

                                <div className="mt-6">
                                    <InfoBox>
                                        {isVersus
                                            ? 'This is a structural preview. After registration closes, SYNCO generates the real bracket from the locked teams using the selected seeding and bye rules.'
                                            : 'Classic uses a points leaderboard only. SYNCO totals every verified match, then applies the saved tiebreaker order.'}
                                    </InfoBox>
                                </div>
                            </div>
                        )}

                        {/* FOOTER ACTIONS */}
                        <div className="flex flex-col-reverse gap-3 border-t border-[#eeeeef] bg-[#fafafa] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                            <button
                                type="button"
                                onClick={goBack}
                                disabled={step === 1 || creating}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dedee1] bg-white px-5 text-xs font-black text-[#4c4d52] transition hover:border-[#c9c9cc] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ArrowLeft size={15} />
                                Back
                            </button>

                            {step < 6 ? (
                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={creating}
                                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d6c98a] bg-[#d6c98a] px-6 text-xs font-black text-[#0b0e14] transition hover:border-[#c9bc79] hover:bg-[#c9bc79] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Continue
                                    <ArrowRight size={15} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={creating}
                                    className="flex h-11 min-w-[190px] items-center justify-center gap-2 rounded-xl border border-[#d6c98a] bg-[#d6c98a] px-6 text-xs font-black text-[#0b0e14] transition hover:border-[#c9bc79] hover:bg-[#c9bc79] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={15} />
                                            Create competition
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* SIDEBAR */}
                    <aside className="space-y-5 xl:sticky xl:top-[96px] xl:self-start">
                        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111114] text-white">
                                    <Gamepad2 size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{selectedGame?.name || formatLabel(form.gameId)}</p>
                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8b90]">
                                        {formatLabel(form.gameMode)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a8b90]">At a glance</p>
                            <div className="mt-4 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-semibold text-[#7a7b80]">Teams</span>
                                    <span className="text-xs font-black">{form.maxTeams}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-semibold text-[#7a7b80]">Team size</span>
                                    <span className="text-xs font-black">{form.teamSize}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-semibold text-[#7a7b80]">Structure</span>
                                    <span className="text-xs font-black">{isVersus ? 'Knockout' : 'Points'}</span>
                                </div>
                                {isVersus ? (
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold text-[#7a7b80]">Matches</span>
                                        <span className="text-xs font-black">{bracketPreview.stats.matches}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold text-[#7a7b80]">Matches / team</span>
                                        <span className="text-xs font-black">{form.numberOfMatches}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isVersus ? (
                            <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">
                                <div className="flex items-start gap-3">
                                    <Layers3 size={16} className="mt-0.5 shrink-0 text-[#8b7f45]" />
                                    <div>
                                        <p className="text-xs font-black">Bracket generation</p>
                                        <p className="mt-1 text-[11px] font-medium leading-5 text-[#85868c]">
                                            The preview helps the organizer understand the structure. The real bracket should be generated from locked teams after registration closes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">
                                <div className="flex items-start gap-3">
                                    <Trophy size={16} className="mt-0.5 shrink-0 text-[#8b7f45]" />
                                    <div>
                                        <p className="text-xs font-black">Leaderboard contract</p>
                                        <p className="mt-1 text-[11px] font-medium leading-5 text-[#85868c]">
                                            Total points are primary. The configured tiebreakers are applied in order for equal scores.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    );
};

export default CreateCompetition;
