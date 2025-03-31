import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ProfilePage.css';

// Import chart components from recharts
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const ProfilePage = () => {
  const [profile, setProfile] = useState({});
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [learningDisabilities, setLearningDisabilities] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        setLoading(true);
        
        // Fetch user profile
        const profileResponse = await axios.get('http://localhost:5000/api/user/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setProfile(profileResponse.data);

        // Fetch user assessments
        const assessmentsResponse = await axios.get('http://localhost:5000/assessments', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        // Set assessments and extract learning disabilities data if available
        const assessmentData = assessmentsResponse.data;
        setAssessments(assessmentData);
        
        // Check if there's Gemini response with learning disabilities analysis
        if (assessmentData.length > 0 && assessmentData[0].gemini_response && 
            assessmentData[0].gemini_response.learningDisabilities) {
          setLearningDisabilities(assessmentData[0].gemini_response.learningDisabilities);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile data:', err);
        setError('Failed to load profile data. Please try again later.');
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [navigate]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Prepare data for radar chart
  const prepareRadarData = () => {
    if (!learningDisabilities || Object.keys(learningDisabilities).length === 0) {
      return [];
    }

    return Object.entries(learningDisabilities).map(([key, value]) => ({
      subject: key,
      confidenceScore: value.confidenceScore * 100, // Convert to percentage
      fullMark: 100
    }));
  };

  // Prepare data for number comparison performance chart
  const prepareNumberComparisonData = (assessment) => {
    if (!assessment.numberComparison || !assessment.numberComparison.detailedTrials) {
      return [];
    }

    return assessment.numberComparison.detailedTrials.map((trial, index) => ({
      name: `Trial ${index + 1}`,
      responseTime: parseFloat(trial.responseTime),
      isCorrect: trial.isCorrect ? 1 : 0,
      pair: `${trial.pair.num1} vs ${trial.pair.num2}`
    }));
  };

  // Render learning disabilities analysis
  const renderLearningDisabilitiesAnalysis = () => {
    if (!learningDisabilities || Object.keys(learningDisabilities).length === 0) {
      return null;
    }

    const radarData = prepareRadarData();

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Learning Analysis</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-3">Potential Learning Considerations</h4>
            
            {Object.entries(learningDisabilities).map(([key, value]) => (
              <div key={key} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{key}</span>
                  <span className="text-sm text-gray-500">{(value.confidenceScore * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${value.confidenceScore * 100}%` }}
                  ></div>
                </div>
                
                {value.indicators && value.indicators.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Indicators:</p>
                    <ul className="list-disc pl-5 text-xs text-gray-600">
                      {value.indicators.map((indicator, idx) => (
                        <li key={idx}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  name="Learning Profile"
                  dataKey="confidenceScore"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  // Render student profile from Gemini response
  const renderStudentProfile = (assessment) => {
    if (!assessment || !assessment.gemini_response || !assessment.gemini_response.studentProfile) {
      return null;
    }

    const studentProfile = assessment.gemini_response.studentProfile;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Student Learning Profile</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {studentProfile.taskPerformance.numberComparison && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-semibold text-gray-700 mb-2">Number Comparison</h4>
              <p className="text-sm text-gray-600 mb-2">{studentProfile.taskPerformance.numberComparison.interpretation}</p>
              <div className="flex space-x-4 mb-2">
                <div>
                  <p className="text-xs text-gray-500">Accuracy</p>
                  <p className="text-lg font-semibold text-blue-600">{studentProfile.taskPerformance.numberComparison.accuracyPercentage}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Response Time</p>
                  <p className="text-lg font-semibold text-purple-600">{studentProfile.taskPerformance.numberComparison.averageResponseTime}s</p>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-700 mb-1">Suggestions:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600">
                {studentProfile.taskPerformance.numberComparison.suggestedNextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}
          
          {studentProfile.taskPerformance.handwriting && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-semibold text-gray-700 mb-2">Handwriting</h4>
              <p className="text-sm text-gray-600 mb-2">{studentProfile.taskPerformance.handwriting.interpretation}</p>
              
              {studentProfile.taskPerformance.handwriting.characteristics && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">Characteristics:</p>
                  <ul className="list-disc pl-5 text-xs text-gray-600">
                    {studentProfile.taskPerformance.handwriting.characteristics.map((characteristic, idx) => (
                      <li key={idx}>{characteristic}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-xs font-medium text-gray-700 mb-1">Suggestions:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600">
                {studentProfile.taskPerformance.handwriting.suggestedNextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}
          
          {studentProfile.taskPerformance.letterArrangement && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-semibold text-gray-700 mb-2">Letter Arrangement</h4>
              <div className="flex items-center mb-2">
                <div className="mr-3">
                  <span className="text-xs text-gray-500">Original Word:</span>
                  <span className="ml-1 font-medium">{studentProfile.taskPerformance.letterArrangement.originalWord}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Accuracy:</span>
                  <span className={`ml-1 font-medium ${studentProfile.taskPerformance.letterArrangement.accuracy ? 'text-green-600' : 'text-red-600'}`}>
                    {studentProfile.taskPerformance.letterArrangement.accuracy ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{studentProfile.taskPerformance.letterArrangement.interpretation}</p>
              <p className="text-xs font-medium text-gray-700 mb-1">Suggestions:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600">
                {studentProfile.taskPerformance.letterArrangement.suggestedNextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render emotion analysis if available
  const renderEmotionAnalysis = (assessment) => {
    if (!assessment || !assessment.gemini_response || !assessment.gemini_response.emotionAnalysis ||
        !assessment.gemini_response.emotionAnalysis.dominantEmotions || 
        assessment.gemini_response.emotionAnalysis.dominantEmotions.length === 0) {
      return null;
    }

    const emotionAnalysis = assessment.gemini_response.emotionAnalysis;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Emotion Analysis</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-2">Dominant Emotions</h4>
            {emotionAnalysis.dominantEmotions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {emotionAnalysis.dominantEmotions.map((emotion, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {emotion}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No dominant emotions detected</p>
            )}
          </div>
          
          {Object.keys(emotionAnalysis.emotionOccurrences).length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-700 mb-2">Emotion Occurrences</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(emotionAnalysis.emotionOccurrences).map(([emotion, count]) => (
                  <div key={emotion} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">{emotion}</span>
                    <span className="text-sm font-medium bg-gray-200 px-2 py-1 rounded">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render assessment summary
  const renderAssessmentSummary = (assessment) => {
    if (!assessment) return null;
    
    const hasNumberComparison = assessment.numberComparison;
    const hasHandwriting = assessment.handwriting;
    const hasLetterArrangement = assessment.letterArrangement;
    
    const tasks = [];
    if (hasNumberComparison) tasks.push("Number Comparison");
    if (hasHandwriting) tasks.push("Handwriting");
    if (hasLetterArrangement) tasks.push("Letter Arrangement");
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Latest Assessment Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Date Completed</p>
            <p className="text-lg font-semibold text-blue-600">{formatDate(assessment.completedAt)}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Tasks Completed</p>
            <p className="text-lg font-semibold text-green-600">{tasks.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Overall Progress</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${tasks.length / 3 * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {hasNumberComparison && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-md font-semibold text-gray-700">Number Comparison Performance</h4>
              <span className={`px-2 py-1 rounded text-xs ${assessment.numberComparison.summary.accuracyPercentage > 60 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {assessment.numberComparison.summary.accuracyPercentage}% Accuracy
              </span>
            </div>
            
            <div className="mb-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 text-left text-sm">Trial</th>
                      <th className="border p-2 text-left text-sm">Numbers</th>
                      <th className="border p-2 text-left text-sm">Selection</th>
                      <th className="border p-2 text-left text-sm">Correct?</th>
                      <th className="border p-2 text-left text-sm">Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.numberComparison.detailedTrials.map((trial, idx) => (
                      <tr key={idx} className={trial.isCorrect ? "bg-green-50" : "bg-red-50"}>
                        <td className="border p-2 text-sm">{idx + 1}</td>
                        <td className="border p-2 text-sm">{trial.pair.num1} vs {trial.pair.num2}</td>
                        <td className="border p-2 text-sm">{trial.selection === "num1" ? trial.pair.num1 : trial.pair.num2}</td>
                        <td className="border p-2 text-sm">{trial.isCorrect ? "✓" : "✗"}</td>
                        <td className="border p-2 text-sm">{trial.responseTime}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prepareNumberComparisonData(assessment)}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="responseTime" fill="#8884d8" name="Response Time (s)" />
                  <Bar dataKey="isCorrect" fill="#82ca9d" name="Correct (1=Yes, 0=No)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <p className="text-sm text-gray-700">{assessment.numberComparison.interpretation}</p>
            
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Suggested Next Steps:</p>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {assessment.numberComparison.suggested_next_steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {hasHandwriting && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-md font-semibold text-gray-700">Handwriting Analysis</h4>
            </div>
            
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/3 mb-4 md:mb-0 md:mr-4">
                {assessment.handwriting.imageData && (
                  <div className="border rounded p-2">
                    <img 
                      src={`http://localhost:5000/uploads/${assessment.handwriting.imageData}`} 
                      alt="Handwriting sample" 
                      className="w-full h-auto" 
                    />
                  </div>
                )}
              </div>
              
              <div className="md:w-2/3">
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700">Characteristics:</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    {assessment.handwriting.characteristics.map((characteristic, idx) => (
                      <li key={idx}>{characteristic}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700">Indicators:</p>
                  {assessment.handwriting.indicators && assessment.handwriting.indicators.length > 0 ? (
                    assessment.handwriting.indicators.map((indicator, idx) => (
                      <div key={idx} className="mb-1 pl-5">
                        <span className="font-medium text-sm">{indicator.type}:</span> {indicator.description}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 pl-5">No specific indicators found.</p>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 mb-3">{assessment.handwriting.interpretation}</p>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Suggested Next Steps:</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    {assessment.handwriting.suggested_next_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {hasLetterArrangement && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-md font-semibold text-gray-700">Letter Arrangement</h4>
              <span className={`px-2 py-1 rounded text-xs ${assessment.letterArrangement.accuracy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {assessment.letterArrangement.accuracy ? 'Correct' : 'Needs Practice'}
              </span>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex justify-center items-center space-x-8">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Original Word</p>
                  <div className="flex mt-2">
                    {assessment.letterArrangement.input.original_word.split('').map((letter, idx) => (
                      <div key={idx} className="w-8 h-8 flex items-center justify-center border border-blue-400 bg-blue-50 rounded mx-1 font-bold text-blue-600">
                        {letter}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-2xl text-gray-400">→</div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">User Arrangement</p>
                  <div className="flex mt-2">
                    {assessment.letterArrangement.input.user_arrangement.split('').map((letter, idx) => {
                      const originalWord = assessment.letterArrangement.input.original_word;
                      const isCorrectPosition = idx < originalWord.length && letter === originalWord[idx];
                      return (
                        <div 
                          key={idx} 
                          className={`w-8 h-8 flex items-center justify-center border rounded mx-1 font-bold ${
                            isCorrectPosition 
                              ? 'border-green-400 bg-green-50 text-green-600' 
                              : 'border-red-400 bg-red-50 text-red-600'
                          }`}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500">Letter Sequence Analysis</p>
                <div className="mt-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-700">Transpositions:</span>
                    <span className="text-sm font-medium text-blue-600">{assessment.letterArrangement.letter_sequence_analysis.transpositions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-700">Correct Placement:</span>
                    <span className="text-sm font-medium text-green-600">{assessment.letterArrangement.letter_sequence_analysis.correct_placement}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-3">{assessment.letterArrangement.interpretation}</p>
            
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Suggested Next Steps:</p>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {assessment.letterArrangement.suggested_next_steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
            <button 
              onClick={() => navigate('/learning')} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
            >
              Start Learning
            </button>
          </div>
          
          {!loading && profile && (
            <div className="border-b pb-4 mb-4">
              <div className="flex flex-col md:flex-row md:items-center">
                <div className="bg-blue-100 rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold text-blue-800 mb-4 md:mb-0 md:mr-6">
                  {profile.username ? profile.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">{profile.username || 'User'}</h2>
                  <p className="text-gray-600">{profile.email}</p>
                  <p className="text-sm text-gray-500">Member since: {profile.created_at ? formatDate(profile.created_at) : 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading assessment data...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-red-600 text-xl mb-4">Error</div>
            <p className="text-gray-700">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
            >
              Try Again
            </button>
          </div>
        ) : assessments && assessments.length > 0 ? (
          <div>
            {/* Assessment summary */}
            {renderAssessmentSummary(assessments[0])}
            
            {/* Student profile from Gemini response */}
            {renderStudentProfile(assessments[0])}
            
            {/* Learning disabilities analysis */}
            {renderLearningDisabilitiesAnalysis()}
            
            {/* Emotion analysis */}
            {renderEmotionAnalysis(assessments[0])}
            
            <h2 className="text-xl font-bold mb-4 text-gray-800">Detailed Assessment History</h2>
            {assessments.map((assessment, index) => (
              <div key={assessment._id} className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Assessment #{index + 1} - Completed on {formatDate(assessment.completedAt)}
                  </h3>
                  <p className="text-sm text-gray-500">Assessment ID: {assessment._id.$oid || assessment._id}</p>
                  <p className="text-sm text-gray-500">User Email: {assessment.userEmail}</p>
                </div>

                {/* Number Comparison Section */}
                {assessment.numberComparison && (
                  <div className="mb-6">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 rounded-full p-2 mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h4 className="text-md font-semibold text-gray-700">Number Comparison Results</h4>
                    </div>
                    
                    <div className="px-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-500">Accuracy</p>
                          <p className="text-lg font-semibold text-blue-600">{assessment.numberComparison.summary.accuracyPercentage}%</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-500">Average Response Time</p>
                          <p className="text-lg font-semibold text-green-600">{assessment.numberComparison.summary.averageResponseTime}s</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-500">Total Trials</p>
                          <p className="text-lg font-semibold text-purple-600">{assessment.numberComparison.detailedTrials.length}</p>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-3">{assessment.numberComparison.interpretation}</p>
                    </div>
                  </div>
                )}

                {/* Handwriting Section */}
                {assessment.handwriting && (
                  <div className="mb-6">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 rounded-full p-2 mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </div>
                      <h4 className="text-md font-semibold text-gray-700">Handwriting Analysis</h4>
                    </div>
                    
                    <div className="px-4">
                      {assessment.handwriting.imageData && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">Writing Sample</p>
                          <img 
                            src={`http://localhost:5000/uploads/${assessment.handwriting.imageData}`} 
                            alt="Handwriting sample" 
                            className="max-w-full h-auto border rounded" 
                          />
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-700 mb-3">{assessment.handwriting.interpretation}</p>
                    </div>
                  </div>
                )}

                {/* Letter Arrangement Section */}
                {assessment.letterArrangement && (
                  <div>
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 rounded-full p-2 mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                        </svg>
                      </div>
                      <h4 className="text-md font-semibold text-gray-700">Letter Arrangement Results</h4>
                    </div>
                    
                    <div className="px-4">
                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="flex justify-center items-center space-x-8">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Original Word</p>
                            <div className="flex mt-2">
                              {assessment.letterArrangement.input.original_word.split('').map((letter, idx) => (
                                <div key={idx} className="w-8 h-8 flex items-center justify-center border border-blue-400 bg-blue-50 rounded mx-1 font-bold text-blue-600">
                                  {letter}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="text-2xl text-gray-400">→</div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500">User Arrangement</p>
                            <div className="flex mt-2">
                              {assessment.letterArrangement.input.user_arrangement.split('').map((letter, idx) => (
                                <div 
                                  key={idx} 
                                  className={`w-8 h-8 flex items-center justify-center border rounded mx-1 font-bold ${
                                    idx < assessment.letterArrangement.input.original_word.length && 
                                    letter === assessment.letterArrangement.input.original_word[idx] 
                                      ? 'border-green-400 bg-green-50 text-green-600' 
                                      : 'border-red-400 bg-red-50 text-red-600'
                                  }`}
                                >
                                  {letter}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-3">{assessment.letterArrangement.interpretation}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Assessments Found</h3>
            <p className="text-gray-600 mb-4">You haven't completed any assessments yet.</p>
            <button 
              onClick={() => navigate('/assessment')} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
            >
              Take Your First Assessment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;