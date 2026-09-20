import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import '../styles/components/HybridLayout.css';

const HybridLayout = () => {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const publicMainRef = useRef(null);

  useEffect(() => {
    publicMainRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }, [pathname]);

  /*
    Competition Engine gets its own full-viewport visual shell.

    The Sidebar remains fixed at 90px, but the Competition Engine
    background is allowed to continue underneath it.

    Only the Competition Engine itself receives this special
    layout treatment. Other authenticated pages remain unchanged.
  */
  const isCompetitionPage =
    pathname === '/competitions';

  if (isAuthenticated) {
    return (
      <div className="hybrid-auth-container">

        <Sidebar />

        <main
          className={`hybrid-auth-main ${
            isCompetitionPage
              ? 'hybrid-auth-main-competition'
              : ''
          }`}
        >

          <div
            className={`hybrid-auth-content ${
              isCompetitionPage
                ? 'hybrid-auth-content-competition'
                : ''
            }`}
          >
            <Outlet />
          </div>

        </main>

      </div>
    );
  }

  return (
    <div className="hybrid-public-container">

      <Navbar />

      <main
        ref={publicMainRef}
        className="hybrid-public-main"
      >

        <div className="hybrid-public-page-content">
          <Outlet />
        </div>

        <Footer />

      </main>

    </div>
  );
};

export default HybridLayout;