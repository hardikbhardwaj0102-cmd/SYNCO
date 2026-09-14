import { useEffect, useState } from 'react';
import '../../styles/components/GameCarousel.css';

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
          {/* Mocking the game logos with stylized text for now */}
          <div className="carousel-logo">
            {game.name}
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