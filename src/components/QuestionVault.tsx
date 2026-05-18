import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ThemeIcon } from './ThemeIcon';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { QuestionFolder, SavedQuestion, createFolder, deleteSavedQuestion } from '../services/db';

import { ThemeName, themes } from '../theme';

interface QuestionVaultProps {
  subject: string;
  onSelectQuestion: (question: SavedQuestion) => void;
  activeTheme: ThemeName;
}

export default function QuestionVault({ subject, onSelectQuestion, activeTheme }: QuestionVaultProps) {
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<QuestionFolder | null>(null);
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'folder' | 'question', id: string } | null>(null);

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

  const loadQuestions = async (folderId: string) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'savedQuestions'),
        where('userId', '==', auth.currentUser.uid),
        where('folderId', '==', folderId)
      );
      const snapshot = await getDocs(q);
      const loadedQuestions = snapshot.docs.map(doc => doc.data() as SavedQuestion);
      
      // Sort in memory to avoid requiring a composite index in Firestore
      loadedQuestions.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      
      setQuestions(loadedQuestions);
    } catch (error) {
      console.error("Error loading questions:", error);
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

  const handleSelectFolder = (folder: QuestionFolder) => {
    setSelectedFolder(folder);
    loadQuestions(folder.id);
  };

  const handleDeleteQuestion = async (e: React.MouseEvent, questionId: string) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'question', id: questionId });
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'folder', id: folderId });
  };

  const confirmDeletion = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'question') {
      await deleteSavedQuestion(confirmDelete.id);
      if (selectedFolder) {
        loadQuestions(selectedFolder.id);
      }
    } else if (confirmDelete.type === 'folder') {
      // First delete all questions in the folder
      const q = query(collection(db, 'savedQuestions'), where('folderId', '==', confirmDelete.id));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Then delete the folder
      await deleteDoc(doc(db, 'folders', confirmDelete.id));
      loadFolders();
    }
    setConfirmDelete(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${themes[activeTheme].accent}`}></div>
      </div>
    );
  }

  if (selectedFolder) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center mb-6">
          <button 
            onClick={() => setSelectedFolder(null)}
            className={`p-2 mr-3 rounded-full ${themes[activeTheme].iconButton} transition-colors`}
          >
            <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-5 h-5" />
          </button>
          <h3 className={`text-xl font-bold ${themes[activeTheme].textPrimary} flex items-center`}>
            <ThemeIcon icon="Folder" theme={activeTheme} className={`w-5 h-5 mr-2 ${themes[activeTheme].accent}`} />
            {selectedFolder.name}
          </h3>
        </div>

        {questions.length === 0 ? (
          <div className={`text-center py-12 ${themes[activeTheme].card} rounded-2xl border ${themes[activeTheme].border}`}>
            <ThemeIcon icon="FileText" theme={activeTheme} className={`w-12 h-12 mx-auto ${themes[activeTheme].textSecondary} mb-3`} />
            <p className={`${themes[activeTheme].textSecondary}`}>No questions saved in this folder yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {questions.map((q, index) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectQuestion(q)}
                className={`${themes[activeTheme].card} p-4 rounded-xl border ${themes[activeTheme].border} hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group flex justify-between items-center`}
              >
                <div>
                  <h4 className={`font-semibold ${themes[activeTheme].textPrimary} mb-1`}>
                    Question {q.qNumber}
                  </h4>
                  <p className={`text-xs ${themes[activeTheme].textSecondary}`}>
                    Exam Code: {q.examCode} • Page {q.pageIndex + 1}
                  </p>
                </div>
                <button 
                  onClick={(e) => handleDeleteQuestion(e, q.id)}
                  className={`p-2 ${themes[activeTheme].iconButton} opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all`}
                >
                  <ThemeIcon icon="Trash2" theme={activeTheme} className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-lg font-bold ${themes[activeTheme].textPrimary}`}>Your Folders</h3>
        <button 
          onClick={() => setShowCreateFolder(true)}
          className={`flex items-center text-sm font-medium ${themes[activeTheme].accent} hover:opacity-80 ${themes[activeTheme].iconContainer} px-3 py-1.5 rounded-lg transition-colors`}
        >
          <ThemeIcon icon="Plus" theme={activeTheme} className="w-4 h-4 mr-1" /> New Folder
        </button>
      </div>

      {showCreateFolder && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`mb-6 ${themes[activeTheme].card} p-4 rounded-xl border ${themes[activeTheme].border}`}
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name"
              className={`flex-1 ${themes[activeTheme].input} rounded-lg px-3 py-2 text-sm focus:outline-none`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <button 
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className={`${themes[activeTheme].accentBg} hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors`}
            >
              Create
            </button>
            <button 
              onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
              className={`${themes[activeTheme].iconContainer} ${themes[activeTheme].textPrimary} px-4 py-2 rounded-lg text-sm font-medium transition-colors`}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {folders.length === 0 && !showCreateFolder ? (
        <div className={`text-center py-12 ${themes[activeTheme].card} rounded-2xl border ${themes[activeTheme].border}`}>
          <ThemeIcon icon="Folder" theme={activeTheme} className={`w-12 h-12 mx-auto ${themes[activeTheme].textSecondary} mb-3`} />
          <p className={`${themes[activeTheme].textSecondary} mb-4`}>No folders created yet.</p>
          <button 
            onClick={() => setShowCreateFolder(true)}
            className={`inline-flex items-center text-sm font-medium text-white ${themes[activeTheme].accentBg} hover:opacity-90 px-4 py-2 rounded-lg transition-colors`}
          >
            <ThemeIcon icon="Plus" theme={activeTheme} className="w-4 h-4 mr-1" /> Create Your First Folder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {folders.map((folder, index) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelectFolder(folder)}
              className={`${themes[activeTheme].card} p-4 rounded-xl border ${themes[activeTheme].border} hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-lg ${themes[activeTheme].iconContainer} flex items-center justify-center mr-3 transition-colors`}>
                  <ThemeIcon icon="Folder" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].accent}`} />
                </div>
                <div>
                  <h4 className={`font-semibold ${themes[activeTheme].textPrimary}`}>{folder.name}</h4>
                </div>
              </div>
              <div className="flex items-center">
                <button 
                  onClick={(e) => handleDeleteFolder(e, folder.id)}
                  className={`p-2 mr-2 ${themes[activeTheme].iconButton} opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all`}
                >
                  <ThemeIcon icon="Trash2" theme={activeTheme} className="w-4 h-4" />
                </button>
                <ThemeIcon icon="ChevronRight" theme={activeTheme} className={`w-5 h-5 ${themes[activeTheme].textSecondary} group-hover:${themes[activeTheme].accent} transition-colors`} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${themes[activeTheme].card} rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border ${themes[activeTheme].border} p-6`}
          >
            <h3 className={`text-lg font-bold ${themes[activeTheme].textPrimary} mb-2`}>Confirm Deletion</h3>
            <p className={`${themes[activeTheme].textSecondary} mb-6`}>
              {confirmDelete.type === 'folder' 
                ? 'Are you sure you want to delete this folder and all its questions? This action cannot be undone.'
                : 'Are you sure you want to delete this saved question? This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className={`px-4 py-2 ${themes[activeTheme].iconContainer} ${themes[activeTheme].textPrimary} rounded-lg font-medium transition-colors`}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeletion}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
