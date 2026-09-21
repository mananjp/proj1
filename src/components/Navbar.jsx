import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const [theme, setTheme] = useState('white');
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Apply the theme to the body background when it changes
    document.body.style.backgroundColor = theme;
    document.body.style.color = theme === 'white' ? '#1a73a9' : 'white';
  }, [theme]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Manan Panchal</Link>
      </div>
      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/tasks">Tasks</Link>
            <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>Hi, {user.name}</span>
            <button
              onClick={handleLogout}
              style={{
                marginLeft: '10px',
                padding: '0.4rem 0.8rem',
                cursor: 'pointer',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/auth" style={{ fontWeight: 'bold' }}>Login</Link>
        )}
        <Link to="/contact">Contact</Link>
        <Link to="/media">Media</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/resume">Resume</Link>
        <Link to="/resources">Resources</Link>
        <button
          title="Theme"
          onClick={() => setTheme(theme === 'white' ? 'black' : 'white')}
          style={{ padding: '0.5rem', cursor: 'pointer', marginLeft: '10px' }}
        >
          Toggle Theme
        </button>
        <div className="social-icons">
          <a href="#" aria-label="Email">Email</a>
          <a href="#" aria-label="Twitter">Twitter</a>
          <a href="#" aria-label="LinkedIn">LinkedIn</a>
          <a href="#" aria-label="GitHub">GitHub</a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
