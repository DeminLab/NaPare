import { Test, TestingModule } from "@nestjs/testing";
import { NotificationsService } from "./notifications.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Notification } from "./entities/notification.entity";
import { DeviceToken } from "./entities/device-token.entity";
import { NotificationPreference } from "./entities/notification-preference.entity";
import { InboxItem } from "./entities/inbox-item.entity";
import { TenantContext } from "../common/tenant/tenant-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { EventEnvelope } from "../events/event.types";

describe("NotificationsService", () => {
  let service: NotificationsService;

  const mockNotificationRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest
      .fn()
      .mockResolvedValue({ id: "notif-1", universityId: "uni-1" }),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((dto) => ({ id: "1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn(),
  };

  const mockDeviceTokenRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: "1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    delete: jest.fn(),
  };
  const mockPreferenceRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockImplementation((dto) => ({ id: "preference-1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  };
  const mockInboxRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: "inbox-1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn(),
  };

  const mockTenantContext = { assertAccess: jest.fn(), getUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(DeviceToken),
          useValue: mockDeviceTokenRepo,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferenceRepo,
        },
        { provide: getRepositoryToken(InboxItem), useValue: mockInboxRepo },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockPreferenceRepo.findOne.mockResolvedValue(null);
    mockTenantContext.getUser.mockReturnValue(undefined);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getUnreadCount", () => {
    it("should return unread count", async () => {
      mockNotificationRepo.count.mockResolvedValue(5);
      const result = await service.getUnreadCount("user-1");
      expect(result).toBe(5);
    });
  });

  describe("findInbox", () => {
    it("uses deterministic ordering and clamps pagination while preserving tenant scope", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "user-1",
        role: "teacher",
        universityId: "uni-1",
      });

      await service.findInbox("user-1", "open", 200.8, -4);

      expect(mockInboxRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "open", universityId: "uni-1" },
        order: { createdAt: "DESC", id: "DESC" },
        skip: 0,
        take: 100,
      });
    });

    it("defaults an invalid offset to the first page", async () => {
      await service.findInbox("user-1", undefined, 50, Number.NaN);

      expect(mockInboxRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        skip: 0,
        take: 50,
      }));
    });
  });

  describe("markAsRead", () => {
    it("should update notification as read", async () => {
      mockNotificationRepo.findOne.mockResolvedValue({
        id: "notif-1",
        userId: "user-1",
        universityId: "uni-1",
      });
      mockTenantContext.getUser.mockReturnValue({
        id: "user-1",
        universityId: "uni-1",
      });
      await service.markAsRead("notif-1", "user-1");
      expect(mockNotificationRepo.update).toHaveBeenCalledWith("notif-1", {
        isRead: true,
        readAt: expect.any(Date),
      });
    });

    it("does not let a user mark a colleague's notification as read", async () => {
      mockNotificationRepo.findOne.mockResolvedValue({
        id: "notif-2",
        userId: "user-2",
        universityId: "uni-1",
      });
      mockTenantContext.getUser.mockReturnValue({
        id: "user-1",
        universityId: "uni-1",
      });

      await expect(service.markAsRead("notif-2", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockNotificationRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("registerDeviceToken", () => {
    it("should create new device token", async () => {
      mockDeviceTokenRepo.findOne.mockResolvedValue(null);
      const result = await service.registerDeviceToken(
        "user-1",
        "token-1",
        "ios",
      );
      expect(result.token).toBe("token-1");
    });

    it("should update existing token", async () => {
      const existing = { id: "1", token: "token-1", isActive: false };
      mockDeviceTokenRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, isActive: true });
      const result = await service.registerDeviceToken(
        "user-1",
        "token-1",
        "ios",
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe("processEvent", () => {
    it("includes the actual old and new room values in schedule notifications", async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);
      const event: EventEnvelope = {
        id: "room-change-1",
        type: "room.changed",
        actor: { type: "system" },
        timestamp: "2026-09-28T08:00:00.000Z",
        university: { id: "uni-1" },
        target: { type: "lesson", id: "lesson-1" },
        payload: {
          subject: "Программирование",
          oldValue: { building: "1", room: "302" },
          newValue: { building: "2", room: "504" },
          deepLink: "/pair-space/lesson-1",
        },
        priority: "high",
      };

      await service.processEvent(event, ["student-1"]);

      expect(mockNotificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        userId: "student-1",
        body: "«Программирование»: Место: корпус 1, ауд. 302 → корпус 2, ауд. 504.",
        deepLink: "/pair-space/lesson-1",
      }));
      expect(mockInboxRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        userId: "student-1",
        description: "«Программирование»: Место: корпус 1, ауд. 302 → корпус 2, ауд. 504. Открой занятие, чтобы посмотреть контекст.",
        deepLink: "/pair-space/lesson-1",
      }));
    });

    it("applies quiet hours in the user's saved timezone", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-28T08:00:00.000Z"));
      mockPreferenceRepo.findOne.mockResolvedValue({
        userId: "user-1",
        universityId: "uni-1",
        deadlines: true,
        quietHoursEnabled: true,
        quietHoursStart: "13:00",
        quietHoursEnd: "15:00",
        timeZone: "Asia/Omsk",
      });
      mockNotificationRepo.findOne.mockResolvedValue(null);
      const event: EventEnvelope = {
        id: "event-deadline-1",
        type: "homework.deadline_soon",
        actor: { type: "system" },
        timestamp: "2026-09-28T08:00:00.000Z",
        university: { id: "uni-1" },
        target: { type: "homework", id: "homework-1" },
        payload: {},
        priority: "normal",
      };

      try {
        await service.processEvent(event, ["user-1"]);
        expect(mockNotificationRepo.save).not.toHaveBeenCalled();
        expect(mockInboxRepo.save).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("rejects invalid IANA timezones in preference updates", async () => {
      await expect(
        service.updatePreferences("user-1", "uni-1", { timeZone: "Not/A-Timezone" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("uses a recipient-specific deep link for every notification and inbox item", async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);
      const event: EventEnvelope = {
        id: "absence-event-1",
        type: "absence.created",
        actor: { id: "student-1", type: "user", role: "student" },
        timestamp: "2026-09-26T10:00:00.000Z",
        university: { id: "uni-1" },
        target: { type: "absence", id: "absence-1" },
        payload: {
          deepLink: "/notifications",
          recipientDeepLinks: {
            "student-1": "/today",
            "curator-1": "/absences?absence=absence-1",
          },
        },
        priority: "normal",
      };

      await service.processEvent(event, ["student-1", "curator-1"]);

      expect(mockNotificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "student-1",
          deepLink: "/today",
          actions: [{ label: "Открыть", href: "/today" }],
        }),
      );
      expect(mockNotificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "curator-1",
          deepLink: "/absences?absence=absence-1",
          actions: [{ label: "Открыть", href: "/absences?absence=absence-1" }],
        }),
      );
      expect(mockInboxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "student-1",
          deepLink: "/today",
        }),
      );
      expect(mockInboxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "curator-1",
          deepLink: "/absences?absence=absence-1",
        }),
      );
    });
  });
});
