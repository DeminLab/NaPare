import { ROLES, LESSON_STATUS, ABSENCE_STATUS } from '../constants';

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

export const isValidRole = (role: string): boolean => {
  return Object.values(ROLES).includes(role as any);
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

export const isValidLessonStatus = (status: string): boolean => {
  return Object.values(LESSON_STATUS).includes(status as any);
};

export const isValidAbsenceStatus = (status: string): boolean => {
  return Object.values(ABSENCE_STATUS).includes(status as any);
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};

export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};
