export type Level = 'extended' | 'core' | 'a_level';
export type PremiumPlan = 'brainiac_one' | 'al_pack' | 'ol_pack' | 'core_pack';

export interface Question {
  examIndex: number;
  qNumber: number;
  pageIndex: number;
  startY: number;
  endY: number;
  answer?: string;
  examCode?: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  role: 'teacher' | 'student' | 'admin';
  photoURL?: string;
  friendCode: string;
  totalCorrect: number;
  totalAnswered?: number;
  xp?: number;
  podiums?: number;
  accuracy?: number;
  won?: number;
  isPremium?: boolean;
  premiumPlan?: PremiumPlan;
  premiumRequested?: boolean;
  premiumRequestedPlan?: PremiumPlan;
  isBanned?: boolean;
  banUntil?: number | null;
  adminSecret?: string;
  hintsRemaining?: number;
  lastHintResetDate?: string;
  theme?: 'default' | 'dark' | 'retro' | 'pink' | 'space' | 'scientist';
  subjectCorrect: {
    chemistry: number;
    physics: number;
    biology: number;
    economics: number;
    accounting: number;
  };
  dailyEconAnswered?: number;
  lastEconResetDate?: string;
  friends: string[];
}

export interface Classroom {
  id: string;
  code: string;
  teacherId: string;
  name: string;
  subject: string;
  studentIds: string[];
}

export interface Assignment {
  id: string;
  classroomId: string;
  subject: string;
  questionCount: number;
  createdAt: string;
  name?: string;
  deadline?: string;
}

export interface Post {
  id: string;
  classroomId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Reply {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface GamePlayer {
  uid: string;
  username: string;
  score: number;
  progress: number;
  photoURL?: string;
  isFinished?: boolean;
}

export interface SupportMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  isAdmin: boolean;
  read: boolean;
}

export interface Game {
  id: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  players: Record<string, GamePlayer>;
  playerIds?: string[];
  status: 'waiting' | 'playing' | 'finished';
  subject: string;
  level?: Level;
  mode: 'questions' | 'time' | 'both' | 'whole_paper';
  targetQuestions?: number;
  targetTimeSeconds?: number;
  targetExamCode?: string;
  sameQuestions: boolean;
  questions?: any[];
  startTime?: number;
  winnerId?: string;
}
