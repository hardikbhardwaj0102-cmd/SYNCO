import React from 'react';
import { Trophy, Radio, Clock3, Users } from 'lucide-react';
import '../styles/pages/LiveTournamentDashboard.css';

const teams = [
    {
        rank: 1,
        name: 'TEAM ALPHA',
        totalPoints: 42,
        members: [
            { name: 'PlayerOne', points: 16 },
            { name: 'PlayerTwo', points: 12 },
            { name: 'PlayerThree', points: 8 },
            { name: 'PlayerFour', points: 6 },
        ],
    },
    {
        rank: 2,
        name: 'TEAM NOVA',
        totalPoints: 37,
        members: [
            { name: 'Shadow', points: 14 },
            { name: 'Viper', points: 11 },
            { name: 'Blaze', points: 7 },
            { name: 'Hunter', points: 5 },
        ],
    },
    {
        rank: 3,
        name: 'TEAM TITANS',
        totalPoints: 31,
        members: [
            { name: 'Reaper', points: 13 },
            { name: 'Ghost', points: 9 },
            { name: 'Ace', points: 5 },
            { name: 'Rogue', points: 4 },
        ],
    },
    {
        rank: 4,
        name: 'TEAM FURY',
        totalPoints: 26,
        members: [
            { name: 'Storm', points: 10 },
            { name: 'Venom', points: 8 },
            { name: 'Wolf', points: 5 },
            { name: 'Zero', points: 3 },
        ],
    },
];

const LiveTournamentDashboard = () => {
    return (
        <div className="live-dashboard">

            {/* HEADER */}
            <header className="live-dashboard-header">

                <div className="live-dashboard-heading">
                    <div className="live-status">
                        <span className="live-status-dot" />
                        LIVE TOURNAMENT
                    </div>

                    <h1>SYNCO CHAMPIONSHIP</h1>

                    <p>
                        BGMI · MATCH 04
                    </p>
                </div>

                <div className="live-dashboard-meta">

                    <div className="live-meta-item">
                        <Clock3 size={17} />
                        <div>
                            <span>TIME</span>
                            <strong>18:42</strong>
                        </div>
                    </div>

                    <div className="live-meta-item">
                        <Users size={17} />
                        <div>
                            <span>TEAMS</span>
                            <strong>24</strong>
                        </div>
                    </div>

                    <div className="live-meta-item">
                        <Radio size={17} />
                        <div>
                            <span>STATUS</span>
                            <strong>LIVE</strong>
                        </div>
                    </div>

                </div>

            </header>

            {/* CONTENT */}
            <main className="live-dashboard-content">

                <div className="leaderboard-heading">

                    <div>
                        <span className="section-label">MATCH 04</span>
                        <h2>LEADERBOARD</h2>
                    </div>

                    <div className="leaderboard-live-indicator">
                        <span />
                        LIVE UPDATES
                    </div>

                </div>

                {/* TEAM LIST */}
                <section className="team-leaderboard">

                    {teams.map((team) => (
                        <article
                            key={team.rank}
                            className={`team-card ${team.rank === 1 ? 'team-card-top' : ''
                                }`}
                        >

                            {/* TEAM HEADER */}
                            <div className="team-card-header">

                                <div className="team-rank">
                                    <span>#</span>
                                    <strong>{team.rank}</strong>
                                </div>

                                <div className="team-information">
                                    <span className="team-label">TEAM</span>
                                    <h3>{team.name}</h3>
                                </div>

                                <div className="team-total">
                                    <span>TOTAL</span>
                                    <strong>{team.totalPoints}</strong>
                                    <small>PTS</small>
                                </div>

                            </div>

                            {/* TEAM MEMBERS */}
                            <div className="team-members">

                                <div className="members-heading">
                                    <span>TEAM MEMBERS</span>
                                    <span>INDIVIDUAL POINTS</span>
                                </div>

                                {team.members.map((member, index) => (
                                    <div
                                        key={`${team.rank}-${member.name}`}
                                        className="team-member"
                                    >

                                        <div className="member-left">

                                            <span className="member-number">
                                                {String(index + 1).padStart(2, '0')}
                                            </span>

                                            <span className="member-name">
                                                {member.name}
                                            </span>

                                        </div>

                                        <span className="member-points">
                                            {member.points} PTS
                                        </span>

                                    </div>
                                ))}

                            </div>

                        </article>
                    ))}

                </section>

                {/* FOOTER INFORMATION */}
                <div className="leaderboard-footer">

                    <div>
                        <Trophy size={17} />
                        <span>
                            Team points are calculated from individual player points.
                        </span>
                    </div>

                    <span>
                        SYNCO LIVE
                    </span>

                </div>

            </main>

        </div>
    );
};

export default LiveTournamentDashboard;