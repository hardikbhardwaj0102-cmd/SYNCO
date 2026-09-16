import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronDown,
    Clock3,
    Gamepad2,
    Info,
    Layers3,
    Loader2,
    ShieldCheck,
    Swords,
    Trophy,
    Users,
    CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL =
    import.meta.env.VITE_API_URL ||
    'https://synco-backend-vi7b.onrender.com';

/* =========================================================
   FALLBACK CONFIG

   Used only if the config endpoint is temporarily
   unavailable. The backend remains the source of truth.
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
                team_sizes: [1, 2],
                default_matches: null,
            },
        },
    },
};

/* =========================================================
   HELPERS
========================================================= */

const slugifyGame = (value) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();

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

    return (
        aliases[normalized] ||
        normalized.replace(/[^a-z0-9]+/g, '-')
    );
};

const formatLabel = (value) => {
    if (!value) return '';

    return String(value)
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) =>
            char.toUpperCase()
        );
};

const localDateTimeValue = (date) => {
    if (!date) return '';

    const pad = (number) =>
        String(number).padStart(2, '0');

    return `${date.getFullYear()}-${pad(
        date.getMonth() + 1
    )}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
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

/* =========================================================
   REUSABLE UI
========================================================= */

const SectionHeader = ({
    icon: Icon,
    eyebrow,
    title,
    description,
}) => {
    return (
        <div className="mb-7 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black text-white">
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
};

const FieldLabel = ({
    children,
    required = false,
    hint,
}) => {
    return (
        <div className="mb-2 flex items-center justify-between gap-4">
            <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#37383d]">
                {children}

                {required && (
                    <span className="ml-1 text-[#E5FE00]">
                        *
                    </span>
                )}
            </label>

            {hint && (
                <span className="text-[10px] font-semibold text-[#9a9ba0]">
                    {hint}
                </span>
            )}
        </div>
    );
};

const inputClass =
    'h-12 w-full rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm font-semibold text-[#111114] outline-none transition placeholder:text-[#aaaab0] focus:border-[#111114] focus:bg-white';

const textareaClass =
    'min-h-[120px] w-full resize-none rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm font-semibold leading-6 text-[#111114] outline-none transition placeholder:text-[#aaaab0] focus:border-[#111114] focus:bg-white';

const selectClass =
    'h-12 w-full appearance-none rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 pr-10 text-sm font-semibold text-[#111114] outline-none transition focus:border-[#111114] focus:bg-white';

const StepPill = ({
    number,
    title,
    active,
    complete,
}) => {
    return (
        <div
            className={`flex items-center gap-3 ${active
                ? 'text-[#111114]'
                : 'text-[#a0a1a6]'
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
                {complete ? (
                    <Check size={14} strokeWidth={3} />
                ) : (
                    number
                )}
            </div>

            <span className="hidden text-[10px] font-black uppercase tracking-[0.14em] md:block">
                {title}
            </span>
        </div>
    );
};

/* =========================================================
   COMPONENT
========================================================= */

