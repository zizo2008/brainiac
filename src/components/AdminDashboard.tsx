import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';
import { isGlobalPremium } from '../utils/premium';
import { ThemeIcon } from './ThemeIcon';
import { ThemeName, themes } from '../theme';
import AdminChatModal from './AdminChatModal';

interface Props {
  onBack: () => void;
  activeTheme: ThemeName;
}

export default function AdminDashboard({ onBack, activeTheme }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downtime, setDowntime] = useState(false);
  const [premiumPrice, setPremiumPrice] = useState<number>(299);
  const [alPackPrice, setAlPackPrice] = useState<number>(199);
  const [olPackPrice, setOlPackPrice] = useState<number>(199);
  const [corePackPrice, setCorePackPrice] = useState<number>(199);
  const [updating, setUpdating] = useState<string | null>(null);

  // Modals state
  const [editingStatsUser, setEditingStatsUser] = useState<UserProfile | null>(null);
  const [editStatsForm, setEditStatsForm] = useState({ totalCorrect: 0, podiums: 0, won: 0 });
  
  const [banningUser, setBanningUser] = useState<UserProfile | null>(null);
  const [banDuration, setBanDuration] = useState<number>(0); // 0 = permanent
  
  const [activeChatUser, setActiveChatUser] = useState<any | null>(null);

  const [filter, setFilter] = useState<'all' | 'premium' | 'teacher'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
    
    // Listen to support chats
    const unsubscribe = onSnapshot(collection(db, 'support_chats'), (snapshot) => {
      const chats: any[] = [];
      snapshot.forEach(doc => {
        chats.push({ id: doc.id, ...doc.data() });
      });
      chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setSupportChats(chats);
    });
    
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(d => d.data() as UserProfile);
      setUsers(usersList);

      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setDowntime(data.downtime || false);
        if (data.premiumPrice) setPremiumPrice(data.premiumPrice);
        if (data.alPackPrice) setAlPackPrice(data.alPackPrice);
        if (data.olPackPrice) setOlPackPrice(data.olPackPrice);
        if (data.corePackPrice) setCorePackPrice(data.corePackPrice);
      }
    } catch (err) {
      console.error("Error fetching admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (filter === 'premium' && !isGlobalPremium(user)) return false;
    if (filter === 'teacher' && user.role !== 'teacher') return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.username?.toLowerCase().includes(query) ||
        user.friendCode?.toLowerCase().includes(query) ||
        user.uid.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const toggleDowntime = async () => {
    try {
      const newValue = !downtime;
      await setDoc(doc(db, 'settings', 'global'), { downtime: newValue }, { merge: true });
      setDowntime(newValue);
    } catch (err) {
      console.error("Error toggling downtime", err);
    }
  };

  const updatePrice = async (key: string, newPrice: number) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { [key]: newPrice }, { merge: true });
    } catch (err) {
      console.error(`Error updating ${key}`, err);
    }
  };

  const approvePremium = async (user: UserProfile) => {
    setUpdating(user.uid);
    try {
      const planToApprove = user.premiumRequestedPlan || 'brainiac_one';
      await updateDoc(doc(db, 'users', user.uid), { 
        isPremium: true,
        premiumPlan: planToApprove,
        premiumRequested: false,
        premiumRequestedPlan: null,
        hintsRemaining: 5,
        lastHintResetDate: new Date().toISOString().split('T')[0]
      });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, isPremium: true, premiumPlan: planToApprove, premiumRequested: false, premiumRequestedPlan: undefined } : u));
      alert(`${planToApprove} granted to ${user.username || 'user'}!`);
    } catch (err) {
      console.error("Error approving premium", err);
      alert("Failed to approve premium: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdating(null);
    }
  };

  const revokePremium = async (user: UserProfile) => {
    setUpdating(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isPremium: false, premiumPlan: null });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, isPremium: false, premiumPlan: undefined } : u));
      alert(`Premium revoked from ${user.username || 'user'}!`);
    } catch (err) {
      console.error("Error revoking premium", err);
      alert("Failed to revoke premium: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdating(null);
    }
  };

  const handleBanSubmit = async () => {
    if (!banningUser) return;
    setUpdating(banningUser.uid);
    try {
      const banUntil = banDuration === 0 ? null : Date.now() + banDuration;
      await updateDoc(doc(db, 'users', banningUser.uid), { 
        isBanned: true,
        banUntil
      });
      setUsers(users.map(u => u.uid === banningUser.uid ? { ...u, isBanned: true, banUntil } : u));
      setBanningUser(null);
    } catch (err) {
      console.error("Error banning user", err);
    } finally {
      setUpdating(null);
    }
  };

  const unbanUser = async (user: UserProfile) => {
    setUpdating(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { 
        isBanned: false,
        banUntil: null
      });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, isBanned: false, banUntil: null } : u));
    } catch (err) {
      console.error("Error unbanning user", err);
    } finally {
      setUpdating(null);
    }
  };

  const handleStatsSubmit = async () => {
    if (!editingStatsUser) return;

    setUpdating(editingStatsUser.uid);
    try {
      await updateDoc(doc(db, 'users', editingStatsUser.uid), { 
        totalCorrect: editStatsForm.totalCorrect,
        podiums: editStatsForm.podiums,
        won: editStatsForm.won
      });
      setUsers(users.map(u => u.uid === editingStatsUser.uid ? { ...u, ...editStatsForm } : u));
      setEditingStatsUser(null);
    } catch (err) {
      console.error("Error updating stats", err);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className={`min-h-screen ${themes[activeTheme].wrapper} p-2 sm:p-4 lg:p-8 relative overflow-y-auto`}>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <button onClick={onBack} className={`flex items-center gap-1.5 sm:gap-2 ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors mb-2 sm:mb-4`}>
              <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-bold uppercase tracking-widest text-xs sm:text-sm">Back</span>
            </button>
            <h1 className={`text-xl sm:text-2xl lg:text-4xl font-black uppercase tracking-tight ${themes[activeTheme].textPrimary}`}>
              Admin Dashboard
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className={`flex flex-col gap-2 ${themes[activeTheme].card} p-2 sm:p-3 rounded-lg sm:rounded-xl border ${themes[activeTheme].border} text-[10px] sm:text-xs`}>
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold">Brainiac One:</span>
                <input type="number" value={premiumPrice} onChange={(e) => setPremiumPrice(Number(e.target.value))} onBlur={() => updatePrice('premiumPrice', premiumPrice)} className={`w-12 bg-transparent font-bold ${themes[activeTheme].textPrimary} focus:outline-none text-right`} /> EGP
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold">AL Pack:</span>
                <input type="number" value={alPackPrice} onChange={(e) => setAlPackPrice(Number(e.target.value))} onBlur={() => updatePrice('alPackPrice', alPackPrice)} className={`w-12 bg-transparent font-bold ${themes[activeTheme].textPrimary} focus:outline-none text-right`} /> EGP
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold">OL Pack:</span>
                <input type="number" value={olPackPrice} onChange={(e) => setOlPackPrice(Number(e.target.value))} onBlur={() => updatePrice('olPackPrice', olPackPrice)} className={`w-12 bg-transparent font-bold ${themes[activeTheme].textPrimary} focus:outline-none text-right`} /> EGP
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold">Core Pack:</span>
                <input type="number" value={corePackPrice} onChange={(e) => setCorePackPrice(Number(e.target.value))} onBlur={() => updatePrice('corePackPrice', corePackPrice)} className={`w-12 bg-transparent font-bold ${themes[activeTheme].textPrimary} focus:outline-none text-right`} /> EGP
              </div>
            </div>
            <button
              onClick={toggleDowntime}
              className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs lg:text-sm transition-all shadow-sm active:scale-95 ${downtime ? 'bg-red-500 text-white' : themes[activeTheme].card + ' ' + themes[activeTheme].textPrimary}`}
            >
              {downtime ? 'Disable Downtime' : 'Enable Downtime'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className={`w-12 h-12 border-4 ${themes[activeTheme].border} border-t-red-500 rounded-full animate-spin`} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar flex-1">
                <button 
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${filter === 'all' ? themes[activeTheme].accentBg : themes[activeTheme].card + ' ' + themes[activeTheme].textSecondary}`}
                >
                  All Users
                </button>
                <button 
                  onClick={() => setFilter('premium')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${filter === 'premium' ? themes[activeTheme].accentBg : themes[activeTheme].card + ' ' + themes[activeTheme].textSecondary}`}
                >
                  Premium Users
                </button>
                <button 
                  onClick={() => setFilter('teacher')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${filter === 'teacher' ? themes[activeTheme].accentBg : themes[activeTheme].card + ' ' + themes[activeTheme].textSecondary}`}
                >
                  Teachers
                </button>
              </div>
              <div className="relative w-full sm:w-64 shrink-0">
                <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${themes[activeTheme].textSecondary}`}>
                  <ThemeIcon icon="Search" theme={activeTheme} className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or friend code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm font-medium border ${themes[activeTheme].border} bg-transparent focus:outline-none focus:border-indigo-500 transition-colors ${themes[activeTheme].textPrimary}`}
                />
              </div>
            </div>
            {filteredUsers.map(user => {
              const isMe = user.uid === auth.currentUser?.uid;
              return (
                <div key={user.uid} className={`${themes[activeTheme].card} rounded-xl sm:rounded-2xl lg:rounded-3xl p-4 border ${themes[activeTheme].border} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.username} className="w-10 h-10 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${themes[activeTheme].badge}`}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm sm:text-base ${themes[activeTheme].textPrimary} flex flex-wrap items-center gap-2`}>
                        {user.username}
                        {user.premiumRequested && !isGlobalPremium(user) && (
                          <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                            Req: {user.premiumRequestedPlan === 'al_pack' ? 'AL' : user.premiumRequestedPlan === 'ol_pack' ? 'OL' : user.premiumRequestedPlan === 'core_pack' ? 'Core' : 'Brainiac One'}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-red-500/20 text-red-500' : themes[activeTheme].badgeSecondary}`}>
                          {user.role}
                        </span>
                      </div>
                      <div className={`text-[10px] sm:text-xs ${themes[activeTheme].textSecondary} truncate mt-1`} title={user.uid}>{user.uid}</div>
                      <div className={`font-bold text-xs mt-2 ${themes[activeTheme].textPrimary}`}>Stats: {user.totalCorrect} correct | {user.won} won</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {user.premiumRequested && !isGlobalPremium(user) ? (
                      <button
                        onClick={() => approvePremium(user)}
                        disabled={updating === user.uid}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors bg-amber-500 text-white whitespace-nowrap`}
                      >
                        Approve {user.premiumRequestedPlan === 'al_pack' ? 'AL' : user.premiumRequestedPlan === 'ol_pack' ? 'OL' : user.premiumRequestedPlan === 'core_pack' ? 'Core' : 'One'}
                      </button>
                    ) : (
                      <button
                        onClick={() => isGlobalPremium(user) ? revokePremium(user) : approvePremium(user)}
                        disabled={updating === user.uid}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${isGlobalPremium(user) ? 'bg-amber-500 text-white' : themes[activeTheme].badgeSecondary}`}
                      >
                        {isGlobalPremium(user) ? 'Revoke Premium' : 'Grant Premium'}
                      </button>
                    )}
                    {isGlobalPremium(user) && (
                       <span className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${themes[activeTheme].badgeSecondary} whitespace-nowrap flex items-center`}>
                          {user.premiumPlan === 'al_pack' ? 'AL Pack' : user.premiumPlan === 'ol_pack' ? 'OL Pack' : user.premiumPlan === 'core_pack' ? 'Core Pack' : 'Brainiac One'}
                       </span>
                    )}
                    
                    {!isMe && (
                      user.isBanned ? (
                        <button
                          onClick={() => unbanUser(user)}
                          disabled={updating === user.uid}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors bg-red-500 text-white whitespace-nowrap`}
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => setBanningUser(user)}
                          disabled={updating === user.uid}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${themes[activeTheme].badgeSecondary} hover:bg-red-500/20 hover:text-red-500`}
                        >
                          Ban
                        </button>
                      )
                    )}
                    
                    <button
                      onClick={() => { 
                        setEditingStatsUser(user); 
                        setEditStatsForm({ 
                          totalCorrect: user.totalCorrect || 0, 
                          podiums: user.podiums || 0, 
                          won: user.won || 0 
                        }); 
                      }}
                      disabled={updating === user.uid}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${themes[activeTheme].badgeSecondary}`}
                    >
                      Edit Stats
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Support Chats Section */}
        <div className={`${themes[activeTheme].card} rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden border ${themes[activeTheme].border} mt-4 sm:mt-8`}>
          <div className={`p-4 sm:p-6 border-b ${themes[activeTheme].border}`}>
            <h2 className={`text-lg sm:text-xl font-black uppercase tracking-tight ${themes[activeTheme].textPrimary}`}>Support Chats</h2>
          </div>
          <div className="divide-y custom-scrollbar max-h-96 overflow-y-auto">
            {supportChats.length === 0 ? (
              <div className={`p-6 sm:p-8 text-center text-xs sm:text-sm ${themes[activeTheme].textSecondary}`}>No active support chats.</div>
            ) : (
              supportChats.map(chat => (
                <div key={chat.id} className={`p-3 sm:p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${chat.unreadAdmin ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`} onClick={() => setActiveChatUser(chat)}>
                  <div className="min-w-0 pr-2 sm:pr-4">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3 className={`font-bold text-sm sm:text-base truncate ${themes[activeTheme].textPrimary}`}>{chat.username}</h3>
                      {chat.unreadAdmin && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shrink-0"></span>}
                    </div>
                    <p className={`text-xs sm:text-sm truncate max-w-[150px] sm:max-w-md ${chat.unreadAdmin ? themes[activeTheme].textPrimary : themes[activeTheme].textSecondary}`}>{chat.lastMessage}</p>
                  </div>
                  <div className={`text-[10px] sm:text-xs shrink-0 ${themes[activeTheme].textSecondary}`}>
                    {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Stats Modal */}
      {editingStatsUser && (
        <div className={`fixed inset-0 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm z-50 flex items-center justify-center p-4`}>
          <div className={`${themes[activeTheme].card} p-5 sm:p-8 rounded-2xl sm:rounded-3xl max-w-sm w-full shadow-xl border ${themes[activeTheme].border}`}>
            <h3 className={`text-base sm:text-lg font-black uppercase tracking-tight ${themes[activeTheme].textPrimary} mb-1 sm:mb-4`}>Edit Stats</h3>
            <p className={`text-[10px] sm:text-sm ${themes[activeTheme].textSecondary} mb-4`}>Editing stats for {editingStatsUser.username}</p>
            
            <div className="space-y-2.5 sm:space-y-4 mb-5 sm:mb-6">
              <div>
                <label className={`block text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider ${themes[activeTheme].textSecondary} mb-1`}>Total Correct</label>
                <input
                  type="number"
                  value={editStatsForm.totalCorrect}
                  onChange={(e) => setEditStatsForm({...editStatsForm, totalCorrect: parseInt(e.target.value) || 0})}
                  className={`w-full bg-transparent border-2 ${themes[activeTheme].border} rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 font-bold focus:outline-none focus:border-indigo-500 transition-colors text-xs sm:text-base`}
                />
              </div>
              <div>
                <label className={`block text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider ${themes[activeTheme].textSecondary} mb-1`}>Podiums</label>
                <input
                  type="number"
                  value={editStatsForm.podiums}
                  onChange={(e) => setEditStatsForm({...editStatsForm, podiums: parseInt(e.target.value) || 0})}
                  className={`w-full bg-transparent border-2 ${themes[activeTheme].border} rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 font-bold focus:outline-none focus:border-indigo-500 transition-colors text-xs sm:text-base`}
                />
              </div>
              <div>
                <label className={`block text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider ${themes[activeTheme].textSecondary} mb-1`}>Games Won</label>
                <input
                  type="number"
                  value={editStatsForm.won}
                  onChange={(e) => setEditStatsForm({...editStatsForm, won: parseInt(e.target.value) || 0})}
                  className={`w-full bg-transparent border-2 ${themes[activeTheme].border} rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 font-bold focus:outline-none focus:border-indigo-500 transition-colors text-xs sm:text-base`}
                />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-4">
              <button onClick={() => setEditingStatsUser(null)} className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs lg:text-sm ${themes[activeTheme].badgeSecondary}`}>Cancel</button>
              <button onClick={handleStatsSubmit} className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs lg:text-sm ${themes[activeTheme].accentBg}`}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {banningUser && (
        <div className={`fixed inset-0 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm z-50 flex items-center justify-center p-4`}>
          <div className={`${themes[activeTheme].card} p-5 sm:p-8 rounded-2xl sm:rounded-3xl max-w-sm w-full shadow-xl border-2 border-red-500/50`}>
            <h3 className={`text-base sm:text-lg font-black uppercase tracking-tight text-red-500 mb-1 sm:mb-4`}>Ban User</h3>
            <p className={`text-[10px] sm:text-sm ${themes[activeTheme].textSecondary} mb-4 sm:mb-6`}>Select ban duration for {banningUser.username}</p>
            
            <div className="space-y-2 sm:space-y-3 mb-5 sm:mb-8">
              <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                <input type="radio" name="ban" checked={banDuration === 1000 * 60 * 60 * 24} onChange={() => setBanDuration(1000 * 60 * 60 * 24)} className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                <span className={`font-bold text-xs sm:text-base ${themes[activeTheme].textPrimary}`}>1 Day</span>
              </label>
              <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                <input type="radio" name="ban" checked={banDuration === 1000 * 60 * 60 * 24 * 7} onChange={() => setBanDuration(1000 * 60 * 60 * 24 * 7)} className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                <span className={`font-bold text-xs sm:text-base ${themes[activeTheme].textPrimary}`}>1 Week</span>
              </label>
              <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                <input type="radio" name="ban" checked={banDuration === 0} onChange={() => setBanDuration(0)} className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                <span className={`font-bold text-xs sm:text-base ${themes[activeTheme].textPrimary}`}>Permanent</span>
              </label>
            </div>

            <div className="flex gap-2 sm:gap-4">
              <button onClick={() => setBanningUser(null)} className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs lg:text-sm ${themes[activeTheme].badgeSecondary}`}>Cancel</button>
              <button onClick={handleBanSubmit} className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs lg:text-sm bg-red-500 text-white hover:bg-red-600`}>Ban User</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Chat Modal */}
      {activeChatUser && (
        <AdminChatModal
          chatUser={activeChatUser}
          onClose={() => setActiveChatUser(null)}
          activeTheme={activeTheme}
        />
      )}
    </div>
  );
}
