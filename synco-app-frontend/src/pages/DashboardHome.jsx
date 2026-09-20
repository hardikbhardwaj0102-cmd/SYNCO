import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Heart,
  MessageSquare,
  Pause,
  Play,
  Search,
  Target,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';

import '../styles/pages/DashboardHome.css';
import '../styles/pages/DashboardFriends.css';
import AdminDashboard from './AdminDashboard';
import { useAuth } from '../context/AuthContext';
import killjoyRender from '../assets/killjoy-render.png';


// =========================================================
// API URL
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// HELPERS
// =========================================================

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
});

const formatCount = (value) =>
  compactNumber.format(value || 0);

const showValue = (value) =>
  value === undefined ||
    value === null ||
    value === ''
    ? '--'
    : value;

const firstDefined = (...values) =>
  values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
  );

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
};


// =========================================================
// CLIP GAME NAME RESOLUTION
// =========================================================
//
// The dashboard supports both the new backend structure:
//
//   clip.game.name
//   clip.gameName
//   clip.gameId
//
// and older/alternate naming styles.
//
// If only gameId is returned, resolve it against /api/games.
// =========================================================

const resolveClipGameName = (
  clip,
  games = []
) => {

  const directName = firstDefined(
    clip?.gameName,
    clip?.game_name,
    clip?.game?.name,
    clip?.game?.shortName,
    clip?.game?.short_name
  );

  if (directName) {
    return String(directName).trim();
  }

  const gameId = firstDefined(
    clip?.gameId,
    clip?.game_id
  );

  if (gameId) {

    const matchedGame = games.find(
      (game) =>
        String(game?.id) ===
          String(gameId)
    );

    const catalogName = firstDefined(
      matchedGame?.name,
      matchedGame?.shortName,
      matchedGame?.short_name
    );

    if (catalogName) {
      return String(catalogName).trim();
    }
  }

  return '';
};


// =========================================================
// NORMALIZE CLIP
// =========================================================

const normalizeClip = (
  clip,
  games = []
) => {

  if (!clip) {
    return clip;
  }

  const description = firstDefined(
    clip.description,
    clip.clipDescription,
    clip.clip_description,
    ''
  );

  const gameName = resolveClipGameName(
    clip,
    games
  );

  return {
    ...clip,

    // -----------------------------------------------------
    // LIKE STATE
    // -----------------------------------------------------

    isLiked: Boolean(
      clip.isLiked ??
      clip.is_liked ??
      clip.liked ??
      false
    ),

    // -----------------------------------------------------
    // DESCRIPTION
    // -----------------------------------------------------

    description:
      description !== undefined &&
      description !== null
        ? String(description)
        : '',

    // -----------------------------------------------------
    // GAME
    // -----------------------------------------------------

    gameName:
      gameName || '',
  };
};


// =========================================================
// DASHBOARD HOME
// =========================================================

