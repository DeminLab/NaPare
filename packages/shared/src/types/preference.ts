export interface UserPreference {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: 'ru' | 'en';
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt: Date;
  updatedAt: Date;
}
