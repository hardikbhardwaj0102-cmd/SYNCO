import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Settings,
  Video,
  ShieldCheck,
  Share2,
  Link2,
  Plus,
  X,
  ChevronDown,
  Copy,
  Check,
  Gamepad2,
  Users,
  Clock,
  PlaySquare,
  Trophy,
  UserPlus,
  MessageCircle,
  MapPin,
  CalendarDays,
  Medal,
  Sparkles,
  Swords,
  Crown,
  ArrowUpRight,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

import '../styles/pages/ProfileView.css';
import '../styles/components/GameLogos.css';

import characterBg from '../assets/profile-view-character.png';

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

const ROLE_TAGS = [
  'Duelist',
  'IGL',
  'Sniper',
  'Support',
  'Controller',
  'Sentinel',
  'Flex',
];

const SKILL_TAGS = [
  'Clutch',
  'Ace',
  'Entry',
  'Skill/Mechanics',
  'Teamplay',
  'Strategy',
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

const formatJoinedDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).toUpperCase();
  }

  return date
    .toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
};

const formatCompactDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).toUpperCase();
  }

  return date
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
};

const getArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizePerformance = (profile) => {
  const source =
    profile?.performance?.last7 ||
    profile?.performanceLast7 ||
    profile?.last7Performance ||
    profile?.stats?.last7 ||
    [];

  if (Array.isArray(source) && source.length > 0) {
    return source.slice(-7);
  }

  return [];
};

const getPerformanceValue = (item) => {
  if (typeof item === 'number') {
    return item;
  }

  return Number(
    item?.performance ??
      item?.score ??
      item?.rating ??
      item?.value ??
      item?.kills ??
      0
  );
};

const buildChartPoints = (values, width = 760, height = 220) => {
  if (!values.length) {
    return '';
  }

  const normalized = values.map((value) => {
    const numericValue = Number.isFinite(value) ? value : 0;
    return Math.max(0, numericValue);
  });

  const maxValue = Math.max(...normalized, 1);
  const minValue = Math.min(...normalized, 0);

  const range = Math.max(maxValue - minValue, 1);
  const xStep =
    normalized.length === 1
      ? width
      : width / (normalized.length - 1);

  return normalized
    .map((value, index) => {
      const x = index * xStep;
      const y =
        height -
        ((value - minValue) / range) * (height - 24) -
        12;

      return `${x},${y}`;
    })
    .join(' ');
};

const MiniStat = ({ label, value, accent }) => (
  <div className="profile-mini-stat">
    <span>{label}</span>
    <strong className={accent ? 'accent' : ''}>{value}</strong>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="profile-empty-state">
    {Icon ? <Icon size={24} /> : null}
    <strong>{title}</strong>
    {description ? <span>{description}</span> : null}
  </div>
);

