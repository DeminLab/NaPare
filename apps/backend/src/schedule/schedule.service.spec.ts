import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { ScheduleService } from "./schedule.service";
import { UserRole } from "../auth/interfaces/user-role";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Lesson } from "./entities/lesson.entity";
import { LessonChange } from "./entities/lesson-change.entity";
import { Group } from "../users/entities/group.entity";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TenantContext } from "../common/tenant/tenant-context";
import { DataSource } from "typeorm";
import { RaspScraperService } from "../auth/rasp-scraper.service";

describe("ScheduleService", () => {
  let service: ScheduleService;

  const mockLessonRepo = {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: "1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockChangeRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
  const mockGroupRepo = { findOne: jest.fn().mockResolvedValue(null) };
  const mockRaspScraper = { getSchedule: jest.fn().mockResolvedValue([]) };
  const mockTenantContext = { assertAccess: jest.fn(), getUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepo },
        { provide: getRepositoryToken(LessonChange), useValue: mockChangeRepo },
        { provide: getRepositoryToken(Group), useValue: mockGroupRepo },
        { provide: RaspScraperService, useValue: mockRaspScraper },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: TenantContext, useValue: mockTenantContext },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    jest.clearAllMocks();
    mockGroupRepo.findOne.mockResolvedValue(null);
    mockRaspScraper.getSchedule.mockResolvedValue([]);
    mockTenantContext.getUser.mockReturnValue(undefined);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findById", () => {
    it("should throw if lesson not found", async () => {
      mockLessonRepo.findOne.mockResolvedValue(null);
      await expect(service.findById("nonexistent")).rejects.toThrow(
        "Lesson with id nonexistent not found",
      );
    });

    it("should return lesson if found", async () => {
      const lesson = { id: "1", subject: "Math" };
      mockLessonRepo.findOne.mockResolvedValue(lesson);
      const result = await service.findById("1");
      expect(result).toEqual(lesson);
    });
  });

  describe("findAccessibleById", () => {
    it("does not expose another group's lesson to a student", async () => {
      mockLessonRepo.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        groupId: "group-2",
      });

      await expect(
        service.findAccessibleById("lesson-1", {
          id: "student-1",
          universityId: "uni-1",
          role: UserRole.STUDENT,
          groupId: "group-1",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("does not expose another teacher's lesson", async () => {
      mockLessonRepo.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        teacherId: "teacher-2",
      });

      await expect(
        service.findAccessibleById("lesson-1", {
          id: "teacher-1",
          universityId: "uni-1",
          role: UserRole.TEACHER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("student schedule scope", () => {
    it("filters the database fallback by the student group", async () => {
      await service.findForStudentDateRange(
        "uni-1",
        "group-1",
        "2026-09-26",
        "2026-10-02",
      );

      expect(mockLessonRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            universityId: "uni-1",
            groupId: "group-1",
          }),
        }),
      );
    });

    it("uses an imported group for a still-numeric source group id", async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: "group-uuid" });

      await service.findForStudentDateRange(
        "uni-1",
        "12136",
        "2026-09-26",
        "2026-10-02",
      );

      expect(mockGroupRepo.findOne).toHaveBeenCalledWith({
        where: { universityId: "uni-1", externalId: "12136" },
      });
      expect(mockLessonRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: "group-uuid" }),
        }),
      );
    });

    it("filters SIBIT lessons by the calendar-day portions of timezone-adjusted bounds", async () => {
      mockRaspScraper.getSchedule.mockResolvedValue([
        {
          lessonId: "previous-local-day",
          groupId: "12136",
          groupName: "ГМУ-25",
          date: "2026-09-28",
          dayOfWeek: 1,
          startTime: "20:00",
          endTime: "21:00",
          pairNumber: 1,
          weekType: "both",
          subject: "Вчера",
        },
        {
          lessonId: "local-day",
          groupId: "12136",
          groupName: "ГМУ-25",
          date: "2026-09-29",
          dayOfWeek: 2,
          startTime: "02:00",
          endTime: "03:00",
          pairNumber: 1,
          weekType: "both",
          subject: "Сегодня",
        },
      ]);

      const result = await service.findForStudentDateRange(
        "uni-1",
        "12136",
        "2026-09-28T18:00:00.000Z",
        "2026-10-29T17:59:59.999Z",
        undefined,
        "Asia/Omsk",
      );

      expect(result.data.map((lesson) => lesson.id)).toEqual([
        "rasp-local-day-12136",
      ]);
    });
  });


  describe("inclusive schedule ranges", () => {
    it.each(["student", "teacher", "university"])("includes lessons on the final calendar day for %s", async (role) => {
      if (role === "student") await service.findForStudentDateRange("uni-1", "group-1", "2026-10-05", "2026-10-11");
      else if (role === "teacher") await service.findByTeacherDateRange("uni-1", "teacher-1", "2026-10-05", "2026-10-11");
      else await service.findByDateRange("uni-1", "2026-10-05", "2026-10-11");
      const options = mockLessonRepo.findAndCount.mock.calls[0][0];
      expect(options.where.startDate.value.map((date: Date) => date.toISOString())).toEqual(["2026-10-05T00:00:00.000Z", "2026-10-11T23:59:59.999Z"]);
      expect(options.where.universityId).toBe("uni-1");
      if (role === "student") expect(options.where.groupId).toBe("group-1");
      if (role === "teacher") expect(options.where.teacherId).toBe("teacher-1");
    });
    it("preserves explicit timezone-adjusted timestamps from My Day", async () => {
      await service.findForStudentDateRange("uni-1", "group-1", "2026-10-10T18:00:00.000Z", "2026-10-11T17:59:59.999Z");
      const options = mockLessonRepo.findAndCount.mock.calls[0][0];
      expect(options.where.startDate.value.map((date: Date) => date.toISOString())).toEqual(["2026-10-10T18:00:00.000Z", "2026-10-11T17:59:59.999Z"]);
    });
  });

  describe("create", () => {
    it("should create and save a lesson", async () => {
      const dto = {
        subject: "Math",
        groupId: "g1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:30",
        pairNumber: 1,
        startDate: new Date(),
        endDate: new Date(),
      };
      const result = await service.create(dto as any);
      expect(result.id).toBe("1");
      expect(mockLessonRepo.save).toHaveBeenCalled();
    });

    it("rejects a teacher attempting to create a lesson for a colleague", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });

      await expect(
        service.create({
          subject: "Math",
          groupId: "g1",
          teacherId: "teacher-2",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:30",
          pairNumber: 1,
          startDate: new Date(),
          endDate: new Date(),
        } as any),
      ).rejects.toThrow(ForbiddenException);

      expect(mockLessonRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete a lesson", async () => {
      mockLessonRepo.findOne.mockResolvedValue({
        id: "1",
        universityId: "uni-1",
      });
      await service.delete("1");
      expect(mockLessonRepo.delete).toHaveBeenCalledWith("1");
    });

    it("rejects a teacher deleting a colleague's lesson", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        universityId: "uni-1",
      });
      mockLessonRepo.findOne.mockResolvedValue({
        id: "lesson-1",
        universityId: "uni-1",
        teacherId: "teacher-2",
      });

      await expect(service.delete("lesson-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockLessonRepo.delete).not.toHaveBeenCalled();
    });
  });
});
