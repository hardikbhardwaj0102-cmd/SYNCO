import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Navigate,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import OrganizerRegister from "./pages/OrganizerRegister";
import HybridLayout from './components/HybridLayout';
import CreateCompetition from './pages/CreateCompetition';
import LandingPage from './pages/LandingPage';
import GamesHub from './pages/GamesHub';
import GameDetails from './pages/GameDetails';
import CompetitionEngine from './pages/CompetitionEngine';
import Leaderboards from './pages/Leaderboards';
import ClubsHub from './pages/ClubsHub';
import ClubProfile from './pages/clubprofile';
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
// SEARCH
// =========================================================

import Search from './components/Search';


// =========================================================
// DYNAMIC INDEX ROUTE
// =========================================================

const IndexRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  // Wait until authentication has been checked.
  if (loading) {
    return null;
  }

  return isAuthenticated
    ? <DashboardHome />
    : <LandingPage />;
};


// =========================================================
// PROTECTED ROUTE
// =========================================================
// Everything inside this route requires authentication.
//
// This prevents the deployed site from rendering the
// authenticated dashboard while the user is actually logged out.
// =========================================================

const ProtectedRoute = () => {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  // Do not render anything while /api/auth/me is being checked.
  if (loading) {
    return null;
  }

  // User is not logged in.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};


// =========================================================
// AUTH LAYOUT
// =========================================================
// Login / Register / Forgot Password / Reset Password
// have no Navbar, Sidebar or Footer.
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
              MAIN ROUTES
              ================================================= */}

          <Route element={<HybridLayout />}>

            {/* =================================================
                PUBLIC / DYNAMIC HOME
                ================================================= */}

            <Route
              path="/"
              element={<IndexRoute />}
            />


            {/* =================================================
                PROTECTED ROUTES
                ================================================= */}

            <Route element={<ProtectedRoute />}>


              {/* -------------------------------------------------
                  SEARCH
                  ------------------------------------------------- */}

              <Route
                path="/search"
                element={<Search />}
              />


              {/* -------------------------------------------------
                  DASHBOARD
                  ------------------------------------------------- */}

              <Route
                path="/home"
                element={<DashboardHome />}
              />


              {/* -------------------------------------------------
                  GAMING
                  ------------------------------------------------- */}

              <Route
                path="/play"
                element={<GamesHub />}
              />

              <Route
                path="/games/:gameId"
                element={<GameDetails />}
              />


              {/* -------------------------------------------------
                  COMPETITIONS
                  ------------------------------------------------- */}

              <Route
                path="/competitions"
                element={<CompetitionEngine />}
              />


              {/* -------------------------------------------------
                  RANKINGS
                  ------------------------------------------------- */}

              <Route
                path="/ranking"
                element={<Leaderboards />}
              />


              {/* -------------------------------------------------
                  CLUBS
                  ------------------------------------------------- */}

              <Route
                path="/clubs"
                element={<ClubsHub />}
              />

              <Route
                path="/clubs/:clubId"
                element={<ClubProfile />}
              />


              {/* -------------------------------------------------
                  REWARDS
                  ------------------------------------------------- */}

              <Route
                path="/rewards"
                element={<Reward />}
              />


              {/* -------------------------------------------------
                  FRIENDS
                  ------------------------------------------------- */}

              <Route
                path="/add-friends"
                element={<AddFriends />}
              />


              {/* -------------------------------------------------
                  NOTIFICATIONS
                  ------------------------------------------------- */}

              <Route
                path="/notifications"
                element={<Notification />}
              />


              {/* -------------------------------------------------
                  PROFILE
                  ------------------------------------------------- */}

              <Route
                path="/profile/:username"
                element={<ProfileView />}
              />

              <Route
                path="/settings"
                element={<ProfileSettings />}
              />
              <Route
                path="/organizer/register"
                element={<OrganizerRegister />}
              />


              {/* -------------------------------------------------
                  REGISTRATION GATEWAY
                  ------------------------------------------------- */}

              <Route
                path="/gateway"
                element={<RegistrationGateway />}
              />

            </Route>
            <Route
              path="/competitions/create"
              element={<CreateCompetition />}
            />

          </Route>



          {/* =================================================
              FALLBACK
              ================================================= */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>

      </Router>

    </AuthProvider>
  );
}


export default App;