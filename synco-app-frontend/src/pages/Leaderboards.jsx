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

// Shared hero / sticky-header / content classes live in CompetitionEngine.css
import '../styles/pages/CompetitionEngine.css';
import '../styles/pages/Leaderboards.css';

import rank1Pose from '../assets/rank-1-pose.png';
import rank2Pose from '../assets/rank-2-pose.png';
import rank3Pose from '../assets/rank-3-pose.png';
import rank4Pose from '../assets/rank-4-pose.png';
import rank5Pose from '../assets/rank-5-pose.png';


const API_URL =
  'https://synco-backend-vi7b.onrender.com';


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


const PODIUM_ORDER = [
  3,
  1,
  0,
  2,
  4,
];


const getInitial = (name) => {

  if (!name) {
    return '?';
  }

  return name
    .trim()
    .charAt(0)
    .toUpperCase();

};


const getDisplayName = (
  item,
  isClubs
) => {

  if (isClubs) {
    return item.name || 'Unknown Club';
  }

  return (
    item.username ||
    item.name ||
    'Unknown Player'
  );

};


const getGameLabel = (item) =>
  item.game?.shortName ||
  item.game?.name ||
  'All Games';


const getItemKey = (
  item,
  isClubs
) =>
  isClubs
    ? `club-${item.clubId}`
    : `player-${item.playerId}-${item.game?.id}`;


const formatPoints = (points) =>
  (points || 0).toLocaleString();


const formatRank = (rank) =>
  Number.isFinite(rank)
    ? String(rank).padStart(3, '0')
    : '--';


const getSecondaryLine = (
  item,
  isClubs
) => {

  if (isClubs) {

    return [
      item.tag
        ? `[${item.tag}]`
        : '',

      `Level ${item.level || 1}`,

    ]
      .filter(Boolean)
      .join(' · ');

  }

  return item.uid
    ? `UID: ${item.uid}`
    : '';

};


const Insignia = ({
  avatar,
  name,
}) => {

  const [failed, setFailed] =
    useState(false);

  if (avatar && !failed) {

    return (
      <img
        src={avatar}
        alt={name}
        onError={() =>
          setFailed(true)
        }
      />
    );

  }

  return getInitial(name);

};


