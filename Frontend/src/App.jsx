import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import DashboardPage from './components/DashboardPage';
import AvatarPage from './components/AvatarPage';
import ProfilePage from './components/ProfilePage';
import LearningPage from './components/LearningPage'; // Assuming you have a LearningPage component

// Protected route component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
 
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
 
  return children;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessment"
          element={
            <ProtectedRoute>
              <AvatarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learning"
          element={
            <ProtectedRoute>
             <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
};

export default App;