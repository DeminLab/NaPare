export const LESSON_CHANGE_TYPES = {
  MOVED: 'moved',
  CANCELLED: 'cancelled',
  ROOM_CHANGED: 'room_changed',
  TEACHER_CHANGED: 'teacher_changed',
  ADDED: 'added',
} as const;

export type LessonChangeType = (typeof LESSON_CHANGE_TYPES)[keyof typeof LESSON_CHANGE_TYPES];

export const LESSON_CHANGE_TYPE_LABELS: Record<LessonChangeType, string> = {
  [LESSON_CHANGE_TYPES.MOVED]: 'Перенесено',
  [LESSON_CHANGE_TYPES.CANCELLED]: 'Отменено',
  [LESSON_CHANGE_TYPES.ROOM_CHANGED]: 'Изменена аудитория',
  [LESSON_CHANGE_TYPES.TEACHER_CHANGED]: 'Изменён преподаватель',
  [LESSON_CHANGE_TYPES.ADDED]: 'Добавлено',
};

export const LESSON_CHANGE_TYPE_ICONS: Record<LessonChangeType, string> = {
  [LESSON_CHANGE_TYPES.MOVED]: 'clock',
  [LESSON_CHANGE_TYPES.CANCELLED]: 'x-circle',
  [LESSON_CHANGE_TYPES.ROOM_CHANGED]: 'map-pin',
  [LESSON_CHANGE_TYPES.TEACHER_CHANGED]: 'user',
  [LESSON_CHANGE_TYPES.ADDED]: 'plus-circle',
};

export const LESSON_CHANGE_TYPE_COLORS: Record<LessonChangeType, string> = {
  [LESSON_CHANGE_TYPES.MOVED]: '#FF922B',
  [LESSON_CHANGE_TYPES.CANCELLED]: '#FA5252',
  [LESSON_CHANGE_TYPES.ROOM_CHANGED]: '#339AF0',
  [LESSON_CHANGE_TYPES.TEACHER_CHANGED]: '#BE4BDB',
  [LESSON_CHANGE_TYPES.ADDED]: '#40C057',
};
