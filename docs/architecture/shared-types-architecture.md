# Shared Types Architecture

## Обзор

Общие типы и интерфейсы для всего монорепо. Используются в backend, mobile, web и max-miniapp.

## Структура

```
packages/shared/src/
├── index.ts                         # Экспорт всех типов
│
├── constants/
│   ├── roles.ts                     # Роли пользователей
│   ├── absence-types.ts             # Типы отсутствий
│   ├── notification-types.ts        # Типы уведомлений
│   ├── change-types.ts              # Типы изменений расписания
│   └── week-types.ts                # Типы недель
│
├── types/
│   ├── user.ts                      # Пользователь
│   ├── university.ts                # Вуз
│   ├── faculty.ts                   # Факультет
│   ├── group.ts                     # Группа
│   ├── teacher.ts                   # Преподаватель
│   ├── lesson.ts                    # Пара
│   ├── lesson-change.ts             # Изменение пары
│   ├── pair-space.ts                # Пространство пары
│   ├── announcement.ts              # Объявление
│   ├── homework.ts                  # Домашнее задание
│   ├── homework-submission.ts       # Статус сдачи
│   ├── file-attachment.ts           # Файл
│   ├── discussion-message.ts        # Сообщение обсуждения
│   ├── absence-status.ts            # Статус отсутствия
│   ├── absence-confirmation.ts      # Подтверждение куратора
│   ├── notification.ts              # Уведомление
│   ├── device-token.ts              # Токен устройства
│   ├── audit-log.ts                 # Лог действий
│   └── preference.ts                # Настройки
│
├── validators/
│   ├── phone.ts                     # Валидация телефона
│   ├── email.ts                     # Валидация email
│   ├── common.ts                    # Общие валидаторы
│   └── schemas.ts                   # Zod схемы
│
└── utils/
    ├── date.ts                      # Утилиты дат
    ├── formatters.ts                # Форматирование
    └── constants.ts                 # Константы
```

## Константы

### roles.ts

```typescript
export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  CURATOR: 'curator',
  FACULTY_DEAN: 'faculty_dean',
  DEPARTMENT_HEAD: 'department_head',
  UNIVERSITY_ADMIN: 'university_admin',
  SUPERADMIN: 'superadmin',
  DEVELOPER: 'developer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.DEVELOPER]: 0,
  [ROLES.STUDENT]: 1,
  [ROLES.TEACHER]: 2,
  [ROLES.CURATOR]: 3,
  [ROLES.DEPARTMENT_HEAD]: 4,
  [ROLES.FACULTY_DEAN]: 5,
  [ROLES.UNIVERSITY_ADMIN]: 6,
  [ROLES.SUPERADMIN]: 7,
};

export const STUDENT_ROLES = [ROLES.STUDENT] as const;
export const STAFF_ROLES = [ROLES.TEACHER, ROLES.CURATOR, ROLES.DEPARTMENT_HEAD, ROLES.FACULTY_DEAN] as const;
export const ADMIN_ROLES = [ROLES.UNIVERSITY_ADMIN, ROLES.SUPERADMIN] as const;
export const ALL_ROLES = Object.values(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.STUDENT]: 'Студент',
  [ROLES.TEACHER]: 'Преподаватель',
  [ROLES.CURATOR]: 'Куратор',
  [ROLES.FACULTY_DEAN]: 'Декан факультета',
  [ROLES.DEPARTMENT_HEAD]: 'Зав. кафедрой',
  [ROLES.UNIVERSITY_ADMIN]: 'Админ вуза',
  [ROLES.SUPERADMIN]: 'Суперадмин',
  [ROLES.DEVELOPER]: 'Разработчик',
};
```

### absence-types.ts

```typescript
export const ABSENCE_TYPES = {
  LEARNING: 'learning',
  SICK: 'sick',
  WORK: 'work',
  OTHER_CITY: 'other_city',
  OTHER: 'other',
} as const;

export type AbsenceType = (typeof ABSENCE_TYPES)[keyof typeof ABSENCE_TYPES];

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  [ABSENCE_TYPES.LEARNING]: 'Учусь',
  [ABSENCE_TYPES.SICK]: 'Болен',
  [ABSENCE_TYPES.WORK]: 'Работаю',
  [ABSENCE_TYPES.OTHER_CITY]: 'В другом городе',
  [ABSENCE_TYPES.OTHER]: 'Другая причина',
};

export const ABSENCE_TYPE_COLORS: Record<AbsenceType, string> = {
  [ABSENCE_TYPES.LEARNING]: 'green',
  [ABSENCE_TYPES.SICK]: 'orange',
  [ABSENCE_TYPES.WORK]: 'blue',
  [ABSENCE_TYPES.OTHER_CITY]: 'purple',
  [ABSENCE_TYPES.OTHER]: 'gray',
};

// Типы, требующие подтверждения куратора
export const CONFIRMATION_REQUIRED: AbsenceType[] = [
  ABSENCE_TYPES.SICK,
  ABSENCE_TYPES.OTHER,
];
```

### notification-types.ts

```typescript
export const NOTIFICATION_TYPES = {
  SCHEDULE_CHANGED: 'schedule_changed',
  ANNOUNCEMENT_CREATED: 'announcement_created',
  HOMEWORK_CREATED: 'homework_created',
  HOMEWORK_DEADLINE: 'homework_deadline',
  FILE_UPLOADED: 'file_uploaded',
  ABSENCE_CREATED: 'absence_created',
  ABSENCE_CONFIRMED: 'absence_confirmed',
  ABSENCE_REJECTED: 'absence_rejected',
  ROLE_ASSIGNED: 'role_assigned',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_DEEP_LINKS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.SCHEDULE_CHANGED]: '/schedule',
  [NOTIFICATION_TYPES.ANNOUNCEMENT_CREATED]: '/pair-space/{lessonId}',
  [NOTIFICATION_TYPES.HOMEWORK_CREATED]: '/pair-space/{lessonId}/homework',
  [NOTIFICATION_TYPES.HOMEWORK_DEADLINE]: '/pair-space/{lessonId}/homework',
  [NOTIFICATION_TYPES.FILE_UPLOADED]: '/pair-space/{lessonId}/files',
  [NOTIFICATION_TYPES.ABSENCE_CREATED]: '/absences',
  [NOTIFICATION_TYPES.ABSENCE_CONFIRMED]: '/absences',
  [NOTIFICATION_TYPES.ABSENCE_REJECTED]: '/absences',
  [NOTIFICATION_TYPES.ROLE_ASSIGNED]: '/profile',
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.SCHEDULE_CHANGED]: 'Изменение расписания',
  [NOTIFICATION_TYPES.ANNOUNCEMENT_CREATED]: 'Новое объявление',
  [NOTIFICATION_TYPES.HOMEWORK_CREATED]: 'Новое задание',
  [NOTIFICATION_TYPES.HOMEWORK_DEADLINE]: 'Дедлайн задания',
  [NOTIFICATION_TYPES.FILE_UPLOADED]: 'Новый файл',
  [NOTIFICATION_TYPES.ABSENCE_CREATED]: 'Новое отсутствие',
  [NOTIFICATION_TYPES.ABSENCE_CONFIRMED]: 'Отсутствие подтверждено',
  [NOTIFICATION_TYPES.ABSENCE_REJECTED]: 'Отсутствие отклонено',
  [NOTIFICATION_TYPES.ROLE_ASSIGNED]: 'Назначена роль',
};
```

### change-types.ts

