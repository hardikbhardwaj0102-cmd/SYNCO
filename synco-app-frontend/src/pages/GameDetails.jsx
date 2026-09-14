import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/pages/GameDetails.css';

const API_URL = import.meta.env.VITE_API_URL;

const GameDetails = () => {
  const { gameId } = useParams();

  const [activeTab, setActiveTab] = useState('RESULTS');
  const [game, setGame] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // =========================================================
  // FETCH GAME DETAILS
  // =========================================================

  useEffect(() => {
    const fetchGameDetails = async () => {
      if (!API_URL) {
        setError('API URL is not configured.');
        setIsLoading(false);
        return;
      }

      if (!gameId) {
        setError('Game ID is missing.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/games/${gameId}`,
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
          if (response.status === 404) {
            throw new Error('Game not found.');
          }

          throw new Error('Unable to load game details.');
        }

        const data = await response.json();

        setGame(data.game || null);

      } catch (fetchError) {
        console.error(
          'Game details fetch failed:',
          fetchError
        );

        setError(
          fetchError.message ||
          'Unable to load game details.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameDetails();
  }, [gameId]);


  // =========================================================
  // LOADING
  // =========================================================

  if (isLoading) {
    return (
      <div className="game-details-wrapper">
        <div className="game-placeholder-box">
          <p className="game-placeholder-text">
            Loading game...
          </p>
        </div>
      </div>
    );
  }


  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="game-details-wrapper">
        <div className="game-placeholder-box">
          <p className="game-placeholder-text">
            {error}
          </p>
        </div>
      </div>
    );
  }


  // =========================================================
  // GAME NOT FOUND
  // =========================================================

  if (!game) {
    return (
      <div className="game-details-wrapper">
        <div className="game-placeholder-box">
          <p className="game-placeholder-text">
            Game not found.
          </p>
        </div>
      </div>
    );
  }


  // =========================================================
  // GAME DATA
  // =========================================================

  const gameName = game.name || gameId;

  const gameShortName =
    game.shortName ||
    gameName;

  const gameDescription =
    game.description ||
    'Historical Data • Team Rankings • Hall of Fame';


  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="game-details-wrapper">

      {/* =====================================================
          GAME HEADER
      ===================================================== */}

      <div className="game-header-section">

        <div className="game-icon-box">

          {game.logoUrl ? (
            <img
              src={game.logoUrl}
              alt={`${gameName} logo`}
              className="game-logo"
            />
          ) : (
            gameShortName.toUpperCase()
          )}

        </div>

        <div>

          <h1 className="game-title">
            {gameName} Hub
          </h1>

          <p className="game-subtitle">
            {gameDescription}
          </p>

        </div>

      </div>


      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="game-tabs-container">

        {[
          'RESULTS',
          'TOP CLUBS',
          'PLAYER RANKINGS'
        ].map((tab) => (

          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`game-tab-btn ${activeTab === tab
                ? 'game-tab-btn-active'
                : 'game-tab-btn-inactive'
              }`}
          >
            {tab}
          </button>

        ))}

      </div>


      {/* =====================================================
          RESULTS
      ===================================================== */}

      {activeTab === 'RESULTS' && (
        <div className="game-placeholder-box">

          <p className="game-placeholder-text">
            Past Tournament Results feed will mount here
          </p>

        </div>
      )}


      {/* =====================================================
          TOP CLUBS
      ===================================================== */}

      {activeTab === 'TOP CLUBS' && (
        <div className="game-placeholder-box">

          <p className="game-placeholder-text">
            Verified Club Resumes will mount here
          </p>

        </div>
      )}


      {/* =====================================================
          PLAYER RANKINGS
      ===================================================== */}

      {activeTab === 'PLAYER RANKINGS' && (
        <div className="game-placeholder-box">

          <p className="game-placeholder-text">
            Player Rankings will mount here
          </p>

        </div>
      )}

    </div>
  );
};

export default GameDetails;