import React, { useState } from 'react';
import { ThemeIcon } from './ThemeIcon';
import { UserProfile, Game } from '../types';
import { updateUserProfile } from '../services/db';
import { auth, db } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { isGlobalPremium } from '../utils/premium';
import { ThemeName, themes } from '../theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  currentUserProfile?: UserProfile | null;
  onLogout?: () => void;
  isGuest?: boolean;
  profileLoaded?: boolean;
  activeTheme: ThemeName;
  setActiveTheme?: (theme: ThemeName) => void;
}

const DEFAULT_AVATARS = [
  'https://picsum.photos/seed/brain1/200',
  'https://picsum.photos/seed/brain2/200',
  'https://picsum.photos/seed/brain3/200',
  'https://picsum.photos/seed/brain4/200',
  'https://picsum.photos/seed/brain5/200',
  'https://picsum.photos/seed/brain6/200',
];

export default function ProfileModal({ isOpen, onClose, userProfile, currentUserProfile, onLogout, isGuest, profileLoaded, activeTheme, setActiveTheme }: Props) {
  const [username, setUsername] = useState(userProfile?.username || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<'profile' | 'settings'>('profile');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  const isOwnProfile = !currentUserProfile || currentUserProfile.uid === userProfile?.uid;

  const handleSendFriendRequest = async () => {
    if (!currentUserProfile || !userProfile) return;
    try {
      const { sendFriendRequestByCode } = await import('../services/db');
      await sendFriendRequestByCode(currentUserProfile.uid, userProfile.friendCode);
      setFriendRequestSent(true);
      setSuccess('Friend request sent!');
    } catch (e: any) {
      setError(e.message || 'Failed to send request');
    }
  };

  React.useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'games'),
      where('status', '==', 'finished'),
      where('playerIds', 'array-contains', userProfile.uid),
      orderBy('startTime', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setRecentGames(games);
      setLoadingGames(false);
    });

    return () => {
      unsubscribe();
    };
  }, [userProfile?.uid]);

  const [theme, setTheme] = useState<ThemeName>(activeTheme);

  React.useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username);
      setPhotoURL(userProfile.photoURL || '');
      setTheme(activeTheme);
    }
  }, [userProfile, activeTheme]);

  if (isGuest || (profileLoaded && !userProfile)) {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`${themes[activeTheme].card} rounded-[2.5rem] p-8 flex flex-col items-center text-center space-y-6 shadow-2xl max-w-sm relative`}
        >
          <button onClick={onClose} className={`absolute top-6 right-6 p-2 rounded-xl transition-colors ${themes[activeTheme].navIcon}`}>
            <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5" />
          </button>
          
          <div className={`${themes[activeTheme].profileBg} p-6 rounded-[2rem]`}>
            <ThemeIcon icon="UserCircle" theme={activeTheme} className={`w-16 h-16 ${themes[activeTheme].profileIcon}`} />
          </div>
          
          <div>
            <h3 className={`text-2xl font-black ${themes[activeTheme].textPrimary} uppercase tracking-tight`}>
              {isGuest ? 'Guest Account' : 'Profile Missing'}
            </h3>
            <p className={`${themes[activeTheme].textSecondary} mt-2 font-medium`}>
              {isGuest 
                ? 'Sign in to track your progress, save your scores, and compete with friends!'
                : 'We couldn\'t find your profile. Please try signing out and back in.'}
            </p>
          </div>
          
          <div className="w-full space-y-3">
            <button 
              onClick={() => {
                if (isGuest) {
                  window.dispatchEvent(new CustomEvent('openAuthModal'));
                } else {
                  onLogout();
                }
                onClose();
              }} 
              className={`w-full ${themes[activeTheme].accentBg} py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg`}
            >
              {isGuest ? 'Sign In / Sign Up' : 'Sign Out'}
            </button>
            <button 
              onClick={onClose} 
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-all text-xs`}
            >
              Continue as Guest
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm`}>
        <div className={`${themes[activeTheme].card} rounded-3xl p-12 flex flex-col items-center justify-center space-y-4 shadow-2xl`}>
          <div className={`w-12 h-12 border-4 ${themes[activeTheme].border} border-t-transparent rounded-full animate-spin`} />
          <p className={`${themes[activeTheme].textSecondary} font-bold uppercase tracking-widest text-xs`}>Loading profile...</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!userProfile || !username.trim()) {
      setError('Username cannot be empty');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      const updates = { username, photoURL, theme };
      await updateUserProfile(userProfile.uid, updates);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setSuccess('Password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please logout and login again to change password.');
      } else {
        setError('Failed to update password.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const copyCode = async () => {
    if (!userProfile) return;
    let code = userProfile.friendCode;
    if (!code) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        await updateUserProfile(userProfile.uid, { friendCode: code });
        userProfile.friendCode = code;
      } catch (e) {
        console.error("Failed to generate friend code", e);
        return;
      }
    }
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setPhotoURL(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const level = Math.floor((userProfile.xp || 0) / 1000) + 1;
  const xpInLevel = (userProfile.xp || 0) % 1000;
  const progress = (xpInLevel / 1000) * 100;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm overflow-hidden`}>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`${themes[activeTheme].card} rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative z-10`}
      >
        <div className={`p-6 sm:p-8 border-b ${themes[activeTheme].border} flex items-center justify-between shrink-0 ${themes[activeTheme].navLogoBg}`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/20 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
              {view === 'profile' ? <ThemeIcon icon="UserCircle" theme={activeTheme} className={`w-5 h-5 sm:w-7 sm:h-7 ${themes[activeTheme].navLogoIcon}`} /> : <ThemeIcon icon="Settings" theme={activeTheme} className={`w-5 h-5 sm:w-7 sm:h-7 ${themes[activeTheme].navLogoIcon}`} />}
            </div>
            <div>
              <h2 className={`text-xl sm:text-2xl font-black ${themes[activeTheme].navLogoIcon} tracking-tight uppercase`}>
                {view === 'profile' ? 'Profile' : 'Settings'}
              </h2>
              <p className={`text-white/80 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]`}>
                {view === 'profile' ? 'Your Progress' : 'Account Management'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwnProfile && view === 'profile' && (
              <button 
                onClick={() => setView('settings')}
                className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-colors ${themes[activeTheme].navLogoIcon}`}
              >
                <ThemeIcon icon="Settings" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            {isOwnProfile && view === 'settings' && (
              <button 
                onClick={() => setView('profile')}
                className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-colors ${themes[activeTheme].navLogoIcon}`}
              >
                <ThemeIcon icon="UserCircle" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            <button 
              onClick={onClose} 
              className={`p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-colors ${themes[activeTheme].navLogoIcon}`}
            >
              <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {view === 'profile' ? (
            <div className="space-y-4 sm:space-y-8">
              {/* Profile Header Card */}
              <div className={`${themes[activeTheme].profileBg} rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 border ${themes[activeTheme].border} relative overflow-hidden group`}>
                <div className={`absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 ${themes[activeTheme].accentBg} opacity-5 rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16 blur-2xl sm:blur-3xl group-hover:opacity-10 transition-opacity`}></div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 relative z-10">
                  <div className="relative group/avatar">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt={username}
                        className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl object-cover border-2 sm:border-4 ${themes[activeTheme].border} shadow-xl`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl ${themes[activeTheme].profileBg} flex items-center justify-center ${themes[activeTheme].profileIcon} font-black text-3xl sm:text-5xl border-2 sm:border-4 ${themes[activeTheme].border} shadow-xl`}>
                        {username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isOwnProfile && (
                      <button onClick={handleAvatarChange} className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                        <ThemeIcon icon="Camera" theme={activeTheme} className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-2 mb-2">
                      <h3 className={`text-xl sm:text-3xl font-black ${themes[activeTheme].textPrimary} tracking-tight flex items-center justify-center sm:justify-start gap-2`}>
                        {username}
                        {isGlobalPremium(userProfile) && (
                          <ThemeIcon icon="BadgeCheck" theme={activeTheme} className={`w-5 h-5 sm:w-6 sm:h-6 ${themes[activeTheme].accent} shrink-0`} />
                        )}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 sm:px-3 py-0.5 sm:py-1 ${themes[activeTheme].profileBg} ${themes[activeTheme].profileIcon} rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest`}>
                          {userProfile.role}
                        </span>
                        {isGlobalPremium(userProfile) && (
                          <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-black flex items-center shadow-sm">
                            <ThemeIcon icon="Crown" theme={activeTheme} className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> Premium
                          </span>
                        )}
                        {!isOwnProfile && currentUserProfile && !currentUserProfile.friends?.includes(userProfile.uid) && (
                          <button
                            onClick={handleSendFriendRequest}
                            disabled={friendRequestSent}
                            className={`ml-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${friendRequestSent ? themes[activeTheme].successBg + ' ' + themes[activeTheme].successText : themes[activeTheme].accentBg + ' text-white hover:opacity-90'}`}
                          >
                            {friendRequestSent ? 'Request Sent' : 'Add Friend'}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {!isGlobalPremium(userProfile) && userProfile.role !== 'teacher' && (
                      <button 
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('openPremiumModal'));
                        }}
                        className="mt-2 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center w-fit mx-auto sm:mx-0"
                      >
                        <ThemeIcon icon="Crown" theme={activeTheme} className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1.5" /> Upgrade to Premium
                      </button>
                    )}
                  </div>
                </div>

                {/* Friend Code */}
                {userProfile.role !== 'teacher' && (
                  <div className={`mt-4 sm:mt-8 pt-4 sm:pt-6 border-t ${themes[activeTheme].border} flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4`}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`p-1.5 sm:p-2 ${themes[activeTheme].profileBg} rounded-lg`}>
                        <ThemeIcon icon="Copy" theme={activeTheme} className={`w-3 h-3 sm:w-4 sm:h-4 ${themes[activeTheme].profileIcon}`} />
                      </div>
                      <div>
                        <p className={`text-[8px] sm:text-[9px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest`}>Friend Code</p>
                        <p className={`text-base sm:text-lg font-mono font-black ${themes[activeTheme].textPrimary} tracking-[0.2em] uppercase`}>{userProfile.friendCode || '------'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={copyCode}
                      className={`w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 ${themes[activeTheme].button} rounded-xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] transition-all flex items-center justify-center gap-2 shadow-sm`}
                    >
                      {copied ? <ThemeIcon icon="CheckCircle2" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" /> : <ThemeIcon icon="Copy" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4" />}
                      {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              {userProfile.role !== 'teacher' && (
                <div className={`${themes[activeTheme].profileBg} rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 border ${themes[activeTheme].border}`}>
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h4 className={`text-[10px] sm:text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-[0.2em] flex items-center gap-2`}>
                      <ThemeIcon icon="History" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4" />
                      Recent Activity
                    </h4>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {loadingGames ? (
                      <div className="flex justify-center py-4 sm:py-8">
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 border-2 ${themes[activeTheme].border} border-t-transparent rounded-full animate-spin`} />
                      </div>
                    ) : recentGames.length > 0 ? (
                      recentGames.map((game) => {
                        const player = game.players?.[userProfile.uid];
                        const score = player?.score || 0;
                        
                        // Find top opponent
                        const opponents = Object.values(game.players || {}).filter((p: any) => p.uid !== userProfile.uid);
                        const topOpponent = opponents.sort((a: any, b: any) => b.score - a.score)[0] as any;
                        const opponentScore = topOpponent?.score || 0;
                        
                        const isWinner = score > opponentScore;
                        const isTie = score === opponentScore && game.status === 'finished';
                        
                        return (
                          <div key={game.id} className={`${themes[activeTheme].card} p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between group transition-all`}>
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center ${
                                isWinner ? `${themes[activeTheme].successBg} ${themes[activeTheme].successText}` : isTie ? `${themes[activeTheme].badgeSecondary}` : `${themes[activeTheme].errorBg} ${themes[activeTheme].errorText}`
                              }`}>
                                {isWinner ? <ThemeIcon icon="Trophy" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" /> : isTie ? <ThemeIcon icon="Minus" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" /> : <ThemeIcon icon="X" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />}
                              </div>
                              <div>
                                <p className={`text-sm font-black ${themes[activeTheme].textPrimary} uppercase tracking-tight`}>
                                  {game.subject} Duel
                                </p>
                                <p className={`text-[10px] font-bold ${themes[activeTheme].textSecondary} uppercase`}>
                                  {new Date(game.startTime || 0).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-black ${themes[activeTheme].textPrimary}`}>
                                {score} - {opponentScore}
                              </div>
                              <div className={`text-[9px] font-black uppercase tracking-widest ${
                                isWinner ? 'text-emerald-500' : isTie ? themes[activeTheme].textSecondary : 'text-rose-500'
                              }`}>
                                {isWinner ? 'Victory' : isTie ? 'Tie' : 'Defeat'}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <p className={`text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest`}>No recent games</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit Section */}
              {isOwnProfile && (
                <div className={`${themes[activeTheme].profileBg} rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 border ${themes[activeTheme].border}`}>
                  <h4 className={`text-[10px] sm:text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center gap-2`}>
                    <div className={`w-6 sm:w-8 h-[1px] ${themes[activeTheme].border}`}></div>
                    Edit Profile
                  </h4>
                  
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <label className={`block text-[8px] sm:text-[10px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest mb-1.5 sm:mb-2`}>Display Name</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl border ${themes[activeTheme].border} ${themes[activeTheme].card} ${themes[activeTheme].textPrimary} focus:ring-2 focus:ring-indigo-500 outline-none font-bold transition-all text-sm sm:text-base`}
                        placeholder="Enter username"
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-[8px] sm:text-[10px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest mb-1.5 sm:mb-2`}>App Theme</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        {(isGlobalPremium(userProfile) ? ['default', 'dark', 'pink', 'space'] : ['default', 'dark']).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              if (!setActiveTheme) return;
                              setTheme(t as ThemeName);
                              setActiveTheme(t as ThemeName);
                              document.documentElement.setAttribute('data-theme', t);
                              if (t === 'dark' || t === 'space') {
                                document.documentElement.classList.add('dark');
                              } else {
                                document.documentElement.classList.remove('dark');
                              }
                            }}
                            className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                              theme === t 
                                ? `${themes[activeTheme].accentBg} border-transparent` 
                                : `${themes[activeTheme].button}`
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-8">
              {/* Email Display */}
              <div className={`${themes[activeTheme].profileBg} p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${themes[activeTheme].border}`}>
                <div className="flex items-center gap-2 sm:gap-3 mb-1">
                  <ThemeIcon icon="Mail" theme={activeTheme} className={`w-3 h-3 sm:w-4 sm:h-4 ${themes[activeTheme].textSecondary}`} />
                  <span className={`text-[10px] sm:text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest`}>Email Address</span>
                </div>
                <div className={`${themes[activeTheme].textPrimary} font-bold pl-5 sm:pl-7 text-sm sm:text-base`}>{auth.currentUser?.email}</div>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <ThemeIcon icon="Lock" theme={activeTheme} className={`w-3 h-3 sm:w-4 sm:h-4 ${themes[activeTheme].accent}`} />
                  <h3 className={`text-xs sm:text-sm font-black ${themes[activeTheme].textPrimary} uppercase tracking-tight`}>Change Password</h3>
                </div>
                
                <div>
                  <label className={`block text-[10px] sm:text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest mb-1.5 sm:mb-2`}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border ${themes[activeTheme].border} ${themes[activeTheme].card} ${themes[activeTheme].textPrimary} focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm sm:text-base`}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className={`block text-[10px] sm:text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest mb-1.5 sm:mb-2`}>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border ${themes[activeTheme].border} ${themes[activeTheme].card} ${themes[activeTheme].textPrimary} focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm sm:text-base`}
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword}
                  className={`w-full ${themes[activeTheme].accentBg} py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 text-xs sm:text-sm`}
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {error && <div className={`${themes[activeTheme].errorText} text-xs font-bold text-center mt-6 ${themes[activeTheme].errorBg} p-3 rounded-xl`}>{error}</div>}
          {success && <div className={`${themes[activeTheme].successText} text-xs font-bold text-center mt-6 ${themes[activeTheme].successBg} p-3 rounded-xl`}>{success}</div>}
        </div>

        <div className={`p-4 sm:p-6 border-t ${themes[activeTheme].border} ${themes[activeTheme].profileBg} flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 shrink-0`}>
          {view === 'profile' ? (
            isOwnProfile && (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex-1 min-w-[140px] ${themes[activeTheme].accentBg} py-3 sm:py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 text-xs sm:text-sm`}
                >
                  <ThemeIcon icon="Save" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setView('settings')}
                  className={`p-3 sm:p-4 rounded-2xl ${themes[activeTheme].button} transition-colors`}
                  title="Account Settings"
                >
                  <ThemeIcon icon="Settings" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </>
            )
          ) : (
            <button
              onClick={() => setView('profile')}
              className={`flex-1 min-w-[140px] ${themes[activeTheme].button} py-3 sm:py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-xs sm:text-sm`}
            >
              Back to Profile
            </button>
          )}
          <button
            onClick={onLogout}
            className={`p-3 sm:p-4 rounded-2xl border ${themes[activeTheme].border} ${themes[activeTheme].errorText} hover:opacity-80 transition-opacity`}
            title="Logout"
          >
            <ThemeIcon icon="LogOut" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
