import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_URLS } from '../config';
import './Auth.css';

const Auth = () => {
  // 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (authMode === 'forgot') {
      try {
        const res = await fetch(`${API_URLS.auth}/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });

        const data = await res.json();

        if (data.success) {
          setSuccessMsg(data.message || 'Password reset link sent to your email.');
        } else {
          setError(data.message || 'Failed to send reset link.');
        }
      } catch {
        setError('Unable to connect to the server.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const url = authMode === 'login' 
      ? `${API_URLS.auth}/login` 
      : `${API_URLS.auth}/register`;
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authMode === 'login' 
          ? { email: formData.email, password: formData.password } 
          : formData
        ),
      });

      const data = await res.json();

      if (data.success) {
        login(data.data); // data.data contains the user object and token
        navigate('/tasks');
      } else {
        if (data.errors) {
          setError(data.errors.join(', '));
        } else {
          setError(data.message || 'Authentication failed');
        }
      }
    } catch {
      setError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (email, password) => {
    setFormData({ ...formData, email, password });
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">
          {authMode === 'login' && 'Welcome Back'}
          {authMode === 'register' && 'Create Account'}
          {authMode === 'forgot' && 'Reset Password'}
        </h2>
        
        <p className="auth-subtitle">
          {authMode === 'login' && 'Log in to manage your tasks on the Kanban board.'}
          {authMode === 'register' && 'Sign up to get started with your tasks.'}
          {authMode === 'forgot' && "Enter your email address and we'll send you a password reset link."}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {successMsg && <div className="auth-success">{successMsg}</div>}

        {authMode === 'login' && (
          <div className="demo-credentials-box">
            <div className="demo-header">
              <span>⚡ Quick Demo Credentials</span>
            </div>
            <div className="demo-buttons">
              <button
                type="button"
                className="demo-pill admin-pill"
                onClick={() => fillCredentials('24aiml024@charusat.edu.in', 'Admin@12345')}
                title="Admin with Email Notification Privileges"
              >
                🛡️ Admin: 24aiml024@charusat.edu.in
              </button>
              <button
                type="button"
                className="demo-pill user-pill"
                onClick={() => fillCredentials('demo@example.com', 'password123')}
                title="Team Member Demo User"
              >
                👤 User: demo@example.com
              </button>
            </div>
            <div className="demo-hint">
              Password: <code>Admin@12345</code> or <code>password123</code>
            </div>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="auth-form">
          {authMode === 'register' && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Doe"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
            />
          </div>

          {authMode !== 'forgot' && (
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="password">Password</label>
                {authMode === 'login' && (
                  <span
                    className="forgot-password-link"
                    onClick={() => {
                      setAuthMode('forgot');
                      setError('');
                      setSuccessMsg('');
                    }}
                  >
                    Forgot password?
                  </span>
                )}
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading 
              ? 'Please wait...' 
              : authMode === 'login' 
                ? 'Log In' 
                : authMode === 'register' 
                  ? 'Sign Up' 
                  : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-switch">
          {authMode === 'login' && (
            <p>
              Don't have an account?{' '}
              <span
                className="auth-switch-link"
                onClick={() => {
                  setAuthMode('register');
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Sign up
              </span>
            </p>
          )}

          {authMode === 'register' && (
            <p>
              Already have an account?{' '}
              <span
                className="auth-switch-link"
                onClick={() => {
                  setAuthMode('login');
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Log in
              </span>
            </p>
          )}

          {authMode === 'forgot' && (
            <p>
              Remembered your password?{' '}
              <span
                className="auth-switch-link"
                onClick={() => {
                  setAuthMode('login');
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Back to log in
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
