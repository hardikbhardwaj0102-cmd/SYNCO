import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Users,
  Gamepad2,
  Shield,
  ChevronDown,
  Search,
  Trophy,
  Flame,
  RefreshCw,
} from 'lucide-react';


// Shared hero / sticky-header / content classes
// live in CompetitionEngine.css
import '../styles/pages/CompetitionEngine.css';
import '../styles/pages/Leaderboards.css';

import rank1Pose from '../assets/rank-1-pose.png';
import rank2Pose from '../assets/rank-2-pose.png';
import rank3Pose from '../assets/rank-3-pose.png';
import rank4Pose from '../assets/rank-4-pose.png';
import rank5Pose from '../assets/rank-5-pose.png';


// =========================================================
// API
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// CONSTANTS
// =========================================================

// 'players' and 'game' both use the players endpoint;
// 'game' adds the game filter
const CATEGORY_TABS = [
  {
    id: 'players',
    label: 'GLOBAL PLAYERS',
    icon: <Users size={16} />,
  },
  {
    id: 'game',
    label: 'BY GAME',
    icon: <Gamepad2 size={16} />,
  },
  {
    id: 'clubs',
    label: 'CLUBS',
    icon: <Shield size={16} />,
  },
];

const RANK_POSES = {
  1: rank1Pose,
  2: rank2Pose,
  3: rank3Pose,
  4: rank4Pose,
  5: rank5Pose,
};


// V-shape display:
// [Rank 4, Rank 2, Rank 1, Rank 3, Rank 5]
//
// These are indexes into the top-5 list.
const PODIUM_ORDER = [3, 1, 0, 2, 4];


// =========================================================
// HELPERS
// =========================================================

const getInitial = (name) => {
  if (!name) {
    return '?';
  }

  return name.trim().charAt(0).toUpperCase();
};


const getDisplayName = (item, isClubs) => {
  if (isClubs) {
    return item.name || 'Unknown Club';
  }

  return item.username || item.name || 'Unknown Player';
};


const getGameLabel = (item) =>
  item.game?.shortName ||
  item.game?.name ||
  'All Games';


const getItemKey = (item, isClubs) =>
  isClubs
    ? `club-${item.clubId}`
    : `player-${item.playerId}-${item.game?.id}`;


const formatPoints = (points) =>
  (points || 0).toLocaleString();


const formatRank = (rank) =>
  Number.isFinite(rank)
    ? String(rank).padStart(3, '0')
    : '--';


const getSecondaryLine = (item, isClubs) => {
  if (isClubs) {
    return [
      item.tag ? `[${item.tag}]` : '',
      `Level ${item.level || 1}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return item.uid
    ? `UID: ${item.uid}`
    : '';
};


// =========================================================
// INSIGNIA
// Avatar with initial fallback
// =========================================================

const Insignia = ({ avatar, name }) => {
  const [failed, setFailed] = useState(false);

  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        alt={name}
        onError={() => setFailed(true)}
      />
    );
  }

  return getInitial(name);
};


// =========================================================
// COMPONENT
// =========================================================

const Leaderboards = () => {

  // Timeframe:
  // 'WEEKLY' | 'SEASON'
  const [timeframe, setTimeframe] = useState('SEASON');

  // Category:
  // 'players' | 'game' | 'clubs'
  const [activeTab, setActiveTab] = useState('players');

  // Filters
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedGame, setSelectedGame] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [games, setGames] = useState([]);
  const [regions, setRegions] = useState([]);
  const [rankings, setRankings] = useState([]);

  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Ignores responses from older requests
  // when filters change quickly.
  const latestRequestId = useRef(0);

  const isClubs = activeTab === 'clubs';


  // =======================================================
  // LOAD FILTERS
  // =======================================================

  const loadFilters = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/leaderboards/filters`
      );

      if (!response.ok) {
        throw new Error(
          'Failed to load leaderboard filters.'
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message ||
          'Failed to load filters.'
        );
      }

      setGames(data.games || []);
      setRegions(data.regions || []);

    } catch (err) {
      console.error(
        'Leaderboard filters error:',
        err
      );
    }
  };


  // =======================================================
  // LOAD RANKINGS
  // Players or clubs
  // =======================================================

  const loadRankings = async () => {
    const requestId =
      ++latestRequestId.current;

    setRankingsLoading(true);
    setError('');

    const failureMessage = isClubs
      ? 'Failed to load club rankings.'
      : 'Failed to load player rankings.';

    try {
      const params = new URLSearchParams();

      if (
        selectedGame &&
        (activeTab === 'game' || isClubs)
      ) {
        params.append(
          'game',
          selectedGame
        );
      }

      if (selectedRegion) {
        params.append(
          'region',
          selectedRegion
        );
      }

      // Only sent for Weekly.
      // Season totals are the default response.
      if (timeframe === 'WEEKLY') {
        params.append(
          'timeframe',
          'weekly'
        );
      }

      const queryString =
        params.toString();

      const url =
        `${API_URL}/api/leaderboards/` +
        `${isClubs ? 'clubs' : 'players'}` +
        (
          queryString
            ? `?${queryString}`
            : ''
        );

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(failureMessage);
      }

      const data =
        await response.json();

      if (!data.success) {
        throw new Error(
          data.message ||
          failureMessage
        );
      }

      if (
        requestId !==
        latestRequestId.current
      ) {
        return;
      }

      setRankings(
        data.rankings || []
      );

    } catch (err) {
      if (
        requestId !==
        latestRequestId.current
      ) {
        return;
      }

      console.error(
        'Leaderboard rankings error:',
        err
      );

      setError(err.message);
      setRankings([]);

    } finally {
      if (
        requestId ===
        latestRequestId.current
      ) {
        setRankingsLoading(false);
      }
    }
  };


  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    loadFilters();
  }, []);


  // =======================================================
  // RELOAD WHEN TAB / FILTER / TIMEFRAME CHANGES
  // =======================================================

  useEffect(() => {
    loadRankings();
  }, [
    activeTab,
    selectedGame,
    selectedRegion,
    timeframe,
  ]);


  // =======================================================
  // REFRESH
  // =======================================================

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        loadFilters(),
        loadRankings(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };


  // =======================================================
  // TAB CHANGE
  // =======================================================

  const handleTabChange = (tab) => {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
    setSelectedGame('');
    setSelectedRegion('');
    setSearchQuery('');
    setError('');

    // Players and clubs have different fields,
    // so don't render the old list.
    setRankings([]);
    setRankingsLoading(true);
  };


  // =======================================================
  // DERIVED DATA
  // =======================================================

  // Podium:
  // Top 5 of the current tab + filters.
  // Not affected by search.
  const podiumSlots = useMemo(() => {
    const top5 =
      rankings.slice(0, 5);

    return PODIUM_ORDER
      .filter(
        (index) =>
          index < top5.length
      )
      .map((index) => ({
        item: top5[index],
        position: index + 1,
      }));
  }, [rankings]);


  // Table:
  // Client-side search over the loaded list.
  const visibleRows = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    if (!query) {
      return rankings;
    }

    return rankings.filter(
      (item) =>
        [
          item.name,
          item.username,
          item.uid,
          item.tag,
        ].some(
          (value) =>
            value &&
            String(value)
              .toLowerCase()
              .includes(query)
        )
    );
  }, [
    rankings,
    searchQuery,
  ]);


  // =======================================================
  // TABLE BODY
  // =======================================================

  const renderTableBody = () => {

    if (rankingsLoading) {
      return (
        <div className="rank-table-state">
          <p>
            Loading rankings...
          </p>
        </div>
      );
    }


    if (error) {
      return (
        <div className="rank-table-state is-error">

          <p>
            {error}
          </p>

          <button
            type="button"
            className="rank-retry-btn"
            onClick={loadRankings}
          >
            Retry
          </button>

        </div>
      );
    }


    if (visibleRows.length === 0) {
      return (
        <div className="rank-table-state">

          <h3>
            {rankings.length === 0
              ? 'No rankings available'
              : 'No matches found'}
          </h3>

          <p>
            {rankings.length === 0
              ? 'There are no ranking records matching the selected filters yet.'
              : 'Nothing in this list matches your search.'}
          </p>

        </div>
      );
    }


    return visibleRows.map((item) => {

      const name =
        getDisplayName(
          item,
          isClubs
        );

      const secondary =
        getSecondaryLine(
          item,
          isClubs
        );


      return (
        <div
          key={getItemKey(
            item,
            isClubs
          )}
          className={
            `rank-table-row ${
              item.rank <= 3
                ? 'is-top'
                : ''
            }`
          }
        >

          <div className="col-rank rank-number">
            #{formatRank(item.rank)}
          </div>


          <div className="col-insignia">

            <div className="player-insignia-badge">
              <Insignia
                avatar={item.avatar}
                name={name}
              />
            </div>

          </div>


          <div className="col-player rank-player-info">

            <span className="primary-name">
              {name}
            </span>

            {secondary && (
              <span className="secondary-alias">
                {secondary}
              </span>
            )}

          </div>


          <div className="col-region rank-region">
            {item.region || 'Global'}
          </div>


          <div className="col-game rank-game-tag">
            {getGameLabel(item)}
          </div>


          <div className="col-points rank-synco-points">
            {formatPoints(
              item.syncoPoints
            )}{' '}
            XP
          </div>

        </div>
      );
    });
  };


  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="comp-engine-wrapper leaderboards-page">

      {/* ===================================================
          1. HERO SECTION
          =================================================== */}

      <div className="comp-hero-section rank-hero">

        {/* Background Typography */}

        <div className="hero-bg-layer">

          <h1
            className="massive-bg-text"
            aria-hidden="true"
          >
            <span>
              HALL OF
            </span>

            <span>
              FAME
            </span>
          </h1>

        </div>


        {/* Timeframe Selector */}

        <div className="timeframe-toggle-container">

          <button
            type="button"
            className={
              `timeframe-btn ${
                timeframe === 'WEEKLY'
                  ? 'active'
                  : ''
              }`
            }
            onClick={() =>
              setTimeframe('WEEKLY')
            }
          >
            <Flame size={14} />

            <span>
              WEEKLY GAINS
            </span>
          </button>


          <button
            type="button"
            className={
              `timeframe-btn ${
                timeframe === 'SEASON'
                  ? 'active'
                  : ''
              }`
            }
            onClick={() =>
              setTimeframe('SEASON')
            }
          >
            <Trophy size={14} />

            <span>
              SEASON TOTALS
            </span>
          </button>

        </div>


        {/* V-Shape Top 5 Showcase */}

        <div className="v-shape-podium">

          {rankingsLoading ? (

            <p className="podium-empty">
              Loading rankings...
            </p>

          ) : error ? (

            <p className="podium-empty">
              Rankings unavailable
            </p>

          ) : podiumSlots.length === 0 ? (

            <p className="podium-empty">
              No rankings yet
            </p>

          ) : (

            podiumSlots.map(
              ({
                item,
                position,
              }) => (

                <div
                  key={getItemKey(
                    item,
                    isClubs
                  )}
                  className={
                    `podium-slot position-rank-${position}`
                  }
                >

                  {/* Character Graphic */}

                  <div className="podium-char-wrapper">

                    <img
                      src={
                        RANK_POSES[position]
                      }
                      alt={`Rank ${position}`}
                      className="podium-char-img"
                    />

                  </div>


                  {/* Player / Club Rank Card */}

                  <div className="podium-card">

                    <div className="podium-badge">
                      #
                      {item.rank ??
                        position}
                    </div>


                    <div className="podium-info">

                      <span className="podium-name">
                        {getDisplayName(
                          item,
                          isClubs
                        )}
                      </span>

                      <span className="podium-meta">
                        {item.region ||
                          'Global'}
                        {' • '}
                        {getGameLabel(item)}
                      </span>

                    </div>


                    <div className="podium-points">
                      {formatPoints(
                        item.syncoPoints
                      )}{' '}
                      XP
                    </div>

                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>


      {/* ===================================================
          2. MAIN CONTENT
          Scrolls over the hero.
          Background continues from .leaderboards-page.
          =================================================== */}

      <div className="post-hero-content rank-content-bg">

        {/* Sticky Controls Header */}

        <div className="competition-sticky-header rank-sticky-header">

          {/* Main Category Tabs */}

          <div className="rank-tabs-container">

            {CATEGORY_TABS.map(
              (tab) => (

                <button
                  type="button"
                  key={tab.id}
                  onClick={() =>
                    handleTabChange(
                      tab.id
                    )
                  }
                  className={
                    `rank-tab-btn ${
                      activeTab ===
                      tab.id
                        ? 'active'
                        : ''
                    }`
                  }
                >

                  {tab.icon}

                  <span>
                    {tab.label}
                  </span>

                </button>

              )
            )}

          </div>


          {/* Dynamic Filters */}

          <div className="rank-toolbar">

            {/* Search Input */}

            <div className="rank-search-box">

              <Search
                size={16}
                className="search-icon"
              />

              <input
                type="text"
                placeholder={
                  `Search ${
                    isClubs
                      ? 'clubs'
                      : 'players'
                  }...`
                }
                value={
                  searchQuery
                }
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
              />

            </div>


            {/* Game Selector */}

            {(activeTab === 'game' ||
              isClubs) && (

              <div className="rank-filter-dropdown">

                <select
                  value={
                    selectedGame
                  }
                  onChange={(e) =>
                    setSelectedGame(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    All Games
                  </option>

                  {games.map(
                    (game) => (

                      <option
                        key={game.id}
                        value={game.id}
                      >
                        {game.name}
                      </option>

                    )
                  )}

                </select>


                <ChevronDown
                  size={14}
                  className="dropdown-arrow"
                />

              </div>

            )}


            {/* Region Selector */}

            <div className="rank-filter-dropdown">

              <select
                value={
                  selectedRegion
                }
                onChange={(e) =>
                  setSelectedRegion(
                    e.target.value
                  )
                }
              >

                <option value="">
                  All Regions
                </option>

                {regions.map(
                  (region) => (

                    <option
                      key={region}
                      value={region}
                    >
                      {region}
                    </option>

                  )
                )}

              </select>


              <ChevronDown
                size={14}
                className="dropdown-arrow"
              />

            </div>


            {/* Refresh */}

            <button
              type="button"
              className="rank-refresh-btn"
              onClick={
                handleRefresh
              }
              disabled={
                refreshing
              }
              aria-label="Refresh leaderboard"
              title="Refresh"
            >

              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? 'spinning'
                    : ''
                }
              />

            </button>

          </div>

        </div>


        {/* =================================================
            3. LEADERBOARD TABLE
            ================================================= */}

        <div className="comp-main-content">

          <div className="rank-table-wrapper">

            {/* Table Column Headers */}

            <div className="rank-table-header">

              <div className="col-rank">
                RANK
              </div>

              <div className="col-insignia">
                INSIGNIA
              </div>

              <div className="col-player">
                {isClubs
                  ? 'CLUB'
                  : 'PLAYER'}
              </div>

              <div className="col-region">
                REGION
              </div>

              <div className="col-game">
                GAME
              </div>

              <div className="col-points">
                SYNCO POINTS
              </div>

            </div>


            {/* Table Rows */}

            <div className="rank-table-body">
              {renderTableBody()}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};


export default Leaderboards;
