import React, { useState, useRef, useEffect } from 'react';
// import axios from 'axios'; // Keep commented out if handwriting analysis is also simulated
import './AssessmentPanel.css'; // Reuse the CSS file, might need adjustments later

// --- Configuration for Number Comparison ---
const NUM_COMPARISON_TRIALS = 5; // Number of pairs to compare
const MAX_NUMBER_VALUE = 25; // Max number to generate (min is 1)

const DiagnosticAssessmentPanel = () => {
    // State for different assessment data
    const [assessmentResults, setAssessmentResults] = useState({
        numberComparison: null,
        handwriting: null,
        letterArrangement: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('number-comparison'); // Start with the number comparison
    const [handwritingImg, setHandwritingImg] = useState(null);
    const [assessmentProgress, setAssessmentProgress] = useState('not-started'); // 'not-started', 'number-in-progress', 'number-complete', 'handwriting-in-progress', 'handwriting-complete', 'letter-in-progress', 'complete'

    // State for letter arrangement task
    const [letterSequence, setLetterSequence] = useState({ original: '', shuffled: [] });
    const [userArrangement, setUserArrangement] = useState([]);
    const [draggedLetter, setDraggedLetter] = useState(null);

    // State for Number Comparison Task
    const [numberComparisonTrials, setNumberComparisonTrials] = useState([]);
    const [currentNumberPair, setCurrentNumberPair] = useState(null); // { num1: 5, num2: 8, correctChoice: 'num2' }
    const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
    const [isNumberTaskRunning, setIsNumberTaskRunning] = useState(false);
    const [numberTaskStartTime, setNumberTaskStartTime] = useState(0);

    // References for canvas elements
    const canvasRef = useRef(null);
    const canvasCtxRef = useRef(null);
    const isDrawing = useRef(false);

    // --- Effects ---

    // Initialize drawing canvas when handwriting tab is active
    useEffect(() => {
        if (activeTab === 'handwriting' && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const ctx = canvas.getContext('2d');
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000000';
            canvasCtxRef.current = ctx;
        }
    }, [activeTab]);

    // Generate tasks when tabs change or assessment progress changes
    useEffect(() => {
        setError(null);
        if (activeTab === 'letter-arrangement' && assessmentProgress === 'handwriting-complete') {
            generateLetterArrangementTask();
            setAssessmentProgress('letter-in-progress');
        } else if (activeTab === 'handwriting' && assessmentProgress === 'number-complete') {
            setAssessmentProgress('handwriting-in-progress');
        }
    }, [activeTab, assessmentProgress]);

    // Auto-change tabs based on assessment progress
    useEffect(() => {
        if (assessmentProgress === 'number-complete') {
            // After a delay to show results, move to handwriting
            const timer = setTimeout(() => {
                setActiveTab('handwriting');
            }, 2000);
            return () => clearTimeout(timer);
        } else if (assessmentProgress === 'handwriting-complete') {
            // After a delay to show results, move to letter arrangement
            const timer = setTimeout(() => {
                setActiveTab('letter-arrangement');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [assessmentProgress]);

    // --- Number Comparison Logic ---

    const generateNumberPair = () => {
        let num1 = Math.floor(Math.random() * MAX_NUMBER_VALUE) + 1;
        let num2 = Math.floor(Math.random() * MAX_NUMBER_VALUE) + 1;
        // Ensure they are not equal
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
    };

    const handleNumberSelection = (selectedKey) => { // selectedKey is 'num1' or 'num2'
        if (!isNumberTaskRunning || !currentNumberPair) return;

        const endTime = Date.now();
        const responseTime = (endTime - numberTaskStartTime) / 1000; // Time in seconds
        const isCorrect = selectedKey === currentNumberPair.correctChoice;

        const trialResult = {
            pair: currentNumberPair,
            selection: selectedKey,
            isCorrect: isCorrect,
            responseTime: responseTime.toFixed(2) // Store time with 2 decimal places
        };

        const updatedTrials = [...numberComparisonTrials, trialResult];
        setNumberComparisonTrials(updatedTrials);

        // Check if more trials are needed
        if (currentTrialIndex < NUM_COMPARISON_TRIALS - 1) {
            setCurrentTrialIndex(currentTrialIndex + 1);
            const nextPair = generateNumberPair();
            setCurrentNumberPair(nextPair);
            setNumberTaskStartTime(Date.now()); // Reset timer for next trial
        } else {
            // Last trial completed
            setIsNumberTaskRunning(false);
            setCurrentNumberPair(null); // Clear the displayed pair
            // Analyze results immediately after the last trial
            analyzeNumberComparison(updatedTrials);
        }
    };

    // Analyze the collected number comparison trials
    const analyzeNumberComparison = (trials) => {
        if (!trials || trials.length === 0) {
            setError("No number comparison data to analyze.");
            return;
        }

        setIsLoading(true);
        setError(null);

        // Perform calculations
        const totalTrials = trials.length;
        const correctCount = trials.filter(t => t.isCorrect).length;
        const accuracy = totalTrials > 0 ? (correctCount / totalTrials) * 100 : 0;
        const totalResponseTime = trials.reduce((sum, t) => sum + parseFloat(t.responseTime), 0);
        const averageResponseTime = totalTrials > 0 ? (totalResponseTime / totalTrials) : 0;

        // Simple interpretation based on accuracy and speed
        let interpretation = "";
        if (accuracy >= 90 && averageResponseTime < 1.5) {
            interpretation = "Excellent performance! Fast and accurate number comparison suggests strong number sense.";
        } else if (accuracy >= 75) {
            interpretation = `Good accuracy (${accuracy.toFixed(0)}%), but response time (${averageResponseTime.toFixed(2)}s) might indicate some hesitation. This is common but worth monitoring.`;
        } else if (accuracy >= 50) {
            interpretation = `Accuracy (${accuracy.toFixed(0)}%) shows some difficulty in consistently identifying the larger number. Average response time was ${averageResponseTime.toFixed(2)}s. Further practice or assessment in number magnitude might be beneficial.`;
        } else {
            interpretation = `Significant difficulty observed (${accuracy.toFixed(0)}% accuracy). This pattern warrants closer attention and may suggest challenges with basic number sense. Average response time was ${averageResponseTime.toFixed(2)}s.`;
        }

        // Simulate backend response structure
        const analysisResult = {
            taskType: "Number Comparison",
            summary: {
                totalTrials: totalTrials,
                correctCount: correctCount,
                accuracyPercentage: accuracy.toFixed(1),
                averageResponseTimeSeconds: averageResponseTime.toFixed(2),
            },
            interpretation: interpretation,
            detailedTrials: trials, // Include raw trial data
            suggested_next_steps: [
                accuracy < 80 ? "Practice activities involving number lines or quantity comparison." : "Continue building number fluency with arithmetic tasks.",
                "Consider exploring estimation activities.",
                "If concerns persist, discuss these results with a teacher or specialist."
            ]
        };

        // Store results in the master state
        setAssessmentResults(prev => ({
            ...prev,
            numberComparison: analysisResult
        }));

        setIsLoading(false);
        setAssessmentProgress('number-complete');
    };

    // --- Handwriting Logic ---
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
            // Save the canvas data when drawing stops
            setHandwritingImg(canvasRef.current.toDataURL('image/png'));
        }
    };
    
    const clearCanvas = () => {
        if (canvasRef.current) {
            canvasCtxRef.current.clearRect(
                0, 0,
                canvasRef.current.width,
                canvasRef.current.height
            );
            setHandwritingImg(null);
        }
    };
    
    const analyzeHandwriting = async () => {
        if (!handwritingImg) {
            setError("Please draw something first");
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            // --- SIMULATED RESPONSE ---
            console.log("Simulating handwriting analysis for:", handwritingImg.substring(0, 50) + "...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
            
            const simulatedResponse = {
                taskType: "Handwriting",
                characteristics: [
                    "Variable letter sizing observed.",
                    "Spacing between words appears inconsistent.",
                    "Baseline adherence could be improved."
                ],
                indicators: [
                    { type: "Dysgraphia Pattern", description: "Inconsistent spacing and letter formation may suggest fine motor challenges." },
                ],
                interpretation: "The handwriting sample shows some characteristics often associated with dysgraphia, such as variable sizing and spacing. This doesn't confirm a diagnosis but suggests fine motor skills and visual-motor integration could be areas for support.",
                suggested_next_steps: [
                    "Practice fine motor activities (tracing, cutting).",
                    "Use paper with raised lines or highlighted baselines.",
                    "Explore assistive technology like speech-to-text if writing is effortful."
                ]
            };
            
            // Store results in the master state
            setAssessmentResults(prev => ({
                ...prev,
                handwriting: simulatedResponse
            }));
            
            setAssessmentProgress('handwriting-complete');
        } catch (err) {
            console.error("Handwriting analysis error:", err);
            setError(err.response?.data?.error || "An error occurred during handwriting analysis.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Letter Arrangement Logic ---
    const generateLetterArrangementTask = () => {
        const dyslexiaWords = [
            "through", "thought", "though", "enough",
            "receive", "believe", "ceiling", "weird",
            "because", "beautiful", "business", "favorite",
            "separate", "definitely", "government", "restaurant"
        ];
        const selectedWord = dyslexiaWords[Math.floor(Math.random() * dyslexiaWords.length)];
        const letters = selectedWord.split('');
        for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
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
        if (userArrangement.length === 0) {
            setError("Please arrange the letters first");
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            const userWord = userArrangement.join('');
            const originalWord = letterSequence.original;
            const accuracy = userWord === originalWord;

            // Simulate backend response structure
            const simulatedResponse = {
                taskType: "Letter Arrangement",
                input: { original_word: originalWord, user_arrangement: userWord },
                accuracy: accuracy,
                letter_sequence_analysis: {
                    reversals: countReversals(userWord),
                    transpositions: countTranspositions(userWord, originalWord),
                    missing_letters: originalWord.length - userWord.length,
                    correct_letters: countCorrectLetters(userWord, originalWord)
                },
                interpretation: generateInterpretation(userWord, originalWord),
                suggested_next_steps: [
                    "Try additional assessment types for a more complete picture",
                    "Consider specialized activities focused on letter recognition and sequencing",
                    "Review results with an education professional"
                ]
            };
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
            
            // Store results in the master state
            setAssessmentResults(prev => ({
                ...prev,
                letterArrangement: simulatedResponse
            }));
            
            setAssessmentProgress('complete');
        } catch (err) {
            console.error("Letter arrangement analysis error:", err);
            setError("An error occurred during analysis.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // Helper functions for letter arrangement analysis
    const countReversals = (word) => { return []; }; // Simplified placeholder
    const countTranspositions = (userWord, originalWord) => { return 0; }; // Simplified placeholder
    const countCorrectLetters = (userWord, originalWord) => { return 0; }; // Simplified placeholder
    const generateInterpretation = (userWord, originalWord) => { return "Analysis complete."; }; // Simplified placeholder

    // --- UI Rendering ---

    // Helper to render the Number Comparison tab
    const renderNumberComparisonTab = () => (
        <div className="assessment-tab-content number-comparison-tab">
            {assessmentProgress === 'not-started' && (
                <>
                    <p className="tab-instructions">
                        Click "Start Assessment" to begin. You will start with a number comparison task.
                        Click on the number you believe is larger as quickly and accurately as possible.
                        After completing this task, you'll move on to handwriting and letter arrangement tasks.
                    </p>
                    <button className="start-task-button" onClick={startNumberComparisonTask}>
                        Start Assessment
                    </button>
                </>
            )}

            {assessmentProgress === 'number-in-progress' && currentNumberPair && (
                <div className="number-display-area">
                    <p className="trial-counter">Trial {currentTrialIndex + 1} of {NUM_COMPARISON_TRIALS}</p>
                    <p className="number-instruction">Click the larger number:</p>
                    <div className="number-options">
                        <button
                            className="number-button"
                            onClick={() => handleNumberSelection('num1')}
                        >
                            {currentNumberPair.num1}
                        </button>
                        <button
                            className="number-button"
                            onClick={() => handleNumberSelection('num2')}
                        >
                            {currentNumberPair.num2}
                        </button>
                    </div>
                </div>
            )}

            {assessmentProgress === 'number-complete' && (
                <div className="task-complete-message">
                    <p>Number comparison task complete!</p>
                    <p>Moving to handwriting task shortly...</p>
                </div>
            )}
        </div>
    );

    // Helper to render the handwriting tab
    const renderHandwritingTab = () => (
        <div className="assessment-tab-content">
            <p className="tab-instructions">
                Draw a sample of handwriting or copy a sentence in your natural handwriting.
                The system will analyze letter formation, spacing, and pressure.
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
                    <button
                        className="tool-button"
                        onClick={clearCanvas}
                        disabled={isLoading}
                    >
                        Clear Canvas
                    </button>
                    <p className="canvas-hint">Try writing: "The quick brown fox jumps over the lazy dog."</p>
                </div>
            </div>
            
            {assessmentProgress === 'handwriting-in-progress' && handwritingImg && (
                <button
                    onClick={analyzeHandwriting}
                    className={`analyze-button ${isLoading ? 'loading' : ''}`}
                    disabled={isLoading || !handwritingImg}
                >
                    {isLoading ? 'Analyzing...' : 'Submit Handwriting Sample'}
                    {!isLoading && <svg xmlns="http://www.w3.org/2000/svg" className="arrow-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>}
                </button>
            )}
            
            {assessmentProgress === 'handwriting-complete' && (
                <div className="task-complete-message">
                    <p>Handwriting task complete!</p>
                    <p>Moving to letter arrangement task shortly...</p>
                </div>
            )}
        </div>
    );

    // Helper to render the letter arrangement tab
    const renderLetterArrangementTab = () => (
        <div className="assessment-tab-content">
            <p className="tab-instructions">
                Arrange the letters below to form a word. This task helps identify potential
                challenges with letter recognition and sequencing common in dyslexia.
            </p>
            <div className="letter-arrangement-container">
                <div className="letter-task-header">
                    <span>Arrange these letters to form a word:</span>
                    <button
                        className="tool-button"
                        onClick={resetArrangement}
                        disabled={isLoading}
                    >
                        New Word
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
                <p className="arrangement-instruction">Click an arranged letter to return it.</p>
            </div>
            
            {assessmentProgress === 'letter-in-progress' && userArrangement.length > 0 && (
                <button
                    onClick={analyzeLetterArrangement}
                    className={`analyze-button ${isLoading ? 'loading' : ''}`}
                    disabled={isLoading || userArrangement.length === 0}
                >
                    {isLoading ? 'Analyzing...' : 'Submit Letter Arrangement'}
                    {!isLoading && <svg xmlns="http://www.w3.org/2000/svg" className="arrow-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>}
                </button>
            )}
            
            {assessmentProgress === 'complete' && (
                <div className="task-complete-message">
                    <p>All assessments completed!</p>
                    <p>See your full results below.</p>
                </div>
            )}
        </div>
    );

    // Main tab content renderer
    const renderTabContent = () => {
        switch(activeTab) {
            case 'number-comparison':
                return renderNumberComparisonTab();
            case 'handwriting':
                return renderHandwritingTab();
            case 'letter-arrangement':
                return renderLetterArrangementTab();
            default:
                return renderNumberComparisonTab();
        }
    };

    // Get the current task's results
    const getCurrentTaskResults = () => {
        switch(activeTab) {
            case 'number-comparison':
                return assessmentResults.numberComparison;
            case 'handwriting':
                return assessmentResults.handwriting;
            case 'letter-arrangement':
                return assessmentResults.letterArrangement;
            default:
                return null;
        }
    };
    
    // Helper to render results for the current tab
    const renderResultsDisplay = () => {
        const results = getCurrentTaskResults();
        
        // Only render if results exist and not loading
        if (!results || isLoading) return null;

        // Determine task type from results object if available
        const taskType = results.taskType || activeTab;

        // Base disclaimer
        const disclaimer = (
            <div className="disclaimer">
                <p>Note: This analysis identifies potential patterns that may indicate learning differences.
                It is not a medical diagnosis and should be followed up with a professional assessment.</p>
            </div>
        );

        // Common structure for summary, details, interpretation, next steps
        const renderSection = (title, content) => {
            if (!content) return null;
            return (
                <div className={title.toLowerCase().replace(' ', '-') + "-section"}>
                    <h4>{title}</h4>
                    {content}
                </div>
            );
        };

        const renderList = (items) => {
            if (!items || items.length === 0) return <p>No specific points noted.</p>;
            return <ul>{items.map((item, index) => <li key={index}>{typeof item === 'object' ? `${item.type}: ${item.description}` : item}</li>)}</ul>;
        };

        let title = "Analysis Results";
        let summaryContent, detailContent, interpretationContent, nextStepsContent;

        // --- Customize based on task ---
        if (taskType === 'Number Comparison' && results.summary) {
            title = "Number Comparison Results";
            summaryContent = (
                <ul>
                    <li>Total Trials: {results.summary.totalTrials}</li>
                    <li>Correct Answers: {results.summary.correctCount}</li>
                    <li>Accuracy: {results.summary.accuracyPercentage}%</li>
                    <li>Average Response Time: {results.summary.averageResponseTimeSeconds} seconds</li>
                </ul>
            );
            interpretationContent = <p>{results.interpretation}</p>;
            nextStepsContent = renderList(results.suggested_next_steps);

        } else if (taskType === 'Handwriting' && results.characteristics) {
            title = "Handwriting Analysis Results";
            summaryContent = renderSection("Handwriting Characteristics", renderList(results.characteristics));
            detailContent = renderSection("Potential Indicators", renderList(results.indicators));
            interpretationContent = <p>{results.interpretation}</p>;
            nextStepsContent = renderList(results.suggested_next_steps);

        } else if (taskType === 'Letter Arrangement' && results.input) {
            title = "Letter Arrangement Results";
            summaryContent = (
                <ul>
                    <li>Original Word: <strong>{results.input.original_word}</strong></li>
                    <li>Your Arrangement: <strong>{results.input.user_arrangement}</strong></li>
                    <li>Accuracy: {results.accuracy ? "Correct" : "Incorrect"}</li>
                    <li>Correct Letters in Position: {results.letter_sequence_analysis?.correct_letters ?? 'N/A'} / {results.input.original_word.length}</li>
                </ul>
            );
            detailContent = renderSection("Sequencing Analysis", (
                <ul>
                    <li>Transpositions (letter order switches): {results.letter_sequence_analysis?.transpositions ?? 'N/A'}</li>
                    <li>Missing Letters: {results.letter_sequence_analysis?.missing_letters ?? 'N/A'}</li>
                </ul>
            ));
            interpretationContent = <p>{results.interpretation}</p>;
            nextStepsContent = renderList(results.suggested_next_steps);
        }

        // Render the results container
        return (
            <div className="results-section">
                <h3>{title}</h3>
                {disclaimer}
                {renderSection("Summary", summaryContent)}
                {renderSection("Details / Indicators", detailContent)}
                {renderSection("Interpretation", interpretationContent)}
                {renderSection("Suggested Next Steps", nextStepsContent)}
            </div>
        );
    };
    
    // Render final comprehensive results when all tasks are complete
    const renderComprehensiveResults = () => {
        if (assessmentProgress !== 'complete') return null;
        
        return (
            <div className="comprehensive-results">
                <h3>Comprehensive Assessment Results</h3>
                <p>All three assessments have been completed. Here's a summary of findings:</p>
                
                <div className="result-summary-cards">
                    {assessmentResults.numberComparison && (
                        <div className="result-card">
                            <h4>Number Comparison</h4>
                            <p>Accuracy: {assessmentResults.numberComparison.summary.accuracyPercentage}%</p>
                            <p>Response Time: {assessmentResults.numberComparison.summary.averageResponseTimeSeconds}s</p>
                        </div>
                    )}
                    
                    {assessmentResults.handwriting && (
                        <div className="result-card">
                            <h4>Handwriting</h4>
                            <p>Key finding: {assessmentResults.handwriting.indicators[0]?.type || "N/A"}</p>
                        </div>
                    )}
                    
                    {assessmentResults.letterArrangement && (
                        <div className="result-card">
                            <h4>Letter Arrangement</h4>
                            <p>Accuracy: {assessmentResults.letterArrangement.accuracy ? "Correct" : "Incorrect"}</p>
                        </div>
                    )}
                </div>
                
                <div className="comprehensive-interpretation">
                    <h4>Combined Interpretation</h4>
                    <p>
                        Based on the pattern of results across all assessments, the following learning profile may be indicated:
                        {assessmentResults.numberComparison && assessmentResults.numberComparison.summary.accuracyPercentage < 70 ? 
                          " Potential challenges with number sense and magnitude comparison." : " Number sense appears adequate."}
                        {assessmentResults.handwriting && assessmentResults.handwriting.indicators[0]?.type.includes("Dysgraphia") ? 
                          " Handwriting patterns suggest fine motor challenges consistent with dysgraphia traits." : " Handwriting shows typical development."}
                        {assessmentResults.letterArrangement && !assessmentResults.letterArrangement.accuracy ?
                          " Letter sequence difficulties may indicate phonological processing challenges." : " Letter sequencing appears adequate."}
                    </p>
                </div>
                
                <div className="comprehensive-next-steps">
                    <h4>Recommended Next Steps</h4>
                    <ul>
                        <li>Schedule a follow-up with an educational specialist to discuss these results.</li>
                        <li>Consider a formal evaluation if multiple indicators point to learning differences.</li>
                        {assessmentResults.numberComparison && assessmentResults.numberComparison.summary.accuracyPercentage < 70 && 
                            <li>Try structured math activities targeting number sense and magnitude.</li>}
                        {assessmentResults.handwriting && assessmentResults.handwriting.indicators[0]?.type.includes("Dysgraphia") && 
                            <li>Explore fine motor exercises and adaptive writing tools.</li>}
                        {assessmentResults.letterArrangement && !assessmentResults.letterArrangement.accuracy &&
                            <li>Practice phonological awareness and letter sequencing activities.</li>}
                    </ul>
                </div>
                
                <div className="download-section">
                    <button className="download-button">
                        Download Comprehensive Report
                    </button>
                    <p className="download-note">
                        Share this report with educators or specialists to help inform support strategies.
                    </p>
                </div>
            </div>
        );
    };

    // --- Main Component Render ---
    return (
        <div className="diagnostic-assessment-panel">
            <h2>Diagnostic Assessment Tool</h2>
            <p className="panel-description">
                This tool uses a series of cognitive and perceptual tasks to screen for 
                indicators of learning differences. Complete all three assessments for 
                a comprehensive profile.
            </p>

            {/* Tabs for different assessments */}
            <div className="assessment-tabs">
                <button
                    className={`tab-button ${activeTab === 'number-comparison' ? 'active' : ''}`}
                    onClick={() => assessmentProgress !== 'not-started' && setActiveTab('number-comparison')}
                >
                    Number Comparison
                </button>
                <button
                    className={`tab-button ${activeTab === 'handwriting' ? 'active' : ''} ${assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress' ? 'disabled' : ''}`}
                    onClick={() => assessmentProgress !== 'not-started' && assessmentProgress !== 'number-in-progress' && setActiveTab('handwriting')}
                    disabled={assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress'}
                >
                    Handwriting
                </button>
                <button
                    className={`tab-button ${activeTab === 'letter-arrangement' ? 'active' : ''} ${assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress' || assessmentProgress === 'handwriting-in-progress' ? 'disabled' : ''}`}
                    onClick={() => assessmentProgress !== 'not-started' && assessmentProgress !== 'number-in-progress' && assessmentProgress !== 'handwriting-in-progress' && setActiveTab('letter-arrangement')}
                    disabled={assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress' || assessmentProgress === 'handwriting-in-progress'}
                >
                    Letter Arrangement
                </button>
            </div>

            {/* Error display */}
            {error && <div className="error-message">{error}</div>}

            {/* Assessment content area */}
            <div className="assessment-content">
                {renderTabContent()}
            </div>

            {/* Results section */}
            {(assessmentProgress === 'number-complete' && activeTab === 'number-comparison') ||
             (assessmentProgress === 'handwriting-complete' && activeTab === 'handwriting') ||
             (assessmentProgress === 'letter-in-progress' && activeTab === 'letter-arrangement') ? (
                <div className="results-display">
                    {renderResultsDisplay()}
                </div>
            ) : null}

            {/* Comprehensive results when all assessments are complete */}
            {assessmentProgress === 'complete' && (
                <div className="comprehensive-results-container">
                    {renderComprehensiveResults()}
                </div>
            )}

            {/* Progress indicator */}
            <div className="assessment-progress-bar">
                <div className="progress-label">Assessment Progress:</div>
                <div className="progress-steps">
                    <div className={`progress-step ${assessmentProgress !== 'not-started' ? 'completed' : ''}`}>
                        Number Comparison
                    </div>
                    <div className={`progress-step ${assessmentProgress === 'handwriting-complete' || assessmentProgress === 'letter-in-progress' || assessmentProgress === 'complete' ? 'completed' : (assessmentProgress === 'handwriting-in-progress' ? 'active' : '')}`}>
                        Handwriting
                    </div>
                    <div className={`progress-step ${assessmentProgress === 'complete' ? 'completed' : (assessmentProgress === 'letter-in-progress' ? 'active' : '')}`}>
                        Letter Arrangement
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiagnosticAssessmentPanel;