import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaDiscord } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import backgroundImage from '../assets/background.png';
import '../styles/pages/Auth.css';

const API_URL = import.meta.env.VITE_API_URL;

const Login = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loggingIn, setLoggingIn] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // =========================================================
  // GOOGLE LOGIN
  // =========================================================

  const handleGoogleLogin = () => {
    if (!API_URL) {
      setError('Authentication service is not configured.');
      return;
    }

    window.location.href =
      `${API_URL}/api/auth/google`;
  };

  // =========================================================
  // DISCORD LOGIN
  // =========================================================

  const handleDiscordLogin = () => {
    if (!API_URL) {
      setError('Authentication service is not configured.');
      return;
    }

    window.location.href =
      `${API_URL}/api/auth/discord`;
  };

  // =========================================================
  // EMAIL LOGIN
  // =========================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setError('');
    setMessage('');

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!email.trim()) {
      setError(
        'Please enter your email address.'
      );
      return;
    }

    if (!password) {
      setError(
        'Please enter your password.'
      );
      return;
    }

    if (!API_URL) {
      setError(
        'Authentication service is not configured.'
      );
      return;
    }

    setLoggingIn(true);

    try {
      // -----------------------------------------------------
      // LOGIN REQUEST
      // -----------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },

          credentials: 'include',

          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      );

      // -----------------------------------------------------
      // RESPONSE
      // -----------------------------------------------------

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          'Invalid email or password.'
        );
      }

      // -----------------------------------------------------
      // VERIFY THE SESSION
      // -----------------------------------------------------

      const authenticated = await checkAuth();

      if (!authenticated) {
        throw new Error(
          'Login succeeded, but your session could not be verified. Please try again.'
        );
      }

      // -----------------------------------------------------
      // SUCCESS
      // -----------------------------------------------------

      setMessage(
        'Login successful! Redirecting...'
      );

      setTimeout(() => {
        navigate('/home', {
          replace: true,
        });
      }, 500);

    } catch (err) {
      console.error(
        'Login Error:',
        err
      );

      setError(
        err.message ||
        'Unable to login.'
      );

    } finally {
      setLoggingIn(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      className="auth-page-wrapper"
      style={{
        backgroundImage:
          `url(${backgroundImage})`,
      }}
    >

      <div className="auth-card-container">

        <div className="auth-card-split">

          {/* =================================================
              LEFT PANEL
              ================================================= */}

          <div className="auth-left-panel">

            <div className="flex flex-col justify-center flex-1">

              <span className="auth-brand-label">
                SYNCO
              </span>

              <h1 className="auth-left-title">
                Play.
                <br />
                Compete.
                <br />

                <span className="auth-title-highlight">
                  Prove yourself.
                </span>
              </h1>

              <p className="auth-left-desc">
                Your competitive gaming journey starts here.
              </p>

            </div>

            <div className="auth-left-footer">

              <p className="auth-left-footer-text">
                Competitive gaming platform
              </p>

            </div>

          </div>


          {/* =================================================
              RIGHT PANEL
              ================================================= */}

          <div className="auth-right-panel">

            {/* BACK */}

            <button
              type="button"
              onClick={() => navigate('/')}
              className="auth-back-btn"
            >
              <ArrowLeft size={15} />
              Back
            </button>


            {/* HEADER */}

            <div>

              <span className="auth-header-label">
                Account access
              </span>

              <h2 className="auth-right-title">
                Welcome Back
              </h2>

              <p className="auth-right-desc">
                Log in to access your dashboard.
              </p>

            </div>


            {/* =================================================
                SOCIAL LOGIN
                ================================================= */}

            <div className="auth-sso-grid">

              {/* GOOGLE */}

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="auth-sso-google"
              >

                <FcGoogle size={19} />

                <span>
                  Google
                </span>

              </button>


              {/* DISCORD */}

              <button
                type="button"
                onClick={handleDiscordLogin}
                className="auth-sso-discord"
              >

                <FaDiscord
                  size={19}
                  className="text-white"
                />

                <span>
                  Discord
                </span>

              </button>

            </div>


            {/* =================================================
                DIVIDER
                ================================================= */}

            <div className="auth-divider-wrap">

              <div className="auth-divider-line"></div>

              <span className="auth-divider-text">
                or continue with email
              </span>

              <div className="auth-divider-line"></div>

            </div>


            {/* =================================================
                EMAIL FORM
                ================================================= */}

            <form
              onSubmit={handleLogin}
              className="auth-form-split"
            >

              {/* EMAIL */}

              <div>

                <label className="auth-input-label">
                  Email
                </label>

                <input
                  type="email"
                  placeholder="Your email address"
                  className="auth-input-field"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                    setMessage('');
                  }}
                  autoComplete="email"
                  required
                />

              </div>


              {/* PASSWORD */}

              <div>

                <div className="auth-input-label-row">

                  <label className="auth-input-label !mb-0">
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      navigate('/forgotpass')
                    }
                    className="auth-forgot-btn"
                  >
                    Forgot password?
                  </button>

                </div>

                <input
                  type="password"
                  placeholder="Your password"
                  className="auth-input-field"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    setMessage('');
                  }}
                  autoComplete="current-password"
                  required
                />

              </div>


              {/* =================================================
                  MESSAGES
                  ================================================= */}

              {message && (
                <p className="auth-success-msg">
                  {message}
                </p>
              )}

              {error && (
                <p className="auth-error-msg">
                  {error}
                </p>
              )}


              {/* =================================================
                  LOGIN BUTTON
                  ================================================= */}

              <button
                type="submit"
                disabled={loggingIn}
                className="auth-submit-btn-split group"
              >

                <span className="relative z-10">

                  {loggingIn
                    ? 'Logging in...'
                    : 'Login'}

                </span>

              </button>


              {/* =================================================
                  REGISTER
                  ================================================= */}

              <button
                type="button"
                onClick={() =>
                  navigate('/register')
                }
                className="auth-register-btn"
              >

                Don't have an account?

                <span className="auth-register-highlight">
                  Create a Free SYNCO Account
                </span>

              </button>

            </form>


            {/* =================================================
                FOOTER
                ================================================= */}

            <div className="auth-right-footer">

              <p className="auth-right-footer-text">
                Secure authentication • SYNCO
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Login;