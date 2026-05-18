import React, { useState, useEffect } from 'react';
import { ThemeIcon } from './ThemeIcon';
import { createGame, joinGame, startGame } from '../services/db';
import { auth, db } from '../firebase';
import { Game, GamePlayer, UserProfile, Level } from '../types';
import { doc, onSnapshot } from 'firebase/firestore';
import { hasPremiumForLevel } from '../utils/premium';

import { ThemeName, themes } from '../theme';

interface Props {
  onBack: () => void;
  onStartGame: (game: Game) => void;
  activeTheme: ThemeName;
  userProfile: UserProfile | null;
  initialJoinCode?: string;
}

export default function MultiplayerSetup({ onBack, onStartGame, activeTheme, userProfile, initialJoinCode }: Props) {
  const [mode, setMode] = useState<'create' | 'join' | null>(initialJoinCode ? 'join' : null);
  const [subject, setSubject] = useState('chemistry');
  const [level, setLevel] = useState<Level>('extended');
  const [gameMode, setGameMode] = useState<'questions' | 'time' | 'both' | 'whole_paper'>('questions');
  const [targetQuestions, setTargetQuestions] = useState(10);
  const [targetTime, setTargetTime] = useState(60);
  const [targetExamCode, setTargetExamCode] = useState('');
  const [sameQuestions, setSameQuestions] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(2);
  
  const [joinCode, setJoinCode] = useState(initialJoinCode || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [createdGame, setCreatedGame] = useState<Game | null>(null);
  const [copied, setCopied] = useState(false);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userProfile?.friends && userProfile.friends.length > 0) {
      const fetchFriends = async () => {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const friendDocs = await Promise.all(userProfile.friends.map(uid => getDoc(doc(db, 'users', uid))));
          setFriendsList(friendDocs.filter(d => d.exists()).map(d => d.data() as UserProfile));
        } catch (e) {
          console.error("Failed to fetch friends", e);
        }
      };
      fetchFriends();
    }
  }, [userProfile?.friends]);

  useEffect(() => {
    if (initialJoinCode && auth.currentUser) {
      handleJoin();
    }
  }, [initialJoinCode, auth.currentUser]);

  useEffect(() => {
    if (!createdGame) return;
    
    const unsubscribe = onSnapshot(doc(db, 'games', createdGame.id), (doc) => {
      if (doc.exists()) {
        const gameData = { ...doc.data(), id: doc.id } as Game;
        setCreatedGame(gameData);
        if (gameData.status === 'playing') {
          onStartGame(gameData);
        }
      }
    }, (error) => {
      console.error("Error fetching game:", error);
    });
    
    return () => unsubscribe();
  }, [createdGame?.id, onStartGame]);

  const handleCreate = async () => {
    if (!auth.currentUser) {
      window.dispatchEvent(new CustomEvent('openPremiumModal'));
      return;
    }
    if (subject === 'economics' && !hasPremiumForLevel(userProfile, level)) {
      const today = new Date().toISOString().split('T')[0];
      const dailyEcon = userProfile?.lastEconResetDate === today ? (userProfile?.dailyEconAnswered || 0) : 0;
      if (dailyEcon >= 10) {
        window.dispatchEvent(new CustomEvent('openPremiumModal'));
        return;
      }
    }

    setLoading(true);
    try {
      const game = await createGame(
        auth.currentUser.uid,
        auth.currentUser.displayName || 'Host',
        subject,
        gameMode,
        gameMode === 'questions' || gameMode === 'both' ? targetQuestions : undefined,
        gameMode === 'time' || gameMode === 'both' ? targetTime : undefined,
        sameQuestions,
        undefined,
        gameMode === 'whole_paper' ? targetExamCode : undefined,
        maxPlayers,
        userProfile?.photoURL,
        level
      );
      if (game) {
        setCreatedGame(game);
      }
    } catch (err) {
      setError('Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!auth.currentUser) {
      window.dispatchEvent(new CustomEvent('openPremiumModal'));
      return;
    }
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const game = await joinGame(auth.currentUser.uid, auth.currentUser.displayName || 'Guest', joinCode.trim().toUpperCase(), userProfile?.photoURL);
      if (game) {
        setCreatedGame(game);
      }
    } catch (err) {
      setError('Invalid code, game full, or already started');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (createdGame) {
      setLoading(true);
      try {
        await startGame(createdGame.id);
      } catch (err) {
        console.error("Failed to start game:", err);
        setError("Failed to start game. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const copyCode = () => {
    if (createdGame) {
      navigator.clipboard.writeText(createdGame.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (createdGame) {
    const isHost = auth.currentUser?.uid === createdGame.hostId;
    const playersList = (Object.values(createdGame.players || {}) as GamePlayer[]);

    return (
      <div className={`max-w-md mx-auto p-6 sm:p-8 rounded-3xl shadow-xl mt-6 text-center ${themes[activeTheme].card}`}>
        <h2 className={`text-xl sm:text-2xl font-black mb-2 uppercase tracking-tight ${themes[activeTheme].textPrimary}`}>Game Lobby</h2>
        <p className={`text-xs font-bold mb-4 uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Share this code to invite friends</p>
        
        {error && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-bold ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText}`}>
            {error}
          </div>
        )}
        
        <div className={`p-6 rounded-3xl border mb-8 flex items-center justify-center gap-6 relative overflow-hidden ${themes[activeTheme].border} ${themes[activeTheme].iconContainer}`}>
          <div className={`absolute inset-0 ${themes[activeTheme].accentBg} opacity-5 dark:opacity-10`}></div>
          <span className={`text-4xl sm:text-5xl font-mono font-black tracking-[0.2em] relative z-10 ${themes[activeTheme].accent}`}>{createdGame.code}</span>
          <button onClick={copyCode} className={`p-3 rounded-2xl shadow-sm transition-all relative z-10 hover:scale-105 active:scale-95 ${themes[activeTheme].card} ${themes[activeTheme].textSecondary}`}>
            {copied ? <ThemeIcon icon="Check" theme={activeTheme} className="w-6 h-6 text-emerald-500" /> : <ThemeIcon icon="Copy" theme={activeTheme} className="w-6 h-6" />}
          </button>
        </div>

        <div className="mb-8 text-left">
          <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center justify-between ${themes[activeTheme].textSecondary}`}>
            <span>Players</span>
            <span className={`px-2 py-1 rounded-lg ${themes[activeTheme].badgeSecondary}`}>{playersList.length} / {createdGame.maxPlayers}</span>
          </h3>
          <div className="space-y-3">
            {playersList.map(p => (
              <div key={p.uid} className={`flex items-center gap-4 p-4 rounded-2xl border ${themes[activeTheme].border} ${themes[activeTheme].iconContainer}`}>
                {p.photoURL ? (
                  <img src={p.photoURL} alt={p.username} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${themes[activeTheme].badge}`}>
                    <ThemeIcon icon="User" theme={activeTheme} className="w-5 h-5" />
                  </div>
                )}
                <span className={`font-black text-sm tracking-tight ${themes[activeTheme].textPrimary}`}>{p.username} {p.uid === createdGame.hostId && <span className={`text-[9px] uppercase tracking-widest ml-2 px-2 py-1 rounded-md ${themes[activeTheme].badge}`}>Host</span>}</span>
              </div>
            ))}
          </div>
        </div>
        
        {isHost ? (
          <>
            <button 
              onClick={() => setShowInviteModal(true)}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all mb-4 text-xs ${themes[activeTheme].accentBg}`}
            >
              Invite Friends
            </button>
            <button 
              onClick={handleStartGame}
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-50 mb-4 text-xs ${themes[activeTheme].accentBg} text-white shadow-lg active:scale-95`}
            >
              {loading ? 'Starting...' : 'Start Game'}
            </button>
          </>
        ) : (
          <div className={`flex justify-center items-center gap-3 mb-8 p-4 rounded-2xl border ${themes[activeTheme].border} ${themes[activeTheme].iconContainer}`}>
            <div className={`animate-spin rounded-full h-5 w-5 border-b-2 border-t-transparent ${themes[activeTheme].border.replace('border-', 'border-')}`}></div>
            <span className={`text-xs font-black uppercase tracking-widest ${themes[activeTheme].textSecondary}`}>Waiting for host...</span>
          </div>
        )}
        
        <button onClick={onBack} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${themes[activeTheme].textSecondary}`}>
          Leave Game
        </button>

        {showInviteModal && (
          <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop} overflow-hidden`}>
            <div className={`absolute inset-0`} onClick={() => setShowInviteModal(false)} />
            <div className={`${themes[activeTheme].card} rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col relative z-10`}>
              <div className={`p-6 border-b ${themes[activeTheme].border} flex items-center justify-between`}>
                <h3 className={`text-xl font-bold ${themes[activeTheme].textPrimary}`}>Invite Friends</h3>
                <button onClick={() => setShowInviteModal(false)} className={`p-2 rounded-xl ${themes[activeTheme].iconButton}`}>
                  <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {friendsList.length === 0 ? (
                  <p className={`text-center ${themes[activeTheme].textSecondary} text-sm font-medium py-8`}>No friends found. Add friends in the Friend Hub!</p>
                ) : (
                  friendsList.map(friend => (
                    <div key={friend.uid} className={`flex items-center justify-between p-3 rounded-2xl border ${themes[activeTheme].border}`}>
                      <div className="flex items-center gap-3">
                        {friend.photoURL ? (
                          <img src={friend.photoURL} alt={friend.username} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${themes[activeTheme].badge}`}>
                            {friend.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`font-bold ${themes[activeTheme].textPrimary}`}>{friend.username}</span>
                      </div>
                      <button 
                        onClick={async () => {
                          if (!auth.currentUser) return;
                          try {
                            const { sendGameInvite } = await import('../services/db');
                            await sendGameInvite(createdGame.id, createdGame.code, auth.currentUser.uid, auth.currentUser.displayName || 'Host', friend.uid);
                            setInvitedFriends(prev => new Set(prev).add(friend.uid));
                          } catch (e) {
                            console.error("Failed to send invite", e);
                          }
                        }}
                        disabled={invitedFriends.has(friend.uid)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${invitedFriends.has(friend.uid) ? `${themes[activeTheme].successBg} ${themes[activeTheme].successText}` : themes[activeTheme].accentBg}`}
                      >
                        {invitedFriends.has(friend.uid) ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4 h-full flex flex-col">
      <div className="flex items-center mb-4 sm:mb-6 shrink-0">
        <button onClick={onBack} className={`mr-3 p-1.5 rounded-full transition-colors ${themes[activeTheme].iconButton}`}>
          <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-5 h-5" />
        </button>
        <h1 className={`text-xl sm:text-2xl font-bold ${themes[activeTheme].textPrimary}`}>Multiplayer</h1>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {!mode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <button onClick={() => setMode('create')} className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border transition-all group flex flex-col items-center text-center ${themes[activeTheme].card} ${themes[activeTheme].border}`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform ${themes[activeTheme].badge}`}>
                <ThemeIcon icon="Play" theme={activeTheme} className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className={`text-lg sm:text-xl font-bold mb-1 ${themes[activeTheme].textPrimary}`}>Create Game</h2>
              <p className={`text-xs sm:text-sm ${themes[activeTheme].textSecondary}`}>Host a game and invite a friend.</p>
            </button>
            
            <button onClick={() => setMode('join')} className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border transition-all group flex flex-col items-center text-center ${themes[activeTheme].card} ${themes[activeTheme].border}`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform ${themes[activeTheme].badgeSecondary}`}>
                <ThemeIcon icon="Users" theme={activeTheme} className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2 className={`text-lg sm:text-xl font-bold mb-1 ${themes[activeTheme].textPrimary}`}>Join Game</h2>
              <p className={`text-xs sm:text-sm ${themes[activeTheme].textSecondary}`}>Enter a code to join a friend.</p>
            </button>
          </div>
        ) : mode === 'join' ? (
          <div className={`rounded-3xl p-6 sm:p-8 shadow-xl border max-w-md mx-auto ${themes[activeTheme].card} ${themes[activeTheme].border}`}>
            <h2 className={`text-xl sm:text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 ${themes[activeTheme].textPrimary}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${themes[activeTheme].badgeSecondary}`}>
                <ThemeIcon icon="Users" theme={activeTheme} className="w-5 h-5" />
              </div>
              Join Game
            </h2>
            {error && <div className={`mb-6 text-sm font-bold flex items-center gap-2 ${themes[activeTheme].errorText}`}><div className={`w-1.5 h-1.5 rounded-full ${themes[activeTheme].errorBg.replace('bg-', 'bg-')}`}></div>{error}</div>}
            <div className="mb-8">
              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-center ${themes[activeTheme].textSecondary}`}>Enter Game Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="6-CHAR CODE"
                className={`w-full px-4 py-4 rounded-2xl border outline-none uppercase text-center font-mono font-black text-2xl tracking-[0.3em] transition-all ${themes[activeTheme].input}`}
                maxLength={6}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMode(null)} className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-xs ${themes[activeTheme].iconButton}`}>Back</button>
              <button onClick={handleJoin} disabled={loading || !joinCode} className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-50 text-xs text-white ${themes[activeTheme].accentBg}`}>
                {loading ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          </div>
        ) : (
        <div className={`rounded-3xl p-6 sm:p-8 shadow-xl border max-w-2xl mx-auto ${themes[activeTheme].card} ${themes[activeTheme].border}`}>
          <h2 className={`text-xl sm:text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3 ${themes[activeTheme].textPrimary}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${themes[activeTheme].badge}`}>
              <ThemeIcon icon="Play" theme={activeTheme} className="w-5 h-5" />
            </div>
            Game Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${themes[activeTheme].textSecondary}`}>Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={`w-full px-4 py-3.5 rounded-2xl border outline-none font-bold transition-all cursor-pointer appearance-none ${themes[activeTheme].input}`}>
                <option value="chemistry">Chemistry</option>
                <option value="physics">Physics</option>
                <option value="biology">Biology</option>
                {level !== 'core' && (
                  <>
                    <option value="economics">Economics</option>
                    <option value="accounting">Accounting</option>
                  </>
                )}
              </select>
            </div>
            
            <div>
              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${themes[activeTheme].textSecondary}`}>Level</label>
              <select value={level} onChange={(e: any) => setLevel(e.target.value)} className={`w-full px-4 py-3.5 rounded-2xl border outline-none font-bold transition-all cursor-pointer appearance-none ${themes[activeTheme].input}`}>
                <option value="extended">Extended / IGCSE</option>
                <option value="core">Core</option>
                <option value="a_level">A Level</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${themes[activeTheme].textSecondary}`}>Mode</label>
              <select value={gameMode} onChange={(e: any) => setGameMode(e.target.value)} className={`w-full px-4 py-3.5 rounded-2xl border outline-none font-bold transition-all cursor-pointer appearance-none ${themes[activeTheme].input}`}>
                <option value="questions">Questions</option>
                <option value="time">Time Limit</option>
                <option value="both">Both</option>
                <option value="whole_paper">Whole Exam</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {(gameMode === 'questions' || gameMode === 'both') && (
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${themes[activeTheme].textSecondary}`}>Questions</label>
                <input type="number" min="1" max="50" value={targetQuestions || ''} onChange={(e) => setTargetQuestions(parseInt(e.target.value) || 0)} className={`w-full px-4 py-3.5 rounded-2xl border outline-none font-bold transition-all ${themes[activeTheme].input}`} />
              </div>
            )}
            
            {(gameMode === 'time' || gameMode === 'both') && (
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${themes[activeTheme].textSecondary}`}>Time (Sec)</label>
                <input type="number" min="10" max="600" value={targetTime || ''} onChange={(e) => setTargetTime(parseInt(e.target.value) || 0)} className={`w-full px-4 py-3.5 rounded-2xl border outline-none font-bold transition-all ${themes[activeTheme].input}`} />
              </div>
            )}

            {gameMode === 'whole_paper' && (
              <div className="md:col-span-2">
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${themes[activeTheme].textSecondary}`}>Exam Code</label>
                <input type="text" placeholder="e.g. 0620/22/M/J/23" value={targetExamCode} onChange={(e) => setTargetExamCode(e.target.value)} className={`w-full px-4 py-3.5 rounded-2xl border outline-none font-bold uppercase tracking-widest transition-all ${themes[activeTheme].input}`} />
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex justify-between items-center ${themes[activeTheme].textSecondary}`}>
              <span>Max Players</span>
              <span className={`px-2 py-1 rounded-lg text-xs ${themes[activeTheme].badge}`}>{maxPlayers}</span>
            </label>
            <input type="range" min="2" max="10" value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value))} className={`w-full h-2 ${themes[activeTheme].accentBg} rounded-lg appearance-none cursor-pointer accent-indigo-600`} />
          </div>
          
          <div className={`mb-8 p-4 rounded-2xl border flex items-center justify-between ${themes[activeTheme].border} ${themes[activeTheme].iconContainer}`}>
            <div>
              <h4 className={`text-sm font-bold ${themes[activeTheme].textPrimary}`}>Same Questions</h4>
              <p className={`text-[10px] font-medium mt-0.5 ${themes[activeTheme].textSecondary}`}>All players get identical questions</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={sameQuestions} onChange={(e) => setSameQuestions(e.target.checked)} className="sr-only peer" />
              <div className={`w-11 h-6 ${themes[activeTheme].accentBg} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 ${themes[activeTheme].accentBg.replace('bg-', 'peer-checked:bg-')}`}></div>
            </label>
          </div>
          
          <div className="flex gap-3">
            <button onClick={() => setMode(null)} className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-xs ${themes[activeTheme].iconButton}`}>Back</button>
            <button onClick={handleCreate} disabled={loading} className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-50 text-xs text-white ${themes[activeTheme].accentBg}`}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
