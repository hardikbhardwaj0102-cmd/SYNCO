import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import '../styles/components/GamesDropdown.css';
import '../styles/components/GameLogos.css';

const API_URL = 'https://synco-backend-vi7b.onrender.com';

const GAME_LOGOS = {
  bgmi: '/games/bgmi.png.png',
  cr: '/games/clashroyale.png.png',
  freefire: '/games/freefire.png.png',
  pubg: '/games/pubg.png.png',
  pubgm: '/games/pubgm.png.png',
  val: '/games/valorant.png.png',
};

const GamesDropdown = ({ isVisible }) => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!isVisible || games.length) return;

    const loadGames = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/games`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(
            `Games API failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setGames(data.games || []);
      } catch (error) {
        console.error(
          'Games menu load failed:',
          error
        );

        setGames([]);
      }
    };

    loadGames();
  }, [isVisible, games.length]);

  if (!isVisible) return null;

  return (
    <div className="dropdown-container">
      <div className="dropdown-grid">

        {games.map((game) => {
          const logoUrl = GAME_LOGOS[game.id];

          return (
            <Link
              key={game.id}
              to={`/games/${game.id}`}
              className="dropdown-item"
            >
              <div className="dropdown-text-container">

                <div className="flex h-20 w-full items-center justify-center">

                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt={game.name}
                      className={`game-logo ${game.id === 'cr'
                          ? 'game-logo--clash-royale'
                          : `game-logo--${game.id}`
                        }`}
                      onError={(event) => {
                        console.error(
                          `Failed to load game logo: ${logoUrl}`
                        );

                        event.currentTarget.style.display =
                          'none';
                      }}
                    />
                  )}

                </div>

              </div>
            </Link>
          );
        })}

      </div>
    </div>
  );
};

export default GamesDropdown;
