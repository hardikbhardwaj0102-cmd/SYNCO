import { useEffect, useState } from 'react';
import '../../styles/components/GameCarousel.css';
import '../../styles/components/GameLogos.css';

const API_URL = 'https://synco-backend-vi7b.onrender.com';

const GAME_LOGOS = {
  bgmi: '/games/bgmi.png.png',
  cr: '/games/clashroyale.png.png',
  freefire: '/games/freefire.png.png',
  pubg: '/games/pubg.png.png',
  pubgm: '/games/pubgm.png.png',
  val: '/games/valorant.png.png',
};

const GameCarousel = ({ activeGameId, onSelectGame }) => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const response = await fetch(`${API_URL}/api/games`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        });

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
      {games.map((game) => {
        const logoUrl = GAME_LOGOS[game.id];

        return (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelectGame(game.id)}
            className={`carousel-btn ${
              activeGameId === game.id
                ? 'carousel-btn-active'
                : ''
            }`}
          >
            <div className="carousel-logo">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${game.name} Logo`}
                  className={`game-logo ${
                    game.id === 'cr'
                      ? 'game-logo--clash-royale'
                      : `game-logo--${game.id}`
                  }`}
                  onError={(event) => {
                    console.error(
                      `Failed to load game logo: ${logoUrl}`
                    );

                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span>{game.name}</span>
              )}
            </div>

            <span className="carousel-status carousel-status-active">
              AVAILABLE
            </span>

            {activeGameId === game.id && (
              <div className="carousel-indicator" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default GameCarousel;
