import { useEffect, useMemo, useState } from 'react';
import GameCarousel from '../components/Pickem/GameCarousel';
import MatchCard from '../components/Pickem/MatchCard';
import '../styles/pages/CompetitionEngine.css';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:5000';

const CompetitionEngine = () => {
  const [activeTab, setActiveTab] = useState('ALL MATCHES');
  const [activeGame, setActiveGame] = useState('all');

  const [competitions, setCompetitions] = useState([]);
  const [games, setGames] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* =====================================================
     LOAD GAMES
  ===================================================== */

  const loadGames = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/competitions/games`,
        {
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || 'Failed to load games'
        );
      }

      setGames(data?.games || []);
    } catch (err) {
      console.error('Failed to load competition games:', err);
    }
  };

  /* =====================================================
     LOAD COMPETITIONS
  ===================================================== */

  const loadCompetitions = async () => {
    setLoading(true);
    setError('');

    try {
      let url = `${API_URL}/api/competitions`;

      const params = new URLSearchParams();

      if (activeGame && activeGame !== 'all') {
        params.append('gameId', activeGame);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
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
          data?.message || 'Failed to load competitions'
        );
      }

      setCompetitions(data?.competitions || []);
    } catch (err) {
      console.error('Failed to load competitions:', err);
      setError(err.message || 'Unable to load competitions');
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, [activeGame]);

  /* =====================================================
     GAME LIST FOR CAROUSEL
  ===================================================== */

  const carouselGames = useMemo(() => {
    return [
      {
        id: 'all',
        name: 'All Games',
        slug: 'all',
        logoUrl: null,
        modes: [],
      },
      ...games,
    ];
  }, [games]);

  /* =====================================================
     FILTER COMPETITIONS
  ===================================================== */

  const filteredCompetitions = useMemo(() => {
    let result = [...competitions];

    if (activeTab === 'OPEN REGISTRATION') {
      result = result.filter((competition) => {
        const status =
          String(
            competition.status ||
            competition.registrationStatus ||
            ''
          ).toUpperCase();

        return (
          status.includes('REGISTRATION') ||
          status === 'OPEN' ||
          status === 'PUBLISHED'
        );
      });
    }

    if (activeTab === 'LIVE BRACKETS') {
      result = result.filter((competition) => {
        const status =
          String(competition.status || '').toUpperCase();

        return (
          status === 'LIVE' ||
          status === 'IN_PROGRESS' ||
          status === 'ONGOING'
        );
      });
    }

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
     CONVERT COMPETITION -> CARD
  ===================================================== */

  const createMatchFromCompetition = (competition) => {
    const status =
      String(competition.status || 'UPCOMING').toUpperCase();

    return {
      id: competition.id,

      name:
        competition.name ||
        competition.title ||
        'Untitled Competition',

      round:
        competition.roundName ||
        competition.round ||
        competition.competitionType ||
        'COMPETITION',

      status,

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

      description:
        competition.description ||
        '',

      userPick: null,

      teams: competition.teams || [],
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
          Discover tournaments, join competitions, and compete
          for your place on SYNCO.
        </p>
      </div>

      {/* =================================================
          GAME CAROUSEL
      ================================================= */}

      <GameCarousel
        games={carouselGames}
        activeGameId={activeGame}
        onSelectGame={setActiveGame}
      />

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

          <p>
            {error}
          </p>

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
              There are currently no competitions matching
              your selected filters.
            </p>

          </div>
        )}

      {/* =================================================
          COMPETITIONS
      ================================================= */}

      {!loading &&
        !error &&
        filteredCompetitions.length > 0 && (

          <div className="comp-list">

            {filteredCompetitions.map((competition) => (
              <MatchCard
                key={competition.id}
                match={createMatchFromCompetition(competition)}
              />
            ))}

          </div>

        )}

    </div>
  );
};

export default CompetitionEngine;