import { useEffect, useState } from 'react';
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
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

import '../styles/pages/ProfileView.css';
import '../styles/components/GameLogos.css';

// =========================================================
// BACKGROUND CHARACTER ASSET
// =========================================================
import characterBg from '../assets/profile-view-character.png';


// =========================================================
// API
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// LOCAL GAME LOGOS
// =========================================================

const GAME_LOGOS = {
  bgmi: '/games/bgmi.png.png',
  cr: '/games/clashroyale.png.png',
  freefire: '/games/freefire.png.png',
  pubg: '/games/pubg.png.png',
  pubgm: '/games/pubgm.png.png',
  val: '/games/valorant.png.png',
};


// =========================================================
// SOCIAL PROFILE BASES
// =========================================================

const SOCIAL_PROFILE_BASES = {
  youtube: 'https://youtube.com/',
  instagram: 'https://instagram.com/',
  twitch: 'https://twitch.tv/',
  x: 'https://x.com/',
};


// =========================================================
// SOCIAL URL HELPER
// =========================================================

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


// =========================================================
// GAME LOGO HELPER
// =========================================================

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


// =========================================================
// COMPONENT
// =========================================================

const ProfileView = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('MOMENTS');

  const [profile, setProfile] = useState(null);
  const [gameCatalog, setGameCatalog] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // =========================================================
  // UID COPY STATE
  // =========================================================

  const [uidCopied, setUidCopied] = useState(false);

  // =========================================================
  // MODAL STATES
  // =========================================================

  const [isAddClipModalOpen, setIsAddClipModalOpen] = useState(false);
  const [isClipGameMenuOpen, setIsClipGameMenuOpen] = useState(false);

  // =========================================================
  // CLIP TAGS
  // =========================================================

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
  // NEW CLIP STATE
  // =========================================================

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


  // =========================================================
  // LOAD PROFILE + GAME CATALOG
  // =========================================================

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

      setProfile((prev) => ({
        ...prev,
        clips: [
          data,
          ...(prev.clips || []),
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
  // LOADING / ERROR
  // =========================================================

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center font-bold uppercase tracking-widest text-xs text-gray-500 bg-black">
        Loading interface...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full h-screen flex items-center justify-center font-bold uppercase tracking-widest text-xs text-gray-500 bg-black">
        Operative Not Found.
      </div>
    );
  }

  const moments = profile.clips || [];


  // =========================================================
  // RENDER (IMMERSIVE LOBBY HUD)
  // =========================================================

  return (
    <div className="public-profile-wrapper">

      {/* BACKGROUND CHARACTER */}
      <img
        src={characterBg}
        alt="SYNCO Operative"
        className="lobby-background"
      />
      <div className="lobby-vignette"></div>

      {/* HUD LAYER */}
      <div className="hud-layer">
        
        {/* =======================
            LEFT HUD: TABS & FEEDS
            ======================= */}
        <div className="hud-left">
          
          <div className="hud-tabs">
            <button className={`hud-tab-btn ${activeTab === 'MOMENTS' ? 'active' : ''}`} onClick={() => setActiveTab('MOMENTS')}>Moments</button>
            <button className={`hud-tab-btn ${activeTab === 'ROSTER' ? 'active' : ''}`} onClick={() => setActiveTab('ROSTER')}>Roster</button>
            <button className={`hud-tab-btn ${activeTab === 'COMPS' ? 'active' : ''}`} onClick={() => setActiveTab('COMPS')}>Comps</button>
          </div>

          <div className="hud-list-container">
            
            {activeTab === 'MOMENTS' && (
              moments.length > 0 ? (
                moments.slice(0, 6).map((moment) => (
                  <div key={moment.id} className="w-full aspect-video rounded-xl overflow-hidden glass-hud flex-shrink-0 relative group cursor-pointer border border-white/10">
                    <video
                      src={moment.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.target.play()}
                      onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-transparent transition-all duration-300 pointer-events-none">
                      <PlaySquare size={28} className="text-white opacity-80" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full py-12 glass-hud flex flex-col items-center justify-center text-gray-400">
                  <Video size={24} className="mb-2 opacity-50" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">No Moments</span>
                </div>
              )
            )}

            {activeTab === 'ROSTER' && (
              profile.games?.length > 0 ? (
                profile.games.map((game) => (
                  <div className="glass-hud p-3 flex items-center gap-3" key={game.id}>
                    <img src={getGameLogo(game.id, game.gameName || game.name) || '/games/default-placeholder.png'} alt={game.gameName} className="h-8 object-contain" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs uppercase truncate">{game.gameName || game.name}</h4>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest truncate block">{game.ign}</span>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-[10px] text-gray-400 uppercase tracking-widest p-2">No verified titles.</span>
              )
            )}

            {activeTab === 'COMPS' && (
              <>
                <div className="glass-hud p-3 mb-2">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Live Now</span>
                  <h4 className="font-bold text-xs uppercase">SYNCO Summer Cup</h4>
                  <div className="flex gap-3 mt-1 text-[9px] text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Gamepad2 size={10}/> BGMI</span>
                    <span className="flex items-center gap-1"><Users size={10}/> 4v4</span>
                  </div>
                </div>
                <div className="glass-hud p-3">
                  <span className="text-[9px] font-bold text-[#D6C98A] uppercase tracking-widest block mb-1">Upcoming</span>
                  <h4 className="font-bold text-xs uppercase">Arena Knockout</h4>
                  <div className="flex gap-3 mt-1 text-[9px] text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Gamepad2 size={10}/> Valorant</span>
                    <span className="flex items-center gap-1"><Clock size={10}/> Tomorrow</span>
                  </div>
                </div>
              </>
            )}

          </div>

          {activeTab === 'MOMENTS' && isOwner && (
            <div className="hud-upload-btn" onClick={() => setIsAddClipModalOpen(true)}>
              <span>Add Moment</span>
              <div className="hud-upload-icon"><Plus size={14} /></div>
            </div>
          )}
        </div>


        {/* =======================
            RIGHT HUD: IDENTITY & STATS
            ======================= */}
        <div className="hud-right">
          
          <div>
            <div className="hud-top-status">
              <div className="hud-status-btn" onClick={shareProfile} title="Share Profile"><Share2 size={16} /></div>
              {isOwner && (
                <div className="hud-status-btn" onClick={() => navigate('/settings')} title="Settings"><Settings size={16} /></div>
              )}
            </div>

            <div className="hud-identity">
              <div>
                <div className="hud-level">{profile.stats?.matches ? Math.min(99, Math.floor(profile.stats.matches / 5) + 1) : 42}</div> 
                <div className="hud-level-label">LEVEL</div>
              </div>
              <div className="hud-names">
                <div className="flex items-center gap-2">
                  <h1>{profile.username}</h1>
                  {profile.linkedStatus?.discord && <ShieldCheck size={16} className="text-emerald-400 mb-1" />}
                </div>
                <p>{profile.name} {profile.region ? `• ${profile.region}` : ''}</p>
                
                {profile.uid && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-gray-400 font-mono">UID: {profile.uid}</span>
                    <button onClick={copySyncoUid} className="hover:text-white transition" title="Copy UID">
                      {uidCopied ? <Check size={10} className="text-emerald-400"/> : <Copy size={10}/>}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="hud-stat-line">
                <span className="hud-stat-label">Win Rate</span>
                <span className="hud-stat-value">{profile.stats?.winRate || 0}%</span>
              </div>
              <div className="hud-stat-line">
                <span className="hud-stat-label">Trophies</span>
                <span className="hud-stat-value text-[#D6C98A]">{profile.stats?.trophies || 0}</span>
              </div>
              <div className="hud-stat-line">
                <span className="hud-stat-label">Matches</span>
                <span className="hud-stat-value">{profile.stats?.matches || 0}</span>
              </div>
            </div>

            <div className="hud-socials-grid">
              {profile.socials?.youtube && <a href={externalSocialUrl(profile.socials.youtube, 'youtube')} target="_blank" rel="noreferrer" className="hud-social-square"><Link2 size={16} /></a>}
              {profile.socials?.instagram && <a href={externalSocialUrl(profile.socials.instagram, 'instagram')} target="_blank" rel="noreferrer" className="hud-social-square"><Link2 size={16} /></a>}
              {profile.socials?.twitch && <a href={externalSocialUrl(profile.socials.twitch, 'twitch')} target="_blank" rel="noreferrer" className="hud-social-square"><Link2 size={16} /></a>}
              {profile.socials?.x && <a href={externalSocialUrl(profile.socials.x, 'x')} target="_blank" rel="noreferrer" className="hud-social-square"><Link2 size={16} /></a>}
            </div>
          </div>

          <div className="hud-action-btn" onClick={() => navigate('/competitive-profile')}>
            View Competitive Profile
          </div>

        </div>

      </div>


      {/* =====================================================
          ADD CLIP MODAL
          ===================================================== */}
      {isAddClipModalOpen && (
        <div className="clip-modal-overlay" onClick={() => { setIsAddClipModalOpen(false); setIsClipGameMenuOpen(false); }}>
          <div className="clip-modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold uppercase tracking-wider">Upload Moment</h3>
              <button onClick={() => { setIsAddClipModalOpen(false); setIsClipGameMenuOpen(false); }} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddClipSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Video Title</label>
                <input
                  type="text"
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-[#D6C98A]"
                  placeholder="e.g. 1v5 Clutch on Bind"
                  value={newClip.title}
                  onChange={(e) => setNewClip({ ...newClip, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Description (Optional)</label>
                <textarea
                  className="w-full h-20 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-[#D6C98A] resize-none"
                  placeholder="Share details about this play..."
                  value={newClip.description}
                  onChange={(e) => setNewClip({ ...newClip, description: e.target.value })}
                />
              </div>

              {/* GAME SELECT DROPDOWN */}
              <div className="relative">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Game</label>
                <button
                  type="button"
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none flex items-center justify-between cursor-pointer"
                  onClick={() => setIsClipGameMenuOpen(!isClipGameMenuOpen)}
                >
                  <span className="truncate">{newClip.game || 'Select a registered game'}</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isClipGameMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isClipGameMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsClipGameMenuOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-[#141414] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1">
                      {gameCatalog.map((game) => (
                        <button
                          type="button"
                          key={game.id}
                          className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 rounded-lg flex items-center gap-2 transition"
                          onClick={() => {
                            setNewClip({ ...newClip, game: game.name, gameId: game.id });
                            setIsClipGameMenuOpen(false);
                          }}
                        >
                          <span className="font-medium">{game.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Video File</label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-white/10 file:text-white cursor-pointer"
                  onChange={(e) => setNewClip({ ...newClip, file: e.target.files?.[0] || null })}
                  required
                />
              </div>

              {clipUploadError && (
                <p className="rounded-lg bg-red-900/50 px-3 py-2 text-xs font-semibold text-red-200 border border-red-800">
                  {clipUploadError}
                </p>
              )}

              <button
                type="submit"
                disabled={isUploadingClip}
                className="w-full h-11 mt-4 rounded-xl bg-[#D6C98A] text-black text-xs font-bold uppercase tracking-widest hover:bg-yellow-600 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isUploadingClip ? 'Uploading...' : 'Deploy Moment'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileView;