import React, { useState, useEffect, useRef } from 'react';
import './AdaptiveLessonFlow.css';
import AssessmentCamera from './AssesmentCamera';

const AdaptiveLessonFlow = ({ 
  moduleTitle = "Sound Starters", 
  onComplete, 
  studentName = "Learner",
  initialDifficulty = "standard"
}) => {
  // State management
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState('introduction');
  const [attempts, setAttempts] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [studentEmotion, setStudentEmotion] = useState(null);
  
  // Reference to the speech synthesis
  const speechSynthesisRef = useRef(null);
  
  // Example lessons data structure
  const lessons = [
    {
      id: 'lesson1',
      title: 'Beginning Sounds',
      introduction: {
        standard: "Let's learn about beginning sounds! Every word starts with a specific sound. For example, 'ball' starts with the /b/ sound.",
        simplified: "Words have starting sounds! Like 'ball' starts with /b/. Let's learn these sounds!",
        basic: "Listen: /b/ is for ball. The first sound in ball is /b/."
      },
      examples: {
        standard: ["'Ball' starts with /b/", "'Dog' starts with /d/", "'Cat' starts with /k/"],
        simplified: ["Ball → /b/", "Dog → /d/", "Cat → /k/"],
        basic: ["Ball - /b/", "Dog - /d/"]
      },
      exercise: {
        question: "What sound does 'Fish' start with?",
        options: ["/f/", "/s/", "/t/", "/p/"],
        answer: "/f/"
      },
      hints: [
        "Listen to the first sound when I say 'fish'.",
        "It's the same sound as in 'fun'.",
        "It sounds like /ffff/."
      ]
    },
    {
      id: 'lesson2',
      title: 'Ending Sounds',
      introduction: {
        standard: "Now let's learn about ending sounds! Every word ends with a specific sound too. For example, 'dog' ends with the /g/ sound.",
        simplified: "Words have ending sounds! Like 'dog' ends with /g/. Let's learn these sounds!",
        basic: "Listen: /g/ is at the end of dog. The last sound in dog is /g/."
      },
      examples: {
        standard: ["'Dog' ends with /g/", "'Cat' ends with /t/", "'Bus' ends with /s/"],
        simplified: ["Dog → /g/", "Cat → /t/", "Bus → /s/"],
        basic: ["Dog - /g/", "Cat - /t/"]
      },
      exercise: {
        question: "What sound does 'Map' end with?",
        options: ["/p/", "/m/", "/a/", "/t/"],
        answer: "/p/"
      },
      hints: [
        "Listen to the last sound when I say 'map'.",
        "It's the same sound as at the end of 'hop'.",
        "It sounds like /p/."
      ]
    }
  ];

  // Get current lesson
  const currentLesson = lessons[currentLessonIndex];
  
  // Function to send data to Flask backend every 3 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      const postData = {
        studentName: studentName,
        lessonId: currentLesson.id,
        lessonTitle: currentLesson.title,
        currentStep: currentStep,
        difficulty: difficulty,
        emotion: studentEmotion,
        timestamp: new Date().toISOString()
      };

      fetch('http://localhost:5000/rl_action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      })
      .then(response => {
        console.log(response);
        
        if (!response.ok) {
          console.error('Failed to send progress data');
        }
        return response.json();
      })
      .catch(error => {
        console.error('Error sending progress data:', error);
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [studentName, currentLesson, currentStep, difficulty, studentEmotion]);

  // Function to handle emotion capture from the camera
  const handleEmotionCapture = (emotion) => {
    setStudentEmotion(emotion);
    
    if (emotion && (emotion.toLowerCase() === 'sad' || emotion.toLowerCase() === 'angry')) {
      const encouragementMessages = [
        `You're doing great, ${studentName}! Let's try a different approach.`,
        "Learning new sounds can be tricky. Take a deep breath!",
        "Don't worry! We'll figure this out together."
      ];
      
      const randomMessage = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
      
      if (!feedback.message) {
        setFeedback({
          type: 'encouragement',
          message: randomMessage
        });
        speakText(randomMessage);
      }
      
      if (difficulty === 'standard') {
        setDifficulty('simplified');
      }
    }
  };
  
  // Text-to-speech function
  const speakText = (text) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(voice => 
        voice.name.includes('Male') || 
        voice.name.includes('Daniel') ||
        voice.name.includes('Google UK English Male') ||
        voice.name.includes('Microsoft David')
      );
      
      if (maleVoice) {
        utterance.voice = maleVoice;
      }
      
      setIsSpeaking(true);
      
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
        console.error('Speech synthesis error');
      };
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };
  
  // Stop speaking function
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };
  
  // Auto-speak the current content when step changes
  useEffect(() => {
    let textToSpeak = '';
    
    if (currentStep === 'introduction') {
      textToSpeak = currentLesson.introduction[difficulty];
    } else if (currentStep === 'example') {
      textToSpeak = `Examples: ${currentLesson.examples[difficulty].join('. ')}`;
    } else if (currentStep === 'exercise') {
      textToSpeak = currentLesson.exercise.question;
    }
    
    if (textToSpeak) {
      speakText(textToSpeak);
    }
    
    return () => {
      stopSpeaking();
    };
  }, [currentStep, currentLessonIndex, difficulty]);
  
  // Auto-speak feedback when it changes
  useEffect(() => {
    if (feedback.message) {
      speakText(feedback.message);
    }
  }, [feedback]);
  
  // Initialize speech synthesis voices
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    
    return () => {
      stopSpeaking();
    };
  }, []);
  
  // Adjust difficulty based on student emotion and performance
  useEffect(() => {
    if (studentEmotion && (studentEmotion.toLowerCase() === 'sad' || 
        studentEmotion.toLowerCase() === 'angry') && attempts > 1) {
      if (difficulty === 'simplified') {
        setDifficulty('basic');
      }
    }
  }, [studentEmotion, attempts]);
  
  // Reset states when moving to a new lesson
  useEffect(() => {
    setCurrentStep('introduction');
    setAttempts(0);
    setUserAnswer('');
    setFeedback({ type: '', message: '' });
  }, [currentLessonIndex]);

  // Handle user answer submission
  const handleAnswerSubmit = () => {
    if (userAnswer === currentLesson.exercise.answer) {
      setFeedback({
        type: 'success',
        message: `Great job, ${studentName}! That's correct! ${currentLesson.exercise.question.replace('?', '')} starts with ${currentLesson.exercise.answer}.`
      });
      
      setTimeout(() => {
        if (currentLessonIndex < lessons.length - 1) {
          setCurrentLessonIndex(currentLessonIndex + 1);
        } else {
          if (onComplete) onComplete();
        }
      }, 4000);
    } else {
      setAttempts(attempts + 1);
      
      if (attempts === 0) {
        setFeedback({
          type: 'error',
          message: `Not quite. ${currentLesson.hints[0]} Let's try again.`
        });
        setCurrentStep('example');
      } else if (attempts === 1) {
        setDifficulty(difficulty === 'standard' ? 'simplified' : 'basic');
        setFeedback({
          type: 'error',
          message: `Let's try a different way. ${currentLesson.hints[1]}`
        });
        setCurrentStep('introduction');
      } else {
        setFeedback({
          type: 'hint',
          message: `Here's a big hint: ${currentLesson.hints[2]} Try once more!`
        });
      }
      
      setUserAnswer('');
    }
  };

  // Move to next step in the lesson flow
  const goToNextStep = () => {
    switch (currentStep) {
      case 'introduction':
        setCurrentStep('example');
        break;
      case 'example':
        setCurrentStep('exercise');
        break;
      default:
        break;
    }
    
    setFeedback({ type: '', message: '' });
  };

  // Function to speak a specific text on demand
  const handleSpeakItem = (text) => {
    speakText(text);
  };
  
  // Adjust content based on detected emotion
  const getAdaptedContent = () => {
    if (studentEmotion && studentEmotion.toLowerCase() === 'happy') {
      return currentLesson.introduction[difficulty];
    }
    
    if (studentEmotion && 
        (studentEmotion.toLowerCase() === 'sad' || 
         studentEmotion.toLowerCase() === 'angry' || 
         studentEmotion.toLowerCase() === 'fearful')) {
      return currentLesson.introduction['basic'];
    }
    
    return currentLesson.introduction[difficulty];
  };

  return (
    <div className="adaptive-lesson-container">
      <AssessmentCamera onEmotionCapture={handleEmotionCapture} />
      
      <div className="lesson-header">
        <h2>{moduleTitle}: {currentLesson.title}</h2>
        <div className="audio-controls">
          {isSpeaking ? (
            <button 
              className="audio-button pause"
              onClick={stopSpeaking}
              aria-label="Stop speaking"
            >
              <span className="audio-icon">🔇</span>
            </button>
          ) : (
            <button 
              className="audio-button play"
              onClick={() => {
                let textToSpeak = '';
                if (currentStep === 'introduction') {
                  textToSpeak = getAdaptedContent();
                } else if (currentStep === 'example') {
                  textToSpeak = `Examples: ${currentLesson.examples[difficulty].join('. ')}`;
                } else if (currentStep === 'exercise') {
                  textToSpeak = currentLesson.exercise.question;
                }
                if (textToSpeak) {
                  speakText(textToSpeak);
                }
              }}
              aria-label="Speak text"
            >
              <span className="audio-icon">🔊</span>
            </button>
          )}
        </div>
        <div className="progress-indicator">
          Lesson {currentLessonIndex + 1} of {lessons.length}
        </div>
      </div>

      <div className="lesson-content">
        {currentStep === 'introduction' && (
          <div className="introduction-container">
            <p className="introduction-text">{getAdaptedContent()}</p>
            <button className="action-button" onClick={goToNextStep}>See Examples</button>
          </div>
        )}

        {currentStep === 'example' && (
          <div className="examples-container">
            <h3>Examples:</h3>
            <ul className="examples-list">
              {currentLesson.examples[difficulty].map((example, index) => (
                <li key={index} className="example-item">
                  {example}
                  <button 
                    className="speak-example-button" 
                    onClick={() => handleSpeakItem(example)}
                    aria-label={`Speak example: ${example}`}
                  >
                    🔊
                  </button>
                </li>
              ))}
            </ul>
            <button className="action-button" onClick={goToNextStep}>Try It Yourself</button>
          </div>
        )}

        {currentStep === 'exercise' && (
          <div className="exercise-container">
            <h3 className="question">
              {currentLesson.exercise.question}
              <button 
                className="speak-button" 
                onClick={() => handleSpeakItem(currentLesson.exercise.question)}
                aria-label="Speak question"
              >
                🔊
              </button>
            </h3>
            <div className="options-container">
              {currentLesson.exercise.options.map((option, index) => (
                <button 
                  key={index}
                  className={`option-button ${userAnswer === option ? 'selected' : ''}`}
                  onClick={() => {
                    setUserAnswer(option);
                    handleSpeakItem(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            <button 
              className="submit-button" 
              onClick={handleAnswerSubmit}
              disabled={!userAnswer}
            >
              Check Answer
            </button>
          </div>
        )}

        {feedback.message && (
          <div className={`feedback-container ${feedback.type}`}>
            <p>
              {feedback.message}
              <button 
                className="speak-button" 
                onClick={() => handleSpeakItem(feedback.message)}
                aria-label="Speak feedback"
              >
                🔊
              </button>
            </p>
          </div>
        )}
        
        {studentEmotion && (studentEmotion.toLowerCase() === 'sad' || studentEmotion.toLowerCase() === 'angry') && (
          <div className="emotion-support">
            <p className="support-message">
              I notice you might be feeling frustrated. That's okay! Learning takes time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdaptiveLessonFlow;