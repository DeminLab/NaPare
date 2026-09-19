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
  data?: Record<string, unknown>;
  type: string;
  category?: 'all' | 'important' | 'schedule' | 'homework' | 'teachers' | 'system';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actions?: Array<{ label: string; href: string; method?: 'GET' | 'POST' | 'PATCH' }>;
  eventId?: string;
  deepLink?: string;
  isRead: boolean;
  readAt?: string;
  link?: string;
  createdAt: string;
  updatedAt: string;
}

export type NapareEventType =
  | 'lesson.changed' | 'lesson.cancelled' | 'lesson.rescheduled' | 'room.changed'
  | 'homework.created' | 'homework.updated' | 'homework.deadline_soon'
  | 'announcement.created' | 'message.created' | 'absence.created' | 'absence.updated'
  | 'attendance.updated' | 'grade.created' | 'sync.completed' | 'sync.failed';

export interface EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: NapareEventType;
  actor: { id?: string; type: 'user' | 'system'; role?: string };
  timestamp: string;
  university: { id: string };
  target: { type: string; id: string };
  payload: TPayload;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  recipients?: string[];
}

export interface NotificationPreference {
  id: string;
  userId: string;
  universityId: string;
  scheduleChanges: boolean;
  cancellations: boolean;
  roomChanges: boolean;
  homeworkCreated: boolean;
  deadlines: boolean;
  messages: boolean;
  announcements: boolean;
  systemAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface InboxItem {
  id: string;
  eventId?: string;
  userId: string;
  universityId: string;
  type: string;
  title: string;
  description: string;
  deepLink?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'snoozed' | 'done';
  dueAt?: string;
  actions?: Array<{ label: string; href: string; method?: 'GET' | 'POST' | 'PATCH' }>;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicPage<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Course {
  id: string;
  universityId: string;
  facultyId?: string;
  code: string;
  name: string;
  description?: string;
  credits?: number;
  isActive: boolean;
  source?: string;
  lastSyncedAt?: string;
  sourceVersion?: string;
  syncStatus: 'unknown' | 'synced' | 'stale' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface LessonSeries {
  id: string;
  universityId: string;
  courseId: string;
  groupId: string;
  teacherId?: string;
  title?: string;
  subjectType?: string;
  recurrenceRule: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  pairNumber: number;
  weekType: 'odd' | 'even' | 'both' | string;
  room?: string;
  building?: string;
  validFrom: string;
  validTo?: string;
  source?: string;
  lastSyncedAt?: string;
  sourceVersion?: string;
  syncStatus: 'unknown' | 'synced' | 'stale' | 'failed';
}

export interface LessonOccurrence {
  id: string;
  universityId: string;
  seriesId: string;
  courseId: string;
  groupId: string;
  teacherId?: string;
  startsAt: string;
  endsAt: string;
  room?: string;
  building?: string;
  status: 'scheduled' | 'cancelled' | 'rescheduled' | 'completed';
  changeReason?: string;
  legacyLessonId?: string;
  source?: string;
  lastSyncedAt?: string;
  sourceVersion?: string;
  syncStatus: 'unknown' | 'synced' | 'stale' | 'failed';
}

export interface CourseSpace {
  id: string;
  universityId: string;
  courseId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LessonSpace {
  id: string;
  universityId: string;
  courseSpaceId: string;
  occurrenceId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AcademicEventType = 'lesson' | 'homework' | 'exam' | 'announcement' | 'schedule_change' | 'absence' | 'university_event' | 'personal_task';

export interface AcademicEvent {
  id: string;
  universityId: string;
  type: AcademicEventType;
  courseId?: string;
  groupId?: string;
  occurrenceId?: string;
  actorId?: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  payload?: Record<string, unknown>;
  source?: string;
  lastSyncedAt?: string;
  sourceVersion?: string;
  syncStatus: string;
  createdAt: string;
}

export interface ScheduleChange {
  id: string;
  universityId: string;
  occurrenceId?: string;
  legacyLessonId?: string;
  originalValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  reason?: string;
  actorId?: string;
  source?: string;
  timestamp: string;
  createdAt: string;
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
