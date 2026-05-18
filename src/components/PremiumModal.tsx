import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeIcon } from './ThemeIcon';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, PremiumPlan } from '../types';

import { ThemeName, themes } from '../theme';

interface PremiumModalProps {
  user: UserProfile | null;
  onClose: () => void;
  activeTheme: ThemeName;
}

export default function PremiumModal({ user, onClose, activeTheme }: PremiumModalProps) {
  const [showClose, setShowClose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [prices, setPrices] = useState({
    brainiac_one: 299,
    al_pack: 199,
    ol_pack: 199,
    core_pack: 199
  });
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan>('brainiac_one');

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowClose(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists()) {
          const data = snap.data();
          setPrices({
            brainiac_one: data.premiumPrice || 299,
            al_pack: data.alPackPrice || 199,
            ol_pack: data.olPackPrice || 199,
            core_pack: data.corePackPrice || 199
          });
        }
      } catch (err) {
        console.error("Error fetching price", err);
      }
    };
    fetchPrice();
  }, []);

  const handleSubscribe = async () => {
    if (!user || !auth.currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        premiumRequested: true,
        premiumRequestedPlan: selectedPlan
      });
      // Show success briefly before closing
      await new Promise(resolve => setTimeout(resolve, 1500));
      onClose();
    } catch (error) {
      console.error("Error requesting premium:", error);
    } finally {
      setLoading(false);
    }
  };

  const isRequested = user?.premiumRequested;

    const perks = [
    { icon: <ThemeIcon icon="Shield" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].accent}`} />, text: "No ads" },
    { icon: <ThemeIcon icon="Sparkles" theme={activeTheme} className="w-5 h-5 text-amber-500" />, text: "4 App themes (instead of 2)" },
    { icon: <ThemeIcon icon="BadgeCheck" theme={activeTheme} className="w-5 h-5 text-white fill-blue-500" />, text: "Verified tag next to name" },
    { icon: <ThemeIcon icon="Zap" theme={activeTheme} className="w-5 h-5 text-rose-500" />, text: "5 Hints per day (instead of 2)" }
  ];

  const plans = [
    { id: 'brainiac_one', name: 'Brainiac One', desc: 'Full premium access across ALL subjects and ALL levels.', price: prices.brainiac_one },
    { id: 'al_pack', name: 'AL Pack', desc: 'Premium access specifically for A-Level subjects.', price: prices.al_pack },
    { id: 'ol_pack', name: 'OL Pack', desc: 'Premium access specifically for O-Level (Extended) subjects.', price: prices.ol_pack },
    { id: 'core_pack', name: 'Core Pack', desc: 'Premium access specifically for Core level subjects.', price: prices.core_pack },
  ] as const;

  return (
    <div className={`fixed inset-0 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm z-[100] flex items-center justify-center p-4 pb-24`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className={`${themes[activeTheme].card} rounded-2xl sm:rounded-3xl shadow-2xl border ${themes[activeTheme].border} w-full max-w-[340px] sm:max-w-md overflow-hidden relative`}
      >
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-amber-400 to-orange-500 opacity-10 pointer-events-none"></div>
        
        <AnimatePresence>
          {showClose && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className={`absolute top-3 right-3 p-2 rounded-full ${themes[activeTheme].iconButton} ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors z-[60] backdrop-blur-md cursor-pointer`}
            >
              <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        <div className="p-5 sm:p-8 relative z-10 flex flex-col items-center text-center max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 sm:mb-4 transform rotate-3 shrink-0">
            <ThemeIcon icon="Crown" theme={activeTheme} className="w-7 h-7 text-white" />
          </div>
          
          <h2 className={`text-lg sm:text-xl font-black ${themes[activeTheme].textPrimary} mb-1 sm:mb-2`}>
            {user ? (
              <>Upgrade to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">Premium</span></>
            ) : (
              <>Sign In to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">Continue</span></>
            )}
          </h2>
          <p className={`text-[10px] sm:text-xs ${themes[activeTheme].textSecondary} mb-4`}>
            {user 
              ? "Unlock the ultimate learning experience and supercharge your exam preparation."
              : "You've reached your free limit. Sign in to unlock more questions and track your progress."}
          </p>

          <div className="w-full mb-4 sm:mb-6">
            <h3 className={`text-xs sm:text-sm font-black ${themes[activeTheme].textPrimary} uppercase tracking-widest mb-2 sm:mb-4`}>Compare Plans</h3>
            <div className={`${themes[activeTheme].profileBg} rounded-xl sm:rounded-2xl border ${themes[activeTheme].border} overflow-hidden`}>
              <table className="w-full text-left text-[10px] sm:text-xs">
                <thead>
                  <tr className={`border-b ${themes[activeTheme].border}`}>
                    <th className={`p-2 sm:p-3 font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest`}>Feature</th>
                    <th className={`p-2 sm:p-3 font-black ${themes[activeTheme].textSecondary} uppercase tracking-widest text-center`}>Free</th>
                    <th className="p-2 sm:p-3 font-black text-amber-500 uppercase tracking-widest text-center bg-amber-500/10">Pro</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${themes[activeTheme].border.replace('border-', 'divide-')}`}>
                  <tr>
                    <td className={`p-2 sm:p-3 font-medium ${themes[activeTheme].textPrimary}`}>Daily Hints</td>
                    <td className={`p-2 sm:p-3 text-center ${themes[activeTheme].textSecondary} font-bold`}>2</td>
                    <td className="p-2 sm:p-3 text-center text-amber-500 font-bold bg-amber-500/5">5</td>
                  </tr>
                  <tr>
                    <td className={`p-2 sm:p-3 font-medium ${themes[activeTheme].textPrimary}`}>App Themes</td>
                    <td className={`p-2 sm:p-3 text-center ${themes[activeTheme].textSecondary}`}>2</td>
                    <td className="p-2 sm:p-3 text-center text-amber-500 font-bold bg-amber-500/5">4</td>
                  </tr>
                  <tr>
                    <td className={`p-2 sm:p-3 font-medium ${themes[activeTheme].textPrimary}`}>Verified Tag</td>
                    <td className={`p-2 sm:p-3 text-center ${themes[activeTheme].textSecondary}`}><ThemeIcon icon="X" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 mx-auto opacity-50" /></td>
                    <td className="p-2 sm:p-3 text-center text-amber-500 bg-amber-500/5"><ThemeIcon icon="CheckCircle2" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className={`p-2 sm:p-3 font-medium ${themes[activeTheme].textPrimary}`}>Ad-Free Experience</td>
                    <td className={`p-2 sm:p-3 text-center ${themes[activeTheme].textSecondary}`}><ThemeIcon icon="X" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 mx-auto opacity-50" /></td>
                    <td className="p-2 sm:p-3 text-center text-amber-500 bg-amber-500/5"><ThemeIcon icon="CheckCircle2" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {step === 1 ? (
            <div className="w-full space-y-3 shrink-0">
              <div className="space-y-2 mb-4">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id as PremiumPlan)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedPlan === plan.id ? 'border-amber-500 bg-amber-500/10' : `${themes[activeTheme].border} bg-transparent hover:border-amber-500/50`}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-black text-sm sm:text-base ${selectedPlan === plan.id ? 'text-amber-500' : themes[activeTheme].textPrimary}`}>{plan.name}</span>
                      <span className={`font-black text-sm sm:text-base ${selectedPlan === plan.id ? 'text-amber-500' : themes[activeTheme].textPrimary}`}>{plan.price} EGP</span>
                    </div>
                    <p className={`text-[10px] sm:text-xs ${themes[activeTheme].textSecondary}`}>{plan.desc}</p>
                  </button>
                ))}
              </div>
              
              <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 mb-4 text-left">
                <p className={`text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1`}>
                  <ThemeIcon icon="Star" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4" />
                  All Packs Include:
                </p>
                <ul className={`text-[9px] sm:text-[10px] ${themes[activeTheme].textPrimary} list-disc list-inside ml-1`}>
                  <li>No Ads</li>
                  <li>4 App Themes (instead of 2)</li>
                  <li>Verified tag next to name</li>
                  <li>5 Hints per day (instead of 2)</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  if (user) {
                    setStep(2);
                  } else {
                    window.dispatchEvent(new CustomEvent('openAuthModal'));
                    onClose();
                  }
                }}
                disabled={isRequested}
                className={`w-full py-4 ${isRequested ? 'bg-green-500' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'} text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center shrink-0`}
              >
                {user ? (
                  isRequested ? (
                    <>
                      Request Sent!
                      <ThemeIcon icon="CheckCircle2" theme={activeTheme} className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Get {plans.find(p => p.id === selectedPlan)?.name}
                      <ThemeIcon icon="Sparkles" theme={activeTheme} className="w-4 h-4 ml-2" />
                    </>
                  )
                ) : (
                  <>
                    Sign In Now
                    <ThemeIcon icon="LogOut" theme={activeTheme} className="w-4 h-4 ml-2 rotate-180" />
                  </>
                )}
              </button>
              <p className={`text-[10px] ${themes[activeTheme].textSecondary} font-medium uppercase tracking-wider`}>
                One-time payment. No subscription.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-3 sm:space-y-4 mb-4 sm:mb-6 text-left">
              <h3 className={`text-xs sm:text-sm font-black ${themes[activeTheme].textPrimary} uppercase tracking-widest mb-1 sm:mb-2 text-center`}>Payment Instructions</h3>
              <p className={`text-[10px] sm:text-xs ${themes[activeTheme].textSecondary} mb-3 sm:mb-4 text-center`}>
                Please send exactly <span className="font-bold text-amber-500">{prices[selectedPlan]} EGP</span> using one of the methods below.
              </p>

              <div className={`${themes[activeTheme].card} p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${themes[activeTheme].border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-[10px] sm:text-xs">IP</span>
                  </div>
                  <span className={`font-bold text-xs sm:text-sm ${themes[activeTheme].textPrimary}`}>Instapay</span>
                </div>
                <p className={`text-xs sm:text-sm font-mono bg-black/5 dark:bg-white/5 p-2 rounded-lg text-center ${themes[activeTheme].textPrimary}`}>01147032327</p>
              </div>

              <div className={`${themes[activeTheme].card} p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${themes[activeTheme].border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-[10px] sm:text-xs">T</span>
                  </div>
                  <span className={`font-bold text-xs sm:text-sm ${themes[activeTheme].textPrimary}`}>Telda</span>
                </div>
                <p className={`text-xs sm:text-sm font-mono bg-black/5 dark:bg-white/5 p-2 rounded-lg text-center ${themes[activeTheme].textPrimary}`}>@zaineld</p>
              </div>

              <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50`}>
                <p className={`text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1`}>
                  <ThemeIcon icon="AlertCircle" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4" />
                  IMPORTANT
                </p>
                <p className={`text-[9px] sm:text-[10px] ${themes[activeTheme].textPrimary}`}>
                  You MUST include your username (<span className="font-bold">{user?.username}</span>) AND "<span className="font-bold">{plans.find(p => p.id === selectedPlan)?.name}</span>" in the payment note/reason.
                </p>
              </div>
              
              <p className={`text-[9px] sm:text-[10px] text-center ${themes[activeTheme].textSecondary} font-medium`}>
                Max 12 hour delivery time after payment confirmation.
              </p>

              <div className="w-full space-y-2 sm:space-y-3 shrink-0 mt-3 sm:mt-4">
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className={`w-full py-3 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center shrink-0`}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      I have completed the payment
                      <ThemeIcon icon="Check" theme={activeTheme} className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className={`w-full py-2 sm:py-3 ${themes[activeTheme].badgeSecondary} rounded-lg sm:rounded-xl font-bold uppercase tracking-widest text-[10px] sm:text-xs transition-colors`}
                >
                  Back
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 w-full text-left shrink-0">
            <h4 className={`text-[10px] font-black ${themes[activeTheme].textPrimary} uppercase tracking-widest mb-1 flex items-center gap-1`}>
              <ThemeIcon icon="Shield" theme={activeTheme} className="w-3 h-3 text-emerald-500" />
              Refund Policy
            </h4>
            <p className={`text-[8px] sm:text-[9px] ${themes[activeTheme].textSecondary} leading-relaxed`}>
              Under the Egyptian Consumer Protection Law (Law No. 181 of 2018), consumers have the right to request a refund or exchange within 14 days of purchase without providing a reason, provided the service is unused. In the event of a defect, this period is extended to 30 days.
            </p>
          </div>

          {!showClose && step === 1 && (
            <p className={`text-[10px] ${themes[activeTheme].textSecondary} mt-3 animate-pulse shrink-0`}>
              You can close this in a few seconds...
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
