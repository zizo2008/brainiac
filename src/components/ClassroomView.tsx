import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Classroom, Assignment, Post, Reply, UserProfile } from '../types';
import { createAssignment, createPost, createReply } from '../services/db';
import { ThemeIcon } from './ThemeIcon';
import Leaderboard from './Leaderboard';
import { motion } from 'motion/react';

import { ThemeName, themes } from '../theme';

interface Props {
  classroomId: string;
  userRole: 'teacher' | 'student';
  activeTheme: ThemeName;
  onBack: () => void;
  onStartAssignment: (subject: string, count: number, assignId: string, stats?: {total: number, correct: number}, askedQuestionIds?: string[]) => void;
}

export default function ClassroomView({ classroomId, userRole, activeTheme, onBack, onStartAssignment }: Props) {
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  
  const [newPostContent, setNewPostContent] = useState('');
  const [replyContents, setReplyContents] = useState<Record<string, string>>({});
  
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [assignSubject, setAssignSubject] = useState('chemistry');
  const [assignCount, setAssignCount] = useState(10);
  const [assignName, setAssignName] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [users, setUsers] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    fetchClassroom();
    
    const postsQ = query(collection(db, 'posts'), where('classroomId', '==', classroomId));
    const unsubPosts = onSnapshot(postsQ, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(d => d.data() as Post).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPosts(fetchedPosts);
      
      fetchedPosts.forEach(p => fetchUser(p.authorId));
    }, (error) => {
      console.error("Error fetching posts:", error);
    });

    const assignQ = query(collection(db, 'assignments'), where('classroomId', '==', classroomId));
    const unsubAssign = onSnapshot(assignQ, (snapshot) => {
      setAssignments(snapshot.docs.map(d => d.data() as Assignment).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      console.error("Error fetching assignments:", error);
    });

    const compQ = query(collection(db, 'assignmentCompletions'), where('classroomId', '==', classroomId));
    const unsubComp = onSnapshot(compQ, (snapshot) => {
      setCompletions(snapshot.docs.map(d => d.data()));
    }, (error) => {
      console.error("Error fetching completions:", error);
    });

    return () => {
      unsubPosts();
      unsubAssign();
      unsubComp();
    };
  }, [classroomId]);

  useEffect(() => {
    if (classroom?.studentIds) {
      classroom.studentIds.forEach(id => fetchUser(id));
    }
  }, [classroom]);

  useEffect(() => {
    posts.forEach(post => {
      const repliesQ = query(collection(db, 'replies'), where('postId', '==', post.id));
      onSnapshot(repliesQ, (snapshot) => {
        const fetchedReplies = snapshot.docs.map(d => d.data() as Reply).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setReplies(prev => ({ ...prev, [post.id]: fetchedReplies }));
        fetchedReplies.forEach(r => fetchUser(r.authorId));
      }, (error) => {
        console.error("Error fetching replies:", error);
      });
    });
  }, [posts]);

  const fetchClassroom = async () => {
    const docSnap = await getDoc(doc(db, 'classrooms', classroomId));
    if (docSnap.exists()) {
      setClassroom(docSnap.data() as Classroom);
    }
  };

  const fetchUser = async (uid: string) => {
    if (users[uid]) return;
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      setUsers(prev => ({ ...prev, [uid]: docSnap.data() as UserProfile }));
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !auth.currentUser) return;
    await createPost(classroomId, auth.currentUser.uid, newPostContent);
    setNewPostContent('');
  };

  const handleCreateReply = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const content = replyContents[postId];
    if (!content?.trim() || !auth.currentUser) return;
    await createReply(postId, auth.currentUser.uid, content);
    setReplyContents(prev => ({ ...prev, [postId]: '' }));
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroom) return;
    await createAssignment(classroomId, classroom.subject || 'chemistry', assignCount, assignName, assignDeadline);
    setShowAssignModal(false);
    setAssignName('');
    setAssignDeadline('');
  };

  if (!classroom) return <div className="p-8 text-center">Loading...</div>;

  if (showLeaderboard) {
    return <Leaderboard onBack={() => setShowLeaderboard(false)} subject={classroom.subject || 'chemistry'} studentIds={classroom.studentIds} activeTheme={activeTheme} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 sm:mb-8 shrink-0">
        <div className="flex items-center min-w-0">
          <button onClick={onBack} className={`mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full transition-colors shrink-0 ${themes[activeTheme].iconButton}`}>
            <ThemeIcon icon="ArrowLeft" theme={activeTheme} className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="min-w-0 pr-2">
            <h1 className={`text-xl sm:text-3xl font-bold truncate ${themes[activeTheme].textPrimary}`}>{classroom.name}</h1>
            <p className={`font-mono text-xs sm:text-sm mt-1 ${themes[activeTheme].textSecondary}`}>Class Code: {classroom.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowLeaderboard(true)}
            className={`flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-colors text-sm font-bold ${themes[activeTheme].premiumButton}`}
          >
            <ThemeIcon icon="Trophy" theme={activeTheme} className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
          {userRole === 'teacher' && (
            <button 
              onClick={() => setShowDeleteModal(true)}
              className={`p-2 rounded-xl transition-colors ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText}`}
              title="Delete Classroom"
            >
              <ThemeIcon icon="Trash2" theme={activeTheme} className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-6 pr-2 sm:pr-4 -mr-2 sm:-mr-4 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 space-y-6">
          <h2 className={`text-2xl font-bold mb-4 ${themes[activeTheme].textPrimary}`}>Class Stream</h2>
          
          {userRole === 'teacher' && (
            <div className={`${themes[activeTheme].card} rounded-2xl p-6 shadow-sm`}>
              <form onSubmit={handleCreatePost}>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Announce something to your class..."
                  className={`w-full px-4 py-3 rounded-xl outline-none resize-none h-24 mb-3 transition-all ${themes[activeTheme].input}`}
                />
                <div className="flex justify-end">
                  <button type="submit" disabled={!newPostContent.trim()} className={`${themes[activeTheme].accentBg} disabled:opacity-50 px-6 py-2 rounded-xl font-medium transition-colors flex items-center`}>
                    <ThemeIcon icon="Send" theme={activeTheme} className="w-4 h-4 mr-2" /> Post
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-6">
            {posts.map((post, i) => (
              <motion.div 
                key={post.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`${themes[activeTheme].card} rounded-2xl p-6 shadow-sm`}
              >
                <div className="flex items-center mb-4">
                  {users[post.authorId]?.photoURL ? (
                    <img src={users[post.authorId].photoURL} alt={users[post.authorId].username} className="w-10 h-10 rounded-full mr-3 object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 ${themes[activeTheme].badge}`}>
                      {users[post.authorId]?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <div className={`font-bold ${themes[activeTheme].textPrimary}`}>{users[post.authorId]?.username || 'Teacher'}</div>
                    <div className={`text-xs ${themes[activeTheme].textSecondary}`}>{new Date(post.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <p className={`mb-6 whitespace-pre-wrap ${themes[activeTheme].textPrimary}`}>{post.content}</p>
                
                <div className={`border-t pt-4 ${themes[activeTheme].border}`}>
                  <h4 className={`text-sm font-bold mb-4 flex items-center ${themes[activeTheme].textSecondary}`}>
                    <ThemeIcon icon="MessageSquare" theme={activeTheme} className="w-4 h-4 mr-2" /> Class Comments
                  </h4>
                  
                  <div className="space-y-4 mb-4">
                    {replies[post.id]?.map(reply => (
                      <div key={reply.id} className="flex items-start">
                        {users[reply.authorId]?.photoURL ? (
                          <img src={users[reply.authorId].photoURL} alt={users[reply.authorId].username} className="w-8 h-8 rounded-full mr-3 shrink-0 object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 shrink-0 text-sm ${themes[activeTheme].badgeSecondary}`}>
                            {users[reply.authorId]?.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className={`rounded-2xl rounded-tl-none px-4 py-2 flex-1 ${themes[activeTheme].badgeSecondary}`}>
                          <div className={`font-bold text-sm ${themes[activeTheme].textPrimary}`}>{users[reply.authorId]?.username || 'Student'}</div>
                          <p className={`text-sm ${themes[activeTheme].textPrimary}`}>{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={(e) => handleCreateReply(post.id, e)} className="flex gap-2">
                    <input
                      type="text"
                      value={replyContents[post.id] || ''}
                      onChange={(e) => setReplyContents(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Add class comment..."
                      className={`flex-1 px-4 py-2 rounded-full outline-none text-sm transition-all ${themes[activeTheme].input}`}
                    />
                    <button type="submit" disabled={!replyContents[post.id]?.trim()} className={`p-2 disabled:opacity-50 rounded-full transition-colors ${themes[activeTheme].accentBg}`}>
                      <ThemeIcon icon="Send" theme={activeTheme} className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </motion.div>
            ))}
            {posts.length === 0 && (
              <div className={`text-center py-12 ${themes[activeTheme].textSecondary} ${themes[activeTheme].card} rounded-2xl`}>
                No posts yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-2xl font-bold ${themes[activeTheme].textPrimary}`}>Assignments</h2>
            {userRole === 'teacher' && (
              <button onClick={() => setShowAssignModal(true)} className={`p-2 rounded-full transition-colors ${themes[activeTheme].badge}`}>
                <ThemeIcon icon="Plus" theme={activeTheme} className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {assignments.map((assign, i) => {
              const latestCompletion = completions.find(c => c.assignmentId === assign.id && c.studentId === auth.currentUser?.uid);
              return (
              <motion.div 
                key={assign.id} 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`${themes[activeTheme].card} rounded-2xl p-5 shadow-sm`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className={`font-bold ${themes[activeTheme].textPrimary}`}>{assign.name || `${assign.subject} Quiz`}</h3>
                  <span className={`text-xs ${themes[activeTheme].textSecondary}`}>{new Date(assign.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <p className={`text-sm ${themes[activeTheme].textSecondary}`}>{assign.questionCount} Questions</p>
                  {assign.deadline && (
                    <p className={`text-xs font-medium ${new Date(assign.deadline) < new Date() ? themes[activeTheme].errorText : themes[activeTheme].textSecondary}`}>
                      Due: {new Date(assign.deadline).toLocaleString()}
                    </p>
                  )}
                </div>
                {latestCompletion ? (
                  latestCompletion.isFinished !== false ? (
                    <div className={`w-full py-2 rounded-xl font-medium flex items-center justify-center text-sm ${themes[activeTheme].badgeSecondary}`}>
                      <ThemeIcon icon="CheckCircle2" theme={activeTheme} className="w-4 h-4 mr-2 text-green-500" /> 
                      Completed ({latestCompletion.score}/{latestCompletion.total})
                    </div>
                  ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartAssignment(assign.subject, assign.questionCount, assign.id, { total: latestCompletion.total, correct: latestCompletion.score }, latestCompletion.askedQuestionIds);
                        }}
                        className={`w-full py-2 rounded-xl font-medium transition-colors flex items-center justify-center text-sm bg-amber-500 text-white hover:bg-amber-600`}
                      >
                        <ThemeIcon icon="Play" theme={activeTheme} className="w-4 h-4 mr-2" /> Continue Solving ({latestCompletion.total}/{assign.questionCount})
                      </button>
                    )
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartAssignment(assign.subject, assign.questionCount, assign.id);
                      }}
                      className={`w-full py-2 rounded-xl font-medium transition-colors flex items-center justify-center text-sm ${themes[activeTheme].badge}`}
                    >
                      <ThemeIcon icon="Play" theme={activeTheme} className="w-4 h-4 mr-2" /> Start Solving
                    </button>
                  )
                }
              </motion.div>
            )})}
            {assignments.length === 0 && (
              <div className={`text-center py-8 text-sm border border-dashed rounded-2xl ${themes[activeTheme].textSecondary} ${themes[activeTheme].border}`}>
                No assignments yet.
              </div>
            )}
          </div>

          {userRole === 'teacher' && (
            <div className="mt-8">
              <h2 className={`text-2xl font-bold mb-4 ${themes[activeTheme].textPrimary}`}>Students</h2>
              <div className="space-y-3">
                {classroom.studentIds.map((studentId) => {
                  const student = users[studentId];
                  if (!student) return null;
                  
                  const studentCompletions = completions.filter(c => c.studentId === studentId);
                  const latestAssignment = assignments[0];
                  const hasCompletedLatest = latestAssignment ? studentCompletions.some(c => c.assignmentId === latestAssignment.id && c.isFinished !== false) : false;

                  return (
                    <div 
                      key={studentId}
                      onClick={() => setSelectedStudentId(selectedStudentId === studentId ? null : studentId)}
                      className={`${themes[activeTheme].card} rounded-2xl p-4 shadow-sm cursor-pointer hover:opacity-80 transition-opacity`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {student.photoURL ? (
                            <img src={student.photoURL} alt={student.username} className="w-8 h-8 rounded-full mr-3 object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm ${themes[activeTheme].badge}`}>
                              {student.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <div className={`font-bold text-sm ${themes[activeTheme].textPrimary}`}>{student.username}</div>
                            {latestAssignment && (
                              <div className={`text-xs flex items-center mt-0.5 ${hasCompletedLatest ? 'text-green-500' : themes[activeTheme].textSecondary}`}>
                                {hasCompletedLatest ? (
                                  <><ThemeIcon icon="CheckCircle2" theme={activeTheme} className="w-3 h-3 mr-1" /> Completed Latest</>
                                ) : (
                                  <><ThemeIcon icon="Clock" theme={activeTheme} className="w-3 h-3 mr-1" /> Pending Latest</>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <ThemeIcon icon={selectedStudentId === studentId ? "ChevronLeft" : "ChevronRight"} theme={activeTheme} className={`w-4 h-4 ${themes[activeTheme].textSecondary}`} />
                      </div>
                      
                      {selectedStudentId === studentId && (
                        <div className={`mt-4 pt-4 border-t ${themes[activeTheme].border}`}>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className={`text-xs font-bold uppercase tracking-wider ${themes[activeTheme].textSecondary}`}>Assignment History</h4>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm('Are you sure you want to remove this student from the class?')) {
                                  try {
                                    const { updateDoc, arrayRemove } = await import('firebase/firestore');
                                    await updateDoc(doc(db, 'classrooms', classroomId), {
                                      studentIds: arrayRemove(studentId)
                                    });
                                  } catch (err) {
                                    console.error("Failed to remove student", err);
                                  }
                                }
                              }}
                              className={`text-xs px-2 py-1 rounded-md ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText}`}
                            >
                              Remove Student
                            </button>
                          </div>
                          {studentCompletions.length > 0 ? (
                            <div className="space-y-2">
                              {studentCompletions.map(comp => {
                                const assign = assignments.find(a => a.id === comp.assignmentId);
                                return (
                                  <div key={comp.id} className={`flex justify-between items-center text-sm ${themes[activeTheme].textPrimary}`}>
                                    <span className="capitalize">{assign?.name || `${assign?.subject || 'Unknown'} Quiz`}</span>
                                    <span className="font-bold">{comp.score}/{comp.total} {comp.isFinished === false ? '(In Progress)' : ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className={`text-xs ${themes[activeTheme].textSecondary}`}>No assignments completed yet.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {classroom.studentIds.length === 0 && (
                  <div className={`text-center py-8 text-sm border border-dashed rounded-2xl ${themes[activeTheme].textSecondary} ${themes[activeTheme].border}`}>
                    No students yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${themes[activeTheme].card} rounded-3xl p-8 max-w-md w-full shadow-2xl`}>
            <h2 className={`text-2xl font-bold mb-6 ${themes[activeTheme].textPrimary}`}>Create Assignment</h2>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${themes[activeTheme].textSecondary}`}>Assignment Name</label>
                <input type="text" value={assignName} onChange={(e) => setAssignName(e.target.value)} placeholder="e.g. Week 1 Quiz" className={`w-full px-4 py-3 rounded-xl outline-none transition-all ${themes[activeTheme].input}`} required />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${themes[activeTheme].textSecondary}`}>Number of Questions</label>
                <input type="number" min="1" max="40" value={assignCount || ''} onChange={(e) => setAssignCount(parseInt(e.target.value) || 0)} className={`w-full px-4 py-3 rounded-xl outline-none transition-all ${themes[activeTheme].input}`} required />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${themes[activeTheme].textSecondary}`}>Deadline (Optional)</label>
                <input type="datetime-local" value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} className={`w-full px-4 py-3 rounded-xl outline-none transition-all ${themes[activeTheme].input}`} />
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowAssignModal(false)} className={`flex-1 py-3 rounded-xl font-medium ${themes[activeTheme].badgeSecondary}`}>Cancel</button>
                <button type="submit" className={`flex-1 py-3 rounded-xl font-medium ${themes[activeTheme].accentBg}`}>Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${themes[activeTheme].card} rounded-3xl p-8 max-w-md w-full shadow-2xl`}>
            <h2 className={`text-2xl font-bold mb-4 ${themes[activeTheme].errorText}`}>Delete Classroom</h2>
            <p className={`mb-8 ${themes[activeTheme].textSecondary}`}>
              Are you sure you want to delete this classroom? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${themes[activeTheme].badgeSecondary}`}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'classrooms', classroomId));
                    setShowDeleteModal(false);
                    onBack();
                  } catch (error) {
                    console.error("Error deleting classroom:", error);
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${themes[activeTheme].errorBg} ${themes[activeTheme].errorText}`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
