import { useEffect, useRef, useState } from 'react';
import { Play, Heart, MessageCircle, X, Volume2, VolumeX } from 'lucide-react';

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// API RESPONSE HELPER
// =========================================================

const readApiResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(
      'Service is unavailable. Please try again.'
    );
  }

  return response.json();
};


// =========================================================
// VIDEO CLIP
// =========================================================

const VideoClip = ({
  id,
  url,
  title,
  description,
  game,
  initialLikes = 0,
  initialComments = 0,
}) => {
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState('');

  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);

  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState('');


  // =========================================================
  // VIDEO EVENTS
  // =========================================================

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setVideoError('');
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      console.error('Video failed to load:', {
        id,
        url,
        error: video.error,
      });

      setIsPlaying(false);
      setVideoError(
        'This video could not be played.'
      );
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [id, url]);


  // =========================================================
  // PLAY / PAUSE
  // =========================================================

  const togglePlay = async (event) => {
    /*
     * Do not trigger video playback when clicking
     * reaction buttons or the comments modal.
     */
    if (event.target.closest('.reaction-btn')) {
      return;
    }

    if (event.target.closest('.video-volume-btn')) {
      return;
    }

    if (event.target.closest('.comments-modal-overlay')) {
      return;
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      if (video.paused) {
        setVideoError('');

        /*
         * play() returns a Promise.
         * We wait for it so autoplay/browser errors
         * are handled correctly.
         */
        await video.play();
      } else {
        video.pause();
      }
    } catch (error) {
      console.error('Video playback failed:', error);

      setIsPlaying(false);

      setVideoError(
        'Unable to play this video.'
      );
    }
  };


  // =========================================================
  // MUTE / UNMUTE
  // =========================================================

  const toggleMute = (event) => {
    event.stopPropagation();

    const video = videoRef.current;

    if (!video) return;

    video.muted = !video.muted;

    setIsMuted(video.muted);
  };


  // =========================================================
  // LIKE
  // =========================================================

  const handleLike = async (event) => {
    event.stopPropagation();

    try {
      const response = await fetch(
        `${API_URL}/api/profile/clips/${id}/like`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Please sign in to like clips.'
        );
      }

      setLiked(Boolean(data.liked));
      setLikes(
        typeof data.likes === 'number'
          ? data.likes
          : likes
      );
    } catch (error) {
      console.error('Like failed:', error);

      setCommentError(
        error.message ||
        'Unable to like this clip.'
      );
    }
  };


  // =========================================================
  // LOAD COMMENTS
  // =========================================================

  useEffect(() => {
    if (!isCommentsOpen || !id) {
      return;
    }

    let cancelled = false;

    const loadComments = async () => {
      setIsLoadingComments(true);
      setCommentError('');

      try {
        const response = await fetch(
          `${API_URL}/api/profile/clips/${id}/comments`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
            cache: 'no-store',
          }
        );

        const data = await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data.message ||
            'Unable to load comments.'
          );
        }

        if (!cancelled) {
          setComments(data.comments || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Comments loading failed:',
            error
          );

          setCommentError(
            error.message ||
            'Unable to load comments.'
          );
        }
      } finally {
        if (!cancelled) {
          setCommentsLoaded(true);
          setIsLoadingComments(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [id, isCommentsOpen]);


  // =========================================================
  // SUBMIT COMMENT
  // =========================================================

  const submitComment = async (event) => {
    event.preventDefault();

    if (!commentText.trim()) {
      return;
    }

    setCommentError('');

    try {
      const response = await fetch(
        `${API_URL}/api/profile/clips/${id}/comments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            content: commentText.trim(),
          }),
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to post comment.'
        );
      }

      setComments((currentComments) => [
        ...currentComments,
        data,
      ]);

      setCommentText('');
      setCommentsLoaded(true);
    } catch (error) {
      console.error(
        'Comment submission failed:',
        error
      );

      setCommentError(
        error.message ||
        'Unable to post comment.'
      );
    }
  };


  // =========================================================
  // INVALID VIDEO URL
  // =========================================================

  if (!url) {
    return (
      <div className="custom-video-container scroll-item relative">
        <div className="w-full h-full flex items-center justify-center bg-black text-white text-xs font-bold uppercase tracking-widest">
          Video unavailable
        </div>
      </div>
    );
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="custom-video-container scroll-item relative"
      onClick={togglePlay}
    >

      {/* =====================================================
          VIDEO
          ===================================================== */}

      <video
        ref={videoRef}
        src={url}
        className={`custom-video-element ${isPlaying
          ? 'opacity-100'
          : 'opacity-80'
          }`}
        playsInline
        loop
        muted={isMuted}
        preload="metadata"
      />


      {/* =====================================================
          PLAY OVERLAY
          ===================================================== */}

      {!isPlaying && !videoError && (
        <div className="video-play-overlay">
          <div className="video-play-icon">
            <Play
              fill="currentColor"
              size={20}
              className="ml-1"
            />
          </div>
        </div>
      )}


      {/* =====================================================
          VIDEO ERROR
          ===================================================== */}

      {videoError && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6 text-center"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div>
            <p className="text-white text-xs font-bold uppercase tracking-widest">
              {videoError}
            </p>

            <p className="text-white/50 text-[10px] mt-2">
              Check that the uploaded video is accessible.
            </p>
          </div>
        </div>
      )}


      {/* =====================================================
          VOLUME BUTTON
          ===================================================== */}

      <button
        type="button"
        className="video-volume-btn absolute top-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
        onClick={toggleMute}
        aria-label={
          isMuted
            ? 'Unmute video'
            : 'Mute video'
        }
      >
        {isMuted ? (
          <VolumeX size={15} />
        ) : (
          <Volume2 size={15} />
        )}
      </button>


      {/* =====================================================
          INTERACTIVE SIDEBAR
          ===================================================== */}

      <div className="video-reactions-sidebar">

        <button
          type="button"
          onClick={handleLike}
          className={`reaction-btn ${liked
            ? 'text-red-500 hover:text-red-400'
            : ''
            }`}
        >
          <Heart
            fill={
              liked
                ? 'currentColor'
                : 'none'
            }
            size={22}
          />

          <span className="reaction-count">
            {likes}
          </span>
        </button>


        <button
          type="button"
          className="reaction-btn"
          onClick={(event) => {
            event.stopPropagation();
            setIsCommentsOpen(true);
          }}
        >
          <MessageCircle size={22} />

          <span className="reaction-count">
            {commentsLoaded
              ? comments.length
              : initialComments}
          </span>
        </button>

      </div>


      {/* =====================================================
          INFO OVERLAY
          ===================================================== */}

      <div className="video-info-overlay">

        {game && (
          <span className="text-[10px] font-bold text-[#D6C98A] uppercase tracking-widest">
            {game}
          </span>
        )}

        <h3 className="text-white text-sm font-bold truncate mt-1">
          {title || 'Gameplay Clip'}
        </h3>

        {description && (
          <p className="text-white/70 text-xs truncate mt-0.5">
            {description}
          </p>
        )}

      </div>


      {/* =====================================================
          COMMENTS MODAL
          ===================================================== */}

      {isCommentsOpen && (
        <div
          className="comments-modal-overlay"
          onClick={(event) => {
            event.stopPropagation();

            if (
              event.target ===
              event.currentTarget
            ) {
              setIsCommentsOpen(false);
            }
          }}
        >

          <div
            className="comments-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="comments-modal-header">

              <div>
                <span className="comments-modal-eyebrow">
                  Community
                </span>

                <h3>
                  Comments
                </h3>
              </div>

              <button
                type="button"
                className="comments-close-btn"
                onClick={() =>
                  setIsCommentsOpen(false)
                }
                aria-label="Close comments"
              >
                <X size={18} />
              </button>

            </div>


            {/* COMMENTS */}

            <div className="comments-list">

              {isLoadingComments && (
                <p className="comments-empty">
                  Loading comments...
                </p>
              )}

              {!isLoadingComments &&
                comments.length === 0 && (
                  <p className="comments-empty">
                    Be the first to share a thought.
                  </p>
                )}

              {comments.map((comment) => (
                <div
                  className="comment-row"
                  key={comment.id}
                >

                  <div className="comment-avatar">
                    {comment.author
                      ?.slice(0, 1)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>
                      {comment.author}
                    </strong>

                    <p>
                      {comment.content}
                    </p>
                  </div>

                </div>
              ))}

            </div>


            {/* ERROR */}

            {commentError && (
              <p className="comment-error">
                {commentError}
              </p>
            )}


            {/* COMMENT FORM */}

            <form
              className="comment-form"
              onSubmit={submitComment}
            >

              <input
                value={commentText}
                onChange={(event) =>
                  setCommentText(
                    event.target.value
                  )
                }
                placeholder="Add a comment..."
                maxLength={1000}
              />

              <button
                type="submit"
                disabled={!commentText.trim()}
              >
                Post
              </button>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

export default VideoClip;
