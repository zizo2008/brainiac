import React, { useState } from 'react';
import { ThemeIcon } from './ThemeIcon';
import { UserProfile, UserSubjectChoice, SubjectType, Level } from '../types';
import { updateUserProfile } from '../services/db';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeName, themes } from '../theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  activeTheme: ThemeName;
}

export default function SubjectOnboardingModal({ isOpen, onClose, userProfile, activeTheme }: Props) {
  const [prioritizedSubjects, setPrioritizedSubjects] = useState<UserSubjectChoice[]>(userProfile?.prioritizedSubjects || []);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleSubject = (subject: SubjectType) => {
    setPrioritizedSubjects(prev => {
      const exists = prev.find(p => p.subject === subject);
      if (exists) {
        return prev.filter(p => p.subject !== subject);
      } else {
        return [...prev, { subject, levels: ['extended'] }];
      }
    });
  };

  const handleToggleSubjectLevel = (subject: SubjectType, level: Level) => {
    setPrioritizedSubjects(prev => 
      prev.map(p => {
        if (p.subject === subject) {
          const levels = p.levels || [];
          if (levels.includes(level)) {
            const newLevels = levels.filter(l => l !== level);
            if (newLevels.length === 0) return p; // Prevent removing the last selected level
            return { ...p, levels: newLevels };
          } else {
            return { ...p, levels: [...levels, level] };
          }
        }
        return p;
      })
    );
  };

  const handleSave = async () => {
    if (prioritizedSubjects.length === 0) {
      // Allow them to save empty if they really want, or force them?
      // Let's allow empty, just close.
    }
    setIsSaving(true);
    try {
      await updateUserProfile(userProfile.uid, { prioritizedSubjects });
      onClose();
    } catch (err: any) {
      console.error('Failed to save subjects', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`${themes[activeTheme].card} rounded-[2.5rem] p-6 sm:p-8 flex flex-col items-center text-center space-y-6 shadow-2xl w-full max-w-md relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 p-6 z-10">
          <button 
            onClick={onClose}
            className={`${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors p-2 rounded-full hover:${themes[activeTheme].tabInactive}`}
          >
            <ThemeIcon icon="XCircle" theme={activeTheme} className="w-6 h-6" />
          </button>
        </div>

        <div className={`w-16 h-16 rounded-full ${themes[activeTheme].accentBg} flex items-center justify-center shadow-lg relative z-10 shrink-0`}>
          <ThemeIcon icon="GraduationCap" theme={activeTheme} className={`w-8 h-8 text-white`} />
        </div>

        <div className="space-y-2 relative z-10 w-full text-center">
          <h2 className={`text-xl sm:text-2xl font-black ${themes[activeTheme].textPrimary} uppercase tracking-tighter`}>
            Welcome to Brainiac
          </h2>
          <p className={`text-[10px] sm:text-xs font-bold ${themes[activeTheme].textSecondary} uppercase tracking-widest max-w-[280px] mx-auto`}>
            What subjects are you taking? Select them below so we can optimize your experience!
          </p>
        </div>

        <div className="w-full space-y-2 text-left">
          {(['chemistry', 'physics', 'biology', 'economics', 'accounting'] as SubjectType[]).map((subj) => {
            const isSelected = prioritizedSubjects.some(p => p.subject === subj);
            const selectedLevels = prioritizedSubjects.find(p => p.subject === subj)?.levels || [];
            
            const availableLevels: { val: Level, label: string }[] = [];
            if (subj !== 'accounting' && subj !== 'economics') {
              availableLevels.push({ val: 'core', label: 'Core' });
              availableLevels.push({ val: 'extended', label: 'Ext' });
            } else {
              availableLevels.push({ val: 'extended', label: 'OL' });
            }
            availableLevels.push({ val: 'a_level', label: 'AL' });
            
            return (
              <div key={subj} className={`flex items-center justify-between p-2 sm:p-3 rounded-xl border-2 transition-all ${isSelected ? `${themes[activeTheme].accentBg} border-transparent` : `${themes[activeTheme].button} border-transparent`}`}>
                <button 
                  onClick={() => handleToggleSubject(subj)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center border-2 ${isSelected ? 'bg-white border-white' : `border-current opacity-50`}`}>
                    {isSelected && <ThemeIcon icon="CheckCircle2" theme={activeTheme} className={`w-3 h-3 sm:w-4 sm:h-4 text-indigo-500`} />}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isSelected ? 'text-white' : ''}`}>
                    {subj}
                  </span>
                </button>
                
                {isSelected && (
                  <div className="flex gap-1 sm:gap-2">
                    {availableLevels.map(lvl => {
                      const isLvlSelected = selectedLevels.includes(lvl.val);
                      return (
                        <button 
                          key={lvl.val}
                          onClick={() => handleToggleSubjectLevel(subj, lvl.val)}
                          className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors border border-transparent ${isLvlSelected ? 'bg-white text-indigo-900 shadow-sm' : 'bg-black/20 text-white hover:bg-black/30'}`}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm sm:text-base transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center gap-2 ${themes[activeTheme].buttonPrimary}`}
        >
          {isSaving ? (
            <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>Save Preferences <ThemeIcon icon="ArrowRight" theme={activeTheme} className="w-5 h-5" /></>
          )}
        </button>

      </motion.div>
    </div>
  );
}
