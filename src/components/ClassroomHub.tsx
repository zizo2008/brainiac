import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Classroom } from '../types';
import { joinClassroom } from '../services/db';
import { ThemeIcon } from './ThemeIcon';
import { ThemeName, themes } from '../theme';

interface Props {
  onSelectClassroom: (id: string) => void;
  onBack: () => void;
  activeTheme: ThemeName;
}

export default function ClassroomHub({ onSelectClassroom, onBack, activeTheme }: Props) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'classrooms'), where('studentIds', 'array-contains', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    const classes = snapshot.docs.map(doc => doc.data() as Classroom);
    setClassrooms(classes);
    setLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!joinCode.trim() || !auth.currentUser) return;
    
    setIsJoining(true);
    try {
      const joinedClass = await joinClassroom(auth.currentUser.uid, joinCode.toUpperCase());
      if (joinedClass) {
        if (!classrooms.find(c => c.id === joinedClass.id)) {
          setClassrooms([...classrooms, joinedClass]);
        }
        setJoinCode('');
      }
    } catch (err: any) {
      setError('Invalid class code or class not found.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 h-full flex flex-col">
      <div className={`${themes[activeTheme].card} rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 shadow-sm mb-3 sm:mb-6 shrink-0`}>
        <div className="mb-3 sm:mb-6">
          <h2 className={`text-xl sm:text-3xl font-black uppercase tracking-tight mb-1 ${themes[activeTheme].textPrimary}`}>Classroom Hub</h2>
          <p className={`text-[10px] sm:text-sm font-medium ${themes[activeTheme].textSecondary}`}>Join a new class or manage your current ones</p>
        </div>

        <form onSubmit={handleJoin} className={`flex flex-col sm:flex-row gap-2 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl transition-all ${themes[activeTheme].input}`}>
          <div className="flex-1 flex items-center px-3 sm:px-6 py-2 sm:py-4 bg-transparent">
            <ThemeIcon icon="Search" theme={activeTheme} className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 ${themes[activeTheme].textSecondary}`} />
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ENTER CLASS CODE"
              className={`flex-1 bg-transparent font-bold uppercase tracking-widest outline-none text-xs sm:text-base ${themes[activeTheme].textPrimary}`}
              maxLength={6}
            />
          </div>
          <button 
            type="submit" 
            disabled={isJoining || !joinCode}
            className={`w-full sm:w-auto px-4 sm:px-8 py-2.5 sm:py-4 rounded-lg sm:rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 text-xs sm:text-base ${themes[activeTheme].accentBg} text-white`}
          >
            {isJoining ? '...' : 'Join'}
          </button>
        </form>
        {error && <p className={`mt-3 text-xs font-bold p-2 rounded-xl text-center ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText}`}>{error}</p>}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-2 mb-4 shrink-0">
          <h3 className={`text-lg font-black uppercase tracking-tight ${themes[activeTheme].textPrimary}`}>Your Classrooms</h3>
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${themes[activeTheme].badgeSecondary}`}>
            {classrooms.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pb-4 pr-2 sm:pr-4 -mr-2 sm:-mr-4 custom-scrollbar">
          {loading ? (
            <div className={`text-center py-8 font-bold uppercase tracking-widest animate-pulse text-xs ${themes[activeTheme].textSecondary}`}>Loading...</div>
          ) : classrooms.length === 0 ? (
            <div className={`text-center py-12 ${themes[activeTheme].card} rounded-2xl border-2 border-dashed ${themes[activeTheme].border}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${themes[activeTheme].iconContainer}`}>
                <ThemeIcon icon="Users" theme={activeTheme} className={`w-6 h-6 ${themes[activeTheme].textSecondary}`} />
              </div>
              <p className={`text-xs font-bold uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>No Classrooms</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {classrooms.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => onSelectClassroom(cls.id)}
                  className={`${themes[activeTheme].card} rounded-2xl p-4 transition-all text-left group`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`p-2 rounded-xl transition-colors ${themes[activeTheme].badge}`}>
                      <ThemeIcon icon="Users" theme={activeTheme} className="w-5 h-5" />
                    </div>
                    <ThemeIcon icon="ArrowRight" theme={activeTheme} className={`w-4 h-4 ${themes[activeTheme].textSecondary}`} />
                  </div>
                  <h4 className={`text-base font-black uppercase tracking-tight mb-0.5 ${themes[activeTheme].textPrimary}`}>{cls.name}</h4>
                  <p className={`text-xs font-medium ${themes[activeTheme].textSecondary}`}>{cls.studentIds.length} Classmates</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
