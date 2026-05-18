import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ThemeIcon } from './components/ThemeIcon';
import { GoogleGenAI } from '@google/genai';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getPdfUrl } from './utils/pdfMap';
import { getUserProfile, updateStats, createUserProfile } from './services/db';
import { renderQuestionImage } from './utils/pdfParser';
import { isGlobalPremium, hasPremiumForLevel } from './utils/premium';
import { UserProfile, Question, Level } from './types';
import Auth from './components/Auth';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import ClassroomView from './components/ClassroomView';
import Leaderboard from './components/Leaderboard';
import ClassroomHub from './components/ClassroomHub';
import MultiplayerSetup from './components/MultiplayerSetup';
import MultiplayerGame from './components/MultiplayerGame';
import WholePaperQuiz from './components/WholePaperQuiz';
import QuestionVault from './components/QuestionVault';
import BookmarkModal from './components/BookmarkModal';
import PremiumModal from './components/PremiumModal';
import AdminDashboard from './components/AdminDashboard';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import ProfileModal from './components/ProfileModal';
import FriendHubModal from './components/FriendHubModal';
import { themes, ThemeName } from './theme';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;



interface SaveSlot {
  id: string;
  name: string;
  date: string;
  subject: Subject;
  stats: { total: number; correct: number };
  askedQuestionIds: string[];
}

type Screen = 'dashboard' | 'classroom' | 'leaderboard' | 'friends' | 'home' | 'quiz' | 'results' | 'multiplayer-setup' | 'multiplayer-game' | 'select_exam' | 'whole_paper_quiz' | 'admin';
type Subject = 'chemistry' | 'physics' | 'biology' | 'economics' | 'accounting';

import SupportChat from './components/SupportChat';

type ParserState = {
  pageNum: number;
  currentExamIndex: number;
  isMarkScheme: boolean;
  currentQNum: number;
  markSchemes: Record<number, Record<number, string>>;
  examCodes: Record<number, string>;
  extractedQuestions: Question[];
  validQuestions: Question[];
  isParsing: boolean;
  isFinished: boolean;
  stopParsing: boolean;
};

const createInitialParserState = (): ParserState => ({
  pageNum: 1,
  currentExamIndex: 0,
  isMarkScheme: false,
  currentQNum: 0,
  markSchemes: {},
  examCodes: {},
  extractedQuestions: [],
  validQuestions: [],
  isParsing: false,
  isFinished: false,
  stopParsing: false
});

