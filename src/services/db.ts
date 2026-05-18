import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, arrayUnion, addDoc, orderBy, limit, onSnapshot, writeBatch, increment, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, Classroom, Assignment, Post, Reply, FriendRequest, Game, Level } from '../types';

export interface QuestionFolder {
  id: string;
  userId: string;
  name: string;
  subject: string;
  createdAt: number;
}

export interface SavedQuestion {
  id: string;
  userId: string;
  folderId: string;
  subject: string;
  examCode: string;
  examIndex: number;
  qNumber: number;
  pageIndex: number;
  startY: number;
  endY: number;
  answer: string;
  createdAt: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const createUserProfile = async (uid: string, username: string, role: 'teacher' | 'student') => {
  try {
    const friendCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userRef = doc(db, 'users', uid);
    const newProfile: UserProfile = {
      uid,
      username,
      role,
      friendCode,
      totalCorrect: 0,
      totalAnswered: 0,
      accuracy: 0,
      podiums: 0,
      won: 0,
      xp: 0,
      isPremium: false,
      hintsRemaining: 2,
      lastHintResetDate: new Date().toISOString().split('T')[0],
      subjectCorrect: { chemistry: 0, physics: 0, biology: 0, economics: 0, accounting: 0 },
      dailyEconAnswered: 0,
      lastEconResetDate: new Date().toISOString().split('T')[0],
      friends: []
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
  }
};

export const getUserProfile = async (uid: string) => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const updateStats = async (uid: string, subject: 'chemistry' | 'physics' | 'biology' | 'economics' | 'accounting', correctCount: number, totalAnsweredCount: number = 1) => {
  try {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      const newTotalCorrect = Math.max(0, (data.totalCorrect || 0) + correctCount);
      const newTotalAnswered = Math.max(0, (data.totalAnswered || 0) + totalAnsweredCount);
      const newAccuracy = newTotalAnswered > 0 ? Math.round((newTotalCorrect / newTotalAnswered) * 100) : 0;

      const currentSubjectCorrect = data.subjectCorrect?.[subject] || 0;
      const newSubjectCorrect = Math.max(0, currentSubjectCorrect + correctCount);

      const today = new Date().toISOString().split('T')[0];
      let dailyEconAnswered = data.dailyEconAnswered || 0;
      if (data.lastEconResetDate !== today) {
        dailyEconAnswered = 0;
      }
      
      if (subject === 'economics') {
        dailyEconAnswered += totalAnsweredCount;
      }

      const batch = writeBatch(db);

      // Update main user profile
      batch.update(userRef, {
        totalCorrect: newTotalCorrect,
        totalAnswered: newTotalAnswered,
        accuracy: newAccuracy,
        [`subjectCorrect.${subject}`]: newSubjectCorrect,
        dailyEconAnswered,
        lastEconResetDate: today
      });

      // Calculate time frames
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');

      const getWeek = (d: Date) => {
        const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      };

      const ww = String(getWeek(now)).padStart(2, '0');
      const dayStr = `${yyyy}-${mm}-${dd}`;
      const weekStr = `${yyyy}-W${ww}`;
      const monthStr = `${yyyy}-${mm}`;
      const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
      const quarterStr = `${yyyy}-Q${quarter}`;

      const updateBucket = (timeFrame: string, timeStr: string) => {
        const ref = doc(db, 'leaderboards', `${timeFrame}_${timeStr}`, 'entries', uid);
        batch.set(ref, {
          uid,
          username: data.username,
          role: data.role,
          timeFrame,
          timeStr,
          totalCorrect: increment(correctCount),
          subjectCorrect: {
            [subject]: increment(correctCount)
          }
        }, { merge: true });
      };

      updateBucket('daily', dayStr);
      updateBucket('weekly', weekStr);
      updateBucket('monthly', monthStr);
      updateBucket('3_months', quarterStr);
      updateBucket('all_time', 'all');

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const createClassroom = async (teacherId: string, name: string, subject: string) => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const classRef = doc(collection(db, 'classrooms'));
    const newClass: Classroom = {
      id: classRef.id,
      code,
      teacherId,
      name,
      subject,
      studentIds: []
    };
    await setDoc(classRef, newClass);
    return newClass;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'classrooms');
  }
};

export const joinClassroom = async (studentId: string, code: string) => {
  try {
    const q = query(collection(db, 'classrooms'), where('code', '==', code));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const classDoc = querySnapshot.docs[0];
      const data = classDoc.data() as Classroom;

      if (data.studentIds.includes(studentId)) {
        return data; // Already in the class
      }

      await updateDoc(classDoc.ref, {
        studentIds: arrayUnion(studentId)
      });
      return data;
    }
    throw new Error('Classroom not found');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'classrooms');
  }
};

