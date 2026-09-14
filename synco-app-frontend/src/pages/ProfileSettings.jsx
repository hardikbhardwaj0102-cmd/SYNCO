import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle, Plus, Trash2, ShieldCheck, 
  Gamepad2, Share2, UserCheck, Save, AlertTriangle, ArrowLeft, Upload, ChevronDown
} from 'lucide-react';
import '../styles/pages/ProfileSettings.css';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('BASIC INFO');
  const [isLoading, setIsLoading] = useState(true);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isTierMenuOpen, setIsTierMenuOpen] = useState(false);

  const tabs = ['BASIC INFO', 'GAMING INFO', 'SOCIAL LINKS', 'CLIPS', 'LINKED ACCOUNTS'];

  // 1. Dynamic States (Initialized empty, populated via API)
  const [basicData, setBasicData] = useState({
    name: '', username: '', email: '', gender: '', dob: '', region: '', bio: '', avatarUrl: ''
  });
  const [games, setGames] = useState([]);
  const [gameCatalog, setGameCatalog] = useState([]);
  const [newGame, setNewGame] = useState({
    gameName: '', ign: '', uid: '', role: '', tier: 'Semi-Pro', experience: ''
  });
  const [socials, setSocials] = useState({
    youtube: '', twitch: '', instagram: '', x: ''
  });
  const [linkedStatus, setLinkedStatus] = useState({
    discord: false, discordTag: '', google: false, email: true
  });
  const [clips, setClips] = useState([]);
  const [clipTitle, setClipTitle] = useState('');
  const [clipFile, setClipFile] = useState(null);
  const [clipError, setClipError] = useState('');

  // 2. Fetch Initial Profile Data from Flask Backend
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Assuming your Flask app runs on localhost:5000 and uses session/cookies for auth
        // If using Vite proxy, '/api/profile' maps to 'http://localhost:5000/api/profile'
        const [response, gamesResponse, clipsResponse] = await Promise.all([
          fetch('/api/profile', { method: 'GET' }),
          fetch('/api/games'),
          fetch('/api/profile/clips'),
        ]);
        if (clipsResponse.ok) setClips((await clipsResponse.json()).clips || []);
        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          setGameCatalog(gamesData.games || []);
          setNewGame((currentGame) => ({
            ...currentGame,
            gameName: currentGame.gameName || gamesData.games?.[0]?.name || '',
          }));
        }
        if (response.ok) {
          const data = await response.json();
          setBasicData(data.basicData || basicData);
          setGames(data.games || []);
          setSocials(data.socials || socials);
          setLinkedStatus(data.linkedStatus || linkedStatus);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, []); // Empty dependency array ensures this runs once on mount

  // 3. Backend Update Handlers
  const handleSaveProfile = async () => {
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basicData, socials }),
      });
      if (response.ok) {
        alert('Profile updated successfully!');
      } else {
        alert('Failed to update profile.');
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.prompt('Type DELETE to permanently delete your account and all profile data.') !== 'DELETE') return;

    const response = await fetch('/api/profile/account', { method: 'DELETE' });
    if (response.ok) {
      await logout();
      navigate('/');
    } else {
      alert('Unable to delete your account.');
    }
  };

  const handleAddGame = async (e) => {
    e.preventDefault();
    if (!newGame.ign || !newGame.uid) return;
    
    try {
      const response = await fetch('/api/profile/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGame),
      });
      
      if (response.ok) {
        const addedGame = await response.json();
        setGames([...games, addedGame]); // Append the newly created game (with DB ID)
        setNewGame({ gameName: gameCatalog[0]?.name || '', ign: '', uid: '', role: '', tier: 'Semi-Pro', experience: '' });
      }
    } catch (error) {
      console.error('Add game error:', error);
    }
  };

  const handleRemoveGame = async (gameId) => {
    try {
      const response = await fetch(`/api/profile/games/${gameId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setGames(games.filter((g) => g.id !== gameId));
      }
    } catch (error) {
      console.error('Delete game error:', error);
    }
  };

  const handleClipUpload = async (event) => {
    event.preventDefault();
    setClipError('');
    if (!clipFile) return setClipError('Choose a video clip first.');
    if (clips.length >= 6) return setClipError('You can add up to 6 clips.');

    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(clipFile);
    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(objectUrl);
      const { duration, videoWidth, videoHeight } = video;
      if (duration > 120) return setClipError('Clips must be 120 seconds or shorter.');
      if (videoWidth < 1280 || videoHeight < 720 || videoWidth > 1920 || videoHeight > 1080) {
        return setClipError('Clips must be between 720p and 1080p.');
      }
      const formData = new FormData();
      formData.append('clip', clipFile);
      formData.append('title', clipTitle || 'Gameplay clip');
      formData.append('durationSeconds', duration);
      formData.append('width', videoWidth);
      formData.append('height', videoHeight);
      const response = await fetch('/api/profile/clips', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) return setClipError(data.message || 'Unable to upload clip.');
      setClips((currentClips) => [...currentClips, data]);
      setClipFile(null);
      setClipTitle('');
      event.target.reset();
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setClipError('The selected file is not a readable video.');
    };
    video.src = objectUrl;
  };

  const handleRemoveClip = async (clipId) => {
    const response = await fetch(`/api/profile/clips/${clipId}`, { method: 'DELETE' });
    if (response.ok) setClips((currentClips) => currentClips.filter((clip) => clip.id !== clipId));
  };

  const triggerDiscordOAuth = () => {
    // Redirect user to your Flask Discord OAuth route
    window.location.href = '/api/auth/discord/login';
  };

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const handleBackToProfile = () => {
    if (user?.username) {
      navigate(`/profile/${encodeURIComponent(user.username)}`);
    } else {
      navigate('/');
    }
  };

  // 4. Loading State Guard
  if (isLoading) {
    return <div className="w-full flex justify-center items-center py-32 font-bold uppercase tracking-widest text-xs">Loading Profile...</div>;
  }

  return (
    <div className="profile-wrapper">
      <div className="profile-header">
        <div className="profile-heading-group">
          {basicData.avatarUrl && (
            <img className="profile-avatar" src={basicData.avatarUrl} alt="Profile" />
          )}
          <div>
          <h1 className="profile-title">Profile Settings</h1>
          <p className="profile-subtitle">Configure your personal credentials, register tournament in-game UIDs, and bind verified OAuth services.</p>
          </div>
        </div>
        <div className="profile-header-actions">
          <button onClick={handleBackToProfile} className="profile-back-btn"><ArrowLeft size={15} /> Back to Profile</button>
          <button onClick={handleSignOut} className="profile-signout-btn">SIGN OUT</button>
        </div>
      </div>

      <div className="profile-tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`profile-tab-btn ${activeTab === tab ? 'profile-tab-active' : 'profile-tab-inactive'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="profile-card">
        
        {/* BASIC INFO */}
        {activeTab === 'BASIC INFO' && (
          <div>
            <div className="profile-card-header profile-card-header-actions">
              <h2 className="profile-card-title">Basic Credentials</h2>
              <button onClick={handleSaveProfile} className="profile-edit-btn"><Save size={14} /> Save</button>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="profile-grid-2">
                <div className="profile-field">
                  <label className="profile-label">Full Name</label>
                  <input 
                    type="text" 
                    value={basicData.name || ''} 
                    onChange={(e) => setBasicData({ ...basicData, name: e.target.value })}
                    className="profile-input"
                  />
                </div>
                <div className="profile-field">
                  <label className="profile-label">
                    Username
                    {linkedStatus.discord ? (
                      <span className="profile-label-badge flex items-center gap-1"><ShieldCheck size={12} /> Synced</span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-bold">Unverified</span>
                    )}
                  </label>
                  <input 
                    type="text" 
                    value={basicData.username || ''} 
                    disabled={linkedStatus.discord}
                    onChange={(e) => setBasicData({ ...basicData, username: e.target.value })}
                    className={`profile-input ${linkedStatus.discord ? 'profile-input-locked' : ''}`} 
                  />
                </div>
              </div>

              <div className="profile-grid-2">
                <div className="profile-field">
                  <label className="profile-label">Email Address</label>
                  <input 
                    type="email" 
                    value={basicData.email || ''} 
                    onChange={(e) => setBasicData({ ...basicData, email: e.target.value })}
                    className="profile-input"
                  />
                </div>
                <div className="profile-field">
                  <label className="profile-label">Gender</label>
                  <select 
                    value={basicData.gender || 'Prefer not to say'} 
                    onChange={(e) => setBasicData({ ...basicData, gender: e.target.value })}
                    className="profile-input"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="profile-grid-2">
                <div className="profile-field">
                  <label className="profile-label">Date of Birth</label>
                  <input 
                    type="date" 
                    value={basicData.dob || ''} 
                    onChange={(e) => setBasicData({ ...basicData, dob: e.target.value })}
                    className="profile-input"
                  />
                </div>
                <div className="profile-field">
                  <label className="profile-label">Region / Country</label>
                  <input 
                    type="text" 
                    value={basicData.region || ''} 
                    onChange={(e) => setBasicData({ ...basicData, region: e.target.value })}
                    className="profile-input"
                  />
                </div>
              </div>

              <div className="profile-field">
                <label className="profile-label">Player Bio</label>
                <textarea 
                  value={basicData.bio || ''} 
                  onChange={(e) => setBasicData({ ...basicData, bio: e.target.value })}
                  className="profile-textarea"
                />
              </div>
            </div>
            
            <button onClick={handleSaveProfile} className="profile-save-btn">Save Basic Details</button>
          </div>
        )}

        {/* GAMING INFO */}
        {activeTab === 'GAMING INFO' && (
          <div>
            <div className="profile-card-header flex justify-between items-center">
              <h2 className="profile-card-title">Gaming Profile & In-Game IDs</h2>
              <Gamepad2 className="text-gray-300" size={32} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {games.map((g) => (
                <div key={g.id} className="gaming-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-black uppercase tracking-wider">{g.gameName}</span>
                      <h3 className="text-lg font-bold text-black mt-0.5">{g.ign}</h3>
                      <span className="text-[11px] text-gray-500 font-mono">UID: {g.uid}</span>
                    </div>
                    <button onClick={() => handleRemoveGame(g.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label="Remove game">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200/60">
                    <span className="gaming-badge bg-black text-white">{g.role}</span>
                    <span className="gaming-badge bg-[#C1A87D]/20 text-[#8B6E38]">{g.tier}</span>
                    <span className="gaming-badge bg-gray-200 text-gray-700">{g.experience}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-synco-light rounded-2xl border border-gray-200">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Plus size={16} /> Register New Game</h3>
              <form onSubmit={handleAddGame} className="flex flex-col gap-4">
                <div className="profile-grid-3">
                  <div className="profile-field custom-game-select-wrapper">
                    <label className="profile-label">Game</label>
                    
                    <button 
                      type="button"
                      className="profile-input flex items-center justify-between w-full"
                      onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
                    >
                      <span className="text-left truncate text-gray-700">
                        {newGame.gameName || 'SELECT A GAME'}
                      </span>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isGameMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isGameMenuOpen && (
                      <>
                        {/* Invisible overlay to close dropdown when clicking outside */}
                        <div className="custom-game-select-overlay" onClick={() => setIsGameMenuOpen(false)} />
                        
                        <div className="custom-game-select-menu !top-[70px]">
                          {gameCatalog.map((game) => (
                            <button
                              type="button"
                              key={game.id}
                              className={`custom-game-option ${newGame.gameName === game.name ? 'active' : ''}`}
                              onClick={() => {
                                setNewGame({ ...newGame, gameName: game.name });
                                setIsGameMenuOpen(false);
                              }}
                            >
                              <div className="game-option-icon">
                                {/* Optional: <img src={game.logoUrl} alt={game.name} /> */}
                              </div>
                              <div className="game-option-text">
                                <span className="game-option-title">{game.name}</span>
                                <span className="game-option-subtitle">{game.shortName || game.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="profile-field">
                    <label className="profile-label">IGN</label>
                    <input type="text" value={newGame.ign} onChange={(e) => setNewGame({ ...newGame, ign: e.target.value })} className="profile-input" required />
                  </div>
                  <div className="profile-field">
                    <label className="profile-label">Game UID</label>
                    <input type="text" value={newGame.uid} onChange={(e) => setNewGame({ ...newGame, uid: e.target.value })} className="profile-input" required />
                  </div>
                </div>
                <div className="profile-grid-3">
                  <div className="profile-field">
                    <label className="profile-label">Role</label>
                    <input type="text" value={newGame.role} onChange={(e) => setNewGame({ ...newGame, role: e.target.value })} className="profile-input" />
                  </div>
                  <div className="profile-field custom-game-select-wrapper">
                    <label className="profile-label">Tier</label>
                    
                    <button 
                      type="button"
                      className="profile-input flex items-center justify-between w-full"
                      onClick={() => setIsTierMenuOpen(!isTierMenuOpen)}
                    >
                      <span className="text-left truncate text-gray-700">
                        {newGame.tier || 'SELECT TIER'}
                      </span>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isTierMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTierMenuOpen && (
                      <>
                        <div className="custom-game-select-overlay" onClick={() => setIsTierMenuOpen(false)} />
                        
                        <div className="custom-game-select-menu !top-[70px]">
                          {['Casual', 'Semi-Pro', 'Pro'].map((tierOption) => (
                            <button
                              type="button"
                              key={tierOption}
                              className={`custom-game-option ${newGame.tier === tierOption ? 'active' : ''}`}
                              onClick={() => {
                                setNewGame({ ...newGame, tier: tierOption });
                                setIsTierMenuOpen(false);
                              }}
                            >
                              <div className="game-option-text px-2 py-1">
                                <span className="game-option-title">{tierOption}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="profile-field">
                    <label className="profile-label">Experience</label>
                    <input type="text" value={newGame.experience} onChange={(e) => setNewGame({ ...newGame, experience: e.target.value })} className="profile-input" />
                  </div>
                </div>
                <button type="submit" className="mt-2 w-max px-6 py-2.5 bg-black hover:bg-gray-800 text-white text-xs font-bold uppercase rounded-xl">Add Profile</button>
              </form>
            </div>
          </div>
        )}

        {/* SOCIAL LINKS */}
        {activeTab === 'SOCIAL LINKS' && (
          <div>
            <div className="profile-card-header profile-card-header-actions">
              <h2 className="profile-card-title">Social & Stream Handles</h2>
              <Share2 className="text-gray-300" size={32} />
              <button onClick={handleSaveProfile} className="profile-edit-btn"><Save size={14} /> Save</button>
            </div>
            <div className="flex flex-col gap-5">
              <div className="profile-grid-2">
                <div className="profile-field">
                  <label className="profile-label">YouTube</label>
                  <input type="url" value={socials.youtube || ''} onChange={(e) => setSocials({ ...socials, youtube: e.target.value })} className="profile-input" />
                </div>
                <div className="profile-field">
                  <label className="profile-label">Twitch</label>
                  <input type="url" value={socials.twitch || ''} onChange={(e) => setSocials({ ...socials, twitch: e.target.value })} className="profile-input" />
                </div>
              </div>
              <div className="profile-grid-2">
                <div className="profile-field">
                  <label className="profile-label">Instagram</label>
                  <input type="url" value={socials.instagram || ''} onChange={(e) => setSocials({ ...socials, instagram: e.target.value })} className="profile-input" />
                </div>
                <div className="profile-field">
                  <label className="profile-label">X / Twitter</label>
                  <input type="url" value={socials.x || ''} onChange={(e) => setSocials({ ...socials, x: e.target.value })} className="profile-input" />
                </div>
              </div>
            </div>
            <button onClick={handleSaveProfile} className="profile-save-btn">Save Social Links</button>
          </div>
        )}

        {activeTab === 'CLIPS' && (
          <div>
            <div className="profile-card-header">
              <h2 className="profile-card-title">Gameplay Clips</h2>
              <p className="profile-card-desc">Add up to 6 local clips. MP4, WebM, or MOV, maximum 120 seconds, 720p to 1080p.</p>
            </div>
            <div className="profile-clips-grid">
              {clips.map((clip) => (
                <div className="profile-clip-card" key={clip.id}>
                  <video src={clip.url} controls preload="metadata" />
                  <div className="profile-clip-card-footer"><span>{clip.title}</span><button onClick={() => handleRemoveClip(clip.id)} aria-label="Delete clip"><Trash2 size={15} /></button></div>
                </div>
              ))}
            </div>
            <form className="profile-clip-upload" onSubmit={handleClipUpload}>
              <input type="text" value={clipTitle} onChange={(event) => setClipTitle(event.target.value)} placeholder="Clip title" className="profile-input" />
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setClipFile(event.target.files?.[0] || null)} className="profile-input" />
              <button type="submit" className="profile-save-btn" disabled={clips.length >= 6}><Upload size={15} /> Upload Clip</button>
              {clipError && <p className="profile-clip-error">{clipError}</p>}
            </form>
          </div>
        )}

        {/* LINKED ACCOUNTS */}
        {activeTab === 'LINKED ACCOUNTS' && (
          <div>
            <div className="profile-card-header flex justify-between items-center">
              <h2 className="profile-card-title">Identity & Binding</h2>
              <UserCheck className="text-gray-300" size={32} />
            </div>
            <div className="flex flex-col gap-4">
              <div className={`linked-acc-item ${linkedStatus.google ? 'linked-acc-active' : 'linked-acc-inactive'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-white border border-gray-200 rounded-xl flex items-center justify-center font-bold text-sm text-[#4285F4]">G</div>
                  <div>
                    <h4 className="text-sm font-bold text-black flex items-center gap-2">Google Account {linkedStatus.google && <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle size={11} className="inline" /> Linked</span>}</h4>
                    <p className="text-xs text-synco-textMuted">{linkedStatus.google ? 'Google sign-in is linked to this account.' : 'Sign in with Google using this email to link it.'}</p>
                  </div>
                </div>
              </div>
              <div className={`linked-acc-item ${linkedStatus.discord ? 'linked-acc-active' : 'linked-acc-inactive'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#5865F2] text-white rounded-xl flex items-center justify-center font-bold text-sm">DC</div>
                  <div>
                    <h4 className="text-sm font-bold text-black flex items-center gap-2">Discord Verification {linkedStatus.discord && <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle size={11} className="inline" /> Verified</span>}</h4>
                    <p className="text-xs text-synco-textMuted">{linkedStatus.discord ? `Bound Tag: ${linkedStatus.discordTag}` : 'Required for official tournaments.'}</p>
                  </div>
                </div>
                {!linkedStatus.discord && (
                  <button onClick={triggerDiscordOAuth} className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold rounded-xl uppercase">Verify Discord</button>
                )}
              </div>
              <div className="profile-danger-zone">
                <div><h3>Delete account</h3><p>This permanently removes your account, profile, and registered games.</p></div>
                <button onClick={handleDeleteAccount} className="profile-delete-btn"><AlertTriangle size={15} /> Delete account</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProfileSettings;