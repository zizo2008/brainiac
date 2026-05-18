import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Classroom } from '../types';
import { createClassroom } from '../services/db';
import { ThemeIcon } from './ThemeIcon';
import { motion } from 'motion/react';

import { ThemeName, themes } from '../theme';

interface Props {
  activeTheme: ThemeName;
  onSelectClassroom: (id: string) => void;
}

export default function TeacherDashboard({ activeTheme, onSelectClassroom }: Props) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('chemistry');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(collection(db, 'classrooms'), where('teacherId', '==', auth.currentUser.uid));
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !auth.currentUser) return;
    
    const newClass = await createClassroom(auth.currentUser.uid, newClassName, newClassSubject);
    if (newClass) {
      setNewClassName('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 h-full flex flex-col">
      <div className={`${themes[activeTheme].card} rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 shadow-sm mb-4 sm:mb-8 shrink-0`}>
        <h2 className={`text-lg sm:text-3xl font-black uppercase tracking-tight mb-1 sm:mb-2 ${themes[activeTheme].textPrimary}`}>Create Classroom</h2>
        <p className={`text-[10px] sm:text-sm font-medium mb-4 sm:mb-6 ${themes[activeTheme].textSecondary}`}>Set up a new space for your students</p>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(['chemistry', 'physics', 'biology', 'economics', 'accounting'] as const).map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => setNewClassSubject(subject)}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-sm sm:text-base capitalize transition-all ${
                  newClassSubject === subject
                    ? themes[activeTheme].tabActive
                    : themes[activeTheme].tabInactive
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
          <form onSubmit={handleCreate} className={`flex flex-col sm:flex-row gap-2 p-2 rounded-2xl transition-all ${themes[activeTheme].input}`}>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. OL Chemistry"
              className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-transparent focus:outline-none font-bold placeholder:opacity-50 text-sm sm:text-base ${themes[activeTheme].textPrimary}`}
            />
            <button type="submit" disabled={!newClassName.trim()} className={`${themes[activeTheme].accentBg} disabled:opacity-50 disabled:cursor-not-allowed px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center active:scale-95 text-sm sm:text-base`}>
              <ThemeIcon icon="Plus" theme={activeTheme} className="w-5 h-5 mr-2" /> Create
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 sm:mb-6 px-2 sm:px-4 shrink-0">
        <h2 className={`text-lg sm:text-2xl font-black uppercase tracking-tight ${themes[activeTheme].textPrimary}`}>Your Classrooms</h2>
        <div className={`px-3 sm:px-4 py-1 rounded-full ${themes[activeTheme].badgeSecondary}`}>
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{classrooms.length} Active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 sm:pr-4 -mr-2 sm:-mr-4 custom-scrollbar">
        {loading ? (
          <div className={`text-center py-12 font-bold uppercase tracking-widest animate-pulse text-sm ${themes[activeTheme].textSecondary}`}>Loading Classrooms...</div>
        ) : classrooms.length === 0 ? (
          <div className={`text-center py-12 sm:py-16 rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed ${themes[activeTheme].border} ${themes[activeTheme].card}`}>
            <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${themes[activeTheme].iconContainer}`}>
              <ThemeIcon icon="Users" theme={activeTheme} className={`w-6 h-6 sm:w-8 sm:h-8 ${themes[activeTheme].textSecondary}`} />
            </div>
            <p className={`font-bold uppercase tracking-widest text-xs sm:text-sm ${themes[activeTheme].textSecondary}`}>No Classrooms Yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {classrooms.map((cls, i) => (
              <motion.div 
                key={cls.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`${themes[activeTheme].card} rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm transition-all cursor-pointer group hover:shadow-xl hover:-translate-y-1`} 
                onClick={() => onSelectClassroom(cls.id)}
              >
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div>
                    <h3 className={`text-lg sm:text-2xl font-black uppercase tracking-tight transition-colors ${themes[activeTheme].textPrimary}`}>{cls.name}</h3>
                    <p className={`text-xs sm:text-sm font-bold uppercase tracking-widest mt-1 ${themes[activeTheme].textSecondary}`}>{cls.subject}</p>
                  </div>
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-mono font-black ${themes[activeTheme].badge}`}>
                    {cls.code}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border ${themes[activeTheme].badgeSecondary}`}>
                    <ThemeIcon icon="Users" theme={activeTheme} className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 ${themes[activeTheme].accent}`} />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{cls.studentIds.length} Students</span>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all ${themes[activeTheme].iconButton}`}>
                    <ThemeIcon icon="ArrowRight" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
