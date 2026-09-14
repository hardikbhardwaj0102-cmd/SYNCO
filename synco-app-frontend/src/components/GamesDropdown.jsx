import { useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Crosshair,
  Swords,
  Trophy,
  Target,
  Zap,
  Shield
} from 'lucide-react';

import '../styles/components/GamesDropdown.css';

const GamesDropdown = ({
  isVisible,
  onMouseEnter,
  onMouseLeave
}) => {
  const navigate = useNavigate();

  const games = [
    {
      id: 'bgmi',
      name: 'BGMI',
      icon: Target
    },
    {
      id: 'pubgm',
      name: 'PUBG MOBILE',
      icon: Crosshair
    },
    {
      id: 'cs2',
      name: 'COUNTER-STRIKE 2',
      icon: Crosshair
    },
    {
      id: 'valorant',
      name: 'VALORANT',
      icon: Zap
    },
    {
      id: 'freefire',
      name: 'FREE FIRE',
      icon: Swords
    },
    {
      id: 'pubg',
      name: 'PUBG',
      icon: Shield
    },
    {
      id: 'cr',
      name: 'CLASH ROYALE',
      icon: Trophy
    }
  ];

  if (!isVisible) {
    return null;
  }

  const handleGameClick = (gameId) => {
    navigate(`/games/${gameId}`);
  };

  return (
    <div
      className="dropdown-container"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >

      <div className="dropdown-grid">

        {games.map((game) => {
          const Icon = game.icon;

          return (
            <button
              key={game.id}
              type="button"
              className="dropdown-item group"
              onClick={() => handleGameClick(game.id)}
            >

              <div className="dropdown-icon-box">

                <Icon
                  size={22}
                  strokeWidth={1.7}
                  className="dropdown-icon-text"
                />

              </div>

              <div className="dropdown-text-container">

                <span className="dropdown-title">
                  {game.name}
                </span>

                <span className="dropdown-dates">
                  EXPLORE GAME
                </span>

              </div>

              <Gamepad2
                size={18}
                strokeWidth={1.5}
                className="ml-3 flex-shrink-0"
              />

            </button>
          );
        })}

      </div>

    </div>
  );
};

export default GamesDropdown;