const Leaderboards = () => {

  const [timeframe, setTimeframe] =
    useState('SEASON');

  const [activeTab, setActiveTab] =
    useState('players');

  const [selectedRegion, setSelectedRegion] =
    useState('');

  const [selectedGame, setSelectedGame] =
    useState('');

  const [searchQuery, setSearchQuery] =
    useState('');

  const [games, setGames] =
    useState([]);

  const [regions, setRegions] =
    useState([]);

  const [rankings, setRankings] =
    useState([]);

  const [rankingsLoading, setRankingsLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const latestRequestId =
    useRef(0);

  const isClubs =
    activeTab === 'clubs';


  /* =======================================================
     LOAD FILTERS
     ======================================================= */

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

      const data =
        await response.json();

      if (!data.success) {

        throw new Error(
          data.message ||
          'Failed to load filters.'
        );

      }

      setGames(
        data.games || []
      );

      setRegions(
        data.regions || []
      );

    } catch (err) {

      console.error(
        'Leaderboard filters error:',
        err
      );

    }

  };


  /* =======================================================
     LOAD RANKINGS
     ======================================================= */

  const loadRankings = async () => {

    const requestId =
      ++latestRequestId.current;

    setRankingsLoading(true);
    setError('');

    const failureMessage =
      isClubs
        ? 'Failed to load club rankings.'
        : 'Failed to load player rankings.';

    try {

      const params =
        new URLSearchParams();


      if (
        selectedGame &&
        (
          activeTab === 'game' ||
          isClubs
        )
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


      if (
        timeframe === 'WEEKLY'
      ) {

        params.append(
          'timeframe',
          'weekly'
        );

      }


      const queryString =
        params.toString();


      const url =
        `${API_URL}/api/leaderboards/${
          isClubs
            ? 'clubs'
            : 'players'
        }` +
        (
          queryString
            ? `?${queryString}`
            : ''
        );


      const response =
        await fetch(url);


      if (!response.ok) {

        throw new Error(
          failureMessage
        );

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


      setError(
        err.message
      );


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


  /* =======================================================
     INITIAL FILTER LOAD
     ======================================================= */

  useEffect(() => {

    loadFilters();

  }, []);


  /* =======================================================
     RANKING RELOAD
     ======================================================= */

  useEffect(() => {

    loadRankings();

  }, [
    activeTab,
    selectedGame,
    selectedRegion,
    timeframe,
  ]);


  /* =======================================================
     REFRESH
     ======================================================= */

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


  /* =======================================================
     CATEGORY CHANGE
     ======================================================= */

  const handleTabChange = (
    tab
  ) => {

    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);

    setSelectedGame('');

    setSelectedRegion('');

    setSearchQuery('');

    setError('');

    setRankings([]);

    setRankingsLoading(true);

  };


  /* =======================================================
     PODIUM DATA
     ======================================================= */

  const podiumSlots =
    useMemo(() => {

      const top5 =
        rankings.slice(0, 5);


      return PODIUM_ORDER
        .filter(
          (index) =>
            index < top5.length
        )
        .map(
          (index) => ({
            item: top5[index],

            /*
              index 0 = rank 1
              index 1 = rank 2
              index 2 = rank 3
              index 3 = rank 4
              index 4 = rank 5

              PODIUM_ORDER changes only the visual
              left-to-right arrangement.

              The actual rank position remains:
              index + 1.
            */

            position:
              index + 1,
          })
        );

    }, [rankings]);


  /* =======================================================
     SEARCHED TABLE ROWS
     ======================================================= */

  const visibleRows =
    useMemo(() => {

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


  /* =======================================================
     CATEGORY TAB RENDERER
     ======================================================= */

  const renderCategoryTabs = (
    extraClass = ''
  ) => (

    <div
      className={
        `rank-tabs-container ${extraClass}`
      }
    >

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
                activeTab === tab.id
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

  );


  /* =======================================================
     TABLE BODY
     ======================================================= */

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
            onClick={
              loadRankings
            }
          >
            Retry
          </button>

        </div>

      );

    }


    if (
      visibleRows.length === 0
    ) {

      return (

        <div className="rank-table-state">

          <h3>
            {
              rankings.length === 0
                ? 'No rankings available'
                : 'No matches found'
            }
          </h3>


          <p>
            {
              rankings.length === 0
                ? 'There are no ranking records matching the selected filters yet.'
                : 'Nothing in this list matches your search.'
            }
          </p>

        </div>

      );

    }


    return visibleRows.map(
      (item) => {

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
            key={
              getItemKey(
                item,
                isClubs
              )
            }
            className={
              `rank-table-row ${
                item.rank <= 3
                  ? 'is-top'
                  : ''
              }`
            }
          >

            <div className="col-rank rank-number">

              #{formatRank(
                item.rank
              )}

            </div>


            <div className="col-insignia">

              <div className="player-insignia-badge">

                <Insignia
                  avatar={
                    item.avatar
                  }
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

              {
                item.region ||
                'Global'
              }

            </div>


            <div className="col-game rank-game-tag">

              {getGameLabel(
                item
              )}

            </div>


            <div className="col-points rank-synco-points">

              {
                formatPoints(
                  item.syncoPoints
                )
              }{' '}

              XP

            </div>

          </div>

        );

      }
    );

  };


  /* =======================================================
     PAGE
     ======================================================= */

  return (

    <div className="comp-engine-wrapper leaderboards-page">


      {/* =================================================
          HERO
      ================================================= */}

      <div className="comp-hero-section rank-hero">


        {/* =================================================
            HERO BACKGROUND TEXT
        ================================================= */}

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


        {/* =================================================
            WEEKLY / SEASON TOGGLE

            Pink / red active state.
        ================================================= */}

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
              setTimeframe(
                'WEEKLY'
              )
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
              setTimeframe(
                'SEASON'
              )
            }
          >

            <Trophy size={14} />

            <span>
              SEASON TOTALS
            </span>

          </button>

        </div>


        {/* =================================================
            PODIUM

            IMPORTANT:
            The category navigation is NOT inside this
            wrapper.

            This gives the podium its own vertical zone.
        ================================================= */}

        <div className="rank-podium-stage">

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
                    key={
                      getItemKey(
                        item,
                        isClubs
                      )
                    }
                    className={
                      `podium-slot position-rank-${position}`
                    }
                  >


                    {/* ===============================
                        CHARACTER
                    =============================== */}

                    <div className="podium-char-wrapper">

                      <img
                        src={
                          RANK_POSES[
                            position
                          ]
                        }
                        alt={
                          `Rank ${position}`
                        }
                        className="podium-char-img"
                      />

                    </div>


                    {/* ===============================
                        CARD
                    =============================== */}

                    <div className="podium-card">


                      <div className="podium-badge">

                        #
                        {
                          item.rank ??
                          position
                        }

                      </div>


                      <div className="podium-info">

                        <span className="podium-name">

                          {
                            getDisplayName(
                              item,
                              isClubs
                            )
                          }

                        </span>


                        <span className="podium-meta">

                          {
                            item.region ||
                            'Global'
                          }

                          {' • '}

                          {
                            getGameLabel(
                              item
                            )
                          }

                        </span>

                      </div>


                      <div className="podium-points">

                        {
                          formatPoints(
                            item.syncoPoints
                          )
                        }{' '}

                        XP

                      </div>


                    </div>

                  </div>

                )
              )

            )}

          </div>

        </div>


        {/* =================================================
            HERO CATEGORY NAV

            IMPORTANT:
            This is a SIBLING of rank-podium-stage.

            Therefore it cannot be constrained by the
            podium stage and will sit in its own bottom
            zone.
        ================================================= */}

        <div className="rank-hero-tabs">

          {renderCategoryTabs()}

        </div>


      </div>


      {/* =================================================
          POST HERO
      ================================================= */}

      <div className="post-hero-content rank-content-bg">


        {/* =================================================
            STICKY HEADER
        ================================================= */}

        <div className="competition-sticky-header rank-sticky-header">


          {/* =================================================
              STICKY CATEGORY NAV

              Gold active state is controlled by CSS.
          ================================================= */}

          <div className="rank-sticky-tabs">

            {renderCategoryTabs()}

          </div>


          {/* =================================================
              TOOLBAR
          ================================================= */}

          <div className="rank-toolbar">


            {/* ===============================
                SEARCH
            =============================== */}

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


            {/* ===============================
                GAME FILTER
            =============================== */}

            {(
              activeTab === 'game' ||
              isClubs
            ) && (

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
                        key={
                          game.id
                        }
                        value={
                          game.id
                        }
                      >

                        {
                          game.name
                        }

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


            {/* ===============================
                REGION FILTER
            =============================== */}

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


            {/* ===============================
                REFRESH
            =============================== */}

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
            TABLE
        ================================================= */}

        <div className="comp-main-content">


          <div className="rank-table-wrapper">


            {/* =================================================
                TABLE HEADER
            ================================================= */}

            <div className="rank-table-header">


              <div className="col-rank">
                RANK
              </div>


              <div className="col-insignia">
                INSIGNIA
              </div>


              <div className="col-player">
                {
                  isClubs
                    ? 'CLUB'
                    : 'PLAYER'
                }
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


            {/* =================================================
                TABLE BODY
            ================================================= */}

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
