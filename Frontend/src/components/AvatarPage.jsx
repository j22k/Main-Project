import React, { useState } from 'react';
import { Canvas } from "@react-three/fiber";
import { Experience } from "../components/Experience";
import AssessmentPanel from "../components/AssessmentPanel";
import "./AvatarPage.css";

const AvatarPage = () => {
  const [currentStep, setCurrentStep] = useState('introduction');

  const handleResponse = () => {
    setCurrentStep('learning_style');
  };

  return (
    <div className="avatar-page">
      {/* 3D Avatar Section - Only visible in introduction step */}
      <div className={`avatar-container ${currentStep !== 'introduction' ? 'hidden' : ''}`}>
        <Canvas shadows camera={{ position: [0, 0, 8], fov: 42 }} className="canvas">
          <color attach="background" args={["#f0f4ff"]} />
          <Experience />
        </Canvas>
        <div className="avatar-caption">
          <p>Meet your AI tutor - Ready to guide you through the assessment!</p>
        </div>
      </div>

      {/* Assessment Panel component */}
      <AssessmentPanel 
        currentStep={currentStep} 
        handleResponse={handleResponse} 
      />
    </div>
  );
};

export default AvatarPage;