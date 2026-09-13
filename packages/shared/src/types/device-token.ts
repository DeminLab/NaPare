import { DevicePlatform } from '../constants/common';

export interface DeviceToken {
  id: string;
  userId: string;
  platform: DevicePlatform;
  token: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
