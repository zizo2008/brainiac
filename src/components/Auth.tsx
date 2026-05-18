import React, { useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { createUserProfile, getUserProfile } from '../services/db';
import { ThemeIcon } from './ThemeIcon';
import { ThemeName, themes } from '../theme';

interface AuthProps {
  onLogin: () => void;
  onGuest: () => void;
  onClose?: () => void;
  activeTheme: ThemeName;
}

export default function Auth({ onLogin, onGuest, onClose, activeTheme }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if profile exists
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        // Create default profile for new Google users
        const defaultUsername = user.displayName || user.email?.split('@')[0] || 'User';
        await createUserProfile(user.uid, defaultUsername, role);
      }
      onLogin();
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Login popup was closed before completing.');
      } else {
        setError(err.message || 'Failed to login with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        onLogin();
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile(userCredential.user.uid, username, role);
        onLogin();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let friendlyMsg = err.message;
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        friendlyMsg = "Invalid email or password. Please try again.";
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMsg = "This email is already registered. Try signing in instead.";
      } else if (err.code === 'auth/weak-password') {
        friendlyMsg = "Password is too weak. Please use at least 6 characters.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = "Please enter a valid email address.";
      } else if (err.code === 'auth/network-request-failed') {
        friendlyMsg = "Network error. Please check your internet connection.";
      } else if (err.code === 'auth/too-many-requests') {
        friendlyMsg = "Too many failed attempts. Please try again later.";
      } else if (err.code === 'auth/unauthorized-domain') {
        friendlyMsg = "This domain is not authorized. Please add it to Firebase Console.";
      }
      
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${themes[activeTheme].modalBackdrop || 'bg-black/80 backdrop-blur-sm'} overflow-hidden`}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`relative max-w-md w-full ${themes[activeTheme].card} rounded-3xl shadow-xl p-8 border ${themes[activeTheme].border} z-10 max-h-[90vh] overflow-y-auto custom-scrollbar`}>
        {onClose && (
          <button onClick={onClose} className={`absolute top-4 right-4 p-2 rounded-xl ${themes[activeTheme].iconButton}`}>
            <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5" />
          </button>
        )}
        <h2 className={`text-3xl font-bold text-center ${themes[activeTheme].textPrimary} mb-8 mt-2`}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error && (
          <div className={`${themes[activeTheme].errorBg} ${themes[activeTheme].errorText} p-4 rounded-xl mb-6 text-sm font-bold flex items-center gap-2`}>
            <div className={`w-1.5 h-1.5 rounded-full ${themes[activeTheme].errorBg.replace('bg-', 'bg-')}`}></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] ${themes[activeTheme].textSecondary} mb-2`}>Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-2xl border ${themes[activeTheme].input} outline-none font-bold transition-all`}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] ${themes[activeTheme].textSecondary} mb-2`}>I am a...</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex-1 py-3.5 rounded-2xl border font-black uppercase tracking-widest text-xs transition-all ${role === 'student' ? `${themes[activeTheme].accentBg} text-white border-transparent` : `${themes[activeTheme].card} ${themes[activeTheme].textSecondary} ${themes[activeTheme].border}`}`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`flex-1 py-3.5 rounded-2xl border font-black uppercase tracking-widest text-xs transition-all ${role === 'teacher' ? `${themes[activeTheme].accentBg} text-white border-transparent` : `${themes[activeTheme].card} ${themes[activeTheme].textSecondary} ${themes[activeTheme].border}`}`}
                  >
                    Teacher
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-[0.2em] ${themes[activeTheme].textSecondary} mb-2`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3.5 rounded-2xl border ${themes[activeTheme].input} outline-none font-bold transition-all`}
            />
          </div>

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-[0.2em] ${themes[activeTheme].textSecondary} mb-2`}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3.5 rounded-2xl border ${themes[activeTheme].input} outline-none font-bold transition-all pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 ${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors`}
              >
                {showPassword ? <ThemeIcon icon="EyeOff" theme={activeTheme} className="w-5 h-5" /> : <ThemeIcon icon="Eye" theme={activeTheme} className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 ${themes[activeTheme].accentBg} text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 mt-6`}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full py-3.5 ${themes[activeTheme].card} ${themes[activeTheme].textPrimary} border ${themes[activeTheme].border} rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:opacity-80 disabled:opacity-50`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="mt-8 text-center space-y-6">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className={`${themes[activeTheme].accent} font-bold hover:underline block w-full text-sm`}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
          
          <div className="relative flex items-center py-2">
            <div className={`flex-grow border-t ${themes[activeTheme].border}`}></div>
            <span className={`flex-shrink-0 mx-4 ${themes[activeTheme].textSecondary} text-[10px] font-black uppercase tracking-widest`}>or</span>
            <div className={`flex-grow border-t ${themes[activeTheme].border}`}></div>
          </div>
          
          <button
            onClick={onGuest}
            className={`${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} font-bold uppercase tracking-widest text-xs transition-colors`}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
