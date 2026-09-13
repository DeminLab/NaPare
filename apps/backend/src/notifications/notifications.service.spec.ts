import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotificationRepo = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn(),
  };

  const mockDeviceTokenRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(DeviceToken), useValue: mockDeviceTokenRepo },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockNotificationRepo.count.mockResolvedValue(5);
      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should update notification as read', async () => {
      await service.markAsRead('notif-1');
      expect(mockNotificationRepo.update).toHaveBeenCalledWith('notif-1', {
        isRead: true,
        readAt: expect.any(Date),
      });
    });
  });

  describe('registerDeviceToken', () => {
    it('should create new device token', async () => {
      mockDeviceTokenRepo.findOne.mockResolvedValue(null);
      const result = await service.registerDeviceToken('user-1', 'token-1', 'ios');
      expect(result.token).toBe('token-1');
    });

    it('should update existing token', async () => {
      const existing = { id: '1', token: 'token-1', isActive: false };
      mockDeviceTokenRepo.findOne.mockResolvedValue(existing);
      const result = await service.registerDeviceToken('user-1', 'token-1', 'ios');
      expect(result.isActive).toBe(true);
    });
  });
});
