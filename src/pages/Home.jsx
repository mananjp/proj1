import React from 'react';

const Home = () => {
  return (
    <div className="home-container">
      <div className="hero-section">
        <div className="hero-left">
          <div className="arched-container">
            <span className="arched-text">manan panchal</span>
          </div>
        </div>
        <div className="hero-right">
          <h1>
            Aspring AI engineer, Student of Charusat
          </h1>
        </div>
      </div>

      <div className="intro-section">
        <div className="intro-label">
          <hr className="intro-line" />
          <span>Intro</span>
        </div>
        <div className="intro-content">
          <p>
            Skills: Sklearn, LLM integration, RAG, Python, FastAPI, Django.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
