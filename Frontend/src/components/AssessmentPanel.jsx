import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AssessmentPanel.css';
import AssessmentCamera from './AssesmentCamera'; // Import the new camera component

// --- Configuration for Number Comparison ---
const NUM_COMPARISON_TRIALS = 5;
const MAX_NUMBER_VALUE = 20;

// --- Configuration for Letter Arrangement ---
const simpleWords = [
    "cat", "dog", "sun", "run", "big", "top", "sit", "man", "bed",
    "red", "pig", "hat", "cup", "pen", "map", "bus", "fly", "sky",
    "and", "the", "see", "you", "was", "for"
];

const DiagnosticAssessmentPanel = () => {
    // Original state variables remain the same
    const [assessmentResults, setAssessmentResults] = useState({
        numberComparison: null,
        handwriting: null,
        letterArrangement: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('number-comparison');
    const [handwritingImg, setHandwritingImg] = useState(null);
    const [assessmentProgress, setAssessmentProgress] = useState('not-started');
    const [dataSent, setDataSent] = useState(false);
    
    // Add new state for emotion tracking
    const [emotionData, setEmotionData] = useState([]);
    const [showCamera, setShowCamera] = useState(true);
    
    const navigate = useNavigate();
    
    // Original state variables continue...
    const [letterSequence, setLetterSequence] = useState({ original: '', shuffled: [] });
    const [userArrangement, setUserArrangement] = useState([]);
    const [draggedLetter, setDraggedLetter] = useState(null);

    const [numberComparisonTrials, setNumberComparisonTrials] = useState([]);
    const [currentNumberPair, setCurrentNumberPair] = useState(null);
    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [isNumberTaskRunning, setIsNumberTaskRunning] = useState(false);
    const [numberTaskStartTime, setNumberTaskStartTime] = useState(0);

    const canvasRef = useRef(null);
    const canvasCtxRef = useRef(null);
    const isDrawing = useRef(false);

    // Original useEffects remain the same
    useEffect(() => {
        if (activeTab === 'handwriting' && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const ctx = canvas.getContext('2d');
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000000';
            canvasCtxRef.current = ctx;
        }
    }, [activeTab]);

    useEffect(() => {
        setError(null);
        if (activeTab === 'letter-arrangement' && assessmentProgress === 'handwriting-complete') {
            generateLetterArrangementTask();
            setAssessmentProgress('letter-in-progress');
        } else if (activeTab === 'handwriting' && assessmentProgress === 'number-complete') {
            setAssessmentProgress('handwriting-in-progress');
        }
    }, [activeTab, assessmentProgress]);

    useEffect(() => {
        if (assessmentProgress === 'number-complete') {
            const timer = setTimeout(() => setActiveTab('handwriting'), 2000);
            return () => clearTimeout(timer);
        } else if (assessmentProgress === 'handwriting-complete') {
            const timer = setTimeout(() => setActiveTab('letter-arrangement'), 2000);
            return () => clearTimeout(timer);
        }
    }, [assessmentProgress]);

    useEffect(() => {
        if (assessmentProgress === 'complete' && !dataSent) {
            sendDataToFlask();
        }
    }, [assessmentProgress, dataSent]);

    // Handle emotion capture from camera
    const handleEmotionCapture = (emotion) => {
        setEmotionData(prevData => [
            ...prevData, 
            {
                emotion,
                timestamp: new Date().toISOString(),
                task: activeTab
            }
        ]);
        
        // Optional: Show encouragement based on emotion
        if (emotion.toLowerCase() === 'sad' || emotion.toLowerCase() === 'angry') {
            // Could show a temporary encouragement message
            console.log("Detected challenging emotion, providing encouragement");
        }
    };

    // Send data to Flask, including emotion data
    const sendDataToFlask = async () => {
        try {
            setIsLoading(true);
            
            // Prepare data to send to Flask, now including emotion data
            const assessmentData = {
                numberComparison: assessmentResults.numberComparison,
                handwriting: {
                    ...assessmentResults.handwriting,
                    imageData: handwritingImg
                },
                letterArrangement: assessmentResults.letterArrangement,
                emotionTrackingData: emotionData,
                completedAt: new Date().toISOString()
            };
            
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                  console.error('No authentication token found');
                  navigate('/login');
                  return;
                }
            
                const response = await axios.post(
                  'http://localhost:5000/save-assessment',
                  assessmentData,
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    }
                  }
                );
            
                if (response.status === 201) {
                  setDataSent(true);
                  navigate('/profile');
                }
              } catch (error) {
                console.error('Error submitting assessment:', error);
              }
        } catch (error) {
            console.error('Error sending data to Flask:', error);
            setError('Could not save your results. Please try again or ask for help.');
        } finally {
            setIsLoading(false);
        }
    };

    // All original functions remain the same...
    const generateNumberPair = () => {
        let num1 = Math.floor(Math.random() * MAX_NUMBER_VALUE) + 1;
        let num2 = Math.floor(Math.random() * MAX_NUMBER_VALUE) + 1;
        while (num1 === num2) {
            num2 = Math.floor(Math.random() * MAX_NUMBER_VALUE) + 1;
        }
        const correctChoice = num1 > num2 ? 'num1' : 'num2';
        return { num1, num2, correctChoice };
    };

    const startNumberComparisonTask = () => {
        setError(null);
        setNumberComparisonTrials([]);
        setCurrentTrialIndex(0);
        setIsNumberTaskRunning(true);
        const firstPair = generateNumberPair();
        setCurrentNumberPair(firstPair);
        setNumberTaskStartTime(Date.now());
        setAssessmentProgress('number-in-progress');
        setDataSent(false);
    };

    const handleNumberSelection = (selectedKey) => {
        if (!isNumberTaskRunning || !currentNumberPair) return;
        const endTime = Date.now();
        const responseTime = (endTime - numberTaskStartTime) / 1000;
        const isCorrect = selectedKey === currentNumberPair.correctChoice;
        const trialResult = {
            pair: currentNumberPair,
            selection: selectedKey,
            isCorrect: isCorrect,
            responseTime: responseTime.toFixed(2)
        };
        const updatedTrials = [...numberComparisonTrials, trialResult];
        setNumberComparisonTrials(updatedTrials);

        if (currentTrialIndex < NUM_COMPARISON_TRIALS - 1) {
            setCurrentTrialIndex(currentTrialIndex + 1);
            const nextPair = generateNumberPair();
            setCurrentNumberPair(nextPair);
            setNumberTaskStartTime(Date.now());
        } else {
            setIsNumberTaskRunning(false);
            setCurrentNumberPair(null);
            analyzeNumberComparison(updatedTrials);
        }
    };

    const analyzeNumberComparison = (trials) => {
        // Original implementation remains the same
        if (!trials || trials.length === 0) {
            setError("No number comparison data to analyze.");
            return;
        }
        setIsLoading(true);
        setError(null);
        const totalTrials = trials.length;
        const correctCount = trials.filter(t => t.isCorrect).length;
        const accuracy = totalTrials > 0 ? (correctCount / totalTrials) * 100 : 0;
        const totalResponseTime = trials.reduce((sum, t) => sum + parseFloat(t.responseTime), 0);
        const averageResponseTime = totalTrials > 0 ? (totalResponseTime / totalTrials) : 0;

        let interpretation = "";
        if (accuracy >= 80 && averageResponseTime < 2.5) {
            interpretation = "Great job! You're quick and accurate at finding the bigger number.";
        } else if (accuracy >= 60) {
            interpretation = `Good work! You got ${accuracy.toFixed(0)}% right. Sometimes picking the bigger number takes a little extra thought.`;
        } else {
            interpretation = `Finding the bigger number seemed a bit tricky (${accuracy.toFixed(0)}% correct). Keep practicing, number games can help!`;
        }

        const analysisResult = {
            taskType: "Number Comparison",
            summary: {
                totalTrials: totalTrials,
                correctCount: correctCount,
                accuracyPercentage: accuracy.toFixed(1),
                averageResponseTimeSeconds: averageResponseTime.toFixed(2),
            },
            interpretation: interpretation,
            detailedTrials: trials,
            suggested_next_steps: [
                accuracy < 80 ? "Play games comparing groups of objects (more/less)." : "Try simple counting games.",
                "Use number lines to see which numbers are bigger.",
                "Talk about numbers during everyday activities (like counting snacks)."
            ]
        };
        setAssessmentResults(prev => ({ ...prev, numberComparison: analysisResult }));
        setIsLoading(false);
        setAssessmentProgress('number-complete');
    };

    // Handwriting functions
    const startDrawing = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        canvasCtxRef.current.beginPath();
        canvasCtxRef.current.moveTo(x, y);
        isDrawing.current = true;
    };
    
    const draw = (e) => {
        if (!isDrawing.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        canvasCtxRef.current.lineTo(x, y);
        canvasCtxRef.current.stroke();
    };
    
    const stopDrawing = () => {
        if (isDrawing.current) {
            canvasCtxRef.current.closePath();
            isDrawing.current = false;
            setHandwritingImg(canvasRef.current.toDataURL('image/png'));
        }
    };
    
    const clearCanvas = () => {
        if (canvasRef.current) {
            canvasCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            setHandwritingImg(null);
        }
    };

    const analyzeHandwriting = async () => {
        // Original implementation remains the same
        if (!handwritingImg) {
            setError("Please draw something first!");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            console.log("Simulating handwriting analysis (child focus)...");
            await new Promise(resolve => setTimeout(resolve, 1000));

            const characteristics = [];
            const indicators = [];
            const rand = Math.random();
            if (rand < 0.3) {
                characteristics.push("Lines look a bit shaky.");
                indicators.push({ type: "Fine Motor Area", description: "Making smooth lines might need more practice." });
            } else if (rand < 0.7) {
                characteristics.push("Shapes/letters vary in size.");
                indicators.push({ type: "Visual-Motor Area", description: "Keeping sizes the same can be tricky." });
            } else {
                characteristics.push("Good effort forming shapes/letters!");
            }

            const interpretation = characteristics.length > 0 && indicators.length > 0
                ? `The drawing shows ${characteristics.join(' ')}. ${indicators[0].description} This is common when learning to write!`
                : "Looks like good practice forming shapes and lines!";

            const simulatedResponse = {
                taskType: "Handwriting",
                characteristics: characteristics,
                indicators: indicators,
                interpretation: interpretation,
                suggested_next_steps: [
                    "Practice drawing shapes like circles and squares.",
                    "Use fun materials like play-doh or finger paint.",
                    "Try tracing letters or shapes.",
                    "Activities like using scissors or stringing beads can help too!"
                ]
            };

            setAssessmentResults(prev => ({ ...prev, handwriting: simulatedResponse }));
            setAssessmentProgress('handwriting-complete');
        } catch (err) {
            console.error("Handwriting analysis error:", err);
            setError("Oops! Something went wrong analyzing the drawing.");
        } finally {
            setIsLoading(false);
        }
    };

    // Letter arrangement functions
    const generateLetterArrangementTask = () => {
        const selectedWord = simpleWords[Math.floor(Math.random() * simpleWords.length)];
        const letters = selectedWord.split('');
        for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        if (letters.join('') === selectedWord && letters.length > 1) {
             [letters[0], letters[1]] = [letters[1], letters[0]];
        }

        setLetterSequence({
            original: selectedWord,
            shuffled: letters
        });
        setUserArrangement([]);
    };

    const handleDragStart = (letter, index) => {
        setDraggedLetter({ letter, index });
    };

    const handleLetterDrop = () => {
        if (draggedLetter) {
            setUserArrangement([...userArrangement, draggedLetter.letter]);
            const newShuffled = [...letterSequence.shuffled];
            newShuffled.splice(draggedLetter.index, 1);
            setLetterSequence({
                ...letterSequence,
                shuffled: newShuffled
            });
            setDraggedLetter(null);
        }
    };

    const resetArrangement = () => {
        generateLetterArrangementTask();
    };

    const removeArrangedLetter = (index) => {
        const letterToReturn = userArrangement[index];
        const newArrangement = [...userArrangement];
        newArrangement.splice(index, 1);
        setUserArrangement(newArrangement);
        setLetterSequence({
            ...letterSequence,
            shuffled: [...letterSequence.shuffled, letterToReturn]
        });
    };

    const analyzeLetterArrangement = async () => {
        // Original implementation remains the same
        if (userArrangement.length === 0) {
            setError("Move the letters to make a word first!");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const userWord = userArrangement.join('');
            const originalWord = letterSequence.original;
            const accuracy = userWord === originalWord;

            const countTranspositions = (user, orig) => {
                let count = 0;
                if (user.length === orig.length && user.length > 1) {
                    for (let i = 0; i < user.length - 1; i++) {
                        if (user[i] === orig[i+1] && user[i+1] === orig[i]) count++;
                    }
                }
                return count;
            };

            const interpretation = accuracy
                ? `Yes! You correctly spelled "${originalWord}". Great job!`
                : `Good try! The word was "${originalWord}". Putting letters in the right order can be tricky.`;

            const simulatedResponse = {
                taskType: "Letter Arrangement",
                input: { original_word: originalWord, user_arrangement: userWord },
                accuracy: accuracy,
                letter_sequence_analysis: {
                    transpositions: countTranspositions(userWord, originalWord),
                    correct_placement: userWord.split('').filter((l, i) => l === originalWord[i]).length,
                },
                interpretation: interpretation,
                suggested_next_steps: [
                    "Play letter sound games (what sound does 'c' make?).",
                    "Practice spelling simple words with letter tiles or magnets.",
                    accuracy ? "Try slightly longer words next time!" : "Keep practicing with 3-letter words.",
                    "Read simple picture books together."
                ]
            };

            await new Promise(resolve => setTimeout(resolve, 500));

            setAssessmentResults(prev => ({ ...prev, letterArrangement: simulatedResponse }));
            setAssessmentProgress('complete');
        } catch (err) {
            console.error("Letter arrangement analysis error:", err);
            setError("Oops! Something went wrong checking the word.");
        } finally {
            setIsLoading(false);
        }
    };

    // UI Rendering functions for the tabs

    // Number comparison tab - Original implementation
    const renderNumberComparisonTab = () => (
        <div className="assessment-tab-content number-comparison-tab">
            {assessmentProgress === 'not-started' && (
                <>
                    <p className="tab-instructions">
                        Let's start with numbers! Click "Start" when you're ready.
                        Then, click the number that is BIGGER. Try to be quick but careful!
                    </p>
                    <button className="start-task-button" onClick={startNumberComparisonTask}>
                        Start Numbers!
                    </button>
                </>
            )}
            {assessmentProgress === 'number-in-progress' && currentNumberPair && (
                <div className="number-display-area">
                    <p className="trial-counter">Question {currentTrialIndex + 1} of {NUM_COMPARISON_TRIALS}</p>
                    <p className="number-instruction">Click the bigger number:</p>
                    <div className="number-options">
                        <button className="number-button" onClick={() => handleNumberSelection('num1')}>
                            {currentNumberPair.num1}
                        </button>
                        <button className="number-button" onClick={() => handleNumberSelection('num2')}>
                            {currentNumberPair.num2}
                        </button>
                    </div>
                </div>
            )}
            {assessmentProgress === 'number-complete' && (
                <div className="task-complete-message">
                    <p>Great job with the numbers!</p>
                    <p>Next up: Drawing!</p>
                </div>
            )}
        </div>
    );

    // Handwriting tab - Original implementation
    const renderHandwritingTab = () => (
        <div className="assessment-tab-content">
            <p className="tab-instructions">
                Time to draw! Use your mouse like a pencil on the white box below.
            </p>
            <div className="canvas-container">
                <canvas
                    ref={canvasRef}
                    className="drawing-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
                <div className="canvas-tools">
                    <button className="tool-button" onClick={clearCanvas} disabled={isLoading}>
                        Clear Drawing
                    </button>
                    <p className="canvas-hint">Try drawing a circle, a square, or maybe write the first letter of your name!</p>
                </div>
            </div>

            {assessmentProgress === 'handwriting-in-progress' && handwritingImg && (
                 <button
                    onClick={analyzeHandwriting}
                    className={`analyze-button ${isLoading ? 'loading' : ''}`}
                    disabled={isLoading || !handwritingImg}
                >
                    {isLoading ? 'Checking...' : 'Finished Drawing!'}
                    {!isLoading && <svg xmlns="http://www.w3.org/2000/svg" className="arrow-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>}
                </button>
            )}
             {assessmentProgress === 'handwriting-complete' && (
                <div className="task-complete-message">
                    <p>Nice drawing!</p>
                    <p>Last task: Let's arrange some letters!</p>
                </div>
            )}
        </div>
    );

    // Letter arrangement tab - Original implementation
    const renderLetterArrangementTab = () => (
        <div className="assessment-tab-content">
             <p className="tab-instructions">
                Last one! Drag the letters from the top box into the bottom box to spell a word.
            </p>
            <div className="letter-arrangement-container">
                <div className="letter-task-header">
                    <span>Arrange these letters:</span>
                     <button className="tool-button" onClick={resetArrangement} disabled={isLoading}>
                         Try a Different Word
                     </button>
                </div>
                <div className="letter-bank">
                     {letterSequence.shuffled?.map((letter, index) => (
                        <div key={index} className="letter-tile" draggable onDragStart={() => handleDragStart(letter, index)}>
                            {letter}
                        </div>
                    ))}
                </div>
                <div className="letter-drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={handleLetterDrop}>
                     {userArrangement.length === 0 ? (
                        <span className="drop-placeholder">Drag letters here</span>
                    ) : (
                        userArrangement.map((letter, index) => (
                            <div key={index} className="arranged-letter" onClick={() => removeArrangedLetter(index)}>
                                {letter}
                            </div>
                        ))
                    )}
                </div>
                <p className="arrangement-instruction">Click a letter in the bottom box to put it back.</p>
            </div>

            {assessmentProgress === 'letter-in-progress' && userArrangement.length > 0 && (
                <button
                    onClick={analyzeLetterArrangement}
                    className={`analyze-button ${isLoading ? 'loading' : ''}`}
                    disabled={isLoading || userArrangement.length === 0}
                >
                    {isLoading ? 'Checking...' : "Check My Word!"}
                    {!isLoading && <svg xmlns="http://www.w3.org/2000/svg" className="arrow-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>}
                </button>
            )}
             {assessmentProgress === 'complete' && (
                <div className="task-complete-message">
                    <p>All done! Great work!</p>
                    <p>Let's see how you did.</p>
                </div>
            )}
        </div>
    );

    // Render the Results Summary
    const renderResultsSummary = () => {
        if (assessmentProgress !== 'complete') return null;
        
        return (
            <div className="results-summary">
                <h3>Assessment Complete!</h3>
                
                {isLoading ? (
                    <p>Saving your results...</p>
                ) : dataSent ? (
                    <p>Results saved! Redirecting to your profile...</p>
                ) : (
                    <>
                        <p>Here's a summary of how you did:</p>
                        
                        {assessmentResults.numberComparison && (
                            <div className="result-section">
                                <h4>Number Comparison</h4>
                                <p>{assessmentResults.numberComparison.interpretation}</p>
                            </div>
                        )}
                        
                        {assessmentResults.handwriting && (
                            <div className="result-section">
                                <h4>Handwriting</h4>
                                <p>{assessmentResults.handwriting.interpretation}</p>
                            </div>
                        )}
                        
                        {assessmentResults.letterArrangement && (
                            <div className="result-section">
                                <h4>Letter Arrangement</h4>
                                <p>{assessmentResults.letterArrangement.interpretation}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // Main render function for the component
    return (
        <div className="assessment-panel">
            <h2>Reading Skills Assessment</h2>
            
            {error && <div className="error-message">{error}</div>}
            
            {/* Camera component for emotion tracking */}
            {showCamera && (
                <div className="camera-container">
                    <AssessmentCamera onEmotionCapture={handleEmotionCapture} />
                    <button 
                        className="camera-toggle-button"
                        onClick={() => setShowCamera(false)}
                    >
                        Hide Camera
                    </button>
                </div>
            )}
            
            {!showCamera && (
                <button 
                    className="camera-toggle-button"
                    onClick={() => setShowCamera(true)}
                >
                    Show Camera
                </button>
            )}
            
            <div className="assessment-tabs">
                <button 
                    className={`tab-button ${activeTab === 'number-comparison' ? 'active' : ''}`}
                    onClick={() => {
                        if (assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress') {
                            setActiveTab('number-comparison');
                        }
                    }}
                >
                    1. Numbers
                </button>
                <button 
                    className={`tab-button ${activeTab === 'handwriting' ? 'active' : ''}`}
                    onClick={() => {
                        if (assessmentProgress === 'number-complete' || assessmentProgress === 'handwriting-in-progress') {
                            setActiveTab('handwriting');
                        }
                    }}
                >
                    2. Drawing
                </button>
                <button 
                    className={`tab-button ${activeTab === 'letter-arrangement' ? 'active' : ''}`}
                    onClick={() => {
                        if (assessmentProgress === 'handwriting-complete' || assessmentProgress === 'letter-in-progress') {
                            setActiveTab('letter-arrangement');
                        }
                    }}
                >
                    3. Letters
                </button>
            </div>
            
            <div className="assessment-content">
                {activeTab === 'number-comparison' && renderNumberComparisonTab()}
                {activeTab === 'handwriting' && renderHandwritingTab()}
                {activeTab === 'letter-arrangement' && renderLetterArrangementTab()}
                
                {renderResultsSummary()}
            </div>
        </div>
    );
};

export default DiagnosticAssessmentPanel;