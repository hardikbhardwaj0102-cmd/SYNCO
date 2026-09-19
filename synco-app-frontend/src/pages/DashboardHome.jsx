import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Heart,
  MessageSquare,
  Play,
  Target,
  Zap,
} from 'lucide-react';

import '../styles/pages/DashboardHome.css';
import AdminDashboard from './AdminDashboard';
import { useAuth } from '../context/AuthContext';
import killjoyRender from '../assets/killjoy-render.png';


// =========================================================
// API URL
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// HELPERS
// =========================================================

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact' });

const formatCount = (value) => compactNumber.format(value || 0);

const showValue = (value) =>
  value === undefined || value === null || value === '' ? '--' : value;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};


// =========================================================
// DASHBOARD HOME
// =========================================================

const DashboardHome = () => {

  const { user } = useAuth();

  const accountRole =
    user?.accountRole ??
    user?.account_role;

  const isAdmin = accountRole === 'admin';

  const gametag = user?.gametag || user?.username || 'PLAYER';

  const [gameCatalog, setGameCatalog] = useState([]);
  const [profileGames, setProfileGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [clips, setClips] = useState([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState('');

  const videoRefs = useRef({});
  const activeClipIdRef = useRef(null);

  const activeClip = clips[activeClipIndex] ?? null;
  const activeClipId = activeClip?.id ?? null;
  activeClipIdRef.current = activeClipId;


  // =========================================================
  // LOAD DASHBOARD DATA
  // =========================================================

  useEffect(() => {

    if (isAdmin) {
      return;
    }

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


        // GAME CATALOG

        if (catalogResponse?.ok) {
          const catalogData = await catalogResponse.json();
          setGameCatalog(catalogData.games || []);
        }


        // PROFILE GAMES

        if (profileResponse?.ok) {
          const profileData = await profileResponse.json();
          setProfileGames(profileData.games || []);
        }


        // CLIPS

        if (clipsResponse?.ok) {
          const clipsData = await clipsResponse.json();
          setClips(clipsData.clips || []);
          setActiveClipIndex(0);
        }

      } catch (error) {

        console.error(
          'Failed to load dashboard data:',
          error
        );

      }

    };


    loadDashboardData();

  }, [isAdmin]);


  // =========================================================
  // GAME LIST + DEFAULT SELECTED GAME
  // "Your Games" = only the games on the player's profile.
  // If the profile has no games, we should not fall back to the
  // global catalog because that incorrectly shows all games.
  // =========================================================

  const gameOptions = useMemo(
    () => profileGames.map((game) => game.gameName),
    [profileGames]
  );

  useEffect(() => {

    if (!profileGames.length) {
      setSelectedGame('');
      return;
    }

    if (!selectedGame || !profileGames.some((game) => game.gameName === selectedGame)) {
      setSelectedGame(profileGames[0].gameName);
    }

  }, [profileGames, selectedGame]);

  const selectedStats = profileGames.find(
    (game) => game.gameName === selectedGame
  );


  // =========================================================
  // COMMENTS FOR THE ACTIVE CLIP
  // =========================================================

  useEffect(() => {

    if (!activeClipId) {
      setComments([]);
      return undefined;
    }

    let cancelled = false;

    const loadComments = async () => {

      setComments([]);
      setCommentText('');
      setCommentError('');
      setCommentsLoading(true);

      try {

        const response = await fetch(
          `${API_URL}/api/profile/clips/${activeClipId}/comments`,
          { credentials: 'include', headers: { Accept: 'application/json' } }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load comments.');
        }

        if (!cancelled) {
          setComments(data.comments || []);
        }

      } catch (error) {

        if (!cancelled) {
          setCommentError(error.message || 'Unable to load comments.');
        }

      } finally {

        if (!cancelled) {
          setCommentsLoading(false);
        }

      }

    };

    loadComments();

    return () => {
      cancelled = true;
    };

  }, [activeClipId]);


  // =========================================================
  // VIDEO PLAYBACK — only the centered clip plays
  // =========================================================

  useEffect(() => {

    clips.forEach((clip, index) => {

      const video = videoRefs.current[clip.id];

      if (!video) return;

      if (index === activeClipIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }

    });

  }, [clips, activeClipIndex]);

  const togglePlayback = (clipId) => {

    const video = videoRefs.current[clipId];

    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }

  };


  // =========================================================
  // COVERFLOW NAVIGATION
  // =========================================================

  const nextClip = () => {
    if (!clips.length) return;
    setActiveClipIndex((prev) => (prev + 1) % clips.length);
  };

  const prevClip = () => {
    if (!clips.length) return;
    setActiveClipIndex((prev) => (prev - 1 + clips.length) % clips.length);
  };


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


  // =========================================================
  // POST COMMENT
  // =========================================================

  const submitComment = async () => {

    if (!activeClip || !commentText.trim()) return;

    const clipId = activeClip.id;

    try {
      const response = await fetch(
        `${API_URL}/api/profile/clips/${clipId}/comments`,
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

      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === clipId
            ? { ...clip, comments: (clip.comments || 0) + 1 }
            : clip
        )
      );

      // Only touch the visible list if the user is still on the same clip
      if (activeClipIdRef.current === clipId) {
        setComments((currentComments) => [...currentComments, data]);
        setCommentText('');
        setCommentError('');
      }
    } catch (error) {
      setCommentError(error.message || 'Unable to post comment.');
    }
  };

  const handleCommentKeyDown = (event) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submitComment();
    }
  };


  // =========================================================
  // ADMIN DASHBOARD
  // =========================================================

  if (isAdmin) {
    return <AdminDashboard />;
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="bento-dashboard-wrapper">


      {/* =========================================
          COLUMN 2: MAIN LEFT
          ========================================= */}
      <div className="col-main-left">

        {/* Greetings Pill */}
        <div className="wire-block greetings-pill">
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            {getGreeting()}, <span className="text-highlight font-bold">{gametag}</span>
          </h2>
        </div>

        {/* Featured Tournaments (with popup render) */}
        <div className="wire-block tournaments-card">
          <span className="live-badge"><span className="dot"></span> LIVE NOW</span>
          <h1 className="block-title">SYNCO<br />Summer Cup</h1>
          <p className="hero-comp-sub">Prize Pool: 50,000 CR</p>
          <button className="join-btn">Register Roster</button>

          <img src={killjoyRender} alt="Character Popup" className="hero-character-render" />
        </div>

        {/* Coverflow Highlights Section */}
        <div className="bento-card highlights-section">
          <h3 className="section-label">SYNCO MOMENTS</h3>

          <div className="coverflow-container">

            {activeClip ? (
              <>
                {/* Left Overlay: Title & Details */}
                <div className="coverflow-left-overlay">
                  <h2 className="clip-title-massive">{activeClip.title}</h2>
                  <div className="clip-author">
                    Description: {activeClip.description || 'No description provided.'}
                  </div>
                  <div className="clip-actions">
                    <button
                      type="button"
                      onClick={() => handleLikeClip(activeClip.id)}
                      aria-pressed={Boolean(activeClip.isLiked)}
                      aria-label="Like this clip"
                    >
                      <Heart
                        size={18}
                        fill={activeClip.isLiked ? '#ff4655' : 'none'}
                        color={activeClip.isLiked ? '#ff4655' : 'currentColor'}
                      />
                      {formatCount(activeClip.likes)}
                    </button>
                  </div>
                </div>

                {/* The Videos */}
                <div className="clip-game-tag">{activeClip.game || 'Unspecified'}</div>
                <div className="coverflow-track">
                  {clips.map((clip, index) => {
                    let positionClass = 'clip-hidden';
                    if (index === activeClipIndex) positionClass = 'clip-center';
                    else if (index === (activeClipIndex - 1 + clips.length) % clips.length) positionClass = 'clip-left';
                    else if (index === (activeClipIndex + 1) % clips.length) positionClass = 'clip-right';

                    const isCenter = index === activeClipIndex;

                    return (
                      <div key={clip.id} className={`clip-card ${positionClass}`}>
                        <video
                          ref={(element) => {
                            if (element) {
                              videoRefs.current[clip.id] = element;
                            } else {
                              delete videoRefs.current[clip.id];
                            }
                          }}
                          src={clip.url}
                          muted
                          loop
                          playsInline
                          preload={isCenter ? 'auto' : 'metadata'}
                        />
                        {isCenter && (
                          <div
                            className="play-overlay"
                            onClick={() => togglePlayback(clip.id)}
                          >
                            <Play size={32} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right Overlay: Comments */}
                <div className="coverflow-right-overlay comments-panel">
                  <h4 className="comments-header">
                    <MessageSquare size={14} /> Comments ({activeClip.comments || 0})
                  </h4>
                  <div className="comments-list">
                    {commentsLoading && (
                      <p className="empty-comms">Loading comments...</p>
                    )}
                    {!commentsLoading && !commentError && comments.length === 0 && (
                      <p className="empty-comms">No comments yet</p>
                    )}
                    {comments.map((comment) => (
                      <div key={comment.id} className="comment-item">
                        <span className="comment-user">{comment.author}:</span> {comment.content}
                      </div>
                    ))}
                    {commentError && (
                      <p className="empty-comms" style={{ color: '#ff4655' }}>
                        {commentError}
                      </p>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Add a comment"
                    className="comment-input"
                    value={commentText}
                    maxLength={1000}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={handleCommentKeyDown}
                  />
                </div>

                {/* Navigation Controls */}
                {clips.length > 1 && (
                  <>
                    <button type="button" className="nav-btn prev-btn" onClick={prevClip} aria-label="Previous clip">
                      <ChevronLeft />
                    </button>
                    <button type="button" className="nav-btn next-btn" onClick={nextClip} aria-label="Next clip">
                      <ChevronRight />
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="empty-comms" style={{ textAlign: 'center' }}>
                No clips yet. Add clips to your showcase and they will show up here.
              </p>
            )}

          </div>
        </div>
      </div>


      {/* =========================================
          COLUMN 3: MAIN RIGHT
          ========================================= */}
      <div className="col-main-right">

        {/* Premium Banner */}
        <div className="wire-block premium-banner-pill">
          <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.9rem' }}>
            Upgrade to SYNCO Premium
          </span>
          <Crown size={20} className="text-highlight" />
        </div>

        {/* Mid Row: Games + Promo */}
        <div className="mid-grid-row">
          <div className="bento-card game-selector-card">
            <h3 className="section-label">Your Games</h3>
            <div className="game-list">
              {gameOptions.length ? (
                gameOptions.map((game) => (
                  <button
                    type="button"
                    key={game}
                    className={`game-option ${selectedGame === game ? 'active' : ''}`}
                    onClick={() => setSelectedGame(game)}
                  >
                    <Target size={16} />
                    <span>{game}</span>
                  </button>
                ))
              ) : (
                <p className="empty-comms">No games yet</p>
              )}
            </div>
          </div>
          <div className="wire-block synco-promo-card">
            <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', lineHeight: '1.4' }}>
              synco<br />promotional<br />banner
            </h3>
          </div>
        </div>

        {/* Visual Statistics Meter */}
        <div className="bento-card stat-meter-card">
          <div className="stat-header-row">
            <h3 className="section-label">SYNCO Rating</h3>
            <Zap size={16} className="stat-icon" />
          </div>

          <div className="stat-meter-container">
            <div className="stat-glowing-blob"></div>
            <div className="rating-number">{showValue(selectedStats?.rating)}</div>
          </div>

          <div className="stat-breakdown">
            <div className="stat-pill">
              <span className="label">Class</span>
              <span className="value">{showValue(selectedStats?.rank)}</span>
            </div>
            <div className="stat-pill">
              <span className="label">Win R.</span>
              <span className="value text-emerald">{showValue(selectedStats?.winRate)}</span>
            </div>
            <div className="stat-pill">
              <span className="label">K/D</span>
              <span className="value">{showValue(selectedStats?.kd)}</span>
            </div>
          </div>
        </div>
      </div>


      {/* =========================================
          COLUMN 4: FAR RIGHT SIDEBAR
          ========================================= */}
      <div className="col-far-right">
        <div className="wire-block social-bar-top">
          <span className="vertical-text">social right bar</span>
        </div>
        <div className="wire-block social-bar-bottom">
          <span className="vertical-text">discord right bar</span>
        </div>
      </div>

    </div>
  );
};

export default DashboardHome;