const DashboardHome = () => {

  const { user } = useAuth();

  const accountRole =
    user?.accountRole ??
    user?.account_role;

  const isAdmin = accountRole === 'admin';

  const gametag =
    user?.gametag ||
    user?.username ||
    'PLAYER';

  const [gameCatalog, setGameCatalog] = useState([]);
  const [profileGames, setProfileGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [clips, setClips] = useState([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [playingStates, setPlayingStates] = useState({});
  const [mutedStates, setMutedStates] = useState({});

  // =========================================================
  // FRIENDS + PRESENCE
  // =========================================================

  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsSidebarOpen, setFriendsSidebarOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(null);
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);

  const videoRefs = useRef({});
  const activeClipIdRef = useRef(null);

  const activeClip =
    clips[activeClipIndex] ?? null;

  const activeClipId =
    activeClip?.id ?? null;

  activeClipIdRef.current =
    activeClipId;


  // =========================================================
  // FRIEND HELPERS
  // =========================================================

  const getFriendFromItem = (item) =>
    item?.friend || item || {};

  const getFriendName = (friend) =>
    firstDefined(
      friend?.username,
      friend?.name,
      'PLAYER'
    );

  const getFriendInitial = (friend) =>
    String(
      getFriendName(friend)
    )
      .trim()
      .charAt(0)
      .toUpperCase() || 'P';

  const isFriendOnline = (friend) =>
    Boolean(
      friend?.isOnline ??
      friend?.online ??
      false
    );

  const loadFriends = async () => {

    try {

      setFriendsLoading(true);

      const response = await fetch(
        `${API_URL}/api/friends`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      const data = await response.json().catch(
        () => ({})
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to load friends.'
        );
      }

      setFriends(data.friends || []);
      setOnlineCount(
        Number(data.onlineCount || 0)
      );

      setFriendError('');

    } catch (error) {

      console.error(
        'Failed to load friends:',
        error
      );

      setFriendError(
        error.message ||
        'Unable to load friends.'
      );

    } finally {

      setFriendsLoading(false);

    }
  };


  const sendPresenceHeartbeat = async () => {

    try {

      await fetch(
        `${API_URL}/api/friends/presence/heartbeat`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        }
      );

    } catch (error) {

      console.debug(
        'Presence heartbeat failed:',
        error
      );

    }
  };


  const searchPlayers = async (query) => {

    const trimmed = String(query || '').trim();

    if (trimmed.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      return;
    }

    try {

      setFriendSearchLoading(true);
      setFriendError('');

      const response = await fetch(
        `${API_URL}/api/friends/search?q=${encodeURIComponent(trimmed)}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      const data = await response.json().catch(
        () => ({})
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to search players.'
        );
      }

      setFriendSearchResults(
        data.players || []
      );

    } catch (error) {

      console.error(
        'Friend search failed:',
        error
      );

      setFriendSearchResults([]);
      setFriendError(
        error.message ||
        'Unable to search players.'
      );

    } finally {

      setFriendSearchLoading(false);

    }
  };


  const sendFriendRequest = async (player) => {

    if (!player?.id) {
      return;
    }

    try {

      setFriendActionLoading(
        player.id
      );

      setFriendError('');
      setFriendSuccess('');

      const response = await fetch(
        `${API_URL}/api/friends/request`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            uid: player.uid,
          }),
        }
      );

      const data = await response.json().catch(
        () => ({})
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to send friend request.'
        );
      }

      setFriendSearchResults((previous) =>
        previous.map((item) =>
          item.id === player.id
            ? {
                ...item,
                friendStatus: 'PENDING',
                requestDirection: 'SENT',
              }
            : item
        )
      );

      setFriendSuccess(
        `Friend request sent to ${
          getFriendName(player)
        }.`
      );

    } catch (error) {

      console.error(
        'Send friend request failed:',
        error
      );

      setFriendError(
        error.message ||
        'Unable to send friend request.'
      );

    } finally {

      setFriendActionLoading(null);

    }
  };


  // =========================================================
  // FRIEND PRESENCE
  // =========================================================

  useEffect(() => {

    if (isAdmin) {
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {

      await Promise.all([
        sendPresenceHeartbeat(),
        loadFriends(),
      ]);

      if (cancelled) {
        return;
      }
    };

    refresh();

    const interval = setInterval(
      refresh,
      15000
    );

    const handleVisibilityChange = () => {

      if (
        document.visibilityState === 'visible'
      ) {
        sendPresenceHeartbeat();
        loadFriends();
      }

    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {

      cancelled = true;
      clearInterval(interval);

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );

    };

  }, [isAdmin]);


  // =========================================================
  // FRIEND SEARCH DEBOUNCE
  // =========================================================

  useEffect(() => {

    if (!addFriendOpen) {
      setFriendSearchResults([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      searchPlayers(friendSearch);
    }, 300);

    return () => {
      clearTimeout(timer);
    };

  }, [
    addFriendOpen,
    friendSearch,
  ]);


  // =========================================================
  // LOAD DASHBOARD DATA
  // =========================================================

  useEffect(() => {

    if (isAdmin) {
      return;
    }

    const loadDashboardData = async () => {

      try {

        const [
          catalogResponse,
          profileResponse,
          clipsResponse,
        ] = await Promise.all([

          fetch(
            `${API_URL}/api/games`,
            {
              method: 'GET',
              credentials: 'include',
            }
          ).catch(() => ({
            ok: false,
          })),

          fetch(
            `${API_URL}/api/profile`,
            {
              method: 'GET',
              credentials: 'include',
            }
          ).catch(() => ({
            ok: false,
          })),

          fetch(
            `${API_URL}/api/profile/clips`,
            {
              method: 'GET',
              credentials: 'include',
            }
          ).catch(() => ({
            ok: false,
          })),

        ]);

        // =====================================================
        // GAME CATALOG
        // =====================================================

        let loadedGameCatalog = [];

        if (catalogResponse?.ok) {

          const catalogData =
            await catalogResponse.json();

          loadedGameCatalog =
            catalogData.games || [];

          setGameCatalog(
            loadedGameCatalog
          );
        }

        // =====================================================
        // PROFILE GAMES
        // =====================================================

        if (profileResponse?.ok) {

          const profileData =
            await profileResponse.json();

          setProfileGames(
            profileData.games || []
          );
        }

        // =====================================================
        // CLIPS
        // =====================================================

        if (clipsResponse?.ok) {

          const clipsData =
            await clipsResponse.json();

          const loadedClips =
            (clipsData.clips || []).map(
              (clip) =>
                normalizeClip(
                  clip,
                  loadedGameCatalog
                )
            );

          setClips(
            loadedClips
          );

          setActiveClipIndex(0);
        }

      } catch (error) {

        console.error(
          'Failed to load dashboard data:',
          error
        );

      }

    };

    loadDashboardData();

  }, [isAdmin]);


  // =========================================================
  // REFRESH CLIP GAME NAMES WHEN CATALOG LOADS
  // =========================================================

  useEffect(() => {

    if (!gameCatalog.length || !clips.length) {
      return;
    }

    setClips((previousClips) =>
      previousClips.map((clip) => {

        const resolvedGameName =
          resolveClipGameName(
            clip,
            gameCatalog
          );

        if (
          !resolvedGameName ||
          resolvedGameName === clip.gameName
        ) {
          return clip;
        }

        return {
          ...clip,
          gameName: resolvedGameName,
        };
      })
    );

  }, [gameCatalog]);


  // =========================================================
  // GAME LIST + DEFAULT SELECTED GAME
  // "Your Games" = only the games on the player's profile.
  // =========================================================

  const gameOptions = useMemo(
    () =>
      profileGames.map(
        (game) => game.gameName
      ),
    [profileGames]
  );


  useEffect(() => {

    if (!profileGames.length) {

      setSelectedGame('');

      return;
    }

    if (
      !selectedGame ||
      !profileGames.some(
        (game) =>
          game.gameName === selectedGame
      )
    ) {

      setSelectedGame(
        profileGames[0].gameName
      );
    }

  }, [
    profileGames,
    selectedGame,
  ]);


  const selectedStats =
    profileGames.find(
      (game) =>
        game.gameName === selectedGame
    );


  // =========================================================
  // COMMENTS FOR THE ACTIVE CLIP
  // =========================================================

  useEffect(() => {

    if (!activeClipId) {

      setComments([]);

      return undefined;
    }

    let cancelled = false;

    const loadComments = async () => {

      setComments([]);

      setCommentText('');

      setCommentError('');

      setCommentsLoading(true);

      try {

        const response =
          await fetch(
            `${API_URL}/api/profile/clips/${activeClipId}/comments`,
            {
              credentials: 'include',
              headers: {
                Accept: 'application/json',
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.message ||
            'Unable to load comments.'
          );
        }

        if (!cancelled) {

          setComments(
            data.comments || []
          );
        }

      } catch (error) {

        if (!cancelled) {

          setCommentError(
            error.message ||
            'Unable to load comments.'
          );
        }

      } finally {

        if (!cancelled) {

          setCommentsLoading(
            false
          );
        }

      }

    };

    loadComments();

    return () => {

      cancelled = true;
    };

  }, [activeClipId]);


  // =========================================================
  // VIDEO PLAYBACK
  // =========================================================

  useEffect(() => {

    clips.forEach(
      (clip, index) => {

        const video =
          videoRefs.current[
          clip.id
          ];

        if (!video) {
          return;
        }

        if (
          index === activeClipIndex
        ) {

          video
            .play()
            .catch(() => {
              setPlayingStates((previous) => ({
                ...previous,
                [clip.id]: false,
              }));
            });

        } else {

          video.pause();

          setPlayingStates((previous) => ({
            ...previous,
            [clip.id]: false,
          }));
        }

      }
    );

  }, [
    clips,
    activeClipIndex,
  ]);


  const togglePlayback = (
    clipId
  ) => {

    const video =
      videoRefs.current[
      clipId
      ];

    if (!video) {
      return;
    }

    if (video.paused) {

      video
        .play()
        .catch(() => { });

    } else {

      video.pause();
    }
  };


  const toggleMute = (
    clipId
  ) => {

    const video =
      videoRefs.current[
      clipId
      ];

    if (!video) {
      return;
    }

    const nextMuted =
      !video.muted;

    video.muted = nextMuted;

    setMutedStates((previous) => ({
      ...previous,
      [clipId]: nextMuted,
    }));
  };


  // =========================================================
  // COVERFLOW NAVIGATION
  // =========================================================

  const nextClip = () => {

    if (!clips.length) {
      return;
    }

    setActiveClipIndex(
      (previous) =>
        (
          previous + 1
        ) % clips.length
    );
  };


  const prevClip = () => {

    if (!clips.length) {
      return;
    }

    setActiveClipIndex(
      (previous) =>
        (
          previous - 1 + clips.length
        ) % clips.length
    );
  };


  // =========================================================
  // LIKE / UNLIKE CLIP
  // =========================================================

  const handleLikeClip = async (
    clipId
  ) => {

    try {

      const response =
        await fetch(
          `${API_URL}/api/profile/clips/${clipId}/like`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.message ||
          'Unable to like this clip.'
        );
      }

      setClips(
        (previousClips) =>
          previousClips.map(
            (clip) =>
              clip.id === clipId
                ? {
                  ...clip,

                  isLiked:
                    Boolean(
                      data.liked
                    ),

                  likes:
                    data.likes,
                }
                : clip
          )
      );

    } catch (error) {

      console.error(
        'Like failed:',
        error
      );
    }
  };


  // =========================================================
  // POST COMMENT
  // =========================================================

  const submitComment = async () => {

    if (
      !activeClip ||
      !commentText.trim()
    ) {

      return;
    }

    const clipId =
      activeClip.id;

    try {

      const response =
        await fetch(
          `${API_URL}/api/profile/clips/${clipId}/comments`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type':
                'application/json',

              Accept:
                'application/json',
            },

            body: JSON.stringify({
              content:
                commentText.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.message ||
          'Unable to post comment.'
        );
      }

      setClips(
        (previousClips) =>
          previousClips.map(
            (clip) =>
              clip.id === clipId
                ? {
                  ...clip,

                  comments:
                    (
                      clip.comments ||
                      0
                    ) + 1,
                }
                : clip
          )
      );

      if (
        activeClipIdRef.current ===
        clipId
      ) {

        setComments(
          (currentComments) => [
            ...currentComments,
            data,
          ]
        );

        setCommentText('');

        setCommentError('');
      }

    } catch (error) {

      setCommentError(
        error.message ||
        'Unable to post comment.'
      );
    }
  };


  const handleCommentKeyDown = (
    event
  ) => {

    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {

      event.preventDefault();

      submitComment();
    }
  };


  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  if (isAdmin) {

    return (
      <AdminDashboard />
    );
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="bento-dashboard-wrapper">

      {/* =========================================
          COLUMN 2: MAIN LEFT
          ========================================= */}

      <div className="col-main-left">

        {/* =========================================
            GREETINGS
            ========================================= */}

        <div className="wire-block greetings-pill">

          <h2
            style={{
              fontSize: '1.1rem',
              margin: 0,
            }}
          >

            {getGreeting()},{' '}

            <span className="text-highlight font-bold">
              {gametag}
            </span>

          </h2>

        </div>


        {/* =========================================
            FEATURED TOURNAMENT
            ========================================= */}

        <div className="wire-block tournaments-card">

          <span className="live-badge">

            <span className="dot"></span>

            LIVE NOW

          </span>

          <h1 className="block-title">

            SYNCO
            <br />
            Summer Cup

          </h1>

          <p className="hero-comp-sub">

            Prize Pool: 50,000 CR

          </p>

          <button className="join-btn">

            Register Roster

          </button>

          <img
            src={killjoyRender}
            alt="Character Popup"
            className="hero-character-render"
          />

        </div>


        {/* =========================================
            SYNCO MOMENTS
            ========================================= */}

        <div className="bento-card highlights-section">

          <h3 className="section-label">

            SYNCO MOMENTS

          </h3>

          {activeClip && (

            <div className="clip-game-tag">

              {
                resolveClipGameName(
                  activeClip,
                  gameCatalog
                ) ||
                'Unspecified'
              }

            </div>

          )}

          <div className="coverflow-container">

            {activeClip ? (

              <>

                {/* =====================================
                    LEFT OVERLAY
                    ===================================== */}

                <div className="coverflow-left-overlay">

                  <h2 className="clip-title-massive">

                    {activeClip.title}

                  </h2>

                  <div className="clip-description">

                    Description:{' '}

                    {
                      activeClip.description?.trim() ||
                      'No description provided.'
                    }

                  </div>

                  {/* =================================
                      LIKE BUTTON
                      ================================= */}

                  <div className="clip-actions">

                    <button
                      type="button"

                      onClick={(event) => {
                        event.stopPropagation();
                        handleLikeClip(
                          activeClip.id
                        );
                      }}

                      aria-pressed={
                        Boolean(
                          activeClip.isLiked
                        )
                      }

                      aria-label={
                        activeClip.isLiked
                          ? 'Unlike this clip'
                          : 'Like this clip'
                      }
                    >

                      <Heart
                        size={18}

                        fill={
                          activeClip.isLiked
                            ? '#ff4655'
                            : 'none'
                        }

                        color={
                          activeClip.isLiked
                            ? '#ff4655'
                            : 'currentColor'
                        }
                      />

                      {formatCount(
                        activeClip.likes
                      )}

                    </button>

                  </div>

                </div>



                {/* =====================================
                    VIDEOS
                    ===================================== */}

                <div className="coverflow-track">

                  {clips.map(
                    (clip, index) => {

                      let positionClass =
                        'clip-hidden';

                      if (
                        index ===
                        activeClipIndex
                      ) {

                        positionClass =
                          'clip-center';

                      } else if (
                        index ===
                        (
                          activeClipIndex -
                          1 +
                          clips.length
                        ) %
                        clips.length
                      ) {

                        positionClass =
                          'clip-left';

                      } else if (
                        index ===
                        (
                          activeClipIndex +
                          1
                        ) %
                        clips.length
                      ) {

                        positionClass =
                          'clip-right';
                      }

                      const isCenter =
                        index ===
                        activeClipIndex;

                      return (

                        <div
                          key={clip.id}
                          className={`clip-card ${positionClass}`}
                        >

                          <video
                            ref={(element) => {

                              if (element) {

                                videoRefs.current[
                                  clip.id
                                ] = element;

                              } else {

                                delete videoRefs.current[
                                  clip.id
                                ];
                              }

                            }}

                            src={clip.url}

                            muted={
                              mutedStates[
                                clip.id
                              ] ?? true
                            }

                            loop

                            playsInline

                            preload={
                              isCenter
                                ? 'auto'
                                : 'metadata'
                            }

                            onPlay={() => {
                              setPlayingStates(
                                (previous) => ({
                                  ...previous,
                                  [clip.id]: true,
                                })
                              );
                            }}

                            onPause={() => {
                              setPlayingStates(
                                (previous) => ({
                                  ...previous,
                                  [clip.id]: false,
                                })
                              );
                            }}
                          />

                          {isCenter && (

                            <>

                              <button
                                type="button"
                                className="video-control play-control"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  togglePlayback(
                                    clip.id
                                  );
                                }}
                                aria-label={
                                  playingStates[
                                    clip.id
                                  ]
                                    ? 'Pause video'
                                    : 'Play video'
                                }
                              >

                                {playingStates[
                                  clip.id
                                ] ? (
                                  <Pause size={28} />
                                ) : (
                                  <Play size={28} />
                                )}

                              </button>

                              <button
                                type="button"
                                className="video-control mute-control"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleMute(
                                    clip.id
                                  );
                                }}
                                aria-label={
                                  mutedStates[
                                    clip.id
                                  ]
                                    ? 'Unmute video'
                                    : 'Mute video'
                                }
                              >

                                {mutedStates[
                                  clip.id
                                ] ? (
                                  <VolumeX size={17} />
                                ) : (
                                  <Volume2 size={17} />
                                )}

                              </button>

                            </>

                          )}

                        </div>

                      );
                    }
                  )}

                </div>


                {/* =====================================
                    RIGHT OVERLAY — COMMENTS
                    ===================================== */}

                <div className="coverflow-right-overlay comments-panel">

                  <h4 className="comments-header">

                    <MessageSquare size={14} />

                    Comments (
                    {activeClip.comments || 0}
                    )

                  </h4>

                  <div className="comments-list">

                    {commentsLoading && (

                      <p className="empty-comms">

                        Loading comments...

                      </p>

                    )}

                    {!commentsLoading &&
                      !commentError &&
                      comments.length === 0 && (

                        <p className="empty-comms">

                          No comments yet

                        </p>

                      )}

                    {comments.map(
                      (comment) => (

                        <div
                          key={comment.id}
                          className="comment-item"
                        >

                          <span className="comment-user">

                            {comment.author}:

                          </span>{' '}

                          {comment.content}

                        </div>

                      )
                    )}

                    {commentError && (

                      <p
                        className="empty-comms"

                        style={{
                          color: '#ff4655',
                        }}
                      >

                        {commentError}

                      </p>

                    )}

                  </div>

                  <input
                    type="text"
                    placeholder="Add a comment"
                    className="comment-input"
                    value={commentText}
                    maxLength={1000}

                    onChange={(event) =>
                      setCommentText(
                        event.target.value
                      )
                    }

                    onKeyDown={
                      handleCommentKeyDown
                    }
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  />

                </div>


                {/* =====================================
                    NAVIGATION
                    ===================================== */}

                {clips.length > 1 && (

                  <>

                    <button
                      type="button"
                      className="nav-btn prev-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        prevClip();
                      }}
                      aria-label="Previous clip"
                    >

                      <ChevronLeft size={22} />

                    </button>

                    <button
                      type="button"
                      className="nav-btn next-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        nextClip();
                      }}
                      aria-label="Next clip"
                    >

                      <ChevronRight size={22} />

                    </button>

                  </>

                )}

              </>

            ) : (

              <p
                className="empty-comms"
                style={{
                  textAlign: 'center',
                }}
              >

                No clips yet. Add clips to
                your showcase and they will
                show up here.

              </p>

            )}

          </div>

        </div>

      </div>


      {/* =========================================
          COLUMN 3: MAIN RIGHT
          ========================================= */}

      <div className="col-main-right">

        {/* =========================================
            PREMIUM BANNER
            ========================================= */}

        <div className="wire-block premium-banner-pill">

          <span
            style={{
              fontWeight: 800,
              textTransform: 'uppercase',
              fontSize: '0.9rem',
            }}
          >

            Upgrade to SYNCO Premium

          </span>

          <Crown
            size={20}
            className="text-highlight"
          />

        </div>


        {/* =========================================
            GAMES + PROMO
            ========================================= */}

        <div className="mid-grid-row">

          <div className="bento-card game-selector-card">

            <h3 className="section-label">

              Your Games

            </h3>

            <div className="game-list">

              {gameOptions.length ? (

                gameOptions.map(
                  (game) => (

                    <button
                      type="button"
                      key={game}

                      className={`game-option ${selectedGame === game
                          ? 'active'
                          : ''
                        }`}

                      onClick={() =>
                        setSelectedGame(
                          game
                        )
                      }
                    >

                      <Target size={16} />

                      <span>
                        {game}
                      </span>

                    </button>

                  )
                )

              ) : (

                <p className="empty-comms">

                  No games yet

                </p>

              )}

            </div>

          </div>

          <div className="wire-block synco-promo-card">

            <h3
              style={{
                fontSize: '1rem',
                textTransform: 'uppercase',
                lineHeight: '1.4',
              }}
            >

              synco
              <br />
              promotional
              <br />
              banner

            </h3>

          </div>

        </div>


        {/* =========================================
            SYNCO RATING
            ========================================= */}

        <div className="bento-card stat-meter-card">

          <div className="stat-header-row">

            <h3 className="section-label">

              SYNCO Rating

            </h3>

            <Zap
              size={16}
              className="stat-icon"
            />

          </div>

          <div className="stat-meter-container">

            <div className="stat-glowing-blob"></div>

            <div className="rating-number">

              {showValue(
                selectedStats?.rating
              )}

            </div>

          </div>

          <div className="stat-breakdown">

            <div className="stat-pill">

              <span className="label">

                Class

              </span>

              <span className="value">

                {showValue(
                  selectedStats?.rank
                )}

              </span>

            </div>

            <div className="stat-pill">

              <span className="label">

                Win R.

              </span>

              <span className="value text-emerald">

                {showValue(
                  selectedStats?.winRate
                )}

              </span>

            </div>

            <div className="stat-pill">

              <span className="label">

                K/D

              </span>

              <span className="value">

                {showValue(
                  selectedStats?.kd
                )}

              </span>

            </div>

          </div>

        </div>

      </div>


      {/* =========================================
          COLUMN 4: FAR RIGHT SOCIAL CORNER
          FRIENDS LIVE ONLY INSIDE THE SOCIAL BLOCK
          DISCORD BLOCK REMAINS AS-IS
          ========================================= */}

      <div className="col-far-right synco-friends-column">

        {/* =========================================
            SOCIAL / FRIENDS CORNER
            ========================================= */}

        <div className="wire-block social-bar-top synco-social-friends-corner">

          <aside
            className={`synco-friends-sidebar ${
              friendsSidebarOpen
                ? 'is-open'
                : 'is-collapsed'
            }`}
          >

            {/* ---------------------------------------------------
                TOGGLE
                --------------------------------------------------- */}

            <button
              type="button"
              className="synco-friends-toggle"
              onClick={() =>
                setFriendsSidebarOpen(
                  (previous) => !previous
                )
              }
              aria-label={
                friendsSidebarOpen
                  ? 'Collapse friends sidebar'
                  : 'Open friends sidebar'
              }
            >

              {friendsSidebarOpen ? (
                <ChevronRight size={15} />
              ) : (
                <ChevronLeft size={15} />
              )}

            </button>


            {/* ---------------------------------------------------
                COLLAPSED FRIENDS RAIL
                --------------------------------------------------- */}

            {!friendsSidebarOpen && (

              <div className="synco-friends-collapsed">

                <div className="synco-friends-collapsed-header">

                  <span
                    className="synco-friends-online-count"
                    title={`${onlineCount} online`}
                  >
                    {onlineCount}
                  </span>

                </div>

                <div className="synco-friends-avatar-stack">

                  {friends.slice(0, 6).map((item) => {

                    const friend =
                      getFriendFromItem(item);

                    const online =
                      isFriendOnline(friend);

                    const name =
                      getFriendName(friend);

                    return (

                      <div
                        key={
                          friend.id ??
                          item.id
                        }
                        className="synco-friend-mini"
                        title={`${name} · ${online ? 'Online' : 'Offline'}`}
                      >

                        <div className="synco-friend-mini-avatar">

                          {friend.avatar ? (

                            <img
                              src={friend.avatar}
                              alt={name}
                            />

                          ) : (

                            <span>
                              {getFriendInitial(
                                friend
                              )}
                            </span>

                          )}

                        </div>

                        <span
                          className={`synco-presence-dot ${
                            online
                              ? 'online'
                              : 'offline'
                          }`}
                        />

                      </div>

                    );
                  })}

                </div>

                <button
                  type="button"
                  className="synco-add-friend-mini"
                  onClick={() => {
                    setFriendsSidebarOpen(true);
                    setAddFriendOpen(true);
                    setFriendError('');
                    setFriendSuccess('');
                  }}
                  aria-label="Add friend"
                  title="Add friend"
                >
                  <UserPlus size={14} />
                </button>

              </div>

            )}


            {/* ---------------------------------------------------
                OPEN FRIENDS PANEL
                --------------------------------------------------- */}

            {friendsSidebarOpen && (

              <div className="synco-friends-open">

                <div className="synco-friends-panel-header">

                  <div>

                    <p className="synco-friends-kicker">
                      SOCIAL
                    </p>

                    <h3>
                      Friends
                    </h3>

                    <p className="synco-friends-meta">
                      {onlineCount} online · {friends.length} total
                    </p>

                  </div>

                  <button
                    type="button"
                    className="synco-friends-close-button"
                    onClick={() => {
                      setFriendsSidebarOpen(false);
                      setAddFriendOpen(false);
                    }}
                    aria-label="Close friends sidebar"
                  >
                    <X size={14} />
                  </button>

                </div>

                <button
                  type="button"
                  className={`synco-add-friend-button ${
                    addFriendOpen
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => {
                    setAddFriendOpen(
                      (previous) => !previous
                    );
                    setFriendError('');
                    setFriendSuccess('');
                  }}
                >
                  <UserPlus size={14} />
                  <span>Add Friend</span>
                </button>

                {addFriendOpen && (

                  <div className="synco-add-friend-section">

                    <div className="synco-friend-search-wrap">
                      <Search size={14} />
                      <input
                        type="text"
                        value={friendSearch}
                        onChange={(event) =>
                          setFriendSearch(
                            event.target.value
                          )
                        }
                        placeholder="Username or SYNCO UID"
                        autoComplete="off"
                      />
                    </div>

                    {friendSearchLoading && (
                      <p className="synco-friends-status-text">
                        Searching players...
                      </p>
                    )}

                    {!friendSearchLoading &&
                      friendSearch.trim().length >= 2 &&
                      friendSearchResults.length === 0 && (
                        <p className="synco-friends-status-text">
                          No players found.
                        </p>
                      )}

                    {friendSearchResults.length > 0 && (

                      <div className="synco-friend-search-results">

                        {friendSearchResults.map((player) => {

                          const playerName =
                            getFriendName(player);

                          const status =
                            player.friendStatus;

                          const isSending =
                            friendActionLoading ===
                            player.id;

                          return (

                            <div
                              key={player.id}
                              className="synco-friend-search-result"
                            >

                              <div className="synco-friend-search-avatar">

                                {player.avatar ? (
                                  <img
                                    src={player.avatar}
                                    alt={playerName}
                                  />
                                ) : (
                                  <span>
                                    {getFriendInitial(player)}
                                  </span>
                                )}

                              </div>

                              <div className="synco-friend-search-info">
                                <p>{playerName}</p>
                                <span>
                                  {player.uid || 'SYNCO PLAYER'}
                                </span>
                              </div>

                              <button
                                type="button"
                                className="synco-friend-search-action"
                                disabled={
                                  isSending ||
                                  status === 'FRIENDS' ||
                                  (
                                    status === 'PENDING' &&
                                    player.requestDirection === 'SENT'
                                  )
                                }
                                onClick={() =>
                                  sendFriendRequest(player)
                                }
                              >
                                {isSending
                                  ? '...'
                                  : status === 'FRIENDS'
                                    ? 'Friends'
                                    : status === 'PENDING'
                                      ? player.requestDirection === 'RECEIVED'
                                        ? 'Pending'
                                        : 'Sent'
                                      : 'Add'}
                              </button>

                            </div>

                          );
                        })}

                      </div>

                    )}

                    {friendError && (
                      <p className="synco-friends-message error">
                        {friendError}
                      </p>
                    )}

                    {friendSuccess && (
                      <p className="synco-friends-message success">
                        {friendSuccess}
                      </p>
                    )}

                  </div>

                )}

                <div className="synco-friends-list-header">
                  <span>Your Friends</span>
                  {friendsLoading && (
                    <span className="synco-friends-refreshing">
                      Updating...
                    </span>
                  )}
                </div>

                <div className="synco-friends-list">

                  {friends.length === 0 && !friendsLoading && (

                    <div className="synco-friends-empty">
                      <div className="synco-friends-empty-icon">
                        <UserPlus size={15} />
                      </div>
                      <p>No friends yet</p>
                      <span>
                        Add players using their username or SYNCO UID.
                      </span>
                    </div>

                  )}

                  {friends.map((item) => {

                    const friend =
                      getFriendFromItem(item);

                    const online =
                      isFriendOnline(friend);

                    const name =
                      getFriendName(friend);

                    return (

                      <div
                        key={friend.id ?? item.id}
                        className="synco-friend-row"
                      >

                        <div className="synco-friend-avatar">

                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={name}
                            />
                          ) : (
                            <span>
                              {getFriendInitial(friend)}
                            </span>
                          )}

                          <span
                            className={`synco-presence-dot large ${
                              online
                                ? 'online'
                                : 'offline'
                            }`}
                          />

                        </div>

                        <div className="synco-friend-details">
                          <p>{name}</p>
                          <span>
                            {online
                              ? 'Online now'
                              : 'Offline'}
                          </span>
                        </div>

                      </div>

                    );
                  })}

                </div>

              </div>

            )}

          </aside>

        </div>


        {/* =========================================
            DISCORD INTEGRATION
            EXISTING CONTENT KEPT UNCHANGED
            ========================================= */}

        <div className="wire-block social-bar-bottom">

          <span className="vertical-text">
            discord right bar
          </span>

        </div>

      </div>

    </div>

  );
};

export default DashboardHome;
