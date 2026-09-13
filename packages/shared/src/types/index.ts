import { Role } from '../constants/roles';
import { AbsenceType } from '../constants/absence-types';
import { LessonChangeType } from '../constants/change-types';
import { NotificationType } from '../constants/notification-types';
import { LessonStatus, WeekType } from '../constants/schedule';
import { FileType, DevicePlatform } from '../constants/common';

export type { Role, AbsenceType, LessonChangeType, NotificationType, LessonStatus, WeekType, FileType, DevicePlatform };

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  roles: Role[];
  universityId: string;
  groupId?: string;
  passwordHash?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithUniversity extends User {
  university?: import('./university').University;
  group?: import('./group').Group;
}

export interface Lesson {
  id: string;
  universityId: string;
  groupId: string;
  teacherId?: string;
  subject: string;
  subjectType?: string;
  room?: string;
  building?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  pairNumber: number;
  weekType: WeekType;
  startDate: Date;
  endDate: Date;
  teacherName?: string;
  groupName?: string;
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

export interface LessonWithDetails extends Lesson {
  hasChanges: boolean;
  changeType?: LessonChangeType;
  pairSpaceId?: string;
  announcementCount?: number;
  homeworkCount?: number;
  deadlineSoon?: boolean;
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
  activeUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PairSpaceWithDetails extends PairSpace {
  announcements?: Announcement[];
  homeworks?: Homework[];
  files?: import('./file-attachment').FileAttachment[];
  messagesCount?: number;
  announcementCount?: number;
  homeworkCount?: number;
  fileCount?: number;
}

export interface Announcement {
  id: string;
  pairSpaceId: string;
  authorId: string;
  text: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnnouncementWithAuthor extends Announcement {
  authorName?: string;
  authorAvatar?: string;
}

export interface Homework {
  id: string;
  pairSpaceId: string;
  authorId: string;
  title: string;
  description?: string;
  deadline?: Date;
  isRecurring: boolean;
  recurringRule?: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HomeworkWithDetails extends Homework {
  authorName?: string;
  submissionStatus?: import('./homework-submission').HomeworkSubmissionStatus;
  submittedAt?: Date;
}

export interface Absence {
  id: string;
  universityId: string;
  studentId: string;
  type: AbsenceType;
  startDate: Date;
  endDate: Date;
  comment?: string;
  isSensitive: boolean;
  confirmationRequired: boolean;
  affectedLessonIds?: string[];
  affectedLessonsCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AbsenceWithStudent extends Absence {
  studentName?: string;
  studentEmail?: string;
  confirmationStatus?: import('./absence-confirmation').AbsenceConfirmationStatus;
}

export interface AbsenceDashboard {
  pending: AbsenceWithStudent[];
  confirmed: AbsenceWithStudent[];
  rejected: AbsenceWithStudent[];
  stats: {
    total: number;
    pending: number;
    confirmedToday: number;
    totalThisWeek: number;
  };
}

export interface Notification {
  id: string;
  userId: string;
  universityId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink?: string;
  isRead: boolean;
  readAt?: Date;
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationWithMeta {
  data: Notification[];
  meta: {
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  };
}

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  types: Record<NotificationType, boolean>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: Role[];
  };
  isNewUser: boolean;
}

export interface MyDayResponse {
  date: string;
  dayOfWeek: string;
  greeting: string;
  lessons: LessonWithDetails[];
  changes: import('./lesson-change').LessonChangeWithLesson[];
  hotDeadlines: HomeworkWithDetails[];
  newContent: (AnnouncementWithAuthor | import('./file-attachment').FileAttachment)[];
  absence?: Absence;
  summary: {
    lessonsCount: number;
    changesCount: number;
    hotDeadlinesCount: number;
    newContentCount: number;
  };
}

export interface ScheduleQuery {
  startDate: string;
  endDate: string;
  groupId?: string;
  teacherId?: string;
  page?: number;
  limit?: number;
}

export interface ScheduleResponse {
  data: LessonWithDetails[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