```typescript
export const LESSON_CHANGE_TYPES = {
  MOVED: 'moved',
  CANCELLED: 'cancelled',
  ROOM_CHANGED: 'room_changed',
  TEACHER_CHANGED: 'teacher_changed',
  ADDED: 'added',
} as const;

export type LessonChangeType = (typeof LESSON_CHANGE_TYPES)[keyof typeof LESSON_CHANGE_TYPES];

export const CHANGE_TYPE_LABELS: Record<LessonChangeType, string> = {
  [LESSON_CHANGE_TYPES.MOVED]: 'Перенесена',
  [LESSON_CHANGE_TYPES.CANCELLED]: 'Отменена',
  [LESSON_CHANGE_TYPES.ROOM_CHANGED]: 'Изменена аудитория',
  [LESSON_CHANGE_TYPES.TEACHER_CHANGED]: 'Изменён преподаватель',
  [LESSON_CHANGE_TYPES.ADDED]: 'Добавлена',
};

export const CHANGE_TYPE_ICONS: Record<LessonChangeType, string> = {
  [LESSON_CHANGE_TYPES.MOVED]: 'schedule',
  [LESSON_CHANGE_TYPES.CANCELLED]: 'cancel',
  [LESSON_CHANGE_TYPES.ROOM_CHANGED]: 'room',
  [LESSON_CHANGE_TYPES.TEACHER_CHANGED]: 'person',
  [LESSON_CHANGE_TYPES.ADDED]: 'add',
};
```

## Типы

### user.ts

```typescript
import { Role } from '../constants/roles';

export interface User {
  id: string;
  phone?: string;
  email?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  roles: Role[];
  universityId: string;
  groupId?: string;
  isActive: boolean;
  needsOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: 'ru' | 'en';
  notificationsEnabled: boolean;
  notificationSettings: {
    scheduleChanged: boolean;
    announcementCreated: boolean;
    homeworkCreated: boolean;
    homeworkDeadline: boolean;
    fileUploaded: boolean;
    absenceCreated: boolean;
    absenceConfirmed: boolean;
    absenceRejected: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserWithRoles extends User {
  roles: Role[];
  university?: University;
  group?: Group;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface BindGroupDto {
  universityId: string;
  groupId: string;
}
```

### lesson.ts

```typescript
export interface Lesson {
  id: string;
  universityId: string;
  groupId: string;
  teacherId?: string;
  subject: string;
  room?: string;
  building?: string;
  dayOfWeek: number; // 1-7 (Пн-Вс)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  weekType: 'odd' | 'even' | 'both';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isCancelled: boolean;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  
  // Связанные данные
  group?: Group;
  teacher?: Teacher;
  pairSpace?: PairSpace;
  changes?: LessonChange[];
}

export interface LessonWithDetails extends Lesson {
  group: Group;
  teacher?: Teacher;
  pairSpace: PairSpace;
  hasChanges: boolean;
  changeCount: number;
}

export interface ScheduleQuery {
  startDate: string;
  endDate: string;
  groupId?: string;
}

export interface ScheduleResponse {
  data: Lesson[];
  meta: {
    startDate: string;
    endDate: string;
    total: number;
  };
}
```

### lesson-change.ts

```typescript
import { LessonChangeType } from '../constants/change-types';

export interface LessonChange {
  id: string;
  lessonId: string;
  changeType: LessonChangeType;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
  
  // Связанные данные
  lesson?: Lesson;
}

export interface LessonChangeWithLesson extends LessonChange {
  lesson: Lesson;
}
```

### pair-space.ts

```typescript
export interface PairSpace {
  id: string;
  lessonId: string;
  activeUntil: string;
  createdAt: string;
  updatedAt: string;
  
  // Связанные данные
  lesson?: Lesson;
  announcements?: Announcement[];
  homeworks?: Homework[];
  files?: FileAttachment[];
  messages?: DiscussionMessage[];
  
  // Агрегированные данные
  announcementCount: number;
  homeworkCount: number;
  fileCount: number;
  unreadMessages: number;
}

export interface PairSpaceWithDetails extends PairSpace {
  lesson: LessonWithDetails;
  announcements: Announcement[];
  homeworks: Homework[];
  files: FileAttachment[];
  messages: DiscussionMessage[];
}
```

### absence-status.ts

