import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings,
  Share2,
  Plus,
  X,
  ChevronDown,
  Copy,
  Check,
  Video,
  Gamepad2,
  Users,
  Clock,
  Trophy,
  Edit3,
  Instagram,
  Youtube,
  Twitch,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

import '../styles/pages/ProfileView.css';
import '../styles/components/GameLogos.css';

import characterBg from '../assets/hero-bg.png';

const API_URL = 'https://synco-backend-vi7b.onrender.com';

const GAME_LOGOS = {
  bgmi: '/games/bgmi.png.png',
  cr: '/games/clashroyale.png.png',
  freefire: '/games/freefire.png.png',
  pubg: '/games/pubg.png.png',
  pubgm: '/games/pubgm.png.png',
  val: '/games/valorant.png.png',
};

const SOCIAL_PROFILE_BASES = {
  youtube: 'https://youtube.com/',
  instagram: 'https://instagram.com/',
  twitch: 'https://twitch.tv/',
  x: 'https://x.com/',
};

const TABS = [
  'GAMES',
  'HIGHLIGHTS',
  'FRIENDS',
  'CLUBS',
  'ACTIVE COMP',
];

const externalSocialUrl = (value, platform) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return '';
  }

  if (/^(https?:)?\/\//i.test(trimmedValue)) {
    return trimmedValue.startsWith('//')
      ? `https:${trimmedValue}`
      : trimmedValue;
  }

  if (/^www\./i.test(trimmedValue) || trimmedValue.includes('.')) {
    return `https://${trimmedValue}`;
  }

  return `${SOCIAL_PROFILE_BASES[platform]}${trimmedValue.replace(/^@/, '')}`;
};

const getGameLogo = (gameId, gameName = '') => {
  if (gameId && GAME_LOGOS[gameId]) {
    return GAME_LOGOS[gameId];
  }

  const normalizedName = gameName
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const nameMap = {
    bgmi: GAME_LOGOS.bgmi,
    clashroyale: GAME_LOGOS.cr,
    freefire: GAME_LOGOS.freefire,
    freefiremax: GAME_LOGOS.freefire,
    pubg: GAME_LOGOS.pubg,
    pubgbattlegrounds: GAME_LOGOS.pubg,
    pubgm: GAME_LOGOS.pubgm,
    pubgmobile: GAME_LOGOS.pubgm,
    valorant: GAME_LOGOS.val,
  };

  return nameMap[normalizedName] || '';
};

const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
};

const getProfileAvatar = (profile) => {
  return (
    profile?.avatarUrl ||
    profile?.avatar_url ||
    profile?.avatar ||
    profile?.profilePicture ||
    profile?.profile_picture ||
    ''
  );
};

const getJoinedDate = (profile) => {
  return (
    profile?.joinedDate ||
    profile?.joined_date ||
    profile?.createdAt ||
    profile?.created_at ||
    ''
  );
};

const getElo = (profile) => {
  return (
    profile?.stats?.elo ??
    profile?.stats?.rating ??
    profile?.elo ??
    profile?.rating ??
    2405
  );
};

const getMatches = (profile) => {
  return (
    profile?.stats?.matches ??
    profile?.matchesPlayed ??
    profile?.matches_played ??
    0
  );
};

const getRegion = (profile) => {
  return (
    profile?.region ||
    profile?.country ||
    'INDIA'
  );
};

const ProfileView = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const { user } = useAuth();

  const contentRef = useRef(null);

  const [activeTab, setActiveTab] = useState('GAMES');
  const [profile, setProfile] = useState(null);
  const [gameCatalog, setGameCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [uidCopied, setUidCopied] = useState(false);

  const [isAddClipModalOpen, setIsAddClipModalOpen] =
    useState(false);

  const [isClipGameMenuOpen, setIsClipGameMenuOpen] =
    useState(false);

  const [newClip, setNewClip] = useState({
    title: '',
    description: '',
    game: '',
    gameId: '',
    roleTag: '',
    skillTag: '',
    file: null,
  });

  const [isUploadingClip, setIsUploadingClip] =
    useState(false);

  const [clipUploadError, setClipUploadError] =
    useState('');

  const roleTags = [
    'Duelist',
    'IGL',
    'Sniper',
    'Support',
    'Controller',
    'Sentinel',
    'Flex',
  ];

  const skillTags = [
    'Clutch',
    'Ace',
    'Entry',
    'Skill/Mechanics',
    'Teamplay',
    'Strategy',
  ];

  // =========================================================
  // LOAD PROFILE + GAME CATALOG
  // =========================================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [
          profileResponse,
          catalogResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/api/profile/${encodeURIComponent(
              username
            )}`,
            {
              credentials: 'include',
              headers: {
                Accept: 'application/json',
              },
              cache: 'no-store',
            }
          ),

          fetch(`${API_URL}/api/games`, {
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
            cache: 'no-store',
          }),
        ]);

        if (!profileResponse.ok) {
          throw new Error('Profile not found');
        }

        const profileData =
          await profileResponse.json();

        setProfile(profileData);

        if (catalogResponse.ok) {
          const catalogData =
            await catalogResponse.json();

          setGameCatalog(
            catalogData.games ||
              catalogData ||
              []
          );
        }
      } catch (loadError) {
        console.error(
          'Error loading profile:',
          loadError
        );

        setError(
          loadError.message ||
            'Unable to load profile.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (username) {
      loadData();
    }
  }, [username]);

  // =========================================================
  // OWNER
  // =========================================================

  const isOwner =
    profile?.isOwner ||
    user?.username === username;

  // =========================================================
  // PROFILE DATA
  // =========================================================

  const moments = profile?.clips || [];
  const games = profile?.games || [];

  const avatar = getProfileAvatar(profile);

  const joinedDate = useMemo(
    () => formatDate(getJoinedDate(profile)),
    [profile]
  );

  const region = getRegion(profile);
  const elo = getElo(profile);
  const matches = getMatches(profile);

  // =========================================================
  // SCROLL TO PROFILE CONTENT
  // =========================================================

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  // =========================================================
  // SHARE PROFILE
  // =========================================================

  const shareProfile = async () => {
    const profileUrl =
      window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.username || username} — SYNCO`,
          url: profileUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(
        profileUrl
      );
    } catch {
      window.prompt(
        'Copy this profile link:',
        profileUrl
      );
    }
  };

  // =========================================================
  // COPY UID
  // =========================================================

  const copySyncoUid = async () => {
    if (!profile?.uid) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        profile.uid
      );

      setUidCopied(true);

      setTimeout(() => {
        setUidCopied(false);
      }, 2000);
    } catch (copyError) {
      console.error(
        'Failed to copy SYNCO UID:',
        copyError
      );
    }
  };

  // =========================================================
  // ADD CLIP
  // =========================================================

  const handleAddClipSubmit = async (e) => {
    e.preventDefault();

    if (!newClip.file) {
      setClipUploadError(
        'Please select a video file to upload.'
      );

      return;
    }

    if (!newClip.gameId) {
      setClipUploadError(
        'Please select a game.'
      );

      return;
    }

    setClipUploadError('');
    setIsUploadingClip(true);

    try {
      const metadata =
        await new Promise(
          (resolve, reject) => {
            const video =
              document.createElement(
                'video'
              );

            const objectUrl =
              URL.createObjectURL(
                newClip.file
              );

            video.preload = 'metadata';

            video.onloadedmetadata = () => {
              URL.revokeObjectURL(
                objectUrl
              );

              resolve({
                duration:
                  video.duration,
                width:
                  video.videoWidth,
                height:
                  video.videoHeight,
              });
            };

            video.onerror = () => {
              URL.revokeObjectURL(
                objectUrl
              );

              reject(
                new Error(
                  'The selected file is not a readable video.'
                )
              );
            };

            video.src = objectUrl;
          }
        );

      if (metadata.duration > 120) {
        throw new Error(
          'Clips must be 120 seconds or shorter.'
        );
      }

      if (
        metadata.width < 1280 ||
        metadata.height < 720 ||
        metadata.width > 1920 ||
        metadata.height > 1080
      ) {
        throw new Error(
          'Clips must be between 720p and 1080p.'
        );
      }

      const formData =
        new FormData();

      formData.append(
        'title',
        newClip.title ||
          'Gameplay clip'
      );

      formData.append(
        'clip',
        newClip.file
      );

      formData.append(
        'description',
        newClip.description
      );

      formData.append(
        'gameId',
        newClip.gameId
      );

      formData.append(
        'roleTag',
        newClip.roleTag
      );

      formData.append(
        'skillTag',
        newClip.skillTag
      );

      formData.append(
        'durationSeconds',
        metadata.duration
      );

      formData.append(
        'width',
        metadata.width
      );

      formData.append(
        'height',
        metadata.height
      );

      const response =
        await fetch(
          `${API_URL}/api/profile/clips`,
          {
            method: 'POST',
            credentials: 'include',
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Upload failed.'
        );
      }

      setProfile((previous) => ({
        ...previous,
        clips: [
          data,
          ...(previous.clips || []),
        ],
      }));

      setIsAddClipModalOpen(false);
      setIsClipGameMenuOpen(false);

      setNewClip({
        title: '',
        description: '',
        game: '',
        gameId: '',
        roleTag: '',
        skillTag: '',
        file: null,
      });
    } catch (uploadError) {
      console.error(
        'Error uploading clip:',
        uploadError
      );

      setClipUploadError(
        uploadError.message ||
          'Unable to upload clip.'
      );
    } finally {
      setIsUploadingClip(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (isLoading) {
    return (
      <div className="profile-view-state">
        Loading interface...
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error || !profile) {
    return (
      <div className="profile-view-state">
        Operative Not Found.
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="profile-page">

      {/* ===================================================
          HERO
          =================================================== */}

      <section className="profile-hero">

        <div className="profile-hero-background">
          <img
            src={characterBg}
            alt=""
            className="profile-character"
          />
        </div>

        <div className="profile-hero-vignette" />

        {/* LEFT IDENTITY CARD */}

        <aside className="profile-hero-left">

          <div className="profile-identity-card">

            <div className="profile-avatar">
              {avatar ? (
                <img
                  src={avatar}
                  alt={profile.username}
                />
              ) : (
                <div className="profile-avatar-placeholder">
                  {profile.username
                    ?.slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div className="profile-identity-content">

              <h1>
                {profile.username}
              </h1>

              <button
                type="button"
                className="profile-uid"
                onClick={copySyncoUid}
                title="Copy SYNCO UID"
              >
                <span>
                  UID: {profile.uid || '—'}
                </span>

                {uidCopied ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
              </button>

              <div className="profile-identity-actions">

                {isOwner && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate('/settings')
                    }
                  >
                    <Edit3 size={25} />
                    <span>
                      EDIT
                      <br />
                      PROFILE
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={shareProfile}
                >
                  <Share2 size={25} />
                  <span>
                    SHARE
                    <br />
                    PROFILE
                  </span>
                </button>

              </div>

              <div className="profile-social-row">

                {profile.socials?.instagram && (
                  <a
                    href={externalSocialUrl(
                      profile.socials.instagram,
                      'instagram'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                  >
                    <Instagram size={24} />
                  </a>
                )}

                {profile.socials?.youtube && (
                  <a
                    href={externalSocialUrl(
                      profile.socials.youtube,
                      'youtube'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                  >
                    <Youtube size={24} />
                  </a>
                )}

                {profile.socials?.twitch && (
                  <a
                    href={externalSocialUrl(
                      profile.socials.twitch,
                      'twitch'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Twitch"
                  >
                    <Twitch size={24} />
                  </a>
                )}

                {profile.socials?.x && (
                  <a
                    href={externalSocialUrl(
                      profile.socials.x,
                      'x'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="X"
                  >
                    X
                  </a>
                )}

              </div>

            </div>
          </div>

          <div className="profile-ad-card">
            ADVERTISEMENT
          </div>

        </aside>

        {/* SETTINGS */}

        <button
          type="button"
          className="profile-settings-button"
          onClick={() =>
            navigate('/settings')
          }
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={25} />
        </button>

        {/* XP BAR */}

        <div className="profile-xp-bar">

          <div className="profile-xp-character">
            <img
              src={
                avatar ||
                characterBg
              }
              alt=""
            />
          </div>

          <div className="profile-xp-track">

            <div className="profile-xp-fill" />

            <div className="profile-xp-numbers">
              <span>
                {profile.xp?.current ||
                  2056}
              </span>

              <span>/</span>

              <span>
                {profile.xp?.max ||
                  4070}
              </span>
            </div>

          </div>

        </div>

      </section>

      {/* ===================================================
          CONTENT AREA
          =================================================== */}

      <section
        ref={contentRef}
        className="profile-content"
      >

        {/* =================================================
            COMMON LEFT COLUMN
            ================================================= */}

        <aside className="profile-common-column">

          <div className="profile-common-card profile-bio-card">

            <h2>BIO:</h2>

            <p>
              {profile.bio ||
                profile.description ||
                ''}
            </p>

          </div>

          <div className="profile-common-card profile-activity-card">

            <h2>
              RECENT ACTIVITY:
            </h2>

            <div className="activity-calendar">

              <div className="activity-calendar-header">
                <span>
                  November
                </span>

                <ChevronRight size={20} />
              </div>

              <div className="activity-grid">
                {Array.from({
                  length: 35,
                }).map((_, index) => {
                  const intensity =
                    index === 11
                      ? 'high'
                      : index === 12 ||
                        index === 13 ||
                        index === 18 ||
                        index === 19 ||
                        index === 20
                      ? 'medium'
                      : index === 22 ||
                        index === 27
                      ? 'low'
                      : '';

                  return (
                    <span
                      key={index}
                      className={`activity-cell ${intensity}`}
                    />
                  );
                })}
              </div>

            </div>

            <div className="profile-meta-grid">

              <div>
                <span>
                  JOINED
                </span>

                <strong>
                  {joinedDate}
                </strong>
              </div>

              <div>
                <span>
                  REGION
                </span>

                <strong>
                  {region}
                </strong>
              </div>

            </div>

          </div>

          <div className="profile-common-card profile-badges-card">

            <h2>
              BADGES:
            </h2>

            <div className="profile-badges-content">

              {(profile.badges || []).length ===
              0 ? (
                <span className="empty-label">
                  No badges yet
                </span>
              ) : (
                profile.badges
                  .slice(0, 5)
                  .map((badge) => (
                    <div
                      key={
                        badge.id ||
                        badge.name
                      }
                      className="badge-item"
                    >
                      {badge.image ? (
                        <img
                          src={badge.image}
                          alt={
                            badge.name
                          }
                        />
                      ) : (
                        <Trophy size={22} />
                      )}
                    </div>
                  ))
              )}

            </div>

          </div>

        </aside>

        {/* =================================================
            RIGHT CONTENT
            ================================================= */}

        <main className="profile-main-column">

          {/* =================================================
              TAB BAR
              ================================================= */}

          <nav className="profile-tab-bar">

            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={
                  activeTab === tab
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  handleTabChange(tab)
                }
              >
                {tab}
              </button>
            ))}

          </nav>

          {/* =================================================
              GAMES
              ================================================= */}

          {activeTab === 'GAMES' && (
            <div className="profile-tab-content games-tab">

              {/* FIRST GAMES SECTION */}

              <section className="games-primary-grid">

                <div className="games-primary-left" />

                <div className="games-primary-right">

                  <div className="game-roster">

                    {games.length > 0 ? (
                      games.map((game) => (
                        <div
                          key={
                            game.id ||
                            game.gameId ||
                            game.gameName
                          }
                          className="game-roster-item"
                        >
                          <img
                            src={
                              getGameLogo(
                                game.id ||
                                  game.gameId,
                                game.gameName ||
                                  game.name
                              ) ||
                              '/games/default-placeholder.png'
                            }
                            alt={
                              game.gameName ||
                              game.name
                            }
                          />
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="game-roster-empty">
                          No registered games
                        </div>
                      </>
                    )}

                  </div>

                  <div className="performance-container">

                    <h2>
                      PERFORMANCE LAST 7 MATCHES:
                    </h2>

                    <div className="performance-chart">

                      <svg
                        viewBox="0 0 760 260"
                        preserveAspectRatio="none"
                        className="performance-svg"
                      >

                        <defs>
                          <linearGradient
                            id="performanceFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#d96868"
                              stopOpacity="0.20"
                            />

                            <stop
                              offset="100%"
                              stopColor="#d96868"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>

                        <path
                          d="M0 65 H760"
                          className="chart-grid"
                        />

                        <path
                          d="M0 130 H760"
                          className="chart-grid"
                        />

                        <path
                          d="M0 195 H760"
                          className="chart-grid"
                        />

                        <polyline
                          points="20,75 140,130 260,185 380,100 500,45 620,70 740,105"
                          className="chart-area"
                        />

                        <polygon
                          points="20,75 140,130 260,185 380,100 500,45 620,70 740,105 740,250 20,250"
                          className="chart-fill"
                        />

                        <polyline
                          points="20,75 140,130 260,185 380,100 500,45 620,70 740,105"
                          className="chart-line"
                        />

                        {[
                          [20, 75],
                          [140, 130],
                          [260, 185],
                          [380, 100],
                          [500, 45],
                          [620, 70],
                          [740, 105],
                        ].map(
                          ([cx, cy], index) => (
                            <circle
                              key={index}
                              cx={cx}
                              cy={cy}
                              r="8"
                              className="chart-point"
                            />
                          )
                        )}

                      </svg>

                    </div>

                    <div className="game-stat-cards">

                      <div />
                      <div />
                      <div />

                    </div>

                  </div>

                </div>

              </section>

              {/* SECOND GAMES SECTION */}

              <section className="games-secondary-grid">

                <aside className="active-season-card">

                  <h2>
                    ACTIVE SEASON
                  </h2>

                  <div className="season-number">
                    SEASON 1
                  </div>

                  <div className="season-beginning">
                    BEGINNING
                  </div>

                  <h3>
                    CURRENT RUNES:
                  </h3>

                  <div className="season-rune">

                    {profile.activeSeason?.runeImage ? (
                      <img
                        src={
                          profile.activeSeason.runeImage
                        }
                        alt="Current rune"
                      />
                    ) : (
                      <div className="rune-placeholder">
                        R
                      </div>
                    )}

                  </div>

                  <div className="season-matches-label">
                    MATCHES PLAYED:
                  </div>

                  <div className="season-matches">
                    {matches}
                  </div>

                </aside>

                <section className="match-history-container">

                  <h2>
                    MATCH HISTORY
                  </h2>

                  <div className="match-history-list">

                    {(profile.matchHistory || []).length >
                    0 ? (
                      profile.matchHistory.map(
                        (match, index) => (
                          <div
                            key={
                              match.id ||
                              index
                            }
                            className="match-history-row"
                          >
                            <span>
                              {match.game ||
                                'MATCH'}
                            </span>

                            <span>
                              {match.result ||
                                '—'}
                            </span>

                            <span>
                              {match.score ||
                                '—'}
                            </span>
                          </div>
                        )
                      )
                    ) : (
                      Array.from({
                        length: 5,
                      }).map(
                        (_, index) => (
                          <div
                            key={index}
                            className="match-history-row"
                          />
                        )
                      )
                    )}

                  </div>

                </section>

              </section>

            </div>
          )}

          {/* =================================================
              HIGHLIGHTS
              ================================================= */}

          {activeTab === 'HIGHLIGHTS' && (
            <div className="profile-tab-content">

              <div className="tab-action-row">

                {isOwner && (
                  <button
                    type="button"
                    className="pdf-pill-button"
                    onClick={() =>
                      setIsAddClipModalOpen(true)
                    }
                  >
                    ADD +
                  </button>
                )}

              </div>

              <div className="highlight-grid">

                {moments.length > 0 ? (
                  moments
                    .slice(0, 6)
                    .map((moment) => (
                      <div
                        key={moment.id}
                        className="highlight-card"
                      >
                        <video
                          src={moment.url}
                          muted
                          loop
                          playsInline
                          controls
                        />
                      </div>
                    ))
                ) : (
                  Array.from({
                    length: 6,
                  }).map((_, index) => (
                    <div
                      key={index}
                      className="highlight-card empty-card"
                    >
                      <Video size={32} />
                    </div>
                  ))
                )}

              </div>

              <Pagination />

            </div>
          )}

          {/* =================================================
              FRIENDS
              ================================================= */}

          {activeTab === 'FRIENDS' && (
            <div className="profile-tab-content">

              <div className="tab-action-row">

                <button
                  type="button"
                  className="pdf-pill-button"
                >
                  ALL (
                  {profile.friends?.length ||
                    0}
                  )
                </button>

              </div>

              <div className="friends-list">

                {(profile.friends || []).length >
                0 ? (
                  profile.friends.map(
                    (friend, index) => (
                      <div
                        key={
                          friend.id ||
                          friend.username ||
                          index
                        }
                        className="friend-row"
                      >

                        <div className="friend-avatar">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt=""
                            />
                          ) : (
                            <Users
                              size={20}
                            />
                          )}
                        </div>

                        <div className="friend-info">
                          <strong>
                            {friend.username ||
                              friend.name}
                          </strong>

                          <span>
                            {friend.status ||
                              'ONLINE'}
                          </span>
                        </div>

                      </div>
                    )
                  )
                ) : (
                  Array.from({
                    length: 5,
                  }).map((_, index) => (
                    <div
                      key={index}
                      className="friend-row empty-row"
                    />
                  ))
                )}

              </div>

              <Pagination />

            </div>
          )}

          {/* =================================================
              CLUBS
              ================================================= */}

          {activeTab === 'CLUBS' && (
            <div className="profile-tab-content">

              <h2 className="content-heading">
                JOINED / OWNED CLUBS:
              </h2>

              <div className="club-grid">

                {(profile.clubs || []).length >
                0 ? (
                  profile.clubs
                    .slice(0, 6)
                    .map((club, index) => (
                      <div
                        key={
                          club.id ||
                          club.name ||
                          index
                        }
                        className="club-card"
                      >
                        {club.logo && (
                          <img
                            src={club.logo}
                            alt=""
                          />
                        )}

                        <strong>
                          {club.name}
                        </strong>
                      </div>
                    ))
                ) : (
                  Array.from({
                    length: 6,
                  }).map((_, index) => (
                    <div
                      key={index}
                      className="club-card empty-card"
                    />
                  ))
                )}

              </div>

              <Pagination />

            </div>
          )}

          {/* =================================================
              ACTIVE COMP
              ================================================= */}

          {activeTab === 'ACTIVE COMP' && (
            <div className="profile-tab-content">

              <h2 className="content-heading">
                ACTIVE / UPCOMING
                <br />
                MATCHES:
              </h2>

              <div className="competition-grid">

                {(profile.activeCompetitions ||
                  []).length > 0 ? (
                  profile.activeCompetitions
                    .slice(0, 2)
                    .map(
                      (
                        competition,
                        index
                      ) => (
                        <div
                          key={
                            competition.id ||
                            index
                          }
                          className="competition-card"
                        >
                          <strong>
                            {
                              competition.name
                            }
                          </strong>

                          <span>
                            {
                              competition.game
                            }
                          </span>
                        </div>
                      )
                    )
                ) : (
                  <>
                    <div className="competition-card empty-card" />
                    <div className="competition-card empty-card" />
                  </>
                )}

              </div>

            </div>
          )}

        </main>

      </section>

      {/* =====================================================
          ADD CLIP MODAL
          ===================================================== */}

      {isAddClipModalOpen && (
        <div
          className="profile-modal-overlay"
          onClick={() => {
            setIsAddClipModalOpen(false);
            setIsClipGameMenuOpen(false);
          }}
        >

          <div
            className="profile-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="profile-modal-header">

              <h3>
                UPLOAD MOMENT
              </h3>

              <button
                type="button"
                onClick={() => {
                  setIsAddClipModalOpen(false);
                  setIsClipGameMenuOpen(false);
                }}
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={
                handleAddClipSubmit
              }
            >

              <label>
                VIDEO TITLE

                <input
                  type="text"
                  value={newClip.title}
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      title:
                        e.target.value,
                    })
                  }
                  placeholder="e.g. 1v5 Clutch on Bind"
                  required
                />
              </label>

              <label>
                DESCRIPTION

                <textarea
                  value={
                    newClip.description
                  }
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      description:
                        e.target.value,
                    })
                  }
                  placeholder="Share details about this play..."
                />
              </label>

              <div className="profile-modal-field">

                <span>
                  GAME
                </span>

                <div className="profile-game-selector">

                  <button
                    type="button"
                    onClick={() =>
                      setIsClipGameMenuOpen(
                        !isClipGameMenuOpen
                      )
                    }
                  >
                    <span>
                      {newClip.game ||
                        'SELECT A REGISTERED GAME'}
                    </span>

                    <ChevronDown
                      size={16}
                      className={
                        isClipGameMenuOpen
                          ? 'rotate'
                          : ''
                      }
                    />
                  </button>

                  {isClipGameMenuOpen && (
                    <div className="profile-game-menu">

                      {gameCatalog.map(
                        (game) => (
                          <button
                            key={game.id}
                            type="button"
                            onClick={() => {
                              setNewClip({
                                ...newClip,
                                game:
                                  game.name,
                                gameId:
                                  game.id,
                              });

                              setIsClipGameMenuOpen(
                                false
                              );
                            }}
                          >
                            {game.name}
                          </button>
                        )
                      )}

                    </div>
                  )}

                </div>

              </div>

              <label>
                VIDEO FILE

                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      file:
                        e.target.files?.[0] ||
                        null,
                    })
                  }
                  required
                />
              </label>

              <label>
                ROLE

                <select
                  value={
                    newClip.roleTag
                  }
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      roleTag:
                        e.target.value,
                    })
                  }
                >
                  <option value="">
                    SELECT ROLE
                  </option>

                  {roleTags.map(
                    (role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                SKILL

                <select
                  value={
                    newClip.skillTag
                  }
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      skillTag:
                        e.target.value,
                    })
                  }
                >
                  <option value="">
                    SELECT SKILL
                  </option>

                  {skillTags.map(
                    (skill) => (
                      <option
                        key={skill}
                        value={skill}
                      >
                        {skill}
                      </option>
                    )
                  )}
                </select>
              </label>

              {clipUploadError && (
                <div className="profile-upload-error">
                  {clipUploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isUploadingClip
                }
                className="profile-modal-submit"
              >
                {isUploadingClip
                  ? 'UPLOADING...'
                  : 'DEPLOY MOMENT'}
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

// =========================================================
// PAGINATION
// =========================================================

const Pagination = () => (
  <div className="profile-pagination">
    <button type="button">
      &lt;
    </button>

    <span>1</span>

    <button type="button">
      &gt;
    </button>
  </div>
);

export default ProfileView;