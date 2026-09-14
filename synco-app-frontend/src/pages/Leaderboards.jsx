import '../styles/pages/Leaderboards.css';

const Leaderboards = () => {
  // Future Cloudflare D1 Integration
  // const [rankings, setRankings] = useState([]);

  const mockLeaderboard = [
    { rank: 1, name: 'Team Falcons', score: 4500, region: 'MENA' },
    { rank: 2, name: 'Liquid', score: 3200, region: 'EU' },
    { rank: 3, name: 'T1', score: 3150, region: 'KR' },
    { rank: 4, name: 'Navi', score: 2900, region: 'EU' },
  ];

  return (
    <div className="leaderboards-container">
      <div className="leaderboards-header">
        <h1 className="leaderboards-title">Global Hall of Fame</h1>
        <p className="leaderboards-subtitle">Transparent rating system tracking the highest-performing teams.</p>
      </div>

      <div className="leaderboards-tabs">
        {['GLOBAL OVERALL', 'BY GAME', 'CLUBS', 'PLAYERS'].map((tab, i) => (
          <button
            key={tab}
            className={`leaderboards-tab-btn ${i === 0 ? 'leaderboards-tab-active' : 'leaderboards-tab-inactive'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="leaderboards-table-container">
        <div className="leaderboards-table-header">
          <div className="leaderboards-col-rank">Rank</div>
          <div className="leaderboards-col-name">Organization / Player</div>
          <div className="leaderboards-col-region">Region</div>
          <div className="leaderboards-col-points">Points</div>
        </div>

        {mockLeaderboard.map((row) => (
          <div key={row.rank} className="leaderboards-table-row">
            <div className="leaderboards-cell-rank">
              #{row.rank}
            </div>
            <div className="leaderboards-cell-name">
              {row.name}
            </div>
            <div className="leaderboards-cell-region">
              {row.region}
            </div>
            <div className="leaderboards-cell-points">
              {row.score.toLocaleString()} XP
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboards;