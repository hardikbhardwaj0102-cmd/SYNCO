import '../../styles/components/MatchCard.css';

const MatchCard = ({ match }) => {
  return (
    <div className="match-card">
      
      {/* Left: Match Info & Your Pick */}
      <div className="match-left-section">
        <div className="match-picks-box">
          <span className="match-picks-title">Your Picks</span>
          <span className="match-picks-text">
            {match.userPick ? match.userPick : 'No team selected'}
          </span>
        </div>
      </div>

      {/* Center: Teams (Attendees) */}
      <div className="match-center-section">
        <div className="match-attendees-title">Match Attendees</div>
        <div className="match-teams-container">
          {match.teams.map((team, index) => (
            <div key={index} className="match-team-box">
              <span className="match-team-name">{team.name}</span>
              <span className="match-team-percentage">
                {team.pickPercentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Actions */}
      <div>
        <button className="match-action-btn">
          Login To Play
        </button>
      </div>
    </div>
  );
};

export default MatchCard;