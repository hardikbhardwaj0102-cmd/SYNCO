import { useEffect, useState } from 'react';
import { Crown, TrendingUp, Crosshair, Trophy, ChevronDown, ArrowRight, X } from 'lucide-react';
import '../styles/pages/DashboardHome.css';
import VideoClip from '../components/VideoClip';

const DashboardHome = () => {
  const [gameCatalog, setGameCatalog] = useState([]);
  const [profileGames, setProfileGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [clips, setClips] = useState([]);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [statsViewState, setStatsViewState] = useState('banner'); // 'banner', 'selecting', 'viewing'
  
  const performanceStats = {
    matches: 0,
    kdRatio: null,
    winRate: null,
    rank: null,
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      const [catalogResponse, profileResponse, clipsResponse] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/profile'),
        fetch('/api/profile/clips'),
      ]);
      if (catalogResponse.ok) setGameCatalog((await catalogResponse.json()).games || []);
      if (profileResponse.ok) setProfileGames((await profileResponse.json()).games || []);
      if (clipsResponse.ok) setClips((await clipsResponse.json()).clips || []);
    };
    loadDashboardData().catch((error) => console.error('Dashboard data load failed:', error));
  }, []);

  useEffect(() => {
    if (!selectedGame && gameCatalog.length) {
      setSelectedGame(profileGames[0]?.gameName || gameCatalog[0].name);
    }
  }, [gameCatalog, profileGames, selectedGame]);

  return (
    <div className="dashboard-wrapper">
      
      {/* 1. Premium Upgrade Banner */}
      <div className="premium-banner">
        <div className="premium-banner-left">
          <div className="premium-banner-icon-box">
            <Crown size={32} />
          </div>
          <div>
            <h2 className="premium-banner-title">Upgrade to SYNCO Premium</h2>
            <p className="premium-banner-subtitle">Unlock advanced analytics, priority tournament registration, and custom profile badges.</p>
          </div>
        </div>
        <button className="premium-banner-btn">
          Go Premium
        </button>
      </div>

      <div className="dashboard-grid">
        
          {/* STATE 1: INITIAL BANNER */}
          {statsViewState === 'banner' && (
            <button 
              className="stats-entry-banner group animate-in fade-in duration-300"
              onClick={() => setStatsViewState('selecting')}
            >
              <div className="stats-entry-content">
                <div>
                  <span className="stats-entry-eyebrow">SYNCO ANALYTICS</span>
                  <h2 className="stats-entry-title">
                    TRACK.<br/>
                    ANALYZE.<br/>
                    <span>IMPROVE.</span>
                  </h2>
                </div>
                
                {/* Button stays tightly grouped under the title */}
                <div className="stats-entry-action-wrapper">
                  <div className="stats-entry-action">
                    <span>View Performance Stats</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Footer text is now a direct child, allowing mt-auto to push it down */}
                <span className="stats-entry-footer-text">
                  An Engine Designed To Honor Your Gameplay
                </span>
              </div>
            </button>
          )}

          {/* STATE 2: VERTICAL TEXT-ONLY GAME LIST (Using GamesDropdown Font Style) */}
          {statsViewState === 'selecting' && (
            <div className="flex flex-col w-full h-full bg-white rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6 px-4 pt-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Title</h3>
                <button onClick={() => setStatsViewState('banner')} className="text-gray-400 hover:text-black">
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex flex-col gap-2 overflow-y-auto pr-2 pb-4">
                {gameCatalog.map((game) => (
                  <button
                    key={game.id}
                    className="stats-game-option-btn group"
                    onClick={() => {
                      setSelectedGame(game.name);
                      setStatsViewState('viewing');
                    }}
                  >
                    <span className="stats-game-option-title">
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

          {/* STATE 3: ACTIVE STATS VIEW (Always shows boxes with fallback/data) */}
          {statsViewState === 'viewing' && (
            <div className="flex flex-col w-full bg-white rounded-2xl p-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {/* Dynamic Header: Game Name in Custom Font + Dropdown Arrow */}
              <div className="flex items-center justify-center mb-6 border-b border-gray-100 pb-4 px-2">
                <button 
                  className="flex items-center gap-3 hover:opacity-70 transition-opacity text-left"
                  onClick={() => setStatsViewState('selecting')}
                >
                  <span className="stats-active-game-title">
                    {selectedGame || 'SELECT GAME'}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Stats Content - Always renders containers with data or fallback */}
              <div className="space-y-3 px-2">

                <div className="stat-box">
                  <div className="stat-icon-wrapper"><TrendingUp size={18}/></div>
                  <div className="stat-text">
                    <span className="stat-label">Current Rank</span>
                    <span className="stat-value">
                      {profileGames.find(g => g.gameName === selectedGame)?.rank || '--'}
                    </span>
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-icon-wrapper"><Crosshair size={18}/></div>
                  <div className="stat-text">
                    <span className="stat-label">K/D Ratio</span>
                    <span className="stat-value">
                      {profileGames.find(g => g.gameName === selectedGame)?.kd || '--'}
                    </span>
                  </div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-icon-wrapper"><Trophy size={18}/></div>
                  <div className="stat-text">
                    <span className="stat-label">Win Rate</span>
                    <span className="stat-value">
                      {profileGames.find(g => g.gameName === selectedGame)?.winRate || '--'}
                    </span>
                  </div>
                </div>

                

                {!profileGames.find(g => g.gameName === selectedGame) && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center pt-2">
                    No matches recorded yet for {selectedGame}.
                  </p>
                )}
              </div>
            </div>
          )}

      {/* 3. Highlight Videos Section */}
        <div className="highlights-card">
          <div className="highlights-header mb-4">
            <h3 className="highlights-title text-xl font-bold font-header uppercase tracking-wider text-black">Highlight Reel</h3>
            <p className="highlights-subtitle text-xs text-gray-500">Your gameplay clips. Swipe or scroll to view more.</p>
          </div>

          <div className="dashboard-highlights-scroll">
            {clips.length ? clips.map((clip) => (
              <div key={clip.id} className="dashboard-clip-wrapper">
                <VideoClip 
                  id={clip.id}
                  url={clip.url} 
                  title={clip.title} 
                  description={clip.description}
                  game={clip.game}
                  initialLikes={clip.likes}
                  initialComments={clip.comments}
                />
              </div>
            )) : (
              <p className="dashboard-empty-clips text-xs text-gray-500 font-bold uppercase tracking-widest p-8 text-center border-2 border-dashed border-gray-200 rounded-xl w-full">
                No clips added yet. Open Profile to add highlights.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardHome;