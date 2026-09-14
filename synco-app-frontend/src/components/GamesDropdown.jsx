import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/components/GamesDropdown.css';
import '../styles/components/GameLogos.css';


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
              <div className="flex h-20 w-full items-center justify-center">
                <img
                  src={game.logoUrl || '/games/default-placeholder.png'}
                  alt={game.name}
                  className={`game-logo max-h-full max-w-[220px] ${game.id === 'cr' ? 'game-logo--clash-royale' : `game-logo--${game.id}`}`}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};


export default GamesDropdown;