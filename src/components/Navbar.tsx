import React from 'react';
import { ThemeIcon } from './ThemeIcon';
import { UserProfile } from '../types';
import { isGlobalPremium } from '../utils/premium';

import { ThemeName, themes } from '../theme';

interface Props {
  userProfile: UserProfile | null;
  onOpenProfile: () => void;
  onOpenFriendHub: () => void;
  onBack: () => void;
  showBack: boolean;
  activeTheme: ThemeName;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  isAdminUnlocked?: boolean;
  onOpenAdmin?: () => void;
}

export default function Navbar({ userProfile, onOpenProfile, onOpenFriendHub, onBack, showBack, activeTheme, isDarkMode, setIsDarkMode, isAdminUnlocked, onOpenAdmin }: Props) {
  return (
    <nav className={`fixed top-0 left-0 right-0 ${themes[activeTheme].nav} z-[60] h-16 px-4 sm:px-8 flex items-center justify-between shadow-md`}>
      <div className="flex items-center">
        {showBack && (
          <button 
            onClick={onBack}
            className={`p-2 rounded-xl transition-colors mr-2 ${themes[activeTheme].navIcon}`}
          >
            <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-6 h-6" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className={`${themes[activeTheme].navLogoBg} p-1.5 rounded-lg`}>
            <ThemeIcon icon="BrainCircuit" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].navLogoIcon}`} />
          </div>
          <span className={`text-xl font-black ${themes[activeTheme].navText} tracking-tighter uppercase`}>Brainiac</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {!isGlobalPremium(userProfile) && (
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl transition-colors relative ${themes[activeTheme].navIcon}`}
            title="Toggle dark mode"
          >
            {isDarkMode ? <ThemeIcon icon="Sun" theme={activeTheme} className="w-6 h-6" /> : <ThemeIcon icon="Moon" theme={activeTheme} className="w-6 h-6" />}
          </button>
        )}
        {isAdminUnlocked && (
          <button 
            onClick={onOpenAdmin || (() => window.dispatchEvent(new CustomEvent('adminUnlocked')))}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors bg-red-500 text-white hover:bg-red-600`}
            title="Admin Dashboard"
          >
            Admin
          </button>
        )}
        {userProfile?.role !== 'teacher' && (
          <button 
            onClick={onOpenFriendHub}
            className={`p-2 rounded-xl transition-colors relative ${themes[activeTheme].navIcon}`}
            title="Friend Hub"
          >
            <ThemeIcon icon="Users" theme={activeTheme} className="w-6 h-6" />
            <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 ${themes[activeTheme].errorBg} border-2 ${themes[activeTheme].nav} rounded-full`}></div>
          </button>
        )}
        
        {!isGlobalPremium(userProfile) && (
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('openPremiumModal'))}
            className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 group relative ${themes[activeTheme].navIcon}`}
            title="Get Premium"
          >
            <ThemeIcon icon="Crown" theme={activeTheme} className="w-6 h-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_#fbbf24]"></div>
          </button>
        )}

        <button 
          onClick={onOpenProfile}
          className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-colors border ${themes[activeTheme].border} ${themes[activeTheme].navIcon}`}
        >
          {userProfile?.photoURL ? (
            <img 
              src={userProfile.photoURL} 
              alt={userProfile.username} 
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-8 h-8 rounded-full ${themes[activeTheme].profileBg} flex items-center justify-center ${themes[activeTheme].profileIcon} font-bold text-sm`}>
              {userProfile?.username?.charAt(0).toUpperCase() || <ThemeIcon icon="User" theme={activeTheme} className="w-4 h-4" />}
            </div>
          )}
          <span className={`hidden sm:block text-sm font-bold ${themes[activeTheme].navText} truncate max-w-[100px]`}>
            {userProfile?.username || 'Profile'}
          </span>
        </button>
      </div>
    </nav>
  );
}