const CreateCompetition = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);

    const [games, setGames] = useState([]);
    const [config, setConfig] =
        useState(FALLBACK_CONFIG);

    const [loadingConfig, setLoadingConfig] =
        useState(true);

    const [creating, setCreating] =
        useState(false);

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] =
        useState('');

    /* =====================================================
       FORM
    ===================================================== */

    const [form, setForm] = useState({
        title: '',
        description: '',

        gameId: 'bgmi',

        competitionType: 'CLASSIC',
        gameMode: 'CLASSIC',

        participantType: 'TEAM',
        teamSize: 4,

        maxParticipants: 16,
        numberOfMatches: 3,

        registrationStart:
            getDefaultRegistrationStart(),

        registrationEnd:
            getDefaultRegistrationEnd(),

        competitionStart:
            getDefaultCompetitionStart(),

        competitionEnd:
            getDefaultCompetitionEnd(),

        competitionRules: '',
        matchRules: '',
        eligibilityRules: '',

        bonusPoints: 0,
        killPoints: 1,

        placementPoints: {
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
        },
    });

    /* =====================================================
       LOAD COMPETITION CONFIG
    ===================================================== */

    useEffect(() => {
        const loadConfiguration = async () => {
            try {
                setLoadingConfig(true);

                const response = await fetch(
                    `${API_URL}/api/competitions/config`,
                    {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json',
                        },
                        credentials: 'include',
                        cache: 'no-store',
                    }
                );

                const data = await response.json();

                if (response.ok && data?.success) {
                    if (data?.games) {
                        setGames(data.games);
                    }

                    if (data?.config) {
                        setConfig(data.config);
                    }
                }

                /* ---------------------------------------------
                   Load games separately as a fallback.
                --------------------------------------------- */

                if (!games.length) {
                    try {
                        const gamesResponse =
                            await fetch(
                                `${API_URL}/api/games`,
                                {
                                    credentials: 'include',
                                    headers: {
                                        Accept: 'application/json',
                                    },
                                    cache: 'no-store',
                                }
                            );

                        if (gamesResponse.ok) {
                            const gamesData =
                                await gamesResponse.json();

                            if (
                                Array.isArray(
                                    gamesData?.games
                                )
                            ) {
                                setGames(
                                    gamesData.games
                                );
                            }
                        }
                    } catch (gamesError) {
                        console.error(
                            'Games fallback failed:',
                            gamesError
                        );
                    }
                }
            } catch (loadError) {
                console.error(
                    'Competition config load failed:',
                    loadError
                );

                /*
                 * Keep fallback config so the page remains
                 * usable if the config request temporarily fails.
                 */
            } finally {
                setLoadingConfig(false);
            }
        };

        loadConfiguration();
    }, []);

    /* =====================================================
       NORMALIZED GAME
    ===================================================== */

    const selectedGame = useMemo(() => {
        const gameList = Array.isArray(games)
            ? games
            : Object.entries(games || {}).map(
                ([id, gameConfig]) => ({
                    id,
                    name:
                        gameConfig?.game_names?.[0] ||
                        formatLabel(id),
                    ...gameConfig,
                })
            );

        const directGame = gameList.find(
            (game) =>
                String(game.id) ===
                String(form.gameId)
        );

        return (
            directGame || {
                id: form.gameId,
                name:
                    config[
                        slugifyGame(form.gameId)
                    ]?.game_names?.[0] ||
                    formatLabel(form.gameId),
            }
        );
    }, [
        games,
        config,
        form.gameId,
    ]);

    /* =====================================================
       GAME CONFIG
    ===================================================== */

    const availableGames = useMemo(() => {
        if (Array.isArray(games) && games.length) {
            return games;
        }

        if (games && typeof games === 'object' && !Array.isArray(games)) {
            return Object.entries(games).map(([id, gameConfig]) => ({
                id,
                name:
                    gameConfig?.game_names?.[0] ||
                    formatLabel(id),
                ...gameConfig,
            }));
        }

        return Object.entries(config || {}).map(([id, gameConfig]) => ({
            id,
            name:
                gameConfig?.game_names?.[0] ||
                formatLabel(id),
            ...gameConfig,
        }));
    }, [games, config]);

    const gameConfig = useMemo(() => {
        const slug =
            slugifyGame(
                selectedGame?.slug ||
                selectedGame?.name ||
                form.gameId
            );

        return (
            config[slug] ||
            config[form.gameId] ||
            FALLBACK_CONFIG[slug] ||
            FALLBACK_CONFIG[form.gameId] ||
            null
        );
    }, [
        config,
        selectedGame,
        form.gameId,
    ]);

    /* =====================================================
       MODES
    ===================================================== */

    const availableModes = useMemo(() => {
        if (!gameConfig?.modes) {
            return [];
        }

        return Object.entries(
            gameConfig.modes
        ).map(([id, mode]) => ({
            id,
            ...mode,
        }));
    }, [gameConfig]);

    const selectedMode = useMemo(() => {
        return (
            availableModes.find(
                (mode) =>
                    mode.id === form.gameMode
            ) ||
            availableModes[0] ||
            null
        );
    }, [
        availableModes,
        form.gameMode,
    ]);

    /* =====================================================
       UPDATE GAME
  
       The backend's game IDs can be different from
       normalized slugs, so preserve the actual ID returned
       by the games endpoint.
    ===================================================== */

    const handleGameChange = (gameId) => {
        const game =
            availableGames.find(
                (item) =>
                    String(item.id) ===
                    String(gameId)
            ) || {
                id: gameId,
                name: formatLabel(gameId),
            };

        const slug = slugifyGame(
            game.slug ||
            game.name ||
            gameId
        );

        const nextConfig =
            config[slug] ||
            config[gameId] ||
            FALLBACK_CONFIG[slug] ||
            FALLBACK_CONFIG[gameId];

        const nextModes =
            nextConfig?.modes
                ? Object.entries(
                    nextConfig.modes
                )
                : [];

        const firstMode =
            nextModes.length
                ? nextModes[0]
                : null;

        const modeId =
            firstMode?.[0] || '';

        const modeConfig =
            firstMode?.[1] || null;

        const nextTeamSizes =
            modeConfig?.team_sizes || [1];

        const nextTeamSize =
            nextTeamSizes.includes(
                Number(form.teamSize)
            )
                ? Number(form.teamSize)
                : nextTeamSizes[0];

        const nextType =
            modeConfig?.type ||
            'VERSUS';

        setForm((previous) => ({
            ...previous,

            gameId,

            gameMode: modeId,

            competitionType:
                nextType,

            participantType:
                modeConfig?.participant_type ||
                'TEAM',

            teamSize:
                nextTeamSize,

            numberOfMatches:
                modeConfig?.default_matches ||
                1,

            maxParticipants:
                nextType === 'VERSUS'
                    ? 16
                    : 16,
        }));

        setError('');
    };

    /* =====================================================
       UPDATE MODE
    ===================================================== */

    const handleModeChange = (modeId) => {
        const mode =
            availableModes.find(
                (item) =>
                    item.id === modeId
            );

        if (!mode) return;

        const teamSizes =
            mode.team_sizes || [1];

        const teamSize =
            teamSizes.includes(
                Number(form.teamSize)
            )
                ? Number(form.teamSize)
                : teamSizes[0];

        const isClassic =
            mode.type === 'CLASSIC';

        setForm((previous) => ({
            ...previous,

            gameMode: modeId,

            competitionType:
                mode.type,

            participantType:
                mode.participant_type ||
                'TEAM',

            teamSize,

            numberOfMatches:
                isClassic
                    ? mode.default_matches || 1
                    : 1,

            maxParticipants:
                isClassic
                    ? Math.min(
                        Number(
                            previous.maxParticipants
                        ) || 16,
                        16
                    )
                    : 16,
        }));

        setError('');
    };

    /* =====================================================
       INPUT UPDATE
    ===================================================== */

    const updateField = (
        field,
        value
    ) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setError('');
        setSuccessMessage('');
    };

    /* =====================================================
       PLACEMENT UPDATE
    ===================================================== */

    const updatePlacementPoints = (
        position,
        value
    ) => {
        setForm((previous) => ({
            ...previous,

            placementPoints: {
                ...previous.placementPoints,

                [position]:
                    Number(value) || 0,
            },
        }));
    };

    /* =====================================================
       VALIDATION
    ===================================================== */

    const validateStep = (
        currentStep
    ) => {
        setError('');

        /* ---------------------------------------------
           STEP 1
        --------------------------------------------- */

        if (currentStep === 1) {
            if (
                !form.title.trim()
            ) {
                setError(
                    'Competition name is required.'
                );

                return false;
            }

            if (
                form.title.trim().length < 3
            ) {
                setError(
                    'Competition name must contain at least 3 characters.'
                );

                return false;
            }

            if (!form.gameId) {
                setError(
                    'Select a game.'
                );

                return false;
            }

            if (!form.gameMode) {
                setError(
                    'Select a competition mode.'
                );

                return false;
            }

            return true;
        }

        /* ---------------------------------------------
           STEP 2
        --------------------------------------------- */

        if (currentStep === 2) {
            const teamSize =
                Number(form.teamSize);

            const maxParticipants =
                Number(
                    form.maxParticipants
                );

            const numberOfMatches =
                Number(
                    form.numberOfMatches
                );

            const allowedSizes =
                selectedMode?.team_sizes ||
                [];

            if (
                !allowedSizes.includes(
                    teamSize
                )
            ) {
                setError(
                    `Team size must be one of: ${allowedSizes.join(
                        ', '
                    )}.`
                );

                return false;
            }

            if (
                maxParticipants < 2 ||
                maxParticipants > 16
            ) {
                setError(
                    'Maximum participants must be between 2 and 16.'
                );

                return false;
            }

            if (
                form.competitionType ===
                'VERSUS' &&
                ![2, 4, 8, 16].includes(
                    maxParticipants
                )
            ) {
                setError(
                    'VERSUS competitions support 2, 4, 8, or 16 participants.'
                );

                return false;
            }

            if (
                form.competitionType ===
                'CLASSIC' &&
                numberOfMatches < 1
            ) {
                setError(
                    'Classic competitions require at least one match.'
                );

                return false;
            }

            return true;
        }

        /* ---------------------------------------------
           STEP 3
        --------------------------------------------- */

        if (currentStep === 3) {
            const registrationStart =
                new Date(
                    form.registrationStart
                );

            const registrationEnd =
                new Date(
                    form.registrationEnd
                );

            const competitionStart =
                new Date(
                    form.competitionStart
                );

            const competitionEnd =
                new Date(
                    form.competitionEnd
                );

            if (
                Number.isNaN(
                    registrationStart.getTime()
                ) ||
                Number.isNaN(
                    registrationEnd.getTime()
                ) ||
                Number.isNaN(
                    competitionStart.getTime()
                ) ||
                Number.isNaN(
                    competitionEnd.getTime()
                )
            ) {
                setError(
                    'Please provide all competition dates.'
                );

                return false;
            }

            if (
                registrationEnd <=
                registrationStart
            ) {
                setError(
                    'Registration end must be after registration start.'
                );

                return false;
            }

            if (
                competitionStart <
                registrationEnd
            ) {
                setError(
                    'Competition start must be on or after registration end.'
                );

                return false;
            }

            if (
                competitionEnd <=
                competitionStart
            ) {
                setError(
                    'Competition end must be after competition start.'
                );

                return false;
            }

            return true;
        }

        /* ---------------------------------------------
           STEP 4
        --------------------------------------------- */

        if (currentStep === 4) {
            if (
                form.competitionRules.trim()
                    .length === 0
            ) {
                setError(
                    'Add at least the main competition rules.'
                );

                return false;
            }

            return true;
        }

        return true;
    };

    /* =====================================================
       NEXT
    ===================================================== */

    const handleNext = () => {
        if (
            !validateStep(step)
        ) {
            return;
        }

        setStep(
            (previous) =>
                Math.min(
                    previous + 1,
                    5
                )
        );

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    /* =====================================================
       BACK
    ===================================================== */

    const handleBack = () => {
        setError('');

        setStep(
            (previous) =>
                Math.max(
                    previous - 1,
                    1
                )
        );

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    /* =====================================================
       CREATE
    ===================================================== */

    const handleCreate = async () => {
        if (
            !validateStep(4)
        ) {
            return;
        }

        setCreating(true);
        setError('');
        setSuccessMessage('');

        try {
            const payload = {
                title:
                    form.title.trim(),

                description:
                    form.description.trim(),

                gameId:
                    form.gameId,

                competitionType:
                    form.competitionType,

                gameMode:
                    form.gameMode,

                participantType:
                    form.participantType,

                teamSize:
                    Number(form.teamSize),

                maxParticipants:
                    Number(
                        form.maxParticipants
                    ),

                numberOfMatches:
                    form.competitionType ===
                        'VERSUS'
                        ? 1
                        : Number(
                            form.numberOfMatches
                        ),

                configuration: {
                    structure:
                        selectedMode?.structure ||
                        null,

                    scoring:
                        form.competitionType ===
                            'CLASSIC'
                            ? {
                                placementPoints:
                                    form.placementPoints,

                                killPoints:
                                    Number(
                                        form.killPoints
                                    ),

                                bonusPoints:
                                    Number(
                                        form.bonusPoints
                                    ),
                            }
                            : null,
                },

                competitionRules:
                    form.competitionRules
                        .trim(),

                matchRules:
                    form.matchRules.trim(),

                eligibilityRules:
                    form.eligibilityRules
                        .trim(),

                registrationStart:
                    form.registrationStart,

                registrationEnd:
                    form.registrationEnd,

                competitionStart:
                    form.competitionStart,

                competitionEnd:
                    form.competitionEnd,
            };

            const response =
                await fetch(
                    `${API_URL}/api/competitions`,
                    {
                        method: 'POST',

                        credentials: 'include',

                        headers: {
                            'Content-Type':
                                'application/json',

                            Accept:
                                'application/json',
                        },

                        body:
                            JSON.stringify(
                                payload
                            ),
                    }
                );

            const contentType =
                response.headers.get(
                    'content-type'
                ) || '';

            if (
                !contentType.includes(
                    'application/json'
                )
            ) {
                throw new Error(
                    `Server returned ${response.status} instead of JSON.`
                );
            }

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    'Unable to create competition.'
                );
            }

            if (
                !data?.success
            ) {
                throw new Error(
                    data?.message ||
                    'Competition creation failed.'
                );
            }

            const createdCompetition =
                data?.competition;

            setSuccessMessage(
                'Competition created successfully.'
            );

            /*
             * Give the organizer a short success state
             * before navigating.
             */

            setTimeout(() => {
                if (
                    createdCompetition?.id
                ) {
                    navigate(
                        `/competitions/${createdCompetition.id}`
                    );
                } else {
                    navigate(
                        '/competitions'
                    );
                }
            }, 700);
        } catch (createError) {
            console.error(
                'Competition creation failed:',
                createError
            );

            setError(
                createError?.message ||
                'Unable to create competition.'
            );
        } finally {
            setCreating(false);
        }
    };

    /* =====================================================
       STEP TITLE
    ===================================================== */

    const stepTitle = {
        1: 'Competition basics',
        2: 'Format & participants',
        3: 'Schedule',
        4: 'Rules & scoring',
        5: 'Review',
    }[step];

    /* =====================================================
       RENDER
    ===================================================== */

    return (
        <div className="min-h-screen bg-[#f5f5f4] text-[#111114]">

            {/* =================================================
          TOP BAR
      ================================================= */}

            <div className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">

                <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-5 lg:px-8">

                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                '/competitions'
                            )
                        }
                        className="group flex items-center gap-3"
                    >

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111114] text-white transition group-hover:bg-[#2a2a2e]">
                            <ArrowLeft
                                size={16}
                            />
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

                    {/* STEP NAV */}

                    <div className="hidden items-center gap-5 md:flex">

                        <StepPill
                            number="1"
                            title="Basics"
                            active={step === 1}
                            complete={step > 1}
                        />

                        <div className="h-px w-8 bg-[#dedee1]" />

                        <StepPill
                            number="2"
                            title="Format"
                            active={step === 2}
                            complete={step > 2}
                        />

                        <div className="h-px w-8 bg-[#dedee1]" />

                        <StepPill
                            number="3"
                            title="Schedule"
                            active={step === 3}
                            complete={step > 3}
                        />

                        <div className="h-px w-8 bg-[#dedee1]" />

                        <StepPill
                            number="4"
                            title="Rules"
                            active={step === 4}
                            complete={step > 4}
                        />

                        <div className="h-px w-8 bg-[#dedee1]" />

                        <StepPill
                            number="5"
                            title="Review"
                            active={step === 5}
                            complete={false}
                        />

                    </div>

                    <div className="hidden rounded-full border border-[#e5e5e7] bg-[#fafafa] px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#77787e] sm:block">
                        Organizer
                    </div>

                </div>

            </div>

            {/* =================================================
          MAIN
      ================================================= */}

            <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8 lg:py-10">

                {/* HEADER */}

                <div className="mb-8">

                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#E5FE00]">
                        <Swords
                            size={13}
                        />

                        Competition Engine
                    </div>

                    <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">

                        <div>
                            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                                {stepTitle}
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#77787e]">
                                Configure a structured competition
                                that players can discover, register
                                for, and compete in on SYNCO.
                            </p>
                        </div>

                        <div className="rounded-xl border border-[#dedee1] bg-white px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a9ba0]">
                                Current format
                            </p>

                            <p className="mt-1 text-sm font-black">
                                {formatLabel(
                                    form.competitionType
                                )}

                                <span className="mx-2 text-[#c7c7ca]">
                                    /
                                </span>

                                {formatLabel(
                                    form.gameMode
                                )}
                            </p>
                        </div>

                    </div>

                </div>

                {/* =================================================
            ALERTS
        ================================================= */}

                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">

                        <Info
                            size={17}
                            className="mt-0.5 shrink-0"
                        />

                        <p>{error}</p>

                    </div>
                )}

                {successMessage && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">

                        <Check
                            size={17}
                            className="mt-0.5 shrink-0"
                        />

                        <p>
                            {successMessage}
                        </p>

                    </div>
                )}

                {/* =================================================
            CONTENT GRID
        ================================================= */}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">

                    {/* =================================================
              FORM
          ================================================= */}

                    <div className="rounded-2xl border border-black/10 bg-white">

                        {/* =============================================
                STEP 1
            ============================================= */}

                        {step === 1 && (
                            <div className="p-6 sm:p-8">

                                <SectionHeader
                                    icon={Trophy}
                                    eyebrow="01 / Identity"
                                    title="Competition basics"
                                    description="Give your tournament a clear identity and select the game and format it will use."
                                />

                                <div className="space-y-6">

                                    <div>
                                        <FieldLabel required>
                                            Competition name
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.title
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'title',
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder="e.g. SYNCO BGMI Open #1"
                                            maxLength={100}
                                            className={inputClass}
                                        />

                                        <div className="mt-2 flex justify-between text-[10px] font-semibold text-[#a0a1a6]">
                                            <span>
                                                Use a name players can recognize immediately.
                                            </span>

                                            <span>
                                                {form.title.length}
                                                /100
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <FieldLabel>
                                            Description
                                        </FieldLabel>

                                        <textarea
                                            value={
                                                form.description
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'description',
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder="Describe what players should expect from this competition."
                                            maxLength={500}
                                            className={textareaClass}
                                        />

                                        <p className="mt-2 text-[10px] font-semibold text-[#a0a1a6]">
                                            Keep this concise. Rules and
                                            eligibility can be configured
                                            separately.
                                        </p>
                                    </div>

                                    {/* GAME */}

                                    <div>

                                        <FieldLabel required>
                                            Game
                                        </FieldLabel>

                                        {loadingConfig ? (
                                            <div className="flex h-12 items-center gap-2 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm font-semibold text-[#88898f]">
                                                <Loader2
                                                    size={16}
                                                    className="animate-spin"
                                                />

                                                Loading games...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

                                                {availableGames.map((game) => {
                                                    const selected =
                                                        String(form.gameId) ===
                                                        String(game.id);

                                                    return (
                                                        <button
                                                            key={game.id}
                                                            type="button"
                                                            onClick={() =>
                                                                handleGameChange(game.id)
                                                            }
                                                            className={`group rounded-xl border p-4 text-left transition ${selected
                                                                    ? 'border-[#111114] bg-[#111114] text-white'
                                                                    : 'border-[#e4e4e7] bg-[#fafafa] hover:border-[#bdbdc1] hover:bg-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div
                                                                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected
                                                                            ? 'bg-white/10'
                                                                            : 'bg-white border border-[#e6e6e8]'
                                                                        }`}
                                                                >
                                                                    <Gamepad2 size={17} />
                                                                </div>

                                                                {selected && (
                                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#111114]">
                                                                        <Check
                                                                            size={12}
                                                                            strokeWidth={3}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <p className="mt-4 text-sm font-black">
                                                                {game.name}
                                                            </p>
                                                        </button>
                                                    );
                                                })}

                                            </div>
                                        )}

                                    </div>

                                    {/* MODE */}

                                    <div>

                                        <FieldLabel required>
                                            Competition format
                                        </FieldLabel>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                            {availableModes.map(
                                                (mode) => {
                                                    const selected =
                                                        form.gameMode ===
                                                        mode.id;

                                                    return (
                                                        <button
                                                            key={
                                                                mode.id
                                                            }
                                                            type="button"
                                                            onClick={() =>
                                                                handleModeChange(
                                                                    mode.id
                                                                )
                                                            }
                                                            className={`rounded-xl border p-5 text-left transition ${selected
                                                                ? 'border-[#111114] bg-[#111114] text-white'
                                                                : 'border-[#e4e4e7] bg-[#fafafa] hover:border-[#bdbdc1] hover:bg-white'
                                                                }`}
                                                        >

                                                            <div className="flex items-start justify-between gap-4">

                                                                <div>

                                                                    <p className="text-sm font-black">
                                                                        {formatLabel(
                                                                            mode.id
                                                                        )}
                                                                    </p>

                                                                    <p
                                                                        className={`mt-1 text-xs font-semibold ${selected
                                                                            ? 'text-white/60'
                                                                            : 'text-[#88898f]'
                                                                            }`}
                                                                    >
                                                                        {formatLabel(
                                                                            mode.type
                                                                        )}{' '}
                                                                        ·{' '}
                                                                        {formatLabel(
                                                                            mode.structure
                                                                        )}
                                                                    </p>

                                                                </div>

                                                                {selected && (
                                                                    <Check
                                                                        size={18}
                                                                        strokeWidth={
                                                                            3
                                                                        }
                                                                    />
                                                                )}

                                                            </div>

                                                            <div
                                                                className={`mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] ${selected
                                                                    ? 'text-white/60'
                                                                    : 'text-[#999a9f]'
                                                                    }`}
                                                            >
                                                                <Users
                                                                    size={12}
                                                                />

                                                                {(
                                                                    mode
                                                                        .team_sizes ||
                                                                    []
                                                                ).join(
                                                                    ' / '
                                                                )}{' '}
                                                                player team sizes
                                                            </div>

                                                        </button>
                                                    );
                                                }
                                            )}

                                        </div>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* =============================================
                STEP 2
            ============================================= */}

                        {step === 2 && (
                            <div className="p-6 sm:p-8">

                                <SectionHeader
                                    icon={Users}
                                    eyebrow="02 / Structure"
                                    title="Format & participants"
                                    description="Define how many players or teams can enter and how the competition will be structured."
                                />

                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

                                    {/* PARTICIPANT TYPE */}

                                    <div>
                                        <FieldLabel>
                                            Participant type
                                        </FieldLabel>

                                        <div className="relative">

                                            <select
                                                value={
                                                    form.participantType
                                                }
                                                onChange={(event) =>
                                                    updateField(
                                                        'participantType',
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className={
                                                    selectClass
                                                }
                                            >

                                                <option value="TEAM">
                                                    Teams
                                                </option>

                                                <option value="PLAYER">
                                                    Players
                                                </option>

                                            </select>

                                            <ChevronDown
                                                size={16}
                                                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#88898f]"
                                            />

                                        </div>
                                    </div>

                                    {/* TEAM SIZE */}

                                    <div>
                                        <FieldLabel>
                                            Team size
                                        </FieldLabel>

                                        <div className="relative">

                                            <select
                                                value={
                                                    form.teamSize
                                                }
                                                onChange={(event) =>
                                                    updateField(
                                                        'teamSize',
                                                        Number(
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    )
                                                }
                                                className={
                                                    selectClass
                                                }
                                            >

                                                {(
                                                    selectedMode
                                                        ?.team_sizes ||
                                                    [1]
                                                ).map(
                                                    (size) => (
                                                        <option
                                                            key={size}
                                                            value={size}
                                                        >
                                                            {size}{' '}
                                                            {size ===
                                                                1
                                                                ? 'Player'
                                                                : 'Players'}
                                                        </option>
                                                    )
                                                )}

                                            </select>

                                            <ChevronDown
                                                size={16}
                                                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#88898f]"
                                            />

                                        </div>
                                    </div>

                                    {/* MAX PARTICIPANTS */}

                                    <div>
                                        <FieldLabel
                                            required
                                            hint="2–16"
                                        >
                                            Maximum participants
                                        </FieldLabel>

                                        <input
                                            type="number"
                                            min="2"
                                            max="16"
                                            value={
                                                form.maxParticipants
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'maxParticipants',
                                                    Number(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                )
                                            }
                                            className={
                                                inputClass
                                            }
                                        />

                                        <p className="mt-2 text-[10px] font-semibold text-[#999a9f]">
                                            This is the number of registered
                                            participants or teams.
                                        </p>
                                    </div>

                                    {/* MATCHES */}

                                    <div>
                                        <FieldLabel
                                            hint={
                                                form.competitionType ===
                                                    'VERSUS'
                                                    ? 'Fixed at 1'
                                                    : 'Minimum 1'
                                            }
                                        >
                                            Number of matches
                                        </FieldLabel>

                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            disabled={
                                                form.competitionType ===
                                                'VERSUS'
                                            }
                                            value={
                                                form.numberOfMatches
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'numberOfMatches',
                                                    Number(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                )
                                            }
                                            className={`${inputClass} ${form.competitionType ===
                                                'VERSUS'
                                                ? 'cursor-not-allowed opacity-50'
                                                : ''
                                                }`}
                                        />

                                        <p className="mt-2 text-[10px] font-semibold text-[#999a9f]">
                                            {form.competitionType ===
                                                'VERSUS'
                                                ? 'Knockout competitions use one match per bracket pairing.'
                                                : 'Classic competitions can use multiple matches for cumulative scoring.'}
                                        </p>
                                    </div>

                                </div>

                                {/* FORMAT SUMMARY */}

                                <div className="mt-8 rounded-2xl border border-[#e5e5e7] bg-[#fafafa] p-5">

                                    <div className="flex items-center gap-3">

                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111114] text-white">
                                            <Layers3
                                                size={16}
                                            />
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#999a9f]">
                                                Structure
                                            </p>

                                            <p className="mt-1 text-sm font-black">
                                                {formatLabel(
                                                    selectedMode?.structure
                                                )}
                                            </p>
                                        </div>

                                    </div>

                                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">

                                        <div className="rounded-xl border border-[#e6e6e8] bg-white p-4">
                                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                Format
                                            </p>

                                            <p className="mt-1 text-sm font-black">
                                                {formatLabel(
                                                    form.competitionType
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[#e6e6e8] bg-white p-4">
                                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                Teams
                                            </p>

                                            <p className="mt-1 text-sm font-black">
                                                {form.maxParticipants}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[#e6e6e8] bg-white p-4">
                                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                Team size
                                            </p>

                                            <p className="mt-1 text-sm font-black">
                                                {form.teamSize}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[#e6e6e8] bg-white p-4">
                                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                Matches
                                            </p>

                                            <p className="mt-1 text-sm font-black">
                                                {form.numberOfMatches}
                                            </p>
                                        </div>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* =============================================
                STEP 3
            ============================================= */}

                        {step === 3 && (
                            <div className="p-6 sm:p-8">

                                <SectionHeader
                                    icon={CalendarDays}
                                    eyebrow="03 / Timing"
                                    title="Competition schedule"
                                    description="Set clear registration and competition windows so players know exactly when they can enter and compete."
                                />

                                <div className="space-y-8">

                                    {/* REGISTRATION */}

                                    <div>

                                        <div className="mb-4 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-[#E5FE00]" />

                                            <h3 className="text-xs font-black uppercase tracking-[0.14em]">
                                                Registration window
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                                            <div>
                                                <FieldLabel required>
                                                    Registration starts
                                                </FieldLabel>

                                                <input
                                                    type="datetime-local"
                                                    value={
                                                        form.registrationStart
                                                    }
                                                    onChange={(event) =>
                                                        updateField(
                                                            'registrationStart',
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className={
                                                        inputClass
                                                    }
                                                />
                                            </div>

                                            <div>
                                                <FieldLabel required>
                                                    Registration ends
                                                </FieldLabel>

                                                <input
                                                    type="datetime-local"
                                                    value={
                                                        form.registrationEnd
                                                    }
                                                    onChange={(event) =>
                                                        updateField(
                                                            'registrationEnd',
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className={
                                                        inputClass
                                                    }
                                                />
                                            </div>

                                        </div>

                                    </div>

                                    {/* COMPETITION */}

                                    <div>

                                        <div className="mb-4 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-[#E5FE00]" />

                                            <h3 className="text-xs font-black uppercase tracking-[0.14em]">
                                                Competition window
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                                            <div>
                                                <FieldLabel required>
                                                    Competition starts
                                                </FieldLabel>

                                                <input
                                                    type="datetime-local"
                                                    value={
                                                        form.competitionStart
                                                    }
                                                    onChange={(event) =>
                                                        updateField(
                                                            'competitionStart',
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className={
                                                        inputClass
                                                    }
                                                />
                                            </div>

                                            <div>
                                                <FieldLabel required>
                                                    Competition ends
                                                </FieldLabel>

                                                <input
                                                    type="datetime-local"
                                                    value={
                                                        form.competitionEnd
                                                    }
                                                    onChange={(event) =>
                                                        updateField(
                                                            'competitionEnd',
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className={
                                                        inputClass
                                                    }
                                                />
                                            </div>

                                        </div>

                                    </div>

                                    {/* TIMELINE */}

                                    <div className="rounded-2xl border border-[#e5e5e7] bg-[#fafafa] p-5">

                                        <div className="flex items-center gap-3">

                                            <Clock3
                                                size={17}
                                                className="text-[#E5FE00]"
                                            />

                                            <div>
                                                <p className="text-sm font-black">
                                                    Competition timeline
                                                </p>

                                                <p className="mt-1 text-xs font-medium text-[#898a90]">
                                                    Registration must close before
                                                    the competition begins.
                                                </p>
                                            </div>

                                        </div>

                                        <div className="mt-5 h-px bg-[#e2e2e5]" />

                                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4">

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                    Registration
                                                </p>

                                                <p className="mt-1 text-xs font-bold">
                                                    Opens
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                    Registration
                                                </p>

                                                <p className="mt-1 text-xs font-bold">
                                                    Closes
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                    Competition
                                                </p>

                                                <p className="mt-1 text-xs font-bold">
                                                    Starts
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#9a9ba0]">
                                                    Competition
                                                </p>

                                                <p className="mt-1 text-xs font-bold">
                                                    Ends
                                                </p>
                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* =============================================
                STEP 4
            ============================================= */}

                        {step === 4 && (
                            <div className="p-6 sm:p-8">

                                <SectionHeader
                                    icon={ShieldCheck}
                                    eyebrow="04 / Governance"
                                    title="Rules & scoring"
                                    description="Set the rules players will follow and configure scoring for classic point-based competitions."
                                />

                                <div className="space-y-6">

                                    {/* COMPETITION RULES */}

                                    <div>
                                        <FieldLabel required>
                                            Competition rules
                                        </FieldLabel>

                                        <textarea
                                            value={
                                                form.competitionRules
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'competitionRules',
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder={`Example:
• Players must use their registered account.
• No cheating, exploits, or unauthorized software.
• Match results must be submitted within the allowed window.
• Organizer decisions must follow the published rules.`}
                                            className={
                                                textareaClass
                                            }
                                        />
                                    </div>

                                    {/* MATCH RULES */}

                                    <div>
                                        <FieldLabel>
                                            Match rules
                                        </FieldLabel>

                                        <textarea
                                            value={
                                                form.matchRules
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'matchRules',
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder="Define match-specific requirements, result submission rules, room/lobby rules, or map settings."
                                            className={
                                                textareaClass
                                            }
                                        />
                                    </div>

                                    {/* ELIGIBILITY */}

                                    <div>
                                        <FieldLabel>
                                            Eligibility
                                        </FieldLabel>

                                        <textarea
                                            value={
                                                form.eligibilityRules
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    'eligibilityRules',
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder="Example: Minimum account level, region restrictions, age requirements, or other eligibility conditions."
                                            className={
                                                textareaClass
                                            }
                                        />
                                    </div>

                                    {/* CLASSIC SCORING */}

                                    {form.competitionType ===
                                        'CLASSIC' && (
                                            <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">

                                                <div className="flex items-start justify-between gap-4">

                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E5FE00]">
                                                            Points system
                                                        </p>

                                                        <h3 className="mt-1 text-base font-black">
                                                            Classic scoring
                                                        </h3>

                                                        <p className="mt-1 text-xs font-medium leading-5 text-[#85868c]">
                                                            Placement points and kill
                                                            points are stored with the
                                                            competition configuration.
                                                        </p>
                                                    </div>

                                                    <Trophy
                                                        size={20}
                                                        className="text-[#E5FE00]"
                                                    />

                                                </div>

                                                <div className="mt-6">

                                                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.13em] text-[#77787e]">
                                                        Placement points
                                                    </p>

                                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">

                                                        {Object.entries(
                                                            form.placementPoints
                                                        ).map(
                                                            ([
                                                                position,
                                                                points,
                                                            ]) => (
                                                                <div
                                                                    key={
                                                                        position
                                                                    }
                                                                    className="rounded-xl border border-[#e4e4e7] bg-white p-3"
                                                                >

                                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                                        {position}
                                                                        {position ===
                                                                            '1'
                                                                            ? 'st'
                                                                            : position ===
                                                                                '2'
                                                                                ? 'nd'
                                                                                : position ===
                                                                                    '3'
                                                                                    ? 'rd'
                                                                                    : 'th'}
                                                                    </p>

                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={
                                                                            points
                                                                        }
                                                                        onChange={(
                                                                            event
                                                                        ) =>
                                                                            updatePlacementPoints(
                                                                                position,
                                                                                event
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className="mt-2 h-9 w-full rounded-lg border border-[#e6e6e8] bg-[#fafafa] px-2 text-sm font-black outline-none focus:border-[#111114]"
                                                                    />

                                                                </div>
                                                            )
                                                        )}

                                                    </div>

                                                </div>

                                                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

                                                    <div>
                                                        <FieldLabel>
                                                            Kill points
                                                        </FieldLabel>

                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={
                                                                form.killPoints
                                                            }
                                                            onChange={(event) =>
                                                                updateField(
                                                                    'killPoints',
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </div>

                                                    <div>
                                                        <FieldLabel>
                                                            Bonus points
                                                        </FieldLabel>

                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={
                                                                form.bonusPoints
                                                            }
                                                            onChange={(event) =>
                                                                updateField(
                                                                    'bonusPoints',
                                                                    Number(
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                )
                                                            }
                                                            className={
                                                                inputClass
                                                            }
                                                        />
                                                    </div>

                                                </div>

                                            </div>
                                        )}

                                    {form.competitionType ===
                                        'VERSUS' && (
                                            <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">

                                                <div className="flex items-start gap-3">

                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111114] text-white">
                                                        <Swords
                                                            size={16}
                                                        />
                                                    </div>

                                                    <div>
                                                        <p className="text-sm font-black">
                                                            Knockout scoring
                                                        </p>

                                                        <p className="mt-1 text-xs font-medium leading-5 text-[#85868c]">
                                                            This format is bracket-based.
                                                            The backend automatically
                                                            uses one match for each
                                                            knockout pairing.
                                                        </p>
                                                    </div>

                                                </div>

                                            </div>
                                        )}

                                </div>

                            </div>
                        )}

                        {/* =============================================
                STEP 5
            ============================================= */}

                        {step === 5 && (
                            <div className="p-6 sm:p-8">

                                <SectionHeader
                                    icon={Check}
                                    eyebrow="05 / Final check"
                                    title="Review competition"
                                    description="Review the configuration before creating your competition."
                                />

                                <div className="space-y-4">

                                    {/* IDENTITY */}

                                    <div className="rounded-2xl border border-[#e5e5e7] bg-[#fafafa] p-5">

                                        <div className="flex items-start justify-between gap-4">

                                            <div>

                                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#999a9f]">
                                                    Competition
                                                </p>

                                                <h3 className="mt-1 text-xl font-black">
                                                    {form.title ||
                                                        'Untitled competition'}
                                                </h3>

                                                {form.description && (
                                                    <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-[#85868c]">
                                                        {
                                                            form.description
                                                        }
                                                    </p>
                                                )}

                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setStep(
                                                        1
                                                    )
                                                }
                                                className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E5FE00] hover:text-[#c9df00]"
                                            >
                                                Edit
                                            </button>

                                        </div>

                                    </div>

                                    {/* SUMMARY GRID */}

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                                        <div className="rounded-2xl border border-[#e5e5e7] bg-white p-5">

                                            <div className="flex items-center gap-3">

                                                <Gamepad2
                                                    size={17}
                                                    className="text-[#E5FE00]"
                                                />

                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#999a9f]">
                                                        Game
                                                    </p>

                                                    <p className="mt-1 text-sm font-black">
                                                        {
                                                            selectedGame?.name
                                                        }
                                                    </p>
                                                </div>

                                            </div>

                                            <div className="mt-5 grid grid-cols-2 gap-3">

                                                <div className="rounded-xl bg-[#f7f7f7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                        Mode
                                                    </p>

                                                    <p className="mt-1 text-xs font-black">
                                                        {formatLabel(
                                                            form.gameMode
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-[#f7f7f7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                        Format
                                                    </p>

                                                    <p className="mt-1 text-xs font-black">
                                                        {formatLabel(
                                                            form.competitionType
                                                        )}
                                                    </p>
                                                </div>

                                            </div>

                                        </div>

                                        <div className="rounded-2xl border border-[#e5e5e7] bg-white p-5">

                                            <div className="flex items-center gap-3">

                                                <Users
                                                    size={17}
                                                    className="text-[#E5FE00]"
                                                />

                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#999a9f]">
                                                        Participants
                                                    </p>

                                                    <p className="mt-1 text-sm font-black">
                                                        {form.maxParticipants}{' '}
                                                        {form.participantType ===
                                                            'TEAM'
                                                            ? 'Teams'
                                                            : 'Players'}
                                                    </p>
                                                </div>

                                            </div>

                                            <div className="mt-5 grid grid-cols-2 gap-3">

                                                <div className="rounded-xl bg-[#f7f7f7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                        Team size
                                                    </p>

                                                    <p className="mt-1 text-xs font-black">
                                                        {form.teamSize}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-[#f7f7f7] p-3">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                        Matches
                                                    </p>

                                                    <p className="mt-1 text-xs font-black">
                                                        {form.numberOfMatches}
                                                    </p>
                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                    {/* SCHEDULE */}

                                    <div className="rounded-2xl border border-[#e5e5e7] bg-white p-5">

                                        <div className="flex items-center justify-between">

                                            <div className="flex items-center gap-3">

                                                <CalendarDays
                                                    size={17}
                                                    className="text-[#E5FE00]"
                                                />

                                                <p className="text-sm font-black">
                                                    Schedule
                                                </p>

                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setStep(
                                                        3
                                                    )
                                                }
                                                className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E5FE00]"
                                            >
                                                Edit
                                            </button>

                                        </div>

                                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

                                            <div className="rounded-xl bg-[#f7f7f7] p-4">
                                                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                    Registration
                                                </p>

                                                <p className="mt-1 text-xs font-bold">
                                                    {form.registrationStart.replace(
                                                        'T',
                                                        ' '
                                                    )}
                                                </p>

                                                <p className="mt-1 text-xs font-bold text-[#88898f]">
                                                    to{' '}
                                                    {form.registrationEnd.replace(
                                                        'T',
                                                        ' '
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-[#f7f7f7] p-4">
                                                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                    Competition
                                                </p>

                                                <p className="mt-1 text-xs font-bold">
                                                    {form.competitionStart.replace(
                                                        'T',
                                                        ' '
                                                    )}
                                                </p>

                                                <p className="mt-1 text-xs font-bold text-[#88898f]">
                                                    to{' '}
                                                    {form.competitionEnd.replace(
                                                        'T',
                                                        ' '
                                                    )}
                                                </p>
                                            </div>

                                        </div>

                                    </div>

                                    {/* SCORING */}

                                    {form.competitionType ===
                                        'CLASSIC' && (
                                            <div className="rounded-2xl border border-[#e5e5e7] bg-white p-5">

                                                <div className="flex items-center justify-between">

                                                    <div className="flex items-center gap-3">

                                                        <Trophy
                                                            size={17}
                                                            className="text-[#E5FE00]"
                                                        />

                                                        <p className="text-sm font-black">
                                                            Scoring
                                                        </p>

                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setStep(
                                                                4
                                                            )
                                                        }
                                                        className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E5FE00]"
                                                    >
                                                        Edit
                                                    </button>

                                                </div>

                                                <div className="mt-5 grid grid-cols-3 gap-3">

                                                    <div className="rounded-xl bg-[#f7f7f7] p-4">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                            Kill
                                                        </p>

                                                        <p className="mt-1 text-lg font-black">
                                                            {form.killPoints}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f7f7f7] p-4">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                            Bonus
                                                        </p>

                                                        <p className="mt-1 text-lg font-black">
                                                            {form.bonusPoints}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-[#f7f7f7] p-4">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#9a9ba0]">
                                                            1st
                                                        </p>

                                                        <p className="mt-1 text-lg font-black">
                                                            {
                                                                form
                                                                    .placementPoints[
                                                                '1'
                                                                ]
                                                            }
                                                        </p>
                                                    </div>

                                                </div>

                                            </div>
                                        )}

                                    {/* DRAFT NOTICE */}

                                    <div className="flex items-start gap-3 rounded-xl border border-[#dedee1] bg-[#fafafa] p-4">

                                        <Info
                                            size={16}
                                            className="mt-0.5 shrink-0 text-[#77787e]"
                                        />

                                        <div>
                                            <p className="text-xs font-black">
                                                This creates a draft
                                            </p>

                                            <p className="mt-1 text-xs font-medium leading-5 text-[#85868c]">
                                                The competition will be created
                                                as a draft. You can configure
                                                participants, bracket details,
                                                and then open registration through
                                                the organizer controls.
                                            </p>
                                        </div>

                                    </div>

                                </div>

                            </div>
                        )}

                        {/* =================================================
                FOOTER ACTIONS
            ================================================= */}

                        <div className="flex flex-col-reverse gap-3 border-t border-[#e7e7e9] bg-[#fcfcfc] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">

                            <button
                                type="button"
                                onClick={() =>
                                    step === 1
                                        ? navigate(
                                            '/competitions'
                                        )
                                        : handleBack()
                                }
                                disabled={creating}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dedee1] bg-white px-5 text-xs font-black uppercase tracking-[0.1em] text-[#55565c] transition hover:border-[#bcbcc1] hover:text-[#111114] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ArrowLeft
                                    size={15}
                                />

                                {step === 1
                                    ? 'Cancel'
                                    : 'Back'}
                            </button>

                            <div className="flex items-center justify-end gap-3">

                                {step < 5 ? (
                                    <button
                                        type="button"
                                        onClick={
                                            handleNext
                                        }
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#111114] px-6 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#29292d]"
                                    >
                                        Continue

                                        <ArrowRight
                                            size={15}
                                        />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={
                                            handleCreate
                                        }
                                        disabled={
                                            creating
                                        }
                                        className="inline-flex h-11 min-w-[190px] items-center justify-center gap-2 rounded-xl bg-[#111114] px-6 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#29292d] disabled:cursor-not-allowed disabled:opacity-60"
                                    >

                                        {creating ? (
                                            <>
                                                <Loader2
                                                    size={16}
                                                    className="animate-spin"
                                                />

                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Trophy
                                                    size={15}
                                                />

                                                Create Competition
                                            </>
                                        )}

                                    </button>
                                )}

                            </div>

                        </div>

                    </div>

                    {/* =================================================
              RIGHT SIDEBAR
          ================================================= */}

                    <aside className="hidden xl:block">

                        <div className="sticky top-[96px] space-y-4">

                            {/* PREVIEW */}

                            <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#111114] text-white">

                                <div className="relative p-6">

                                    <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full border border-white/10" />

                                    <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-1/3 translate-y-1/3 rounded-full border border-white/10" />

                                    <div className="relative">

                                        <div className="flex items-center justify-between">

                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/60">
                                                Draft
                                            </span>

                                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                                                SYNCO
                                            </span>

                                        </div>

                                        <div className="mt-8">

                                            <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#E5FE00]">
                                                {selectedGame?.name ||
                                                    'Select game'}
                                            </p>

                                            <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-tight">
                                                {form.title ||
                                                    'Your competition name'}
                                            </h3>

                                            <p className="mt-2 text-xs font-medium leading-5 text-white/45">
                                                {form.description ||
                                                    'Your competition description will appear here.'}
                                            </p>

                                        </div>

                                        <div className="mt-6 grid grid-cols-2 gap-2">

                                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">
                                                    Format
                                                </p>

                                                <p className="mt-1 text-xs font-black">
                                                    {formatLabel(
                                                        form.competitionType
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/35">
                                                    Players
                                                </p>

                                                <p className="mt-1 text-xs font-black">
                                                    {form.maxParticipants}
                                                </p>
                                            </div>

                                        </div>

                                        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">

                                            <div className="flex items-center justify-between">

                                                <div className="flex items-center gap-2">

                                                    <Clock3
                                                        size={13}
                                                        className="text-[#E5FE00]"
                                                    />

                                                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/40">
                                                        Competition
                                                    </span>

                                                </div>

                                                <span className="text-[10px] font-bold text-white/60">
                                                    {form.competitionStart
                                                        ? form.competitionStart
                                                            .split(
                                                                'T'
                                                            )[0]
                                                        : 'Not set'}
                                                </span>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>

                            {/* CHECKLIST */}

                            <div className="rounded-2xl border border-black/10 bg-white p-5">

                                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#999a9f]">
                                    Setup checklist
                                </p>

                                <div className="mt-4 space-y-3">

                                    {[
                                        [
                                            'Competition identity',
                                            Boolean(
                                                form.title.trim()
                                            ),
                                        ],
                                        [
                                            'Game & format',
                                            Boolean(
                                                form.gameId &&
                                                form.gameMode
                                            ),
                                        ],
                                        [
                                            'Participants',
                                            Boolean(
                                                form.maxParticipants >=
                                                2
                                            ),
                                        ],
                                        [
                                            'Schedule',
                                            Boolean(
                                                form.registrationStart &&
                                                form.registrationEnd &&
                                                form.competitionStart &&
                                                form.competitionEnd
                                            ),
                                        ],
                                        [
                                            'Rules',
                                            Boolean(
                                                form.competitionRules.trim()
                                            ),
                                        ],
                                    ].map(
                                        ([
                                            label,
                                            complete,
                                        ]) => (
                                            <div
                                                key={
                                                    label
                                                }
                                                className="flex items-center gap-3"
                                            >

                                                <div
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full ${complete
                                                        ? 'bg-[#111114] text-white'
                                                        : 'border border-[#dedee1] bg-white text-transparent'
                                                        }`}
                                                >
                                                    <Check
                                                        size={12}
                                                        strokeWidth={
                                                            3
                                                        }
                                                    />
                                                </div>

                                                <span
                                                    className={`text-xs font-bold ${complete
                                                        ? 'text-[#33343a]'
                                                        : 'text-[#999a9f]'
                                                        }`}
                                                >
                                                    {label}
                                                </span>

                                            </div>
                                        )
                                    )}

                                </div>

                            </div>

                            {/* INFO */}

                            <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-5">

                                <div className="flex items-start gap-3">

                                    <Info
                                        size={16}
                                        className="mt-0.5 shrink-0 text-[#E5FE00]"
                                    />

                                    <div>

                                        <p className="text-xs font-black">
                                            Organizer controls
                                        </p>

                                        <p className="mt-1 text-[11px] font-medium leading-5 text-[#85868c]">
                                            Your competition starts as a
                                            draft. Registration and bracket
                                            controls can be handled after
                                            creation.
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