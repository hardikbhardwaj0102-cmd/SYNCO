import { useEffect, useState } from 'react';
import '../../styles/components/GameCarousel.css';
import '../../styles/components/GameLogos.css';


const GameCarousel = ({ activeGameId, onSelectGame }) => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    fetch('/api/games')
      .then((response) => response.json())
      .then((data) => setGames(data.games || []))
      .catch((error) => console.error('Game carousel load failed:', error));
  }, []);

  return (
    <div className="carousel-container">
      {games.map((game) => (
        <button
          key={game.id}
          onClick={() => onSelectGame(game.id)}
          className={`carousel-btn ${activeGameId === game.id ? 'carousel-btn-active' : ''}`}
        >
          <div className="carousel-item flex h-28 w-full items-center justify-center">
            <img
              src={game.logoUrl || '/games/default-placeholder.png'}
              alt={game.name}
              className={`game-logo max-h-full max-w-[240px] transition-transform duration-300 hover:scale-105 ${game.id === 'cr' ? 'game-logo--clash-royale' : `game-logo--${game.id}`}`}
            />
          </div>
          <span className="carousel-status carousel-status-active">
            AVAILABLE
          </span>
          
          {/* Active Indicator Underline */}
          {activeGameId === game.id && (
            <div className="carousel-indicator" />
          )}
        </button>
      ))}
    </div>
  );
};

export default GameCarousel;