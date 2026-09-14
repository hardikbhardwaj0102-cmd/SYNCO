import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../styles/components/DashboardLayout.css';

const Layout = () => {
  return (
    <div className="layout-container">
      {/* Fixed Navigation Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="layout-main">
        {/* Top header spacing if needed, otherwise content flows naturally */}
        <div className="layout-content-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;