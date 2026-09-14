import { useEffect, useState } from 'react';
import { Crown, TrendingUp, Crosshair, Trophy, ChevronDown, ArrowRight, X, Heart, MessageCircle } from 'lucide-react';
import '../styles/pages/DashboardHome.css';
import VideoClip from '../components/VideoClip';

const DashboardHome = () => {
  const [gameCatalog, setGameCatalog] = useState([]);
  const [profileGames, setProfileGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [clips, setClips] = useState([]);
  const [statsViewState, setStatsViewState] = useState('banner'); 
  
  useEffect(() => {
    const loadDashboardData = async () => {
      const [catalogResponse, profileResponse, clipsResponse] = await Promise.all([
        fetch('/api/games').catch(() => ({ ok: false })),
        fetch('/api/profile').catch(() => ({ ok: false })),
        fetch('/api/profile/clips').catch(() => ({ ok: false })),
      ]);
      if (catalogResponse?.ok) setGameCatalog((await catalogResponse.json()).games || []);
      if (profileResponse?.ok) setProfileGames((await profileResponse.json()).games || []);
      if (clipsResponse?.ok) setClips((await clipsResponse.json()).clips || []);
    };
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!selectedGame && gameCatalog.length) {
      setSelectedGame(profileGames[0]?.gameName || gameCatalog[0].name);
    }
  }, [gameCatalog, profileGames, selectedGame]);

  const handleLikeClip = (clipId) => {
    setClips(prevClips => prevClips.map(clip => {
      if (clip.id === clipId) {
        const isLiked = !clip.isLiked;
        return {
          ...clip,
          isLiked: isLiked,
          likes: isLiked ? (clip.likes || 0) + 1 : (clip.likes || 0) - 1
        };
      }
      return clip;
    }));
  };

  return (
    <div className="dashboard-wrapper">
      
      {/* 1. Premium Upgrade Banner */}
      <div className="premium-banner">
        <div className="premium-banner-left">
          <div className="premium-banner-icon-box">
            <Crown size={24} />
          </div>
          <div>
            <h2 className="premium-banner-title font-super-brigade">Upgrade to SYNCO Premium</h2>
            <p className="premium-banner-subtitle">Unlock advanced analytics, priority tournament registration, and custom profile badges.</p>
          </div>
        </div>
        <button className="premium-banner-btn">
          Go Premium
        </button>
      </div>

      {/* DASHBOARD MAIN GRID - 12 Columns, single screen height lock */}
      <div className="dashboard-main-grid">
        
        {/* --- LEFT COLUMN: PROFILE, IDENTITY, & STATS (7 Columns) --- */}
        <div className="dashboard-left-column">
          
          {/* TOP ROW: Competitive Profile + Identity Stack */}
          <div className="dashboard-top-row">
            
            {/* View Competitive Profile Card */}
            <div className="competitive-profile-card group">
              <div className="competitive-profile-content">
                <span className="competitive-eyebrow">PLAYER IDENTITY</span>
                <h3 className="competitive-title font-super-brigade">
                  View<br/>
                  Competitive<br/>
                  <span>Profile</span>
                </h3>
                <button className="competitive-action-btn mt-auto">
                  <span>Explore Stats</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Identity Stack (Skill Level + Gametag) */}
            <div className="identity-stack">
              <div className="identity-card">
                <div className="identity-card-gradient-top"></div>
                <span className="identity-eyebrow">RATING</span>
                <h3 className="identity-title font-super-brigade">SKILL LEVEL</h3>
                <div className="identity-badge">Calculating...</div>
              </div>

              <div className="identity-card">
                <div className="identity-card-gradient-bottom"></div>
                <span className="identity-eyebrow">SYNCO ID</span>
                <h3 className="identity-title font-super-brigade">GAMETAG</h3>
                <div className="identity-value">FROAKAI</div>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Performance Stats Module */}
          <div className="stats-module-container">
            
            {/* STATE 1: HORIZONTAL BANNER */}
            {statsViewState === 'banner' && (
              <button 
                className="stats-banner-horizontal group"
                onClick={() => setStatsViewState('selecting')}
              >
                <div className="stats-banner-left">
                  <span className="stats-entry-eyebrow">SYNCO ANALYTICS</span>
                  <h2 className="stats-banner-title font-super-brigade">
                    TRACK. ANALYZE. <span>IMPROVE.</span>
                  </h2>
                </div>
                
                <div className="stats-banner-right">
                  <div className="stats-entry-action">
                    <span>View Stats</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                  <span className="stats-entry-footer-text">
                    Engine designed to make gameplay matter
                  </span>
                </div>
              </button>
            )}

            {/* STATE 2: VERTICAL TEXT-ONLY GAME LIST */}
            {statsViewState === 'selecting' && (
              <div className="stats-selecting-container animate-in fade-in zoom-in-95 duration-200">
                <div className="stats-selecting-header">
                  <h3 className="stats-selecting-title">Select Title</h3>
                  <button onClick={() => setStatsViewState('banner')} className="stats-close-btn">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="stats-game-list">
                  {gameCatalog.map((game) => (
                    <button
                      key={game.id}
                      className="stats-game-option-btn group"
                      onClick={() => {
                        setSelectedGame(game.name);
                        setStatsViewState('viewing');
                      }}
                    >
                      <span className="stats-game-option-title font-super-brigade">
                        {game.name}
                      </span>
                      <span className="stats-game-option-sub">
                        {game.shortName || 'ACTIVE'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STATE 3: ACTIVE STATS VIEW */}
            {statsViewState === 'viewing' && (
              <div className="stats-active-container animate-in fade-in slide-in-from-bottom-4 duration-300">
                
                <div className="stats-active-header">
                  <button 
                    className="stats-active-header-btn"
                    onClick={() => setStatsViewState('selecting')}
                  >
                    <span className="stats-active-game-title font-super-brigade">
                      {selectedGame || 'SELECT GAME'}
                    </span>
                    <ChevronDown size={18} className="text-[#D6C98A]" />
                  </button>
                </div>

                <div className="stats-active-grid">
                  <div className="stat-box-dark">
                    <div className="stat-icon-wrapper-dark"><TrendingUp size={18}/></div>
                    <div className="stat-text">
                      <span className="stat-label-dark">Current Rank</span>
                      <span className="stat-value-dark">
                        {profileGames.find(g => g.gameName === selectedGame)?.rank || '--'}
                      </span>
                    </div>
                  </div>

                  <div className="stat-box-dark">
                    <div className="stat-icon-wrapper-dark"><Crosshair size={18}/></div>
                    <div className="stat-text">
                      <span className="stat-label-dark">K/D Ratio</span>
                      <span className="stat-value-dark">
                        {profileGames.find(g => g.gameName === selectedGame)?.kd || '--'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="stat-box-dark">
                    <div className="stat-icon-wrapper-dark"><Trophy size={18}/></div>
                    <div className="stat-text">
                      <span className="stat-label-dark">Win Rate</span>
                      <span className="stat-value-dark">
                        {profileGames.find(g => g.gameName === selectedGame)?.winRate || '--'}
                      </span>
                    </div>
                  </div>
                </div>
                {!profileGames.find(g => g.gameName === selectedGame) && (
                  <p className="stats-empty-message">No matches recorded yet for {selectedGame}.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT COLUMN: SYNCO MEDIA (Reels View) --- */}
        <div className="dashboard-right-column">
          <div className="reels-outer-card">
            
            {/* Top Logo Header */}
            <div className="reels-header">
              <span className="font-super-brigade text-[#D6C98A] text-2xl tracking-widest lowercase">synco</span>
            </div>

            {/* Scrollable White Container (The Viewport) */}
            <div className="reels-scroll-viewport">
              
              {clips.length ? clips.map((clip) => (
/* Individual Reel Page */
                <div key={clip.id} className="reel-page">
                  
                  {/* Tags Row (Pulls actual game name) */}
                  <div className="reel-tags-row">
                    <span className="reel-tag">{clip.game || 'UNSPECIFIED'}</span>
                    <span className="reel-tag">{clip.skillTag || 'SKILL UNSPECIFIED'}</span>
                    <span className="reel-tag">{clip.roleTag || 'ROLE UNSPECIFIED'}</span>
                  </div>

                  {/* Video Container */}
                  <div className="reel-video-container">
                    <VideoClip 
                      id={clip.id} 
                      url={clip.url} 
                      title={clip.title} 
                      description={clip.description} 
                      game={clip.game}
                      hideOverlay={true} 
                    />
                  </div>

                  {/* Interactions Row */}
                  <div className="reel-interactions">
                    <button 
                      onClick={() => handleLikeClip(clip.id)} 
                      className="flex items-center gap-2 group outline-none"
                    >
                      <Heart 
                        size={32} 
                        className={`cursor-pointer transition-transform group-hover:scale-110 ${clip.isLiked ? 'fill-[#D32F2F] text-[#D32F2F]' : 'text-[#D32F2F]'}`} 
                      />
                      <span className="text-black font-bold text-sm">{clip.likes || 0}</span>
                    </button>

                    <button 
                      onClick={() => console.log("Open comments for", clip.id)}
                      className="flex items-center gap-2 group outline-none ml-4"
                    >
                      <MessageCircle 
                        size={32} 
                        className="fill-[#D32F2F] text-[#D32F2F] cursor-pointer transition-transform group-hover:scale-110" 
                      />
                      <span className="text-black font-bold text-sm">{clip.comments || 0}</span>
                    </button>
                  </div>

                  {/* Description Box (Pulls actual description) */}
                  <div className="reel-description">
                    DESCRIPTION: <span className="font-normal text-gray-600 ml-2">{clip.description || 'NO DESCRIPTION PROVIDED.'}</span>
                  </div>

                </div>
              )) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">No Clips Available</span>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;