import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import '../styles/pages/GamesHub.css';
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

const GamesHub = () => {
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
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
            `Unable to load games (${response.status})`
          );
        }

        const data = await response.json();

        setGames(data.games || []);
      } catch (fetchError) {
        console.error(
          'Games fetch failed:',
          fetchError
        );

        setError(
          fetchError.message ||
          'Unable to load games.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (isLoading) {
    return (
      <div className="games-hub-state">
        Loading games...
      </div>
    );
  }

  if (error) {
    return (
      <div className="games-hub-state">
        {error}
      </div>
    );
  }

  if (!games.length) {
    return (
      <div className="games-hub-state">
        No games available.
      </div>
    );
  }

  return (
    <div className="games-hub-container">
      <div className="games-hub-grid">

        {games.map((game) => {
          const logoUrl = GAME_LOGOS[game.id];

          return (
            <button
              key={game.id}
              type="button"
              onClick={() =>
                navigate(`/games/${game.id}`)
              }
              className="game-card-btn"
            >
              <div className="game-card-header mb-4 flex h-24 w-full items-center justify-center">

                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${game.name} Logo`}
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
                ) : (
                  <span className="text-sm font-medium text-gray-400">
                    Logo unavailable
                  </span>
                )}

              </div>
            </button>
          );
        })}

      </div>
    </div>
  );
};

export default GamesHub;
