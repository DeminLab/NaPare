import { Test, TestingModule } from "@nestjs/testing";
import { AbsencesService } from "./absences.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Absence } from "./entities/absence.entity";
import { AttendanceRecord } from "./entities/attendance-record.entity";
import { AttendanceQrSession } from "./entities/attendance-qr-session.entity";
import { Lesson } from "../schedule/entities/lesson.entity";
import { User } from "../users/entities/user.entity";
import { Group } from "../users/entities/group.entity";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { TenantContext } from "../common/tenant/tenant-context";
import { UserRole } from "../auth/interfaces/user-role";

describe("AbsencesService", () => {
  let service: AbsencesService;

  const mockRepo = {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: "1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const mockTenantContext = {
    assertAccess: jest.fn(),
    getUser: jest.fn(),
  };
  const mockAttendanceRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest
      .fn()
      .mockImplementation((dto) => ({ id: "attendance-1", ...dto })),
    save: jest.fn().mockImplementation((records) => Promise.resolve(records)),
  };
  const mockAttendanceQrSessionRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: "qr-session-1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  const mockLessonRepository = { findOne: jest.fn().mockResolvedValue(null) };
  const mockUserRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const mockGroupRepository = { findOne: jest.fn().mockResolvedValue(null) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbsencesService,
        { provide: getRepositoryToken(Absence), useValue: mockRepo },
        {
          provide: getRepositoryToken(AttendanceRecord),
          useValue: mockAttendanceRepository,
        },
        {
          provide: getRepositoryToken(AttendanceQrSession),
          useValue: mockAttendanceQrSessionRepository,
        },
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Group), useValue: mockGroupRepository },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<AbsencesService>(AbsencesService);
    jest.clearAllMocks();
    mockRepo.findAndCount.mockResolvedValue([[], 0]);
    mockRepo.findOne.mockResolvedValue(null);
    mockAttendanceRepository.find.mockResolvedValue([]);
    mockAttendanceRepository.findOne.mockResolvedValue(null);
    mockLessonRepository.findOne.mockResolvedValue(null);
    mockUserRepository.find.mockResolvedValue([]);
    mockUserRepository.findOne.mockResolvedValue(null);
    mockGroupRepository.findOne.mockResolvedValue(null);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findByStudent", () => {
    it("should return absences for student", async () => {
      const absences = [{ id: "1", studentId: "s1" }];
      mockRepo.findAndCount.mockResolvedValue([absences, 1]);
      const result = await service.findByStudent("s1");
      expect(result).toEqual({
        data: absences,
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });
    });

    it("does not expose a student history to a teacher without a lesson for that group", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: "student-1",
        universityId: "uni-1",
        groupId: "group-2",
        role: UserRole.STUDENT,
      });
      mockLessonRepository.findOne.mockResolvedValue(null);

      await expect(service.findByStudent("student-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.findAndCount).not.toHaveBeenCalled();
    });

    it("allows a teacher to read a student history only for a taught group", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: "student-1",
        universityId: "uni-1",
        groupId: "group-1",
        role: UserRole.STUDENT,
      });
      mockLessonRepository.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        groupId: "group-1",
        teacherId: "teacher-1",
      });

      await expect(service.findByStudent("student-1")).resolves.toMatchObject({
        meta: expect.objectContaining({ total: 0 }),
      });
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: "student-1", universityId: "uni-1" },
        }),
      );
    });
  });

  describe("confirm", () => {
    it("should throw NotFoundException if absence not found", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.confirm("nonexistent", "curator-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should confirm absence", async () => {
      const absence = {
        id: "1",
        universityId: "uni-1",
        confirmationRequired: true,
      };
      mockRepo.findOne.mockResolvedValue(absence);
      mockTenantContext.getUser.mockReturnValue({
        id: "curator-1",
        role: UserRole.CURATOR,
        universityId: "uni-1",
      });
      const result = await service.confirm("1", "curator-1");
      expect(result.confirmationRequired).toBe(false);
    });

    it("rejects a student confirmation attempt", async () => {
      mockRepo.findOne.mockResolvedValue({ id: "1", universityId: "uni-1" });
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });

      await expect(service.confirm("1", "student-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejects a teacher confirmation for a colleague's lesson", async () => {
      mockRepo.findOne.mockResolvedValue({
        id: "absence-1",
        universityId: "uni-1",
        confirmationRequired: true,
        affectedLessonIds: ["lesson-1"],
      });
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepository.findOne.mockResolvedValue(null);

      await expect(service.confirm("absence-1", "teacher-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("findPendingForCurrentUniversity", () => {
    it("includes a minimal student identity for university reviewers", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "admin-1",
        role: UserRole.UNIVERSITY_ADMIN,
        universityId: "uni-1",
      });
      mockRepo.findAndCount.mockResolvedValue([
        [
          {
            id: "absence-1",
            studentId: "student-1",
            universityId: "uni-1",
            confirmationRequired: true,
          },
        ],
        1,
      ]);
      mockUserRepository.find.mockResolvedValue([
        {
          id: "student-1",
          firstName: "Ирина",
          lastName: "Иванова",
          groupId: "group-1",
        },
      ]);

      const result = await service.findPendingForCurrentUniversity();

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: "absence-1",
          student: {
            id: "student-1",
            firstName: "Ирина",
            lastName: "Иванова",
            groupId: "group-1",
          },
        }),
      );
      expect(mockUserRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            universityId: "uni-1",
            role: UserRole.STUDENT,
          }),
        }),
      );
    });
  });

  describe("reject", () => {
    it("resolves the pending queue while preserving the decision comment", async () => {
      const absence = {
        id: "absence-1",
        universityId: "uni-1",
        confirmationRequired: true,
        comment: null,
      };
      mockRepo.findOne.mockResolvedValue(absence);
      mockTenantContext.getUser.mockReturnValue({
        id: "curator-1",
        role: UserRole.CURATOR,
        universityId: "uni-1",
      });

      const result = await service.reject(
        "absence-1",
        "curator-1",
        "Нужна справка деканата",
      );

      expect(result).toEqual(
        expect.objectContaining({
          confirmationRequired: false,
          comment: "Нужна справка деканата",
        }),
      );
    });
  });

  describe("create", () => {
    it("persists the date-range absence fields for the authenticated student", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });
      const dto = {
        type: "sick",
        startDate: "2026-09-16",
        endDate: "2026-09-18",
        comment: "Medical leave",
      } as unknown as import("./dto/create-absence.dto").CreateAbsenceDto;

      await service.create(dto, "uni-1");

      expect(mockRepo.create).toHaveBeenCalledWith({
        studentId: "student-1",
        universityId: "uni-1",
        type: "sick",
        startDate: new Date("2026-09-16"),
        endDate: new Date("2026-09-18"),
        comment: "Medical leave",
        source: "manual",
        syncStatus: "synced",
      });
    });

    it("links a student absence to their own lesson and notifies its teacher", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
        groupId: "group-1",
      });
      mockLessonRepository.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        groupId: "group-1",
        teacherId: "teacher-1",
      });

      await service.create(
        {
          type: "learning",
          startDate: "2026-09-26",
          endDate: "2026-09-26",
          lessonId: "lesson-1",
        },
        "uni-1",
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          affectedLessonIds: ["lesson-1"],
          affectedLessonsCount: 1,
        }),
      );
    });

    it("links an imported lesson when the student token still has a numeric SIBIT group id", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
        groupId: "12136",
      });
      mockGroupRepository.findOne.mockResolvedValue({ id: "group-uuid" });
      mockLessonRepository.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        groupId: "group-uuid",
        teacherId: "teacher-1",
      });

      await expect(
        service.create(
          {
            type: "learning",
            startDate: "2026-09-26",
            endDate: "2026-09-26",
            lessonId: "lesson-1",
          },
          "uni-1",
        ),
      ).resolves.toMatchObject({ id: "1" });
      expect(mockGroupRepository.findOne).toHaveBeenCalledWith({
        where: { universityId: "uni-1", externalId: "12136" },
      });
    });

    it("rejects an absence whose end date is before its start date", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });

      await expect(
        service.create(
          {
            type: "sick",
            startDate: "2026-09-20",
            endDate: "2026-09-19",
          },
          "uni-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rejects a student update of another student's absence", async () => {
      mockRepo.findOne.mockResolvedValue({
        id: "absence-1",
        studentId: "student-2",
        universityId: "uni-1",
      });
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });

      await expect(service.update("absence-1", {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("markAttendance", () => {
    it("persists every selected attendance status for students in the lesson group", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepository.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        groupId: "group-1",
        teacherId: "teacher-1",
      });
      mockUserRepository.find.mockResolvedValue([
        { id: "student-1" },
        { id: "student-2" },
      ]);

      const result = await service.markAttendance("uni-1", "teacher-1", {
        lessonId: "lesson-1",
        entries: [
          { studentId: "student-1", status: "present" },
          {
            studentId: "student-2",
            status: "late",
            comment: "Пришёл после начала пары",
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(mockAttendanceRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            studentId: "student-1",
            status: "present",
            markedById: "teacher-1",
          }),
          expect.objectContaining({
            studentId: "student-2",
            status: "late",
            comment: "Пришёл после начала пары",
          }),
        ]),
      );
    });

    it("rejects a teacher trying to mark another teacher's lesson", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepository.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        groupId: "group-1",
        teacherId: "teacher-2",
      });

      await expect(
        service.markAttendance("uni-1", "teacher-1", {
          lessonId: "lesson-1",
          entries: [{ studentId: "student-1", status: "present" }],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockAttendanceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("attendance QR check-in", () => {
    const activeSession = {
      id: "qr-1",
      universityId: "uni-1",
      lessonId: "lesson-1",
      createdById: "teacher-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const lesson = {
      id: "lesson-1",
      universityId: "uni-1",
      groupId: "group-1",
      teacherId: "teacher-1",
      startDate: new Date(Date.now() - 5 * 60_000),
      endDate: new Date(Date.now() + 40 * 60_000),
    };

    it("creates a 90-second QR session for a teacher's current lesson", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepository.findOne.mockResolvedValue(lesson);

      const result = await service.createAttendanceQrSession("uni-1", "teacher-1", "lesson-1");

      expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(result.lessonId).toBe("lesson-1");
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 80_000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 90_000);
      expect(mockAttendanceQrSessionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        universityId: "uni-1",
        lessonId: "lesson-1",
        createdById: "teacher-1",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedAt: null,
      }));
      const persisted = mockAttendanceQrSessionRepository.create.mock.calls[0][0];
      expect(persisted.tokenHash).not.toBe(result.token);
      expect(mockAttendanceQrSessionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ universityId: "uni-1", lessonId: "lesson-1" }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it("rejects a teacher who does not own the lesson", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepository.findOne.mockResolvedValue({ ...lesson, teacherId: "teacher-2" });

      await expect(service.createAttendanceQrSession("uni-1", "teacher-1", "lesson-1"))
        .rejects.toThrow(ForbiddenException);
      expect(mockAttendanceQrSessionRepository.save).not.toHaveBeenCalled();
    });

    it("rejects QR creation outside the lesson time window", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepository.findOne.mockResolvedValue({
        ...lesson,
        startDate: new Date(Date.now() + 60 * 60_000),
        endDate: new Date(Date.now() + 2 * 60 * 60_000),
      });

      await expect(service.createAttendanceQrSession("uni-1", "teacher-1", "lesson-1"))
        .rejects.toThrow(BadRequestException);
      expect(mockAttendanceQrSessionRepository.save).not.toHaveBeenCalled();
    });

    it("marks a student in the lesson group exactly once", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });
      mockAttendanceQrSessionRepository.findOne.mockResolvedValue(activeSession);
      mockLessonRepository.findOne.mockResolvedValue(lesson);
      mockUserRepository.findOne.mockResolvedValue({
        id: "student-1",
        universityId: "uni-1",
        role: UserRole.STUDENT,
        groupId: "group-1",
      });

      await expect(service.checkInWithAttendanceQr("raw-qr-token")).resolves.toEqual({
        lessonId: "lesson-1",
        status: "present",
        alreadyMarked: false,
      });
      expect(mockAttendanceQrSessionRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          universityId: "uni-1",
          revokedAt: expect.anything(),
          expiresAt: expect.anything(),
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }));
      expect(mockAttendanceRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        universityId: "uni-1",
        lessonId: "lesson-1",
        studentId: "student-1",
        status: "present",
        markedById: "teacher-1",
      }));
    });

    it("rejects a student from another group before writing attendance", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });
      mockAttendanceQrSessionRepository.findOne.mockResolvedValue(activeSession);
      mockLessonRepository.findOne.mockResolvedValue({ ...lesson, groupId: "group-2" });
      mockUserRepository.findOne.mockResolvedValue({
        id: "student-1",
        universityId: "uni-1",
        role: UserRole.STUDENT,
        groupId: "group-1",
      });

      await expect(service.checkInWithAttendanceQr("raw-qr-token")).rejects.toThrow(ForbiddenException);
      expect(mockAttendanceRepository.save).not.toHaveBeenCalled();
    });

    it("returns the existing present record without creating a duplicate", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });
      mockAttendanceQrSessionRepository.findOne.mockResolvedValue(activeSession);
      mockLessonRepository.findOne.mockResolvedValue(lesson);
      mockUserRepository.findOne.mockResolvedValue({
        id: "student-1",
        universityId: "uni-1",
        role: UserRole.STUDENT,
        groupId: "group-1",
      });
      mockAttendanceRepository.findOne.mockResolvedValue({ status: "present" });

      await expect(service.checkInWithAttendanceQr("raw-qr-token")).resolves.toEqual({
        lessonId: "lesson-1",
        status: "present",
        alreadyMarked: true,
      });
      expect(mockAttendanceRepository.save).not.toHaveBeenCalled();
    });

    it("returns success when a concurrent scan wins the unique attendance insert", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });
      mockAttendanceQrSessionRepository.findOne.mockResolvedValue(activeSession);
      mockLessonRepository.findOne.mockResolvedValue(lesson);
      mockUserRepository.findOne.mockResolvedValue({
        id: "student-1",
        universityId: "uni-1",
        role: UserRole.STUDENT,
        groupId: "group-1",
      });
      mockAttendanceRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: "present" });
      mockAttendanceRepository.save.mockRejectedValueOnce({ driverError: { code: "23505" } });

      await expect(service.checkInWithAttendanceQr("raw-qr-token")).resolves.toEqual({
        lessonId: "lesson-1",
        status: "present",
        alreadyMarked: true,
      });
      expect(mockAttendanceRepository.save).toHaveBeenCalledTimes(1);
      expect(mockAttendanceRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it("rejects an expired or revoked QR session", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });
      mockAttendanceQrSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.checkInWithAttendanceQr("raw-qr-token")).rejects.toThrow(UnauthorizedException);
      expect(mockAttendanceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should throw NotFoundException if absence not found", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.delete("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejects a student deletion of another student's absence", async () => {
      mockRepo.findOne.mockResolvedValue({
        id: "absence-1",
        studentId: "student-2",
        universityId: "uni-1",
      });
      mockTenantContext.getUser.mockReturnValue({
        id: "student-1",
        role: UserRole.STUDENT,
        universityId: "uni-1",
      });

      await expect(service.delete("absence-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
