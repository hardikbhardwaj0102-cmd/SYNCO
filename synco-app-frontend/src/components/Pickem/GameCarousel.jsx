import { useEffect, useRef, useState } from 'react';
import '../../styles/components/GameCarousel.css';
import '../../styles/components/GameLogos.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://synco-backend-vi7b.onrender.com';

const GAME_LOGOS = {
  bgmi: '/games/bgmi.png.png',
  cr: '/games/clashroyale.png.png',
  freefire: '/games/freefire.png.png',
  pubg: '/games/pubg.png.png',
  pubgm: '/games/pubgm.png.png',
  val: '/games/valorant.png.png',
};

const GameCarousel = ({
  activeGameId,
  onSelectGame,
  showCardBackground = true,
}) => {
  const [games, setGames] = useState([]);
  const carouselRef = useRef(null);

  /* =====================================================
     LOAD GAMES
  ===================================================== */

  useEffect(() => {
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

        setGames(
          Array.isArray(data?.games)
            ? data.games
            : []
        );
      } catch (error) {
        console.error(
          'Game carousel load failed:',
          error
        );

        setGames([]);
      }
    };

    loadGames();
  }, []);

  /* =====================================================
     CENTER THE ACTIVE GAME
     (re-runs when games finish loading so the first
     selection is centered too)
  ===================================================== */

  useEffect(() => {
    const carousel = carouselRef.current;
    const activeButton = carousel?.querySelector(`[data-game="${activeGameId}"]`);
    if (!carousel || !activeButton) return;

    carousel.scrollTo({
      left: activeButton.offsetLeft - (carousel.clientWidth - activeButton.offsetWidth) / 2,
      behavior: 'smooth'
    });
  }, [activeGameId, games]);

  return (
    // Mask wrapper creates the fade on the left and right edges
    <div className="carousel-mask-wrapper">
      <div
        ref={carouselRef}
        className={`carousel-container ${showCardBackground ? 'with-card-background' : 'cardless'}`}
      >
        {games.map((game) => {
          const logoUrl = GAME_LOGOS[game.id];

          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onSelectGame(game.id)}
              className={`carousel-glass-btn ${activeGameId === game.id ? 'active' : ''}`}
              data-game={game.id}
            >
              <div className="carousel-img-wrapper">
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

                      // Avoid a broken-image icon if the path is wrong
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="carousel-name-fallback">
                    {game.name}
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

export default GameCarousel;