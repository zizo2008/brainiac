import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, FriendRequest } from '../types';
import { sendFriendRequestByCode, acceptFriendRequest, getFriendStats, getSentFriendRequests, getReceivedFriendRequests } from '../services/db';
import { ThemeIcon } from './ThemeIcon';
import { motion, AnimatePresence } from 'motion/react';
import { isGlobalPremium } from '../utils/premium';

import { ThemeName, themes } from '../theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  isGuest?: boolean;
  profileLoaded?: boolean;
  activeTheme: ThemeName;
}

interface FriendWithStats extends UserProfile {
  stats?: {
    totalGames: number;
    winPercentage: number;
  };
}

export default function FriendHubModal({ isOpen, onClose, currentUser, onLogout, isGuest, profileLoaded, activeTheme }: Props) {
  const [friends, setFriends] = useState<FriendWithStats[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [requestUsers, setRequestUsers] = useState<Record<string, UserProfile>>({});
  const [searchCode, setSearchCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add' | 'invites'>('friends');
  const [gameInvites, setGameInvites] = useState<any[]>([]);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleRequestsClick = () => {
    setActiveTab('requests');
    
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 2000);

    if (logoClickCount.current >= 20) {
      setShowAdminLogin(true);
      logoClickCount.current = 0;
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'Zain20082018') {
      try {
        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
            role: 'admin',
            adminSecret: 'Zain20082018' // This matches the rule on line 214 of firestore.rules
          });
        }
        window.dispatchEvent(new CustomEvent('adminUnlocked'));
        onClose();
      } catch (err) {
        console.error("Failed to elevate to admin:", err);
        // Fallback to local unlock if DB update fails
        window.dispatchEvent(new CustomEvent('adminUnlocked'));
        onClose();
      }
    } else {
      alert('Incorrect password.');
      setAdminPassword('');
    }
  };
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Fetch friends and stats when modal opens or friends list changes
  useEffect(() => {
    if (!isOpen || !currentUser || !auth.currentUser) return;

    let isMounted = true;
    const fetchFriendsData = async () => {
      if (currentUser.friends.length === 0) {
        setFriends([]);
        return;
      }

      setLoadingFriends(true);
      try {
        // Batch fetch friend profiles using 'in' query if possible (limit 30)
        // For simplicity and to handle > 30 friends, we'll still use Promise.all but with some caching logic if needed
        // Actually, let's just use the current logic but ensure it only runs when necessary
        const friendDocs = await Promise.all(
          currentUser.friends.map(uid => getDoc(doc(db, 'users', uid)))
        );
        
        if (!isMounted) return;

        const friendsList = friendDocs
          .filter(d => d.exists())
          .map(d => d.data() as UserProfile);
        
        // Fetch stats for each friend
        const friendsWithStats = await Promise.all(friendsList.map(async (f) => {
          const stats = await getFriendStats(auth.currentUser!.uid, f.uid);
          return { ...f, stats };
        }));

        if (isMounted) {
          setFriends(friendsWithStats);
        }
      } catch (err) {
        console.error("Error fetching friends data:", err);
      } finally {
        if (isMounted) {
          setLoadingFriends(false);
        }
      }
    };

    fetchFriendsData();

    // Listen for friend requests
    const reqQ = query(
      collection(db, 'friendRequests'), 
      where('toUid', '==', auth.currentUser.uid), 
      where('status', '==', 'pending')
    );
    const unsubReq = onSnapshot(reqQ, async (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
      if (!isMounted) return;
      setReceivedRequests(reqs);
      
      const uids = reqs.map(r => r.fromUid);
      if (uids.length > 0) {
        const userDocs = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid))));
        const usersMap = userDocs.filter(d => d.exists()).reduce((acc, d) => ({ ...acc, [d.id]: d.data() as UserProfile }), {});
        if (isMounted) setRequestUsers(prev => ({ ...prev, ...usersMap }));
      }
    }, (error) => {
      console.error("Error fetching received requests:", error);
    });

    const sentQ = query(
      collection(db, 'friendRequests'), 
      where('fromUid', '==', auth.currentUser.uid), 
      where('status', '==', 'pending')
    );
    const unsubSent = onSnapshot(sentQ, async (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
      if (!isMounted) return;
      setSentRequests(reqs);
      
      const uids = reqs.map(r => r.toUid);
      if (uids.length > 0) {
        const userDocs = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid))));
        const usersMap = userDocs.filter(d => d.exists()).reduce((acc, d) => ({ ...acc, [d.id]: d.data() as UserProfile }), {});
        if (isMounted) setRequestUsers(prev => ({ ...prev, ...usersMap }));
      }
    }, (error) => {
      console.error("Error fetching sent requests:", error);
    });

    const invitesQ = query(
      collection(db, 'gameInvites'),
      where('toUid', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );
    const unsubInvites = onSnapshot(invitesQ, (snapshot) => {
      const invites = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      if (!isMounted) return;
      setGameInvites(invites);
    }, (error) => {
      console.error("Error fetching game invites:", error);
    });

    return () => {
      isMounted = false;
      unsubReq();
      unsubSent();
      unsubInvites();
    };
  }, [isOpen, currentUser?.friends, currentUser?.uid]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim() || !auth.currentUser) return;
    setError('');
    setMessage('');
    try {
      await sendFriendRequestByCode(auth.currentUser.uid, searchCode.toUpperCase());
      setMessage('Friend request sent!');
      setSearchCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to send friend request');
    }
  };

  const handleAccept = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request.id, request.fromUid, auth.currentUser!.uid);
    } catch (err) {
      console.error("Error accepting request:", err);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
    } catch (err) {
      console.error("Error rejecting request:", err);
    }
  };

  if (isGuest || (profileLoaded && !currentUser)) {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`${themes[activeTheme].card} rounded-[2.5rem] p-8 flex flex-col items-center text-center space-y-6 max-w-sm relative`}
        >
          <button onClick={onClose} className={`absolute top-6 right-6 p-2 rounded-xl ${themes[activeTheme].iconButton} transition-colors`}>
            <ThemeIcon icon="X" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].textSecondary}`} />
          </button>
          
          <div className={`${themes[activeTheme].successBg} p-6 rounded-[2rem]`}>
            <ThemeIcon icon="Users" theme={activeTheme} className={`w-16 h-16 ${themes[activeTheme].accent}`} />
          </div>
          
          <div>
            <h3 className={`text-2xl font-black ${themes[activeTheme].textPrimary} uppercase tracking-tight`}>
              {isGuest ? 'Social Features' : 'Profile Required'}
            </h3>
            <p className={`${themes[activeTheme].textSecondary} mt-2 font-medium`}>
              {isGuest 
                ? 'Sign in to add friends, send requests, and compete on the global leaderboard!'
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
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const filteredFriends = friends.filter(f => 
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop} overflow-hidden`}>
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
        className={`${themes[activeTheme].card} rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative z-10`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-6 lg:p-8 border-b ${themes[activeTheme].border} flex items-center justify-between ${themes[activeTheme].accentBg}`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`${themes[activeTheme].iconContainer} p-2 sm:p-3 rounded-xl sm:rounded-2xl`}>
              <ThemeIcon icon="Users" theme={activeTheme} className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">Friend Hub</h2>
              <p className="text-white/80 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]">Connect & Compete</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className={`p-1.5 sm:p-2 rounded-xl ${themes[activeTheme].iconButton} transition-colors`}
          >
            <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex px-2 sm:px-4 lg:px-8 border-b ${themes[activeTheme].border} ${themes[activeTheme].card} overflow-x-auto custom-scrollbar`}>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`px-4 sm:px-6 py-3 sm:py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] lg:text-xs transition-all relative whitespace-nowrap ${activeTab === 'friends' ? themes[activeTheme].accent : themes[activeTheme].textSecondary}`}
          >
            Friends ({friends.length})
            {activeTab === 'friends' && <motion.div layoutId="tab-indicator" className={`absolute bottom-0 left-0 right-0 h-1 ${themes[activeTheme].accentBg} rounded-t-full`} />}
          </button>
          <button 
            onClick={handleRequestsClick}
            className={`px-4 sm:px-6 py-3 sm:py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] lg:text-xs transition-all relative flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${activeTab === 'requests' ? themes[activeTheme].accent : themes[activeTheme].textSecondary}`}
          >
            Requests {(receivedRequests.length + sentRequests.length) > 0 && <span className={`${themes[activeTheme].errorBg} ${themes[activeTheme].errorText} text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full`}>{receivedRequests.length + sentRequests.length}</span>}
            {activeTab === 'requests' && <motion.div layoutId="tab-indicator" className={`absolute bottom-0 left-0 right-0 h-1 ${themes[activeTheme].accentBg} rounded-t-full`} />}
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            className={`px-4 sm:px-6 py-3 sm:py-4 font-black uppercase tracking-widest text-[9px] sm:text-[10px] lg:text-xs transition-all relative whitespace-nowrap ${activeTab === 'add' ? themes[activeTheme].accent : themes[activeTheme].textSecondary}`}
          >
            Add Friend
            {activeTab === 'add' && <motion.div layoutId="tab-indicator" className={`absolute bottom-0 left-0 right-0 h-1 ${themes[activeTheme].accentBg} rounded-t-full`} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 custom-scrollbar relative">
          {showAdminLogin && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`absolute inset-x-4 top-4 z-50 p-6 rounded-3xl border shadow-xl ${themes[activeTheme].card} ${themes[activeTheme].border}`}
            >
              <h3 className={`text-lg font-black ${themes[activeTheme].textPrimary} mb-4 uppercase`}>Admin Authentication</h3>
              <form onSubmit={handleAdminAuth} className="space-y-4">
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter Secret Password"
                  autoFocus
                  className={`w-full px-4 py-3 rounded-2xl border outline-none font-bold ${themes[activeTheme].input}`}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAdminLogin(false)} className={`flex-1 py-3 rounded-xl font-bold uppercase text-xs ${themes[activeTheme].iconButton}`}>Cancel</button>
                  <button type="submit" className={`flex-1 py-3 rounded-xl font-black uppercase text-xs text-white ${themes[activeTheme].accentBg}`}>Unlock Admin</button>
                </div>
              </form>
            </motion.div>
          )}
          {activeTab === 'add' && (
            <div className={`${themes[activeTheme].card} rounded-3xl p-6 sm:p-8`}>
              <h3 className={`text-xs font-black ${themes[activeTheme].textSecondary} uppercase tracking-[0.2em] mb-6`}>Search by Friend Code</h3>
              <form onSubmit={handleAddFriend} className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <ThemeIcon icon="Search" theme={activeTheme} className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${themes[activeTheme].textSecondary}`} />
                  <input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-CHAR CODE"
                    maxLength={6}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl ${themes[activeTheme].input} outline-none font-mono font-bold tracking-[0.3em] uppercase text-center sm:text-left`}
                  />
                </div>
                <button type="submit" className={`${themes[activeTheme].accentBg} px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 group`}>
                  <ThemeIcon icon="UserPlus" theme={activeTheme} className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Add Friend
                </button>
              </form>
              {error && <div className={`${themes[activeTheme].errorText} mt-4 text-sm font-bold flex items-center gap-2`}><div className={`w-1.5 h-1.5 rounded-full ${themes[activeTheme].errorBg}`}></div>{error}</div>}
              {message && <div className={`${themes[activeTheme].successText} mt-4 text-sm font-bold flex items-center gap-2`}><div className={`w-1.5 h-1.5 rounded-full ${themes[activeTheme].successBg}`}></div>{message}</div>}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-8">
              {sentRequests.length > 0 && (
                <div>
                  <h3 className={`text-[8px] sm:text-[10px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-[0.2em] mb-3 sm:mb-4 flex items-center gap-2`}>
                    <div className={`w-6 sm:w-8 h-[1px] ${themes[activeTheme].border}`}></div>
                    Sent Requests
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    {sentRequests.map(req => (
                      <div key={req.id} className={`${themes[activeTheme].card} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between opacity-75`}>
                        <div className="flex items-center gap-3 sm:gap-4">
                          {requestUsers[req.toUid]?.photoURL ? (
                            <img src={requestUsers[req.toUid].photoURL} alt={requestUsers[req.toUid].username} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${themes[activeTheme].iconContainer} flex items-center justify-center ${themes[activeTheme].textSecondary} font-black text-base sm:text-lg`}>
                              {requestUsers[req.toUid]?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <div className={`font-black ${themes[activeTheme].textPrimary} tracking-tight flex items-center gap-1.5 text-sm sm:text-base`}>
                              {requestUsers[req.toUid]?.username || 'Loading...'}
                              {isGlobalPremium(requestUsers[req.toUid]) && (
                                <ThemeIcon icon="BadgeCheck" theme={activeTheme} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white fill-blue-500" />
                              )}
                            </div>
                            <div className={`text-[8px] sm:text-[9px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest`}>Waiting for response</div>
                          </div>
                        </div>
                        <div className={`text-[8px] sm:text-[9px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 ${themes[activeTheme].badgeSecondary} px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg`}>
                          <ThemeIcon icon="Clock" theme={activeTheme} className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Pending
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receivedRequests.length > 0 && (
                <div>
                  <h3 className={`text-[8px] sm:text-[10px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-[0.2em] mb-3 sm:mb-4 flex items-center gap-2`}>
                    <div className={`w-6 sm:w-8 h-[1px] ${themes[activeTheme].border}`}></div>
                    Received Requests
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    {receivedRequests.map(req => (
                      <div key={req.id} className={`${themes[activeTheme].card} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between hover:shadow-md transition-all`}>
                        <div className="flex items-center gap-3 sm:gap-4">
                          {requestUsers[req.fromUid]?.photoURL ? (
                            <img src={requestUsers[req.fromUid].photoURL} alt={requestUsers[req.fromUid].username} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${themes[activeTheme].successBg} flex items-center justify-center ${themes[activeTheme].accent} font-black text-base sm:text-lg`}>
                              {requestUsers[req.fromUid]?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <div className={`font-black ${themes[activeTheme].textPrimary} tracking-tight flex items-center gap-1.5 text-sm sm:text-base`}>
                              {requestUsers[req.fromUid]?.username || 'Loading...'}
                              {isGlobalPremium(requestUsers[req.fromUid]) && (
                                <ThemeIcon icon="BadgeCheck" theme={activeTheme} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white fill-blue-500" />
                              )}
                            </div>
                            <div className={`text-[8px] sm:text-[9px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest`}>Wants to be friends</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2">
                          <button onClick={() => handleAccept(req)} className={`p-2 sm:p-3 ${themes[activeTheme].buttonCorrect} rounded-lg sm:rounded-xl transition-all group`}>
                            <ThemeIcon icon="Check" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                          </button>
                          <button onClick={() => handleReject(req.id)} className={`p-2 sm:p-3 ${themes[activeTheme].buttonIncorrect} rounded-lg sm:rounded-xl transition-all group`}>
                            <ThemeIcon icon="X" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receivedRequests.length === 0 && sentRequests.length === 0 && (
                <div className="text-center py-16">
                  <div className={`${themes[activeTheme].iconContainer} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border ${themes[activeTheme].border}`}>
                    <ThemeIcon icon="Clock" theme={activeTheme} className={`w-10 h-10 ${themes[activeTheme].textSecondary}`} />
                  </div>
                  <p className={`${themes[activeTheme].textSecondary} font-bold uppercase tracking-widest text-xs`}>No pending requests</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <ThemeIcon icon="Search" theme={activeTheme} className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 ${themes[activeTheme].textSecondary}`} />
                <input 
                  type="text"
                  placeholder="SEARCH FRIENDS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl ${themes[activeTheme].input} outline-none transition-all font-bold text-xs sm:text-sm tracking-tight`}
                />
              </div>

              {loadingFriends ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-20 space-y-4">
                  <ThemeIcon icon="Loader2" theme={activeTheme} className={`w-8 h-8 sm:w-10 sm:h-10 ${themes[activeTheme].accent} animate-spin`} />
                  <p className={`${themes[activeTheme].textSecondary} font-bold uppercase tracking-widest text-[10px] sm:text-xs`}>Syncing friends...</p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <div className={`${themes[activeTheme].iconContainer} w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 border ${themes[activeTheme].border}`}>
                    <ThemeIcon icon="Users" theme={activeTheme} className={`w-8 h-8 sm:w-10 sm:h-10 ${themes[activeTheme].textSecondary}`} />
                  </div>
                  <p className={`${themes[activeTheme].textSecondary} font-bold uppercase tracking-widest text-[10px] sm:text-xs px-4`}>
                    {searchQuery ? 'No friends match your search' : 'No friends yet. Add some to start competing!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {filteredFriends.map(friend => (
                    <div 
                      key={friend.uid} 
                      className={`${themes[activeTheme].card} rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border ${themes[activeTheme].border} flex items-center gap-3 sm:gap-4 hover:border-indigo-500 hover:shadow-xl hover:-translate-y-0.5 transition-all group`}
                    >
                      <div className="relative">
                        {friend.photoURL ? (
                          <img src={friend.photoURL} alt={friend.username} className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                        ) : (
                          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl ${themes[activeTheme].successBg} flex items-center justify-center ${themes[activeTheme].accent} font-black text-lg sm:text-xl shadow-sm`}>
                            {friend.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 ${themes[activeTheme].successBg} border-2 ${themes[activeTheme].border} rounded-full shadow-sm`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-black ${themes[activeTheme].textPrimary} text-sm sm:text-lg truncate group-hover:${themes[activeTheme].accent} transition-colors tracking-tight flex items-center gap-1.5`}>
                          {friend.username}
                          {isGlobalPremium(friend) && (
                            <ThemeIcon icon="BadgeCheck" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 text-white fill-blue-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                          <div className={`flex items-center gap-1 text-[8px] sm:text-[9px] font-black ${themes[activeTheme].textSecondary} uppercase tracking-[0.15em]`}>
                            <ThemeIcon icon="History" theme={activeTheme} className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            {friend.stats?.totalGames || 0} Games
                          </div>
                          <div className={`flex items-center gap-1 text-[8px] sm:text-[9px] font-black ${themes[activeTheme].successText} uppercase tracking-[0.15em]`}>
                            <ThemeIcon icon="Trophy" theme={activeTheme} className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            {friend.stats?.winPercentage || 0}% Won
                          </div>
                        </div>
                      </div>
                      
                      {(() => {
                        const invite = gameInvites.find(inv => inv.fromUid === friend.uid);
                        if (invite) {
                          return (
                            <div className="flex gap-2 shrink-0">
                              <button 
                                onClick={async () => {
                                  try {
                                    const { acceptGameInvite } = await import('../services/db');
                                    await acceptGameInvite(invite.id);
                                    window.location.hash = `#join-${invite.gameCode}`;
                                    onClose();
                                  } catch (e) {
                                    console.error("Failed to accept invite", e);
                                  }
                                }}
                                className={`p-2 sm:p-3 ${themes[activeTheme].buttonCorrect} rounded-lg sm:rounded-xl transition-all group`}
                                title="Accept Game Invite"
                              >
                                <ThemeIcon icon="Check" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    const { declineGameInvite } = await import('../services/db');
                                    await declineGameInvite(invite.id);
                                  } catch (e) {
                                    console.error("Failed to decline invite", e);
                                  }
                                }}
                                className={`p-2 sm:p-3 ${themes[activeTheme].buttonIncorrect} rounded-lg sm:rounded-xl transition-all group`}
                                title="Decline Game Invite"
                              >
                                <ThemeIcon icon="X" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

