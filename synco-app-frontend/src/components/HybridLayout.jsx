import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import '../styles/components/HybridLayout.css';

const HybridLayout = () => {
  const { isAuthenticated } = useAuth(); // Pull real state from context
  const { pathname } = useLocation();
  const publicMainRef = useRef(null);

  useEffect(() => {
    publicMainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  if (isAuthenticated) {
    return (
      <div className="hybrid-auth-container">
        <Sidebar />
        <main className="hybrid-auth-main">
          <div className="hybrid-auth-content">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="hybrid-public-container">
      <Navbar />
      <main ref={publicMainRef} className="hybrid-public-main">
        <div className="hybrid-public-page-content">
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default HybridLayout;