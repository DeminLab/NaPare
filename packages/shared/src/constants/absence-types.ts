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
  [ABSENCE_TYPES.SICK]: 'Болею',
  [ABSENCE_TYPES.WORK]: 'Работаю',
  [ABSENCE_TYPES.OTHER_CITY]: 'В другом городе',
  [ABSENCE_TYPES.OTHER]: 'Другая причина',
};

export const ABSENCE_TYPE_COLORS: Record<AbsenceType, string> = {
  [ABSENCE_TYPES.LEARNING]: '#40C057',
  [ABSENCE_TYPES.SICK]: '#FA5252',
  [ABSENCE_TYPES.WORK]: '#339AF0',
  [ABSENCE_TYPES.OTHER_CITY]: '#BE4BDB',
  [ABSENCE_TYPES.OTHER]: '#868E96',
};

export const ABSENCE_TYPE_ICONS: Record<AbsenceType, string> = {
  [ABSENCE_TYPES.LEARNING]: 'book-open',
  [ABSENCE_TYPES.SICK]: 'thermometer',
  [ABSENCE_TYPES.WORK]: 'briefcase',
  [ABSENCE_TYPES.OTHER_CITY]: 'map-pin',
  [ABSENCE_TYPES.OTHER]: 'help-circle',
};
