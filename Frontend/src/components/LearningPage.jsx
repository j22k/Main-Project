import React, { useState } from 'react';
import { Canvas } from "@react-three/fiber";
import { Experience } from "./Experience";
import AdaptiveLessonFlow from "./AdaptiveLessonFlow";
import "./AvatarPage.css";

const AvatarPage = () => {
  // State to control which view is shown
  const [currentView, setCurrentView] = useState('soundStarters');
  const [studentProfile, setStudentProfile] = useState({ 
    name: "Learner",
    difficulty: "standard", // Initial difficulty level
    completedModules: []
  });

  // Handle completion of the module
  const handleSoundStartersComplete = () => {
    console.log("Sound Starters module finished!");
    setStudentProfile(prev => ({
      ...prev,
      completedModules: [...prev.completedModules, "soundStarters"]
    }));
    setCurrentView('module_selection');
    // Here you would update backend progress
  };
  
  // Handle avatar interactions (could expand this to respond to student struggles)
  const triggerAvatarInteraction = (interactionType) => {
    // This could send a message to the Experience component to change avatar behavior
    console.log(`Avatar interaction triggered: ${interactionType}`);
    // Example: show encouragement animation when student is struggling
  };

  return (
    <div className="avatar-page">
      {/* 3D Avatar Section - Always visible but can change states */}
      <div className={`avatar-container ${currentView === 'module_selection' ? 'minimized' : ''}`}>
        <Canvas shadows camera={{ position: [0, 0, 8], fov: 42 }} className="canvas">
          <color attach="background" args={["#f0f4ff"]} />
          <Experience 
            interactionState={currentView} 
            studentProgress={studentProfile.completedModules.length} 
          />
        </Canvas>
      </div>
      
      {/* Learning Content Area */}
      <div className="learning-content">
        {currentView === 'soundStarters' && (
          <AdaptiveLessonFlow 
            moduleTitle="Sound Starters"
            studentName={studentProfile.name}
            initialDifficulty={studentProfile.difficulty}
            onComplete={handleSoundStartersComplete}
            onStudentStruggle={(severity) => triggerAvatarInteraction(`encourage_${severity}`)}
          />
        )}
        
        {currentView === 'module_selection' && (
          <div className="module-selection">
            <h2>Great job! Choose your next activity:</h2>
            <div className="module-buttons">
              <button onClick={() => setCurrentView('blendingSounds')}>
                Blending Sounds
              </button>
              <button onClick={() => setCurrentView('wordFamilies')}>
                Word Families
              </button>
              <button onClick={() => setCurrentView('soundStarters')}>
                Review Sound Starters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarPage;