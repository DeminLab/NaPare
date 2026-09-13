export const NOTIFICATION_CHANNELS = {
  PUSH: 'push',
  EMAIL: 'email',
  IN_APP: 'in_app',
} as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export const FILE_TYPES = {
  PDF: 'pdf',
  DOC: 'doc',
  DOCX: 'docx',
  PPT: 'ppt',
  PPTX: 'pptx',
  JPG: 'jpg',
  PNG: 'png',
} as const;

export type FileType = (typeof FILE_TYPES)[keyof typeof FILE_TYPES];

export const ALLOWED_FILE_TYPES: FileType[] = [
  FILE_TYPES.PDF,
  FILE_TYPES.DOC,
  FILE_TYPES.DOCX,
  FILE_TYPES.PPT,
  FILE_TYPES.PPTX,
  FILE_TYPES.JPG,
  FILE_TYPES.PNG,
];

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const DEVICE_PLATFORMS = {
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web',
} as const;

export type DevicePlatform = (typeof DEVICE_PLATFORMS)[keyof typeof DEVICE_PLATFORMS];
