import { useEffect, useMemo, useState } from 'react';
import GameCarousel from '../components/Pickem/GameCarousel';
import MatchCard from '../components/Pickem/MatchCard';
import '../styles/pages/CompetitionEngine.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://synco-backend-vi7b.onrender.com';

const CompetitionEngine = () => {
  const [activeTab, setActiveTab] = useState('ALL MATCHES');
  const [activeGame, setActiveGame] = useState('all');

  const [competitions, setCompetitions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* =====================================================
     LOAD COMPETITIONS
  ===================================================== */

  const loadCompetitions = async () => {
    setLoading(true);
    setError('');

    try {
      let url = `${API_URL}/api/competitions`;

      const params = new URLSearchParams();

      /*
       * "all" means no gameId filter.
       */
      if (activeGame && activeGame !== 'all') {
        params.append('gameId', activeGame);
      }

      const query = params.toString();

      if (query) {
        url += `?${query}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      const contentType =
        response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error(
          `Competition API returned ${response.status} instead of JSON`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.error ||
          `Competition API failed with status ${response.status}`
        );
      }

      setCompetitions(
        Array.isArray(data?.competitions)
          ? data.competitions
          : []
      );
    } catch (err) {
      console.error(
        'Competition load failed:',
        err
      );

      setError(
        err?.message ||
        'Unable to load competitions.'
      );

      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LOAD WHEN GAME CHANGES
  ===================================================== */

  useEffect(() => {
    loadCompetitions();
  }, [activeGame]);

  /* =====================================================
     FILTER COMPETITIONS BY TAB
  ===================================================== */

  const filteredCompetitions = useMemo(() => {
    let result = [...competitions];

    /* -----------------------------------------------
       OPEN REGISTRATION
    ------------------------------------------------ */

    if (activeTab === 'OPEN REGISTRATION') {
      result = result.filter((competition) => {
        const status = String(
          competition.status || ''
        ).toUpperCase();

        return (
          status === 'OPEN' ||
          status === 'REGISTRATION_OPEN' ||
          status === 'OPEN_REGISTRATION'
        );
      });
    }

    /* -----------------------------------------------
       LIVE BRACKETS
    ------------------------------------------------ */

    if (activeTab === 'LIVE BRACKETS') {
      result = result.filter((competition) => {
        const status = String(
          competition.status || ''
        ).toUpperCase();

        return (
          status === 'LIVE' ||
          status === 'IN_PROGRESS' ||
          status === 'ONGOING'
        );
      });
    }

    /* -----------------------------------------------
       MY TOURNAMENTS
    ------------------------------------------------ */

    if (activeTab === 'MY TOURNAMENTS') {
      result = result.filter((competition) => {
        return (
          competition.isParticipant === true ||
          competition.isRegistered === true ||
          competition.isOrganizer === true
        );
      });
    }

    return result;
  }, [competitions, activeTab]);

  /* =====================================================
     COMPETITION -> CARD DATA
  ===================================================== */

  const competitionToCard = (competition) => {
    return {
      id: competition.id,

      name:
        competition.name ||
        competition.title ||
        'Untitled Competition',

      description:
        competition.description || '',

      status:
        competition.status ||
        'UPCOMING',

      date:
        competition.competitionStart ||
        competition.startDate ||
        competition.registrationStart ||
        null,

      game:
        competition.gameName ||
        competition.gameId ||
        '',

      competitionType:
        competition.competitionType ||
        '',

      gameMode:
        competition.gameMode ||
        '',

      participantType:
        competition.participantType ||
        '',

      teamSize:
        competition.teamSize ||
        null,

      maxParticipants:
        competition.maxParticipants ||
        null,

      numberOfMatches:
        competition.numberOfMatches ||
        null,

      teams:
        Array.isArray(competition.teams)
          ? competition.teams
          : [],
    };
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="comp-engine-container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="comp-header-box">

        <h1 className="comp-title">
          Competitions
        </h1>

        <p className="comp-subtitle">
          Discover tournaments, join competitions, and
          compete for your place on SYNCO.
        </p>

      </div>

      {/* =================================================
          GAME CAROUSEL
      ================================================= */}

      <div className="competition-game-filter">

        {/* ALL GAMES */}

        <button
          type="button"
          onClick={() => setActiveGame('all')}
          className={`carousel-btn ${activeGame === 'all'
              ? 'carousel-btn-active'
              : ''
            }`}
        >

          <div className="carousel-logo">
            <span>ALL</span>
          </div>

          <span className="carousel-status carousel-status-active">
            AVAILABLE
          </span>

          {activeGame === 'all' && (
            <div className="carousel-indicator" />
          )}

        </button>

        <GameCarousel
          activeGameId={activeGame}
          onSelectGame={setActiveGame}
        />

      </div>

      {/* =================================================
          TABS
      ================================================= */}

      <div className="comp-tabs-container">

        {[
          'ALL MATCHES',
          'OPEN REGISTRATION',
          'LIVE BRACKETS',
          'MY TOURNAMENTS',
        ].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`comp-tab-btn ${activeTab === tab
                ? 'comp-tab-btn-active'
                : 'comp-tab-btn-inactive'
              }`}
          >
            {tab}
          </button>
        ))}

      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (
        <div className="comp-state-box">
          <p>Loading competitions...</p>
        </div>
      )}

      {/* =================================================
          ERROR
      ================================================= */}

      {!loading && error && (
        <div className="comp-state-box comp-error-box">

          <p>{error}</p>

          <button
            type="button"
            onClick={loadCompetitions}
            className="comp-retry-btn"
          >
            Retry
          </button>

        </div>
      )}

      {/* =================================================
          EMPTY
      ================================================= */}

      {!loading &&
        !error &&
        filteredCompetitions.length === 0 && (
          <div className="comp-state-box">

            <h3>
              No competitions found
            </h3>

            <p>
              There are currently no competitions
              matching your selected filters.
            </p>

          </div>
        )}

      {/* =================================================
          COMPETITION LIST
      ================================================= */}

      {!loading &&
        !error &&
        filteredCompetitions.length > 0 && (

          <div className="comp-list">

            {filteredCompetitions.map(
              (competition) => (
                <MatchCard
                  key={competition.id}
                  match={competitionToCard(
                    competition
                  )}
                />
              )
            )}

          </div>

        )}

    </div>
  );
};

export default CompetitionEngine;