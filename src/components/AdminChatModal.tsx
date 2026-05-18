import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { SupportMessage } from '../types';
import { ThemeIcon } from './ThemeIcon';
import { ThemeName, themes } from '../theme';

interface Props {
  chatUser: any;
  onClose: () => void;
  activeTheme: ThemeName;
}

export default function AdminChatModal({ chatUser, onClose, activeTheme }: Props) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatUser) return;

    // Mark as read
    if (chatUser.unreadAdmin) {
      updateDoc(doc(db, 'support_chats', chatUser.id), { unreadAdmin: false }).catch(console.error);
    }

    const q = query(
      collection(db, `support_chats/${chatUser.id}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: SupportMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as SupportMessage);
      });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [chatUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, `support_chats/${chatUser.id}/messages`), {
        userId: chatUser.id,
        username: 'Admin',
        text,
        timestamp: Date.now(),
        isAdmin: true,
        read: false
      });
      
      await updateDoc(doc(db, 'support_chats', chatUser.id), {
        lastMessage: text,
        lastMessageTime: Date.now(),
        unreadAdmin: false
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className={`fixed inset-0 ${themes[activeTheme].modalBackdrop} backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`${themes[activeTheme].card} rounded-2xl sm:rounded-3xl shadow-2xl border ${themes[activeTheme].border} w-full max-w-lg h-[500px] sm:h-[600px] max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden`}
      >
        <div className={`p-3 sm:p-4 border-b ${themes[activeTheme].border} flex items-center justify-between ${themes[activeTheme].accentBg}`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
              <ThemeIcon icon="User" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-sm sm:text-base ${themes[activeTheme].textPrimary}`}>{chatUser.username}</h3>
              <p className={`text-[10px] sm:text-xs ${themes[activeTheme].textSecondary}`}>Support Chat</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 sm:p-2 rounded-full ${themes[activeTheme].iconButton} ${themes[activeTheme].textSecondary}`}
          >
            <ThemeIcon icon="X" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar ${themes[activeTheme].wrapper}`}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${!msg.isAdmin ? 'items-start' : 'items-end'}`}>
              <div className={`max-w-[85%] sm:max-w-[80%] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl ${
                !msg.isAdmin 
                  ? `${themes[activeTheme].card} border ${themes[activeTheme].border} rounded-tl-sm` 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-tr-sm'
              }`}>
                <p className="text-xs sm:text-sm break-words">{msg.text}</p>
              </div>
              <span className={`text-[8px] sm:text-[10px] mt-1 ${themes[activeTheme].textSecondary}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className={`p-2 sm:p-3 border-t ${themes[activeTheme].border} ${themes[activeTheme].card}`}>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a reply..."
              className={`flex-1 bg-transparent border ${themes[activeTheme].border} rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm ${themes[activeTheme].textPrimary} focus:outline-none focus:border-blue-500`}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className={`p-1.5 sm:p-2 rounded-full bg-blue-500 text-white disabled:opacity-50 transition-opacity`}
            >
              <ThemeIcon icon="Send" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
