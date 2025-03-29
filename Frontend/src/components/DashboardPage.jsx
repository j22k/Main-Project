import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';

const DashboardPage = () => {
  const [userData, setUserData] = useState({
    username: '',
    learningProgress: [],
    lastSession: null,
    stats: {
      completedModules: 0,
      totalModules: 0,
      averageScore: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isDiagnosed, setIsDiagnosed] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    const diagnosed = localStorage.getItem('isDiagnosed') === 'true';
    setIsDiagnosed(diagnosed);

    // Simulated API call
    setTimeout(() => {
      setUserData({
        username: 'User123',
        learningProgress: [
          { module: 'Introduction', completed: true, score: 85 },
          { module: 'Basic Concepts', completed: false, score: 0 },
          { module: 'Advanced Topics', completed: false, score: 0 },
          { module: 'Practical Applications', completed: false, score: 0 }
        ],
        lastSession: '2025-03-25T14:30:00',
        stats: {
          completedModules: 1,
          totalModules: 4,
          averageScore: 85
        }
      });
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const handleStartAssessment = () => {
    navigate('/assessment');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
      </div>
    );
  }

  const progressPercentage = (userData.stats.completedModules / userData.stats.totalModules) * 100;

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-container">
              <div className="logo-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h1 className="site-title">AI Learning Assistant</h1>
            </div>
            <div className="header-actions">
              <button onClick={toggleDarkMode} className="dark-mode-toggle">
                {darkMode ? '🌞' : '🌙'}
              </button>
              <button onClick={() => navigate('/profile')} className="btn btn-secondary">
                Profile
              </button>
              <button onClick={handleLogout} className="btn btn-danger">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          <div className="welcome-card">
            <div className="welcome-content">
              <div>
                <h2 className="welcome-title">Welcome back, {userData.username}!</h2>
                {userData.lastSession && (
                  <p className="last-session">
                    Last session: {new Date(userData.lastSession).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="welcome-action">
                {/* <button onClick={handleStartAssessment} className="btn btn-primary">
                  {isDiagnosed ? 'Continue Learning' : 'Start Initial Assessment'}
                </button> */}
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            {isDiagnosed ? (
              <>
                <div className="dashboard-card">
                  <h3 className="card-title">Learning Progress</h3>
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
                  </div>
                  <p className="progress-text">
                    {userData.stats.completedModules} of {userData.stats.totalModules} modules completed
                  </p>
                  <div className="score-container">
                    <div className="score-box">
                      <span className="score-value">{userData.stats.averageScore}%</span>
                      <span className="score-label">Average Score</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-card">
                  <h3 className="card-title">Your Modules</h3>
                  <div className="module-list">
                    {userData.learningProgress.map((item, index) => (
                      <div key={index} className={`module-item ${item.completed ? 'completed' : ''}`}>
                        <div className="module-status">
                          {item.completed ? '✔' : '◯'} {item.module}
                        </div>
                        {item.completed ? (
                          <span className="score-badge">{item.score}%</span>
                        ) : (
                          <span className="pending-badge">Pending</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dashboard-card">
                  <h3 className="card-title">Next Steps</h3>
                  <div className="action-card">
                    <h4 className="action-title">Keep up the good work!</h4>
                    <p className="action-description">
                      Continue with your next module or retake previous assessments.
                    </p>
                    <button onClick={handleStartAssessment} className="btn btn-action">
                      Resume Learning
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="dashboard-card start-journey-section">
                <h3 className="card-title">Begin Your Learning Journey</h3>
                <div className="action-card">
                  <p className="action-description">
                    Complete our initial assessment to get personalized learning recommendations.
                  </p>
                  <button onClick={handleStartAssessment} className="btn btn-primary">
                    Start Diagnostic Assessment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-info">
              <p>© 2025 AI Learning Assistant. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer> */}
    </div>
  );
};

export default DashboardPage;