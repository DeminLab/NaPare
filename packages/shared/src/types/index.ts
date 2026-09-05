import { ROLES, LESSON_STATUS, ABSENCE_STATUS, NOTIFICATION_TYPES } from '../constants';

export type UserRole = (typeof ROLES)[keyof typeof ROLES];
export type LessonStatus = (typeof LESSON_STATUS)[keyof typeof LESSON_STATUS];
export type AbsenceStatus = (typeof ABSENCE_STATUS)[keyof typeof ABSENCE_STATUS];
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  universityId: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  universityId: string;
  date: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface PairSpace {
  id: string;
  universityId: string;
  lessonId: string;
  subject: string;
  date: Date;
  pairNumber: number;
  teacherName?: string;
  group?: string;
  room?: string;
  isActive: boolean;
  announcements?: Announcement[];
  homeworks?: Homework[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Announcement {
  id: string;
  pairSpaceId: string;
  authorId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Homework {
  id: string;
  pairSpaceId: string;
  authorId: string;
  title: string;
  description?: string;
  deadline?: Date;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Absence {
  id: string;
  universityId: string;
  studentId: string;
  lessonId?: string;
  date: Date;
  pairNumber: number;
  subject: string;
  status: AbsenceStatus;
  reason?: string;
  confirmedBy?: string;
  confirmedAt?: Date;
  isExcused: boolean;
  excusedBy?: string;
  excusedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  universityId: string;
  title: string;
  body: string;
  data?: any;
  type: NotificationType;
  isRead: boolean;
  readAt?: Date;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
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
