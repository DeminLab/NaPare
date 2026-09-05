# Shared Types and Constants

Общие типы и константы для всего монорепо (`packages/shared/src/`).

---

## 1. Константы

### `constants/roles.ts`

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
```

### `constants/absence-types.ts`

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

// Which types require curator confirmation
export const CONFIRMATION_REQUIRED: AbsenceType[] = [
  ABSENCE_TYPES.SICK,
  ABSENCE_TYPES.OTHER,
];
```

### `constants/notification-types.ts`

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
```

### `constants/change-types.ts`

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
```

---

## 2. Типы

### `types/user.ts`

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
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: string;  // "22:00"
  quietHoursEnd?: string;    // "08:00"
  language: 'ru' | 'en';
}
```

### `types/lesson.ts`

```typescript
export interface Lesson {
  id: string;
  universityId: string;
  groupId: string;
  teacherId: string;
  subject: string;
  room: string;
  building?: string;
  dayOfWeek: number;       // 1-7 (Mon-Sun)
  startTime: string;       // "09:00"
  endTime: string;         // "10:30"
  weekType: 'odd' | 'even' | 'both';
  startDate: Date;
  endDate?: Date;
  pairNumber: number;      // 1-8
}

export interface LessonChange {
  id: string;
  lessonId: string;
  changeType: LessonChangeType;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changedAt: Date;
  changedBy?: string;
}

export type LessonChangeType = 'moved' | 'cancelled' | 'room_changed' | 'teacher_changed' | 'added';
```

### `types/pair-space.ts`

```typescript
export interface PairSpace {
  id: string;
  lessonId: string;
  activeUntil: Date;
  announcementCount: number;
  homeworkCount: number;
  fileCount: number;
  unreadMessages: number;
}

export interface Announcement {
  id: string;
  pairSpaceId: string;
  authorId: string;
  authorName: string;
  text: string;
  isPinned: boolean;
  createdAt: Date;
}

export interface Homework {
  id: string;
  pairSpaceId: string;
  title: string;
  description?: string;
  deadline?: Date;
  isRecurring: boolean;
  recurringRule?: string;
  submissionStatus?: 'not_submitted' | 'submitted';
  createdAt: Date;
}

export interface FileAttachment {
  id: string;
  pairSpaceId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
}

export interface DiscussionMessage {
  id: string;
  pairSpaceId: string;
  userId: string;
  userName: string;
  text: string;
  parentId?: string;
  createdAt: Date;
}
```

### `types/absence.ts`

```typescript
import { AbsenceType } from '../constants/absence-types';

export interface AbsenceStatus {
  id: string;
  userId: string;
  type: AbsenceType;
  startDate: Date;
  endDate: Date;
  comment?: string;
  isSensitive: boolean;
  affectedLessonsCount: number;
  createdAt: Date;
}

export interface AbsenceConfirmation {
  id: string;
  absenceId: string;
  curatorId: string;
  curatorName: string;
  status: 'pending' | 'confirmed' | 'rejected';
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### `types/notification.ts`

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
  createdAt: Date;
}

export interface DeviceToken {
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  createdAt: Date;
}
```

---

## 3. Валидаторы (Zod)

### `validators/phone.ts`

```typescript
import { z } from 'zod';

export const phoneSchema = z
  .string()
  .regex(/^\+7\d{10}$/, 'Телефон должен быть в формате +7XXXXXXXXXX');

export const phoneLocalSchema = z
  .string()
  .regex(/^\d{10}$/, 'Номер должен содержать 10 цифр');
```

### `validators/email.ts`

```typescript
import { z } from 'zod';

export const emailSchema = z
  .string()
  .email('Неверный формат email');
```

### `validators/common.ts`

```typescript
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('Неверный формат ID'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(data => data.endDate >= data.startDate, {
  message: 'endDate должен быть позже startDate',
});
```

---

## 4. Индексный файл

### `index.ts`

```typescript
export * from './constants/roles';
export * from './constants/absence-types';
export * from './constants/notification-types';
export * from './constants/change-types';

export * from './types/user';
export * from './types/lesson';
export * from './types/pair-space';
export * from './types/absence';
export * from './types/notification';

export * from './validators/phone';
export * from './validators/email';
export * from './validators/common';
```
