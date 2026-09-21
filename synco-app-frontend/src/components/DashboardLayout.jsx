import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../styles/components/DashboardLayout.css';

const Layout = () => {
  const location = useLocation();

  const isCompetitionPage =
    location.pathname.startsWith('/competitions');

  return (
    <div
      className={`layout-container ${
        isCompetitionPage
          ? 'layout-container-competition'
          : ''
      }`}
    >

      {isCompetitionPage && (
        <div
          className="
            global-page-background
            global-competition-background
          "
          aria-hidden="true"
        />
      )}

      <Sidebar />

      <main className="layout-main">
        <div className="layout-content-wrapper">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;