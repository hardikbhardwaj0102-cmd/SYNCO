import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import backgroundImage from '../assets/background.png';
import '../styles/pages/Auth.css';

const API_URL = 'http://127.0.0.1:5000';

const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [registering, setRegistering] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setMessage('');
    setSendingOTP(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }

      setOtpSent(true);
      setOtpVerified(false);
      setOtp('');
      setMessage('OTP sent successfully. Check your email.');
    } catch (err) {
      console.error('Send OTP Error:', err);
      setError(err.message || 'Unable to send OTP.');
    } finally {
      setSendingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setError('');
    setMessage('');
    setVerifyingOTP(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid OTP.');
      }

      setOtpVerified(true);
      setMessage('Email verified successfully.');
    } catch (err) {
      console.error('Verify OTP Error:', err);
      setError(err.message || 'OTP verification failed.');
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your email before creating your account.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setRegistering(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      setMessage('Account created successfully! Redirecting to login...');

      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (err) {
      console.error('Registration Error:', err);
      setError(err.message || 'Unable to create your account.');
    } finally {
      setRegistering(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setOtpSent(false);
    setOtpVerified(false);
    setOtp('');
    setMessage('');
    setError('');
  };

  return (
    <div
      className="auth-page-wrapper"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="auth-card-container !max-w-[980px]">
        <div className="auth-card-split-reg">
          
          {/* LEFT PANEL */}
          <div className="auth-left-panel !min-h-[650px]">
            <div className="flex flex-col justify-center flex-1">
              <span className="auth-brand-label">SYNCO</span>
              <h1 className="auth-left-title">
                Build.<br />
                Compete.<br />
                <span className="auth-title-highlight">Belong.</span>
              </h1>
              <p className="auth-left-desc !max-w-[270px]">
                Create your account and enter the competitive arena.
              </p>
            </div>
            <div className="auth-left-footer">
              <p className="auth-left-footer-text">Competitive gaming platform</p>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="auth-right-panel">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="auth-back-btn !mb-7"
            >
              <ArrowLeft size={15} /> Login
            </button>

            <div className="mb-7">
              <span className="auth-header-label">Account registration</span>
              <h2 className="auth-right-title">Create Account</h2>
              <p className="auth-right-desc !mb-0">Join SYNCO and start competing.</p>
            </div>

            <form onSubmit={handleRegister} className="auth-form-split">
              
              <div>
                <label className="auth-input-label">Full Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  className="auth-input-field"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  required
                />
              </div>

              <div>
                <label className="auth-input-label">Email</label>
                <div className="auth-input-wrapper">
                  <input
                    type="email"
                    placeholder="Email address"
                    className="auth-input-field-padded"
                    value={email}
                    onChange={handleEmailChange}
                    disabled={otpVerified}
                    required
                  />
                  {!otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      className="auth-inline-btn"
                      disabled={sendingOTP}
                    >
                      {sendingOTP ? 'Sending...' : 'Send OTP'}
                    </button>
                  )}
                </div>
              </div>

              {otpSent && !otpVerified && (
                <div>
                  <label className="auth-input-label">Verification Code</label>
                  <div className="auth-input-wrapper">
                    <input
                      type="text"
                      placeholder="6-digit OTP"
                      className="auth-input-field-otp"
                      value={otp}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtp(value);
                        setError('');
                      }}
                      maxLength={6}
                      inputMode="numeric"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      className="auth-inline-btn"
                      disabled={verifyingOTP || otp.length !== 6}
                    >
                      {verifyingOTP ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              )}

              {otpVerified && (
                <div className="auth-verified-box">
                  <CheckCircle2 size={16} /> Email verified
                </div>
              )}

              <div>
                <label className="auth-input-label">Password</label>
                <input
                  type="password"
                  placeholder="Create a password"
                  className="auth-input-field"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                />
              </div>

              <div>
                <label className="auth-input-label">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  className="auth-input-field"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  required
                />
              </div>

              {message && <p className="auth-success-msg">{message}</p>}
              {error && <p className="auth-error-msg">{error}</p>}

              <button
                type="submit"
                className="auth-submit-btn-split"
                disabled={!otpVerified || registering}
              >
                <span className="relative z-10">
                  {registering ? 'Creating Account...' : 'Register Account'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="auth-register-btn"
              >
                Already have an account?
                <span className="auth-register-highlight">Login</span>
              </button>

            </form>

            <div className="auth-right-footer !mt-7">
              <p className="auth-right-footer-text">Secure registration • SYNCO</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;