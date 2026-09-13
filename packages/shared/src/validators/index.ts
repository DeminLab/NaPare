import { ROLES } from '../constants/roles';
import { ABSENCE_TYPES, AbsenceType } from '../constants/absence-types';
import { LESSON_CHANGE_TYPES, LessonChangeType } from '../constants/change-types';
import { NOTIFICATION_TYPES, NotificationType } from '../constants/notification-types';

export * from './schemas';

export const isValidRole = (role: string): boolean => {
  return Object.values(ROLES).includes(role as any);
};

export const isValidAbsenceType = (type: string): boolean => {
  return Object.values(ABSENCE_TYPES).includes(type as AbsenceType);
};

export const isValidLessonChangeType = (type: string): boolean => {
  return Object.values(LESSON_CHANGE_TYPES).includes(type as LessonChangeType);
};

export const isValidNotificationType = (type: string): boolean => {
  return Object.values(NOTIFICATION_TYPES).includes(type as NotificationType);
};

export const isValidDate = (date: string): boolean => {
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

export const isValidPairNumber = (pairNumber: number): boolean => {
  return pairNumber >= 1 && pairNumber <= 8;
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};
