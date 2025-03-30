import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';

const AssessmentCamera = ({ onEmotionCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [emotion, setEmotion] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [isCapturing, setIsCapturing] = useState(true);

  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 240 }, height: { ideal: 180 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(error => console.error("Error playing video: ", error));
          };
        }
      } catch (err) {
        console.error("Error accessing webcam: ", err);
      }
    };

    if (isCapturing) {
      startVideo();
    }

    const intervalId = setInterval(() => {
      if (isCapturing && !minimized) {
        handleCapture();
      }
    }, 5000); // Capture image every 5 seconds

    return () => {
      clearInterval(intervalId);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCapturing, minimized]);

  const captureImage = () => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg');
  };

  const handleCapture = async () => {
    const imageData = captureImage();
    if (!imageData) return;

    const blob = await fetch(imageData).then(res => res.blob());
    const formData = new FormData();
    formData.append('image', blob, 'capture.jpg');
    
    try {
      const response = await axios.post('http://localhost:5000/facedetection',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      const detectedEmotion = response.data.emotion;
      setEmotion(detectedEmotion);
      if (onEmotionCapture) {
        onEmotionCapture(detectedEmotion);
      }
    } catch (error) {
      console.error('Error processing emotion detection:', error);
    }
  };

  const toggleMinimize = () => setMinimized(!minimized);
  const toggleCapture = () => {
    if (isCapturing) {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      setIsCapturing(false);
    } else {
      setIsCapturing(true);
    }
  };

  const getEmotionEmoji = () => {
    switch(emotion?.toLowerCase()) {
      case 'happy': return '😊';
      case 'sad': return '😢';
      case 'angry': return '😠';
      case 'surprised': return '😮';
      case 'fearful': return '😨';
      case 'neutral': return '😐';
      default: return '📷';
    }
  };

  return (
    <div className={`absolute left-2 top-16 bg-white rounded-lg shadow-lg overflow-hidden ${minimized ? 'w-12 h-12' : 'w-64'}`}>
      <div className="p-1 bg-blue-100 flex justify-between items-center text-xs">
        <span className="font-medium truncate">
          {minimized ? getEmotionEmoji() : 'How are you feeling?'}
        </span>
        <div className="flex space-x-1">
          {!minimized && (
            <button 
              onClick={toggleCapture} 
              className={`p-1 rounded ${isCapturing ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}> 
              {isCapturing ? '⏹️' : '▶️'}
            </button>
          )}
          <button onClick={toggleMinimize} className="p-1 rounded hover:bg-gray-200">
            {minimized ? '↗️' : '↙️'}
          </button>
        </div>
      </div>
      {!minimized && (
        <>
          <div className="relative">
            <video ref={videoRef} className={`w-full h-auto ${isCapturing ? 'opacity-100' : 'opacity-50'}`} />
            <canvas ref={canvasRef} className="w-full h-auto absolute top-0 left-0" />
          </div>
          {emotion && (
            <div className="p-2 text-sm bg-blue-50">
              <p>You seem: <strong>{emotion}</strong> {getEmotionEmoji()}</p>
              {emotion.toLowerCase() === 'happy' && <p className="text-xs text-green-600">Great! Keep going! 👍</p>}
              {(emotion.toLowerCase() === 'sad' || emotion.toLowerCase() === 'angry') && 
                <p className="text-xs text-blue-600">Take a deep breath, you're doing great! 🌈</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssessmentCamera;