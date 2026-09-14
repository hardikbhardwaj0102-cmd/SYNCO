import { useState, useEffect } from 'react';
import { Search as SearchIcon, User, Shield, Gamepad2, ArrowRight } from 'lucide-react';
import '../styles/components/Search.css';

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'users', 'clubs', 'games'
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({ users: [], clubs: [], games: [] });

  // Debounced Search Simulation (Replace with actual Flask API call)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults({ users: [], clubs: [], games: [] });
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600));

      // Mock Data - Replace with your actual fetch logic:
      // const res = await fetch(`/api/search?q=${searchQuery}&type=${activeTab}`);
      // const data = await res.json();
      
      setResults({
        users: [
          { id: 1, name: 'Kartik Saxena', gametag: 'FROAKAI', type: 'user' },
          { id: 2, name: 'John Doe', gametag: 'JOHNNY_D', type: 'user' }
        ].filter(u => u.gametag.toLowerCase().includes(searchQuery.toLowerCase())),
        clubs: [
          { id: 1, name: 'Elite Strikers', members: 124, type: 'club' },
          { id: 2, name: 'Delhi Dragons', members: 89, type: 'club' }
        ].filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
        games: [
          { id: 1, name: 'BGMI', genre: 'Battle Royale', type: 'game' },
          { id: 2, name: 'Valorant', genre: 'Tactical Shooter', type: 'game' }
        ].filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
      });
      
      setIsLoading(false);
    };

    const debounceTimer = setTimeout(fetchSearchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const tabs = [
    { id: 'all', label: 'All Results' },
    { id: 'users', label: 'Users' },
    { id: 'clubs', label: 'Clubs' },
    { id: 'games', label: 'Games' }
  ];

  const renderUserCard = (user) => (
    <div key={`user-${user.id}`} className="search-result-card group">
      <div className="search-result-icon"><User size={20} /></div>
      <div className="search-result-info">
        <span className="search-result-title">{user.gametag}</span>
        <span className="search-result-subtitle">{user.name}</span>
      </div>
      <button className="search-action-btn">View Profile <ArrowRight size={14} /></button>
    </div>
  );

  const renderClubCard = (club) => (
    <div key={`club-${club.id}`} className="search-result-card group">
      <div className="search-result-icon"><Shield size={20} /></div>
      <div className="search-result-info">
        <span className="search-result-title">{club.name}</span>
        <span className="search-result-subtitle">{club.members} Members</span>
      </div>
      <button className="search-action-btn">View Club <ArrowRight size={14} /></button>
    </div>
  );

  const renderGameCard = (game) => (
    <div key={`game-${game.id}`} className="search-result-card group">
      <div className="search-result-icon"><Gamepad2 size={20} /></div>
      <div className="search-result-info">
        <span className="search-result-title">{game.name}</span>
        <span className="search-result-subtitle">{game.genre}</span>
      </div>
      <button className="search-action-btn">View Game <ArrowRight size={14} /></button>
    </div>
  );

  const hasResults = results.users.length > 0 || results.clubs.length > 0 || results.games.length > 0;

  return (
    <div className="search-wrapper">
      
      {/* Search Header & Input */}
      <div className="search-header-section">
        <span className="text-[#D6C98A] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 block">DISCOVER</span>
        <h1 className="search-page-title font-super-brigade text-black">GLOBAL SEARCH</h1>
        
        <div className="search-input-container">
          <SearchIcon size={24} className="search-input-icon" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search for players, clubs, or games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="search-clear-btn">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="search-tabs-container">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`search-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results Area */}
      <div className="search-results-container scrollbar-thin">
        {isLoading ? (
          <div className="search-loading">Searching the network...</div>
        ) : !searchQuery.trim() ? (
          <div className="search-empty-state">
            <SearchIcon size={48} className="mb-4 opacity-20" />
            <p>Enter a name, club, or game title to start searching.</p>
          </div>
        ) : !hasResults ? (
          <div className="search-empty-state">
            <p>No results found for "{searchQuery}".</p>
          </div>
        ) : (
          <div className="search-results-grid">
            
            {/* Users Section */}
            {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
              <div className="search-result-section">
                <h3 className="search-section-header">PLAYERS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.users.map(renderUserCard)}
                </div>
              </div>
            )}

            {/* Clubs Section */}
            {(activeTab === 'all' || activeTab === 'clubs') && results.clubs.length > 0 && (
              <div className="search-result-section">
                <h3 className="search-section-header">CLUBS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.clubs.map(renderClubCard)}
                </div>
              </div>
            )}

            {/* Games Section */}
            {(activeTab === 'all' || activeTab === 'games') && results.games.length > 0 && (
              <div className="search-result-section">
                <h3 className="search-section-header">GAMES</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.games.map(renderGameCard)}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

export default Search;