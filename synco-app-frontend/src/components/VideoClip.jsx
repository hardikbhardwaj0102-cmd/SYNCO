import { useEffect, useRef, useState } from 'react';
import { Play, Heart, MessageCircle, X } from 'lucide-react';

const readApiResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Comments service is unavailable. Please restart the Flask backend.');
  }
  return response.json();
};

const VideoClip = ({ id, url, title, description, game, initialLikes = 0, initialComments = 0 }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState('');

  const togglePlay = (e) => {
    // Prevent play toggle if the user is clicking the like/comment buttons
    if (e.target.closest('.reaction-btn')) return;
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleLike = () => {
    fetch(`/api/profile/clips/${id}/like`, { method: 'POST' })
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.message || 'Please sign in to like clips.');
        setLiked(data.liked);
        setLikes(data.likes);
      })
      .catch((error) => setCommentError(error.message));
  };

  useEffect(() => {
    if (!isCommentsOpen) return;
    setIsLoadingComments(true);
    setCommentError('');
    fetch(`/api/profile/clips/${id}/comments`)
      .then(async (response) => {
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.message || 'Unable to load comments.');
        setComments(data.comments || []);
      })
      .catch((error) => setCommentError(error.message))
      .finally(() => {
        setCommentsLoaded(true);
        setIsLoadingComments(false);
      });
  }, [id, isCommentsOpen]);

  const submitComment = async (event) => {
    event.preventDefault();
    if (!commentText.trim()) return;
    setCommentError('');
    try {
      const response = await fetch(`/api/profile/clips/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.message || 'Unable to post comment.');
      setComments((currentComments) => [...currentComments, data]);
      setCommentText('');
    } catch (error) {
      setCommentError(error.message);
    }
  };

  return (
    <div className="custom-video-container scroll-item relative" onClick={togglePlay}>
      <video 
        ref={videoRef}
        src={url} 
        className={`custom-video-element ${isPlaying ? 'opacity-100' : 'opacity-80'}`}
        playsInline
        loop
      />
      
      {!isPlaying && (
        <div className="video-play-overlay">
          <div className="video-play-icon">
            <Play fill="currentColor" size={20} className="ml-1" />
          </div>
        </div>
      )}

      {/* Interactive Sidebar */}
      <div className="video-reactions-sidebar">
        <button onClick={handleLike} className={`reaction-btn ${liked ? 'text-red-500 hover:text-red-400' : ''}`}>
          <Heart fill={liked ? "currentColor" : "none"} size={22} />
          <span className="reaction-count">{likes}</span>
        </button>
        <button className="reaction-btn" onClick={() => setIsCommentsOpen(true)}>
          <MessageCircle size={22} />
          <span className="reaction-count">{commentsLoaded ? comments.length : initialComments}</span>
        </button>
      </div>

      {/* Info Overlay */}
      <div className="video-info-overlay">
        {game && <span className="text-[10px] font-bold text-[#D6C98A] uppercase tracking-widest">{game}</span>}
        <h3 className="text-white text-sm font-bold truncate mt-1">{title || 'Gameplay Clip'}</h3>
        {description && <p className="text-white/70 text-xs truncate mt-0.5">{description}</p>}
      </div>

      {isCommentsOpen && (
        <div className="comments-modal-overlay" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) setIsCommentsOpen(false); }}>
          <div className="comments-modal" onClick={(event) => event.stopPropagation()}>
            <div className="comments-modal-header">
              <div><span className="comments-modal-eyebrow">Community</span><h3>Comments</h3></div>
              <button className="comments-close-btn" onClick={() => setIsCommentsOpen(false)} aria-label="Close comments"><X size={18} /></button>
            </div>
            <div className="comments-list">
              {isLoadingComments && <p className="comments-empty">Loading comments...</p>}
              {!isLoadingComments && comments.length === 0 && <p className="comments-empty">Be the first to share a thought.</p>}
              {comments.map((comment) => (
                <div className="comment-row" key={comment.id}>
                  <div className="comment-avatar">{comment.author?.slice(0, 1).toUpperCase()}</div>
                  <div><strong>{comment.author}</strong><p>{comment.content}</p></div>
                </div>
              ))}
            </div>
            {commentError && <p className="comment-error">{commentError}</p>}
            <form className="comment-form" onSubmit={submitComment}>
              <input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment..." maxLength={1000} />
              <button type="submit" disabled={!commentText.trim()}>Post</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoClip;