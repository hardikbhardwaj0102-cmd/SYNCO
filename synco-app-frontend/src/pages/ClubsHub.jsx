import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  ChevronDown,
  Users,
  ArrowRight,
} from 'lucide-react';
import '../styles/pages/ClubsHub.css';

const API_URL = import.meta.env.VITE_API_URL;

const ClubsHub = () => {
  const navigate = useNavigate();

  const [isCreating, setIsCreating] = useState(false);

  const [newClub, setNewClub] = useState({
    name: '',
    tag: '',
    description: '',
    game: '',
    gameId: '',
  });

  const [gameCatalog, setGameCatalog] = useState([]);
  const [clubs, setClubs] = useState([]);

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
  const [isCreatingClub, setIsCreatingClub] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // =========================================================
  // LOAD GAMES
  // =========================================================

  const loadGames = async () => {
    try {
      setIsLoadingGames(true);

      const response = await fetch(
        `${API_URL}/api/games`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to load games.'
        );
      }

      setGameCatalog(data.games || []);

    } catch (err) {
      console.error(
        'Failed to load games:',
        err
      );

      setError(
        'Unable to load available games.'
      );
    } finally {
      setIsLoadingGames(false);
    }
  };

  // =========================================================
  // LOAD CLUBS
  // =========================================================

  const loadClubs = async () => {
    try {
      setIsLoadingClubs(true);

      const response = await fetch(
        `${API_URL}/api/clubs`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to load clubs.'
        );
      }

      setClubs(data.clubs || []);

    } catch (err) {
      console.error(
        'Failed to load clubs:',
        err
      );

      setError(
        'Unable to load clubs.'
      );
    } finally {
      setIsLoadingClubs(false);
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadGames();
    loadClubs();
  }, []);

  // =========================================================
  // INPUT HANDLER
  // =========================================================

  const handleInputChange = (field, value) => {
    setNewClub((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError('');
    setSuccess('');
  };

  // =========================================================
  // GAME SELECT
  // =========================================================

  const handleGameSelect = (game) => {
    setNewClub((previous) => ({
      ...previous,
      game: game.name,
      gameId: game.id,
    }));

    setIsGameMenuOpen(false);
    setError('');
  };

  // =========================================================
  // CREATE CLUB
  // =========================================================

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    const clubName = newClub.name.trim();
    const clubTag = newClub.tag.trim().toUpperCase();

    if (!clubName) {
      setError(
        'Please enter a club name.'
      );
      return;
    }

    if (!clubTag) {
      setError(
        'Please enter a club tag.'
      );
      return;
    }

    if (!newClub.gameId) {
      setError(
        'Please select a primary game.'
      );
      return;
    }

    try {
      setIsCreatingClub(true);

      const response = await fetch(
        `${API_URL}/api/clubs`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          credentials: 'include',

          body: JSON.stringify({
            name: clubName,
            tag: clubTag,
            description:
              newClub.description.trim(),
            gameId: newClub.gameId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to create club.'
        );
      }

      console.log(
        'Club created:',
        data.club
      );

      setSuccess(
        'Club created successfully.'
      );

      // -----------------------------------------------------
      // REFRESH CLUB DIRECTORY
      // -----------------------------------------------------

      await loadClubs();

      // -----------------------------------------------------
      // RESET FORM
      // -----------------------------------------------------

      setTimeout(() => {
        setIsCreating(false);

        setNewClub({
          name: '',
          tag: '',
          description: '',
          game: '',
          gameId: '',
        });

        setSuccess('');
      }, 800);

    } catch (err) {
      console.error(
        'Create club error:',
        err
      );

      setError(
        err.message ||
        'Unable to create club.'
      );

    } finally {
      setIsCreatingClub(false);
    }
  };

  // =========================================================
  // BACK TO DIRECTORY
  // =========================================================

  const handleBack = () => {
    setIsGameMenuOpen(false);
    setError('');
    setSuccess('');
    setIsCreating(false);
  };

  // =========================================================
  // VIEW CLUB
  // =========================================================

  const handleViewClub = (clubId) => {
    if (!clubId) {
      console.error(
        'Cannot open club: missing club ID'
      );
      return;
    }

    console.log(
      'Opening club:',
      clubId
    );

    navigate(`/clubs/${clubId}`);
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="clubs-wrapper">

      {/* =====================================================
          DIRECTORY VIEW
      ===================================================== */}

      {!isCreating && (
        <>
          <div className="flex justify-between items-center bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">

            <div>
              <h1 className="text-3xl font-bold font-header uppercase tracking-wider">
                Verified Clubs
              </h1>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Browse registered esports organizations or form your own roster.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError('');
                setSuccess('');
                setIsCreating(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#D6C98A] hover:text-black transition-colors"
            >
              <Shield size={16} />
              Create a Club
            </button>

          </div>

          {/* =================================================
              CLUB DIRECTORY
          ================================================= */}

          <div className="mt-6">

            {isLoadingClubs ? (

              <div className="w-full min-h-64 border border-gray-200 rounded-2xl bg-white flex items-center justify-center">
                <span className="text-gray-400 font-bold text-xs tracking-widest uppercase">
                  Loading Clubs...
                </span>
              </div>

            ) : clubs.length === 0 ? (

              <div className="w-full min-h-64 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center bg-white">

                <div className="text-center">

                  <Shield
                    size={28}
                    className="mx-auto mb-3 text-gray-300"
                  />

                  <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">
                    No Clubs Yet
                  </p>

                  <p className="text-gray-400 text-xs mt-2">
                    Be the first to create a SYNCO club.
                  </p>

                </div>

              </div>

            ) : (

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

                {clubs.map((club) => (

                  <div
                    key={club.id}
                    className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >

                    {/* =================================================
                        CLUB HEADER
                    ================================================= */}

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex items-center gap-4">

                        <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center">
                          <Shield size={20} />
                        </div>

                        <div>

                          <h2 className="font-header font-bold uppercase tracking-wide text-lg text-black">
                            {club.name}
                          </h2>

                          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                            [{club.tag}]
                          </span>

                        </div>

                      </div>



                    </div>

                    {/* =================================================
                        GAME
                    ================================================= */}

                    <div className="mt-6">

                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                        Primary Game
                      </span>

                      <p className="mt-1 text-sm font-bold uppercase tracking-wide text-black">
                        {club.game?.name ||
                          club.gameId ||
                          'Unknown'}
                      </p>

                    </div>

                    {/* =================================================
                        FOOTER
                    ================================================= */}

                    <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">

                      <div className="flex items-center gap-2 text-gray-500">

                        <Users size={14} />

                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {club.memberCount || 0} Members
                        </span>

                      </div>

                      {/* =================================================
                          VIEW CLUB
                      ================================================= */}

                      <button
                        type="button"
                        onClick={() =>
                          handleViewClub(club.id)
                        }
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black hover:text-[#8d824e] transition-colors"
                      >
                        View Club
                        <ArrowRight size={13} />
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>
        </>
      )}

      {/* =====================================================
          CREATE CLUB
      ===================================================== */}

      {isCreating && (

        <div className="create-club-card">

          {/* =================================================
              LEFT BRANDING
          ================================================= */}

          <div className="create-club-banner">

            <span className="text-[#D6C98A] text-xs font-bold uppercase tracking-[0.3em] mb-8 relative z-10">
              SYNCO Clubs
            </span>

            <h2 className="create-club-title">
              BUILD.
              <br />
              RECRUIT.
              <br />
              <span>DOMINATE.</span>
            </h2>

            <p className="create-club-subtitle">
              Your competitive legacy starts here. Register your organization and climb the leaderboards.
            </p>

          </div>

          {/* =================================================
              RIGHT FORM
          ================================================= */}

          <div className="create-club-form-side">

            <div className="create-club-header">

              <button
                onClick={handleBack}
                className="back-to-directory-btn"
                type="button"
              >
                <ArrowLeft size={16} />
                Back to Directory
              </button>

            </div>

            <div>

              <h3 className="form-section-title">
                Club Registration
              </h3>

              <p className="form-section-subtitle">
                Set up your organization's profile.
              </p>

              {/* =================================================
                  ERROR
              ================================================= */}

              {error && (
                <div className="mt-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* =================================================
                  SUCCESS
              ================================================= */}

              {success && (
                <div className="mt-4 px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-green-700 text-xs font-semibold">
                  {success}
                </div>
              )}

              {/* =================================================
                  FORM
              ================================================= */}

              <form
                onSubmit={handleCreateSubmit}
                className="space-y-5 mt-5"
              >

                {/* =================================================
                    CLUB NAME + TAG
                ================================================= */}

                <div className="flex gap-4">

                  <div className="flex-1">

                    <label className="block text-[10px] font-bold uppercase tracking-wider text-black/50 mb-2">
                      Club Name
                    </label>

                    <input
                      type="text"
                      className="w-full h-12 px-4 rounded-xl border border-black/10 bg-gray-50 text-black text-sm outline-none focus:bg-white focus:border-black transition-colors"
                      placeholder="e.g. Sentinels"
                      value={newClub.name}
                      onChange={(e) =>
                        handleInputChange(
                          'name',
                          e.target.value
                        )
                      }
                      maxLength={100}
                      required
                    />

                  </div>

                  <div className="w-1/3">

                    <label className="block text-[10px] font-bold uppercase tracking-wider text-black/50 mb-2">
                      Tag
                    </label>

                    <input
                      type="text"
                      className="w-full h-12 px-4 rounded-xl border border-black/10 bg-gray-50 text-black text-sm outline-none focus:bg-white focus:border-black uppercase transition-colors"
                      placeholder="e.g. SEN"
                      maxLength={5}
                      value={newClub.tag}
                      onChange={(e) =>
                        handleInputChange(
                          'tag',
                          e.target.value.toUpperCase()
                        )
                      }
                      required
                    />

                  </div>

                </div>

                {/* =================================================
                    PRIMARY GAME
                ================================================= */}

                <div className="relative">

                  <label className="block text-[10px] font-bold uppercase tracking-wider text-black/50 mb-2">
                    Primary Game
                  </label>

                  <button
                    type="button"
                    disabled={isLoadingGames}
                    className="w-full h-12 px-4 rounded-xl border border-black/10 bg-gray-50 text-black text-sm outline-none flex items-center justify-between hover:bg-gray-100 transition-colors disabled:opacity-60"
                    onClick={() =>
                      setIsGameMenuOpen(
                        !isGameMenuOpen
                      )
                    }
                  >

                    <span>
                      {isLoadingGames
                        ? 'Loading Games...'
                        : newClub.game ||
                        'Select a Game'}
                    </span>

                    <ChevronDown
                      size={16}
                      className={`text-gray-400 transition-transform ${isGameMenuOpen
                        ? 'rotate-180'
                        : ''
                        }`}
                    />

                  </button>

                  {/* =================================================
                      GAME MENU
                  ================================================= */}

                  {isGameMenuOpen && (
                    <>

                      <div
                        className="fixed inset-0 z-30"
                        onClick={() =>
                          setIsGameMenuOpen(false)
                        }
                      />

                      <div className="absolute left-0 top-full mt-2 w-full grid grid-cols-2 gap-2 p-3 z-40 rounded-2xl shadow-xl backdrop-blur-2xl bg-gradient-to-br from-[#c5c7c9]/95 to-[#c5c7c9]/80 border border-white/50">

                        {gameCatalog.length === 0 ? (

                          <div className="col-span-2 p-4 text-center text-xs font-semibold text-gray-500">
                            No games available.
                          </div>

                        ) : (

                          gameCatalog.map((game) => (

                            <button
                              type="button"
                              key={game.id}
                              className={`flex items-center gap-3 p-2 rounded-xl text-left transition-all hover:bg-white/40 ${newClub.gameId === game.id
                                ? 'bg-white/60 shadow-sm'
                                : ''
                                }`}
                              onClick={() =>
                                handleGameSelect(
                                  game
                                )
                              }
                            >

                              <span className="text-black text-xs font-bold font-header uppercase">
                                {game.name}
                              </span>

                            </button>

                          ))

                        )}

                      </div>

                    </>
                  )}

                </div>

                {/* =================================================
                    INITIALIZE
                ================================================= */}

                <button
                  type="submit"
                  disabled={isCreatingClub}
                  className="w-full h-12 mt-6 rounded-xl bg-black text-white text-sm font-bold uppercase tracking-widest hover:bg-[#D6C98A] hover:text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingClub
                    ? 'Initializing...'
                    : 'Initialize Club'}
                </button>

              </form>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

export default ClubsHub;