import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home,
  Trophy,
  Gamepad2,
  Crown,
  Shield,
  Gift,
  User,
  Search,
  Bell
} from 'lucide-react';

import GamesDropdown from './GamesDropdown';
import '../styles/components/Sidebar.css';

// =========================================================
// API URL
// =========================================================

const API_URL = 'https://synco-backend-vi7b.onrender.com';


// =========================================================
// SIDEBAR
// =========================================================

const Sidebar = () => {
  const [isPlayHovered, setIsPlayHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { user, isAuthenticated } = useAuth();


  // =========================================================
  // FETCH NOTIFICATION COUNT
  // =========================================================

  const fetchUnreadCount = async () => {

    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {

      const response = await fetch(
        `${API_URL}/api/notifications/unread-count`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error(
          'Notification count request failed:',
          response.status
        );

        return;
      }

      const data = await response.json();

      if (data.success) {
        setUnreadCount(data.unreadCount || 0);
      }

    } catch (error) {

      console.error(
        'Failed to fetch notification count:',
        error
      );

    }
  };


  // =========================================================
  // INITIAL FETCH + AUTO REFRESH
  // =========================================================

  useEffect(() => {

    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // Check for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => {
      clearInterval(interval);
    };

  }, [isAuthenticated]);


  // =========================================================
  // REFRESH WHEN NOTIFICATIONS ARE UPDATED
  // =========================================================

  useEffect(() => {

    const handleNotificationsUpdated = () => {
      fetchUnreadCount();
    };

    window.addEventListener(
      'notifications-updated',
      handleNotificationsUpdated
    );

    return () => {

      window.removeEventListener(
        'notifications-updated',
        handleNotificationsUpdated
      );

    };

  }, [isAuthenticated]);


  // =========================================================
  // MAIN NAVIGATION
  // =========================================================

  const navItems = [

    {
      icon: Home,
      label: 'Home',
      path: '/'
    },

    {
      icon: Search,
      label: 'Search',
      path: '/search'
    },

    {
      icon: Trophy,
      label: 'Competitions',
      path: '/competitions'
    },

    {
      icon: Gamepad2,
      label: 'Play',
      path: '/play'
    },

    {
      icon: Crown,
      label: 'Ranking',
      path: '/ranking'
    },

    {
      icon: Shield,
      label: 'Clubs',
      path: '/clubs'
    }

  ];


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <aside className="sidebar-container">


      {/* =====================================================
          LOGO
          ===================================================== */}

      <div className="sidebar-logo">
        SYNCO
      </div>


      {/* =====================================================
          MAIN NAVIGATION
          ===================================================== */}

      <nav className="sidebar-nav">

        {navItems.map((item) => (

          <div
            key={item.label}
            className="sidebar-item-wrapper"

            onMouseEnter={() =>
              item.label === 'Play' &&
              setIsPlayHovered(true)
            }

            onMouseLeave={() =>
              item.label === 'Play' &&
              setIsPlayHovered(false)
            }
          >

            <NavLink
              to={item.path}

              className={({ isActive }) =>
                `sidebar-link ${isActive
                  ? 'sidebar-link-active'
                  : 'sidebar-link-inactive'
                }`
              }
            >

              <item.icon
                size={24}
                strokeWidth={1.5}
              />

              <span className="sidebar-link-text">
                {item.label}
              </span>

            </NavLink>


            {/* =================================================
                GAMES DROPDOWN
                ================================================= */}

            {item.label === 'Play' && (

              <GamesDropdown
                isVisible={isPlayHovered}
              />

            )}

          </div>

        ))}

      </nav>


      {/* =====================================================
          BOTTOM SECTION
          ===================================================== */}

      <div className="sidebar-bottom-section">


        {/* ===================================================
            NOTIFICATIONS
            =================================================== */}

        <NavLink
          to="/notifications"

          className={({ isActive }) =>
            `sidebar-link ${isActive
              ? 'sidebar-link-active'
              : 'sidebar-link-inactive'
            }`
          }
        >

          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >

            <Bell
              size={24}
              strokeWidth={1.5}
            />


            {/* =============================================
                UNREAD BADGE
                ============================================= */}

            {unreadCount > 0 && (

              <span
                style={{
                  position: 'absolute',
                  top: '-7px',
                  right: '-9px',
                  minWidth: '17px',
                  height: '17px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  background: '#000',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: '700',
                  lineHeight: '17px',
                  textAlign: 'center',
                  border: '2px solid #fff',
                  boxSizing: 'content-box'
                }}
              >

                {unreadCount > 99
                  ? '99+'
                  : unreadCount}

              </span>

            )}

          </div>


          <span className="sidebar-link-text">
            Notifications
          </span>

        </NavLink>


        {/* ===================================================
            REWARDS
            =================================================== */}

        <NavLink
          to="/rewards"

          className={({ isActive }) =>
            `sidebar-bottom-link ${isActive
              ? 'sidebar-bottom-link-active'
              : 'sidebar-bottom-link-inactive'
            }`
          }
        >

          <Gift
            size={24}
            strokeWidth={1.5}
          />

          <span className="sidebar-bottom-text">
            Rewards
          </span>

        </NavLink>


        {/* ===================================================
            PROFILE
            =================================================== */}

        <NavLink
          to={
            user?.username
              ? `/profile/${encodeURIComponent(user.username)}`
              : '/settings'
          }

          className="sidebar-profile-link"
        >

          <div className="sidebar-profile-avatar">

            {user?.avatar ? (

              <img
                src={user.avatar}
                alt="Profile"
              />

            ) : (

              <User size={18} />

            )}

          </div>


          <span className="sidebar-profile-name">

            {user?.username ||
              user?.name ||
              'Profile'}

          </span>

        </NavLink>

      </div>

    </aside>

  );

};


export default Sidebar;