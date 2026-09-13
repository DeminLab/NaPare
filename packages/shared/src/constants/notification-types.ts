export const NOTIFICATION_TYPES = {
  SCHEDULE_CHANGE: 'schedule_change',
  NEW_ANNOUNCEMENT: 'new_announcement',
  NEW_HOMEWORK: 'new_homework',
  NEW_FILE: 'new_file',
  DEADLINE: 'deadline',
  ABSENCE_DECISION: 'absence_decision',
  NEW_ABSENCE: 'new_absence',
  SYSTEM: 'system',
  OTHER: 'other',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.SCHEDULE_CHANGE]: 'Изменение в расписании',
  [NOTIFICATION_TYPES.NEW_ANNOUNCEMENT]: 'Новое объявление',
  [NOTIFICATION_TYPES.NEW_HOMEWORK]: 'Новое задание',
  [NOTIFICATION_TYPES.NEW_FILE]: 'Новый файл',
  [NOTIFICATION_TYPES.DEADLINE]: 'Дедлайн',
  [NOTIFICATION_TYPES.ABSENCE_DECISION]: 'Решение по пропуску',
  [NOTIFICATION_TYPES.NEW_ABSENCE]: 'Новый пропуск',
  [NOTIFICATION_TYPES.SYSTEM]: 'Системное',
  [NOTIFICATION_TYPES.OTHER]: 'Другое',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.SCHEDULE_CHANGE]: 'calendar',
  [NOTIFICATION_TYPES.NEW_ANNOUNCEMENT]: 'megaphone',
  [NOTIFICATION_TYPES.NEW_HOMEWORK]: 'file-text',
  [NOTIFICATION_TYPES.NEW_FILE]: 'paperclip',
  [NOTIFICATION_TYPES.DEADLINE]: 'alert-triangle',
  [NOTIFICATION_TYPES.ABSENCE_DECISION]: 'check-circle',
  [NOTIFICATION_TYPES.NEW_ABSENCE]: 'user-x',
  [NOTIFICATION_TYPES.SYSTEM]: 'settings',
  [NOTIFICATION_TYPES.OTHER]: 'bell',
};
