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

export const ROLE_HIERARCHY: Record<string, number> = {
  [ROLES.DEVELOPER]: 8,
  [ROLES.SUPERADMIN]: 7,
  [ROLES.UNIVERSITY_ADMIN]: 6,
  [ROLES.DEPARTMENT_HEAD]: 5,
  [ROLES.FACULTY_DEAN]: 4,
  [ROLES.CURATOR]: 3,
  [ROLES.TEACHER]: 2,
  [ROLES.STUDENT]: 1,
};

export const LESSON_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const ABSENCE_STATUS = {
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
  PENDING: 'pending',
} as const;

export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const PAIR_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const PAIR_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '08:00', end: '09:30' },
  2: { start: '09:45', end: '11:15' },
  3: { start: '11:30', end: '13:00' },
  4: { start: '13:30', end: '15:00' },
  5: { start: '15:15', end: '16:45' },
  6: { start: '17:00', end: '18:30' },
  7: { start: '18:45', end: '20:15' },
  8: { start: '20:30', end: '22:00' },
};
