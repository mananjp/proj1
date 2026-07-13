import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const [theme, setTheme] = useState('white');

  useEffect(() => {
    // Apply the theme to the body background when it changes
    document.body.style.backgroundColor = theme;
    document.body.style.color = theme === 'white' ? '#1a73a9' : 'white';
  }, [theme]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Manan Panchal</Link>
      </div>
      <div className="navbar-links">
        <Link to="/contact">Contact</Link>
        <Link to="/media">Media</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/resume">Resume</Link>
        <Link to="/resources">Resources</Link>
        <button
          title="Theme"
          onClick={() => setTheme(theme === 'white' ? 'black' : 'white')}
          style={{ padding: '0.5rem', cursor: 'pointer' }}
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
