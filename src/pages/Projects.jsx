import React, { useState, useEffect } from 'react';
import './Projects.css';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://api.github.com/users/mananjp/repos');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Sort by update time
        const sortedData = data.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        setProjects(sortedData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <div className="page-container projects-page">
      <div className="projects-header">
        <h1>My Projects</h1>
        <p>A collection of my open-source work and personal projects.</p>
      </div>

      <div className="search-container">
        <input 
          type="text" 
          className="search-input" 
          placeholder="Search projects by name, description, or language..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Fetching repositories...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p>Oops! Failed to load projects.</p>
          <p className="error-message">{error}</p>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="empty-state">
          <p>No projects found for this user.</p>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          {(() => {
            const filteredProjects = projects.filter(project => 
              project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (project.language && project.language.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            if (filteredProjects.length === 0) {
              return (
                <div className="empty-state">
                  <p>No projects match your search.</p>
                </div>
              );
            }

            return (
              <div className="projects-grid">
                {filteredProjects.map((project) => (
                  <a 
                    href={project.html_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="project-card" 
                    key={project.id}
                  >
                    <div className="project-card-inner">
                      <h3 className="project-title">{project.name}</h3>
                      <p className="project-desc">
                        {project.description || 'No description available for this repository.'}
                      </p>
                      <div className="project-meta">
                        {project.language && (
                          <span className="project-lang">
                            <span className="lang-dot"></span> {project.language}
                          </span>
                        )}
                        <span className="project-stars">
                          ⭐ {project.stargazers_count}
                        </span>
                        <span className="project-forks">
                          🍴 {project.forks_count}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};

export default Projects;
