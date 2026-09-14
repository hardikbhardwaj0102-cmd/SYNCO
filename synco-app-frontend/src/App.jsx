import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';

import HybridLayout from './components/HybridLayout';

import LandingPage from './pages/LandingPage';
import GamesHub from './pages/GamesHub';
import GameDetails from './pages/GameDetails';
import CompetitionEngine from './pages/CompetitionEngine';
import Leaderboards from './pages/Leaderboards';
import ClubsHub from './pages/ClubsHub';
import ClubProfile from "./pages/clubprofile";
import ProfileSettings from './pages/ProfileSettings';
import ProfileView from './pages/ProfileView';
import RegistrationGateway from './pages/RegistrationGateway';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPass from './pages/ForgotPass';
import ResetPassword from './pages/ResetPassword';

import DashboardHome from './pages/DashboardHome';
import Reward from './pages/Reward';
import AddFriends from './pages/AddFriends';
import Notification from './pages/notification';


// =========================================================
// DYNAMIC INDEX ROUTE
// =========================================================

const IndexRoute = () => {

  const { isAuthenticated } = useAuth();

  return isAuthenticated
    ? <DashboardHome />
    : <LandingPage />;
};


// =========================================================
// AUTH LAYOUT
// No Navbar / Sidebar / Footer
// =========================================================

const AuthLayout = () => {
  return <Outlet />;
};


// =========================================================
// APP
// =========================================================

function App() {

  return (

    <AuthProvider>

      <Router>

        <Routes>

          {/* =================================================
              AUTH ROUTES
              ================================================= */}

          <Route element={<AuthLayout />}>

            <Route
              path="/login"
              element={<Login />}
            />

            <Route
              path="/register"
              element={<Register />}
            />

            <Route
              path="/forgotpass"
              element={<ForgotPass />}
            />

            <Route
              path="/resetpass/:token"
              element={<ResetPassword />}
            />

          </Route>


          {/* =================================================
              MAIN DASHBOARD ROUTES
              Wrapped inside HybridLayout
              ================================================= */}

          <Route element={<HybridLayout />}>

            {/* =================================================
                HOME
                ================================================= */}

            <Route
              path="/"
              element={<IndexRoute />}
            />

            <Route
              path="/home"
              element={<DashboardHome />}
            />


            {/* =================================================
                GAMING
                ================================================= */}

            <Route
              path="/play"
              element={<GamesHub />}
            />

            <Route
              path="/games/:gameId"
              element={<GameDetails />}
            />


            {/* =================================================
                COMPETITIONS
                ================================================= */}

            <Route
              path="/competitions"
              element={<CompetitionEngine />}
            />


            {/* =================================================
                RANKINGS
                ================================================= */}

            <Route
              path="/ranking"
              element={<Leaderboards />}
            />


            {/* =================================================
                CLUBS
                ================================================= */}

            <Route
              path="/clubs"
              element={<ClubsHub />}
            />

            <Route
              path="/clubs/:clubId"
              element={<ClubProfile />}
            />


            {/* =================================================
                REWARDS
                ================================================= */}

            <Route
              path="/rewards"
              element={<Reward />}
            />


            {/* =================================================
                FRIENDS
                ================================================= */}

            <Route
              path="/add-friends"
              element={<AddFriends />}
            />


            {/* =================================================
                NOTIFICATIONS
                ================================================= */}

            <Route
              path="/notifications"
              element={<Notification />}
            />


            {/* =================================================
                PROFILE
                ================================================= */}

            <Route
              path="/profile/:username"
              element={<ProfileView />}
            />

            <Route
              path="/settings"
              element={<ProfileSettings />}
            />


            {/* =================================================
                REGISTRATION GATEWAY
                ================================================= */}

            <Route
              path="/gateway"
              element={<RegistrationGateway />}
            />

          </Route>

        </Routes>

      </Router>

    </AuthProvider>
  );
}


export default App;