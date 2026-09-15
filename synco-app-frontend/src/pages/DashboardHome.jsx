import { useEffect, useState } from 'react';
import {
  Crown,
  TrendingUp,
  Crosshair,
  Trophy,
  ChevronDown,
  ArrowRight,
  X,
  Heart,
  MessageCircle
} from 'lucide-react';

import '../styles/pages/DashboardHome.css';
import VideoClip from '../components/VideoClip';


// =========================================================
// API URL
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// DASHBOARD HOME
// =========================================================

const DashboardHome = () => {

  const [gameCatalog, setGameCatalog] = useState([]);
  const [profileGames, setProfileGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [clips, setClips] = useState([]);
  const [statsViewState, setStatsViewState] = useState('banner');
  const [commentsClip, setCommentsClip] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState('');


  // =========================================================
  // LOAD DASHBOARD DATA
  // =========================================================

  useEffect(() => {

    const loadDashboardData = async () => {

      try {

        const [
          catalogResponse,
          profileResponse,
          clipsResponse
        ] = await Promise.all([

          fetch(`${API_URL}/api/games`, {
            method: 'GET',
            credentials: 'include'
          }).catch(() => ({
            ok: false
          })),

          fetch(`${API_URL}/api/profile`, {
            method: 'GET',
            credentials: 'include'
          }).catch(() => ({
            ok: false
          })),

          fetch(`${API_URL}/api/profile/clips`, {
            method: 'GET',
            credentials: 'include'
          }).catch(() => ({
            ok: false
          }))

        ]);


        // ===================================================
        // GAME CATALOG
        // ===================================================

        if (catalogResponse?.ok) {

          const catalogData =
            await catalogResponse.json();

          setGameCatalog(
            catalogData.games || []
          );

        }


        // ===================================================
        // PROFILE GAMES
        // ===================================================

        if (profileResponse?.ok) {

          const profileData =
            await profileResponse.json();

          setProfileGames(
            profileData.games || []
          );

        }


        // ===================================================
        // CLIPS
        // ===================================================

        if (clipsResponse?.ok) {

          const clipsData =
            await clipsResponse.json();

          setClips(
            clipsData.clips || []
          );

        }

      } catch (error) {

        console.error(
          'Failed to load dashboard data:',
          error
        );

      }

    };


    loadDashboardData();

  }, []);


  // =========================================================
  // DEFAULT SELECTED GAME
  // =========================================================

  useEffect(() => {

    if (
      !selectedGame &&
      gameCatalog.length
    ) {

      setSelectedGame(
        profileGames[0]?.gameName ||
        gameCatalog[0].name
      );

    }

  }, [
    gameCatalog,
    profileGames,
    selectedGame
  ]);


  // =========================================================
  // LIKE CLIP
  // =========================================================

  const handleLikeClip = async (clipId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/profile/clips/${clipId}/like`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to like this clip.');
      }

      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === clipId
            ? { ...clip, isLiked: Boolean(data.liked), likes: data.likes }
            : clip
        )
      );
    } catch (error) {
      console.error('Like failed:', error);
    }
  };

  const openComments = async (clip) => {
    setCommentsClip(clip);
    setComments([]);
    setCommentText('');
    setCommentError('');
    setCommentsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/profile/clips/${clip.id}/comments`,
        { credentials: 'include', headers: { Accept: 'application/json' } }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load comments.');
      }

      setComments(data.comments || []);
    } catch (error) {
      setCommentError(error.message || 'Unable to load comments.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();

    if (!commentsClip || !commentText.trim()) return;

    try {
      const response = await fetch(
        `${API_URL}/api/profile/clips/${commentsClip.id}/comments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ content: commentText.trim() }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to post comment.');
      }

      setComments((currentComments) => [...currentComments, data]);
      setCommentText('');
      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === commentsClip.id
            ? { ...clip, comments: (clip.comments || 0) + 1 }
            : clip
        )
      );
    } catch (error) {
      setCommentError(error.message || 'Unable to post comment.');
    }
  };


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="dashboard-wrapper">


      {/* =====================================================
          PREMIUM UPGRADE BANNER
          ===================================================== */}

      <div className="premium-banner">

        <div className="premium-banner-left">

          <div className="premium-banner-icon-box">

            <Crown size={24} />

          </div>

          <div>

            <h2 className="premium-banner-title font-super-brigade">
              Upgrade to SYNCO Premium
            </h2>

            <p className="premium-banner-subtitle">
              Unlock advanced analytics, priority tournament
              registration, and custom profile badges.
            </p>

          </div>

        </div>

        <button className="premium-banner-btn">
          Go Premium
        </button>

      </div>


      {/* =====================================================
          DASHBOARD MAIN GRID
          ===================================================== */}

      <div className="dashboard-main-grid">


        {/* ===================================================
            LEFT COLUMN
            =================================================== */}

        <div className="dashboard-left-column">


          {/* =================================================
              TOP ROW
              ================================================= */}

          <div className="dashboard-top-row">


            {/* ===============================================
                COMPETITIVE PROFILE
                =============================================== */}

            <div className="competitive-profile-card group">

              <div className="competitive-profile-content">

                <span className="competitive-eyebrow">
                  PLAYER IDENTITY
                </span>

                <h3 className="competitive-title font-super-brigade">

                  View
                  <br />

                  Competitive
                  <br />

                  <span>Profile</span>

                </h3>

                <button className="competitive-action-btn mt-auto">

                  <span>
                    Explore Stats
                  </span>

                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />

                </button>

              </div>

            </div>


            {/* ===============================================
                IDENTITY STACK
                =============================================== */}

            <div className="identity-stack">


              {/* RATING */}

              <div className="identity-card">

                <div className="identity-card-gradient-top"></div>

                <span className="identity-eyebrow">
                  RATING
                </span>

                <h3 className="identity-title font-super-brigade">
                  SKILL LEVEL
                </h3>

                <div className="identity-badge">
                  Calculating...
                </div>

              </div>


              {/* GAMETAG */}

              <div className="identity-card">

                <div className="identity-card-gradient-bottom"></div>

                <span className="identity-eyebrow">
                  SYNCO ID
                </span>

                <h3 className="identity-title font-super-brigade">
                  GAMETAG
                </h3>

                <div className="identity-value">
                  FROAKAI
                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              PERFORMANCE STATS
              ================================================= */}

          <div className="stats-module-container">


            {/* ===============================================
                STATE 1: BANNER
                =============================================== */}

            {statsViewState === 'banner' && (

              <button
                className="stats-banner-horizontal group"
                onClick={() =>
                  setStatsViewState('selecting')
                }
              >

                <div className="stats-banner-left">

                  <span className="stats-entry-eyebrow">
                    SYNCO ANALYTICS
                  </span>

                  <h2 className="stats-banner-title font-super-brigade">

                    TRACK. ANALYZE.
                    <span> IMPROVE.</span>

                  </h2>

                </div>


                <div className="stats-banner-right">

                  <div className="stats-entry-action">

                    <span>
                      View Stats
                    </span>

                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />

                  </div>

                  <span className="stats-entry-footer-text">
                    Engine designed to make gameplay matter
                  </span>

                </div>

              </button>

            )}


            {/* ===============================================
                STATE 2: SELECT GAME
                =============================================== */}

            {statsViewState === 'selecting' && (

              <div className="stats-selecting-container animate-in fade-in zoom-in-95 duration-200">


                <div className="stats-selecting-header">

                  <h3 className="stats-selecting-title">
                    Select Title
                  </h3>

                  <button
                    onClick={() =>
                      setStatsViewState('banner')
                    }
                    className="stats-close-btn"
                  >

                    <X size={16} />

                  </button>

                </div>


                <div className="stats-game-list">

                  {gameCatalog.map((game) => (

                    <button
                      key={game.id}
                      className="stats-game-option-btn group"

                      onClick={() => {

                        setSelectedGame(
                          game.name
                        );

                        setStatsViewState(
                          'viewing'
                        );

                      }}
                    >

                      <span className="stats-game-option-title font-super-brigade">

                        {game.name}

                      </span>

                      <span className="stats-game-option-sub">

                        {game.shortName ||
                          'ACTIVE'}

                      </span>

                    </button>

                  ))}

                </div>

              </div>

            )}


            {/* ===============================================
                STATE 3: ACTIVE STATS
                =============================================== */}

            {statsViewState === 'viewing' && (

              <div className="stats-active-container animate-in fade-in slide-in-from-bottom-4 duration-300">


                <div className="stats-active-header">

                  <button
                    className="stats-active-header-btn"

                    onClick={() =>
                      setStatsViewState(
                        'selecting'
                      )
                    }
                  >

                    <span className="stats-active-game-title font-super-brigade">

                      {selectedGame ||
                        'SELECT GAME'}

                    </span>

                    <ChevronDown
                      size={18}
                      className="text-[#D6C98A]"
                    />

                  </button>

                </div>


                <div className="stats-active-grid">


                  {/* CURRENT RANK */}

                  <div className="stat-box-dark">

                    <div className="stat-icon-wrapper-dark">

                      <TrendingUp
                        size={18}
                      />

                    </div>

                    <div className="stat-text">

                      <span className="stat-label-dark">
                        Current Rank
                      </span>

                      <span className="stat-value-dark">

                        {profileGames.find(
                          g =>
                            g.gameName ===
                            selectedGame
                        )?.rank || '--'}

                      </span>

                    </div>

                  </div>


                  {/* K/D */}

                  <div className="stat-box-dark">

                    <div className="stat-icon-wrapper-dark">

                      <Crosshair
                        size={18}
                      />

                    </div>

                    <div className="stat-text">

                      <span className="stat-label-dark">
                        K/D Ratio
                      </span>

                      <span className="stat-value-dark">

                        {profileGames.find(
                          g =>
                            g.gameName ===
                            selectedGame
                        )?.kd || '--'}

                      </span>

                    </div>

                  </div>


                  {/* WIN RATE */}

                  <div className="stat-box-dark">

                    <div className="stat-icon-wrapper-dark">

                      <Trophy
                        size={18}
                      />

                    </div>

                    <div className="stat-text">

                      <span className="stat-label-dark">
                        Win Rate
                      </span>

                      <span className="stat-value-dark">

                        {profileGames.find(
                          g =>
                            g.gameName ===
                            selectedGame
                        )?.winRate || '--'}

                      </span>

                    </div>

                  </div>

                </div>


                {!profileGames.find(
                  g =>
                    g.gameName ===
                    selectedGame
                ) && (

                    <p className="stats-empty-message">

                      No matches recorded yet for{' '}
                      {selectedGame}.

                    </p>

                  )}

              </div>

            )}

          </div>

        </div>


        {/* ===================================================
            RIGHT COLUMN
            =================================================== */}

        <div className="dashboard-right-column">

          <div className="reels-outer-card">


            {/* =================================================
                HEADER
                ================================================= */}

            <div className="reels-header">

              <span className="font-super-brigade text-[#D6C98A] text-2xl tracking-widest lowercase">
                synco
              </span>

            </div>


            {/* =================================================
                REELS VIEWPORT
                ================================================= */}

            <div className="reels-scroll-viewport">


              {clips.length ? (

                clips.map((clip) => (

                  /* Individual Reel Page */

                  <div
                    key={clip.id}
                    className="reel-page"
                  >


                    {/* =========================================
                        TAGS
                        ========================================= */}

                    <div className="reel-tags-row">

                      <span className="reel-tag">
                        {clip.game ||
                          'UNSPECIFIED'}
                      </span>

                      <span className="reel-tag">
                        {clip.skillTag ||
                          'SKILL UNSPECIFIED'}
                      </span>

                      <span className="reel-tag">
                        {clip.roleTag ||
                          'ROLE UNSPECIFIED'}
                      </span>

                    </div>


                    {/* =========================================
                        VIDEO
                        ========================================= */}

                    <div className="reel-video-container">

                      <VideoClip
                        id={clip.id}
                        url={clip.url}
                        title={clip.title}
                        description={clip.description}
                        game={clip.game}
                        hideOverlay={true}
                      />

                    </div>


                    {/* =========================================
                        INTERACTIONS
                        ========================================= */}

                    <div className="reel-interactions">


                      {/* LIKE */}

                      <button
                        onClick={() =>
                          handleLikeClip(
                            clip.id
                          )
                        }
                        className="flex items-center gap-2 group outline-none"
                      >

                        <Heart
                          size={32}

                          className={`cursor-pointer transition-transform group-hover:scale-110 ${clip.isLiked
                              ? 'fill-[#D32F2F] text-[#D32F2F]'
                              : 'text-[#D32F2F]'
                            }`}
                        />

                        <span className="text-black font-bold text-sm">
                          {clip.likes || 0}
                        </span>

                      </button>


                      {/* COMMENTS */}

                      <button
                        onClick={() => openComments(clip)}
                        className="flex items-center gap-2 group outline-none ml-4"
                      >

                        <MessageCircle
                          size={32}
                          className="fill-[#D32F2F] text-[#D32F2F] cursor-pointer transition-transform group-hover:scale-110"
                        />

                        <span className="text-black font-bold text-sm">
                          {clip.comments || 0}
                        </span>

                      </button>

                    </div>


                    {/* =========================================
                        DESCRIPTION
                        ========================================= */}

                    <div className="reel-description">

                      DESCRIPTION:

                      <span className="font-normal text-gray-600 ml-2">

                        {clip.description ||
                          'NO DESCRIPTION PROVIDED.'}

                      </span>

                    </div>

                  </div>

                ))

              ) : (

                <div className="h-full w-full flex items-center justify-center">

                  <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">

                    No Clips Available

                  </span>

                </div>

              )}

            </div>

          </div>

        </div>

        {commentsClip && (
          <div
            className="comments-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCommentsClip(null);
              }
            }}
          >
            <div className="comments-modal">
              <div className="comments-modal-header">
                <div>
                  <span className="comments-modal-eyebrow">Community</span>
                  <h3>Comments</h3>
                </div>
                <button
                  type="button"
                  className="comments-close-btn"
                  onClick={() => setCommentsClip(null)}
                  aria-label="Close comments"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="comments-list">
                {commentsLoading && (
                  <p className="comments-empty">Loading comments...</p>
                )}
                {!commentsLoading && comments.length === 0 && (
                  <p className="comments-empty">Be the first to share a thought.</p>
                )}
                {comments.map((comment) => (
                  <div className="comment-row" key={comment.id}>
                    <div className="comment-avatar">
                      {comment.author?.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{comment.author}</strong>
                      <p>{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {commentError && <p className="comment-error">{commentError}</p>}

              <form className="comment-form" onSubmit={submitComment}>
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Add a comment..."
                  maxLength={1000}
                />
                <button type="submit" disabled={!commentText.trim()}>
                  Post
                </button>
              </form>
            </div>
          </div>
        )}

      </div>

    </div>

  );

};


export default DashboardHome;