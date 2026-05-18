import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Classroom, UserProfile } from '../types';
import { joinClassroom } from '../services/db';
import { ThemeIcon } from './ThemeIcon';
import { motion } from 'motion/react';

import { ThemeName, themes } from '../theme';

interface Props {
  userProfile: UserProfile | null;
  activeTheme: ThemeName;
  onSelectClassroom: (id: string) => void;
  onPlaySolo: () => void;
  onPlayMultiplayer: () => void;
  onViewLeaderboard: () => void;
  onViewClassrooms: () => void;
  isAdminUnlocked?: boolean;
  onOpenAdmin?: () => void;
}

export default function StudentDashboard({ userProfile, activeTheme, onSelectClassroom, onPlaySolo, onPlayMultiplayer, onViewLeaderboard, onViewClassrooms, isAdminUnlocked, onOpenAdmin }: Props) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(collection(db, 'classrooms'), where('studentIds', 'array-contains', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classroom));
      setClassrooms(classes);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching classrooms:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-3 sm:p-6 flex flex-col h-full overflow-hidden"
    >
      {/* Main Action Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8 shrink-0">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPlayMultiplayer} 
          className={`${themes[activeTheme].blockMultiplayer} rounded-[1.5rem] sm:rounded-[2.5rem] p-3 sm:p-8 transition-all flex flex-col items-center justify-center text-center group relative overflow-hidden h-28 sm:h-48`}
        >
          <div className={`absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity ${themes[activeTheme].blockPattern}`}></div>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
          <div className={`relative z-10 ${themes[activeTheme].iconContainer} backdrop-blur-sm p-2 sm:p-5 rounded-xl sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all`}>
            <ThemeIcon icon="Gamepad2" theme={activeTheme} className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
          </div>
          <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-widest mt-1">Multiplayer</span>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPlaySolo} 
          className={`${themes[activeTheme].blockSolo} rounded-[1.5rem] sm:rounded-[2.5rem] p-3 sm:p-8 transition-all flex flex-col items-center justify-center text-center group relative overflow-hidden h-28 sm:h-48`}
        >
          <div className={`absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity ${themes[activeTheme].blockPattern}`}></div>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
          <div className={`relative z-10 ${themes[activeTheme].iconContainer} backdrop-blur-sm p-2 sm:p-5 rounded-xl sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all`}>
            <ThemeIcon icon="Zap" theme={activeTheme} className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
          </div>
          <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-widest mt-1">Play Solo</span>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewClassrooms} 
          className={`${themes[activeTheme].blockClassrooms} rounded-[1.5rem] sm:rounded-[2.5rem] p-3 sm:p-8 transition-all flex flex-col items-center justify-center text-center group relative overflow-hidden h-28 sm:h-48`}
        >
          <div className={`absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity ${themes[activeTheme].blockPattern}`}></div>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
          <div className={`relative z-10 ${themes[activeTheme].iconContainer} backdrop-blur-sm p-2 sm:p-5 rounded-xl sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all`}>
            <ThemeIcon icon="BookOpen" theme={activeTheme} className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
          </div>
          <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-widest mt-1">Classrooms</span>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewLeaderboard} 
          className={`${themes[activeTheme].blockLeaderboard} rounded-[1.5rem] sm:rounded-[2.5rem] p-3 sm:p-8 transition-all flex flex-col items-center justify-center text-center group relative overflow-hidden h-28 sm:h-48`}
        >
          <div className={`absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity ${themes[activeTheme].blockPattern}`}></div>
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
          <div className={`relative z-10 ${themes[activeTheme].iconContainer} backdrop-blur-sm p-2 sm:p-5 rounded-xl sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all`}>
            <ThemeIcon icon="Trophy" theme={activeTheme} className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
          </div>
          <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-widest mt-1">Leaderboard</span>
        </motion.button>
        
        {isAdminUnlocked && (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenAdmin} 
            className={`bg-red-500 rounded-[1.5rem] sm:rounded-[2.5rem] p-3 sm:p-8 transition-all flex flex-col items-center justify-center text-center group relative overflow-hidden h-28 sm:h-48 text-white shadow-lg shadow-red-500/20`}
          >
            <div className={`absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity ${themes[activeTheme].blockPattern}`}></div>
            <div className={`relative z-10 bg-white/20 backdrop-blur-sm p-2 sm:p-5 rounded-xl sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all`}>
              <ThemeIcon icon="ShieldAlert" theme={activeTheme} className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
            </div>
            <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-widest mt-1">Admin Panel</span>
          </motion.button>
        )}
      </div>

      {/* Performance Section */}
      <div className={`${themes[activeTheme].card} rounded-[1.5rem] sm:rounded-[3rem] p-4 sm:p-8 flex-1 flex flex-col min-h-0`}>
        <h2 className={`text-base sm:text-2xl font-black ${themes[activeTheme].textPrimary} mb-3 sm:mb-6 uppercase tracking-tight flex items-center gap-2 sm:gap-3 shrink-0`}>
          <div className={`w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${themes[activeTheme].profileBg} flex items-center justify-center`}>
            <ThemeIcon icon="Zap" theme={activeTheme} className={`w-3 h-3 sm:w-5 sm:h-5 ${themes[activeTheme].accent}`} />
          </div>
          Performance
        </h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6 flex-1 min-h-0">
          <div className={`${themes[activeTheme].card} border-2 ${themes[activeTheme].border} rounded-xl sm:rounded-[2rem] p-2 sm:p-6 flex flex-col items-center justify-center text-center transition-colors group`}>
            <div className={`${themes[activeTheme].profileBg} p-1.5 sm:p-4 rounded-lg sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 transition-transform`}>
              <ThemeIcon icon="CheckCircle2" theme={activeTheme} className={`w-4 h-4 sm:w-8 sm:h-8 ${themes[activeTheme].accent}`} />
            </div>
            <span className={`text-lg sm:text-4xl font-black ${themes[activeTheme].textPrimary} mb-0.5 sm:mb-2 tracking-tight`}>{userProfile?.totalAnswered || 0}</span>
            <span className={`text-[8px] sm:text-xs font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Solved</span>
          </div>

          <div className={`${themes[activeTheme].card} border-2 ${themes[activeTheme].border} rounded-xl sm:rounded-[2rem] p-2 sm:p-6 flex flex-col items-center justify-center text-center transition-colors group`}>
            <div className={`${themes[activeTheme].profileBg} p-1.5 sm:p-4 rounded-lg sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 transition-transform`}>
              <ThemeIcon icon="Zap" theme={activeTheme} className={`w-4 h-4 sm:w-8 sm:h-8 ${themes[activeTheme].accent}`} />
            </div>
            <span className={`text-lg sm:text-4xl font-black ${themes[activeTheme].textPrimary} mb-0.5 sm:mb-2 tracking-tight`}>{userProfile?.accuracy || 0}%</span>
            <span className={`text-[8px] sm:text-xs font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Accuracy</span>
          </div>

          <div className={`${themes[activeTheme].card} border-2 ${themes[activeTheme].border} rounded-xl sm:rounded-[2rem] p-2 sm:p-6 flex flex-col items-center justify-center text-center transition-colors group`}>
            <div className={`${themes[activeTheme].profileBg} p-1.5 sm:p-4 rounded-lg sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 transition-transform`}>
              <ThemeIcon icon="Trophy" theme={activeTheme} className={`w-4 h-4 sm:w-8 sm:h-8 ${themes[activeTheme].accent}`} />
            </div>
            <span className={`text-lg sm:text-4xl font-black ${themes[activeTheme].textPrimary} mb-0.5 sm:mb-2 tracking-tight`}>{userProfile?.won || 0}</span>
            <span className={`text-[8px] sm:text-xs font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Games Won</span>
          </div>

          <div className={`${themes[activeTheme].card} border-2 ${themes[activeTheme].border} rounded-xl sm:rounded-[2rem] p-2 sm:p-6 flex flex-col items-center justify-center text-center transition-colors group`}>
            <div className={`${themes[activeTheme].profileBg} p-1.5 sm:p-4 rounded-lg sm:rounded-2xl mb-1 sm:mb-4 group-hover:scale-110 transition-transform`}>
              <ThemeIcon icon="Medal" theme={activeTheme} className={`w-4 h-4 sm:w-8 sm:h-8 ${themes[activeTheme].accent}`} />
            </div>
            <span className={`text-lg sm:text-4xl font-black ${themes[activeTheme].textPrimary} mb-0.5 sm:mb-2 tracking-tight`}>{userProfile?.podiums || 0}</span>
            <span className={`text-[8px] sm:text-xs font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Podiums</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
