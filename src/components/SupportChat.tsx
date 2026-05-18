import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, SupportMessage } from '../types';
import { ThemeIcon } from './ThemeIcon';
import { ThemeName, themes } from '../theme';

interface Props {
  user: UserProfile;
  activeTheme: ThemeName;
}

export default function SupportChat({ user, activeTheme }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Check if any admins are online (we can approximate by checking if any admin has been active recently, 
    // but for now we'll just simulate it or check a global status. Let's just say false by default to show the message)
    const checkAdminStatus = async () => {
      // In a real app we'd check presence, but for now let's just set it to false so the message shows
      setAdminOnline(false);
    };
    checkAdminStatus();

    const q = query(
      collection(db, `support_chats/${user.uid}/messages`),
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
  }, [isOpen, user.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, `support_chats/${user.uid}/messages`), {
        userId: user.uid,
        username: user.username,
        text,
        timestamp: Date.now(),
        isAdmin: false,
        read: false
      });
      
      // Update the chat metadata
      await updateDoc(doc(db, 'support_chats', user.uid), {
        lastMessage: text,
        lastMessageTime: Date.now(),
        userId: user.uid,
        username: user.username,
        unreadAdmin: true
      }).catch(async () => {
        // If it doesn't exist, create it
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'support_chats', user.uid), {
          lastMessage: text,
          lastMessageTime: Date.now(),
          userId: user.uid,
          username: user.username,
          unreadAdmin: true
        });
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-transform`}
      >
        <ThemeIcon icon="MessageCircle" theme={activeTheme} className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] max-h-[70vh] ${themes[activeTheme].card} border ${themes[activeTheme].border} rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden`}
          >
            <div className={`p-4 border-b ${themes[activeTheme].border} flex items-center justify-between ${themes[activeTheme].accentBg}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <ThemeIcon icon="Headset" theme={activeTheme} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold ${themes[activeTheme].textPrimary}`}>Support Chat</h3>
                  <p className={`text-xs ${adminOnline ? 'text-green-500' : themes[activeTheme].textSecondary}`}>
                    {adminOnline ? 'Admin Online' : 'Admins Offline'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className={`p-2 rounded-full ${themes[activeTheme].iconButton} ${themes[activeTheme].textSecondary}`}
              >
                <ThemeIcon icon="X" theme={activeTheme} className="w-5 h-5" />
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${themes[activeTheme].wrapper}`}>
              {!adminOnline && messages.length === 0 && (
                <div className={`p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-xs ${themes[activeTheme].textPrimary}`}>
                  All agents are helping other people. Either send a message now or wait till they are available.
                </div>
              )}
              
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isAdmin ? 'items-start' : 'items-end'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.isAdmin 
                      ? `${themes[activeTheme].card} border ${themes[activeTheme].border} rounded-tl-sm` 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-tr-sm'
                  }`}>
                    <p className="text-sm break-words">{msg.text}</p>
                  </div>
                  <span className={`text-[10px] mt-1 ${themes[activeTheme].textSecondary}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className={`p-3 border-t ${themes[activeTheme].border} ${themes[activeTheme].card}`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className={`flex-1 bg-transparent border ${themes[activeTheme].border} rounded-full px-4 py-2 text-sm ${themes[activeTheme].textPrimary} focus:outline-none focus:border-blue-500`}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`p-2 rounded-full bg-blue-500 text-white disabled:opacity-50 transition-opacity`}
                >
                  <ThemeIcon icon="Send" theme={activeTheme} className="w-5 h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
