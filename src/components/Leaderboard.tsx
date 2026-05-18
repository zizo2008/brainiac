import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { ThemeIcon } from './ThemeIcon';
import { motion } from 'motion/react';
import { isGlobalPremium } from '../utils/premium';
import { ThemeName, themes } from '../theme';
import ProfileModal from './ProfileModal';

interface Props {
  onBack: () => void;
  subject?: string;
  studentIds?: string[];
  activeTheme: ThemeName;
  currentUserProfile?: UserProfile | null;
}

export default function Leaderboard({ onBack, subject, studentIds, activeTheme, currentUserProfile }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [category, setCategory] = useState<'total' | 'chemistry' | 'physics' | 'biology' | 'economics' | 'accounting'>(subject as any || 'total');
  const [timeFrame, setTimeFrame] = useState<'all_time' | 'daily' | 'monthly'>('all_time');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (subject) {
      setCategory(subject as any);
    }
  }, [subject]);

  useEffect(() => {
    fetchLeaderboard();
  }, [category, timeFrame, studentIds]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    
    if (studentIds) {
      if (studentIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }
      
      try {
        const fetchedUsers: UserProfile[] = [];
        for (let i = 0; i < studentIds.length; i += 30) {
          const chunk = studentIds.slice(i, i + 30);
          const q = query(collection(db, 'users'), where('uid', 'in', chunk));
          const snapshot = await getDocs(q);
          fetchedUsers.push(...snapshot.docs.map(doc => doc.data() as UserProfile));
        }
        
        fetchedUsers.sort((a, b) => {
          if (category === 'total') {
            return (b.totalCorrect || 0) - (a.totalCorrect || 0);
          } else {
            return (b.subjectCorrect?.[category] || 0) - (a.subjectCorrect?.[category] || 0);
          }
        });
        
        const filteredUsers = fetchedUsers.filter(u => u.role !== 'teacher');
        setUsers(filteredUsers);
      } catch (error) {
        console.error("Error fetching class leaderboard:", error);
        setUsers([]);
      }
      setLoading(false);
      return;
    }

    let q;
    if (timeFrame === 'all_time') {
      if (category === 'total') {
        q = query(collection(db, 'users'), orderBy('totalCorrect', 'desc'), limit(200));
      } else {
        q = query(collection(db, 'users'), orderBy(`subjectCorrect.${category}`, 'desc'), limit(200));
      }
      
      try {
        const snapshot = await getDocs(q);
        const allUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
        const filteredUsers = allUsers.filter(u => u.role !== 'teacher');
        const topUsers = filteredUsers.slice(0, 50);
        setUsers(topUsers);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setUsers([]);
      }
    } else {
      // Logic for time-based leaderboards
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      
      const getWeek = (d: Date) => {
        const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
        return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
      };
      
      let timeStr = '';
      if (timeFrame === 'daily') timeStr = `${yyyy}-${mm}-${dd}`;
      else if (timeFrame === 'monthly') timeStr = `${yyyy}-${mm}`;

      const collectionPath = `leaderboards/${timeFrame}_${timeStr}/entries`;
      
      if (category === 'total') {
        q = query(collection(db, collectionPath), orderBy('totalCorrect', 'desc'), limit(50));
      } else {
        q = query(collection(db, collectionPath), orderBy(`subjectCorrect.${category}`, 'desc'), limit(50));
      }

      try {
        const snapshot = await getDocs(q);
        const rawUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
        const topUsers = rawUsers.filter(u => u.role !== 'teacher');
        
        if (topUsers.length > 0) {
          const uids = topUsers.map(u => u.uid);
          const latestUsers: UserProfile[] = [];
          for (let i = 0; i < uids.length; i += 30) {
            const chunk = uids.slice(i, i + 30);
            const usersQ = query(collection(db, 'users'), where('uid', 'in', chunk));
            const usersSnap = await getDocs(usersQ);
            latestUsers.push(...usersSnap.docs.map(doc => doc.data() as UserProfile));
          }
          
          const latestUsersMap = new Map(latestUsers.map(u => [u.uid, u]));
          
          const updatedTopUsers = topUsers.map(u => {
            const latest = latestUsersMap.get(u.uid);
            if (latest) {
              return { ...u, username: latest.username, photoURL: latest.photoURL };
            }
            return u;
          });
          setUsers(updatedTopUsers);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error("Error fetching time-based leaderboard:", error);
        setUsers([]);
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 h-full flex flex-col">
      <div className="flex items-center mb-4 sm:mb-8 shrink-0">
        <button onClick={onBack} className={`mr-4 p-2 rounded-full transition-colors ${themes[activeTheme].iconButton}`}>
          <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-6 h-6" />
        </button>
        <div className="flex items-center">
          <ThemeIcon icon="Trophy" theme={activeTheme} className={`w-6 h-6 sm:w-8 sm:h-8 mr-3 ${themes[activeTheme].accent}`} />
          <h1 className={`text-2xl sm:text-3xl font-bold ${themes[activeTheme].textPrimary}`}>Leaderboard</h1>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:gap-4 mb-4 sm:mb-8 shrink-0">
        {!subject && (
          <div className="w-full">
            <div className={`flex items-center justify-center gap-1 sm:gap-2 ${themes[activeTheme].card} rounded-2xl sm:rounded-full p-1 sm:p-2`}>
              {(['total', 'chemistry', 'physics', 'biology', 'economics', 'accounting'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-1 px-1 sm:px-6 py-1.5 sm:py-2 rounded-xl sm:rounded-full text-[10px] sm:text-base font-medium capitalize text-center transition-colors ${category === cat ? themes[activeTheme].tabActive : themes[activeTheme].tabInactive}`}
                >
                  {cat === 'total' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {!studentIds && (
          <div className="w-full">
            <div className={`flex flex-wrap items-center justify-center gap-1 sm:gap-2 ${themes[activeTheme].card} rounded-2xl sm:rounded-full p-1 sm:p-2`}>
              {(['all_time', 'daily', 'monthly'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`flex-1 min-w-[80px] px-2 sm:px-6 py-1.5 sm:py-2 rounded-xl sm:rounded-full text-xs sm:text-base font-medium capitalize text-center transition-colors ${timeFrame === tf ? themes[activeTheme].tabActive : themes[activeTheme].tabInactive}`}
                >
                  {tf.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`${themes[activeTheme].card} rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0`}>
        {loading ? (
          <div className={`p-12 text-center flex-1 flex items-center justify-center ${themes[activeTheme].textSecondary}`}>Loading rankings...</div>
        ) : (
          <div className={`divide-y overflow-y-auto flex-1 custom-scrollbar ${themes[activeTheme].border.replace('border-', 'divide-')}`}>
            {users.map((user, index) => (
              <motion.div 
                key={user.uid} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedUser(user)}
                className={`flex items-center p-4 sm:p-6 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer`}
              >
                <div className={`w-12 sm:w-16 flex justify-center items-center font-bold text-lg sm:text-xl shrink-0 ${themes[activeTheme].textSecondary}`}>
                  {index === 0 ? <ThemeIcon icon="Medal" theme={activeTheme} className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" /> : 
                   index === 1 ? <ThemeIcon icon="Medal" theme={activeTheme} className={`w-8 h-8 sm:w-10 sm:h-10 ${themes[activeTheme].textSecondary}`} /> : 
                   index === 2 ? <ThemeIcon icon="Medal" theme={activeTheme} className="w-8 h-8 sm:w-10 sm:h-10 text-amber-700" /> : 
                   `#${index + 1}`}
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.username} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mx-3 sm:mx-4 object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-xl mx-3 sm:mx-4 shrink-0 ${themes[activeTheme].badge}`}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-lg sm:text-xl flex items-center gap-1.5 truncate ${themes[activeTheme].textPrimary}`}>
                    <span className="truncate">{user.username}</span>
                    {isGlobalPremium(user) && (
                      <ThemeIcon icon="BadgeCheck" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-blue-500 shrink-0" />
                    )}
                  </div>
                  <div className={`text-sm sm:text-base capitalize truncate ${themes[activeTheme].textSecondary}`}>{user.role}</div>
                </div>
                <div className="text-right pl-3 sm:pl-4 shrink-0 w-20 sm:w-24 flex flex-col items-end justify-center">
                  <div className={`text-2xl sm:text-3xl font-black ${themes[activeTheme].accent}`}>
                    {category === 'total' ? (user.totalCorrect || 0) : (user.subjectCorrect?.[category] || 0)}
                  </div>
                  <div className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider ${themes[activeTheme].textSecondary}`}>Correct</div>
                </div>
              </motion.div>
            ))}
            {users.length === 0 && (
              <div className={`p-12 text-center ${themes[activeTheme].textSecondary}`}>
                <ThemeIcon icon="Trophy" theme={activeTheme} className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No rankings yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
      {selectedUser && (
        <ProfileModal
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          userProfile={selectedUser}
          currentUserProfile={currentUserProfile}
          activeTheme={activeTheme}
        />
      )}
    </div>
  );
}
