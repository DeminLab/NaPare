export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  universityId: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  universityId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  universityId: string;
  date: string;
  pairNumber: number;
  startTime: string;
  endTime: string;
  subject: string;
  subjectType?: string;
  teacherName?: string;
  teacherId?: string;
  room?: string;
  building?: string;
  group?: string;
  subgroup?: string;
  department?: string;
  faculty?: string;
  notes?: string;
  isChanged: boolean;
  changeDescription?: string;
  source?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PairSpace {
  id: string;
  universityId: string;
  lessonId: string;
  subject: string;
  date: string;
  pairNumber: number;
  teacherName?: string;
  group?: string;
  room?: string;
  isActive: boolean;
  announcements?: Announcement[];
  homeworks?: Homework[];
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  pairSpaceId: string;
  authorId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Homework {
  id: string;
  pairSpaceId: string;
  authorId: string;
  title: string;
  description?: string;
  deadline?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Absence {
  id: string;
  universityId: string;
  studentId: string;
  lessonId?: string;
  date: string;
  pairNumber: number;
  subject: string;
  status: 'absent' | 'late' | 'excused' | 'pending';
  reason?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  isExcused: boolean;
  excusedBy?: string;
  excusedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  universityId: string;
  title: string;
  body: string;
  data?: any;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  readAt?: string;
  link?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyDayResponse {
  date: string;
  lessons: Lesson[];
  pairSpaces: PairSpace[];
  absences: Absence[];
  notifications: {
    unreadCount: number;
  };
  summary: {
    totalLessons: number;
    changedLessons: number;
    totalAbsences: number;
  };
}
