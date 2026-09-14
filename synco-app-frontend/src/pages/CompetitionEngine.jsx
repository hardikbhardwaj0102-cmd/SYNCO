import { useState } from 'react';
import GameCarousel from '../components/Pickem/GameCarousel';
import MatchCard from '../components/Pickem/MatchCard';
import '../styles/pages/CompetitionEngine.css';

const CompetitionEngine = () => {
  const [activeTab, setActiveTab] = useState('ALL MATCHES');
  const [activeGame, setActiveGame] = useState('pubg');

  const mockMatch = {
    id: 1,
    round: 'MATCH POINT FINALS - ROUND #3',
    status: 'ACTIVE',
    date: 'SUN, JUL 26 - 08:40 PM',
    userPick: null,
    teams: [
      { name: '17 Gaming', pickPercentage: 15 },
      { name: 'AG.AL', pickPercentage: 42 },
      { name: 'FULL SENSE', pickPercentage: 20 },
      { name: 'GAM Esports', pickPercentage: 23 }
    ]
  };

  return (
    <div className="comp-engine-container">
      <div className="comp-header-box">
        <h1 className="comp-title">Active Competitions</h1>
        <p className="comp-subtitle">
          Browse upcoming tournaments, predict match results, or register your roster for open brackets.
        </p>
      </div>

      <GameCarousel activeGameId={activeGame} onSelectGame={setActiveGame} />

      <div className="comp-tabs-container">
        {['ALL MATCHES', 'OPEN REGISTRATION', 'LIVE BRACKETS', 'MY TOURNAMENTS'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`comp-tab-btn ${
              activeTab === tab ? 'comp-tab-btn-active' : 'comp-tab-btn-inactive'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        <MatchCard match={mockMatch} />
      </div>
    </div>
  );
};

export default CompetitionEngine;