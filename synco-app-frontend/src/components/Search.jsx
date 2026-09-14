import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  User,
  Shield,
  Gamepad2,
  ArrowRight,
  X,
} from 'lucide-react';

import '../styles/components/Search.css';


// =========================================================
// API
// =========================================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://synco-backend-vi7b.onrender.com';


// =========================================================
// COMPONENT
// =========================================================

const Search = () => {

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState('all');

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState('');

  const [results, setResults] = useState({
    users: [],
    clubs: [],
    games: [],
  });


  // =====================================================
  // TABS
  // =====================================================

  const tabs = [
    {
      id: 'all',
      label: 'All Results',
    },
    {
      id: 'users',
      label: 'Users',
    },
    {
      id: 'clubs',
      label: 'Clubs',
    },
    {
      id: 'games',
      label: 'Games',
    },
  ];


  // =====================================================
  // SEARCH
  // =====================================================

  useEffect(() => {

    const query = searchQuery.trim();

    if (!query) {

      setResults({
        users: [],
        clubs: [],
        games: [],
      });

      setIsLoading(false);
      setError('');

      return;
    }


    let cancelled = false;


    const fetchSearchResults = async () => {

      setIsLoading(true);
      setError('');


      try {

        const response = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(query)}&type=${activeTab}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );


        let data = null;

        try {
          data = await response.json();
        } catch {
          throw new Error(
            'The server returned an invalid response.'
          );
        }


        if (!response.ok) {

          throw new Error(
            data?.message ||
            'Search request failed.'
          );
        }


        if (cancelled) {
          return;
        }


        setResults(
          data?.results || {
            users: [],
            clubs: [],
            games: [],
          }
        );

      } catch (err) {

        if (cancelled) {
          return;
        }

        console.error(
          'Search failed:',
          err
        );

        setResults({
          users: [],
          clubs: [],
          games: [],
        });

        setError(
          err.message ||
          'Unable to search right now.'
        );

      } finally {

        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };


    // -------------------------------------------------
    // Debounce
    // -------------------------------------------------

    const debounceTimer = setTimeout(
      fetchSearchResults,
      350
    );


    return () => {

      cancelled = true;

      clearTimeout(
        debounceTimer
      );
    };

  }, [
    searchQuery,
    activeTab,
  ]);


  // =====================================================
  // CLEAR SEARCH
  // =====================================================

  const clearSearch = () => {

    setSearchQuery('');

    setResults({
      users: [],
      clubs: [],
      games: [],
    });

    setError('');
  };


  // =====================================================
  // NAVIGATION
  // =====================================================

  const handleUserClick = (user) => {

    if (!user) {
      return;
    }


    if (user.username) {

      navigate(
        `/profile/${user.username}`
      );

      return;
    }


    // Fallback using UID if username
    // has not been created yet.

    if (user.uid) {

      navigate(
        `/profile/${user.uid}`
      );
    }
  };


  const handleClubClick = (club) => {

    if (!club?.id) {
      return;
    }

    navigate(
      `/clubs/${club.id}`
    );
  };


  const handleGameClick = (game) => {

    if (!game) {
      return;
    }


    if (game.slug) {

      navigate(
        `/games/${game.slug}`
      );

      return;
    }


    if (game.id) {

      navigate(
        `/games/${game.id}`
      );
    }
  };


  // =====================================================
  // RESULT COUNTS
  // =====================================================

  const hasUsers =
    results.users?.length > 0;

  const hasClubs =
    results.clubs?.length > 0;

  const hasGames =
    results.games?.length > 0;

  const hasResults =
    hasUsers ||
    hasClubs ||
    hasGames;


  // =====================================================
  // USER CARD
  // =====================================================

  const renderUserCard = (user) => (

    <button
      key={`user-${user.id}`}
      type="button"
      className="search-result-card group"
      onClick={() => handleUserClick(user)}
    >

      <div className="search-result-icon">

        {user.avatar ? (

          <img
            src={user.avatar}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />

        ) : (

          <User size={20} />

        )}

      </div>


      <div className="search-result-info">

        <span className="search-result-title">

          {user.username
            ? `@${user.username}`
            : user.uid
              ? user.uid
              : user.name
          }

        </span>


        <span className="search-result-subtitle">

          {user.name}

          {user.level ? (
            ` · Level ${user.level}`
          ) : null}

        </span>

      </div>


      <span className="search-action-btn">

        View Profile

        <ArrowRight size={14} />

      </span>

    </button>
  );


  // =====================================================
  // CLUB CARD
  // =====================================================

  const renderClubCard = (club) => (

    <button
      key={`club-${club.id}`}
      type="button"
      className="search-result-card group"
      onClick={() => handleClubClick(club)}
    >

      <div className="search-result-icon">

        <Shield size={20} />

      </div>


      <div className="search-result-info">

        <span className="search-result-title">

          {club.name}

        </span>


        <span className="search-result-subtitle">

          {club.tag
            ? `${club.tag} · `
            : ''}

          {club.memberCount || 0} Members

        </span>

      </div>


      <span className="search-action-btn">

        View Club

        <ArrowRight size={14} />

      </span>

    </button>
  );


  // =====================================================
  // GAME CARD
  // =====================================================

  const renderGameCard = (game) => (

    <button
      key={`game-${game.id}`}
      type="button"
      className="search-result-card group"
      onClick={() => handleGameClick(game)}
    >

      <div className="search-result-icon">

        {game.logoUrl ? (

          <img
            src={game.logoUrl}
            alt=""
            className="w-full h-full object-contain rounded-lg"
          />

        ) : (

          <Gamepad2 size={20} />

        )}

      </div>


      <div className="search-result-info">

        <span className="search-result-title">

          {game.name}

        </span>


        <span className="search-result-subtitle">

          {game.shortName ||
            game.slug ||
            'Game'}

        </span>

      </div>


      <span className="search-action-btn">

        View Game

        <ArrowRight size={14} />

      </span>

    </button>
  );


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="search-wrapper">


      {/* =================================================
                HEADER
            ================================================= */}

      <div className="search-header-section">

        <span className="text-[#D6C98A] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 block">

          DISCOVER

        </span>


        <h1 className="search-page-title font-super-brigade text-black">

          GLOBAL SEARCH

        </h1>


        {/* Search Input */}

        <div className="search-input-container">

          <SearchIcon
            size={24}
            className="search-input-icon"
          />


          <input
            type="text"
            className="search-input"
            placeholder="Search players, clubs, games, or SYNCO UID..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(
                e.target.value
              )
            }
            autoFocus
          />


          {searchQuery && (

            <button
              type="button"
              onClick={clearSearch}
              className="search-clear-btn"
              aria-label="Clear search"
            >

              <X size={16} />

              <span>
                Clear
              </span>

            </button>

          )}

        </div>

      </div>


      {/* =================================================
                FILTER TABS
            ================================================= */}

      <div className="search-tabs-container">

        {tabs.map((tab) => (

          <button
            key={tab.id}
            type="button"
            className={`search-tab-btn ${activeTab === tab.id
                ? 'active'
                : ''
              }`}
            onClick={() =>
              setActiveTab(
                tab.id
              )
            }
          >

            {tab.label}

          </button>

        ))}

      </div>


      {/* =================================================
                RESULTS
            ================================================= */}

      <div className="search-results-container scrollbar-thin">


        {/* -------------------------------------------------
                    LOADING
                ------------------------------------------------- */}

        {isLoading && (

          <div className="search-empty-state">

            <div className="mb-4">

              <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />

            </div>

            <p>
              Searching the network...
            </p>

          </div>

        )}


        {/* -------------------------------------------------
                    ERROR
                ------------------------------------------------- */}

        {!isLoading && error && (

          <div className="search-empty-state">

            <p className="text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setSearchQuery(
                  (current) =>
                    current
                )
              }
              className="mt-4 px-4 py-2 border border-black/10 rounded-lg text-sm font-semibold hover:bg-black hover:text-white transition"
            >

              Try Again

            </button>

          </div>

        )}


        {/* -------------------------------------------------
                    EMPTY QUERY
                ------------------------------------------------- */}

        {!isLoading &&
          !error &&
          !searchQuery.trim() && (

            <div className="search-empty-state">

              <SearchIcon
                size={48}
                className="mb-4 opacity-20"
              />

              <p>
                Search for players, clubs,
                games, or a SYNCO UID.
              </p>

            </div>

          )}


        {/* -------------------------------------------------
                    NO RESULTS
                ------------------------------------------------- */}

        {!isLoading &&
          !error &&
          searchQuery.trim() &&
          !hasResults && (

            <div className="search-empty-state">

              <p>
                No results found for
                {' "'}
                {searchQuery}
                {'".'}
              </p>

            </div>

          )}


        {/* -------------------------------------------------
                    RESULTS
                ------------------------------------------------- */}

        {!isLoading &&
          !error &&
          searchQuery.trim() &&
          hasResults && (

            <div className="search-results-grid">


              {/* =========================================
                            USERS
                        ========================================= */}

              {(activeTab === 'all' ||
                activeTab === 'users') &&
                hasUsers && (

                  <div className="search-result-section">

                    <div className="flex items-center justify-between mb-4">

                      <h3 className="search-section-header">
                        PLAYERS
                      </h3>

                      <span className="text-xs text-black/40 font-semibold">
                        {results.users.length}
                      </span>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {results.users.map(
                        renderUserCard
                      )}

                    </div>

                  </div>

                )}


              {/* =========================================
                            CLUBS
                        ========================================= */}

              {(activeTab === 'all' ||
                activeTab === 'clubs') &&
                hasClubs && (

                  <div className="search-result-section">

                    <div className="flex items-center justify-between mb-4">

                      <h3 className="search-section-header">
                        CLUBS
                      </h3>

                      <span className="text-xs text-black/40 font-semibold">
                        {results.clubs.length}
                      </span>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {results.clubs.map(
                        renderClubCard
                      )}

                    </div>

                  </div>

                )}


              {/* =========================================
                            GAMES
                        ========================================= */}

              {(activeTab === 'all' ||
                activeTab === 'games') &&
                hasGames && (

                  <div className="search-result-section">

                    <div className="flex items-center justify-between mb-4">

                      <h3 className="search-section-header">
                        GAMES
                      </h3>

                      <span className="text-xs text-black/40 font-semibold">
                        {results.games.length}
                      </span>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {results.games.map(
                        renderGameCard
                      )}

                    </div>

                  </div>

                )}

            </div>

          )}

      </div>

    </div>
  );
};


export default Search;