export const createAssignment = async (classroomId: string, subject: string, questionCount: number, name?: string, deadline?: string) => {
  try {
    const assignRef = doc(collection(db, 'assignments'));
    const newAssign: Assignment = {
      id: assignRef.id,
      classroomId,
      subject,
      questionCount,
      createdAt: new Date().toISOString(),
      name: name || 'Quiz',
      deadline
    };
    await setDoc(assignRef, newAssign);
    return newAssign;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'assignments');
  }
};

export const createAssignmentCompletion = async (assignmentId: string, studentId: string, classroomId: string, score: number, total: number, isFinished: boolean = true, askedQuestionIds: string[] = []) => {
  try {
    const completionRef = doc(db, 'assignmentCompletions', `${assignmentId}_${studentId}`);
    const newCompletion = {
      id: completionRef.id,
      assignmentId,
      studentId,
      classroomId,
      score,
      total,
      isFinished,
      askedQuestionIds,
      completedAt: new Date().toISOString()
    };
    await setDoc(completionRef, newCompletion, { merge: true });
    return newCompletion;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'assignmentCompletions');
  }
};

export const createPost = async (classroomId: string, authorId: string, content: string) => {
  try {
    const postRef = doc(collection(db, 'posts'));
    const newPost: Post = {
      id: postRef.id,
      classroomId,
      authorId,
      content,
      createdAt: new Date().toISOString()
    };
    await setDoc(postRef, newPost);
    return newPost;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'posts');
  }
};

export const createReply = async (postId: string, authorId: string, content: string) => {
  try {
    const replyRef = doc(collection(db, 'replies'));
    const newReply: Reply = {
      id: replyRef.id,
      postId,
      authorId,
      content,
      createdAt: new Date().toISOString()
    };
    await setDoc(replyRef, newReply);
    return newReply;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'replies');
  }
};

export const sendFriendRequest = async (fromUid: string, toUsername: string) => {
  try {
    const q = query(collection(db, 'users'), where('username', '==', toUsername));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const toUid = querySnapshot.docs[0].id;

      // Check if already friends
      const fromUserDoc = await getDoc(doc(db, 'users', fromUid));
      const fromUserData = fromUserDoc.data() as UserProfile;
      if (fromUserData.friends.includes(toUid)) {
        throw new Error('Already friends');
      }

      // Check if request already exists
      const qExisting = query(
        collection(db, 'friendRequests'),
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDocs(qExisting);
      if (!existingSnap.empty) {
        throw new Error('Request already sent');
      }

      const reqRef = doc(collection(db, 'friendRequests'));
      const newReq: FriendRequest = {
        id: reqRef.id,
        fromUid,
        toUid,
        status: 'pending'
      };
      await setDoc(reqRef, newReq);
      return newReq;
    }
    throw new Error('User not found');
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'friendRequests');
  }
};

export const sendFriendRequestByCode = async (fromUid: string, friendCode: string) => {
  try {
    const q = query(collection(db, 'users'), where('friendCode', '==', friendCode.toUpperCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const toUid = querySnapshot.docs[0].id;
      if (toUid === fromUid) throw new Error("You can't add yourself");

      // Check if already friends
      const fromUserDoc = await getDoc(doc(db, 'users', fromUid));
      const fromUserData = fromUserDoc.data() as UserProfile;
      if (fromUserData.friends.includes(toUid)) {
        throw new Error('Already friends');
      }

      // Check if request already exists
      const qExisting = query(
        collection(db, 'friendRequests'),
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDocs(qExisting);
      if (!existingSnap.empty) {
        throw new Error('Request already sent');
      }

      const reqRef = doc(collection(db, 'friendRequests'));
      const newReq: FriendRequest = {
        id: reqRef.id,
        fromUid,
        toUid,
        status: 'pending'
      };
      await setDoc(reqRef, newReq);
      return newReq;
    }
    throw new Error('User not found');
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'friendRequests');
  }
};

export const getFriendStats = async (uid: string, friendUid: string) => {
  try {
    // Query games where both users participated
    const q1 = query(collection(db, 'games'), where('playerIds', 'array-contains', uid));

    const snap1 = await getDocs(q1);
    const allGames = snap1.docs
      .map(d => d.data() as Game)
      .filter(g =>
        g.status === 'finished' &&
        g.players[friendUid]
      );

    const totalGames = allGames.length;
    const wins = allGames.filter(g => g.winnerId === uid).length;
    const winPercentage = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    return { totalGames, winPercentage };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'games');
    return { totalGames: 0, winPercentage: 0 };
  }
};

export const getSentFriendRequests = async (uid: string) => {
  try {
    const q = query(collection(db, 'friendRequests'), where('fromUid', '==', uid), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as FriendRequest);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'friendRequests');
  }
};

export const getReceivedFriendRequests = async (uid: string) => {
  try {
    const q = query(collection(db, 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as FriendRequest);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'friendRequests');
  }
};

export const acceptFriendRequest = async (requestId: string, fromUid: string, toUid: string) => {
  try {
    const batch = writeBatch(db);

    const reqRef = doc(db, 'friendRequests', requestId);
    batch.update(reqRef, { status: 'accepted' });

    batch.update(doc(db, 'users', fromUid), { friends: arrayUnion(toUid) });
    batch.update(doc(db, 'users', toUid), { friends: arrayUnion(fromUid) });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `friendRequests/${requestId}`);
  }
};

export const sendGameInvite = async (gameId: string, gameCode: string, fromUid: string, fromUsername: string, toUid: string) => {
  try {
    const inviteRef = doc(collection(db, 'gameInvites'));
    await setDoc(inviteRef, {
      id: inviteRef.id,
      gameId,
      gameCode,
      fromUid,
      fromUsername,
      toUid,
      status: 'pending',
      createdAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'gameInvites');
  }
};

export const acceptGameInvite = async (inviteId: string) => {
  try {
    const inviteRef = doc(db, 'gameInvites', inviteId);
    await updateDoc(inviteRef, { status: 'accepted' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `gameInvites/${inviteId}`);
  }
};

export const declineGameInvite = async (inviteId: string) => {
  try {
    const inviteRef = doc(db, 'gameInvites', inviteId);
    await updateDoc(inviteRef, { status: 'declined' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `gameInvites/${inviteId}`);
  }
};

export const createGame = async (
  hostId: string,
  hostUsername: string,
  subject: string,
  mode: 'questions' | 'time' | 'both' | 'whole_paper',
  targetQuestions: number | undefined,
  targetTimeSeconds: number | undefined,
  sameQuestions: boolean,
  questions?: any[],
  targetExamCode?: string,
  maxPlayers: number = 2,
  photoURL?: string,
  level?: Level
) => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const gameRef = doc(collection(db, 'games'));

    const hostPlayer: any = {
      uid: hostId,
      username: hostUsername,
      score: 0,
      progress: 0
    };
    if (photoURL) hostPlayer.photoURL = photoURL;

    const newGame: Game = {
      id: gameRef.id,
      code,
      hostId,
      maxPlayers,
      players: {
        [hostId]: hostPlayer
      },
      playerIds: [hostId],
      status: 'waiting',
      subject,
      level,
      mode,
      targetQuestions: targetQuestions ?? null,
      targetTimeSeconds: targetTimeSeconds ?? null,
      targetExamCode: targetExamCode ?? null,
      sameQuestions,
      questions: questions ?? null,
    };
    await setDoc(gameRef, newGame);
    return newGame;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'games');
  }
};

export const joinGame = async (guestId: string, guestUsername: string, code: string, photoURL?: string) => {
  try {
    const q = query(collection(db, 'games'), where('code', '==', code));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const gameDoc = querySnapshot.docs[0];
      const gameData = gameDoc.data() as Game;

      if (gameData.status !== 'waiting') {
        throw new Error('Game already started or finished');
      }

      if (Object.keys(gameData.players || {}).length >= gameData.maxPlayers) {
        throw new Error('Game is full');
      }

      const guestPlayer: any = {
        uid: guestId,
        username: guestUsername,
        score: 0,
        progress: 0
      };
      if (photoURL) guestPlayer.photoURL = photoURL;

      const newPlayers = {
        ...(gameData.players || {}),
        [guestId]: guestPlayer
      };

      await updateDoc(gameDoc.ref, {
        players: newPlayers,
        playerIds: arrayUnion(guestId)
      });
      return { ...gameData, id: gameDoc.id, players: newPlayers } as Game;
    }
    throw new Error('Game not found');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'games');
  }
};

export const startGame = async (gameId: string) => {
  try {
    const batch = writeBatch(db);
    const gameRef = doc(db, 'games', gameId);
    batch.update(gameRef, { status: 'playing', startTime: Date.now() });

    const invitesQ = query(
      collection(db, 'gameInvites'), 
      where('fromUid', '==', auth.currentUser?.uid)
    );
    const invitesSnap = await getDocs(invitesQ);
    invitesSnap.forEach(doc => {
      if (doc.data().gameId === gameId) {
        batch.delete(doc.ref);
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const updateGameProgress = async (gameId: string, playerId: string, score: number, progress: number, isFinished: boolean = false) => {
  try {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      [`players.${playerId}.score`]: score,
      [`players.${playerId}.progress`]: progress,
      [`players.${playerId}.isFinished`]: isFinished
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const finishGame = async (gameId: string, winnerId: string | null) => {
  try {
    const batch = writeBatch(db);
    const gameRef = doc(db, 'games', gameId);
    batch.update(gameRef, { status: 'finished', winnerId });

    const invitesQ = query(collection(db, 'gameInvites'), where('gameId', '==', gameId));
    const invitesSnap = await getDocs(invitesQ);
    invitesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const updateMultiplayerStats = async (uid: string, isWinner: boolean, isPodium: boolean) => {
  try {
    const userRef = doc(db, 'users', uid);
    const updates: any = {};
    if (isWinner) updates.won = increment(1);
    if (isPodium) updates.podiums = increment(1);

    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const createFolder = async (userId: string, name: string, subject: string) => {
  try {
    const folderRef = doc(collection(db, 'folders'));
    await setDoc(folderRef, { id: folderRef.id, userId, name, subject, createdAt: Date.now() });
    return folderRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'folders');
  }
};

export const saveQuestion = async (userId: string, folderId: string, question: Omit<SavedQuestion, 'id' | 'userId' | 'folderId' | 'createdAt'>) => {
  try {
    const qRef = doc(collection(db, 'savedQuestions'));
    await setDoc(qRef, { id: qRef.id, userId, folderId, ...question, createdAt: Date.now() });
    return qRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'savedQuestions');
  }
};

export const deleteSavedQuestion = async (questionId: string) => {
  try {
    await deleteDoc(doc(db, 'savedQuestions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `savedQuestions/${questionId}`);
  }
};
