import { useParams } from 'react-router-dom';
import { useState } from 'react';
import '../styles/pages/GameDetails.css';

const GameDetails = () => {
  const { gameId } = useParams();
  const [activeTab, setActiveTab] = useState('RESULTS');

  // Future Cloudflare Fetch: `SELECT * FROM game_stats WHERE game_id = ?`

  return (
    <div className="game-details-wrapper">
      <div className="game-header-section">
        <div className="game-icon-box">
          {gameId?.toUpperCase()}
        </div>
        <div>
          <h1 className="game-title">
            {gameId} Hub
          </h1>
          <p className="game-subtitle">
            Historical Data • Team Rankings • Hall of Fame
          </p>
        </div>
      </div>

      <div className="game-tabs-container">
        {['RESULTS', 'TOP CLUBS', 'PLAYER RANKINGS'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`game-tab-btn ${
              activeTab === tab ? 'game-tab-btn-active' : 'game-tab-btn-inactive'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Dynamic Content Views */}
      {activeTab === 'RESULTS' && (
        <div className="game-placeholder-box">
          <p className="game-placeholder-text">Past Tournament Results feed will mount here</p>
        </div>
      )}

      {activeTab === 'TOP CLUBS' && (
        <div className="game-placeholder-box">
          <p className="game-placeholder-text">Verified Club Resumes will mount here</p>
        </div>
      )}
    </div>
  );
};

export default GameDetails;