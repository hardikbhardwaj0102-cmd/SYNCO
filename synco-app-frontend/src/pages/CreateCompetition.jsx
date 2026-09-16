import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    ChevronDown,
    Clock3,
    Gamepad2,
    Info,
    Layers3,
    Loader2,
    Plus,
    ShieldCheck,
    Swords,
    Trophy,
    Trash2,
    Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'https://synco-backend-vi7b.onrender.com';

const MAX_TEAMS = 25;

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

const INITIAL_POINT_RULES = [
    {
        id: 'placement',
        name: 'Placement',
        type: 'PLACEMENT',
        unit: 'per finish',
        points: 15,
        enabled: true,
    },
    {
        id: 'kill',
        name: 'Elimination / Kill',
        type: 'KILL',
        unit: 'per kill',
        points: 1,
        enabled: true,
    },
    {
        id: 'win',
        name: 'Match Win',
        type: 'WIN',
        unit: 'per win',
        points: 0,
        enabled: true,
    },
    {
        id: 'objective',
        name: 'Objective',
        type: 'OBJECTIVE',
        unit: 'per objective',
        points: 0,
        enabled: false,
    },
    {
        id: 'survival',
        name: 'Survival / Time',
        type: 'SURVIVAL',
        unit: 'per unit',
        points: 0,
        enabled: false,
    },
    {
        id: 'bonus',
        name: 'Bonus',
        type: 'BONUS',
        unit: 'flat bonus',
        points: 0,
        enabled: true,
    },
    {
        id: 'penalty',
        name: 'Penalty',
        type: 'PENALTY',
        unit: 'per event',
        points: 0,
        enabled: false,
    },
];

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

const getBracketSize = (teams) => {
    let size = 1;
    while (size < Number(teams || 0)) size *= 2;
    return size;
};

const getOrdinal = (position) => {
    const value = Number(position);
    if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`;
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] || 'th';
    return `${value}${suffix}`;
};

const SectionHeader = ({ icon: Icon, eyebrow, title, description }) => (
    <div className="mb-7 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black text-white">
            <Icon size={18} strokeWidth={2} />
        </div>
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8E96A3]">
                {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#111111]">
                {title}
            </h2>
            {description && (
                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#7D8592]">
                    {description}
                </p>
            )}
        </div>
    </div>
);

const FieldLabel = ({ children, required = false, hint }) => (
    <div className="mb-2 flex items-center justify-between gap-4">
        <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#373B42]">
            {children}
            {required && <span className="ml-1 text-[#D6C98A]">*</span>}
        </label>
        {hint && (
            <span className="text-[10px] font-semibold text-[#8E96A3]">{hint}</span>
        )}
    </div>
);

const inputClass =
    'h-12 w-full rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] px-4 text-sm font-semibold text-[#111111] outline-none transition placeholder:text-[#A3AAB5] focus:border-[#111111] focus:bg-white';

const textareaClass =
    'min-h-[120px] w-full resize-none rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] px-4 py-3 text-sm font-semibold leading-6 text-[#111111] outline-none transition placeholder:text-[#A3AAB5] focus:border-[#111111] focus:bg-white';

const selectClass =
    'h-12 w-full appearance-none rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] px-4 pr-10 text-sm font-semibold text-[#111111] outline-none transition focus:border-[#111111] focus:bg-white';

const StepPill = ({ number, title, active, complete }) => (
    <div className={`flex items-center gap-2 ${active ? 'text-[#111111]' : 'text-[#A0A6AF]'}`}>
        <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${complete
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : active
                        ? 'border-[#111111] bg-white text-[#111111]'
                        : 'border-[#D9DDE3] bg-white text-[#A0A6AF]'
                }`}
        >
            {complete ? <Check size={14} strokeWidth={3} /> : number}
        </div>
        <span className="hidden text-[10px] font-black uppercase tracking-[0.12em] lg:block">
            {title}
        </span>
    </div>
);

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
        registrationStart: getDefaultRegistrationStart(),
        registrationEnd: getDefaultRegistrationEnd(),
        competitionStart: getDefaultCompetitionStart(),
        competitionEnd: getDefaultCompetitionEnd(),
        competitionRules: '',
        matchRules: '',
        eligibilityRules: '',
    });

    const [bracket, setBracket] = useState({
        type: 'SINGLE_ELIMINATION',
        seeding: 'RANDOM',
        allowByes: true,
        autoGenerateAfterRegistration: true,
        bestOf: 1,
        thirdPlaceMatch: false,
    });

    const [pointsTable, setPointsTable] = useState({
        placementPoints: { ...DEFAULT_PLACEMENT_POINTS },
        killPoints: 1,
        bonusPoints: 0,
        rules: INITIAL_POINT_RULES,
        maxPointsPerMatch: '',
        tiebreakers: ['TOTAL_POINTS', 'PLACEMENT_POINTS', 'KILLS'],
    });

    useEffect(() => {
        const loadConfiguration = async () => {
            try {
                setLoadingConfig(true);
                const response = await fetch(`${API_URL}/api/competitions/config`, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    credentials: 'include',
                    cache: 'no-store',
                });
                const data = await response.json();

                if (response.ok && data?.success) {
                    if (data?.games) setGames(data.games);
                    if (data?.config) setConfig(data.config);
                    else if (data?.games) setConfig(data.games);
                }

                try {
                    const gamesResponse = await fetch(`${API_URL}/api/games`, {
                        credentials: 'include',
                        headers: { Accept: 'application/json' },
                        cache: 'no-store',
                    });
                    if (gamesResponse.ok) {
                        const gamesData = await gamesResponse.json();
                        if (Array.isArray(gamesData?.games) && gamesData.games.length) {
                            setGames(gamesData.games);
                        }
                    }
                } catch (gamesError) {
                    console.error('Games fallback failed:', gamesError);
                }
            } catch (loadError) {
                console.error('Competition config load failed:', loadError);
            } finally {
                setLoadingConfig(false);
            }
        };
        loadConfiguration();
    }, []);

    const availableGames = useMemo(() => {
        if (Array.isArray(games) && games.length) return games;
        if (games && typeof games === 'object') {
            return Object.entries(games).map(([id, gameConfig]) => ({
                id,
                name: gameConfig?.game_names?.[0] || formatLabel(id),
                ...gameConfig,
            }));
        }
        return Object.entries(config || {}).map(([id, gameConfig]) => ({
            id,
            name: gameConfig?.game_names?.[0] || formatLabel(id),
            ...gameConfig,
        }));
    }, [games, config]);

    const selectedGame = useMemo(() => {
        return (
            availableGames.find((game) => String(game.id) === String(form.gameId)) || {
                id: form.gameId,
                name:
                    config?.[slugifyGame(form.gameId)]?.game_names?.[0] ||
                    formatLabel(form.gameId),
            }
        );
    }, [availableGames, config, form.gameId]);

    const gameConfig = useMemo(() => {
        const slug = slugifyGame(selectedGame?.slug || selectedGame?.name || form.gameId);
        return config?.[slug] || config?.[form.gameId] || FALLBACK_CONFIG[slug] || FALLBACK_CONFIG[form.gameId] || null;
    }, [config, selectedGame, form.gameId]);

    const availableModes = useMemo(() => {
        if (!gameConfig?.modes) return [];
        return Object.entries(gameConfig.modes).map(([id, mode]) => ({ id, ...mode }));
    }, [gameConfig]);

    const selectedMode = useMemo(
        () => availableModes.find((mode) => mode.id === form.gameMode) || availableModes[0] || null,
        [availableModes, form.gameMode]
    );

    const bracketPreview = useMemo(() => {
        const maxTeams = Math.max(2, Math.min(MAX_TEAMS, Number(form.maxTeams) || 2));
        const bracketSize = getBracketSize(maxTeams);
        const rounds = Math.log2(bracketSize);
        const byes = Math.max(0, bracketSize - maxTeams);
        const firstRoundMatches = bracketSize / 2;
        const totalMatches = bracketSize - 1;
        return { maxTeams, bracketSize, rounds, byes, firstRoundMatches, totalMatches };
    }, [form.maxTeams]);

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
        setSuccessMessage('');
    };

    const handleGameChange = (gameId) => {
        const game = availableGames.find((item) => String(item.id) === String(gameId)) || {
            id: gameId,
            name: formatLabel(gameId),
        };
        const slug = slugifyGame(game.slug || game.name || gameId);
        const nextConfig = config?.[slug] || config?.[gameId] || FALLBACK_CONFIG[slug] || FALLBACK_CONFIG[gameId];
        const nextModes = nextConfig?.modes ? Object.entries(nextConfig.modes) : [];
        const firstMode = nextModes[0];
        const modeId = firstMode?.[0] || '';
        const modeConfig = firstMode?.[1] || null;
        const nextTeamSizes = modeConfig?.team_sizes || [1];
        const nextTeamSize = nextTeamSizes.includes(Number(form.teamSize)) ? Number(form.teamSize) : nextTeamSizes[0];
        const nextType = modeConfig?.type || 'VERSUS';

        setForm((previous) => ({
            ...previous,
            gameId,
            gameMode: modeId,
            competitionType: nextType,
            participantType: modeConfig?.participant_type || 'TEAM',
            teamSize: nextTeamSize,
            numberOfMatches: modeConfig?.default_matches || 1,
        }));
        setError('');
    };

    const handleModeChange = (modeId) => {
        const mode = availableModes.find((item) => item.id === modeId);
        if (!mode) return;
        const teamSizes = mode.team_sizes || [1];
        const teamSize = teamSizes.includes(Number(form.teamSize)) ? Number(form.teamSize) : teamSizes[0];
        const isClassic = mode.type === 'CLASSIC';

        setForm((previous) => ({
            ...previous,
            gameMode: modeId,
            competitionType: mode.type,
            participantType: mode.participant_type || 'TEAM',
            teamSize,
            numberOfMatches: isClassic ? mode.default_matches || 1 : 1,
        }));
        setError('');
    };

    const updatePlacementPoints = (position, value) => {
        setPointsTable((previous) => ({
            ...previous,
            placementPoints: {
                ...previous.placementPoints,
                [position]: Math.max(0, Number(value) || 0),
            },
        }));
        setError('');
    };

    const updatePointRule = (id, field, value) => {
        setPointsTable((previous) => ({
            ...previous,
            rules: previous.rules.map((rule) =>
                rule.id === id
                    ? {
                        ...rule,
                        [field]: field === 'points' ? Math.max(0, Number(value) || 0) : value,
                    }
                    : rule
            ),
        }));
        setError('');
    };

    const addPointRule = () => {
        setPointsTable((previous) => ({
            ...previous,
            rules: [
                ...previous.rules,
                {
                    id: `custom-${Date.now()}`,
                    name: 'Custom rule',
                    type: 'CUSTOM',
                    unit: 'per event',
                    points: 0,
                    enabled: true,
                },
            ],
        }));
    };

    const removePointRule = (id) => {
        setPointsTable((previous) => ({
            ...previous,
            rules: previous.rules.filter((rule) => rule.id !== id),
        }));
    };

    const toggleTiebreaker = (key) => {
        setPointsTable((previous) => {
            const exists = previous.tiebreakers.includes(key);
            if (exists) {
                return {
                    ...previous,
                    tiebreakers: previous.tiebreakers.filter((item) => item !== key),
                };
            }
            return { ...previous, tiebreakers: [...previous.tiebreakers, key] };
        });
    };

    const validateStep = (currentStep) => {
        setError('');

        if (currentStep === 1) {
            if (!form.title.trim()) {
                setError('Competition name is required.');
                return false;
            }
            if (form.title.trim().length < 3) {
                setError('Competition name must contain at least 3 characters.');
                return false;
            }
            if (!form.gameId || !form.gameMode) {
                setError('Select a game and competition format.');
                return false;
            }
            return true;
        }

        if (currentStep === 2) {
            const teamSize = Number(form.teamSize);
            const maxTeams = Number(form.maxTeams);
            const numberOfMatches = Number(form.numberOfMatches);
            const allowedSizes = selectedMode?.team_sizes || [];

            if (!allowedSizes.includes(teamSize)) {
                setError(`Team size must be one of: ${allowedSizes.join(', ')}.`);
                return false;
            }
            if (maxTeams < 2 || maxTeams > MAX_TEAMS) {
                setError(`Maximum teams must be between 2 and ${MAX_TEAMS}.`);
                return false;
            }
            if (form.competitionType === 'CLASSIC' && numberOfMatches < 1) {
                setError('Classic competitions require at least one match.');
                return false;
            }
            return true;
        }

        if (currentStep === 3) {
            const registrationStart = new Date(form.registrationStart);
            const registrationEnd = new Date(form.registrationEnd);
            const competitionStart = new Date(form.competitionStart);
            const competitionEnd = new Date(form.competitionEnd);
            if ([registrationStart, registrationEnd, competitionStart, competitionEnd].some((date) => Number.isNaN(date.getTime()))) {
                setError('Please provide all competition dates.');
                return false;
            }
            if (registrationEnd <= registrationStart) {
                setError('Registration end must be after registration start.');
                return false;
            }
            if (competitionStart < registrationEnd) {
                setError('Competition start must be on or after registration end.');
                return false;
            }
            if (competitionEnd <= competitionStart) {
                setError('Competition end must be after competition start.');
                return false;
            }
            return true;
        }

        if (currentStep === 4) {
            if (!form.competitionRules.trim()) {
                setError('Add at least the main competition rules.');
                return false;
            }
            return true;
        }

        if (currentStep === 5) {
            if (form.competitionType === 'VERSUS') {
                if (!['SINGLE_ELIMINATION'].includes(bracket.type)) {
                    setError('The current tournament engine supports single elimination brackets.');
                    return false;
                }
                if (bracketPreview.maxTeams < 2) {
                    setError('A bracket needs at least 2 teams.');
                    return false;
                }
                if (bracket.bestOf < 1 || bracket.bestOf % 2 === 0) {
                    setError('Best-of must be an odd number such as 1, 3, or 5.');
                    return false;
                }
            }
            return true;
        }

        if (currentStep === 6) {
            if (form.competitionType === 'CLASSIC') {
                if (!pointsTable.tiebreakers.length) {
                    setError('Select at least one tiebreaker.');
                    return false;
                }
                if (Object.values(pointsTable.placementPoints).some((value) => Number(value) < 0)) {
                    setError('Point values cannot be negative.');
                    return false;
                }
            }
            return true;
        }

        return true;
    };

    const handleNext = () => {
        if (!validateStep(step)) return;
        setStep((previous) => Math.min(previous + 1, 7));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBack = () => {
        setError('');
        setStep((previous) => Math.max(previous - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCreate = async () => {
        for (let current = 1; current <= 6; current += 1) {
            if (!validateStep(current)) {
                setStep(current);
                return;
            }
        }

        setCreating(true);
        setError('');
        setSuccessMessage('');

        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                gameId: form.gameId,
                competitionType: form.competitionType,
                gameMode: form.gameMode,
                participantType: 'TEAM',
                teamSize: Number(form.teamSize),
                // Backward-compatible database field. Internally this represents team count.
                maxParticipants: Number(form.maxTeams),
                numberOfMatches: form.competitionType === 'VERSUS' ? 1 : Number(form.numberOfMatches),
                configuration: {
                    structure: selectedMode?.structure || null,
                    maxTeams: Number(form.maxTeams),
                    bracket:
                        form.competitionType === 'VERSUS'
                            ? {
                                ...bracket,
                                bracketSize: bracketPreview.bracketSize,
                                expectedByes: bracketPreview.byes,
                                expectedRounds: bracketPreview.rounds,
                                firstRoundMatches: bracketPreview.firstRoundMatches,
                                totalMatches: bracketPreview.totalMatches,
                            }
                            : null,
                    scoring:
                        form.competitionType === 'CLASSIC'
                            ? {
                                placementPoints: pointsTable.placementPoints,
                                killPoints: Number(pointsTable.killPoints) || 0,
                                bonusPoints: Number(pointsTable.bonusPoints) || 0,
                                rules: pointsTable.rules,
                                maxPointsPerMatch:
                                    pointsTable.maxPointsPerMatch === ''
                                        ? null
                                        : Number(pointsTable.maxPointsPerMatch),
                                tiebreakers: pointsTable.tiebreakers,
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

            setTimeout(() => {
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

    const stepTitle = {
        1: 'Competition basics',
        2: 'Format & teams',
        3: 'Schedule',
        4: 'Rules & governance',
        5: 'Bracket setup',
        6: 'Points table',
        7: 'Review',
    }[step];

    return (
        <div className="min-h-screen bg-[#F4F5F7] text-[#111111]">
            <div className="sticky top-0 z-40 border-b border-[#E0E3E8] bg-white/95 backdrop-blur">
                <div className="mx-auto flex min-h-[72px] max-w-[1400px] items-center justify-between gap-5 px-5 py-3 lg:px-8">
                    <button
                        type="button"
                        onClick={() => navigate('/competitions')}
                        className="group flex items-center gap-3"
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#000000] text-white transition group-hover:bg-[#171717]">
                            <ArrowLeft size={16} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8E96A3]">
                                SYNCO
                            </p>
                            <p className="text-sm font-black tracking-tight">Create Tournament</p>
                        </div>
                    </button>

                    <div className="hidden items-center gap-3 xl:flex">
                        {[
                            ['1', 'Basics'],
                            ['2', 'Teams'],
                            ['3', 'Schedule'],
                            ['4', 'Rules'],
                            ['5', 'Bracket'],
                            ['6', 'Points'],
                            ['7', 'Review'],
                        ].map(([number, title], index) => (
                            <div key={number} className="flex items-center gap-3">
                                <StepPill
                                    number={number}
                                    title={title}
                                    active={step === Number(number)}
                                    complete={step > Number(number)}
                                />
                                {index < 6 && <div className="h-px w-5 bg-[#DDE1E6]" />}
                            </div>
                        ))}
                    </div>

                    <div className="hidden rounded-full border border-[#E0E3E8] bg-[#FAFBFC] px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#6F7783] sm:block">
                        Organizer
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#B4A86F]">
                        <Swords size={13} />
                        Competition Engine
                    </div>
                    <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                        <div>
                            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">{stepTitle}</h1>
                            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#7D8592]">
                                Build the tournament structure, rules, bracket logic, and scoring before publishing it to players.
                            </p>
                        </div>
                        <div className="rounded-xl border border-[#E0E3E8] bg-white px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8E96A3]">
                                Current format
                            </p>
                            <p className="mt-1 text-sm font-black">
                                {formatLabel(form.competitionType)}
                                <span className="mx-2 text-[#C5CBD3]">/</span>
                                {formatLabel(form.gameMode)}
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#D9DDE3] bg-white px-4 py-3 text-sm font-semibold text-[#3D434B]">
                        <Info size={17} className="mt-0.5 shrink-0 text-[#B4A86F]" />
                        <p>{error}</p>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#D9DDE3] bg-white px-4 py-3 text-sm font-semibold text-[#30353B]">
                        <Check size={17} className="mt-0.5 shrink-0 text-[#B4A86F]" />
                        <p>{successMessage}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="overflow-hidden rounded-2xl border border-[#E0E3E8] bg-white">
                        {step === 1 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={Trophy}
                                    eyebrow="01 / Identity"
                                    title="Competition basics"
                                    description="Give the tournament a clear identity and connect it to a supported game and format."
                                />
                                <div className="space-y-6">
                                    <div>
                                        <FieldLabel required>Competition name</FieldLabel>
                                        <input
                                            type="text"
                                            value={form.title}
                                            onChange={(event) => updateField('title', event.target.value)}
                                            placeholder="e.g. SYNCO BGMI Open #1"
                                            maxLength={100}
                                            className={inputClass}
                                        />
                                        <div className="mt-2 flex justify-between text-[10px] font-semibold text-[#8E96A3]">
                                            <span>Use a name players can recognize immediately.</span>
                                            <span>{form.title.length}/100</span>
                                        </div>
                                    </div>

                                    <div>
                                        <FieldLabel>Description</FieldLabel>
                                        <textarea
                                            value={form.description}
                                            onChange={(event) => updateField('description', event.target.value)}
                                            placeholder="Describe what players should expect from this tournament."
                                            maxLength={500}
                                            className={textareaClass}
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel required>Game</FieldLabel>
                                        {loadingConfig ? (
                                            <div className="flex h-12 items-center gap-2 rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] px-4 text-sm font-semibold text-[#8E96A3]">
                                                <Loader2 size={16} className="animate-spin" />
                                                Loading games...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                                {availableGames.map((game) => {
                                                    const selected = String(form.gameId) === String(game.id);
                                                    return (
                                                        <button
                                                            key={game.id}
                                                            type="button"
                                                            onClick={() => handleGameChange(game.id)}
                                                            className={`rounded-xl border p-4 text-left transition ${selected
                                                                    ? 'border-[#000000] bg-[#000000] text-white'
                                                                    : 'border-[#E0E3E8] bg-[#FAFBFC] hover:border-[#BFC5CC] hover:bg-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? 'bg-white/10' : 'border border-[#E5E8EC] bg-white'}`}>
                                                                    <Gamepad2 size={17} />
                                                                </div>
                                                                {selected && (
                                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                                                                        <Check size={12} strokeWidth={3} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="mt-4 text-sm font-black">{game.name}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <FieldLabel required>Competition format</FieldLabel>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {availableModes.map((mode) => {
                                                const selected = form.gameMode === mode.id;
                                                return (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => handleModeChange(mode.id)}
                                                        className={`rounded-xl border p-5 text-left transition ${selected
                                                                ? 'border-[#000000] bg-[#000000] text-white'
                                                                : 'border-[#E0E3E8] bg-[#FAFBFC] hover:border-[#BFC5CC] hover:bg-white'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <p className="text-sm font-black">{formatLabel(mode.id)}</p>
                                                                <p className={`mt-1 text-xs font-semibold ${selected ? 'text-white/60' : 'text-[#8E96A3]'}`}>
                                                                    {formatLabel(mode.type)} · {formatLabel(mode.structure)}
                                                                </p>
                                                            </div>
                                                            {selected && <Check size={18} strokeWidth={3} />}
                                                        </div>
                                                        <div className={`mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] ${selected ? 'text-white/60' : 'text-[#8E96A3]'}`}>
                                                            <Users size={12} />
                                                            {(mode.team_sizes || []).join(' / ')} team sizes
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={Users}
                                    eyebrow="02 / Structure"
                                    title="Format & teams"
                                    description="Tournament capacity is defined by teams. The organiser can accept up to 25 teams."
                                />

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <FieldLabel>Participant type</FieldLabel>
                                            <div className="flex h-12 items-center justify-between rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] px-4">
                                                <span className="text-sm font-bold">Teams</span>
                                                <span className="rounded-full border border-[#D9DDE3] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#6F7783]">
                                                    Fixed by game format
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <FieldLabel>Team size</FieldLabel>
                                            <div className="relative">
                                                <select
                                                    value={form.teamSize}
                                                    onChange={(event) => updateField('teamSize', Number(event.target.value))}
                                                    className={selectClass}
                                                >
                                                    {(selectedMode?.team_sizes || [1]).map((size) => (
                                                        <option key={size} value={size}>
                                                            {size} {size === 1 ? 'Player' : 'Players'}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8E96A3]" />
                                            </div>
                                        </div>

                                        <div>
                                            <FieldLabel required hint={`2–${MAX_TEAMS}`}>
                                                Maximum teams
                                            </FieldLabel>
                                            <input
                                                type="number"
                                                min="2"
                                                max={MAX_TEAMS}
                                                value={form.maxTeams}
                                                onChange={(event) => updateField('maxTeams', Math.min(MAX_TEAMS, Math.max(2, Number(event.target.value) || 2)))}
                                                className={inputClass}
                                            />
                                            <p className="mt-2 text-[10px] font-semibold text-[#8E96A3]">
                                                This controls tournament capacity. Team count is used to initialise the bracket.
                                            </p>
                                        </div>

                                        <div>
                                            <FieldLabel hint={form.competitionType === 'VERSUS' ? 'Fixed at 1' : 'Minimum 1'}>
                                                Number of matches
                                            </FieldLabel>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                disabled={form.competitionType === 'VERSUS'}
                                                value={form.numberOfMatches}
                                                onChange={(event) => updateField('numberOfMatches', Number(event.target.value))}
                                                className={`${inputClass} ${form.competitionType === 'VERSUS' ? 'cursor-not-allowed opacity-50' : ''}`}
                                            />
                                            <p className="mt-2 text-[10px] font-semibold text-[#8E96A3]">
                                                {form.competitionType === 'VERSUS'
                                                    ? 'Knockout uses the bracket to determine match count.'
                                                    : 'Classic tournaments can accumulate points over multiple matches.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#000000] text-white">
                                                <Layers3 size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#8E96A3]">Tournament structure</p>
                                                <p className="mt-1 text-sm font-black">{formatLabel(selectedMode?.structure)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            {[
                                                ['Maximum teams', form.maxTeams],
                                                ['Team size', form.teamSize],
                                                ['Matches', form.numberOfMatches],
                                                ['Format', formatLabel(form.competitionType)],
                                            ].map(([label, value]) => (
                                                <div key={label} className="rounded-xl border border-[#E3E6EA] bg-white p-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8E96A3]">{label}</p>
                                                    <p className="mt-1 text-sm font-black">{value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={CalendarDays}
                                    eyebrow="03 / Timing"
                                    title="Competition schedule"
                                    description="Create a real registration window and a defined tournament runtime."
                                />
                                <div className="space-y-8">
                                    <div>
                                        <div className="mb-4 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-[#D6C98A]" />
                                            <h3 className="text-xs font-black uppercase tracking-[0.14em]">Registration window</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <div>
                                                <FieldLabel required>Registration starts</FieldLabel>
                                                <input type="datetime-local" value={form.registrationStart} onChange={(event) => updateField('registrationStart', event.target.value)} className={inputClass} />
                                            </div>
                                            <div>
                                                <FieldLabel required>Registration ends</FieldLabel>
                                                <input type="datetime-local" value={form.registrationEnd} onChange={(event) => updateField('registrationEnd', event.target.value)} className={inputClass} />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-4 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-[#D6C98A]" />
                                            <h3 className="text-xs font-black uppercase tracking-[0.14em]">Competition window</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <div>
                                                <FieldLabel required>Competition starts</FieldLabel>
                                                <input type="datetime-local" value={form.competitionStart} onChange={(event) => updateField('competitionStart', event.target.value)} className={inputClass} />
                                            </div>
                                            <div>
                                                <FieldLabel required>Competition ends</FieldLabel>
                                                <input type="datetime-local" value={form.competitionEnd} onChange={(event) => updateField('competitionEnd', event.target.value)} className={inputClass} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-5">
                                        <div className="flex items-center gap-3">
                                            <Clock3 size={17} className="text-[#B4A86F]" />
                                            <div>
                                                <p className="text-sm font-black">Competition timeline</p>
                                                <p className="mt-1 text-xs font-medium text-[#7D8592]">Registration closes before competitive play begins.</p>
                                            </div>
                                        </div>
                                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4">
                                            {[
                                                ['Registration', 'Opens', form.registrationStart],
                                                ['Registration', 'Closes', form.registrationEnd],
                                                ['Competition', 'Starts', form.competitionStart],
                                                ['Competition', 'Ends', form.competitionEnd],
                                            ].map(([label, sublabel, value]) => (
                                                <div key={`${label}-${sublabel}`} className="rounded-xl border border-[#E3E6EA] bg-white p-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8E96A3]">{label}</p>
                                                    <p className="mt-1 text-xs font-bold">{sublabel}</p>
                                                    <p className="mt-2 text-[11px] font-semibold text-[#7D8592]">{value.replace('T', ' ')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={ShieldCheck}
                                    eyebrow="04 / Governance"
                                    title="Rules & governance"
                                    description="Define the rules that govern player behaviour, match handling, and eligibility."
                                />
                                <div className="space-y-6">
                                    <div>
                                        <FieldLabel required>Competition rules</FieldLabel>
                                        <textarea
                                            value={form.competitionRules}
                                            onChange={(event) => updateField('competitionRules', event.target.value)}
                                            placeholder={`Example:\n• Players must use their registered SYNCO account.\n• No cheating, exploits, or unauthorized software.\n• Match results must be submitted within the allowed window.\n• Organizer decisions follow the published tournament rules.`}
                                            className={textareaClass}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Match rules</FieldLabel>
                                        <textarea
                                            value={form.matchRules}
                                            onChange={(event) => updateField('matchRules', event.target.value)}
                                            placeholder="Lobby rules, maps, room settings, side selection, result submission, and rematch conditions."
                                            className={textareaClass}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Eligibility</FieldLabel>
                                        <textarea
                                            value={form.eligibilityRules}
                                            onChange={(event) => updateField('eligibilityRules', event.target.value)}
                                            placeholder="Region restrictions, age requirements, account requirements, rank requirements, or invite-only conditions."
                                            className={textareaClass}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={Swords}
                                    eyebrow="05 / Bracket engine"
                                    title="Bracket setup"
                                    description="Configure how knockout matches will be initialized when registration closes. The helper calculates the bracket shape from team capacity."
                                />

                                {form.competitionType === 'VERSUS' ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <div>
                                                <FieldLabel>Bracket type</FieldLabel>
                                                <div className="relative">
                                                    <select value={bracket.type} onChange={(event) => setBracket((previous) => ({ ...previous, type: event.target.value }))} className={selectClass}>
                                                        <option value="SINGLE_ELIMINATION">Single Elimination</option>
                                                    </select>
                                                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8E96A3]" />
                                                </div>
                                            </div>

                                            <div>
                                                <FieldLabel>Seeding method</FieldLabel>
                                                <div className="relative">
                                                    <select value={bracket.seeding} onChange={(event) => setBracket((previous) => ({ ...previous, seeding: event.target.value }))} className={selectClass}>
                                                        <option value="RANDOM">Random</option>
                                                        <option value="RANKING">Ranking based</option>
                                                        <option value="ORGANIZER">Organizer assigned</option>
                                                    </select>
                                                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8E96A3]" />
                                                </div>
                                            </div>

                                            <div>
                                                <FieldLabel hint="1, 3, 5">Match series</FieldLabel>
                                                <div className="relative">
                                                    <select value={bracket.bestOf} onChange={(event) => setBracket((previous) => ({ ...previous, bestOf: Number(event.target.value) }))} className={selectClass}>
                                                        <option value="1">Best of 1</option>
                                                        <option value="3">Best of 3</option>
                                                        <option value="5">Best of 5</option>
                                                    </select>
                                                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8E96A3]" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B4A86F]">Initialization helper</p>
                                                    <h3 className="mt-1 text-base font-black">{bracketPreview.maxTeams}-team bracket plan</h3>
                                                    <p className="mt-1 text-xs font-medium leading-5 text-[#7D8592]">
                                                        The live bracket should be generated from the teams actually locked into the tournament at registration close. These values are the pre-registration bracket shape.
                                                    </p>
                                                </div>
                                                <div className="rounded-full border border-[#D9DDE3] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#6F7783]">
                                                    {bracket.allowByes ? 'Byes allowed' : 'No byes'}
                                                </div>
                                            </div>

                                            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                                {[
                                                    ['Capacity', bracketPreview.maxTeams],
                                                    ['Bracket size', bracketPreview.bracketSize],
                                                    ['Byes', bracketPreview.byes],
                                                    ['Rounds', bracketPreview.rounds],
                                                    ['Total matches', bracketPreview.totalMatches],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="rounded-xl border border-[#E3E6EA] bg-white p-4">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8E96A3]">{label}</p>
                                                        <p className="mt-1 text-lg font-black">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => setBracket((previous) => ({ ...previous, allowByes: !previous.allowByes }))}
                                                className="flex items-center justify-between rounded-xl border border-[#E0E3E8] bg-white p-4 text-left"
                                            >
                                                <div>
                                                    <p className="text-xs font-black">Allow automatic byes</p>
                                                    <p className="mt-1 text-[10px] font-semibold text-[#8E96A3]">Required when team capacity is not a power of two.</p>
                                                </div>
                                                <div className={`flex h-6 w-10 items-center rounded-full p-1 transition ${bracket.allowByes ? 'bg-[#111111]' : 'bg-[#D9DDE3]'}`}>
                                                    <div className={`h-4 w-4 rounded-full bg-white transition ${bracket.allowByes ? 'translate-x-4' : ''}`} />
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setBracket((previous) => ({ ...previous, autoGenerateAfterRegistration: !previous.autoGenerateAfterRegistration }))}
                                                className="flex items-center justify-between rounded-xl border border-[#E0E3E8] bg-white p-4 text-left"
                                            >
                                                <div>
                                                    <p className="text-xs font-black">Generate from locked teams</p>
                                                    <p className="mt-1 text-[10px] font-semibold text-[#8E96A3]">Avoids creating empty live matches before registration closes.</p>
                                                </div>
                                                <div className={`flex h-6 w-10 items-center rounded-full p-1 transition ${bracket.autoGenerateAfterRegistration ? 'bg-[#111111]' : 'bg-[#D9DDE3]'}`}>
                                                    <div className={`h-4 w-4 rounded-full bg-white transition ${bracket.autoGenerateAfterRegistration ? 'translate-x-4' : ''}`} />
                                                </div>
                                            </button>
                                        </div>

                                        <div className="flex items-start gap-3 rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] p-4">
                                            <Info size={16} className="mt-0.5 shrink-0 text-[#B4A86F]" />
                                            <p className="text-xs font-medium leading-5 text-[#68707C]">
                                                Example: 25 teams initialise to a 32-slot single-elimination bracket, which creates 7 byes, 5 rounds, and 31 bracket matches. Actual match participants should be populated from the locked tournament teams.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-6">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#000000] text-white">
                                                <Layers3 size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black">Bracket not used for this format</p>
                                                <p className="mt-1 text-xs font-medium leading-5 text-[#7D8592]">
                                                    Classic competitions use cumulative points and the points table instead of a knockout bracket. You can continue to the points configuration.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 6 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={Trophy}
                                    eyebrow="06 / Scoring engine"
                                    title="Points table"
                                    description="Predefine exactly how teams earn, lose, and break ties on the leaderboard."
                                />

                                {form.competitionType === 'CLASSIC' ? (
                                    <div className="space-y-6">
                                        <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B4A86F]">Placement</p>
                                                    <h3 className="mt-1 text-base font-black">Position points</h3>
                                                    <p className="mt-1 text-xs font-medium leading-5 text-[#7D8592]">Define the base points awarded for each final placement in a match.</p>
                                                </div>
                                                <Trophy size={20} className="text-[#B4A86F]" />
                                            </div>
                                            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                                {Object.entries(pointsTable.placementPoints).map(([position, points]) => (
                                                    <div key={position} className="rounded-xl border border-[#E0E3E8] bg-white p-3">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">{getOrdinal(position)}</p>
                                                        <input type="number" min="0" value={points} onChange={(event) => updatePlacementPoints(position, event.target.value)} className="mt-2 h-9 w-full rounded-lg border border-[#E4E7EB] bg-[#FAFBFC] px-2 text-sm font-black outline-none focus:border-[#111111]" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                            <div>
                                                <FieldLabel hint="per kill">Kill points</FieldLabel>
                                                <input type="number" min="0" value={pointsTable.killPoints} onChange={(event) => setPointsTable((previous) => ({ ...previous, killPoints: Math.max(0, Number(event.target.value) || 0) }))} className={inputClass} />
                                            </div>
                                            <div>
                                                <FieldLabel hint="flat">Default bonus</FieldLabel>
                                                <input type="number" min="0" value={pointsTable.bonusPoints} onChange={(event) => setPointsTable((previous) => ({ ...previous, bonusPoints: Math.max(0, Number(event.target.value) || 0) }))} className={inputClass} />
                                            </div>
                                            <div>
                                                <FieldLabel hint="optional">Points cap / match</FieldLabel>
                                                <input type="number" min="0" value={pointsTable.maxPointsPerMatch} onChange={(event) => setPointsTable((previous) => ({ ...previous, maxPointsPerMatch: event.target.value }))} placeholder="No cap" className={inputClass} />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-black">Scoring events</p>
                                                    <p className="mt-1 text-xs font-medium text-[#7D8592]">Keep the rules explicit so result entry and standings can use the same contract.</p>
                                                </div>
                                                <button type="button" onClick={addPointRule} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#000000] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                                                    <Plus size={13} />
                                                    Add rule
                                                </button>
                                            </div>

                                            <div className="mt-5 space-y-3">
                                                {pointsTable.rules.map((rule) => (
                                                    <div key={rule.id} className="grid grid-cols-[minmax(0,1.3fr)_120px_90px_36px] items-center gap-3 rounded-xl border border-[#E3E6EA] bg-[#FAFBFC] p-3">
                                                        <div>
                                                            <input
                                                                type="text"
                                                                value={rule.name}
                                                                onChange={(event) => updatePointRule(rule.id, 'name', event.target.value)}
                                                                className="h-9 w-full rounded-lg border border-[#E0E3E8] bg-white px-3 text-xs font-black outline-none focus:border-[#111111]"
                                                            />
                                                            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8E96A3]">{formatLabel(rule.type)} · {rule.unit}</p>
                                                        </div>
                                                        <select value={rule.type} onChange={(event) => updatePointRule(rule.id, 'type', event.target.value)} className="h-9 rounded-lg border border-[#E0E3E8] bg-white px-2 text-[10px] font-black outline-none">
                                                            <option value="PLACEMENT">Placement</option>
                                                            <option value="KILL">Kill</option>
                                                            <option value="WIN">Win</option>
                                                            <option value="OBJECTIVE">Objective</option>
                                                            <option value="SURVIVAL">Survival</option>
                                                            <option value="BONUS">Bonus</option>
                                                            <option value="PENALTY">Penalty</option>
                                                            <option value="CUSTOM">Custom</option>
                                                        </select>
                                                        <input type="number" min="0" value={rule.points} onChange={(event) => updatePointRule(rule.id, 'points', event.target.value)} className="h-9 rounded-lg border border-[#E0E3E8] bg-white px-2 text-xs font-black outline-none focus:border-[#111111]" />
                                                        <button type="button" onClick={() => removePointRule(rule.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0E3E8] bg-white text-[#7D8592] transition hover:bg-[#F4F5F7]">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-5">
                                            <div>
                                                <p className="text-sm font-black">Leaderboard tiebreakers</p>
                                                <p className="mt-1 text-xs font-medium text-[#7D8592]">Select the order used when teams have the same total points.</p>
                                            </div>
                                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                {[
                                                    ['TOTAL_POINTS', 'Total points'],
                                                    ['PLACEMENT_POINTS', 'Placement points'],
                                                    ['KILLS', 'Kills'],
                                                    ['WINS', 'Match wins'],
                                                ].map(([key, label]) => {
                                                    const selected = pointsTable.tiebreakers.includes(key);
                                                    return (
                                                        <button key={key} type="button" onClick={() => toggleTiebreaker(key)} className={`rounded-xl border p-3 text-left ${selected ? 'border-[#000000] bg-white' : 'border-[#E0E3E8] bg-[#FFFFFF]'}`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-[#000000] text-white' : 'border border-[#D9DDE3] text-transparent'}`}>
                                                                    <Check size={12} />
                                                                </div>
                                                                <span className="text-xs font-black">{label}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-6">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#000000] text-white">
                                                <Trophy size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black">Point table not used in knockout mode</p>
                                                <p className="mt-1 text-xs font-medium leading-5 text-[#7D8592]">
                                                    Versus tournaments resolve through bracket winners. Match winners advance through the bracket instead of accumulating a classic leaderboard score.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 7 && (
                            <div className="p-6 sm:p-8">
                                <SectionHeader
                                    icon={Check}
                                    eyebrow="07 / Final check"
                                    title="Review tournament"
                                    description="Everything configured here will be stored in the competition draft."
                                />

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-[#E0E3E8] bg-[#FAFBFC] p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8E96A3]">Tournament</p>
                                                <h3 className="mt-1 text-xl font-black">{form.title || 'Untitled tournament'}</h3>
                                                {form.description && <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-[#7D8592]">{form.description}</p>}
                                            </div>
                                            <button type="button" onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B4A86F]">Edit</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                            <div className="flex items-center gap-3">
                                                <Gamepad2 size={17} className="text-[#B4A86F]" />
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8E96A3]">Game</p>
                                                    <p className="mt-1 text-sm font-black">{selectedGame?.name}</p>
                                                </div>
                                            </div>
                                            <div className="mt-5 grid grid-cols-2 gap-3">
                                                <div className="rounded-xl bg-[#F4F5F7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">Format</p>
                                                    <p className="mt-1 text-xs font-black">{formatLabel(form.competitionType)}</p>
                                                </div>
                                                <div className="rounded-xl bg-[#F4F5F7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">Mode</p>
                                                    <p className="mt-1 text-xs font-black">{formatLabel(form.gameMode)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                            <div className="flex items-center gap-3">
                                                <Users size={17} className="text-[#B4A86F]" />
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8E96A3]">Teams</p>
                                                    <p className="mt-1 text-sm font-black">Up to {form.maxTeams}</p>
                                                </div>
                                            </div>
                                            <div className="mt-5 grid grid-cols-2 gap-3">
                                                <div className="rounded-xl bg-[#F4F5F7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">Team size</p>
                                                    <p className="mt-1 text-xs font-black">{form.teamSize}</p>
                                                </div>
                                                <div className="rounded-xl bg-[#F4F5F7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">Matches</p>
                                                    <p className="mt-1 text-xs font-black">{form.competitionType === 'VERSUS' ? bracketPreview.totalMatches : form.numberOfMatches}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {form.competitionType === 'VERSUS' ? (
                                        <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Swords size={17} className="text-[#B4A86F]" />
                                                    <p className="text-sm font-black">Bracket configuration</p>
                                                </div>
                                                <button type="button" onClick={() => setStep(5)} className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B4A86F]">Edit</button>
                                            </div>
                                            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                                {[
                                                    ['Type', formatLabel(bracket.type)],
                                                    ['Seeding', formatLabel(bracket.seeding)],
                                                    ['Slot count', bracketPreview.bracketSize],
                                                    ['Byes', bracketPreview.byes],
                                                    ['Rounds', bracketPreview.rounds],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="rounded-xl bg-[#F4F5F7] p-3">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">{label}</p>
                                                        <p className="mt-1 text-xs font-black">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Trophy size={17} className="text-[#B4A86F]" />
                                                    <p className="text-sm font-black">Points table</p>
                                                </div>
                                                <button type="button" onClick={() => setStep(6)} className="text-[10px] font-black uppercase tracking-[0.12em] text-[#B4A86F]">Edit</button>
                                            </div>
                                            <div className="mt-5 grid grid-cols-3 gap-3">
                                                <div className="rounded-xl bg-[#F4F5F7] p-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">Kill</p>
                                                    <p className="mt-1 text-lg font-black">{pointsTable.killPoints}</p>
                                                </div>
                                                <div className="rounded-xl bg-[#F4F5F7] p-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">1st</p>
                                                    <p className="mt-1 text-lg font-black">{pointsTable.placementPoints['1']}</p>
                                                </div>
                                                <div className="rounded-xl bg-[#F4F5F7] p-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8E96A3]">Tiebreakers</p>
                                                    <p className="mt-1 text-lg font-black">{pointsTable.tiebreakers.length}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3 rounded-xl border border-[#E0E3E8] bg-[#FAFBFC] p-4">
                                        <Info size={16} className="mt-0.5 shrink-0 text-[#B4A86F]" />
                                        <div>
                                            <p className="text-xs font-black">Draft creation</p>
                                            <p className="mt-1 text-xs font-medium leading-5 text-[#7D8592]">
                                                The tournament is created as a draft. Registration, locked-team seeding, bracket generation, and live match controls happen through the organiser flow after creation.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 border-t border-[#E3E6EA] bg-[#F4F5F7] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <button
                                type="button"
                                onClick={() => (step === 1 ? navigate('/competitions') : handleBack())}
                                disabled={creating}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9DDE3] bg-white px-5 text-xs font-black uppercase tracking-[0.1em] text-[#555B66] transition hover:border-[#B8BDC5] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ArrowLeft size={15} />
                                {step === 1 ? 'Cancel' : 'Back'}
                            </button>

                            <div className="flex items-center justify-end gap-3">
                                {step < 7 ? (
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        disabled={creating}
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#000000] px-6 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Continue
                                        <ArrowRight size={15} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleCreate}
                                        disabled={creating}
                                        className="inline-flex h-11 min-w-[190px] items-center justify-center gap-2 rounded-xl bg-[#000000] px-6 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {creating ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Trophy size={15} />
                                                Create Tournament
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <aside className="hidden xl:block">
                        <div className="sticky top-[96px] space-y-4">
                            <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#000000] text-white">
                                <div className="relative p-6">
                                    <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full border border-white/10" />
                                    <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-1/3 translate-y-1/3 rounded-full border border-white/10" />
                                    <div className="relative">
                                        <div className="flex items-center justify-between">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/60">Draft</span>
                                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">SYNCO</span>
                                        </div>
                                        <div className="mt-8">
                                            <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#D6C98A]">{selectedGame?.name || 'Select game'}</p>
                                            <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-tight">{form.title || 'Your tournament name'}</h3>
                                            <p className="mt-2 text-xs font-medium leading-5 text-white/45">{form.description || 'Your tournament description will appear here.'}</p>
                                        </div>
                                        <div className="mt-6 grid grid-cols-2 gap-2">
                                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">Format</p>
                                                <p className="mt-1 text-xs font-black">{formatLabel(form.competitionType)}</p>
                                            </div>
                                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">Teams</p>
                                                <p className="mt-1 text-xs font-black">{form.maxTeams}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Clock3 size={13} className="text-[#D6C98A]" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">Competition</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-white/60">{form.competitionStart?.split('T')[0] || 'Not set'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#8E96A3]">Setup checklist</p>
                                <div className="mt-4 space-y-3">
                                    {[
                                        ['Competition identity', Boolean(form.title.trim())],
                                        ['Game & format', Boolean(form.gameId && form.gameMode)],
                                        ['Team capacity', Number(form.maxTeams) >= 2 && Number(form.maxTeams) <= MAX_TEAMS],
                                        ['Schedule', Boolean(form.registrationStart && form.registrationEnd && form.competitionStart && form.competitionEnd)],
                                        ['Rules', Boolean(form.competitionRules.trim())],
                                        ['Bracket setup', form.competitionType !== 'VERSUS' || Boolean(bracket.type)],
                                        ['Points table', form.competitionType !== 'CLASSIC' || pointsTable.tiebreakers.length > 0],
                                    ].map(([label, complete]) => (
                                        <div key={label} className="flex items-center gap-3">
                                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${complete ? 'bg-[#000000] text-white' : 'border border-[#D9DDE3] bg-white text-transparent'}`}>
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            <span className={`text-xs font-bold ${complete ? 'text-[#111111]' : 'text-[#8E96A3]'}`}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[#E0E3E8] bg-white p-5">
                                <div className="flex items-start gap-3">
                                    <Info size={16} className="mt-0.5 shrink-0 text-[#B4A86F]" />
                                    <div>
                                        <p className="text-xs font-black">Organizer controls</p>
                                        <p className="mt-1 text-[11px] font-medium leading-5 text-[#7D8592]">
                                            The tournament starts as a draft. Teams are locked before bracket generation and the scoring contract remains attached to the competition.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
};

export default CreateCompetition;
