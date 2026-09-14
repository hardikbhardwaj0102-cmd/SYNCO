import { Link, NavLink, useNavigate } from 'react-router-dom';
import '../styles/components/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <header className="navbar-header">
      <Link to="/" className="navbar-logo">
        SYNCO
      </Link>
      
      <nav className="navbar-nav">
        <NavLink to="/play" className={({ isActive }) => `navbar-link${isActive ? ' navbar-link-active' : ''}`}>
          Games
        </NavLink>
        <NavLink to="/competitions" className={({ isActive }) => `navbar-link${isActive ? ' navbar-link-active' : ''}`}>
          Tournaments
        </NavLink>
        <NavLink to="/ranking" className={({ isActive }) => `navbar-link${isActive ? ' navbar-link-active' : ''}`}>
          Rankings
        </NavLink>
      </nav>

      <button 
        onClick={() => navigate('/login')}
        className="navbar-btn"
      >
        Log In
      </button>
    </header>
  );
};

export default Navbar;