const ProfileView = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const { user } = useAuth();

  const pageScrollRef = useRef(null);
  const gamesMatchHistoryRef = useRef(null);

  const [activeTab, setActiveTab] = useState('GAMES');
  const [profile, setProfile] = useState(null);
  const [gameCatalog, setGameCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [uidCopied, setUidCopied] = useState(false);

  const [isAddClipModalOpen, setIsAddClipModalOpen] = useState(false);
  const [isClipGameMenuOpen, setIsClipGameMenuOpen] = useState(false);

  const [gamesSecondaryState, setGamesSecondaryState] =
    useState(false);

  const [organizerApplication, setOrganizerApplication] =
    useState(null);

  const [organizerAccountRole, setOrganizerAccountRole] =
    useState(
      user?.account_role ||
        user?.accountRole ||
        'player'
    );

  const [isOrganizerStatusLoading, setIsOrganizerStatusLoading] =
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

  const [isUploadingClip, setIsUploadingClip] = useState(false);
  const [clipUploadError, setClipUploadError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [profileResponse, catalogResponse] =
          await Promise.all([
            fetch(
              `${API_URL}/api/profile/${encodeURIComponent(username)}`,
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

        const profileData = await profileResponse.json();

        setProfile(profileData);

        if (catalogResponse.ok) {
          const catalogData = await catalogResponse.json();

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

  const isOwner =
    profile?.isOwner ||
    user?.username === username;

  const resolvedAccountRole =
    user?.account_role ||
    user?.accountRole ||
    profile?.account_role ||
    profile?.accountRole ||
    organizerAccountRole ||
    'player';

  useEffect(() => {
    if (!isOwner) {
      return;
    }

    let cancelled = false;

    const loadOrganizerStatus = async () => {
      setIsOrganizerStatusLoading(true);

      try {
        const response = await fetch(
          `${API_URL}/api/organizers/application`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
            cache: 'no-store',
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (cancelled) {
          return;
        }

        if (response.ok) {
          setOrganizerAccountRole(
            data.accountRole ||
              resolvedAccountRole ||
              'player'
          );

          setOrganizerApplication(
            data.application || null
          );
        }
      } catch (organizerError) {
        if (!cancelled) {
          console.error(
            'Error loading organizer status:',
            organizerError
          );
        }
      } finally {
        if (!cancelled) {
          setIsOrganizerStatusLoading(false);
        }
      }
    };

    loadOrganizerStatus();

    return () => {
      cancelled = true;
    };
  }, [
    isOwner,
    user?.account_role,
    user?.accountRole,
    username,
  ]);

  useEffect(() => {
    setGamesSecondaryState(false);

    if (activeTab !== 'GAMES') {
      return;
    }

    const root = pageScrollRef.current;
    const target = gamesMatchHistoryRef.current;

    if (!root || !target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setGamesSecondaryState(entry.isIntersecting);
      },
      {
        root,
        threshold: 0.18,
        rootMargin: '-8% 0px -45% 0px',
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [activeTab, profile]);

  const shareProfile = async () => {
    const profileUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.username || username} on SYNCO`,
          text: `View ${profile?.username || username}'s SYNCO profile`,
          url: profileUrl,
        });

        return;
      }

      await navigator.clipboard.writeText(profileUrl);
    } catch {
      try {
        await navigator.clipboard.writeText(profileUrl);
      } catch {
        window.prompt(
          'Copy this profile link:',
          profileUrl
        );
      }
    }
  };

  const copySyncoUid = async () => {
    if (!profile?.uid) {
      return;
    }

    try {
      await navigator.clipboard.writeText(profile.uid);

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

  const handleAddClipSubmit = async (event) => {
    event.preventDefault();

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
      const metadata = await new Promise(
        (resolve, reject) => {
          const video =
            document.createElement('video');

          const objectUrl =
            URL.createObjectURL(newClip.file);

          video.preload = 'metadata';

          video.onloadedmetadata = () => {
            URL.revokeObjectURL(objectUrl);

            resolve({
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
            });
          };

          video.onerror = () => {
            URL.revokeObjectURL(objectUrl);

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

      const formData = new FormData();

      formData.append(
        'title',
        newClip.title || 'Gameplay clip'
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

      const response = await fetch(
        `${API_URL}/api/profile/clips`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      const data = await response.json();

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

  const moments = getArray(profile?.clips);
  const games = getArray(profile?.games);

  const friends = getArray(
    profile?.friends ||
      profile?.friendList
  );

  const clubs = getArray(
    profile?.clubs ||
      profile?.joinedClubs
  );

  const activeCompetitions = getArray(
    profile?.activeCompetitions ||
      profile?.activeComps ||
      profile?.competitions?.active
  );

  const performanceData =
    normalizePerformance(profile);

  const chartValues = useMemo(
    () =>
      performanceData.map(
        getPerformanceValue
      ),
    [performanceData]
  );

  const chartPoints = useMemo(
    () =>
      buildChartPoints(
        chartValues,
        760,
        220
      ),
    [chartValues]
  );

  const activeSeason =
    profile?.activeSeason ||
    profile?.season ||
    null;

  const matchHistory = getArray(
    profile?.matchHistory ||
      profile?.matches ||
      profile?.stats?.matchHistory
  );

  const badges = getArray(
    profile?.badges ||
      profile?.achievements
  );

  const recentActivity = getArray(
    profile?.recentActivity ||
      profile?.activity
  );

  const joinedDate =
    profile?.joinedDate ||
    profile?.createdAt ||
    profile?.created_at;

  const region =
    profile?.region ||
    profile?.country ||
    'INDIA';

  const bio =
    profile?.bio ||
    profile?.about ||
    'No profile bio available yet.';

  const level = profile?.stats?.matches
    ? Math.min(
        99,
        Math.floor(
          profile.stats.matches / 5
        ) + 1
      )
    : 1;

  const rating =
    activeSeason?.elo ||
    activeSeason?.rating ||
    profile?.stats?.elo ||
    profile?.stats?.rating ||
    profile?.elo ||
    0;

  const matchesPlayed =
    activeSeason?.matchesPlayed ??
    profile?.stats?.matches ??
    profile?.matchesPlayed ??
    0;

  const activeSeasonName =
    activeSeason?.name ||
    activeSeason?.seasonName ||
    'CURRENT SEASON';

  const runes =
    getArray(activeSeason?.runes);

  const renderRecentActivity = () => {
    if (recentActivity.length === 0) {
      return (
        <div className="profile-calendar">
          {Array.from({
            length: 42,
          }).map((_, index) => (
            <span
              key={index}
              className={
                index % 7 === 0
                  ? 'is-active'
                  : ''
              }
            />
          ))}
        </div>
      );
    }

    return (
      <div className="profile-activity-list">
        {recentActivity
          .slice(0, 6)
          .map((activity, index) => (
            <div
              key={
                activity.id ||
                activity.timestamp ||
                index
              }
              className="profile-activity-item"
            >
              <span className="profile-activity-dot" />
              <div>
                <strong>
                  {activity.title ||
                    activity.type ||
                    'Activity'}
                </strong>

                <span>
                  {activity.description ||
                    activity.game ||
                    formatCompactDate(
                      activity.createdAt ||
                        activity.timestamp
                    )}
                </span>
              </div>
            </div>
          ))}
      </div>
    );
  };

  const renderBadges = () => {
    if (badges.length === 0) {
      return (
        <div className="profile-badge-empty">
          <Medal size={18} />
          <span>
            Achievement badges will appear here.
          </span>
        </div>
      );
    }

    return (
      <div className="profile-badge-grid">
        {badges.slice(0, 8).map(
          (badge, index) => (
            <div
              key={
                badge.id ||
                badge.name ||
                index
              }
              className="profile-badge"
              title={
                badge.description ||
                badge.name ||
                'Badge'
              }
            >
              <Medal size={18} />
              <span>
                {badge.name ||
                  badge.title ||
                  `BADGE ${index + 1}`}
              </span>
            </div>
          )
        )}
      </div>
    );
  };

  const renderPrimaryLeftColumn = () => (
    <>
      <section className="profile-side-card profile-bio-card">
        <div className="profile-section-kicker">
          PLAYER BIO
        </div>

        <p className="profile-bio-text">
          {bio}
        </p>
      </section>

      <section className="profile-side-card">
        <div className="profile-side-header">
          <div>
            <span className="profile-section-kicker">
              RECENT ACTIVITY
            </span>

            <h3>PLAYER TIMELINE</h3>
          </div>

          <CalendarDays size={16} />
        </div>

        {renderRecentActivity()}

        <div className="profile-meta-stack">
          <div>
            <span>JOINED</span>
            <strong>
              {formatJoinedDate(
                joinedDate
              )}
            </strong>
          </div>

          <div>
            <span>REGION</span>
            <strong>
              {region}
            </strong>
          </div>
        </div>
      </section>

      <section className="profile-side-card">
        <div className="profile-side-header">
          <div>
            <span className="profile-section-kicker">
              COLLECTION
            </span>

            <h3>BADGES</h3>
          </div>

          <Medal size={16} />
        </div>

        {renderBadges()}
      </section>
    </>
  );

  const renderSeasonLeftColumn = () => (
    <section className="profile-side-card profile-season-card">
      <div className="profile-season-top">
        <span className="profile-section-kicker">
          ACTIVE SEASON
        </span>

        <Crown size={18} />
      </div>

      <h2>
        {activeSeasonName}
      </h2>

      <div className="profile-season-status">
        {activeSeason?.status ||
          'IN PROGRESS'}
      </div>

      <div className="profile-rune-preview">
        {runes.length > 0
          ? runes.slice(0, 3).map(
              (rune, index) => (
                <div
                  key={
                    rune.id ||
                    rune.name ||
                    index
                  }
                  className="profile-rune"
                >
                  <Sparkles size={16} />
                  <span>
                    {rune.name ||
                      rune.title ||
                      `RUNE ${index + 1}`}
                  </span>
                </div>
              )
            )
          : (
            <>
              <div className="profile-rune">
                <Sparkles size={16} />
                <span>
                  CURRENT RUNE
                </span>
              </div>

              <div className="profile-rune-number">
                {rating}
              </div>
            </>
          )}
      </div>

      <div className="profile-season-stat">
        <span>ELO / RATING</span>
        <strong>
          {rating}
        </strong>
      </div>

      <div className="profile-season-stat">
        <span>MATCHES PLAYED</span>
        <strong>
          {matchesPlayed}
        </strong>
      </div>

      <div className="profile-season-stat">
        <span>WIN RATE</span>
        <strong>
          {profile?.stats?.winRate ??
            activeSeason?.winRate ??
            0}
          %
        </strong>
      </div>

      <div className="profile-season-footer">
        <span>SEASON PROGRESS</span>

        <div className="profile-season-progress">
          <span
            style={{
              width: `${Math.max(
                5,
                Math.min(
                  100,
                  Number(
                    activeSeason?.progress ||
                      profile?.stats
                        ?.seasonProgress ||
                      0
                  )
                )
              )}%`,
            }}
          />
        </div>
      </div>
    </section>
  );

  if (isLoading) {
    return (
      <div className="profile-page-loading">
        Loading interface...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-page-loading">
        Operative Not Found.
      </div>
    );
  }

  return (
    <div
      ref={pageScrollRef}
      className="public-profile-wrapper"
    >
      <div className="profile-environment" />

      <div className="profile-vignette" />

      <div className="profile-page-content">
        <aside className="profile-left-column">
          <section className="profile-identity-card">
            <div className="profile-avatar-wrap">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-avatar profile-avatar-fallback">
                  {profile.username
                    ?.slice(0, 2)
                    .toUpperCase()}
                </div>
              )}

              <span className="profile-online-dot" />
            </div>

            <div className="profile-identity-body">
              <div className="profile-level-badge">
                LVL {level}
              </div>

              <div className="profile-username-row">
                <h1>
                  {profile.username}
                </h1>

                {profile.linkedStatus
                  ?.discord && (
                  <ShieldCheck
                    size={17}
                    className="profile-verified"
                  />
                )}
              </div>

              <p className="profile-real-name">
                {profile.name ||
                  'SYNCO PLAYER'}
              </p>

              <div className="profile-uid-row">
                <span>
                  UID: {profile.uid || '—'}
                </span>

                {profile.uid && (
                  <button
                    type="button"
                    onClick={copySyncoUid}
                    title="Copy SYNCO UID"
                  >
                    {uidCopied ? (
                      <Check
                        size={11}
                        className="profile-success"
                      />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                )}
              </div>

              <div className="profile-action-row">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        '/settings'
                      )
                    }
                    className="profile-outline-action"
                  >
                    <Settings size={14} />
                    Settings
                  </button>
                ) : (
                  <button
                    type="button"
                    className="profile-outline-action"
                  >
                    <UserPlus size={14} />
                    Add Friend
                  </button>
                )}

                <button
                  type="button"
                  className="profile-solid-action"
                >
                  <MessageCircle
                    size={14}
                  />
                  Message
                </button>
              </div>

              <div className="profile-social-row">
                {profile.socials?.youtube && (
                  <a
                    href={externalSocialUrl(
                      profile.socials.youtube,
                      'youtube'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    title="YouTube"
                  >
                    <Link2 size={14} />
                  </a>
                )}

                {profile.socials?.instagram && (
                  <a
                    href={externalSocialUrl(
                      profile.socials.instagram,
                      'instagram'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    title="Instagram"
                  >
                    <Link2 size={14} />
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
                    title="Twitch"
                  >
                    <Link2 size={14} />
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
                    title="X"
                  >
                    <Link2 size={14} />
                  </a>
                )}
              </div>
            </div>
          </section>

          {activeTab === 'GAMES' &&
          gamesSecondaryState
            ? renderSeasonLeftColumn()
            : renderPrimaryLeftColumn()}
        </aside>

        <main className="profile-center-column">
          <section className="profile-hero">
            <div className="profile-hero-noise" />

            <div className="profile-hero-copy">
              <span>
                SYNCO OPERATIVE
              </span>

              <strong>
                {profile.username}
              </strong>

              <p>
                {profile.region ||
                  region}
              </p>
            </div>

            <img
              src={characterBg}
              alt="SYNCO Operative"
              className="profile-character"
            />

            <div className="profile-character-status">
              <span />
              {profile.status ||
                'ONLINE'}
            </div>

            <div className="profile-hero-utility">
              <div className="profile-utility-buttons">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/profile/${encodeURIComponent(
                        username
                      )}/customize`
                    )
                  }
                  className="profile-utility-button customize"
                  title="Customize profile"
                >
                  <Sparkles
                    size={16}
                  />

                  <span>
                    Customize
                  </span>
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        '/settings'
                      )
                    }
                    className="profile-utility-button"
                    title="Settings"
                  >
                    <Settings
                      size={16}
                    />
                  </button>
                )}
              </div>

              <div className="profile-showcase-card">
                <span className="profile-section-kicker">
                  SHOWCASE
                </span>

                <div className="profile-showcase-art">
                  <Trophy size={28} />
                </div>

                <strong>
                  {profile.showcase?.[0]
                    ?.name ||
                    'NO SHOWCASE ITEM'}
                </strong>

                <span>
                  Unlock achievements,
                  cosmetics and special
                  profile collectibles.
                </span>
              </div>
            </div>

            <div className="profile-xp-bar">
              <div className="profile-xp-label">
                <span>
                  LEVEL {level}
                </span>

                <strong>
                  {profile.xp?.current ??
                    profile.stats?.xp ??
                    0}
                  {' / '}
                  {profile.xp?.max ??
                    5000}
                  {' XP'}
                </strong>
              </div>

              <div className="profile-xp-track">
                <span
                  style={{
                    width: `${Math.max(
                      2,
                      Math.min(
                        100,
                        (
                          (
                            profile.xp?.current ??
                            profile.stats?.xp ??
                            0
                          ) /
                          (
                            profile.xp?.max ??
                            5000
                          )
                        ) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <nav className="profile-tab-bar">
            {[
              'GAMES',
              'HIGHLIGHTS',
              'FRIENDS',
              'CLUBS',
              'ACTIVE COMP',
            ].map((tab) => (
              <button
                type="button"
                key={tab}
                className={
                  activeTab === tab
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab(tab)
                }
              >
                {tab}
              </button>
            ))}
          </nav>

          {activeTab === 'GAMES' && (
            <section className="profile-tab-content games-content">
              <div className="profile-content-header">
                <div>
                  <span className="profile-section-kicker">
                    PLAYER LOADOUT
                  </span>

                  <h2>
                    GAME ROSTER
                  </h2>
                </div>

                <span className="profile-content-count">
                  {games.length} TITLES
                </span>
              </div>

              <div className="profile-game-roster">
                {games.length > 0 ? (
                  games.map((game) => (
                    <div
                      key={game.id}
                      className="profile-game-card"
                    >
                      <div className="profile-game-logo">
                        <img
                          src={
                            getGameLogo(
                              game.id,
                              game.gameName ||
                                game.name
                            ) ||
                            '/games/default-placeholder.png'
                          }
                          alt={
                            game.gameName ||
                            game.name ||
                            'Game'
                          }
                        />
                      </div>

                      <div className="profile-game-info">
                        <span>
                          {game.gameName ||
                            game.name ||
                            'Game'}
                        </span>

                        <strong>
                          {game.ign ||
                            'REGISTERED'}
                        </strong>
                      </div>

                      <div className="profile-game-meta">
                        <span>
                          {game.rank ||
                            game.tier ||
                            '—'}
                        </span>

                        <small>
                          {game.elo ??
                            game.rating ??
                            '—'}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Gamepad2}
                    title="No registered titles"
                    description="Verified games will appear here."
                  />
                )}
              </div>

              <div className="profile-section-divider" />

              <div className="profile-content-header">
                <div>
                  <span className="profile-section-kicker">
                    PERFORMANCE
                  </span>

                  <h2>
                    LAST 7 MATCHES
                  </h2>
                </div>

                <span className="profile-content-count">
                  {chartValues.length
                    ? `${chartValues.length} MATCHES`
                    : 'NO DATA'}
                </span>
              </div>

              <div className="profile-performance-card">
                {chartPoints ? (
                  <>
                    <svg
                      viewBox="0 0 760 220"
                      className="profile-performance-chart"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient
                          id="profileChartFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="rgba(229,254,0,0.32)"
                          />
                          <stop
                            offset="100%"
                            stopColor="rgba(229,254,0,0)"
                          />
                        </linearGradient>
                      </defs>

                      <path
                        d={
                          chartPoints
                            ? `M ${chartPoints.replaceAll(
                                ' ',
                                ' L '
                              )} L 760,220 L 0,220 Z`
                            : ''
                        }
                        fill="url(#profileChartFill)"
                      />

                      <polyline
                        points={chartPoints}
                        fill="none"
                        stroke="#E5FE00"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {chartValues.map(
                        (value, index) => {
                          const points =
                            chartPoints
                              .split(' ')
                              .map(
                                (point) =>
                                  point.split(
                                    ','
                                  )
                              );

                          const [x, y] =
                            points[index] ||
                            [0, 0];

                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="5"
                              fill="#0B0E14"
                              stroke="#E5FE00"
                              strokeWidth="3"
                            />
                          );
                        }
                      )}
                    </svg>

                    <div className="profile-chart-footer">
                      {chartValues.map(
                        (value, index) => (
                          <span
                            key={index}
                          >
                            M{index + 1}
                          </span>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={Swords}
                    title="Performance data unavailable"
                    description="Recent competitive match data will appear here."
                  />
                )}
              </div>

              <div
                ref={gamesMatchHistoryRef}
                className="games-secondary-section"
              >
                <div className="profile-section-divider" />

                <div className="profile-content-header">
                  <div>
                    <span className="profile-section-kicker">
                      MATCH RECORD
                    </span>

                    <h2>
                      MATCH HISTORY
                    </h2>
                  </div>

                  <span className="profile-content-count">
                    {matchHistory.length ||
                      matchesPlayed}{' '}
                    MATCHES
                  </span>
                </div>

                <div className="profile-match-history">
                  {matchHistory.length > 0 ? (
                    matchHistory.map(
                      (match, index) => {
                        const result =
                          String(
                            match.result ||
                              match.outcome ||
                              ''
                          ).toLowerCase();

                        return (
                          <div
                            key={
                              match.id ||
                              index
                            }
                            className="profile-match-row"
                          >
                            <div
                              className={`profile-match-result ${
                                result ===
                                'win'
                                  ? 'win'
                                  : result ===
                                    'loss'
                                  ? 'loss'
                                  : ''
                              }`}
                            >
                              {result ===
                              'win'
                                ? 'W'
                                : result ===
                                  'loss'
                                ? 'L'
                                : '—'}
                            </div>

                            <div className="profile-match-main">
                              <strong>
                                {match.gameName ||
                                  match.game ||
                                  'Competitive Match'}
                              </strong>

                              <span>
                                {match.eventName ||
                                  match.tournament ||
                                  match.mode ||
                                  'SYNCO MATCH'}
                              </span>
                            </div>

                            <div className="profile-match-stat">
                              <span>
                                SCORE
                              </span>

                              <strong>
                                {match.score ||
                                  `${match.kills ?? 0} / ${
                                    match.deaths ??
                                    0
                                  }`}
                              </strong>
                            </div>

                            <div className="profile-match-date">
                              {formatCompactDate(
                                match.date ||
                                  match.createdAt
                              )}
                            </div>
                          </div>
                        );
                      }
                    )
                  ) : (
                    <EmptyState
                      icon={Clock}
                      title="No match history available"
                      description="Completed matches will appear in this section."
                    />
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'HIGHLIGHTS' && (
            <section className="profile-tab-content">
              <div className="profile-content-header">
                <div>
                  <span className="profile-section-kicker">
                    PLAYER MEDIA
                  </span>

                  <h2>
                    HIGHLIGHTS
                  </h2>
                </div>

                {isOwner && (
                  <button
                    type="button"
                    className="profile-add-button"
                    onClick={() =>
                      setIsAddClipModalOpen(true)
                    }
                  >
                    <Plus size={15} />
                    Add
                  </button>
                )}
              </div>

              <div className="profile-highlight-grid">
                {moments.length > 0 ? (
                  moments
                    .slice(0, 6)
                    .map((moment) => (
                      <article
                        key={moment.id}
                        className="profile-highlight-card"
                      >
                        <video
                          src={moment.url}
                          muted
                          loop
                          playsInline
                          onMouseEnter={(event) =>
                            event.currentTarget.play()
                          }
                          onMouseLeave={(event) => {
                            event.currentTarget.pause();
                            event.currentTarget.currentTime = 0;
                          }}
                        />

                        <div className="profile-highlight-overlay">
                          <PlaySquare
                            size={20}
                          />

                          <div>
                            <strong>
                              {moment.title ||
                                'Gameplay Moment'}
                            </strong>

                            <span>
                              {moment.gameName ||
                                moment.game ||
                                'SYNCO'}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))
                ) : (
                  <EmptyState
                    icon={Video}
                    title="No highlights yet"
                    description="Upload your best moments to showcase them here."
                  />
                )}
              </div>
            </section>
          )}

          {activeTab === 'FRIENDS' && (
            <section className="profile-tab-content">
              <div className="profile-content-header">
                <div>
                  <span className="profile-section-kicker">
                    SOCIAL
                  </span>

                  <h2>
                    FRIENDS
                  </h2>
                </div>

                <span className="profile-content-count">
                  ALL ({friends.length})
                </span>
              </div>

              <div className="profile-friend-list">
                {friends.length > 0 ? (
                  friends.map(
                    (friend, index) => (
                      <button
                        key={
                          friend.id ||
                          friend.username ||
                          index
                        }
                        type="button"
                        className="profile-friend-row"
                        onClick={() =>
                          friend.username
                            ? navigate(
                                `/profile/${encodeURIComponent(
                                  friend.username
                                )}`
                              )
                            : null
                        }
                      >
                        <div className="profile-friend-avatar">
                          {friend.avatarUrl ? (
                            <img
                              src={
                                friend.avatarUrl
                              }
                              alt={
                                friend.username
                              }
                            />
                          ) : (
                            (
                              friend.username ||
                              '?'
                            )
                              .slice(0, 2)
                              .toUpperCase()
                          )}
                        </div>

                        <div className="profile-friend-main">
                          <strong>
                            {friend.username ||
                              friend.name ||
                              'SYNCO PLAYER'}
                          </strong>

                          <span>
                            {friend.status ||
                              friend.game ||
                              friend.region ||
                              'PLAYER'}
                          </span>
                        </div>

                        <ArrowUpRight
                          size={16}
                        />
                      </button>
                    )
                  )
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No friends to display"
                    description="SYNCO connections will appear here."
                  />
                )}
              </div>
            </section>
          )}

          {activeTab === 'CLUBS' && (
            <section className="profile-tab-content">
              <div className="profile-content-header">
                <div>
                  <span className="profile-section-kicker">
                    COMMUNITY
                  </span>

                  <h2>
                    JOINED / OWNED CLUBS
                  </h2>
                </div>

                <span className="profile-content-count">
                  {clubs.length} CLUBS
                </span>
              </div>

              <div className="profile-club-grid">
                {clubs.length > 0 ? (
                  clubs
                    .slice(0, 6)
                    .map((club, index) => (
                      <article
                        key={
                          club.id ||
                          club.slug ||
                          index
                        }
                        className="profile-club-card"
                      >
                        <div className="profile-club-icon">
                          {club.logoUrl ? (
                            <img
                              src={
                                club.logoUrl
                              }
                              alt={
                                club.name
                              }
                            />
                          ) : (
                            <Users
                              size={24}
                            />
                          )}
                        </div>

                        <div>
                          <span className="profile-section-kicker">
                            {club.role ||
                              'MEMBER'}
                          </span>

                          <h3>
                            {club.name ||
                              'SYNCO CLUB'}
                          </h3>

                          <p>
                            {club.members ??
                              club.memberCount ??
                              0}{' '}
                            MEMBERS
                          </p>
                        </div>
                      </article>
                    ))
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No clubs to display"
                    description="Joined and owned clubs will appear here."
                  />
                )}
              </div>
            </section>
          )}

          {activeTab === 'ACTIVE COMP' && (
            <section className="profile-tab-content">
              <div className="profile-content-header">
                <div>
                  <span className="profile-section-kicker">
                    COMPETITION
                  </span>

                  <h2>
                    ACTIVE / UPCOMING MATCHES
                  </h2>
                </div>

                <span className="profile-content-count">
                  {activeCompetitions.length}{' '}
                  EVENTS
                </span>
              </div>

              <div className="profile-competition-grid">
                {activeCompetitions.length >
                0 ? (
                  activeCompetitions
                    .slice(0, 6)
                    .map(
                      (
                        competition,
                        index
                      ) => (
                        <article
                          key={
                            competition.id ||
                            index
                          }
                          className="profile-competition-card"
                        >
                          <div className="profile-competition-status">
                            {competition.status ||
                              'UPCOMING'}
                          </div>

                          <div>
                            <span>
                              {competition.gameName ||
                                competition.game ||
                                'COMPETITION'}
                            </span>

                            <h3>
                              {competition.name ||
                                competition.title ||
                                'SYNCO EVENT'}
                            </h3>
                          </div>

                          <div className="profile-competition-meta">
                            <span>
                              <Gamepad2
                                size={12}
                              />
                              {competition.format ||
                                competition.mode ||
                                'MATCH'}
                            </span>

                            <span>
                              <Clock
                                size={12}
                              />
                              {competition.startDate ||
                                competition.time ||
                                'TBA'}
                            </span>
                          </div>
                        </article>
                      )
                    )
                ) : (
                  <EmptyState
                    icon={Trophy}
                    title="No active competitions"
                    description="Active and upcoming matches will appear here."
                  />
                )}
              </div>
            </section>
          )}

          {isOwner &&
            resolvedAccountRole !==
              'admin' && (
              <section className="profile-organizer-card">
                <div className="profile-organizer-icon">
                  <Trophy size={18} />
                </div>

                <div className="profile-organizer-copy">
                  <span className="profile-section-kicker">
                    SYNCO ORGANIZER
                  </span>

                  <h3>
                    {organizerApplication
                      ? 'ORGANIZER APPLICATION'
                      : 'BECOME AN ORGANIZER'}
                  </h3>

                  <p>
                    {organizerApplication
                      ? `Application ${
                          organizerApplication.status ||
                          'pending'
                        }`
                      : 'Run tournaments, create competitions, and build your esports community on SYNCO.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/organizer/register'
                    )
                  }
                >
                  {isOrganizerStatusLoading ? (
                    <span className="profile-spinner" />
                  ) : (
                    <ChevronDown
                      size={16}
                      className="-rotate-90"
                    />
                  )}
                </button>
              </section>
            )}

          <button
            type="button"
            className="profile-competitive-profile-button"
            onClick={() =>
              navigate(
                '/competitive-profile'
              )
            }
          >
            View Competitive Profile
            <ArrowUpRight size={16} />
          </button>
        </main>
      </div>

      {isAddClipModalOpen && (
        <div
          className="clip-modal-overlay"
          onClick={() => {
            setIsAddClipModalOpen(false);
            setIsClipGameMenuOpen(false);
          }}
        >
          <div
            className="clip-modal-content"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="clip-modal-header">
              <div>
                <span className="profile-section-kicker">
                  PROFILE MEDIA
                </span>

                <h3>
                  UPLOAD MOMENT
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddClipModalOpen(
                    false
                  );
                  setIsClipGameMenuOpen(
                    false
                  );
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={
                handleAddClipSubmit
              }
              className="clip-modal-form"
            >
              <div className="clip-field">
                <label>
                  Video Title
                </label>

                <input
                  type="text"
                  placeholder="e.g. 1v5 Clutch on Bind"
                  value={newClip.title}
                  onChange={(event) =>
                    setNewClip({
                      ...newClip,
                      title:
                        event.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="clip-field">
                <label>
                  Description
                </label>

                <textarea
                  placeholder="Share details about this play..."
                  value={
                    newClip.description
                  }
                  onChange={(event) =>
                    setNewClip({
                      ...newClip,
                      description:
                        event.target
                          .value,
                    })
                  }
                />
              </div>

              <div className="clip-field">
                <label>
                  Game
                </label>

                <div className="clip-game-select">
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
                        'Select a registered game'}
                    </span>

                    <ChevronDown
                      size={15}
                      className={
                        isClipGameMenuOpen
                          ? 'rotate-180'
                          : ''
                      }
                    />
                  </button>

                  {isClipGameMenuOpen && (
                    <div className="clip-game-menu">
                      {gameCatalog.length >
                      0 ? (
                        gameCatalog.map(
                          (game) => (
                            <button
                              type="button"
                              key={
                                game.id
                              }
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
                              {
                                game.name
                              }
                            </button>
                          )
                        )
                      ) : (
                        <span>
                          No registered
                          games available.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="clip-field">
                <label>
                  Video File
                </label>

                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(event) =>
                    setNewClip({
                      ...newClip,
                      file:
                        event.target
                          .files?.[0] ||
                        null,
                    })
                  }
                  required
                />
              </div>

              <div className="clip-tag-grid">
                <div className="clip-field">
                  <label>
                    Role
                  </label>

                  <select
                    value={
                      newClip.roleTag
                    }
                    onChange={(event) =>
                      setNewClip({
                        ...newClip,
                        roleTag:
                          event.target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Select role
                    </option>

                    {ROLE_TAGS.map(
                      (tag) => (
                        <option
                          key={tag}
                          value={tag}
                        >
                          {tag}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="clip-field">
                  <label>
                    Skill
                  </label>

                  <select
                    value={
                      newClip.skillTag
                    }
                    onChange={(event) =>
                      setNewClip({
                        ...newClip,
                        skillTag:
                          event.target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Select skill
                    </option>

                    {SKILL_TAGS.map(
                      (tag) => (
                        <option
                          key={tag}
                          value={tag}
                        >
                          {tag}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {clipUploadError && (
                <div className="clip-upload-error">
                  {clipUploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isUploadingClip
                }
                className="clip-submit-button"
              >
                {isUploadingClip
                  ? 'Uploading...'
                  : 'Deploy Moment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;