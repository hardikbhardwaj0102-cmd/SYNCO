import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

import rankBg from '../assets/rank-bg.png';

import '../styles/components/HybridLayout.css';


const HybridLayout = () => {

  const { isAuthenticated } =
    useAuth();

  const { pathname } =
    useLocation();

  const publicMainRef =
    useRef(null);


  useEffect(() => {

    publicMainRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });

  }, [pathname]);


  const isCompetitionPage =
    pathname === '/competitions';

  const isLeaderboardsPage =
    pathname === '/leaderboards';


  if (isAuthenticated) {

    return (

      <div
        className={`
          hybrid-auth-container
          ${
            isCompetitionPage
              ? 'hybrid-auth-container-competition'
              : ''
          }
          ${
            isLeaderboardsPage
              ? 'hybrid-auth-container-leaderboards'
              : ''
          }
        `}
        style={
          isLeaderboardsPage
            ? {
                backgroundImage:
                  `url(${rankBg})`,
                backgroundPosition:
                  'center top',
                backgroundSize:
                  'cover',
                backgroundRepeat:
                  'no-repeat',
              }
            : undefined
        }
      >

        <Sidebar />


        <main
          className={`
            hybrid-auth-main
            ${
              isCompetitionPage
                ? 'hybrid-auth-main-competition'
                : ''
            }
            ${
              isLeaderboardsPage
                ? 'hybrid-auth-main-leaderboards'
                : ''
            }
          `}
        >

          <div
            className={`
              hybrid-auth-content
              ${
                isCompetitionPage
                  ? 'hybrid-auth-content-competition'
                  : ''
              }
              ${
                isLeaderboardsPage
                  ? 'hybrid-auth-content-leaderboards'
                  : ''
              }
            `}
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
