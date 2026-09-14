import { useEffect, useState } from 'react';
import '../../styles/components/GameCarousel.css';

const API_URL = 'https://synco-backend-vi7b.onrender.com';

const GameCarousel = ({ activeGameId, onSelectGame }) => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const response = await fetch(`${API_URL}/api/games`);

        if (!response.ok) {
          throw new Error(
            `Games API failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setGames(data.games || []);
      } catch (error) {
        console.error('Game carousel load failed:', error);
        setGames([]);
      }
    };

    loadGames();
  }, []);

  return (
    <div className="carousel-container">
      {games.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => onSelectGame(game.id)}
          className={`carousel-btn ${activeGameId === game.id
              ? 'carousel-btn-active'
              : ''
            }`}
        >
          <div className="carousel-logo">
            {game.name}
          </div>

          <span className="carousel-status carousel-status-active">
            AVAILABLE
          </span>

          {activeGameId === game.id && (
            <div className="carousel-indicator" />
          )}
        </button>
      ))}
    </div>
  );
};

export default GameCarousel;
