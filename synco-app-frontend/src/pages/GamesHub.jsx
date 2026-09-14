import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/GamesHub.css';

const GamesHub = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/games');
        if (!response.ok) throw new Error('Unable to load games');
        const data = await response.json();
        setGames(data.games || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, []);

  if (isLoading) return <div className="games-hub-state">Loading games...</div>;
  if (error) return <div className="games-hub-state">{error}</div>;

  return (
    <div className="games-hub-container">
      <div className="games-hub-grid">
        {games.map((game) => (
          <button 
            key={game.id}
            onClick={() => navigate(`/games/${game.id}`)}
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