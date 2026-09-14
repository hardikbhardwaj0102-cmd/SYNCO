import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import backgroundImage from '../assets/background.png';
import '../styles/pages/Auth.css';

const API_URL = import.meta.env.VITE_API_URL;

const ForgotPass = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to send reset link.');
      }

      setSent(true);
    } catch (err) {
      console.error('Forgot Password Error:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page-wrapper"
      style={{
        backgroundImage: `url(${backgroundImage})`,
      }}
    >
      <div className="auth-card-container">
        <div className="auth-card-split">

          {/* LEFT PANEL */}
          <div className="auth-left-panel">
            <div className="flex flex-col justify-center flex-1">
              <p className="auth-brand-label">SYNCO</p>
              <h1 className="auth-left-title">
                Reset.<br />
                Recover.<br />
                <span className="auth-title-highlight">Get back in.</span>
              </h1>
              <p className="auth-left-desc">
                Don't worry. We'll help you get back to your competitive gaming journey.
              </p>
            </div>
            <div className="auth-left-footer">
              <p className="auth-left-footer-text">
                Competitive gaming platform
              </p>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="auth-right-panel">

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="auth-back-btn"
            >
              <ArrowLeft size={15} /> Back
            </button>

            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="mb-7">
                  <p className="auth-header-label">Account recovery</p>
                  <h2 className="auth-right-title">Forgot Password?</h2>
                  <p className="auth-right-desc-wide">
                    Enter the email associated with your SYNCO account and we'll send you a password reset link.
                  </p>
                </div>

                <div>
                  <label className="auth-input-label">Email</label>
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="auth-input-field"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    required
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p className="auth-error-msg">{error}</p>
                )}

                <button
                  type="submit"
                  className="auth-submit-btn-split"
                  disabled={loading}
                >
                  <span className="relative z-10">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="auth-register-btn"
                >
                  Back to Login
                </button>
              </form>
            ) : (
              <div>
                <div className="auth-success-icon-wrap">
                  <div className="auth-success-icon-circle">
                    <CheckCircle size={38} className="auth-success-icon" />
                  </div>
                </div>

                <div className="auth-text-center">
                  <p className="auth-header-label">Reset link sent</p>
                  <h2 className="auth-right-title">Check Your Email</h2>
                  <p className="auth-success-desc">
                    We've sent a password reset link to
                  </p>
                  <p className="auth-success-email">{email}</p>
                  <p className="auth-success-desc-alt">
                    Click the link in the email to create a new password.
                  </p>
                </div>

                <button
                  type="button"
                  className="auth-btn-primary-spaced"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </button>

                <button
                  type="button"
                  className="auth-btn-secondary"
                  onClick={() => {
                    setSent(false);
                    setEmail('');
                    setError('');
                  }}
                >
                  Use Another Email
                </button>
              </div>
            )}

            <div className="auth-right-footer">
              <p className="auth-right-footer-text">
                Secure account recovery • SYNCO
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPass;