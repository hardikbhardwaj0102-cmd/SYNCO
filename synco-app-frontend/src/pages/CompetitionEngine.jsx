import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Layers3,
  Plus,
} from 'lucide-react';

import GameCarousel from '../components/Pickem/GameCarousel';
import '../styles/pages/CompetitionEngine.css';

import compHero from '../assets/comp-hero.png';
import cardCharacter from '../assets/card-charcter-logo.png';
import rosterCompBg from '../assets/roster-comp-bg.png';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:5000';

const TABS = [
  'ALL MATCHES',
  'OPEN REGISTRATION',
  'LIVE BRACKETS',
  'MY TOURNAMENTS',
];

const CompetitionEngine = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('ALL MATCHES');
  const [activeGame, setActiveGame] = useState('all');
  const [tournamentView, setTournamentView] = useState('coverflow');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const [competitions, setCompetitions] = useState([]);
  const [games, setGames] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const latestRequestId = useRef(0);


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
      console.error(
        'Failed to load competition games:',
        err
      );
    }
  };


  /* =====================================================
     LOAD COMPETITIONS
     ===================================================== */

  const loadCompetitions = async () => {
    const requestId = ++latestRequestId.current;

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

      if (requestId !== latestRequestId.current) {
        return;
      }

      setCompetitions(data?.competitions || []);
    } catch (err) {
      if (requestId !== latestRequestId.current) {
        return;
      }

      console.error(
        'Failed to load competitions:',
        err
      );

      setError(
        err.message || 'Unable to load competitions'
      );

      setCompetitions([]);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
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
          String(
            competition.status || ''
          ).toUpperCase();

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
     COMPETITION -> CARD
     ===================================================== */

  const cards = useMemo(
    () =>
      filteredCompetitions.map((competition) => ({
        id: competition.id,

        title:
          competition.name ||
          competition.title ||
          'Untitled Competition',

        subtitle:
          competition.roundName ||
          competition.round ||
          competition.competitionType ||
          'COMPETITION',

        competition,
      })),
    [filteredCompetitions]
  );


  /* =====================================================
     OPEN LIVE TOURNAMENT DASHBOARD
     ===================================================== */

  const openLiveTournament = (competitionId) => {
    if (
      competitionId === undefined ||
      competitionId === null ||
      competitionId === ''
    ) {
      console.error(
        'Unable to open live tournament: missing competition ID'
      );

      return;
    }

    navigate(
      `/live-tournament/${encodeURIComponent(
        String(competitionId)
      )}`
    );
  };


  /* =====================================================
     START FROM FIRST CARD WHEN LIST CHANGES
     ===================================================== */

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [activeTab, activeGame, competitions]);


  /* =====================================================
     MOVE COVERFLOW
     ===================================================== */

  const moveMatch = (direction) => {
    if (!cards.length) {
      return;
    }

    setActiveMatchIndex((currentIndex) => (
      (currentIndex + direction + cards.length) %
      cards.length
    ));
  };


  /* =====================================================
     TOURNAMENT CARD
     ===================================================== */

  const renderTournamentCard = (
    card,
    positionClass = '',
    cardIndex = 0
  ) => {
    const isActive =
      tournamentView === 'coverflow' &&
      cardIndex === activeMatchIndex;

    const competitionStatus =
      String(
        card.competition?.status || ''
      ).toUpperCase();

    const isRegistrationOpen =
      competitionStatus.includes('REGISTRATION') ||
      competitionStatus === 'OPEN' ||
      competitionStatus === 'PUBLISHED';

    const cardAction = isRegistrationOpen
      ? () =>
        navigate(
          `/competitions/${encodeURIComponent(
            String(card.id)
          )}/register`
        )
      : () => openLiveTournament(card.id);

    const cardActionLabel = isRegistrationOpen
      ? 'REGISTER NOW'
      : 'OPEN LIVE DASHBOARD';

    return (
      <button
        key={card.id}
        type="button"
        className={`portrait-roster-card ${positionClass} ${isActive ? 'active-tournament-card' : ''
          }`}
        onClick={cardAction}
        aria-label={
          isRegistrationOpen
            ? `Register for ${card.title}`
            : `Open ${card.title}`
        }
      >
        <img
          src={cardCharacter}
          alt=""
          className="card-bg-image"
        />

        <div className="card-gradient-overlay">
          <h3 className="card-title">
            {card.title}
          </h3>

          <p className="card-subtitle">
            {card.subtitle}
          </p>

          <span className="card-open-label">
            {cardActionLabel}
          </span>
        </div>
      </button>
    );
  };



  /* =====================================================
     TOURNAMENT LIST
     ===================================================== */

  const renderTournaments = () => {
    if (loading) {
      return (
        <div className="comp-state-box">
          <p>Loading competitions...</p>
        </div>
      );
    }

    if (error) {
      return (
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
      );
    }

    if (cards.length === 0) {
      return (
        <div className="comp-state-box">
          <h3>No competitions found</h3>

          <p>
            There are currently no competitions
            matching your selected filters.
          </p>
        </div>
      );
    }

    if (tournamentView === 'coverflow') {
      return (
        <div className="tournament-coverflow">

          {cards.length > 1 && (
            <button
              type="button"
              className="coverflow-arrow coverflow-arrow-prev"
              onClick={() => moveMatch(-1)}
              aria-label="Previous tournament"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {cards.map((card, index) => {
            const distance =
              (index -
                activeMatchIndex +
                cards.length) %
              cards.length;

            const position =
              distance === 0
                ? 0
                : distance === 1
                  ? 1
                  : distance === cards.length - 1
                    ? -1
                    : 2;

            return renderTournamentCard(
              card,
              `coverflow-card coverflow-position-${position}`,
              index
            );
          })}

          {cards.length > 1 && (
            <button
              type="button"
              className="coverflow-arrow coverflow-arrow-next"
              onClick={() => moveMatch(1)}
              aria-label="Next tournament"
            >
              <ChevronRight size={24} />
            </button>
          )}

        </div>
      );
    }

    return (
      <div className="tournament-grid">
        {cards.map((card, index) =>
          renderTournamentCard(
            card,
            '',
            index
          )
        )}
      </div>
    );
  };


  /* =====================================================
     RENDER
     ===================================================== */

  return (
    <div className="comp-engine-wrapper">

      {/* =================================================
          1. HERO SECTION
          ================================================= */}

      <div className="comp-hero-section">

        <div className="hero-bg-layer">

          <div
            className="repeating-text-row"
            aria-hidden="true"
          >
            <span>THAT NEW FIRE</span>
            <span>THAT NEW FIRE</span>
            <span>THAT NEW FIRE</span>
            <span>THAT NEW FIRE</span>
          </div>

          <h1
            className="massive-bg-text"
            aria-hidden="true"
          >
            <span>SYNCO</span>
            <span>SEASON</span>
            <span>01</span>
          </h1>

        </div>


        <img
          src={compHero}
          alt="Season Hero"
          className="compHero-img"
        />


        <div className="comp-hero-foreground">

          <div className="hero-copy">

            <span>
              SYNCO SEASON 1
            </span>

            <strong>
              CHAMPIONSHIP
            </strong>

          </div>


          <button
            type="button"
            className="hero-cta-btn"
            onClick={() => {
              if (cards.length > 0) {
                openLiveTournament(
                  cards[activeMatchIndex]?.id
                );
              }
            }}
          >
            BE A CHAMPION
          </button>

        </div>

      </div>


      {/* =================================================
          POST HERO
          ================================================= */}

      <div
        className="post-hero-content"
        style={{
          '--roster-bg-image': `url("${rosterCompBg}")`,
        }}
      >

        <div className="competition-sticky-header">

          {/* =================================================
              2. FREE-FLOATING ROSTER SECTION
              ================================================= */}

          <div className="floating-roster-section">

            <div className="roster-header">

              <h2 className="roster-title">
                ACTIVE COMPETITIONS
              </h2>

              <h3 className="roster-subtitle">
                Available Game Roster
              </h3>

            </div>


            <GameCarousel
              games={carouselGames}
              activeGameId={activeGame}
              onSelectGame={setActiveGame}
              showCardBackground={false}
            />

          </div>


          {/* =================================================
              3. TABS
              ================================================= */}

          <div className="comp-tabs-container">

            {TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`comp-tab-btn ${activeTab === tab
                    ? 'active'
                    : ''
                  }`}
              >
                {tab}
              </button>
            ))}

          </div>

        </div>


        {/* =================================================
            4. MAIN CONTENT
            ================================================= */}

        <div className="comp-main-content">

          <div className="tournament-toolbar">

            <h2 className="tournament-section-title">
              TOURNAMENTS
            </h2>


            <div className="tournament-toolbar-actions">

              <button
                type="button"
                className="create-competition-btn"
                onClick={() =>
                  navigate('/competitions/create')
                }
              >
                <Plus
                  size={16}
                  strokeWidth={2.5}
                />

                <span>
                  Create Competition
                </span>
              </button>


              <div
                className="tournament-view-toggle"
                role="group"
                aria-label="Tournament view"
              >

                <button
                  type="button"
                  className={
                    tournamentView === 'coverflow'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setTournamentView('coverflow')
                  }
                  aria-label="Coverflow view"
                >
                  <Layers3 size={16} />
                </button>


                <button
                  type="button"
                  className={
                    tournamentView === 'grid'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setTournamentView('grid')
                  }
                  aria-label="Grid view"
                >
                  <Grid2X2 size={16} />
                </button>

              </div>

            </div>

          </div>


          {renderTournaments()}

        </div>

      </div>

    </div>
  );
};

export default CompetitionEngine;