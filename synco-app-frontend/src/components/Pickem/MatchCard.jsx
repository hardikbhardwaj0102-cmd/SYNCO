import '../../styles/components/MatchCard.css';

const formatDate = (value) => {
  if (!value) {
    return 'DATE NOT SET';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatStatus = (status) => {
  if (!status) {
    return 'UPCOMING';
  }

  return String(status)
    .replaceAll('_', ' ')
    .toUpperCase();
};

const MatchCard = ({ match }) => {

  const handleOpenCompetition = () => {
    /*
      Keep this simple for now.

      Once your competition detail route is finalized,
      this can navigate to:

      /competitions/:id
    */

    window.location.href = `/competitions/${match.id}`;
  };

  return (
    <div className="match-card">

      {/* =================================================
          LEFT
      ================================================= */}

      <div className="match-left-section">

        <div className="match-picks-box">

          <span className="match-picks-title">
            STATUS
          </span>

          <span className="match-picks-text">
            {formatStatus(match.status)}
          </span>

        </div>

      </div>

      {/* =================================================
          CENTER
      ================================================= */}

      <div className="match-center-section">

        <div className="match-attendees-title">
          {match.name}
        </div>

        {match.description && (
          <p className="match-description">
            {match.description}
          </p>
        )}

        <div className="match-teams-container">

          {match.game && (
            <div className="match-team-box">

              <span className="match-team-name">
                GAME
              </span>

              <span className="match-team-percentage">
                {match.game}
              </span>

            </div>
          )}

          {match.gameMode && (
            <div className="match-team-box">

              <span className="match-team-name">
                MODE
              </span>

              <span className="match-team-percentage">
                {match.gameMode}
              </span>

            </div>
          )}

          {match.participantType && (
            <div className="match-team-box">

              <span className="match-team-name">
                FORMAT
              </span>

              <span className="match-team-percentage">
                {match.participantType}
              </span>

            </div>
          )}

          {match.maxParticipants && (
            <div className="match-team-box">

              <span className="match-team-name">
                SLOTS
              </span>

              <span className="match-team-percentage">
                {match.maxParticipants}
              </span>

            </div>
          )}

        </div>

        {/* =================================================
            META
        ================================================= */}

        <div className="match-meta">

          {match.date && (
            <span>
              {formatDate(match.date)}
            </span>
          )}

          {match.numberOfMatches && (
            <span>
              {match.numberOfMatches} MATCHES
            </span>
          )}

          {match.teamSize && (
            <span>
              {match.teamSize} PLAYER
              {match.teamSize > 1 ? 'S' : ''}
            </span>
          )}

        </div>

      </div>

      {/* =================================================
          RIGHT
      ================================================= */}

      <div className="match-action-section">

        <button
          type="button"
          className="match-action-btn"
          onClick={handleOpenCompetition}
        >
          VIEW COMPETITION
        </button>

      </div>

    </div>
  );
};

export default MatchCard;