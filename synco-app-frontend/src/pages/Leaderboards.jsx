import { useEffect, useMemo, useState } from 'react';

import {
  Trophy,
  Users,
  User,
  Gamepad2,
  Globe2,
  RefreshCw,
} from 'lucide-react';


// =========================================================
// API
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// COMPONENT
// =========================================================

const Leaderboards = () => {

  // =======================================================
  // STATE
  // =======================================================

  const [activeTab, setActiveTab] = useState('players');

  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState([]);

  const [games, setGames] = useState([]);
  const [regions, setRegions] = useState([]);

  const [selectedGame, setSelectedGame] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');


  // =======================================================
  // LOAD FILTERS
  // =======================================================

  const loadFilters = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/leaderboards/filters`
      );

      if (!response.ok) {
        throw new Error('Failed to load leaderboard filters.');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message || 'Failed to load filters.'
        );
      }

      setGames(data.games || []);
      setRegions(data.regions || []);

    } catch (err) {
      console.error('Leaderboard filters error:', err);
      setError(err.message);
    }
  };


  // =======================================================
  // LOAD PLAYERS
  // =======================================================

  const loadPlayers = async () => {
    try {
      const params = new URLSearchParams();

      if (activeTab === 'game' && selectedGame) {
        params.append('game', selectedGame);
      }

      if (selectedRegion) {
        params.append('region', selectedRegion);
      }

      const queryString = params.toString();

      const url =
        `${API_URL}/api/leaderboards/players` +
        (queryString ? `?${queryString}` : '');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load player rankings.');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message || 'Failed to load player rankings.'
        );
      }

      setPlayers(data.rankings || []);

    } catch (err) {
      console.error('Player leaderboard error:', err);
      setError(err.message);
      setPlayers([]);
    }
  };


  // =======================================================
  // LOAD CLUBS
  // =======================================================

  const loadClubs = async () => {
    try {
      const params = new URLSearchParams();

      if (selectedGame) {
        params.append('game', selectedGame);
      }

      if (selectedRegion) {
        params.append('region', selectedRegion);
      }

      const queryString = params.toString();

      const url =
        `${API_URL}/api/leaderboards/clubs` +
        (queryString ? `?${queryString}` : '');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load club rankings.');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message || 'Failed to load club rankings.'
        );
      }

      setClubs(data.rankings || []);

    } catch (err) {
      console.error('Club leaderboard error:', err);
      setError(err.message);
      setClubs([]);
    }
  };


  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {

    const initialize = async () => {

      setLoading(true);
      setError('');

      await loadFilters();

      setLoading(false);
    };

    initialize();

  }, []);


  // =======================================================
  // LOAD RANKINGS WHEN FILTERS / TAB CHANGE
  // =======================================================

  useEffect(() => {

    if (loading) {
      return;
    }

    const loadRankingData = async () => {

      setError('');

      if (
        activeTab === 'players' ||
        activeTab === 'game'
      ) {
        await loadPlayers();
      }

      if (activeTab === 'clubs') {
        await loadClubs();
      }
    };

    loadRankingData();

  }, [
    activeTab,
    selectedGame,
    selectedRegion,
    loading,
  ]);


  // =======================================================
  // REFRESH
  // =======================================================

  const handleRefresh = async () => {

    setRefreshing(true);
    setError('');

    try {

      await loadFilters();

      if (
        activeTab === 'players' ||
        activeTab === 'game'
      ) {
        await loadPlayers();
      } else {
        await loadClubs();
      }

    } finally {

      setRefreshing(false);

    }
  };


  // =======================================================
  // TAB CHANGE
  // =======================================================

  const handleTabChange = (tab) => {

    setActiveTab(tab);

    setSelectedGame('');
    setSelectedRegion('');
    setError('');

  };


  // =======================================================
  // CURRENT DATA
  // =======================================================

  const currentData = useMemo(() => {

    if (activeTab === 'clubs') {
      return clubs;
    }

    return players;

  }, [activeTab, players, clubs]);


  // =======================================================
  // TOP 3
  // =======================================================

  const topThree = currentData.slice(0, 3);


  // =======================================================
  // RANK ICON
  // =======================================================

  const getRankStyle = (rank) => {

    if (rank === 1) {
      return 'bg-black text-white';
    }

    if (rank === 2) {
      return 'bg-gray-200 text-gray-900';
    }

    if (rank === 3) {
      return 'bg-gray-100 text-gray-700';
    }

    return 'bg-gray-100 text-gray-500';

  };


  // =======================================================
  // AVATAR FALLBACK
  // =======================================================

  const getInitial = (name) => {

    if (!name) {
      return '?';
    }

    return name
      .trim()
      .charAt(0)
      .toUpperCase();

  };


  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {

    return (
      <div className="min-h-screen bg-white px-6 py-10">
        <div className="mx-auto max-w-7xl">

          <div className="animate-pulse">

            <div className="h-8 w-64 rounded bg-gray-100" />

            <div className="mt-3 h-4 w-96 rounded bg-gray-100" />

            <div className="mt-10 h-16 rounded-2xl bg-gray-100" />

            <div className="mt-6 space-y-3">

              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-20 rounded-xl bg-gray-100"
                />
              ))}

            </div>

          </div>

        </div>
      </div>
    );

  }


  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-7xl">

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black">
                <Trophy
                  size={21}
                  className="text-white"
                />
              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  SYNCO Rankings
                </p>

                <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                  Leaderboards
                </h1>

              </div>

            </div>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500">
              Track the highest-performing players and clubs
              across the SYNCO competitive network.
            </p>

          </div>


          {/* REFRESH */}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >

            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />

            Refresh

          </button>

        </div>


        {/* =================================================
            TABS
            ================================================= */}

        <div className="mt-8 flex flex-wrap gap-2 border-b border-gray-200 pb-3">

          <button
            type="button"
            onClick={() => handleTabChange('players')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'players'
                ? 'bg-black text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >

            <Users size={16} />

            Global Players

          </button>


          <button
            type="button"
            onClick={() => handleTabChange('game')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'game'
                ? 'bg-black text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >

            <Gamepad2 size={16} />

            By Game

          </button>


          <button
            type="button"
            onClick={() => handleTabChange('clubs')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'clubs'
                ? 'bg-black text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
          >

            <User size={16} />

            Clubs

          </button>

        </div>


        {/* =================================================
            FILTERS
            ================================================= */}

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:flex-row">

          {(activeTab === 'game' || activeTab === 'clubs') && (

            <div className="relative flex-1">

              <Gamepad2
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <select
                value={selectedGame}
                onChange={(event) =>
                  setSelectedGame(event.target.value)
                }
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400"
              >

                <option value="">
                  All Games
                </option>

                {games.map((game) => (

                  <option
                    key={game.id}
                    value={game.id}
                  >
                    {game.name}
                  </option>

                ))}

              </select>

            </div>

          )}


          <div className="relative flex-1">

            <Globe2
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <select
              value={selectedRegion}
              onChange={(event) =>
                setSelectedRegion(event.target.value)
              }
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400"
            >

              <option value="">
                All Regions
              </option>

              {regions.map((region) => (

                <option
                  key={region}
                  value={region}
                >
                  {region}
                </option>

              ))}

            </select>

          </div>

        </div>


        {/* =================================================
            ERROR
            ================================================= */}

        {error && (

          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>

        )}


        {/* =================================================
            TOP THREE
            ================================================= */}

        {topThree.length > 0 && (

          <div className="mt-8 grid gap-4 md:grid-cols-3">

            {topThree.map((item) => {

              const isClub = activeTab === 'clubs';

              const name = isClub
                ? item.name
                : (
                  item.username ||
                  item.name ||
                  'Unknown Player'
                );

              const avatar = isClub
                ? item.avatar
                : item.avatar;

              return (

                <div
                  key={
                    isClub
                      ? `club-${item.clubId}`
                      : `player-${item.playerId}-${item.game?.id}`
                  }
                  className={`rounded-2xl border p-5 ${item.rank === 1
                      ? 'border-gray-900 bg-gray-950 text-white'
                      : 'border-gray-200 bg-white'
                    }`}
                >

                  <div className="flex items-center justify-between">

                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${getRankStyle(item.rank)}`}
                    >
                      #{item.rank}
                    </span>

                    <Trophy
                      size={17}
                      className={
                        item.rank === 1
                          ? 'text-white'
                          : 'text-gray-400'
                      }
                    />

                  </div>


                  <div className="mt-6 flex items-center gap-3">

                    {avatar ? (

                      <img
                        src={avatar}
                        alt={name}
                        className="h-12 w-12 rounded-xl object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display =
                            'none';
                        }}
                      />

                    ) : (

                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold ${item.rank === 1
                            ? 'bg-white text-black'
                            : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        {getInitial(name)}
                      </div>

                    )}


                    <div className="min-w-0">

                      <p
                        className={`truncate text-sm font-bold ${item.rank === 1
                            ? 'text-white'
                            : 'text-gray-950'
                          }`}
                      >
                        {name}
                      </p>

                      <p
                        className={`mt-1 text-xs ${item.rank === 1
                            ? 'text-gray-400'
                            : 'text-gray-500'
                          }`}
                      >
                        {item.region || 'Global'}
                      </p>

                    </div>

                  </div>


                  <div className="mt-6 flex items-end justify-between">

                    <div>

                      <p
                        className={`text-xs ${item.rank === 1
                            ? 'text-gray-400'
                            : 'text-gray-400'
                          }`}
                      >
                        SYNCO Points
                      </p>

                      <p className="mt-1 text-2xl font-bold tracking-tight">
                        {(item.syncoPoints || 0).toLocaleString()}
                      </p>

                    </div>


                    {isClub && (

                      <p
                        className={`text-xs ${item.rank === 1
                            ? 'text-gray-400'
                            : 'text-gray-500'
                          }`}
                      >
                        Level {item.level || 1}
                      </p>

                    )}

                  </div>

                </div>

              );

            })}

          </div>

        )}


        {/* =================================================
            TABLE
            ================================================= */}

        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">

          {/* TABLE HEADER */}

          <div className="hidden grid-cols-[80px_minmax(220px,1fr)_150px_220px_150px] border-b border-gray-200 bg-gray-50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400 md:grid">

            <div>
              Rank
            </div>

            <div>
              {activeTab === 'clubs'
                ? 'Club'
                : 'Player'}
            </div>

            <div>
              Region
            </div>

            <div>
              Game
            </div>

            {activeTab === 'clubs' ? (

              <div>
                Points
              </div>

            ) : (

              <div>
                SYNCO Points
              </div>

            )}

          </div>


          {/* EMPTY */}

          {currentData.length === 0 && (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">

                {activeTab === 'clubs' ? (
                  <Users
                    size={20}
                    className="text-gray-400"
                  />
                ) : (
                  <Trophy
                    size={20}
                    className="text-gray-400"
                  />
                )}

              </div>

              <h3 className="mt-4 text-sm font-bold text-gray-900">
                No rankings available
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
                There are no ranking records matching the
                selected filters yet.
              </p>

            </div>

          )}


          {/* ROWS */}

          {currentData.map((item) => {

            const isClub = activeTab === 'clubs';

            const name = isClub
              ? item.name
              : (
                item.username ||
                item.name ||
                'Unknown Player'
              );

            return (

              <div
                key={
                  isClub
                    ? `club-${item.clubId}`
                    : `player-${item.playerId}-${item.game?.id}`
                }
                className="border-b border-gray-100 px-4 py-4 last:border-b-0 md:grid md:grid-cols-[80px_minmax(220px,1fr)_150px_220px_150px] md:items-center md:px-6"
              >

                {/* RANK */}

                <div className="flex items-center gap-3 md:block">

                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${item.rank <= 3
                        ? getRankStyle(item.rank)
                        : 'bg-gray-100 text-gray-500'
                      }`}
                  >
                    #{item.rank}
                  </span>

                  <span className="text-xs font-semibold uppercase text-gray-400 md:hidden">
                    Rank
                  </span>

                </div>


                {/* PLAYER / CLUB */}

                <div className="mt-4 flex items-center gap-3 md:mt-0">

                  {item.avatar ? (

                    <img
                      src={item.avatar}
                      alt={name}
                      className="h-10 w-10 rounded-xl object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          'none';
                      }}
                    />

                  ) : (

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-600">
                      {getInitial(name)}
                    </div>

                  )}


                  <div className="min-w-0">

                    <p className="truncate text-sm font-bold text-gray-900">
                      {name}
                    </p>

                    {!isClub && item.uid && (

                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        UID: {item.uid}
                      </p>

                    )}

                    {isClub && item.tag && (

                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        [{item.tag}]
                      </p>

                    )}

                  </div>

                </div>


                {/* REGION */}

                <div className="mt-3 flex items-center gap-2 md:mt-0">

                  <Globe2
                    size={14}
                    className="text-gray-400"
                  />

                  <span className="text-sm text-gray-600">
                    {item.region || 'Global'}
                  </span>

                </div>


                {/* GAME */}

                <div className="mt-3 flex items-center gap-2 md:mt-0">

                  <Gamepad2
                    size={14}
                    className="text-gray-400"
                  />

                  <span className="text-sm text-gray-600">

                    {item.game?.shortName ||
                      item.game?.name ||
                      'All Games'}

                  </span>

                </div>


                {/* POINTS */}

                <div className="mt-4 md:mt-0">

                  <p className="text-xs uppercase tracking-wider text-gray-400 md:hidden">
                    SYNCO Points
                  </p>

                  <p className="mt-1 text-sm font-bold text-gray-950 md:mt-0">
                    {(item.syncoPoints || 0).toLocaleString()}
                  </p>

                  {isClub && (

                    <p className="mt-0.5 text-xs text-gray-400">
                      Level {item.level || 1}
                    </p>

                  )}

                </div>

              </div>

            );

          })}

        </div>


        {/* =================================================
            FOOTER INFO
            ================================================= */}

        <div className="mt-5 flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">

          <p>
            Rankings are calculated from SYNCO competitive points.
          </p>

          <p>
            {currentData.length.toLocaleString()} records
          </p>

        </div>

      </div>

    </div>
  );
};


export default Leaderboards;
