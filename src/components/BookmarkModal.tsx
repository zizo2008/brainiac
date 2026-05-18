import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ThemeIcon } from './ThemeIcon';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { QuestionFolder, createFolder, saveQuestion } from '../services/db';

import { ThemeName, themes } from '../theme';

interface BookmarkModalProps {
  subject: string;
  questionData: any;
  onClose: () => void;
  activeTheme: ThemeName;
}

export default function BookmarkModal({ subject, questionData, onClose, activeTheme }: BookmarkModalProps) {
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFolders();
  }, [subject]);

  const loadFolders = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'folders'),
        where('userId', '==', auth.currentUser.uid),
        where('subject', '==', subject)
      );
      const snapshot = await getDocs(q);
      const loadedFolders = snapshot.docs.map(doc => doc.data() as QuestionFolder);
      
      // Sort in memory to avoid requiring a composite index in Firestore
      loadedFolders.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      
      setFolders(loadedFolders);
    } catch (error) {
      console.error("Error loading folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!auth.currentUser || !newFolderName.trim()) return;
    await createFolder(auth.currentUser.uid, newFolderName.trim(), subject);
    setNewFolderName('');
    setShowCreateFolder(false);
    loadFolders();
  };

  const handleSaveToFolder = async (folderId: string) => {
    if (!auth.currentUser || saving) return;
    setSaving(true);
    try {
      await saveQuestion(auth.currentUser.uid, folderId, {
        subject,
        examCode: questionData.examCode,
        examIndex: questionData.examIndex,
        qNumber: questionData.qNumber,
        pageIndex: questionData.pageIndex,
        startY: questionData.startY,
        endY: questionData.endY,
        answer: questionData.answer
      });
      onClose();
    } catch (error) {
      console.error("Error saving question:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${themes[activeTheme].modalBackdrop} flex items-center justify-center z-50 p-4`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`${themes[activeTheme].card} rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-md overflow-hidden border ${themes[activeTheme].border}`}
      >
        <div className={`p-4 sm:p-6 border-b ${themes[activeTheme].border} flex justify-between items-center`}>
          <h3 className={`text-base sm:text-lg font-black uppercase tracking-tight ${themes[activeTheme].textPrimary} flex items-center`}>
            <ThemeIcon icon="Bookmark" theme={activeTheme} className={`w-5 h-5 mr-2 ${themes[activeTheme].accent}`} />
            Save to Vault
          </h3>
          <button onClick={onClose} className={`${themes[activeTheme].textSecondary} hover:${themes[activeTheme].textPrimary} transition-colors p-2 -mr-2`}>
            <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${themes[activeTheme].accent}`}></div>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => handleSaveToFolder(folder.id)}
                  disabled={saving}
                  className={`w-full flex items-center p-3 sm:p-4 rounded-xl border ${themes[activeTheme].border} hover:${themes[activeTheme].border} hover:${themes[activeTheme].iconContainer} transition-all text-left disabled:opacity-50`}
                >
                  <ThemeIcon icon="Folder" theme={activeTheme} className={`w-5 h-5 sm:w-6 sm:h-6 ${themes[activeTheme].accent} mr-3`} />
                  <span className={`font-bold text-sm sm:text-base ${themes[activeTheme].textPrimary}`}>{folder.name}</span>
                </button>
              ))}

              {folders.length === 0 && !showCreateFolder && (
                <p className={`text-center text-xs sm:text-sm font-bold uppercase tracking-widest ${themes[activeTheme].textSecondary} py-4`}>
                  No folders yet. Create one to save this question.
                </p>
              )}

              {showCreateFolder ? (
                <div className={`mt-4 p-3 sm:p-4 ${themes[activeTheme].card} rounded-xl border ${themes[activeTheme].border}`}>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder Name"
                    className={`w-full bg-transparent border-2 ${themes[activeTheme].border} rounded-xl px-3 sm:px-4 py-2 sm:py-3 font-bold focus:outline-none focus:border-indigo-500 transition-colors text-sm sm:text-base mb-3`}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                      className={`flex-1 py-2 sm:py-3 rounded-xl font-black uppercase tracking-widest text-xs sm:text-sm ${themes[activeTheme].badgeSecondary}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || saving}
                      className={`flex-1 py-2 sm:py-3 rounded-xl font-black uppercase tracking-widest text-xs sm:text-sm ${themes[activeTheme].accentBg} disabled:opacity-50`}
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className={`w-full flex items-center justify-center p-3 sm:p-4 rounded-xl border-2 border-dashed ${themes[activeTheme].border} hover:${themes[activeTheme].border} hover:${themes[activeTheme].iconContainer} transition-all ${themes[activeTheme].accent} font-black uppercase tracking-widest text-xs sm:text-sm mt-4`}
                >
                  <ThemeIcon icon="Plus" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Create New Folder
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
