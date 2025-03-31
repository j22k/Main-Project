import React from 'react';
import { useNavigate } from 'react-router-dom';
// If you create a minimal CSS file for just the button container and button:
// import './DashboardPageSimplified.css';

const DashboardPage = () => {
  const navigate = useNavigate();

  // Function to navigate to the assessment page
  const handleStartAssessment = () => {
    navigate('/assessment');
  };

  return (
    // Basic container to center the button (you might want to style this)
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh', // Take full viewport height
      padding: '20px',
      backgroundColor: '#f0f4f8' // Example background color
    }}>
      <button
        onClick={handleStartAssessment}
        style={{
          padding: '15px 30px',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: '#3b82f6', // Blue color from previous CSS
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          transition: 'background-color 0.3s ease, transform 0.2s ease',
        }}
        // Add hover effect inline (or use CSS classes)
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Start Assessment
      </button>
    </div>
  );
};

export default DashboardPage;