```typescript
import { AbsenceType } from '../constants/absence-types';

export interface AbsenceStatus {
  id: string;
  userId: string;
  type: AbsenceType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  comment?: string;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Связанные данные
  user?: User;
  confirmation?: AbsenceConfirmation;
  affectedLessons?: Lesson[];
  affectedLessonsCount: number;
}

export interface AbsenceConfirmation {
  id: string;
  absenceId: string;
  curatorId: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  createdAt: string;
  updatedAt: string;
  
  // Связанные данные
  curator?: User;
  absence?: AbsenceStatus;
}

export interface CreateAbsenceDto {
  type: AbsenceType;
  startDate: string;
  endDate: string;
  comment?: string;
}

export interface ConfirmAbsenceDto {
  status: 'approved' | 'rejected';
  comment?: string;
}

export interface AbsenceDashboard {
  pending: AbsenceStatus[];
  approved: AbsenceStatus[];
  rejected: AbsenceStatus[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}
```

### notification.ts

```typescript
import { NotificationType } from '../constants/notification-types';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DeviceToken {
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  scheduleChanged: boolean;
  announcementCreated: boolean;
  homeworkCreated: boolean;
  homeworkDeadline: boolean;
  fileUploaded: boolean;
  absenceCreated: boolean;
  absenceConfirmed: boolean;
  absenceRejected: boolean;
}

export interface NotificationResponse {
  data: Notification[];
  meta: {
    total: number;
    unread: number;
    page: number;
    limit: number;
  };
}
```

## Валидаторы (Zod)

### schemas.ts

```typescript
import { z } from 'zod';
import { ROLES, ALL_ROLES } from '../constants/roles';
import { ABSENCE_TYPES } from '../constants/absence-types';
import { LESSON_CHANGE_TYPES } from '../constants/change-types';

// User
export const userSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().regex(/^\+7\d{10}$/).optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  avatarUrl: z.string().url().optional(),
  roles: z.array(z.enum(ALL_ROLES as [string, ...string[]])),
  universityId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  isActive: z.boolean(),
  needsOnboarding: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Lesson
export const lessonSchema = z.object({
  id: z.string().uuid(),
  universityId: z.string().uuid(),
  groupId: z.string().uuid(),
  teacherId: z.string().uuid().optional(),
  subject: z.string().min(1).max(255),
  room: z.string().max(20).optional(),
  building: z.string().max(100).optional(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  weekType: z.enum(['odd', 'even', 'both']),
  startDate: z.string().date(),
  endDate: z.string().date(),
  isCancelled: z.boolean(),
  externalId: z.string().max(100).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// AbsenceStatus
export const absenceStatusSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(Object.values(ABSENCE_TYPES) as [string, ...string[]]),
  startDate: z.string().date(),
  endDate: z.string().date(),
  comment: z.string().optional(),
  isSensitive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// CreateAbsenceDto
export const createAbsenceSchema = z.object({
  type: z.enum(Object.values(ABSENCE_TYPES) as [string, ...string[]]),
  startDate: z.string().date(),
  endDate: z.string().date(),
  comment: z.string().max(500).optional(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'endDate должен быть позже startDate',
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// ID Param
export const idParamSchema = z.object({
  id: z.string().uuid('Неверный формат ID'),
});

// Date Range
export const dateRangeSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'endDate должен быть позже startDate',
});
```

## Утилиты

### date.ts

```typescript
import { format, parseISO, isToday, isTomorrow, isYesterday, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';

export function formatDate(date: string | Date, formatStr: string = 'dd.MM.yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: ru });
}

export function formatTime(time: string): string {
  return time;
}

export function formatDateTime(dateTime: string | Date): string {
  const d = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
  return format(d, 'dd.MM.yyyy HH:mm', { locale: ru });
}

export function isDateToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isToday(d);
}

export function isDateTomorrow(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isTomorrow(d);
}

export function isDateYesterday(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isYesterday(d);
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(d, new Date());
}

export function getDayOfWeek(dayNumber: number): string {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return days[dayNumber - 1] || '';
}

export function getDayOfWeekFull(dayNumber: number): string {
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  return days[dayNumber - 1] || '';
}
```

### formatters.ts

```typescript
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatPhone(phone: string): string {
  // +7XXXXXXXXXX -> +7 (XXX) XXX-XX-XX
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  
  if (mod100 >= 11 && mod100 <= 19) {
    return forms[2];
  }
  
  if (mod10 === 1) {
    return forms[0];
  }
  
  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }
  
  return forms[2];
}
```