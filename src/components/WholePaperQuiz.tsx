import React, { useState, useEffect } from 'react';
import { ThemeIcon } from './ThemeIcon';
import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import { motion } from 'motion/react';
import { Question } from '../types';
import { renderQuestionImage } from '../utils/pdfParser';
import BookmarkModal from './BookmarkModal';
import { isGlobalPremium, hasPremiumForLevel } from '../utils/premium';

import { ThemeName, themes } from '../theme';

interface WholePaperQuizProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  questions: Question[];
  subject: string;
  examCode: string;
  isParsingFinished: boolean;
  onEnd: (stats: {total: number, correct: number}) => void;
  onAnswer?: (totalAnswered: number, correctAnswers: number, deltaCorrect: number, isNewAnswer: boolean) => void;
  opponentScore?: number;
  opponentProgress?: number;
  userProfile?: any;
  activeTheme: ThemeName;
  instantFeedback?: boolean;
  level?: string;
}

export default function WholePaperQuiz({ pdf, questions, subject, examCode, isParsingFinished, onEnd, onAnswer, opponentScore, opponentProgress, userProfile, activeTheme, instantFeedback, level }: WholePaperQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Sort questions by qNumber
  const sortedQuestions = [...questions].sort((a, b) => a.qNumber - b.qNumber);
  const currentQuestion = sortedQuestions[currentIndex];

  useEffect(() => {
    setExplanation(null);
    setIsExplaining(false);
  }, [currentQuestion]);

  useEffect(() => {
    let isMounted = true;
    
    const extractCurrentImage = async () => {
      if (!currentQuestion || imageMap[currentQuestion.qNumber]) return;
      
      try {
        const imgUrl = await renderQuestionImage(pdf, currentQuestion);
        if (isMounted && imgUrl) {
          setImageMap(prev => ({ ...prev, [currentQuestion.qNumber]: imgUrl }));
        }
      } catch (error) {
        console.error('Error extracting question image:', error);
      }
    };
    
    extractCurrentImage();
    
    return () => {
      isMounted = false;
    };
  }, [pdf, currentQuestion]);

  const handleAnswer = (option: string) => {
    if (!currentQuestion || isSubmitted) return;
    if (instantFeedback && answers[currentQuestion.qNumber]) return;
    
    // Daily Economics Limit Check
    if (subject === 'economics' && userProfile && !hasPremiumForLevel(userProfile, level as any || 'extended')) {
      const today = new Date().toISOString().split('T')[0];
      const dailyEcon = userProfile?.lastEconResetDate === today ? (userProfile?.dailyEconAnswered || 0) : 0;
      if (dailyEcon >= 10) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
        return;
      }
    }
    
    setAnswers(prev => {
      const prevOption = prev[currentQuestion.qNumber];
      const wasCorrect = prevOption === currentQuestion.answer;
      const isCorrect = option === currentQuestion.answer;
      
      let deltaCorrect = 0;
      if (!wasCorrect && isCorrect) deltaCorrect = 1;
      else if (wasCorrect && !isCorrect) deltaCorrect = -1;
      
      const isNewAnswer = !(currentQuestion.qNumber in prev);
      const newAnswers = { ...prev, [currentQuestion.qNumber]: option };
      
      if (onAnswer) {
        let correct = 0;
        let total = Object.keys(newAnswers).length;
        for (const [qNumStr, ans] of Object.entries(newAnswers)) {
          const qNum = parseInt(qNumStr);
          const q = sortedQuestions.find(q => q.qNumber === qNum);
          if (q && q.answer === ans) correct++;
        }
        onAnswer(total, correct, deltaCorrect, isNewAnswer);
      }
      
      return newAnswers;
    });
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    setFlags(prev => {
      const newFlags = new Set(prev);
      if (newFlags.has(currentQuestion.qNumber)) {
        newFlags.delete(currentQuestion.qNumber);
      } else {
        newFlags.add(currentQuestion.qNumber);
      }
      return newFlags;
    });
  };

  const generateExplanation = async () => {
    const qImage = currentQuestion ? imageMap[currentQuestion.qNumber] : null;
    if (!currentQuestion || !qImage) return;
    
    setIsExplaining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const base64Data = qImage.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/png'
            }
          },
          `Explain step-by-step why the correct answer to this ${subject} multiple choice question is ${currentQuestion.answer}. Keep it concise and educational.`
        ]
      });
      
      setExplanation(response.text);
    } catch (error) {
      console.error('Error generating explanation:', error);
      setExplanation("Sorry, I couldn't generate an explanation right now.");
    } finally {
      setIsExplaining(false);
    }
  };

  const calculateStats = () => {
    let correct = 0;
    let total = sortedQuestions.length;
    
    for (const [qNumStr, ans] of Object.entries(answers)) {
      const qNum = parseInt(qNumStr);
      const q = sortedQuestions.find(q => q.qNumber === qNum);
      if (q && q.answer === ans) {
        correct++;
      }
    }
    
    return { correct, total };
  };

  const playRetroSound = () => {
    if (isGlobalPremium(userProfile) && userProfile.theme === 'retro') {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const handleEnd = () => {
    if (!isSubmitted) {
      const answeredCount = Object.keys(answers).length;
      if (answeredCount < sortedQuestions.length) {
        setShowConfirmSubmit(true);
      } else {
        setIsSubmitted(true);
        playRetroSound();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      onEnd(calculateStats());
    }
  };

  const confirmSubmit = () => {
    setShowConfirmSubmit(false);
    setIsSubmitted(true);
    playRetroSound();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedAnswer = currentQuestion ? answers[currentQuestion.qNumber] : null;
  const isCorrect = currentQuestion && selectedAnswer ? selectedAnswer === currentQuestion.answer : null;

  if (sortedQuestions.length === 0) {
    if (isParsingFinished) {
      return (
        <div className={`flex flex-col items-center justify-center py-24 ${themes[activeTheme].textSecondary}`}>
          <p className="font-medium text-xl">No questions found for this exam.</p>
        </div>
      );
    }
    return (
      <div className={`flex flex-col items-center justify-center py-24 ${themes[activeTheme].textSecondary}`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${themes[activeTheme].accent} mb-6`}></div>
        <p className="font-medium text-xl">Loading exam questions...</p>
        <p className="text-sm mt-2 opacity-75">This may take a few seconds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {showConfirmSubmit && (
        <div className={`fixed inset-0 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm flex items-center justify-center p-4 z-50`}>
          <div className={`${themes[activeTheme].card} rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border ${themes[activeTheme].border} animate-in fade-in zoom-in-95 duration-200`}>
            <h3 className={`text-2xl font-bold ${themes[activeTheme].textPrimary} mb-4`}>Submit Exam?</h3>
            <p className={`${themes[activeTheme].textSecondary} mb-8`}>
              You have only answered {Object.keys(answers).length} out of {sortedQuestions.length} questions. Are you sure you want to submit?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className={`flex-1 px-6 py-3 ${themes[activeTheme].iconContainer} ${themes[activeTheme].textPrimary} font-bold rounded-xl transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className={`flex-1 px-6 py-3 ${themes[activeTheme].accentBg} text-white font-bold rounded-xl transition-colors`}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-row justify-between items-center gap-2 mb-1">
        <div className="flex items-center gap-3">
          <div className={`text-sm font-medium ${themes[activeTheme].textSecondary} uppercase tracking-wider`}>
            <span className={`font-bold ${themes[activeTheme].accent}`}>{subject}</span> • {examCode} • Q{currentQuestion?.qNumber}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {opponentScore !== undefined && (
            <div className={`text-sm font-medium ${themes[activeTheme].textSecondary} ${themes[activeTheme].iconContainer} px-3 py-1 rounded-full border ${themes[activeTheme].border}`}>
              Opponent: {opponentScore}
            </div>
          )}
          <button 
            onClick={() => setShowBookmarkModal(true)}
            className={`text-sm font-medium ${themes[activeTheme].successText} ${themes[activeTheme].successBg} px-4 py-2 rounded-full border ${themes[activeTheme].border} transition-colors flex items-center`}
          >
            <ThemeIcon icon="Bookmark" theme={activeTheme} className="w-4 h-4 mr-1" /> Bookmark
          </button>
          <button 
            onClick={handleEnd}
            className={`text-sm font-medium ${themes[activeTheme].errorText} ${themes[activeTheme].errorBg} px-4 py-2 rounded-full border ${themes[activeTheme].border} transition-colors flex items-center`}
          >
            <ThemeIcon icon="Flag" theme={activeTheme} className="w-4 h-4 mr-1" /> {isSubmitted ? 'Finish Review' : 'Submit Exam'}
          </button>
        </div>
      </div>

      {isSubmitted && (
        <div className={`${themes[activeTheme].card} p-6 rounded-3xl shadow-sm mb-6 text-center border ${themes[activeTheme].border}`}>
          <h2 className={`text-2xl font-bold ${themes[activeTheme].textPrimary} mb-2`}>Exam Submitted!</h2>
          <p className={`${themes[activeTheme].textSecondary} mb-4`}>
            You scored <span className={`font-bold ${themes[activeTheme].accent} text-xl`}>{calculateStats().correct || 0}</span> out of <span className={`font-bold ${themes[activeTheme].textPrimary} text-xl`}>{sortedQuestions.length}</span>
          </p>
          <p className={`text-sm ${themes[activeTheme].textSecondary}`}>
            Review your answers below. Click "Finish Review" when you're done.
          </p>
        </div>
      )}

      {/* Navigation Grid */}
      <div className={`${themes[activeTheme].card} p-4 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar border ${themes[activeTheme].border}`}>
        <div className="flex gap-2 min-w-max pb-2">
          {sortedQuestions.map((q, idx) => {
            const isAnswered = !!answers[q.qNumber];
            const isFlagged = flags.has(q.qNumber);
            const isCurrent = idx === currentIndex;
            
            let btnClass = "w-10 h-10 rounded-lg font-medium text-sm flex items-center justify-center border transition-all relative ";
            
            if (isCurrent) {
              btnClass += `border-transparent ${themes[activeTheme].accentBg} text-white ring-2 ring-indigo-200 dark:ring-indigo-800 `;
            } else if ((isSubmitted || instantFeedback) && isAnswered) {
              const isCorrect = answers[q.qNumber] === q.answer;
              if (isCorrect) {
                btnClass += `border-transparent ${themes[activeTheme].successBg} ${themes[activeTheme].successText} `;
              } else {
                btnClass += `border-transparent ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText} `;
              }
            } else if (isSubmitted && !isAnswered) {
              btnClass += `border-transparent ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText} `;
            } else if (isAnswered) {
              btnClass += `border-transparent ${themes[activeTheme].iconContainer} ${themes[activeTheme].textPrimary} `;
            } else {
              btnClass += `border-transparent ${themes[activeTheme].card} ${themes[activeTheme].textSecondary} `;
            }

            return (
              <button
                key={q.qNumber}
                onClick={() => setCurrentIndex(idx)}
                className={btnClass}
              >
                {q.qNumber}
                {isFlagged && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-white dark:border-slate-800"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {currentQuestion && (
        <>
          <motion.div 
            key={currentQuestion.qNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`${themes[activeTheme].card} rounded-3xl shadow-sm overflow-hidden transition-colors duration-200 border ${themes[activeTheme].border}`}
          >
            <div className={`p-4 ${themes[activeTheme].iconContainer} border-b ${themes[activeTheme].border} flex justify-between items-center`}>
              <h3 className={`font-bold ${themes[activeTheme].textPrimary}`}>Question {currentQuestion.qNumber}</h3>
              <button 
                onClick={toggleFlag}
                className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${flags.has(currentQuestion.qNumber) ? `${themes[activeTheme].accentBg} text-white` : `${themes[activeTheme].card} ${themes[activeTheme].textSecondary}`}`}
              >
                <ThemeIcon icon="Flag" theme={activeTheme} className="w-4 h-4 mr-1.5" />
                {flags.has(currentQuestion.qNumber) ? 'Flagged' : 'Flag'}
              </button>
            </div>
            <div className="p-2 sm:p-4 overflow-x-auto min-h-[150px] flex items-center justify-center bg-transparent custom-scrollbar">
              {imageMap[currentQuestion.qNumber] ? (
                <img 
                  src={imageMap[currentQuestion.qNumber]} 
                  alt={`Question ${currentQuestion.qNumber}`}
                  className="w-full h-auto max-h-[35vh] object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
                />
              ) : (
                <div className={`flex flex-col items-center ${themes[activeTheme].textSecondary}`}>
                  <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${themes[activeTheme].accent} mb-4`}></div>
                  <p className="font-medium">Extracting question...</p>
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['A', 'B', 'C', 'D'].map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOpt = currentQuestion.answer === option;
              
              let buttonClass = "p-3 sm:p-5 text-xl sm:text-2xl font-bold rounded-2xl border-2 transition-all duration-300 shadow-sm hover:scale-[1.02] active:scale-[0.98] ";
              
              const isRevealed = isSubmitted || (instantFeedback && !!answers[currentQuestion.qNumber]);
              
              if (!isRevealed) {
                if (isSelected) {
                  buttonClass += `border-transparent ${themes[activeTheme].accentBg} text-white scale-105 shadow-md`;
                } else {
                  buttonClass += themes[activeTheme].button;
                }
              } else {
                if (isCorrectOpt) {
                  buttonClass += themes[activeTheme].buttonCorrect + " scale-105 shadow-md";
                } else if (isSelected) {
                  buttonClass += themes[activeTheme].buttonIncorrect + " scale-95 opacity-80";
                } else {
                  buttonClass += `border-transparent ${themes[activeTheme].card} ${themes[activeTheme].textSecondary} opacity-50`;
                }
              }

              return (
                <div key={option} className="relative">
                  <button
                    onClick={() => handleAnswer(option)}
                    disabled={isSubmitted}
                    className={`${buttonClass} w-full h-full relative overflow-hidden ${hasPremiumForLevel(userProfile, level as any || 'extended') ? 'btn-primary' : ''}`}
                  >
                    {option}
                    
                    {/* Theme Success Effects */}
                    {isSelected && isCorrectOpt && isRevealed && isGlobalPremium(userProfile) && (
                      <>
                        {userProfile.theme === 'pink' && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/50 to-transparent w-[200%] animate-shimmer pointer-events-none" />
                        )}
                        {userProfile.theme === 'space' && (
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-1/2 left-0 w-16 h-1 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_10px_#fff,0_0_20px_#fff] -rotate-45 animate-shooting-star" />
                          </div>
                        )}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {(isSubmitted || (instantFeedback && selectedAnswer)) && (
            <div className="space-y-4">
              <div className={`p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ${isCorrect ? themes[activeTheme].successBg : themes[activeTheme].errorBg}`}>
                <div className="flex items-center space-x-4">
                  {isCorrect ? (
                    <>
                      <div className={`${themes[activeTheme].successBg} p-2 rounded-full`}>
                        <ThemeIcon icon="CheckCircle2" theme={activeTheme} className={`w-8 h-8 ${themes[activeTheme].successText}`} />
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold ${themes[activeTheme].successText}`}>Correct!</h3>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`${themes[activeTheme].errorBg} p-2 rounded-full`}>
                        <ThemeIcon icon="XCircle" theme={activeTheme} className={`w-8 h-8 ${themes[activeTheme].errorText}`} />
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold ${themes[activeTheme].errorText}`}>
                          {selectedAnswer ? 'Incorrect' : 'Skipped'}
                        </h3>
                        <p className={`${themes[activeTheme].errorText} font-medium`}>The correct answer was <span className="font-bold text-lg">{currentQuestion.answer}</span>.</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {!explanation && !isExplaining && (
                    <button
                      onClick={generateExplanation}
                      className={`w-full sm:w-auto flex items-center justify-center px-6 py-4 ${themes[activeTheme].card} ${themes[activeTheme].accent} font-medium rounded-xl border ${themes[activeTheme].border} transition-all shadow-sm active:scale-95`}
                    >
                      <ThemeIcon icon="Sparkles" theme={activeTheme} className="w-5 h-5 mr-2" />
                      Explain
                    </button>
                  )}
                </div>
              </div>

              {(isExplaining || explanation) && (
                <div className={`p-6 ${themes[activeTheme].iconContainer} rounded-2xl border ${themes[activeTheme].border} animate-in fade-in slide-in-from-bottom-4`}>
                  <h4 className={`font-bold ${themes[activeTheme].accent} mb-2 flex items-center`}>
                    <ThemeIcon icon="Sparkles" theme={activeTheme} className="w-5 h-5 mr-2" />
                    AI Explanation
                  </h4>
                  {isExplaining ? (
                    <div className={`flex items-center ${themes[activeTheme].accent}`}>
                      <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${themes[activeTheme].accent} mr-3`}></div>
                      Generating explanation...
                    </div>
                  ) : (
                    <div className={`${themes[activeTheme].textPrimary} leading-relaxed prose prose-sm dark:prose-invert max-w-none`}>
                      {explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className={`flex items-center px-6 py-3 ${themes[activeTheme].iconContainer} ${themes[activeTheme].textPrimary} rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ThemeIcon icon="ChevronLeft" theme={activeTheme} className="w-5 h-5 mr-2" /> Previous
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(sortedQuestions.length - 1, currentIndex + 1))}
              disabled={currentIndex === sortedQuestions.length - 1}
              className={`flex items-center px-6 py-3 ${themes[activeTheme].accentBg} text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Next <ThemeIcon icon="ChevronRight" theme={activeTheme} className="w-5 h-5 ml-2" />
            </button>
          </div>
        </>
      )}

      {showBookmarkModal && currentQuestion && (
        <BookmarkModal 
          subject={subject}
          questionData={currentQuestion}
          onClose={() => setShowBookmarkModal(false)}
          activeTheme={activeTheme}
        />
      )}
    </div>
  );
}
