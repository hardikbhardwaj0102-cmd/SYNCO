import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import backgroundImage from '../assets/background.png';
import '../styles/pages/Auth.css';

const API_URL = import.meta.env.VITE_API_URL;

const ResetPassword = () => {
  const navigate = useNavigate();
  const { token } = useParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset link.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to reset password.');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Reset Password Error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
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
                Secure.<br />
                Update.<br />
                <span className="auth-title-highlight">Play on.</span>
              </h1>
              <p className="auth-left-desc">
                Set a new password and get back into the arena.
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

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-5">

                <div className="mb-7">
                  <p className="auth-header-label">Account security</p>
                  <h2 className="auth-right-title">Create New Password</h2>
                  <p className="auth-right-desc-wide">
                    Enter a new password for your SYNCO account.
                  </p>
                </div>

                <div>
                  <label className="auth-input-label">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    className="auth-input-field"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <label className="auth-input-label">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="auth-input-field"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    autoComplete="new-password"
                    required
                  />
                  <p className="auth-input-hint">
                    Password must contain at least 8 characters.
                  </p>
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
                    {loading ? 'Updating...' : 'Reset Password'}
                  </span>
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
                  <p className="auth-header-label">Security update</p>
                  <h2 className="auth-right-title">Password Updated</h2>
                  <p className="auth-success-desc">
                    Your SYNCO password has been successfully changed.
                  </p>
                  <p className="auth-success-desc-alt">
                    You can now log in using your new password.
                  </p>
                </div>

                <button
                  type="button"
                  className="auth-btn-primary-spaced"
                  onClick={() => navigate('/login')}
                >
                  Continue to Login
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

export default ResetPassword;