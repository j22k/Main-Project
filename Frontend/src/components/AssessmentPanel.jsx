import React, { useState, useRef, useEffect } from 'react';
// import axios from 'axios'; // Keep commented out for simulated analysis
import './AssessmentPanel.css'; // Reuse the CSS file, might need adjustments

// --- Configuration for Number Comparison ---
const NUM_COMPARISON_TRIALS = 5;
const MAX_NUMBER_VALUE = 20; // Slightly reduced max value for younger children

// --- Configuration for Letter Arrangement ---
const simpleWords = [
    "cat", "dog", "sun", "run", "big", "top", "sit", "man", "bed",
    "red", "pig", "hat", "cup", "pen", "map", "bus", "fly", "sky",
    "and", "the", "see", "you", "was", "for" // Adding some common sight words
];

const DiagnosticAssessmentPanel = () => {
    // State remains largely the same
    const [assessmentResults, setAssessmentResults] = useState({
        numberComparison: null,
        handwriting: null,
        letterArrangement: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('number-comparison');
    const [handwritingImg, setHandwritingImg] = useState(null);
    const [assessmentProgress, setAssessmentProgress] = useState('not-started'); // 'not-started', 'number-in-progress', 'number-complete', 'handwriting-in-progress', 'handwriting-complete', 'letter-in-progress', 'complete'

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

    // --- Effects (largely unchanged) ---

    useEffect(() => {
        if (activeTab === 'handwriting' && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const ctx = canvas.getContext('2d');
            ctx.lineWidth = 3; // Slightly thicker line might be easier
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

    // --- Number Comparison Logic (unchanged, already relatively simple) ---

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
        if (accuracy >= 80 && averageResponseTime < 2.5) { // Adjusted thresholds slightly
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

    // --- Handwriting Logic (Updated Prompt & Simulated Analysis) ---
    const startDrawing = (e) => { /* ... unchanged ... */
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        canvasCtxRef.current.beginPath();
        canvasCtxRef.current.moveTo(x, y);
        isDrawing.current = true;
    };
    const draw = (e) => { /* ... unchanged ... */
        if (!isDrawing.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        canvasCtxRef.current.lineTo(x, y);
        canvasCtxRef.current.stroke();
    };
    const stopDrawing = () => { /* ... unchanged ... */
        if (isDrawing.current) {
            canvasCtxRef.current.closePath();
            isDrawing.current = false;
            setHandwritingImg(canvasRef.current.toDataURL('image/png'));
        }
    };
    const clearCanvas = () => { /* ... unchanged ... */
        if (canvasRef.current) {
            canvasCtxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            setHandwritingImg(null);
        }
    };

    const analyzeHandwriting = async () => {
        if (!handwritingImg) {
            setError("Please draw something first!");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            // --- SIMULATED RESPONSE (Simplified for Child Focus) ---
            console.log("Simulating handwriting analysis (child focus)...");
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Simulate some basic observations
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
                indicators: indicators, // Simplified "indicators"
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

    // --- Letter Arrangement Logic (Updated Word List & Simulated Analysis) ---
    const generateLetterArrangementTask = () => {
        // Use the new simpleWords list
        const selectedWord = simpleWords[Math.floor(Math.random() * simpleWords.length)];
        const letters = selectedWord.split('');
        // Shuffle the letters
        for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        // Ensure shuffled is different from original (important for 3-letter words)
        if (letters.join('') === selectedWord && letters.length > 1) {
             // Simple swap if it happens to be the same
             [letters[0], letters[1]] = [letters[1], letters[0]];
        }

        setLetterSequence({
            original: selectedWord,
            shuffled: letters
        });
        setUserArrangement([]); // Reset user arrangement
    };

    const handleDragStart = (letter, index) => { /* ... unchanged ... */
         setDraggedLetter({ letter, index });
    };

    const handleLetterDrop = () => { /* ... unchanged ... */
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

    const resetArrangement = () => { /* ... unchanged ... */
        generateLetterArrangementTask();
    };

    const removeArrangedLetter = (index) => { /* ... unchanged ... */
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
            setError("Move the letters to make a word first!");
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const userWord = userArrangement.join('');
            const originalWord = letterSequence.original;
            const accuracy = userWord === originalWord;

            // Simple analysis helpers (placeholders for potential future logic)
            const countTranspositions = (user, orig) => {
                let count = 0;
                // Simple check for adjacent swaps in short words
                 if (user.length === orig.length && user.length > 1) {
                     for (let i = 0; i < user.length - 1; i++) {
                         if (user[i] === orig[i+1] && user[i+1] === orig[i]) count++;
                     }
                 }
                return count;
            };

            // SIMULATED RESPONSE (Simplified for Child Focus)
            const interpretation = accuracy
                ? `Yes! You correctly spelled "${originalWord}". Great job!`
                : `Good try! The word was "${originalWord}". Putting letters in the right order can be tricky.`;

            const simulatedResponse = {
                taskType: "Letter Arrangement",
                input: { original_word: originalWord, user_arrangement: userWord },
                accuracy: accuracy,
                letter_sequence_analysis: { // Simplified analysis
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

    // --- UI Rendering ---

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
            {/* ... rest of number comparison rendering is okay ... */}
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
                    onMouseLeave={stopDrawing} // Important to stop drawing if mouse leaves canvas
                />
                <div className="canvas-tools">
                    <button className="tool-button" onClick={clearCanvas} disabled={isLoading}>
                        Clear Drawing
                    </button>
                    {/* Updated Hint */}
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

    const renderLetterArrangementTab = () => (
        <div className="assessment-tab-content">
             <p className="tab-instructions">
                Last one! Drag the letters from the top box into the bottom box to spell a word.
            </p>
            <div className="letter-arrangement-container">
                <div className="letter-task-header">
                    <span>Arrange these letters:</span>
                     {/* Keep New Word button, maybe less prominent if confusing */}
                     <button className="tool-button" onClick={resetArrangement} disabled={isLoading}>
                         Try a Different Word
                     </button>
                </div>
                <div className="letter-bank">
                     {letterSequence.shuffled?.map((letter, index) => (
                        // Make letters slightly larger/easier to grab if needed via CSS
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
                            // Click to remove is good for kids who might mis-drop
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

    // Main tab content renderer (unchanged)
    const renderTabContent = () => { /* ... unchanged ... */
        switch(activeTab) {
            case 'number-comparison': return renderNumberComparisonTab();
            case 'handwriting': return renderHandwritingTab();
            case 'letter-arrangement': return renderLetterArrangementTab();
            default: return renderNumberComparisonTab();
        }
    };

    // Get current task results (unchanged)
     const getCurrentTaskResults = () => { /* ... unchanged ... */
        switch(activeTab) {
            case 'number-comparison': return assessmentResults.numberComparison;
            case 'handwriting': return assessmentResults.handwriting;
            case 'letter-arrangement': return assessmentResults.letterArrangement;
            default: return null;
        }
    };

    // Render results display (updated content based on simplified analysis)
    const renderResultsDisplay = () => {
        const results = getCurrentTaskResults();
        if (!results || isLoading) return null;

        const taskType = results.taskType || activeTab;
        const disclaimer = ( // Simplified disclaimer
            <div className="disclaimer">
                <p>Remember: This helps us see what you're good at and what we can practice! It's not a test.</p>
            </div>
        );

        const renderSection = (title, content) => { /* ... unchanged ... */
            if (!content) return null;
            return ( <div className={title.toLowerCase().replace(/ /g, '-') + "-section"}><h4>{title}</h4>{content}</div> );
        };
        const renderList = (items) => { /* ... unchanged ... */
             if (!items || items.length === 0) return <p>Nothing specific noted here.</p>;
             return <ul>{items.map((item, index) => <li key={index}>{typeof item === 'object' ? `${item.type}: ${item.description}` : item}</li>)}</ul>;
        };

        let title = "How You Did!";
        let summaryContent, detailContent, interpretationContent, nextStepsContent;

        if (taskType === 'Number Comparison' && results.summary) {
            title = "Numbers Result";
            summaryContent = (<ul><li>Correct Answers: {results.summary.correctCount} out of {results.summary.totalTrials}</li><li>Accuracy: {results.summary.accuracyPercentage}%</li><li>Average Speed: {results.summary.averageResponseTimeSeconds} seconds per question</li></ul>);
            interpretationContent = <p>{results.interpretation}</p>;
            nextStepsContent = renderList(results.suggested_next_steps);
        } else if (taskType === 'Handwriting' && results.characteristics) {
            title = "Drawing Result";
             // Combine characteristics and indicators for simpler view
            summaryContent = renderSection("What We Saw", renderList(results.characteristics));
            // detailContent = renderSection("Potential Indicators", renderList(results.indicators)); // Maybe omit this section for kids
            interpretationContent = <p>{results.interpretation}</p>;
            nextStepsContent = renderList(results.suggested_next_steps);
        } else if (taskType === 'Letter Arrangement' && results.input) {
            title = "Word Puzzle Result";
            summaryContent = (<ul><li>The Word Was: <strong>{results.input.original_word}</strong></li><li>Your Word: <strong>{results.input.user_arrangement}</strong></li><li>Correct?: {results.accuracy ? "Yes!" : "Not quite"}</li></ul>);
            // detailContent = renderSection("Details", (<ul><li>Letters in right spot: {results.letter_sequence_analysis?.correct_placement ?? 'N/A'}</li></ul>)); // Maybe simplify or omit
            interpretationContent = <p>{results.interpretation}</p>;
            nextStepsContent = renderList(results.suggested_next_steps);
        }

        return (
            <div className="results-section">
                <h3>{title}</h3>
                {disclaimer}
                {renderSection("Summary", summaryContent)}
                {/* {renderSection("Details", detailContent)} */}
                {renderSection("Let's Talk About It", interpretationContent)}
                {renderSection("Fun Things To Try Next", nextStepsContent)}
            </div>
        );
    };

    // Render comprehensive results (updated language)
    const renderComprehensiveResults = () => {
        if (assessmentProgress !== 'complete') return null;

        // Simplified combined interpretation logic
        let combinedInterpretation = "Looking at all your work: ";
        let needsPracticeAreas = [];
        if (assessmentResults.numberComparison && assessmentResults.numberComparison.summary.accuracyPercentage < 70) {
            needsPracticeAreas.push("comparing numbers");
        }
        if (assessmentResults.handwriting && assessmentResults.handwriting.indicators.length > 0) {
            needsPracticeAreas.push("drawing smooth lines and shapes");
        }
        if (assessmentResults.letterArrangement && !assessmentResults.letterArrangement.accuracy) {
            needsPracticeAreas.push("putting letters in the right order for words");
        }

        if (needsPracticeAreas.length === 0) {
             combinedInterpretation += "You showed good skills in numbers, drawing, and word puzzles!";
        } else {
             combinedInterpretation += `It looks like practicing ${needsPracticeAreas.join(' and ')} could be helpful. Everyone has things they are learning!`;
        }


        return (
            <div className="comprehensive-results">
                <h3>All Done! Assessment Summary</h3>
                <p>You finished all the activities! Here's a quick look:</p>

                <div className="result-summary-cards">
                    {/* Card content adjusted slightly */}
                    {assessmentResults.numberComparison && (<div className="result-card"><h4>Numbers</h4><p>Accuracy: {assessmentResults.numberComparison.summary.accuracyPercentage}%</p></div>)}
                    {assessmentResults.handwriting && (<div className="result-card"><h4>Drawing</h4><p>{assessmentResults.handwriting.interpretation.includes("Good effort") ? "Good effort shown!" : "Practice area noted."}</p></div>)}
                    {assessmentResults.letterArrangement && (<div className="result-card"><h4>Word Puzzle</h4><p>Word Correct?: {assessmentResults.letterArrangement.accuracy ? "Yes" : "No"}</p></div>)}
                </div>

                <div className="comprehensive-interpretation">
                    <h4>Putting It All Together</h4>
                    <p>{combinedInterpretation}</p>
                </div>

                <div className="comprehensive-next-steps">
                     <h4>What's Next?</h4>
                    <ul>
                        <li>Share how you did with a grown-up or teacher!</li>
                        {/* Simplified suggestions */}
                        {needsPracticeAreas.includes("comparing numbers") && <li>Play counting games or use blocks to compare amounts.</li>}
                        {needsPracticeAreas.includes("drawing smooth lines and shapes") && <li>Have fun with drawing, play-doh, or tracing!</li>}
                        {needsPracticeAreas.includes("putting letters in the right order for words") && <li>Use letter magnets or tiles to build simple words.</li>}
                        <li>Keep learning and having fun!</li>
                    </ul>
                </div>

                 {/* Keep download, but rephrase note */}
                 <div className="download-section">
                    <button className="download-button">
                        Download Results Summary
                    </button>
                    <p className="download-note">
                        You can show this summary to your teacher or family.
                    </p>
                </div>
            </div>
        );
    };

    // --- Main Component Render ---
    return (
        <div className="diagnostic-assessment-panel">
            {/* Simplified Title and Description */}
            <h2>Let's Play & Learn!</h2>
            <p className="panel-description">
                We'll do three short activities: comparing numbers, drawing, and making words.
                This helps us see what you're great at and what we can practice together!
            </p>

            {/* Tabs - Simplified Names & Logic Unchanged */}
            <div className="assessment-tabs">
                 <button className={`tab-button ${activeTab === 'number-comparison' ? 'active' : ''}`} onClick={() => assessmentProgress !== 'not-started' && setActiveTab('number-comparison')}>
                     Numbers
                 </button>
                 <button className={`tab-button ${activeTab === 'handwriting' ? 'active' : ''} ${assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress' ? 'disabled' : ''}`} onClick={() => assessmentProgress !== 'not-started' && assessmentProgress !== 'number-in-progress' && setActiveTab('handwriting')} disabled={assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress'}>
                     Drawing
                 </button>
                 <button className={`tab-button ${activeTab === 'letter-arrangement' ? 'active' : ''} ${assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress' || assessmentProgress === 'handwriting-in-progress' ? 'disabled' : ''}`} onClick={() => assessmentProgress !== 'not-started' && assessmentProgress !== 'number-in-progress' && assessmentProgress !== 'handwriting-in-progress' && setActiveTab('letter-arrangement')} disabled={assessmentProgress === 'not-started' || assessmentProgress === 'number-in-progress' || assessmentProgress === 'handwriting-in-progress'}>
                     Word Puzzle
                 </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="assessment-content">
                {renderTabContent()}
            </div>

            {/* Results Display Logic Unchanged */}
             {(assessmentProgress === 'number-complete' && activeTab === 'number-comparison') ||
             (assessmentProgress === 'handwriting-complete' && activeTab === 'handwriting') ||
             // Show letter arrangement results immediately after submission, even if analysis is pending (optional, but maybe less confusing than waiting)
             (assessmentProgress === 'complete' && activeTab === 'letter-arrangement') ? ( // Updated condition slightly
                <div className="results-display">
                    {renderResultsDisplay()}
                </div>
            ) : null}


            {assessmentProgress === 'complete' && (
                <div className="comprehensive-results-container">
                    {renderComprehensiveResults()}
                </div>
            )}

            {/* Progress Bar - Simplified Step Names */}
            <div className="assessment-progress-bar">
                <div className="progress-label">Your Progress:</div>
                <div className="progress-steps">
                    <div className={`progress-step ${assessmentProgress !== 'not-started' ? 'completed' : ''}`}>Numbers</div>
                    <div className={`progress-step ${assessmentProgress === 'handwriting-complete' || assessmentProgress === 'letter-in-progress' || assessmentProgress === 'complete' ? 'completed' : (assessmentProgress === 'handwriting-in-progress' ? 'active' : '')}`}>Drawing</div>
                    <div className={`progress-step ${assessmentProgress === 'complete' ? 'completed' : (assessmentProgress === 'letter-in-progress' ? 'active' : '')}`}>Word Puzzle</div>
                </div>
            </div>
        </div>
    );
};

export default DiagnosticAssessmentPanel;