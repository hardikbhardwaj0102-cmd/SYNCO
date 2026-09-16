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
          TOP LOGO BUBBLE
          ===================================================== */}
      <div className="sidebar-logo-bubble">
        <span style={{ fontFamily: 'Super Brigade, sans-serif', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
          SYN
        </span>
      </div>

      {/* =====================================================
          MAIN NAVIGATION PILL
          ===================================================== */}
      <div className="sidebar-main-pill">
        
        <div className="sidebar-nav-top">
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
                  `sidebar-link ${
                    isActive ? 'sidebar-link-active' : ''
                  }`
                }
              >
                <item.icon
                  size={20}
                  strokeWidth={1.5}
                />
                
                {/* Tooltip on Hover matching your CSS */}
                <span className="sidebar-tooltip">
                  {item.label}
                </span>
              </NavLink>

              {/* =================================================
                  GAMES DROPDOWN
                  ================================================= */}
              {item.label === 'Play' && (
                <div className="sidebar-submenu" style={{ opacity: isPlayHovered ? 1 : 0, visibility: isPlayHovered ? 'visible' : 'hidden' }}>
                  <GamesDropdown
                    isVisible={isPlayHovered}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* =====================================================
            BOTTOM NAVIGATION SECTION
            ===================================================== */}
        <div className="sidebar-nav-bottom">

          {/* ===================================================
              NOTIFICATIONS
              ================================================== */}
          <div className="sidebar-item-wrapper">
            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `sidebar-link ${
                  isActive ? 'sidebar-link-active' : ''
                }`
              }
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} strokeWidth={1.5} />

                {/* =============================================
                    UNREAD BADGE
                    ============================================= */}
                {unreadCount > 0 && (
                  <span className="sidebar-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>

              <span className="sidebar-tooltip">
                Notifications
              </span>
            </NavLink>
          </div>

          {/* ===================================================
              REWARDS
              ================================================== */}
          <div className="sidebar-item-wrapper">
            <NavLink
              to="/rewards"
              className={({ isActive }) =>
                `sidebar-link ${
                  isActive ? 'sidebar-link-active' : ''
                }`
              }
            >
              <Gift size={20} strokeWidth={1.5} />
              <span className="sidebar-tooltip">
                Rewards
              </span>
            </NavLink>
          </div>

          {/* ===================================================
              PROFILE
              ================================================== */}
          <div className="sidebar-item-wrapper">
            <NavLink
              to={
                user?.username
                  ? `/profile/${encodeURIComponent(user.username)}`
                  : '/settings'
              }
              className={({ isActive }) =>
                `sidebar-link ${
                  isActive ? 'sidebar-link-active' : ''
                }`
              }
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  className="sidebar-avatar"
                />
              ) : (
                <div className="sidebar-profile-fallback">
                  <User size={20} />
                </div>
              )}

              <span className="sidebar-tooltip">
                {user?.username || user?.name || 'Profile'}
              </span>
            </NavLink>
          </div>

        </div>

      </div>

    </aside>
  );
};

export default Sidebar;