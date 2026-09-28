import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

import rankBg from '../assets/rank-bg.png';
import profileBg from '../assets/pixel-landscape-bg.png';

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


  /*
    Special authenticated visual shells.
  */

  const isCompetitionPage =
    pathname === '/competitions';

  /*
    Support both:

      /leaderboards
      /leaderboards/

    so the Leaderboards shell is always activated.
  */

  const isLeaderboardsPage =
    pathname === '/ranking' ||
    pathname.startsWith('/leaderboards/');

  const isProfilePage =
    pathname === '//profile/:username' ||
    pathname.startsWith('//profile/:username/');


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
          ${
            isProfilePage
              ? 'hybrid-auth-container-profileview'
              : ''
          }
        `}
      >

        {/*
          Dedicated Leaderboards background layer.

          This is intentionally a real DOM element rather
          than another CSS background so the shared
          global-dash-bg cannot replace it.
        */}

        {isLeaderboardsPage && (

          <div
            className="leaderboards-shell-background"
            aria-hidden="true"
          >

            <img
              src={rankBg}
              alt=""
              className="leaderboards-shell-background-image"
              draggable="false"
            />

          </div>

        )}

        {isProfilePage && (

          <div
            className="profile-shell-background"
            aria-hidden="true"
          >

            <img
              src={profileBg}
              alt=""
              className="profile-shell-background-image"
              draggable="false"
            />

          </div>

        )}


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
             ${
            isProfilePage
              ? 'hybrid-auth-main-profileview'
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
               ${
                isProfilePage
                  ? 'hybrid-auth-content-profileview'
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
