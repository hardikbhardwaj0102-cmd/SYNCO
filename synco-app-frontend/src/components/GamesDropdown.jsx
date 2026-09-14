import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/components/GamesDropdown.css';

const GamesDropdown = ({ isVisible }) => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!isVisible || games.length) return;
    fetch('/api/games')
      .then((response) => response.json())
      .then((data) => setGames(data.games || []))
      .catch((error) => console.error('Games menu load failed:', error));
  }, [isVisible, games.length]);

  if (!isVisible) return null;

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
              <span className="dropdown-title">
                {game.name}
              </span>
              <span className="dropdown-dates">
                {game.shortName}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GamesDropdown;