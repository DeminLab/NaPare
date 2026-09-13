import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_SHORT } from '../constants/schedule';

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatTime(time: string): string {
  return time;
}

export function formatDateTime(date: Date | string, time: string): string {
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  return `${dateStr}, ${time}`;
}

export function isDateToday(date: Date | string): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function isDateTomorrow(date: Date | string): boolean {
  const d = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  );
}

export function isDateYesterday(date: Date | string): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

export function daysUntil(date: Date | string): number {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getDayOfWeek(date: Date | string): number {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function getDayOfWeekFull(date: Date | string): string {
  const dayNum = getDayOfWeek(date);
  return DAY_OF_WEEK_LABELS[dayNum] || '';
}

export function getDayOfWeekShort(date: Date | string): string {
  const dayNum = getDayOfWeek(date);
  return DAY_OF_WEEK_SHORT[dayNum] || '';
}

export function isWeekend(date: Date | string): boolean {
  const day = getDayOfWeek(date);
  return day === 6 || day === 7;
}

export function getWeekRange(date: Date | string): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  const endStr = end.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  return `${startStr} - ${endStr}`;
}

export function toISODate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

export function isTimeBetween(
  time: string,
  start: string,
  end: string,
): boolean {
  const { hours: h, minutes: m } = parseTime(time);
  const { hours: sh, minutes: sm } = parseTime(start);
  const { hours: eh, minutes: em } = parseTime(end);
  const timeMinutes = h * 60 + m;
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}
