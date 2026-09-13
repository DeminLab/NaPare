export const LESSON_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type LessonStatus = (typeof LESSON_STATUS)[keyof typeof LESSON_STATUS];

export const WEEK_TYPES = {
  ODD: 'odd',
  EVEN: 'even',
  BOTH: 'both',
} as const;

export type WeekType = (typeof WEEK_TYPES)[keyof typeof WEEK_TYPES];

export const WEEK_TYPE_LABELS: Record<WeekType, string> = {
  [WEEK_TYPES.ODD]: 'Нечётная',
  [WEEK_TYPES.EVEN]: 'Чётная',
  [WEEK_TYPES.BOTH]: 'Каждая',
};

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

export const DAY_OF_WEEK = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  [DAY_OF_WEEK.MONDAY]: 'Понедельник',
  [DAY_OF_WEEK.TUESDAY]: 'Вторник',
  [DAY_OF_WEEK.WEDNESDAY]: 'Среда',
  [DAY_OF_WEEK.THURSDAY]: 'Четверг',
  [DAY_OF_WEEK.FRIDAY]: 'Пятница',
  [DAY_OF_WEEK.SATURDAY]: 'Суббота',
  [DAY_OF_WEEK.SUNDAY]: 'Воскресенье',
};

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  [DAY_OF_WEEK.MONDAY]: 'Пн',
  [DAY_OF_WEEK.TUESDAY]: 'Вт',
  [DAY_OF_WEEK.WEDNESDAY]: 'Ср',
  [DAY_OF_WEEK.THURSDAY]: 'Чт',
  [DAY_OF_WEEK.FRIDAY]: 'Пт',
  [DAY_OF_WEEK.SATURDAY]: 'Сб',
  [DAY_OF_WEEK.SUNDAY]: 'Вс',
};
