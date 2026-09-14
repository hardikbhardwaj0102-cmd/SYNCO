import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/GamesHub.css';

const API_URL = import.meta.env.VITE_API_URL;

const GamesHub = () => {
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
      if (!API_URL) {
        setError('API URL is not configured.');
        setIsLoading(false);
        return;
      }

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
          throw new Error('Unable to load games');
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

        {games.map((game) => (
          <button
            key={game.id}
            onClick={() =>
              navigate(`/games/${game.id}`)
            }
            className="game-card-btn"
          >
            <span className="game-card-text">
              {game.name}
            </span>
          </button>
        ))}

      </div>
    </div>
  );
};

export default GamesHub;