import { useEffect, useState } from 'react';

import {
  Settings,
  Video,
  PlaySquare,
  ShieldCheck,
  Share2,
  Link2,
  Plus,
  X,
  ChevronDown,
  Copy,
  Check
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/pages/ProfileView.css';
import VideoClip from '../components/VideoClip';
import '../styles/components/GameLogos.css';


const API_URL = import.meta.env.VITE_API_URL;

const SOCIAL_PROFILE_BASES = {
  youtube: 'https://youtube.com/',
  instagram: 'https://instagram.com/',
  twitch: 'https://twitch.tv/',
  x: 'https://x.com/',
};

const externalSocialUrl = (value, platform) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return '';

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

const ProfileView = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('MOMENTS');
  const [matchFilter, setMatchFilter] = useState('ONGOING');
  const [profile, setProfile] = useState(null);
  const [gameCatalog, setGameCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // UID Copy State
  const [uidCopied, setUidCopied] = useState(false);

  // Modal States
  const [isAddClipModalOpen, setIsAddClipModalOpen] = useState(false);
  const [isClipGameMenuOpen, setIsClipGameMenuOpen] = useState(false);
  const roleTags = ['Duelist', 'IGL', 'Sniper', 'Support', 'Controller', 'Sentinel', 'Flex'];
  const skillTags = ['Clutch', 'Ace', 'Entry', 'Skill/Mechanics', 'Teamplay', 'Strategy'];

  const [newClip, setNewClip] = useState({
    title: '',
    description: '',
    game: '',
    gameId: '',
    roleTag: '',
    skillTag: '',
    file: null
  });

  const [isUploadingClip, setIsUploadingClip] = useState(false);
  const [clipUploadError, setClipUploadError] = useState('');

  // =========================================================
  // LOAD PROFILE
  // =========================================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [profileResponse, catalogResponse] = await Promise.all([
          fetch(
            `${API_URL}/api/profile/${encodeURIComponent(username)}`,
            {
              credentials: 'include',
              headers: {
                Accept: 'application/json'
              },
              cache: 'no-store'
            }
          ),

          fetch(`${API_URL}/api/games`, {
            credentials: 'include',
            headers: {
              Accept: 'application/json'
            },
            cache: 'no-store'
          })
        ]);

        if (!profileResponse.ok) {
          throw new Error('Profile not found');
        }

        const profileData = await profileResponse.json();

        setProfile(profileData);

        if (catalogResponse.ok) {
          const catalogData = await catalogResponse.json();

          // Supports both:
          // { games: [...] }
          // and
          // [...]

          setGameCatalog(
            catalogData.games ||
            catalogData ||
            []
          );
        }
      } catch (loadError) {
        console.error('Error loading profile:', loadError);
        setError(loadError.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (username) {
      loadData();
    }
  }, [username]);

  // =========================================================
  // OWNER CHECK
  // =========================================================

  const isOwner =
    profile?.isOwner ||
    user?.username === username;

  // =========================================================
  // SHARE PROFILE
  // =========================================================

  const shareProfile = async () => {
    const profileUrl = window.location.href;

    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      window.prompt(
        'Copy this profile link:',
        profileUrl
      );
    }
  };

  // =========================================================
  // COPY SYNCO UID
  // =========================================================

  const copySyncoUid = async () => {
    if (!profile?.uid) return;

    try {
      await navigator.clipboard.writeText(profile.uid);

      setUidCopied(true);

      setTimeout(() => {
        setUidCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        'Failed to copy SYNCO UID:',
        error
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

    setClipUploadError('');
    setIsUploadingClip(true);

    try {
      // -------------------------------------------------------
      // READ VIDEO METADATA
      // -------------------------------------------------------

      const metadata = await new Promise(
        (resolve, reject) => {
          const video = document.createElement('video');

          const objectUrl =
            URL.createObjectURL(newClip.file);

          video.preload = 'metadata';

          video.onloadedmetadata = () => {
            URL.revokeObjectURL(objectUrl);

            resolve({
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight
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

      // -------------------------------------------------------
      // VIDEO VALIDATION
      // -------------------------------------------------------

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

      // -------------------------------------------------------
      // FORM DATA
      // -------------------------------------------------------

      const formData = new FormData();

      formData.append(
        'title',
        newClip.title || 'Gameplay clip'
      );

      formData.append(
        'clip',
        newClip.file
      );

      formData.append('description', newClip.description);
      formData.append('gameId', newClip.gameId);
      formData.append('roleTag', newClip.roleTag);
      formData.append('skillTag', newClip.skillTag);

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



      // -------------------------------------------------------
      // UPLOAD
      // -------------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/profile/clips`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Upload failed.'
        );
      }

      // -------------------------------------------------------
      // UPDATE PROFILE LOCALLY
      // -------------------------------------------------------

      setProfile((prev) => ({
        ...prev,
        clips: [
          data,
          ...(prev.clips || [])
        ]
      }));

      // -------------------------------------------------------
      // -------------------------------------------------------
      // RESET MODAL
      // -------------------------------------------------------

      setIsAddClipModalOpen(false);

      setNewClip({
        title: '',
        description: '',
        game: '',
        gameId: '',
        roleTag: '',
        skillTag: '',
        file: null
      });

    } catch (error) {

      console.error(
        'Error uploading clip:',
        error
      );

      setClipUploadError(
        error.message ||
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
      <div className="w-full text-center py-20 font-bold uppercase tracking-widest text-xs text-gray-500">
        Loading profile...
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error || !profile) {
    return (
      <div className="w-full text-center py-20 font-bold uppercase tracking-widest text-xs text-gray-500">
        This profile is unavailable.
      </div>
    );
  }

  // =========================================================
  // MOMENTS
  // =========================================================

  const moments = profile.clips || [];

  return (
    <div className="public-profile-wrapper">

      {/* =====================================================
          1. PLAYER CARD HEADER
          ===================================================== */}

      <div className="profile-card-container">

        {/* ===================================================
            LEFT — AVATAR
            =================================================== */}

        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={`${profile.username} avatar`}
            className="profile-avatar-large"
          />
        ) : (
          <div className="profile-avatar-large profile-avatar-fallback">
            {profile.username
              ?.slice(0, 1)
              .toUpperCase()}
          </div>
        )}

        {/* ===================================================
            CENTER — INFO & STATS
            =================================================== */}

        <div className="profile-info-col">

          {/* Username */}

          <div className="profile-username-row">
            <h1 className="profile-username">
              {profile.username}
            </h1>

            {profile.linkedStatus?.discord && (
              <ShieldCheck
                className="profile-verified-badge"
                size={24}
                aria-label="Discord verified"
              />
            )}
          </div>

          {/* Name / UID / Bio */}

          <div className="mb-4">

            {/* Name + Region */}

            <span className="profile-bio-name">
              {profile.name}

              {profile.region &&
                ` • ${profile.region}`}
            </span>

            {/* =================================================
                SYNCO UID
                ================================================= */}

            {profile.uid && (
              <div className="flex items-center gap-2 mt-2">

                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  SYNCO UID
                </span>

                <span className="text-xs font-bold tracking-wider text-black">
                  {profile.uid}
                </span>

                <button
                  type="button"
                  onClick={copySyncoUid}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-black/10 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-black hover:border-black/30 transition-all"
                  title="Copy SYNCO UID"
                >
                  {uidCopied ? (
                    <>
                      <Check size={12} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy
                    </>
                  )}
                </button>

              </div>
            )}

            {/* Bio */}

            <p className="profile-bio-text">
              {profile.bio ||
                'No bio added yet.'}
            </p>

          </div>

          {/* =================================================
              PROFILE STATS
              ================================================= */}

          <div className="profile-stats-container">

            <div className="stat-item">
              <span className="stat-value">
                {profile.stats?.matches || 0}
              </span>

              <span className="stat-label">
                Matches
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-value">
                {profile.stats?.winRate || 0}%
              </span>

              <span className="stat-label">
                Win Rate
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-value">
                {profile.stats?.trophies || 0}
              </span>

              <span className="stat-label">
                Trophies
              </span>
            </div>

          </div>

        </div>

        {/* ===================================================
            RIGHT — ACTIONS & SOCIALS
            =================================================== */}

        <div className="profile-actions-col">

          {/* Top Actions */}

          <div className="profile-top-actions">

            <button
              onClick={shareProfile}
              className="text-gray-400 hover:text-black transition-colors"
              title="Share Profile"
            >
              <Share2 size={18} />
            </button>

            {isOwner && (
              <button
                onClick={() => navigate('/settings')}
                className="text-gray-400 hover:text-black transition-colors"
                title="Edit Profile"
              >
                <Settings size={20} />
              </button>
            )}

          </div>

          {/* =================================================
              SOCIAL LINKS
              ================================================= */}

          <div className="profile-socials-container">

            {/* YouTube */}

            {profile.socials?.youtube && (
              <a
                href={externalSocialUrl(
                  profile.socials.youtube,
                  'youtube'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link-btn group"
              >
                <Link2
                  size={14}
                  className="group-hover:text-red-500 transition-colors"
                />

                <span className="hidden md:inline">
                  YouTube
                </span>
              </a>
            )}

            {/* Instagram */}

            {profile.socials?.instagram && (
              <a
                href={externalSocialUrl(
                  profile.socials.instagram,
                  'instagram'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link-btn group"
              >
                <Link2
                  size={14}
                  className="group-hover:text-pink-500 transition-colors"
                />

                <span className="hidden md:inline">
                  Instagram
                </span>
              </a>
            )}

            {/* Twitch */}

            {profile.socials?.twitch && (
              <a
                href={externalSocialUrl(
                  profile.socials.twitch,
                  'twitch'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link-btn group"
              >
                <Link2
                  size={14}
                  className="group-hover:text-purple-500 transition-colors"
                />

                <span className="hidden md:inline">
                  Twitch
                </span>
              </a>
            )}

            {/* X / Twitter */}

            {profile.socials?.x && (
              <a
                href={externalSocialUrl(
                  profile.socials.x,
                  'x'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link-btn group"
              >
                <Link2
                  size={14}
                  className="group-hover:text-blue-400 transition-colors"
                />

                <span className="hidden md:inline">
                  Twitter
                </span>
              </a>
            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          2. PROFESSIONAL GAME ROSTER
          ===================================================== */}

      <div className="profile-games-roster">

        {profile.games?.length > 0 ? (
          profile.games.map((game) => (
            <div
              className="game-roster-item"
              key={game.id}
            >
              <img
                src={game.logoUrl}
                alt={game.gameName}
                className={`game-roster-logo game-logo game-logo--${game.gameName?.toLowerCase().replaceAll(' ', '')}`}
              />


              <span className="game-roster-ign">
                {game.ign}
              </span>
            </div>
          ))
        ) : (
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            No verified game titles registered.
          </span>
        )}

      </div>

      {/* =====================================================
          3. ESPORTS NAVIGATION
          ===================================================== */}

      <div className="profile-tabs">

        {/* Moments */}

        <button
          className={`profile-tab ${activeTab === 'MOMENTS'
            ? 'active'
            : ''
            }`}
          onClick={() => setActiveTab('MOMENTS')}
        >
          <Video size={16} />
          Moments
        </button>

        {/* Matches */}

        <button
          className={`profile-tab ${activeTab === 'MATCHES'
            ? 'active'
            : ''
            }`}
          onClick={() => setActiveTab('MATCHES')}
        >
          <PlaySquare size={16} />
          Matches
        </button>

      </div>

      {/* =====================================================
          4. TAB CONTENT
          ===================================================== */}

      <div className="tab-content mt-4">

        {/* ===================================================
            MOMENTS
            =================================================== */}

        {activeTab === 'MOMENTS' && (
          <div className="flex flex-col gap-4">

            {/* Add Clip Button */}

            {isOwner &&
              moments.length < 6 && (
                <button
                  className="add-clip-small-btn"
                  onClick={() =>
                    setIsAddClipModalOpen(true)
                  }
                >
                  <Plus size={14} />
                  Add New Clip ({moments.length}/6)
                </button>
              )}

            {/* Clips */}

            {moments.length > 0 ? (
              <div className="moments-grid-container">

                {moments
                  .slice(0, 6)
                  .map((moment) => (
                    <VideoClip
                      key={moment.id}
                      id={moment.id}
                      url={moment.url}
                      title={moment.title}
                      description={moment.description}
                      game={moment.game}
                      initialLikes={moment.likes}
                      initialComments={moment.comments}
                    />
                  ))}

              </div>
            ) : (
              <div className="empty-content-area w-full border-none mt-4">

                <Video
                  size={32}
                  className="text-gray-300"
                />

                <h2 className="empty-title">
                  No Moments
                </h2>

                <p className="empty-subtitle mb-4">
                  Gameplay highlights will appear here.
                </p>

                {isOwner && (
                  <button
                    className="add-clip-small-btn"
                    onClick={() =>
                      setIsAddClipModalOpen(true)
                    }
                  >
                    <Plus size={14} />
                    Upload First Clip
                  </button>
                )}

              </div>
            )}

          </div>
        )}

        {/* ===================================================
            MATCHES
            =================================================== */}

        {activeTab === 'MATCHES' && (
          <div className="mt-4">

            {/* Match Filters */}

            <div className="match-filters">

              <button
                className={`match-filter-btn ${matchFilter === 'ONGOING'
                  ? 'active'
                  : 'inactive'
                  }`}
                onClick={() =>
                  setMatchFilter('ONGOING')
                }
              >
                Ongoing
              </button>

              <button
                className={`match-filter-btn ${matchFilter === 'COMPLETED'
                  ? 'active'
                  : 'inactive'
                  }`}
                onClick={() =>
                  setMatchFilter('COMPLETED')
                }
              >
                Completed
              </button>

            </div>

            {/* Empty Matches */}

            <div className="empty-content-area border-none w-full">

              <PlaySquare
                size={32}
                className="text-gray-300"
              />

              <h2 className="empty-title">
                No {matchFilter.toLowerCase()} matches
              </h2>

              <p className="empty-subtitle">
                Bracket history will appear here.
              </p>

            </div>

          </div>
        )}

      </div>

      {/* =====================================================
          5. ADD CLIP MODAL
          ===================================================== */}

      {isAddClipModalOpen && (
        <div
          className="clip-modal-overlay"
          onClick={() =>
            setIsAddClipModalOpen(false)
          }
        >

          <div
            className="clip-modal-content"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* Modal Header */}

            <div className="clip-modal-header">

              <h3 className="clip-modal-title">
                Upload Gameplay Clip
              </h3>

              <button
                onClick={() =>
                  setIsAddClipModalOpen(false)
                }
                className="text-gray-400 hover:text-black transition-colors"
              >
                <X size={20} />
              </button>

            </div>

            {/* =================================================
                UPLOAD FORM
                ================================================= */}

            <form
              onSubmit={handleAddClipSubmit}
              className="space-y-4"
            >


              {/* Video Title */}

              <div>

                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                  Video Title
                </label>

                <input
                  type="text"
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-black text-sm outline-none transition-all placeholder:text-black/25 focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="e.g. 1v5 Clutch on Bind"
                  value={newClip.title}
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      title: e.target.value
                    })
                  }
                  required
                />

              </div>


              {/* Description */}

              <div>

                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                  Description (Optional)
                </label>

                <textarea
                  className="w-full h-20 px-4 py-3 rounded-xl border border-black/10 bg-white text-black text-sm outline-none transition-all placeholder:text-black/25 focus:border-black focus:ring-1 focus:ring-black resize-none"
                  placeholder="Share your thoughts on this play..."
                  value={newClip.description}
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      description: e.target.value
                    })
                  }
                />

              </div>


              {/* =================================================
                  GAME SELECT
                  ================================================= */}

              <div className="custom-game-select-wrapper mb-4">

                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                  Game
                </label>


                <button
                  type="button"
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-black text-sm outline-none transition-all focus:border-black focus:ring-1 focus:ring-black cursor-pointer flex items-center justify-between"
                  onClick={() =>
                    setIsClipGameMenuOpen(
                      !isClipGameMenuOpen
                    )
                  }
                >

                  <span className="text-left truncate">
                    {newClip.game ||
                      'Select a registered game'}
                  </span>

                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isClipGameMenuOpen
                      ? 'rotate-180'
                      : ''
                      }`}
                  />

                </button>


                {isClipGameMenuOpen && (

                  <>

                    {/* Invisible Overlay */}

                    <div
                      className="custom-game-select-overlay"
                      onClick={() =>
                        setIsClipGameMenuOpen(false)
                      }
                    />


                    {/* Game Menu */}

                    <div className="custom-game-select-menu !top-[70px]">

                      {gameCatalog.map((game) => (

                        <button
                          type="button"
                          key={game.id}
                          className={`custom-game-option ${newClip.game === game.name
                            ? 'active'
                            : ''
                            }`}
                          onClick={() => {

                            setNewClip({
                              ...newClip,
                              game: game.name,
                              gameId: game.id
                            });

                            setIsClipGameMenuOpen(false);

                          }}
                        >


                          {/* Game Icon */}

                          <div className="game-option-icon">
                            {/* Optional:
                            <img
                              src={game.logoUrl}
                              alt={game.name}
                            />
                            */}
                          </div>


                          {/* Game Text */}

                          <div className="game-option-text">

                            <span className="game-option-title">
                              {game.name}
                            </span>

                            <span className="game-option-subtitle">
                              {game.shortName ||
                                game.name}
                            </span>

                          </div>

                        </button>

                      ))}

                    </div>

                  </>

                )}

              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                  Role Tag
                </label>
                <select
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-black text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                  value={newClip.roleTag}
                  onChange={(e) => setNewClip({ ...newClip, roleTag: e.target.value })}
                  required
                >
                  <option value="">Select a role</option>
                  {roleTags.map((roleTag) => (
                    <option key={roleTag} value={roleTag}>{roleTag}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                  Skill Tag
                </label>
                <select
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-black text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                  value={newClip.skillTag}
                  onChange={(e) => setNewClip({ ...newClip, skillTag: e.target.value })}
                  required
                >
                  <option value="">Select a skill</option>
                  {skillTags.map((skillTag) => (
                    <option key={skillTag} value={skillTag}>{skillTag}</option>
                  ))}
                </select>
              </div>


              {/* =================================================
                  VIDEO FILE
                  ================================================= */}

              <div>

                <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                  Video File
                </label>

                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-black hover:file:bg-gray-200 cursor-pointer"
                  onChange={(e) =>
                    setNewClip({
                      ...newClip,
                      file: e.target.files?.[0] || null
                    })
                  }
                  required
                />

              </div>


              {/* Upload Error */}

              {clipUploadError && (

                <p className="clip-upload-error">
                  {clipUploadError}
                </p>

              )}


              {/* Upload Button */}

              <button
                type="submit"
                disabled={isUploadingClip}
                className="w-full h-12 mt-4 rounded-xl bg-black text-white text-sm font-bold tracking-wide hover:bg-[#171717] transition-all disabled:opacity-50"
              >

                {isUploadingClip
                  ? 'Checking and uploading...'
                  : 'Upload to Moments'}

              </button>

            </form>


          </div>

        </div>
      )}

    </div>
  );
};

export default ProfileView;