const isQuestionValid = (subject: string, text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  if (subject === 'physics') {
    if (lowerText.includes('and gate') || lowerText.includes('or gate') || lowerText.includes('not gate') || lowerText.includes('nand') || lowerText.includes('nor') || lowerText.includes('truth table') || lowerText.includes('logic circuit')) {
      return false;
    }
    if (lowerText.includes('mercury barometer') || (lowerText.includes('atmospheric pressure') && lowerText.includes('mercury column'))) {
      return false;
    }
    if (lowerText.includes('u-tube manometer') || lowerText.includes('liquid height difference') || (lowerText.includes('gas pressure') && lowerText.includes('liquid column'))) {
      return false;
    }
    if (lowerText.includes('specific latent heat') || lowerText.includes('latent heat of fusion') || lowerText.includes('latent heat of vaporisation')) {
      return false;
    }
    if ((lowerText.includes('thermal capacity') || lowerText.includes('heat capacity')) && !lowerText.includes('specific heat capacity') && !lowerText.includes('specific thermal capacity')) {
      return false;
    }
    if (lowerText.includes('thermometer') && (lowerText.includes('clinical') || lowerText.includes('mercury-in-glass') || lowerText.includes('sensitivity') || lowerText.includes('linearity'))) {
      if (!lowerText.includes('thermocouple')) {
        return false;
      }
    }
  } else if (subject === 'chemistry') {
    if (lowerText.includes('aluminium') && (lowerText.includes('bauxite') || lowerText.includes('cryolite') || lowerText.includes('hall-heroult') || lowerText.includes('electrolysis of ore'))) {
      return false;
    }
    if (lowerText.includes('zinc blende') || lowerText.includes('calamine') || lowerText.includes('extraction of zinc') || lowerText.includes('roasting zinc ore')) {
      return false;
    }
    if (lowerText.includes('sulfur') || lowerText.includes('sulphur')) {
      if (lowerText.includes('food preservative') || lowerText.includes('wine') || lowerText.includes('sources of sulfur') || lowerText.includes('sources of sulphur')) {
        if (!lowerText.includes('contact process') && !lowerText.includes('sulfuric acid') && !lowerText.includes('sulphuric acid')) {
          return false;
        }
      }
    }
    if ((lowerText.includes('carbohydrates') || lowerText.includes('proteins')) && (lowerText.includes('hydrolysis') || lowerText.includes('natural macromolecules') || lowerText.includes('complex structures'))) {
      if (!lowerText.includes('synthetic polymers')) {
        return false;
      }
    }
    if ((lowerText.includes('limestone') || lowerText.includes('lime') || lowerText.includes('calcium carbonate')) && (lowerText.includes('soil acidity') || lowerText.includes('farming') || lowerText.includes('manufacture of cement'))) {
      return false;
    }
    if (lowerText.includes('silver bromide') || lowerText.includes('silver chloride') || lowerText.includes('light sensitivity in photography')) {
      return false;
    }
    if (lowerText.includes('brownian motion')) {
      return false;
    }
  } else if (subject === 'biology') {
    if (lowerText.includes('kidney') && (lowerText.includes('dialysis') || lowerText.includes('transplant') || lowerText.includes('dialysate'))) {
      if (!lowerText.includes('excretion') && !lowerText.includes('urea') && !lowerText.includes('structure of nephron')) {
        return false;
      }
    }
    if (lowerText.includes('dental decay') || lowerText.includes('enamel') || lowerText.includes('dentine') || lowerText.includes('pulp cavity') || lowerText.includes('structure of human teeth')) {
      return false;
    }
    if (lowerText.includes('scurvy') || lowerText.includes('rickets') || lowerText.includes('kwashiorkor') || lowerText.includes('marasmus') || lowerText.includes('vitamin d deficiency') || lowerText.includes('vitamin c deficiency')) {
      return false;
    }
    if ((lowerText.includes('pregnancy') || lowerText.includes('birth')) && (lowerText.includes('antenatal care') || lowerText.includes('labour') || lowerText.includes('breastfeeding') || lowerText.includes('bottle feeding'))) {
      if (!lowerText.includes('placenta') && !lowerText.includes('amniotic fluid')) {
        return false;
      }
    }
    if (lowerText.includes('acid rain') || lowerText.includes('sewage treatment') || lowerText.includes('nuclear fallout') || lowerText.includes('leaching')) {
      return false;
    }
    if (lowerText.includes('heroin') || lowerText.includes('nicotine') || lowerText.includes('tar') || lowerText.includes('tobacco') || lowerText.includes('drug addiction')) {
      return false;
    }
    if (lowerText.includes('sickle cell anaemia') || lowerText.includes('sickle-cell anaemia') || lowerText.includes('sickle cell anemia')) {
      if (lowerText.includes('malaria')) {
        return false;
      }
    }
  }
  
  return true;
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [guestQuestionsCount, setGuestQuestionsCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('guestQuestionsCount');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isDowntime, setIsDowntime] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setIsDowntime(docSnap.data().downtime || false);
      }
    }, (error) => {
      console.error("Error fetching settings:", error);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleAdminUnlocked = () => {
      setScreen('admin');
    };
    window.addEventListener('adminUnlocked', handleAdminUnlocked);
    return () => window.removeEventListener('adminUnlocked', handleAdminUnlocked);
  }, []);

  const handleGuest = async () => {
    if (auth.currentUser) {
      await signOut(auth);
    }
    setIsGuest(true);
    setScreen('dashboard');
    setShowAuthModal(false);
    setAuthLoading(false);
  };
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFriendHubModalOpen, setIsFriendHubModalOpen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const hasShownPremiumModalRef = useRef(false);
  const localAnswerCountRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOpenPremiumModal = () => {
      setShowPremiumModal(true);
      setIsProfileModalOpen(false); // Close profile modal when opening premium
    };
    const handleOpenAuthModal = () => {
      setShowAuthModal(true);
    };
    const handleAdminUnlocked = () => {
      setIsAdminUnlocked(true);
      setScreen('admin');
    };
    window.addEventListener('openPremiumModal', handleOpenPremiumModal);
    window.addEventListener('openAuthModal', handleOpenAuthModal);
    window.addEventListener('adminUnlocked', handleAdminUnlocked);
    return () => {
      window.removeEventListener('openPremiumModal', handleOpenPremiumModal);
      window.removeEventListener('openAuthModal', handleOpenAuthModal);
      window.removeEventListener('adminUnlocked', handleAdminUnlocked);
    };
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('quiz_theme');
      if (saved) return saved === 'dark';
    } catch (e) {
      console.warn('localStorage access denied', e);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [activeTheme, setActiveTheme] = useState<ThemeName>('default');

  useEffect(() => {
    if (userProfile?.theme) {
      setActiveTheme(userProfile.theme as ThemeName);
      document.documentElement.setAttribute('data-theme', userProfile.theme);
      if (userProfile.theme === 'dark' || userProfile.theme === 'space') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      setActiveTheme(isDarkMode ? 'dark' : 'default');
      document.documentElement.removeAttribute('data-theme');
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        try { localStorage.setItem('quiz_theme', 'dark'); } catch (e) {}
      } else {
        document.documentElement.classList.remove('dark');
        try { localStorage.setItem('quiz_theme', 'light'); } catch (e) {}
      }
    }
  }, [isDarkMode, userProfile?.theme, userProfile?.isPremium, userProfile?.premiumPlan]);

  const [initialJoinCode, setInitialJoinCode] = useState<string | undefined>();

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#join-')) {
        const code = hash.replace('#join-', '');
        if (code && userProfile) {
          setInitialJoinCode(code);
          setScreen('multiplayer-setup');
          window.location.hash = '';
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Check on initial load too
    if (userProfile && window.location.hash.startsWith('#join-')) {
      handleHashChange();
    }

    const handleOpenAuth = () => setShowAuthModal(true);
    window.addEventListener('openAuthModal', handleOpenAuth);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('openAuthModal', handleOpenAuth);
    };
  }, [userProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
      } else {
        setUserProfile(null);
        setProfileLoaded(false);
        setAuthLoading(false);
        setIsGuest(true);
        setScreen('dashboard');
      }
    });
    return unsubscribe;
  }, [isGuest]);

  useEffect(() => {
    if (!user || !user.uid) {
      setUserProfile(null);
      setProfileLoaded(false);
      return;
    }

    // Reset profile state when a new user is detected
    setProfileLoaded(false);
    setUserProfile(null);

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setUserProfile(data);
        if (localAnswerCountRef.current === null) {
          localAnswerCountRef.current = data.totalAnswered || 0;
        }
        setScreen(prev => prev === 'auth' ? 'dashboard' : prev);
        setProfileLoaded(true);
        setAuthLoading(false);
        
        if (!isGlobalPremium(data) && data.role !== 'teacher' && !hasShownPremiumModalRef.current) {
          setShowPremiumModal(true);
          hasShownPremiumModalRef.current = true;
        }
      } else {
        // Profile missing - create a default one
        try {
          const defaultUsername = user.email?.split('@')[0] || 'User';
          const newProfile = await createUserProfile(user.uid, defaultUsername, 'student');
          if (newProfile) {
            setUserProfile(newProfile);
            setScreen(prev => prev === 'home' && !isGuest ? 'dashboard' : prev);
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          console.error("Error creating default profile:", err);
          setUserProfile(null);
        } finally {
          setProfileLoaded(true);
          setAuthLoading(false);
        }
      }
    }, (error) => {
      console.error("Error fetching profile:", error);
      setProfileLoaded(true);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const [screen, setScreen] = useState<Screen>('dashboard');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [level, setLevel] = useState<Level>('extended');
  const [quizMode, setQuizMode] = useState<'random' | 'whole_paper' | 'vault'>('random');
  const [instantFeedbackMode, setInstantFeedbackMode] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [selectedExamCode, setSelectedExamCode] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [availableExams, setAvailableExams] = useState<{index: number, code: string}[]>([]);
  const [isParsingFinished, setIsParsingFinished] = useState(false);
  
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const preloadedPdfsRef = useRef<Record<string, pdfjsLib.PDFDocumentProxy>>({});

  const subjectCachesRef = useRef<Record<string, ParserState>>({});

  const getCacheKey = (subj: Subject, lvl: Level) => `${subj}_${lvl}`;

  const getCache = (subj: Subject, lvl: Level) => {
    const key = getCacheKey(subj, lvl);
    if (!subjectCachesRef.current[key]) {
      subjectCachesRef.current[key] = createInitialParserState();
    }
    return subjectCachesRef.current[key];
  };

  const getFileName = (subj: Subject, lvl: Level) => {
    if (subj === 'economics') {
      if (lvl === 'a_level') return 'econal';
      return 'econ';
    }
    if (subj === 'accounting') {
      if (lvl === 'a_level') return 'accal';
      return 'accol';
    }
    const baseNames: Record<Subject, string> = {
      chemistry: 'chem',
      physics: 'phy',
      biology: 'bio',
      economics: 'econ',
      accounting: 'acc' // Not used but needed for exhaustive record
    };
    const base = baseNames[subj];
    if (lvl === 'core') return `${base}cr`;
    if (lvl === 'a_level') return `${base}al`;
    return base;
  };

  useEffect(() => {
    // Preload PDFs in the background for the current level
    const preloadPdfs = async () => {
      const subjects: Subject[] = ['chemistry', 'physics', 'biology', 'economics', 'accounting'];
      
      for (const subj of subjects) {
        try {
          const fileName = getFileName(subj, level);
          const cacheKey = getCacheKey(subj, level);
          
          // Skip if already preloaded
          if (preloadedPdfsRef.current[fileName]) continue;
          
          const pdfUrl = getPdfUrl(fileName);
          const response = await fetch(pdfUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            preloadedPdfsRef.current[fileName] = loadedPdf;
            
            // Start background parsing for this subject and level
            const parseAllBackground = async () => {
              const cache = getCache(subj, level);
              while (!cache.isFinished && !cache.stopParsing) {
                if (!cache.isParsing) {
                  await parseMorePages(loadedPdf, subj, level, 10);
                } else {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            };
            parseAllBackground();
          }
        } catch (e) {
          console.error(`Failed to preload ${subj} for level ${level}:`, e);
        }
        // Wait a bit between starting background parsing tasks to prevent initial lag
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };
    // Start preloading after a short delay to prioritize initial render
    setTimeout(preloadPdfs, 1000);
  }, [level]); // Re-run when level changes
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [askedQuestionIds, setAskedQuestionIds] = useState<Set<string>>(new Set());
  
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [showHintTip, setShowHintTip] = useState(false);
  const [hintTipText, setHintTipText] = useState("");
  const [hintTimer, setHintTimer] = useState(0);

  const [saves, setSaves] = useState<SaveSlot[]>(() => {
    try {
      const saved = localStorage.getItem('quiz_saves');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('localStorage access denied', e);
      return [];
    }
  });
  
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [followUps, setFollowUps] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);

  const parseMorePages = async (pdfDoc: pdfjsLib.PDFDocumentProxy, subj: Subject, lvl: Level, targetNewQuestions: number, timeoutMs?: number) => {
    const cache = getCache(subj, lvl);
    if (cache.isParsing || cache.isFinished) return;
    cache.isParsing = true;

    let newValidCount = 0;
    const startTime = Date.now();

    try {
      while (cache.pageNum <= pdfDoc.numPages && newValidCount < targetNewQuestions) {
        if (cache.stopParsing) break;
        if (timeoutMs && Date.now() - startTime > timeoutMs && cache.validQuestions.length > 0) {
          break;
        }
        
        const batchSize = 3;
        const pagesToFetch = [];
        for (let i = 0; i < batchSize && cache.pageNum + i <= pdfDoc.numPages; i++) {
          pagesToFetch.push(cache.pageNum + i);
        }
        
        const pages = await Promise.all(pagesToFetch.map(p => pdfDoc.getPage(p)));
        const textContents = await Promise.all(pages.map(p => p.getTextContent()));

        for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
          const pageNum = pagesToFetch[pageIdx];
          const page = pages[pageIdx];
          const textContent = textContents[pageIdx];
          const textStr = textContent.items.map((i: any) => i.str).join(' ');
          const textStrLower = textStr.toLowerCase();

          const isCoverPage = textStrLower.includes('multiple choice') && 
                              (textStrLower.includes('45 minutes') || textStrLower.includes('instructions') || textStrLower.includes('forty questions')) && 
                              !textStrLower.includes('mark scheme');
                              
          const isMSPage = textStrLower.includes('mark scheme');
          
          let standardCode: string | null = null;
          
          // Legacy format: 0987/11/M/J/20
          const legacyMatch = textStr.match(/\b(\d{4})\/(\d{2})\/(M\/J|O\/N|F\/M)\/(\d{2})\b/);
          if (legacyMatch) {
            const subjCode = legacyMatch[1];
            const variant = legacyMatch[2];
            const monthStr = legacyMatch[3];
            const yearStr = legacyMatch[4];
            const month = monthStr === 'M/J' ? '06' : monthStr === 'O/N' ? '11' : '03';
            const year = '20' + yearStr;
            standardCode = `${subjCode}-${variant}-${month}-${year}`;
          }

          // New format: 06_0987_11_2024_1.1a or 11_0987_12_FP_2025
          const newCodeMatch = textStr.match(/\b(06|11|03)_(\d{4})_(\d{2})[_ /](?:[A-Za-z]+_)?(\d{4})/);
          if (newCodeMatch) {
            const month = newCodeMatch[1];
            const subjCode = newCodeMatch[2];
            const variant = newCodeMatch[3];
            const year = newCodeMatch[4];
            standardCode = `${subjCode}-${variant}-${month}-${year}`;
          }

          // Mark Scheme alternative format
          if (!standardCode) {
            const msCodeMatch = textStr.match(/\b(\d{4})\/(\d{2})\b/);
            const msDateMatch = textStr.match(/\b(May\/June|October\/November|February\/March)\s+(\d{4})\b/i);
            if (msCodeMatch && msDateMatch) {
              const subjCode = msCodeMatch[1];
              const variant = msCodeMatch[2];
              const monthStr = msDateMatch[1].toLowerCase();
              const year = msDateMatch[2];
              let month = '06';
              if (monthStr.includes('october')) month = '11';
              if (monthStr.includes('february')) month = '03';
              standardCode = `${subjCode}-${variant}-${month}-${year}`;
            }
          }

          if (isCoverPage) {
            if (standardCode) {
              const existingIndex = Object.entries(cache.examCodes).find(([_, c]) => c === standardCode)?.[0];
              if (!existingIndex) {
                cache.currentExamIndex++;
                cache.currentQNum = 0;
                cache.examCodes[cache.currentExamIndex] = standardCode;
              } else {
                cache.currentExamIndex = Number(existingIndex);
                cache.currentQNum = 0;
              }
            } else {
              if (cache.isMarkScheme || cache.currentExamIndex === 0) {
                cache.currentExamIndex++;
                cache.currentQNum = 0;
              }
            }
            cache.isMarkScheme = false;
          } else if (isMSPage) {
            cache.isMarkScheme = true;
          }

          if (cache.isMarkScheme && standardCode) {
            const matchingIndex = Object.entries(cache.examCodes).find(([_, c]) => c === standardCode)?.[0];
            if (matchingIndex) {
              cache.currentExamIndex = Number(matchingIndex);
            }
          } else if (!cache.isMarkScheme && cache.currentExamIndex > 0 && standardCode) {
            if (!cache.examCodes[cache.currentExamIndex]) {
              cache.examCodes[cache.currentExamIndex] = standardCode;
            }
          }

          const viewport = page.getViewport({ scale: 2.0 });
          const mappedItems = textContent.items.map((item: any) => {
            const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            return { text: item.str.trim(), x, y, height: item.height };
          });

          if (cache.isMarkScheme && cache.currentExamIndex > 0) {
            const rowMap: Record<number, any[]> = {};
            mappedItems.forEach((item: any) => {
              if (item.text.length === 0) return;
              const y = Math.round(item.y / 10) * 10;
              if (!rowMap[y]) rowMap[y] = [];
              rowMap[y].push(item);
            });

            const sortedY = Object.keys(rowMap).map(Number).sort((a, b) => a - b);
            for (const y of sortedY) {
              const rowItems = rowMap[y].sort((a, b) => a.x - b.x);
              const rowText = rowItems.map(i => i.text);
              
              for (let i = 0; i < rowText.length - 1; i++) {
                const qNum = parseInt(rowText[i]);
                const ans = rowText[i+1];
                if (!isNaN(qNum) && qNum >= 1 && qNum <= 40 && qNum.toString() === rowText[i] && ['A', 'B', 'C', 'D'].includes(ans)) {
                  if (!cache.markSchemes[cache.currentExamIndex]) {
                    cache.markSchemes[cache.currentExamIndex] = {};
                  }
                  cache.markSchemes[cache.currentExamIndex][qNum] = ans;
                }
              }
            }

            const regex = /\b(\d{1,2})\s+([A-D])\b/g;
            let match;
            while ((match = regex.exec(textStr)) !== null) {
              const qNum = parseInt(match[1]);
              const ans = match[2];
              if (qNum >= 1 && qNum <= 40) {
                if (!cache.markSchemes[cache.currentExamIndex]) {
                  cache.markSchemes[cache.currentExamIndex] = {};
                }
                if (!cache.markSchemes[cache.currentExamIndex][qNum]) {
                  cache.markSchemes[cache.currentExamIndex][qNum] = ans;
                }
              }
            }
          } else if (!cache.isMarkScheme && !isCoverPage && cache.currentExamIndex > 0) {
            const validTextItems = mappedItems.filter(i => i.text.length > 0);
            if (validTextItems.length > 0) {
              const possibleQItems = validTextItems.filter(i => {
                const num = parseInt(i.text);
                return num >= 1 && num <= 40 && i.text === num.toString();
              });

              if (possibleQItems.length > 0) {
                const leftAlignedItems = possibleQItems.filter(i => i.x < 150);
                if (leftAlignedItems.length > 0) {
                  const minX = Math.min(...leftAlignedItems.map(i => i.x));
                  const qItems = leftAlignedItems.filter(i => i.x <= minX + 20);

                  qItems.sort((a, b) => a.y - b.y);

                  const uniqueQItems = [];
                  for (const item of qItems) {
                    if (uniqueQItems.length === 0 || item.y - uniqueQItems[uniqueQItems.length - 1].y > 20) {
                      uniqueQItems.push(item);
                    }
                  }

                  const pageQItems = [];
                  for (const item of uniqueQItems) {
                    const num = parseInt(item.text);
                    if (num > cache.currentQNum && num <= cache.currentQNum + 3) {
                      pageQItems.push(item);
                      cache.currentQNum = num;
                    }
                  }

                  for (let i = 0; i < pageQItems.length; i++) {
                    const qItem = pageQItems[i];
                    const qNumber = parseInt(qItem.text);
                    const startY = Math.max(0, qItem.y - 20);
                    
                    let endY;
                    if (i < pageQItems.length - 1) {
                      endY = pageQItems[i+1].y - 20;
                    } else {
                      const footerItems = validTextItems.filter(item => 
                        item.y > qItem.y && 
                        (item.text.includes('UCLES') || 
                         item.text.includes('Cambridge') || 
                         item.text.toLowerCase().includes('turn over') ||
                         item.text.includes('BLANK PAGE') ||
                         item.text.match(/\b\d{4}\/\d{2}\/(M\/J|O\/N|F\/M)\/\d{2}\b/) ||
                         item.text.match(/\b(06|11|03)_\d{4}_\d{2}[_ /](?:[A-Za-z]+_)?(\d{4})/))
                      );
                      if (footerItems.length > 0) {
                        const minFooterY = Math.min(...footerItems.map(item => item.y));
                        endY = minFooterY - 20;
                      } else {
                        endY = viewport.height;
                      }
                    }
                    
                    const questionTextItems = validTextItems.filter(item => item.y >= startY && item.y <= endY);
                    const questionText = questionTextItems.map(item => item.text).join(' ');
                    
                    if (subj && !isQuestionValid(subj, questionText)) {
                      continue; // Skip this question as it's removed from syllabus
                    }
                    
                    cache.extractedQuestions.push({
                      examIndex: cache.currentExamIndex,
                      qNumber,
                      pageIndex: pageNum,
                      startY,
                      endY,
                      examCode: cache.examCodes[cache.currentExamIndex]
                    });
                  }
                }
              }
            }
          }

          const newlyValid: Question[] = [];
          const remainingExtracted: Question[] = [];
          for (const q of cache.extractedQuestions) {
            const ans = cache.markSchemes[q.examIndex]?.[q.qNumber];
            if (ans) {
              q.answer = ans;
              q.examCode = cache.examCodes[q.examIndex] || q.examCode;
              newlyValid.push(q);
            } else {
              remainingExtracted.push(q);
            }
          }
          
          cache.extractedQuestions = remainingExtracted;
          
          if (newlyValid.length > 0) {
            cache.validQuestions.push(...newlyValid);
            newValidCount += newlyValid.length;
            
            if (subject === subj) {
              setQuestions([...cache.validQuestions]);
            }
          }

          if (subject === subj) {
            const exams = Object.entries(cache.examCodes).map(([index, code]) => ({ index: Number(index), code: code as string }));
            setAvailableExams(exams);
          }

          cache.pageNum++;
        }
        
        // Yield to the main thread to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (cache.pageNum > pdfDoc.numPages) {
        cache.isFinished = true;
        if (subject === subj) {
          setIsParsingFinished(true);
        }
      }
    } catch (error) {
      console.error(`Error parsing PDF pages for ${subj}:`, error);
      cache.isFinished = true;
      if (subject === subj) {
        setIsParsingFinished(true);
      }
    } finally {
      cache.isParsing = false;
    }
  };

  const loadSubjectPdf = async (subj: Subject, restoreState?: { stats: {total: number, correct: number}, askedQuestionIds: string[] }, vaultQuestion?: any) => {
    setSubject(subj);
    
    const cache = getCache(subj, level);
    setQuestions([...cache.validQuestions]);
    const exams = Object.entries(cache.examCodes).map(([index, code]) => ({ index: Number(index), code: code as string }));
    setAvailableExams(exams);
    setIsParsingFinished(cache.isFinished);

    if (restoreState) {
      setStats(restoreState.stats);
      setAskedQuestionIds(new Set(restoreState.askedQuestionIds));
      setScreen('quiz');
    }
    
    if (vaultQuestion) {
      setCurrentQuestion(vaultQuestion);
      setScreen('quiz');
      setQuizMode('vault');
    }

    const fileName = getFileName(subj, level);

    let loadedPdf = preloadedPdfsRef.current[fileName];
    
    try {
      if (!loadedPdf) {
        let response;
        try {
          response = await fetch(`/${fileName}.pdf`);
        } catch (err) {
          throw new Error(`Network error: Failed to fetch /${fileName}.pdf. Please check your connection or disable adblockers.`);
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch /${fileName}.pdf (Status: ${response.status})`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error(`File /${fileName}.pdf not found. Please upload it to the public folder.`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        const uint8Array = new Uint8Array(arrayBuffer);
        if (uint8Array.length < 5 || 
            uint8Array[0] !== 0x25 || // %
            uint8Array[1] !== 0x50 || // P
            uint8Array[2] !== 0x44 || // D
            uint8Array[3] !== 0x46 || // F
            uint8Array[4] !== 0x2D) { // -
          throw new Error(`File /${fileName}.pdf is not a valid PDF file. Please ensure you uploaded a valid PDF document.`);
        }

        loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      }
      setPdf(loadedPdf);

      if (quizMode === 'whole_paper') {
        setScreen('select_exam');
        // Parse the rest of the PDF in the background to find all exams
        setTimeout(() => {
          parseMorePages(loadedPdf, subj, level, 1000); // Parse a lot to find all exams
        }, 100);
      } else if (vaultQuestion) {
        setScreen('quiz');
        setCurrentQuestion(vaultQuestion);
        setQuestionImage('loading');
        setEliminatedOptions([]);
        setShowHintTip(false);
        setHintTipText('');
        setHintTimer(0);
        try {
          const img = await renderQuestionImage(loadedPdf, vaultQuestion);
          setQuestionImage(img);
        } catch (err) {
          console.error('Error rendering vault question image:', err);
          setQuestionImage(null);
        }
      } else {
        await parseMorePages(loadedPdf, subj, level, 5, 5000);
        
        if (cache.validQuestions.length > 0) {
          if (restoreState) {
            setStats(restoreState.stats);
            const restoredSet = new Set(restoreState.askedQuestionIds);
            setAskedQuestionIds(restoredSet);
            setScreen('quiz');
            pickRandomQuestion(loadedPdf, restoredSet, subj);
          } else {
            setStats({ total: 0, correct: 0 });
            setAskedQuestionIds(new Set());
            setScreen('quiz');
            pickRandomQuestion(loadedPdf, new Set(), subj);
          }
          
          // Start background parsing for the next chunk after the UI has updated
          setTimeout(() => {
            parseMorePages(loadedPdf, subj, level, 30);
          }, 100);
        } else {
          setErrorMessage(`Could not find any valid questions with answers in ${fileName}.pdf.`);
          setScreen('home');
        }
      }
    } catch (error: any) {
      console.error('Error parsing PDF:', error);
      setErrorMessage(error.message || `Error loading ${fileName}.pdf. Please make sure the file exists in the public directory.`);
      setScreen('home');
    } finally {
      setLoading(false);
    }
  };

  const pickRandomQuestion = async (loadedPdf: pdfjsLib.PDFDocumentProxy, currentAskedIds: Set<string>, subj?: Subject) => {
    const activeSubject = subj || subject;
    if (!activeSubject) return;
    const cache = getCache(activeSubject, level);
    if (isGuest && !userProfile && guestQuestionsCount >= 10) {
      setShowPremiumModal(true);
      return;
    }

    setQuestionImage(null);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setExplanation(null);
    setIsExplaining(false);
    setFollowUps([]);
    setFollowUpInput('');
    setIsSendingFollowUp(false);
    setEliminatedOptions([]);
    setShowHintTip(false);
    setHintTipText('');
    setHintTimer(0);
    
    let availableQs = cache.validQuestions.filter(q => !currentAskedIds.has(`${q.examIndex}-${q.qNumber}`));
    
    if (availableQs.length < 10 && !cache.isFinished && !cache.isParsing) {
      setTimeout(() => {
        parseMorePages(loadedPdf, activeSubject, level, 30);
      }, 100);
    }

    if (availableQs.length === 0) {
      if (!cache.isFinished) {
        setQuestionImage('loading');
        while (availableQs.length === 0 && !cache.isFinished) {
          await parseMorePages(loadedPdf, activeSubject, level, 20);
          availableQs = cache.validQuestions.filter(q => !currentAskedIds.has(`${q.examIndex}-${q.qNumber}`));
        }
        if (availableQs.length === 0) {
          setScreen('results');
          return;
        }
      } else {
        setScreen('results');
        return;
      }
    }

    const randomQ = availableQs[Math.floor(Math.random() * availableQs.length)];
    setCurrentQuestion(randomQ);

    const newAskedIds = new Set(currentAskedIds);
    newAskedIds.add(`${randomQ.examIndex}-${randomQ.qNumber}`);
    setAskedQuestionIds(newAskedIds);

    try {
      const page = await loadedPdf.getPage(randomQ.pageIndex);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      const cropY = randomQ.startY;
      const cropHeight = randomQ.endY - randomQ.startY;
      
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) return;
      
      croppedCanvas.width = viewport.width;
      croppedCanvas.height = cropHeight;
      
      croppedCtx.fillStyle = '#ffffff';
      croppedCtx.fillRect(0, 0, viewport.width, cropHeight);
      
      croppedCtx.drawImage(
        canvas,
        0, cropY, viewport.width, cropHeight,
        0, 0, viewport.width, cropHeight
      );
      
      // Trim white space from all sides
      const imageData = croppedCtx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
      const data = imageData.data;
      
      let topTrim = 0;
      let bottomTrim = croppedCanvas.height - 1;
      let leftTrim = 0;
      let rightTrim = croppedCanvas.width - 1;
      
      // Find top
      for (let y = 0; y < croppedCanvas.height; y++) {
        let isRowBlank = true;
        for (let x = 0; x < croppedCanvas.width; x++) {
          const index = (y * croppedCanvas.width + x) * 4;
          if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
            isRowBlank = false;
            break;
          }
        }
        if (!isRowBlank) {
          topTrim = y;
          break;
        }
      }
      
      // Find bottom
      for (let y = croppedCanvas.height - 1; y >= 0; y--) {
        let isRowBlank = true;
        for (let x = 0; x < croppedCanvas.width; x++) {
          const index = (y * croppedCanvas.width + x) * 4;
          if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
            isRowBlank = false;
            break;
          }
        }
        if (!isRowBlank) {
          bottomTrim = y;
          break;
        }
      }
      
      // Find left
      for (let x = 0; x < croppedCanvas.width; x++) {
        let isColBlank = true;
        for (let y = topTrim; y <= bottomTrim; y++) {
          const index = (y * croppedCanvas.width + x) * 4;
          if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
            isColBlank = false;
            break;
          }
        }
        if (!isColBlank) {
          leftTrim = x;
          break;
        }
      }
      
      // Find right
      for (let x = croppedCanvas.width - 1; x >= 0; x--) {
        let isColBlank = true;
        for (let y = topTrim; y <= bottomTrim; y++) {
          const index = (y * croppedCanvas.width + x) * 4;
          if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
            isColBlank = false;
            break;
          }
        }
        if (!isColBlank) {
          rightTrim = x;
          break;
        }
      }
      
      // Add a little padding
      const padding = 20;
      topTrim = Math.max(0, topTrim - padding);
      bottomTrim = Math.min(croppedCanvas.height - 1, bottomTrim + padding);
      leftTrim = Math.max(0, leftTrim - padding);
      rightTrim = Math.min(croppedCanvas.width - 1, rightTrim + padding);
      
      const trimWidth = rightTrim - leftTrim + 1;
      const trimHeight = bottomTrim - topTrim + 1;
      
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) return;
      
      finalCanvas.width = trimWidth;
      finalCanvas.height = trimHeight;
      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, trimWidth, trimHeight);
      finalCtx.drawImage(
        croppedCanvas, 
        leftTrim, topTrim, trimWidth, trimHeight,
        0, 0, trimWidth, trimHeight
      );
      
      setQuestionImage(finalCanvas.toDataURL('image/png'));
    } catch (error) {
      console.error('Error rendering question:', error);
    }
  };

  const handleAnswer = async (ans: string) => {
    if (selectedAnswer || !currentQuestion) return;

    // Daily Economics Limit Check
    if (subject === 'economics' && !hasPremiumForLevel(userProfile, level)) {
      const today = new Date().toISOString().split('T')[0];
      const dailyEcon = userProfile?.lastEconResetDate === today ? (userProfile?.dailyEconAnswered || 0) : 0;
      if (dailyEcon >= 10) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
        return;
      }
    }

    setSelectedAnswer(ans);
    const correct = ans === currentQuestion.answer;
    setIsCorrect(correct);
    setStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0)
    }));
    
    if (userProfile && subject) {
      await updateStats(userProfile.uid, subject, correct ? 1 : 0, 1);
      
      if (!isGlobalPremium(userProfile)) {
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
    } else if (isGuest && !userProfile) {
      const newCount = guestQuestionsCount + 1;
      setGuestQuestionsCount(newCount);
      try { localStorage.setItem('guestQuestionsCount', newCount.toString()); } catch {}
      if (newCount >= 10) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
      }
    }

    setUserAnswers(prev => [...prev, {
      question: currentQuestion,
      questionImage,
      selectedAnswer: ans,
      isCorrect: correct
    }]);
  };

  const generateExplanation = async () => {
    if (!questionImage || !currentQuestion || !selectedAnswer) return;
    
    setIsExplaining(true);
    setExplanation(null);
    setErrorMessage(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Data = questionImage.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data
              }
            },
            {
              text: `The user was asked this multiple choice question. The correct answer is ${currentQuestion.answer}. The user selected ${selectedAnswer}. Provide a very short, concise explanation (1-3 sentences) of why ${currentQuestion.answer} is the correct answer. Do NOT use LaTeX or markdown math formatting (like $ or \\text). Use plain text and unicode characters for formulas and units (e.g., CH₃COOH, 60 g/mol, 250 cm³, 2 mol/dm³).`
            }
          ]
        },
        config: {
          systemInstruction: "Do NOT use LaTeX or markdown math formatting (like $ or \\text). Use plain text and unicode characters for formulas and units (e.g., CH₃COOH, 60 g/mol, 250 cm³, 2 mol/dm³)."
        }
      });
      
      setExplanation(response.text || "No explanation could be generated.");
    } catch (error: any) {
      console.error("Error generating explanation:", error);
      setExplanation("Our AI features are currently being optimized and will be fully available in the near future! Stay tuned for more updates.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!followUpInput.trim() || !questionImage || !currentQuestion || !selectedAnswer || !explanation) return;

    const newUserMsg = followUpInput.trim();
    setFollowUpInput('');
    setFollowUps(prev => [...prev, { role: 'user', text: newUserMsg }]);
    setIsSendingFollowUp(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Data = questionImage.split(',')[1];

      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data
              }
            },
            {
              text: `The user was asked this multiple choice question. The correct answer is ${currentQuestion.answer}. The user selected ${selectedAnswer}. Provide a very short, concise explanation (1-3 sentences) of why ${currentQuestion.answer} is the correct answer. Do NOT use LaTeX or markdown math formatting (like $ or \\text). Use plain text and unicode characters for formulas and units (e.g., CH₃COOH, 60 g/mol, 250 cm³, 2 mol/dm³).`
            }
          ]
        },
        {
          role: 'model',
          parts: [{ text: explanation }]
        },
        ...followUps.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [{ text: newUserMsg }]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: "Do NOT use LaTeX or markdown math formatting (like $ or \\text). Use plain text and unicode characters for formulas and units (e.g., CH₃COOH, 60 g/mol, 250 cm³, 2 mol/dm³)."
        }
      });

      setFollowUps(prev => [...prev, { role: 'model', text: response.text || "No response generated." }]);
    } catch (error: any) {
      console.error("Error generating follow-up:", error);
      setFollowUps(prev => [...prev, { role: 'ai', text: "Our follow-up chat is currently being optimized and will be available in the near future. Thanks for your patience!" }]);
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  const handleHint = async () => {
    if (!userProfile || !currentQuestion || eliminatedOptions.length > 0) return;
    
    // Check if hints are available
    const today = new Date().toISOString().split('T')[0];
    let hintsRemaining = userProfile.hintsRemaining;
    
    if (userProfile.lastHintResetDate !== today || hintsRemaining === undefined) {
      // Reset hints for a new day
      hintsRemaining = isGlobalPremium(userProfile) ? 5 : 2;
    }
    
    if (hintsRemaining <= 0) {
      // Show out of hints message or prompt to upgrade
      if (!isGlobalPremium(userProfile)) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
      }
      return;
    }

    // Eliminate 2 wrong options immediately
    const allOptions = ['A', 'B', 'C', 'D'];
    const wrongOptions = allOptions.filter(opt => opt !== currentQuestion.answer);
    // Shuffle and pick 2
    const shuffledWrong = wrongOptions.sort(() => 0.5 - Math.random());
    const toEliminate = shuffledWrong.slice(0, 2);
    
    setEliminatedOptions(toEliminate);
    
    // Update user profile
    const newHintsRemaining = hintsRemaining - 1;
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        hintsRemaining: newHintsRemaining,
        lastHintResetDate: today
      });
    } catch (error) {
      console.error("Error updating hint count:", error);
    }
  };

  const handleNext = async () => {
    if (quizMode === 'vault') {
      setScreen('home');
      return;
    }

    if (assignmentCount && stats.correct >= assignmentCount) {
      if (activeAssignmentId && activeClassroomId && userProfile) {
        try {
          const { createAssignmentCompletion } = await import('./services/db');
          await createAssignmentCompletion(activeAssignmentId, userProfile.uid, activeClassroomId, stats.correct, stats.total, true, Array.from(askedQuestionIds));
        } catch (e) {
          console.error("Failed to save assignment completion", e);
        }
      }
      setScreen('results');
      return;
    }

    if (pdf && subject) {
      const cache = getCache(subject, level);
      const availableCount = cache.validQuestions.length - askedQuestionIds.size;
      if (availableCount < 20 && !cache.isFinished) {
        parseMorePages(pdf, subject, level, 30);
      }
      pickRandomQuestion(pdf, askedQuestionIds);
    }
  };

  const handleSkip = () => {
    if (quizMode === 'vault') {
      setScreen('home');
      return;
    }
    handleNext();
  };

  const handleRestart = () => {
    if (pdf && subject && getCache(subject, level).validQuestions.length > 0) {
      setStats({ total: 0, correct: 0 });
      setAskedQuestionIds(new Set());
      setUserAnswers([]);
      setShowReview(false);
      setScreen('quiz');
      pickRandomQuestion(pdf, new Set());
    }
  };

  const handleEndSession = async () => {
    if (subject) {
      getCache(subject, level).stopParsing = true;
    }
    if (activeAssignmentId && activeClassroomId && userProfile && assignmentCount && stats.correct < assignmentCount) {
      try {
        const { createAssignmentCompletion } = await import('./services/db');
        await createAssignmentCompletion(activeAssignmentId, userProfile.uid, activeClassroomId, stats.correct, stats.total, false, Array.from(askedQuestionIds));
      } catch (e) {
        console.error("Failed to save assignment progress", e);
      }
    }
    setScreen('results');
  };

  const goHome = () => {
    if (subject) {
      getCache(subject, level).stopParsing = true;
    }
    setScreen((user || isGuest) ? 'dashboard' : 'home');
    setPdf(null);
    setQuestions([]);
    setCurrentQuestion(null);
    setAssignmentCount(null);
    setSelectedYear(null);
    setSelectedSession(null);
    setIsProfileModalOpen(false);
    setIsFriendHubModalOpen(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsGuest(true);
    setIsProfileModalOpen(false);
    setIsFriendHubModalOpen(false);
    setScreen('dashboard');
  };

  const handleBack = () => {
    if (screen === 'classroom') {
      setScreen('dashboard');
      setActiveClassroomId(null);
    } else if (screen === 'leaderboard' || screen === 'friends' || screen === 'multiplayer-setup') {
      setScreen('dashboard');
    } else if (screen === 'multiplayer-game') {
      setScreen('dashboard');
      setActiveGame(null);
    } else {
      goHome();
    }
  };

  const estimatedScore = (stats.total || 0) > 0 ? Math.round(((stats.correct || 0) / (stats.total || 1)) * 40) : 0;

  const renderScreen = () => {
    if (authLoading) {
      return <div className={`min-h-screen flex items-center justify-center ${themes[activeTheme].wrapper} ${themes[activeTheme].textSecondary}`}>Loading...</div>;
    }

    if (isDowntime && userProfile?.role !== 'admin') {
      return (
        <div className={`min-h-screen ${themes[activeTheme].wrapper} flex items-center justify-center p-4`}>
          <div className={`${themes[activeTheme].card} p-8 sm:p-12 rounded-3xl max-w-lg w-full text-center shadow-xl border ${themes[activeTheme].border}`}>
            <ThemeIcon icon="Wrench" theme={activeTheme} className={`w-16 h-16 mx-auto mb-6 ${themes[activeTheme].textSecondary}`} />
            <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${themes[activeTheme].textPrimary} mb-4`}>
              Under Maintenance
            </h1>
            <p className={`${themes[activeTheme].textSecondary} font-medium`}>
              The website is being fixed and updated by the developers. Please check back later!
            </p>
          </div>
        </div>
      );
    }

    const isGuestUser = isGuest && !user;

    const wrapWithGuestOverlay = (component: React.ReactNode) => {
      if (!isGuestUser) return component;
      return (
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 blur-md pointer-events-none overflow-hidden select-none">
            {component}
          </div>
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/5">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${themes[activeTheme].card} p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm mx-4 border ${themes[activeTheme].border} backdrop-blur-sm`}
            >
              <div className={`w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mx-auto mb-6 transform rotate-3`}>
                <ThemeIcon icon="Lock" theme={activeTheme} className="w-8 h-8 text-white" />
              </div>
              <h3 className={`text-2xl font-black ${themes[activeTheme].textPrimary} uppercase tracking-tight mb-2`}>Sign In Required</h3>
              <p className={`${themes[activeTheme].textSecondary} mb-8 font-medium`}>Unlock this feature and start tracking your progress by creating a free account!</p>
              <button 
                onClick={() => setShowAuthModal(true)}
                className={`w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]`}
              >
                Sign In Now
              </button>
            </motion.div>
          </div>
        </div>
      );
    };

    if (userProfile?.isBanned) {
      const now = Date.now();
      if (userProfile.banUntil && now > userProfile.banUntil) {
        // Ban has expired, unban them in the background
        updateDoc(doc(db, 'users', userProfile.uid), { isBanned: false, banUntil: null }).catch(console.error);
        // Let them through by not returning the ban screen
      } else {
        const banMessage = userProfile.banUntil 
          ? `Your account has been suspended until ${new Date(userProfile.banUntil).toLocaleString()}.`
          : `Your account has been permanently banned due to a violation of our terms of service.`;
          
        return (
          <div className={`min-h-screen ${themes[activeTheme].bg} flex items-center justify-center p-4`}>
            <div className={`${themes[activeTheme].card} p-8 sm:p-12 rounded-3xl max-w-lg w-full text-center shadow-xl border-2 border-red-500/50`}>
              <ThemeIcon icon="Ban" theme={activeTheme} className={`w-16 h-16 mx-auto mb-6 text-red-500`} />
              <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight text-red-500 mb-4`}>
                Account Suspended
              </h1>
              <p className={`${themes[activeTheme].textSecondary} font-medium mb-8`}>
                {banMessage}
              </p>
              <button onClick={() => signOut(auth)} className="px-8 py-3 bg-red-500 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-sm hover:bg-red-600 active:scale-95">
                Sign Out
              </button>
            </div>
          </div>
        );
      }
    }

    if (screen === 'admin') {
      return <AdminDashboard onBack={() => setScreen('dashboard')} activeTheme={activeTheme} />;
    }

    if (screen === 'auth') {
      return <Auth onLogin={() => setScreen('dashboard')} onGuest={handleGuest} activeTheme={activeTheme} />;
    }

    if (screen === 'dashboard') {
      if (userProfile?.role === 'teacher') {
        return (
          <TeacherDashboard 
            activeTheme={activeTheme}
            onSelectClassroom={(id) => { setActiveClassroomId(id); setScreen('classroom'); }} 
          />
        );
      } else {
        return (
          <StudentDashboard 
            userProfile={userProfile || { 
              username: 'Guest', 
              totalAnswered: guestQuestionsCount, 
              accuracy: 0, 
              won: 0, 
              podiums: 0 
            } as any}
            activeTheme={activeTheme}
            onSelectClassroom={(id) => { setActiveClassroomId(id); setScreen('classroom'); }} 
            onPlaySolo={() => { setScreen('home'); setSubject(null); setQuizMode('standard'); setLoading(false); }} 
            onPlayMultiplayer={() => setScreen('multiplayer-setup')} 
            onViewLeaderboard={() => setScreen('leaderboard')} 
            onViewClassrooms={() => setScreen('classroom-hub')}
            isAdminUnlocked={isAdminUnlocked || userProfile?.role === 'admin'}
            onOpenAdmin={() => setScreen('admin')}
          />
        );
      }
    }

    if (screen === 'classroom' && activeClassroomId) {
      const classroomComponent = (
        <ClassroomView classroomId={activeClassroomId} userRole={userProfile?.role || 'student'} activeTheme={activeTheme} onBack={handleBack} onStartAssignment={(subj, count, assignId, savedStats, savedAskedQuestionIds) => { 
          setAssignmentCount(count); 
          setActiveAssignmentId(assignId); 
          if (savedStats && savedAskedQuestionIds) {
            loadSubjectPdf(subj as Subject, { stats: savedStats, askedQuestionIds: savedAskedQuestionIds });
          } else {
            loadSubjectPdf(subj as Subject); 
          }
        }} />
      );
      return wrapWithGuestOverlay(classroomComponent);
    }

    if (screen === 'leaderboard') {
      return wrapWithGuestOverlay(<Leaderboard onBack={handleBack} activeTheme={activeTheme} currentUserProfile={userProfile} />);
    }

    if (screen === 'classroom-hub') {
      return wrapWithGuestOverlay(<ClassroomHub onBack={handleBack} activeTheme={activeTheme} onSelectClassroom={(id) => { setActiveClassroomId(id); setScreen('classroom'); }} />);
    }

    if (screen === 'multiplayer-setup') {
      return wrapWithGuestOverlay(<MultiplayerSetup onBack={handleBack} activeTheme={activeTheme} userProfile={userProfile} initialJoinCode={initialJoinCode} onStartGame={(game) => {
        setActiveGame(game);
        setScreen('multiplayer-game');
      }} />);
    }

    if (screen === 'multiplayer-game' && activeGame) {
      return <MultiplayerGame game={activeGame} userProfile={userProfile} onExit={handleBack} activeTheme={activeTheme} />;
    }

    return (
      <div className={`flex-1 flex flex-col min-h-0 ${themes[activeTheme].wrapper.replace('h-[100dvh]', 'h-full')}`}>
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0 p-3 sm:p-6">
        {screen === 'home' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-3 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm transition-colors duration-200 flex-1 flex flex-col min-h-0 justify-center ${themes[activeTheme].card}`}
          >
            <h2 className="text-lg sm:text-xl font-bold text-center mb-3 sm:mb-4 dark:text-white shrink-0">Start a New Game</h2>
            
            <div className="flex justify-center mb-3 sm:mb-6 shrink-0 w-full overflow-x-auto custom-scrollbar pb-1">
              <div className={`${themes[activeTheme].tabInactive} p-1 rounded-xl flex flex-row w-auto justify-center gap-1 shrink-0`}>
                <button
                  onClick={() => setQuizMode('standard')}
                  className={`px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${quizMode === 'standard' ? `${themes[activeTheme].tabActive} shadow-sm` : `${themes[activeTheme].textSecondary} hover:opacity-80`}`}
                >
                  Random Questions
                </button>
                <button
                  onClick={() => setQuizMode('whole_paper')}
                  className={`px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${quizMode === 'whole_paper' ? `${themes[activeTheme].tabActive} shadow-sm` : `${themes[activeTheme].textSecondary} hover:opacity-80`}`}
                >
                  Whole Exam
                </button>
                <button
                  onClick={() => setQuizMode('vault')}
                  className={`px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${quizMode === 'vault' ? `${themes[activeTheme].tabActive} shadow-sm` : `${themes[activeTheme].textSecondary} hover:opacity-80`}`}
                >
                  Question Vault
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className={`flex flex-col items-center justify-center py-6 sm:py-8 ${themes[activeTheme].textSecondary} flex-1`}>
                <div className={`animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 ${themes[activeTheme].border} mb-3 sm:mb-4`}></div>
                <p className="font-medium text-sm sm:text-base">Loading {subject} questions...</p>
              </div>
            ) : (
              !subject || quizMode !== 'vault' ? (
            <div className="flex flex-col gap-4">
              {(!subject) && (
                <div className="flex justify-center shrink-0 w-full">
                  <div className="w-full max-w-xs">
                    <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-center ${themes[activeTheme].textSecondary}`}>Level</label>
                    <select 
                      value={level} 
                      onChange={(e: any) => setLevel(e.target.value)} 
                      className={`w-full px-4 py-3 rounded-2xl border outline-none font-bold text-sm transition-all cursor-pointer appearance-none text-center ${themes[activeTheme].input}`}
                    >
                      <option value="extended">Extended / IGCSE</option>
                      <option value="core">Core</option>
                      <option value="a_level">A Level</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="flex flex-row gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-2 shrink-0">
              <button 
                onClick={() => quizMode === 'vault' ? setSubject('chemistry') : loadSubjectPdf('chemistry')}
                className={`flex-1 min-w-[100px] sm:min-w-0 flex flex-col items-center justify-center h-28 sm:h-48 p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group`}
              >
                <ThemeIcon icon="FlaskConical" theme={activeTheme} className={`w-6 h-6 sm:w-12 sm:h-12 ${themes[activeTheme].textSecondary} group-hover:${themes[activeTheme].accent} mb-1 sm:mb-3 transition-colors`} />
                <span className={`text-xs sm:text-lg font-bold ${themes[activeTheme].textPrimary} group-hover:${themes[activeTheme].accent}`}>Chemistry</span>
              </button>
              
              <button 
                onClick={() => quizMode === 'vault' ? setSubject('physics') : loadSubjectPdf('physics')}
                className={`flex-1 min-w-[100px] sm:min-w-0 flex flex-col items-center justify-center h-28 sm:h-48 p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group`}
              >
                <ThemeIcon icon="Atom" theme={activeTheme} className={`w-6 h-6 sm:w-12 sm:h-12 ${themes[activeTheme].textSecondary} group-hover:${themes[activeTheme].accent} mb-1 sm:mb-3 transition-colors`} />
                <span className={`text-xs sm:text-lg font-bold ${themes[activeTheme].textPrimary} group-hover:${themes[activeTheme].accent}`}>Physics</span>
              </button>

              <button 
                onClick={() => quizMode === 'vault' ? setSubject('biology') : loadSubjectPdf('biology')}
                className={`flex-1 min-w-[100px] sm:min-w-0 flex flex-col items-center justify-center h-28 sm:h-48 p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group`}
              >
                <ThemeIcon icon="Dna" theme={activeTheme} className={`w-6 h-6 sm:w-12 sm:h-12 ${themes[activeTheme].textSecondary} group-hover:${themes[activeTheme].accent} mb-1 sm:mb-3 transition-colors`} />
                <span className={`text-xs sm:text-lg font-bold ${themes[activeTheme].textPrimary} group-hover:${themes[activeTheme].accent}`}>Biology</span>
              </button>

              {level !== 'core' && (
                <>
                  <button 
                    onClick={() => {
                      if (userProfile && !hasPremiumForLevel(userProfile, level)) {
                        const today = new Date().toISOString().split('T')[0];
                        const dailyEcon = userProfile.lastEconResetDate === today ? (userProfile.dailyEconAnswered || 0) : 0;
                        if (dailyEcon >= 10) {
                          window.dispatchEvent(new CustomEvent('openPremiumModal'));
                          return;
                        }
                      }
                      quizMode === 'vault' ? setSubject('economics') : loadSubjectPdf('economics');
                    }}
                    className={`flex-1 min-w-[100px] sm:min-w-0 flex flex-col items-center justify-center h-28 sm:h-48 p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group relative`}
                  >
                    {!hasPremiumForLevel(userProfile, level) && (
                      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                        <ThemeIcon icon="Crown" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    )}
                    <ThemeIcon icon="TrendingUp" theme={activeTheme} className={`w-6 h-6 sm:w-12 sm:h-12 ${themes[activeTheme].textSecondary} group-hover:${themes[activeTheme].accent} mb-1 sm:mb-3 transition-colors`} />
                    <span className={`text-xs sm:text-lg font-bold ${themes[activeTheme].textPrimary} group-hover:${themes[activeTheme].accent}`}>Economics</span>
                  </button>

                  <button 
                    onClick={() => quizMode === 'vault' ? setSubject('accounting') : loadSubjectPdf('accounting')}
                    className={`flex-1 min-w-[100px] sm:min-w-0 flex flex-col items-center justify-center h-28 sm:h-48 p-2 sm:p-6 rounded-xl sm:rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group`}
                  >
                    <ThemeIcon icon="Calculator" theme={activeTheme} className={`w-6 h-6 sm:w-12 sm:h-12 ${themes[activeTheme].textSecondary} group-hover:${themes[activeTheme].accent} mb-1 sm:mb-3 transition-colors`} />
                    <span className={`text-xs sm:text-lg font-bold ${themes[activeTheme].textPrimary} group-hover:${themes[activeTheme].accent}`}>Accounting</span>
                  </button>
                </>
              )}
            </div>
            </div>
              ) : null
            )}

            {quizMode === 'vault' && subject ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center mb-4">
                  <button 
                    onClick={() => setSubject(null)}
                    className={`flex items-center text-sm font-medium ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors`}
                  >
                    <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-4 h-4 mr-1" /> Back to Subjects
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  <QuestionVault 
                    subject={subject} 
                    activeTheme={activeTheme}
                    onSelectQuestion={(q) => {
                      // Load the specific question
                      loadSubjectPdf(subject as Subject, {
                        stats: { total: 0, correct: 0 },
                        askedQuestionIds: []
                      }, q);
                    }} 
                  />
                </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {screen === 'quiz' && pdf && currentQuestion && (
          <div className="max-w-4xl mx-auto p-2 sm:p-4 space-y-3 sm:space-y-4 flex-1 flex flex-col min-h-0 w-full overflow-hidden">
            <div className={`flex flex-row justify-between items-center gap-2 mb-1 p-2 rounded-xl shadow-sm shrink-0 ${themes[activeTheme].card}`}>
              <div className="flex items-center gap-2">
                <div className={`text-[10px] font-medium ${themes[activeTheme].textSecondary} uppercase tracking-wider`}>
                  <span className={`font-bold ${themes[activeTheme].accent}`}>{subject}</span> • Q{currentQuestion.qNumber}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-[10px] font-medium ${themes[activeTheme].textSecondary} ${themes[activeTheme].tabInactive} px-3 py-1.5 rounded-full border ${themes[activeTheme].border} shadow-sm transition-colors duration-200`}>
                  {assignmentCount ? (
                    <>Progress: <span className={`font-bold ${themes[activeTheme].textPrimary}`}>{stats.correct || 0}</span> / {assignmentCount}</>
                  ) : (
                    <>Score: <span className={`font-bold ${themes[activeTheme].textPrimary}`}>{stats.correct || 0}</span> / {stats.total || 0}</>
                  )}
                </div>
                <button 
                  onClick={() => setShowBookmarkModal(true)}
                  className={`text-[10px] font-medium ${themes[activeTheme].successText} ${themes[activeTheme].successBg} px-3 py-1.5 rounded-full border ${themes[activeTheme].border} transition-colors flex items-center`}
                >
                  <ThemeIcon icon="Bookmark" theme={activeTheme} className="w-3 h-3 mr-1" /> Bookmark
                </button>
                {quizMode === 'vault' ? (
                  <button 
                    onClick={() => setScreen('home')}
                    className={`text-[10px] font-medium ${themes[activeTheme].textSecondary} ${themes[activeTheme].tabInactive} px-3 py-1.5 rounded-full border ${themes[activeTheme].border} transition-colors flex items-center`}
                  >
                    <ThemeIcon icon="ChevronRight" theme={activeTheme} className="w-3 h-3 mr-1 rotate-180" /> Back to Vault
                  </button>
                ) : (
                  <button 
                    onClick={handleEndSession}
                    className={`text-[10px] font-medium ${themes[activeTheme].errorText} ${themes[activeTheme].errorBg} px-3 py-1.5 rounded-full border ${themes[activeTheme].border} transition-colors flex items-center`}
                  >
                    <ThemeIcon icon="Flag" theme={activeTheme} className="w-3 h-3 mr-1" /> End
                  </button>
                )}
              </div>
            </div>

            <motion.div 
              key={currentQuestion.qNumber}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`${themes[activeTheme].card} rounded-2xl shadow-sm overflow-hidden transition-colors duration-200`}
            >
              <div className="p-2 sm:p-4 overflow-x-auto min-h-[150px] flex items-center justify-center bg-transparent custom-scrollbar">
                {questionImage ? (
                  <img 
                    src={questionImage} 
                    alt={`Question ${currentQuestion.qNumber}`}
                    className="w-full h-auto max-h-[35vh] object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
                  />
                ) : (
                  <div className={`flex flex-col items-center ${themes[activeTheme].textSecondary}`}>
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${themes[activeTheme].border} mb-3`}></div>
                    <p className="text-sm font-medium">Extracting...</p>
                  </div>
                )}
              </div>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {['A', 'B', 'C', 'D'].map((option) => {
                const isSelected = selectedAnswer === option;
                const isCorrectAnswer = currentQuestion.answer === option;
                const isEliminated = eliminatedOptions.includes(option);
                
                let buttonClass = "p-3 sm:p-4 text-lg sm:text-xl font-bold rounded-xl border-2 transition-all duration-300 shadow-sm relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] ";
                
                if (isEliminated && !selectedAnswer) {
                  buttonClass += `${themes[activeTheme].tabInactive} ${themes[activeTheme].border} ${themes[activeTheme].textSecondary} opacity-50 cursor-not-allowed`;
                } else if (!selectedAnswer) {
                  buttonClass += themes[activeTheme].button;
                } else {
                  if (isCorrectAnswer) {
                    buttonClass += themes[activeTheme].buttonCorrect + " scale-105 shadow-md";
                  } else if (isSelected) {
                    buttonClass += themes[activeTheme].buttonIncorrect + " scale-95 opacity-80";
                  } else {
                    buttonClass += `${themes[activeTheme].tabInactive} ${themes[activeTheme].border} ${themes[activeTheme].textSecondary} opacity-50`;
                  }
                }

                return (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    disabled={!!selectedAnswer || isEliminated}
                    className={`${buttonClass} ${hasPremiumForLevel(userProfile, level) ? 'btn-primary' : ''}`}
                  >
                    {isEliminated && !selectedAnswer && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ThemeIcon icon="X" theme={activeTheme} className={`w-8 h-8 ${themes[activeTheme].textSecondary} opacity-50`} />
                      </div>
                    )}
                    {option}
                    
                    {/* Theme Success Effects */}
                    {isSelected && isCorrectAnswer && isGlobalPremium(userProfile) && (
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
                );
              })}
            </div>

            {!selectedAnswer && (
              <div className="flex justify-between items-center mt-2">
                <button
                  onClick={handleHint}
                  disabled={eliminatedOptions.length > 0}
                  className={`flex items-center px-4 py-2 ${themes[activeTheme].button} rounded-xl font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed border ${themes[activeTheme].border}`}
                >
                  <ThemeIcon icon="Lightbulb" theme={activeTheme} className="w-4 h-4 mr-2" />
                  Hint
                  {userProfile && (
                    <span className={`ml-2 ${themes[activeTheme].iconContainer} px-2 py-0.5 rounded-full text-xs font-bold`}>
                      {userProfile.hintsRemaining !== undefined 
                        ? (isGlobalPremium(userProfile) ? 5 : 2) 
                        : (isGlobalPremium(userProfile) ? 5 : 2)}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  className={`flex items-center px-4 py-2 ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} hover:${themes[activeTheme].tabInactive} rounded-xl font-medium transition-colors text-sm`}
                >
                  Skip <ThemeIcon icon="SkipForward" theme={activeTheme} className="w-4 h-4 ml-2" />
                </button>
              </div>
            )}

            {selectedAnswer && (
              <div className="space-y-3">
                <div className={`p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ${isCorrect ? `${themes[activeTheme].successBg} border ${themes[activeTheme].border}` : `${themes[activeTheme].errorBg} border ${themes[activeTheme].border}`}`}>
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    {isCorrect ? (
                      <>
                        <div className={`${themes[activeTheme].iconContainer} p-2 rounded-full`}>
                          <ThemeIcon icon="CheckCircle2" theme={activeTheme} className={`w-6 h-6 sm:w-8 sm:h-8 ${themes[activeTheme].successText}`} />
                        </div>
                        <div>
                          <h3 className={`text-lg sm:text-xl font-bold ${themes[activeTheme].successText}`}>Correct!</h3>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`${themes[activeTheme].iconContainer} p-2 rounded-full`}>
                          <ThemeIcon icon="XCircle" theme={activeTheme} className={`w-6 h-6 sm:w-8 sm:h-8 ${themes[activeTheme].errorText}`} />
                        </div>
                        <div>
                          <h3 className={`text-lg sm:text-xl font-bold ${themes[activeTheme].errorText}`}>Incorrect</h3>
                          <p className={`text-xs sm:text-sm ${themes[activeTheme].errorText} font-medium`}>Correct: <span className={`font-bold ${themes[activeTheme].errorText} text-base sm:text-lg`}>{currentQuestion.answer}</span></p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {!explanation && !isExplaining && (
                      <button
                        onClick={generateExplanation}
                        className={`w-full sm:w-auto flex items-center justify-center px-4 py-3 ${themes[activeTheme].card} ${themes[activeTheme].accent} font-medium rounded-xl border ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all shadow-sm active:scale-95 text-sm`}
                      >
                        <ThemeIcon icon="Sparkles" theme={activeTheme} className="w-4 h-4 mr-2" />
                        Explain
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      className={`w-full sm:w-auto flex items-center justify-center px-6 py-3 ${themes[activeTheme].buttonPrimary} font-medium rounded-xl transition-all shadow-sm hover:shadow active:scale-95 text-sm`}
                    >
                      Next
                      <ThemeIcon icon="ChevronRight" theme={activeTheme} className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>

                {(isExplaining || explanation) && (
                  <div className={`p-6 rounded-2xl ${themes[activeTheme].accentBg} border ${themes[activeTheme].border} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className="flex items-center gap-2 mb-3">
                      <ThemeIcon icon="Sparkles" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].accent}`} />
                      <h4 className={`font-semibold ${themes[activeTheme].textPrimary}`}>AI Explanation</h4>
                    </div>
                    {isExplaining ? (
                      <div className={`flex items-center gap-3 ${themes[activeTheme].textSecondary}`}>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <p className="text-sm font-medium">Analyzing question and generating explanation...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className={`${themes[activeTheme].textPrimary} leading-relaxed`}>
                          {explanation}
                        </p>
                        
                        {/* Follow-ups */}
                        {followUps.length > 0 && (
                          <div className={`space-y-3 mt-4 pt-4 border-t ${themes[activeTheme].border}`}>
                            {followUps.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? `${themes[activeTheme].buttonPrimary} rounded-tr-sm` : `${themes[activeTheme].card} ${themes[activeTheme].textPrimary} border ${themes[activeTheme].border} rounded-tl-sm`}`}>
                                  <p className="text-sm leading-relaxed">{msg.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Follow-up input */}
                        <div className={`mt-4 pt-4 border-t ${themes[activeTheme].border} flex gap-2`}>
                          <input
                            type="text"
                            value={followUpInput}
                            onChange={(e) => setFollowUpInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendFollowUp()}
                            placeholder="Ask a follow-up question..."
                            className={`flex-1 ${themes[activeTheme].input} rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            disabled={isSendingFollowUp}
                          />
                          <button
                            onClick={handleSendFollowUp}
                            disabled={isSendingFollowUp || !followUpInput.trim()}
                            className={`${themes[activeTheme].buttonPrimary} px-4 py-2 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50`}
                          >
                            {isSendingFollowUp ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <ThemeIcon icon="Send" theme={activeTheme} className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {screen === 'select_exam' && (
          <div className={`${themes[activeTheme].card} p-4 sm:p-8 md:p-12 rounded-3xl shadow-sm transition-colors duration-200 flex-1 overflow-y-auto min-h-0 w-full custom-scrollbar`}>
            <div className="flex items-center justify-between mb-6 sm:mb-8 shrink-0">
              <h2 className={`text-2xl font-bold ${themes[activeTheme].textPrimary}`}>Select Exam</h2>
            </div>
            
            <div className="mb-6">
              <p className={themes[activeTheme].textSecondary}>
                Found {availableExams.length} exams so far. {isParsingFinished ? 'Finished parsing.' : 'Still parsing...'}
              </p>
            </div>

            {(() => {
              const parsedExams = availableExams.map(exam => {
                if (exam.code.includes('-')) {
                  const parts = exam.code.split('-');
                  if (parts.length >= 4) {
                    const monthStr = parts[2] === '06' ? 'May/June' : parts[2] === '11' ? 'October/November' : parts[2] === '03' ? 'February/March' : parts[2];
                    return {
                      ...exam,
                      syllabus: parts[0],
                      paper: parts[1],
                      session: monthStr,
                      year: parts[3]
                    };
                  }
                }
                const parts = exam.code.split('/');
                if (parts.length >= 5) {
                  return {
                    ...exam,
                    syllabus: parts[0],
                    paper: parts[1],
                    session: `${parts[2]}/${parts[3]}`,
                    year: `20${parts[4]}`
                  };
                }
                return { ...exam, syllabus: 'Unknown', paper: 'Unknown', session: 'Unknown', year: 'Unknown' };
              });

              const availableYears = Array.from(new Set(parsedExams.map(e => e.year))).filter(y => y !== 'Unknown').sort().reverse();
              const availableSessions = selectedYear ? Array.from(new Set(parsedExams.filter(e => e.year === selectedYear).map(e => e.session))).sort() : [];
              const availablePapers = (selectedYear && selectedSession) ? parsedExams.filter(e => e.year === selectedYear && e.session === selectedSession).sort((a, b) => a.paper.localeCompare(b.paper)) : [];

              return (
                <div className="space-y-6">
                  {!selectedYear ? (
                    <div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <h3 className={`text-lg font-semibold ${themes[activeTheme].textPrimary}`}>Select Year</h3>
                        
                        <div className={`flex items-center gap-2 p-1.5 rounded-xl ${themes[activeTheme].card} border ${themes[activeTheme].border}`}>
                          <button
                            onClick={() => setInstantFeedbackMode(false)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${!instantFeedbackMode ? `${themes[activeTheme].accentBg} text-white shadow-sm` : `${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary}`}`}
                          >
                            Standard
                          </button>
                          <button
                            onClick={() => setInstantFeedbackMode(true)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${instantFeedbackMode ? `${themes[activeTheme].accentBg} text-white shadow-sm` : `${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary}`}`}
                          >
                            Instant Feedback
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {availableYears.map(year => (
                          <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`p-4 rounded-xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all text-center font-bold ${themes[activeTheme].textPrimary}`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : !selectedSession ? (
                    <div>
                      <div className="flex items-center mb-4">
                        <button onClick={() => setSelectedYear(null)} className={`mr-3 ${themes[activeTheme].accent} hover:underline text-sm font-medium`}>← Back to Years</button>
                        <h3 className={`text-lg font-semibold ${themes[activeTheme].textPrimary}`}>Select Session ({selectedYear})</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {availableSessions.map(session => (
                          <button
                            key={session}
                            onClick={() => setSelectedSession(session)}
                            className={`p-4 rounded-xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all text-center font-bold ${themes[activeTheme].textPrimary}`}
                          >
                            {session}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center mb-4">
                        <button onClick={() => setSelectedSession(null)} className={`mr-3 ${themes[activeTheme].accent} hover:underline text-sm font-medium`}>← Back to Sessions</button>
                        <h3 className={`text-lg font-semibold ${themes[activeTheme].textPrimary}`}>Select Paper ({selectedSession} {selectedYear})</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {availablePapers.map(exam => (
                          <button
                            key={exam.index}
                            onClick={() => {
                              setSelectedExamCode(exam.code);
                              setScreen('whole_paper_quiz');
                            }}
                            className={`p-6 rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all text-left`}
                          >
                            <div className={`text-lg font-bold ${themes[activeTheme].textPrimary} mb-2`}>Paper {exam.paper}</div>
                            <div className={`text-sm ${themes[activeTheme].textSecondary} font-mono`}>{exam.code}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {parsedExams.some(e => e.year === 'Unknown') && !selectedYear && (
                    <div className="mt-8">
                      <h3 className={`text-lg font-semibold ${themes[activeTheme].textPrimary} mb-4`}>Other Exams</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {parsedExams.filter(e => e.year === 'Unknown').map(exam => (
                          <button
                            key={exam.index}
                            onClick={() => {
                              setSelectedExamCode(exam.code);
                              setScreen('whole_paper_quiz');
                            }}
                            className={`p-6 rounded-2xl border-2 ${themes[activeTheme].border} hover:${themes[activeTheme].accentBg} transition-all text-left`}
                          >
                            <div className={`text-lg font-bold ${themes[activeTheme].textPrimary} mb-2`}>Exam {exam.index}</div>
                            <div className={`text-sm ${themes[activeTheme].textSecondary} font-mono`}>{exam.code || 'Unknown Code'}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {!isParsingFinished && (
              <div className="mt-8 flex justify-center">
                <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${themes[activeTheme].border}`}></div>
              </div>
            )}
          </div>
        )}

        {screen === 'whole_paper_quiz' && pdf && subject && selectedExamCode && (
          <div className="flex-1 overflow-y-auto min-h-0 w-full custom-scrollbar">
            <WholePaperQuiz
              instantFeedback={instantFeedbackMode}
              pdf={pdf}
              questions={questions.filter(q => q.examCode === selectedExamCode)}
              subject={subject}
              examCode={selectedExamCode}
              isParsingFinished={isParsingFinished}
              userProfile={userProfile}
              activeTheme={activeTheme}
              onEnd={(stats) => {
                if (subject) {
                  getCache(subject, level).stopParsing = true;
                }
                setStats(stats);
                setScreen('results');
              }}
              onAnswer={async (totalAnswered, correctAnswers, deltaCorrect, isNewAnswer) => {
                if (userProfile && subject && (deltaCorrect !== 0 || isNewAnswer)) {
                  await updateStats(userProfile.uid, subject, deltaCorrect, isNewAnswer ? 1 : 0);
                  
                  if (!isGlobalPremium(userProfile) && isNewAnswer) {
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
                } else if (isGuest && !userProfile && isNewAnswer) {
                  const newCount = guestQuestionsCount + 1;
                  setGuestQuestionsCount(newCount);
                  try { localStorage.setItem('guestQuestionsCount', newCount.toString()); } catch {}
                  if (newCount >= 10) {
                    window.dispatchEvent(new CustomEvent('openPremiumModal'));
                  }
                }
              }}
            />
          </div>
        )}

        {screen === 'results' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${themes[activeTheme].card} p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-xl text-center max-w-2xl mx-auto transition-colors duration-200 flex-1 min-h-0 w-full flex flex-col overflow-y-auto custom-scrollbar`}
          >
            <div className="mb-6 shrink-0">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex justify-center items-end gap-2 mb-6 h-32"
              >
                <div className={`w-12 bg-slate-400/20 rounded-t-lg h-16 flex items-center justify-center border-t-2 ${themes[activeTheme].border}`}>
                  <span className="text-xl font-bold opacity-30">2</span>
                </div>
                <div className={`w-16 ${themes[activeTheme].accentBg} rounded-t-xl h-24 flex flex-col items-center justify-center shadow-lg relative`}>
                  <div className="absolute -top-6">
                    <ThemeIcon icon="Crown" theme={activeTheme} className="w-10 h-10 text-amber-400 drop-shadow-md animate-bounce" />
                  </div>
                  <span className="text-3xl font-black text-white italic">1</span>
                </div>
                <div className={`w-12 bg-slate-400/20 rounded-t-lg h-12 flex items-center justify-center border-t-2 ${themes[activeTheme].border}`}>
                  <span className="text-xl font-bold opacity-30">3</span>
                </div>
              </motion.div>
              
              <h2 className={`text-2xl sm:text-4xl font-black ${themes[activeTheme].textPrimary} mb-1 uppercase tracking-tight`}>Session Complete!</h2>
              <p className={`${themes[activeTheme].textSecondary} text-sm sm:text-lg font-medium`}>Great progress in {subject} today.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 shrink-0">
              <div className={`${themes[activeTheme].card} p-4 rounded-2xl border-2 ${themes[activeTheme].border}`}>
                <div className={`text-[10px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest mb-1`}>Answered</div>
                <div className={`text-2xl sm:text-3xl font-black ${themes[activeTheme].textPrimary}`}>{stats.total || 0}</div>
              </div>
              <div className={`${themes[activeTheme].successBg} p-4 rounded-2xl border-2 ${themes[activeTheme].border}`}>
                <div className={`text-[10px] font-black ${themes[activeTheme].successText} uppercase tracking-widest mb-1`}>Correct</div>
                <div className={`text-2xl sm:text-3xl font-black ${themes[activeTheme].successText}`}>{stats.correct || 0}</div>
              </div>
            </div>

            <div className={`${themes[activeTheme].accentBg} p-6 rounded-3xl border-2 ${themes[activeTheme].border} mb-8 shadow-inner shrink-0`}>
              <div className={`text-[10px] font-black ${themes[activeTheme].accent} uppercase tracking-widest mb-1`}>Estimated Exam Score</div>
              <div className="flex items-baseline justify-center">
                <span className={`text-5xl font-black ${themes[activeTheme].accent}`}>{estimatedScore}</span>
                <span className={`text-xl font-bold ${themes[activeTheme].accent} ml-1`}>/ 40</span>
              </div>
              <p className={`${themes[activeTheme].accent} mt-3 text-xs sm:text-sm font-bold leading-relaxed`}>
                {estimatedScore >= 35 ? '🏆 Outstanding! You are ready for the exam.' : 
                 estimatedScore >= 28 ? '⭐ Great job! Keep practicing to secure that top grade.' : 
                 estimatedScore >= 20 ? '📈 Good effort. Review your mistakes to improve.' : 
                 '📚 Keep practicing! Consistency is key.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10 shrink-0">
              <button 
                onClick={() => setShowReview(!showReview)}
                className={`flex-1 flex items-center justify-center px-6 py-4 border-2 ${showReview ? themes[activeTheme].accentBg + ' border-transparent text-white' : themes[activeTheme].border + ' ' + themes[activeTheme].textPrimary} font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-sm active:scale-95`}
              >
                {showReview ? 'Hide Review' : 'Review Errors'}
              </button>
              <button 
                onClick={handleRestart}
                className={`flex-1 flex items-center justify-center px-6 py-4 ${themes[activeTheme].buttonPrimary} text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg active:scale-95`}
              >
                <ThemeIcon icon="RotateCcw" theme={activeTheme} className="w-4 h-4 mr-2" /> New Session
              </button>
            </div>

            {showReview && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 text-left pb-10"
              >
                <h3 className={`text-xl font-black uppercase tracking-tight ${themes[activeTheme].textPrimary} border-b pb-4`}>Answer Review</h3>
                {userAnswers.length === 0 ? (
                  <p className={`${themes[activeTheme].textSecondary} italic`}>No answers recorded.</p>
                ) : (
                  <div className="space-y-4">
                    {userAnswers.map((ans, idx) => (
                      <div key={idx} className={`${themes[activeTheme].card} p-5 rounded-3xl border-2 ${ans.isCorrect ? 'border-green-500/10' : 'border-red-500/10'} relative`}>
                        <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ans.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                          {ans.isCorrect ? 'Correct' : 'Error'}
                        </div>
                        <div className="flex flex-col gap-4">
                          <div className="w-full bg-white rounded-2xl p-4 flex items-center justify-center">
                            {ans.questionImage ? (
                              <img src={ans.questionImage} alt="Question" className="max-h-48 object-contain" />
                            ) : (
                              <div className="text-xs text-gray-400 italic">No preview available</div>
                            )}
                          </div>
                          <div className="flex items-center gap-6 px-2">
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} mb-1`}>Your Answer</p>
                              <p className={`text-2xl font-black ${ans.isCorrect ? 'text-green-500' : 'text-red-500'}`}>{ans.selectedAnswer}</p>
                            </div>
                            {!ans.isCorrect && (
                              <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} mb-1`}>Correct</p>
                                <p className="text-2xl font-black text-green-500">{ans.question.answer}</p>
                              </div>
                            )}
                            <div className="ml-auto text-right">
                              <p className={`text-[10px] font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} mb-1`}>Question</p>
                              <p className={`text-sm font-bold ${themes[activeTheme].textPrimary}`}>{ans.question.qNumber}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Bookmark Modal */}
      {showBookmarkModal && subject && currentQuestion && (
        <BookmarkModal 
          subject={subject}
          questionData={currentQuestion}
          onClose={() => setShowBookmarkModal(false)}
          activeTheme={activeTheme}
        />
      )}

      {/* Error Modal */}
      {errorMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${themes[activeTheme].card} rounded-3xl shadow-xl border ${themes[activeTheme].border} w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200`}>
            <div className={`p-6 border-b ${themes[activeTheme].border} flex items-center justify-between`}>
              <h3 className={`text-xl font-bold ${themes[activeTheme].textPrimary} flex items-center gap-2`}>
                <ThemeIcon icon="XCircle" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].errorText}`} /> Error
              </h3>
              <button 
                onClick={() => setErrorMessage(null)}
                className={`${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} p-1 rounded-lg hover:${themes[activeTheme].tabInactive} transition-colors`}
              >
                <ThemeIcon icon="XCircle" theme={activeTheme} className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className={themes[activeTheme].textSecondary}>
                {errorMessage}
              </p>
            </div>
            <div className={`p-6 ${themes[activeTheme].tabInactive} border-t ${themes[activeTheme].border} flex justify-end`}>
              <button
                onClick={() => setErrorMessage(null)}
                className={`px-5 py-2.5 ${themes[activeTheme].buttonPrimary} font-medium rounded-xl transition-colors`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  };

  const isEffectivelyBanned = userProfile?.isBanned && (!userProfile.banUntil || Date.now() <= userProfile.banUntil);

  return (
    <div className={themes[activeTheme].wrapper}>
      <AnimatePresence>
        {showAuthModal && (
          <Auth 
            onLogin={() => setShowAuthModal(false)} 
            onGuest={() => setShowAuthModal(false)} 
            onClose={() => setShowAuthModal(false)} 
            activeTheme={activeTheme} 
          />
        )}
      </AnimatePresence>

      {(user || isGuest) && (!isDowntime || userProfile?.role === 'admin') && !isEffectivelyBanned && (
        <>
          <Navbar 
            userProfile={userProfile}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenFriendHub={() => setIsFriendHubModalOpen(true)}
            onBack={handleBack}
            showBack={screen !== 'dashboard'}
            activeTheme={activeTheme}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            isAdminUnlocked={isAdminUnlocked || userProfile?.role === 'admin'}
            onOpenAdmin={() => setScreen('admin')}
          />
          <AnimatePresence>
            {isProfileModalOpen && (
              <ProfileModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                userProfile={userProfile}
                onLogout={handleLogout}
                isGuest={isGuest && !user}
                profileLoaded={profileLoaded}
                activeTheme={activeTheme}
                setActiveTheme={setActiveTheme}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isFriendHubModalOpen && (
              <FriendHubModal 
                isOpen={isFriendHubModalOpen}
                onClose={() => setIsFriendHubModalOpen(false)}
                currentUser={userProfile}
                onLogout={handleLogout}
                isGuest={isGuest && !user}
                profileLoaded={profileLoaded}
                activeTheme={activeTheme}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showPremiumModal && (
              <PremiumModal 
                user={userProfile}
                onClose={() => setShowPremiumModal(false)}
                activeTheme={activeTheme}
              />
            )}
          </AnimatePresence>
          {userProfile && userProfile.role !== 'admin' && (
            <SupportChat user={userProfile} activeTheme={activeTheme} />
          )}
        </>
      )}

      <div className={`flex-1 overflow-hidden ${(user || isGuest) ? 'pt-16' : ''}`}>
        {renderScreen()}
      </div>
    </div>
  );
}
