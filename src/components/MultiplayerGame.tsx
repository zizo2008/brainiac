import React, { useState, useEffect, useRef } from 'react';
import { Game, UserProfile, GamePlayer } from '../types';
import { db, auth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getPdfUrl } from '../utils/pdfMap';
import { updateGameProgress, finishGame, updateStats, updateMultiplayerStats } from '../services/db';
import { generateSeededQuestions } from '../utils/random';
import { ThemeIcon } from './ThemeIcon';
import type * as pdfjsLib from 'pdfjs-dist';
import { getPdfJs } from '../utils/pdfjs';
import { renderQuestionImage } from '../utils/pdfParser';
import WholePaperQuiz from './WholePaperQuiz';
import { isGlobalPremium, hasPremiumForLevel } from '../utils/premium';
import { motion } from 'motion/react';


import { ThemeName, themes } from '../theme';

interface Props {
  game: Game;
  userProfile: UserProfile | null;
  onExit: () => void;
  activeTheme: ThemeName;
}

export default function MultiplayerGame({ game, userProfile, onExit, activeTheme }: Props) {
  const [gameState, setGameState] = useState<Game>(game);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('Loading game data...');
  const [statsUpdated, setStatsUpdated] = useState(false);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [isWaitingForOthers, setIsWaitingForOthers] = useState(false);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [explainingIndex, setExplainingIndex] = useState<number | null>(null);
  
  const loadedPdfRef = useRef<any>(null);
  const parserStateRef = useRef<ParserState>(createInitialParserState());
  const localAnswerCountRef = useRef<number | null>(null);
  const isHost = auth.currentUser?.uid === game.hostId;

  const myPlayer = gameState.players?.[auth.currentUser?.uid || ''];
  const score = myPlayer?.score || 0;
  const progress = myPlayer?.progress || 0;

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'games', game.id), (doc) => {
      if (doc.exists()) {
        setGameState({ ...doc.data(), id: doc.id } as Game);
      }
    });
    return () => unsubscribe();
  }, [game.id]);

  useEffect(() => {
    loadPdf();
  }, []);

  useEffect(() => {
    if (gameState.status === 'playing' && (game.mode === 'time' || game.mode === 'both') && game.targetTimeSeconds) {
      const elapsed = Math.floor((Date.now() - (gameState.startTime || Date.now())) / 1000);
      const remaining = Math.max(0, game.targetTimeSeconds - elapsed);
      setTimeLeft(remaining);
      
      if (remaining > 0) {
        const timer = setInterval(() => {
          setTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(timer);
              handleGameEnd();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(timer);
      } else {
        handleGameEnd();
      }
    }
  }, [gameState.status, gameState.startTime]);

  useEffect(() => {
    if (gameState.status === 'finished' && !statsUpdated && auth.currentUser) {
      setStatsUpdated(true);
      const sortedPlayers = (Object.values(gameState.players || {}) as GamePlayer[]).sort((a, b) => b.score - a.score);
      const myRank = sortedPlayers.findIndex(p => p.uid === auth.currentUser?.uid) + 1;
      const isWinner = myRank === 1;
      const isPodium = myRank > 0 && myRank <= 3;
      
      updateMultiplayerStats(auth.currentUser.uid, isWinner, isPodium).catch(console.error);
    }
  }, [gameState.status, statsUpdated]);

  const loadPdf = async () => {
    try {
      setLoadingMsg(`Loading ${game.subject} questions...`);
      const getFileName = (subj: string, lvl?: string) => {
        if (subj === 'economics') return 'econ';
        const baseNames: Record<string, string> = {
          chemistry: 'chem',
          physics: 'phy',
          biology: 'bio',
          economics: 'econ',
          accounting: 'acc'
        };
        const base = baseNames[subj] || subj;
        if (subj === 'economics') {
          if (lvl === 'a_level') return 'econal';
          return 'econ';
        }
        if (subj === 'accounting') {
          if (lvl === 'a_level') return 'accal';
          return 'accol';
        }
        if (lvl === 'core') return `${base}cr`;
        if (lvl === 'a_level') return `${base}al`;
        return base;
      };
      const fileName = getFileName(game.subject, game.level);
      let pdf;
      try {
        const pdfUrl = getPdfUrl(fileName);
        
        const headRes = await fetch(pdfUrl, { method: 'HEAD' });
        if (!headRes.ok) throw new Error(`Failed to fetch ${fileName}.pdf`);
        const pdfjsLibInstance = await getPdfJs();
        pdf = await pdfjsLibInstance.getDocument({ url: pdfUrl }).promise;
      } catch (err) {
        throw new Error(`Error loading PDF: Failed to fetch ${fileName}.pdf from storage. Please check your connection.`);
      }
      loadedPdfRef.current = pdf;
      
      let validQs: any[] = [];
      try {
        const res = await fetch(`/data/${fileName}.json`);
        if (res.ok) {
          const data = await res.json();
          validQs = data.validQuestions || [];
        }
      } catch (err) {
        console.error("Failed to load pre-parsed JSON", err);
      }
      
      if (validQs.length > 0) {
        
        let generatedQs: any[] = [];
        if (game.mode === 'whole_paper' && game.targetExamCode) {
          generatedQs = validQs.filter(q => q.examCode === game.targetExamCode).sort((a, b) => a.qNumber - b.qNumber);
          if (generatedQs.length === 0) {
            setLoadingMsg(`Could not find exam ${game.targetExamCode}.`);
            return;
          }
        } else {
          let questionIndices: number[] = [];
          if (game.sameQuestions) {
            questionIndices = generateSeededQuestions(game.code, validQs.length, game.targetQuestions || 50);
          } else {
            questionIndices = generateSeededQuestions(game.code + auth.currentUser?.uid, validQs.length, game.targetQuestions || 50);
          }
          generatedQs = questionIndices.map(idx => validQs[idx % validQs.length]);
        }
        
        setQuestions(generatedQs);
        
        if (game.subject === 'economics' && !hasPremiumForLevel(userProfile, game.level || 'extended')) {
          const today = new Date().toISOString().split('T')[0];
          const dailyEcon = userProfile?.lastEconResetDate === today ? (userProfile?.dailyEconAnswered || 0) : 0;
          if (dailyEcon >= 10) {
            window.dispatchEvent(new CustomEvent('openPremiumModal'));
            return;
          }
        }

        setPdfLoaded(true);
        renderQuestion(generatedQs[0]);
        

      } else {
        setLoadingMsg("Failed to load questions. Please try again.");
      }
    } catch (err) {
      console.error("Failed to load PDF", err);
      setLoadingMsg("Failed to load questions. Please try again.");
    }
  };

  const renderQuestion = async (q: any) => {
    if (!loadedPdfRef.current) return;
    setQuestionImage(null);
    setSelectedAnswer(null);
    setIsCorrect(null);
    
    try {
      const imgData = await renderQuestionImage(loadedPdfRef.current, q);
      setQuestionImage(imgData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnswer = async (ans: string) => {
    if (selectedAnswer || gameState.status !== 'playing' || !auth.currentUser) return;
    
    // Daily Economics Limit Check
    if (game.subject === 'economics' && !hasPremiumForLevel(userProfile, game.level || 'extended')) {
      const today = new Date().toISOString().split('T')[0];
      const dailyEcon = userProfile?.lastEconResetDate === today ? (userProfile?.dailyEconAnswered || 0) : 0;
      if (dailyEcon >= 10) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
        return;
      }
    }

    setSelectedAnswer(ans);
    const currentQ = questions[currentQuestionIndex];
    const correct = ans === currentQ.answer;
    setIsCorrect(correct);
    
    if (correct && isGlobalPremium(userProfile) && userProfile.theme === 'retro') {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    const newScore = score + (correct ? 1 : 0);
    const newProgress = progress + 1;
    
    setUserAnswers(prev => [...prev, {
      question: currentQ,
      questionImage,
      selectedAnswer: ans,
      isCorrect: correct
    }]);

    await updateGameProgress(game.id, auth.currentUser.uid, newScore, newProgress);
    
    await updateStats(auth.currentUser.uid, game.subject as 'chemistry' | 'physics' | 'biology' | 'economics' | 'accounting', correct ? 1 : 0, 1);
    
    if (userProfile && !isGlobalPremium(userProfile)) {
      if (localAnswerCountRef.current !== null) {
        localAnswerCountRef.current += 1;
      } else {
        localAnswerCountRef.current = (userProfile.totalAnswered || 0) + 1;
      }
      const newTotal = localAnswerCountRef.current;
      let shouldShow = false;
      if (newTotal <= 30) {
        if (newTotal > 0 && newTotal % 10 === 0) shouldShow = true;
      } else {
        if ((newTotal - 30) % 5 === 0) shouldShow = true;
      }
      if (shouldShow) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
      }
    }
    
    if (game.mode === 'questions' || game.mode === 'both') {
      if (game.targetQuestions && newProgress >= game.targetQuestions) {
        handleGameEnd();
      }
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      renderQuestion(questions[currentQuestionIndex + 1]);
    } else if (game.mode === 'time') {
      // Generate more questions if it's a time-only mode and we ran out
      const validQs = parserStateRef.current.validQuestions;
      if (validQs.length > 0) {
        const moreIndices = generateSeededQuestions(game.code + auth.currentUser?.uid + 'more' + currentQuestionIndex, validQs.length, 50);
        const moreQs = moreIndices.map(idx => validQs[idx % validQs.length]);
        setQuestions(prev => [...prev, ...moreQs]);
        setCurrentQuestionIndex(prev => prev + 1);
        renderQuestion(moreQs[0]);
      }
    } else {
      // Last question in non-time mode
      handleGameEnd();
    }
  };

  const handleGameEnd = async () => {
    if (gameState.status === 'finished') return;
    
    try {
      // Mark current player as finished in the DB
      if (auth.currentUser) {
        await updateGameProgress(game.id, auth.currentUser.uid, score, progress, true);
        setIsWaitingForOthers(true);
      }
      
      const { getDoc, doc } = await import('firebase/firestore');
      const gameRef = doc(db, 'games', game.id);
      const gameSnap = await getDoc(gameRef);
      if (gameSnap.exists()) {
        const latestGame = gameSnap.data() as Game;
        const players = Object.values(latestGame.players || {}) as GamePlayer[];
        
        // Check if all players have finished
        const allFinished = players.every(p => p.isFinished);
        
        if (allFinished || (game.mode === 'time' || game.mode === 'both')) {
          const sortedPlayers = players.sort((a, b) => b.score - a.score);
          let winnerId = null;
          if (sortedPlayers.length > 0 && (sortedPlayers.length === 1 || sortedPlayers[0].score > sortedPlayers[1].score)) {
            winnerId = sortedPlayers[0].uid;
          }
          await finishGame(game.id, winnerId || null);
        }
      }
    } catch (e) {
      console.error("Failed to end game", e);
    }
  };

  if (!pdfLoaded) {
    return (
      <div className={`h-full flex flex-col items-center justify-center ${themes[activeTheme].card} ${themes[activeTheme].textSecondary}`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${themes[activeTheme].accent} mb-6`}></div>
        <p className="text-lg font-medium">{loadingMsg}</p>
      </div>
    );
  }

  if (gameState.status === 'finished') {
    const sortedPlayers = (Object.values(gameState.players || {}) as GamePlayer[]).sort((a, b) => b.score - a.score);
    const myRank = sortedPlayers.findIndex(p => p.uid === auth.currentUser?.uid) + 1;
    const isWinner = myRank === 1;
    
    const podiumHeights = [160, 120, 100]; // 1st, 2nd, 3rd
    const podiumColors = [
      'bg-amber-400 dark:bg-amber-500', // 1st
      'bg-slate-300 dark:bg-slate-400', // 2nd
      'bg-orange-400 dark:bg-orange-500' // 3rd
    ];
    
    // Reorder for display: 2nd, 1st, 3rd
    const displayOrder = [1, 0, 2];
    const top3 = displayOrder.map(idx => sortedPlayers[idx]).filter(Boolean);

    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 text-center ${themes[activeTheme].profileBg} overflow-y-auto custom-scrollbar`}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${themes[activeTheme].card} p-8 sm:p-12 rounded-3xl shadow-xl border ${themes[activeTheme].border} max-w-4xl w-full`}
        >
          <h2 className={`text-4xl font-black ${themes[activeTheme].textPrimary} mb-2`}>
            {isWinner ? 'You Won!' : 'Game Over'}
          </h2>
          <p className={`${themes[activeTheme].textSecondary} mb-12 text-lg`}>Final Results</p>
          
          <div className="flex items-end justify-center gap-2 sm:gap-4 mb-12 h-64 px-2">
            {top3.map((player, i) => {
              const rank = sortedPlayers.findIndex(p => p.uid === player.uid);
              const isMe = player.uid === auth.currentUser?.uid;
              
              return (
                <div key={player.uid} className="flex flex-col items-center w-20 sm:w-32">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 + (rank * 0.2), type: "spring" }}
                    className="mb-4 text-center z-10"
                  >
                    <div className="relative mb-2">
                      {player.photoURL ? (
                        <img src={player.photoURL} className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 ${rank === 0 ? 'border-amber-400' : rank === 1 ? 'border-slate-300' : 'border-orange-400'} shadow-lg`} />
                      ) : (
                        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-black text-xl border-4 ${rank === 0 ? 'border-amber-400' : rank === 1 ? 'border-slate-300' : 'border-orange-400'} ${themes[activeTheme].card} ${themes[activeTheme].textPrimary}`}>
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {rank === 0 && (
                        <div className="absolute -top-4 -right-2 rotate-12">
                          <ThemeIcon icon="Crown" theme={activeTheme} className="w-8 h-8 text-amber-400 drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    <div className={`font-black text-xs sm:text-sm ${themes[activeTheme].textPrimary} truncate w-full px-1`}>
                      {player.username}
                      {isMe && <span className={`text-[10px] ml-1 ${themes[activeTheme].accent}`}>(You)</span>}
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${themes[activeTheme].accent}`}>{player.score || 0}</div>
                  </motion.div>
                  
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: podiumHeights[rank] }}
                    transition={{ duration: 1, ease: "circOut", delay: rank * 0.3 }}
                    className={`w-full rounded-t-2xl flex flex-col items-center justify-start pt-4 shadow-xl relative overflow-hidden ${podiumColors[rank]}`}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-20 pointer-events-none"></div>
                    <span className="text-3xl sm:text-5xl font-black text-white/40 italic">{rank + 1}</span>
                  </motion.div>
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <button 
              onClick={() => setShowReview(!showReview)} 
              className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs border-2 transition-all ${showReview ? themes[activeTheme].accentBg + ' text-white border-transparent' : themes[activeTheme].border + ' ' + themes[activeTheme].textPrimary}`}
            >
              {showReview ? 'Hide My Answers' : 'Review My Answers'}
            </button>
            <button onClick={onExit} className={`px-10 py-3 ${themes[activeTheme].buttonPrimary} text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95`}>
              Exit Lobby
            </button>
          </div>

          {showReview && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-8 space-y-4 text-left max-w-3xl mx-auto border-t pt-8"
            >
              <h3 className={`text-xl font-black uppercase tracking-tight ${themes[activeTheme].textPrimary} mb-6`}>Answer Review</h3>
              {userAnswers.length === 0 ? (
                <p className={`${themes[activeTheme].textSecondary} italic`}>No questions answered this session.</p>
              ) : (
                <div className="space-y-6">
                  {userAnswers.map((ans, idx) => (
                    <div key={idx} className={`${themes[activeTheme].card} p-4 sm:p-6 rounded-2xl border-2 ${ans.isCorrect ? 'border-green-500/20' : 'border-red-500/20'} relative overflow-hidden`}>
                      <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase ${ans.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {ans.isCorrect ? 'Correct' : 'Incorrect'}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="w-full sm:w-1/2 bg-white rounded-xl p-2 flex items-center justify-center">
                          {ans.questionImage ? (
                            <img src={ans.questionImage} alt="Question" className="max-h-32 object-contain" />
                          ) : (
                            <div className="h-32 flex items-center justify-center text-xs text-gray-400">Image not available</div>
                          )}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Your Choice</p>
                              <p className={`text-2xl font-black ${ans.isCorrect ? 'text-green-500' : 'text-red-500'}`}>{ans.selectedAnswer}</p>
                            </div>
                            {!ans.isCorrect && (
                              <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Correct Answer</p>
                                <p className="text-2xl font-black text-green-500">{ans.question.answer}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <div className={`text-xs font-bold ${themes[activeTheme].textPrimary} p-2 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-between`}>
                              <span>Question {ans.question.qNumber} • {ans.question.examCode}</span>
                              {!ans.isCorrect && (
                                <button 
                                  onClick={async () => {
                                    if (explainingIndex !== null) return;
                                    setExplainingIndex(idx);
                                    try {
                                      const { GoogleGenAI } = await import('@google/genai');
                                      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                                      const base64Data = ans.questionImage.split(',')[1];
                                      const response = await ai.models.generateContent({
                                        model: 'gemini-2.5-flash',
                                        contents: [
                                          { inlineData: { data: base64Data, mimeType: 'image/png' } },
                                          `Explain step-by-step why the correct answer to this ${game.subject} multiple choice question is ${ans.question.answer}. Keep it concise and educational.`
                                        ]
                                      });
                                      setExplanations(prev => ({ ...prev, [idx]: response.text }));
                                    } catch (e) {
                                      console.error(e);
                                      setExplanations(prev => ({ ...prev, [idx]: "Failed to generate explanation." }));
                                    } finally {
                                      setExplainingIndex(null);
                                    }
                                  }}
                                  className={`text-[10px] uppercase tracking-widest font-black flex items-center gap-1 hover:opacity-80 transition-opacity ${themes[activeTheme].accent}`}
                                >
                                  {explainingIndex === idx ? (
                                    <div className="animate-spin h-3 w-3 border-b-2 border-current rounded-full" />
                                  ) : (
                                    <ThemeIcon icon="Sparkles" theme={activeTheme} className="w-3 h-3" />
                                  )}
                                  {explanations[idx] ? 'Explained' : 'Explain'}
                                </button>
                              )}
                            </div>
                            {explanations[idx] && (
                              <div className={`p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-xs ${themes[activeTheme].textPrimary} leading-relaxed animate-in fade-in slide-in-from-top-2`}>
                                <p className="font-black uppercase tracking-tighter text-[9px] opacity-50 mb-1">AI Explanation</p>
                                {explanations[idx]}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {!showReview && (
            <div className="space-y-8">
              <div className="max-w-2xl mx-auto overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: themes[activeTheme].border.split('-')[1] }}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`${themes[activeTheme].iconContainer} border-b ${themes[activeTheme].border}`}>
                      <th className={`p-4 text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Rank</th>
                      <th className={`p-4 text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Player</th>
                      <th className={`p-4 text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} text-center`}>Score</th>
                      <th className={`p-4 text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} text-right`}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ divideColor: themes[activeTheme].border.split('-')[1] }}>
                    {sortedPlayers.map((player, index) => {
                      const accuracy = player.progress > 0 ? Math.round((player.score / player.progress) * 100) : 0;
                      return (
                        <tr key={player.uid} className={`transition-colors ${player.uid === auth.currentUser?.uid ? 'bg-indigo-500/5' : ''}`}>
                          <td className="p-4">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-400 text-amber-900' : index === 1 ? 'bg-slate-300 text-slate-700' : 'bg-orange-400 text-orange-900'}`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {player.photoURL ? (
                                <img src={player.photoURL} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${themes[activeTheme].badgeSecondary}`}>
                                  {player.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className={`font-bold ${themes[activeTheme].textPrimary} truncate max-w-[120px]`}>
                                {player.username}
                                {player.uid === auth.currentUser?.uid && <span className={`text-[10px] ml-1 opacity-60`}>(You)</span>}
                              </span>
                            </div>
                          </td>
                          <td className={`p-4 text-center font-black text-lg ${themes[activeTheme].accent}`}>
                            {player.score || 0}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black ${accuracy >= 80 ? 'bg-emerald-500/10 text-emerald-500' : accuracy >= 50 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                              {accuracy}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (game.mode === 'whole_paper') {
    return (
      <div className="h-full flex flex-col max-w-4xl mx-auto p-4 sm:p-6 w-full">
        <div className="flex-1 overflow-y-auto min-h-0 w-full">
          <WholePaperQuiz
            pdf={loadedPdfRef.current}
            questions={questions}
            subject={game.subject}
            examCode={game.targetExamCode || ''}
            isParsingFinished={true}
            onEnd={handleGameEnd}
            onAnswer={async (totalAnswered, correctAnswers, deltaCorrect, isNewAnswer) => {
              if (!auth.currentUser) return;
              await updateGameProgress(game.id, auth.currentUser.uid, correctAnswers, totalAnswered);
              if (deltaCorrect !== 0 || isNewAnswer) {
                await updateStats(auth.currentUser.uid, game.subject as 'chemistry' | 'physics' | 'biology' | 'economics' | 'accounting', deltaCorrect, isNewAnswer ? 1 : 0);
                
                if (userProfile && !isGlobalPremium(userProfile) && isNewAnswer) {
                  if (localAnswerCountRef.current !== null) {
                    localAnswerCountRef.current += 1;
                  } else {
                    localAnswerCountRef.current = (userProfile.totalAnswered || 0) + 1;
                  }
                  const newTotal = localAnswerCountRef.current;
                  let shouldShow = false;
                  if (newTotal <= 30) {
                    if (newTotal > 0 && newTotal % 10 === 0) shouldShow = true;
                  } else {
                    if ((newTotal - 30) % 5 === 0) shouldShow = true;
                  }
                  if (shouldShow) {
                    window.dispatchEvent(new CustomEvent('openPremiumModal'));
                  }
                }
              }
            }}
            opponentScore={0}
            opponentProgress={0}
            userProfile={userProfile}
            activeTheme={activeTheme}
          />
        </div>
      </div>
    );
  }

  const sortedPlayers = (Object.values(gameState.players || {}) as GamePlayer[]).sort((a, b) => b.score - a.score);

  if (isWaitingForOthers && gameState.status === 'playing') {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-6 text-center ${themes[activeTheme].profileBg}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${themes[activeTheme].card} p-8 sm:p-12 rounded-3xl shadow-xl border ${themes[activeTheme].border} max-w-lg w-full`}
        >
          <div className="relative mb-8">
            <div className={`w-20 h-20 rounded-2xl ${themes[activeTheme].accentBg} flex items-center justify-center mx-auto shadow-lg animate-pulse`}>
              <ThemeIcon icon="Clock" theme={activeTheme} className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className={`text-3xl font-black ${themes[activeTheme].textPrimary} mb-4`}>You've Finished!</h2>
          <p className={`${themes[activeTheme].textSecondary} mb-8 text-lg`}>Waiting for other players to complete their questions...</p>
          
          <div className="space-y-4 mb-8">
            {sortedPlayers.map(p => (
              <div key={p.uid} className={`flex items-center justify-between p-4 rounded-2xl border ${themes[activeTheme].border} ${p.isFinished ? themes[activeTheme].successBg + ' border-transparent' : themes[activeTheme].card}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${p.isFinished ? 'bg-white/20 text-white' : themes[activeTheme].badgeSecondary}`}>
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span className={`font-bold ${p.isFinished ? 'text-white' : themes[activeTheme].textPrimary}`}>{p.username}</span>
                </div>
                {p.isFinished ? (
                  <span className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-1">
                    <ThemeIcon icon="Check" theme={activeTheme} className="w-4 h-4" /> Finished
                  </span>
                ) : (
                  <span className={`${themes[activeTheme].textSecondary} font-black text-xs uppercase tracking-widest animate-pulse`}>Playing...</span>
                )}
              </div>
            ))}
          </div>

          <button onClick={onExit} className={`text-sm font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors`}>
            Leave Game
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto p-2 sm:p-4 w-full">
      <div className={`flex flex-row items-center justify-between mb-4 ${themes[activeTheme].card} p-2 rounded-xl shadow-sm border ${themes[activeTheme].border} shrink-0 gap-2`}>
        <div className="flex items-center gap-4 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-2 sm:pb-0">
          {sortedPlayers.map((player, idx) => (
            <div key={player.uid} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${player.uid === auth.currentUser?.uid ? `${themes[activeTheme].badge}` : `${themes[activeTheme].badgeSecondary}`}`}>
              {player.photoURL ? (
                <img src={player.photoURL} alt={player.username} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${themes[activeTheme].iconContainer}`}>
                  {player.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-center min-w-[60px]">
                <p className={`text-[10px] font-bold ${player.uid === auth.currentUser?.uid ? 'opacity-80' : themes[activeTheme].textSecondary} uppercase tracking-wider truncate max-w-[80px]`} title={player.username}>
                  {player.uid === auth.currentUser?.uid ? 'You' : player.username}
                </p>
                <p className={`text-xl font-black ${player.uid === auth.currentUser?.uid ? '' : themes[activeTheme].textPrimary}`}>
                  {player.score || 0}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          {timeLeft !== null && !isNaN(timeLeft) && (
            <div className={`flex items-center gap-2 ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText} px-4 py-2 rounded-xl font-mono font-bold text-xl`}>
              <ThemeIcon icon="Clock" theme={activeTheme} className="w-5 h-5" />
              {Math.floor((timeLeft || 0) / 60)}:{((timeLeft || 0) % 60).toString().padStart(2, '0')}
            </div>
          )}
          
          <button onClick={onExit} className={`p-2 ${themes[activeTheme].iconButton} rounded-xl transition-colors`}>
            <ThemeIcon icon="LogOut" theme={activeTheme} className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 w-full pb-4 custom-scrollbar">
        <motion.div 
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`${themes[activeTheme].card} rounded-2xl sm:rounded-3xl shadow-sm border ${themes[activeTheme].border} overflow-hidden mb-4 sm:mb-6`}
        >
          <div className={`p-2 sm:p-4 min-h-[150px] flex items-center justify-center ${themes[activeTheme].card} overflow-x-auto custom-scrollbar`}>
            {questionImage ? (
              <img src={questionImage} alt="Question" className="w-full h-auto max-h-[35vh] object-contain mix-blend-multiply dark:mix-blend-screen dark:invert" />
            ) : (
              <div className={`animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 ${themes[activeTheme].accent}`}></div>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {['A', 'B', 'C', 'D'].map((option) => {
            let buttonClass = "py-2 sm:py-6 text-base sm:text-2xl font-bold rounded-xl sm:rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ";
            
            if (selectedAnswer === null) {
              buttonClass += themes[activeTheme].button;
            } else {
              const currentQ = questions[currentQuestionIndex];
              if (option === currentQ.answer) {
                buttonClass += themes[activeTheme].buttonCorrect + " scale-105 shadow-md";
              } else if (option === selectedAnswer) {
                buttonClass += themes[activeTheme].buttonIncorrect + " scale-95 opacity-80";
              } else {
                buttonClass += `border-transparent ${themes[activeTheme].card} ${themes[activeTheme].textSecondary} opacity-50`;
              }
            }

            return (
              <div key={option} className="relative">
                <button
                  onClick={() => handleAnswer(option)}
                  disabled={selectedAnswer !== null || gameState.status !== 'playing'}
                  className={`${buttonClass} w-full h-full relative overflow-hidden`}
                >
                  {option}
                  
                  {/* Theme Success Effects */}
                  {selectedAnswer === option && isCorrect && isGlobalPremium(userProfile) && (
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

        {selectedAnswer && (
          <div className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ${isCorrect ? themes[activeTheme].successBg : themes[activeTheme].errorBg}`}>
            <div className="flex items-center gap-3 sm:gap-4">
              {isCorrect ? (
                <>
                  <div className={`${themes[activeTheme].successBg} p-1.5 sm:p-2 rounded-full`}>
                    <ThemeIcon icon="CheckCircle2" theme={activeTheme} className={`w-6 h-6 sm:w-8 sm:h-8 ${themes[activeTheme].successText}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg sm:text-xl font-bold ${themes[activeTheme].successText}`}>Correct!</h3>
                  </div>
                </>
              ) : (
                <>
                  <div className={`${themes[activeTheme].errorBg} p-1.5 sm:p-2 rounded-full`}>
                    <ThemeIcon icon="XCircle" theme={activeTheme} className={`w-6 h-6 sm:w-8 sm:h-8 ${themes[activeTheme].errorText}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg sm:text-xl font-bold ${themes[activeTheme].errorText}`}>Incorrect</h3>
                    <p className={`text-xs sm:text-base ${themes[activeTheme].errorText} font-medium`}>The correct answer was <span className="font-bold text-sm sm:text-lg">{questions[currentQuestionIndex].answer}</span>.</p>
                  </div>
                </>
              )}
            </div>
            
            <button
              onClick={handleNext}
              className={`w-full sm:w-auto flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 ${themes[activeTheme].accentBg} text-white font-medium rounded-lg sm:rounded-xl transition-all shadow-sm active:scale-95 text-sm sm:text-base`}
            >
              Next Question <ThemeIcon icon="ArrowRight" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
