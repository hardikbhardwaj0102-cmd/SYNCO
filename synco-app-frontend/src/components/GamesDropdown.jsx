import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import '../styles/components/GamesDropdown.css';
import '../styles/components/GameLogos.css';

const API_URL = 'https://synco-backend-vi7b.onrender.com';

const GamesDropdown = ({ isVisible }) => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!isVisible || games.length) return;

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
        console.error('Games menu load failed:', error);
        setGames([]);
      }
    };

    loadGames();
  }, [isVisible, games.length]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="dropdown-container">
      <div className="dropdown-grid">
        {games.map((game) => (
          <Link
            key={game.id}
            to={`/games/${game.id}`}
            className="dropdown-item"
          >
            <div className="dropdown-text-container">
              <div className="flex h-20 w-full items-center justify-center">
                {game.logoUrl && (
                  <img
                    src={game.logoUrl}
                    alt={game.name}
                    className={`game-logo max-h-full max-w-[220px] ${game.id === 'cr'
                        ? 'game-logo--clash-royale'
                        : `game-logo--${game.id}`
                      }`}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GamesDropdown;
