import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
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
import { LessonIdentifierService } from "../common/identifiers/lesson-identifier.service";

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
  const mockLessonIdentifiers = { resolvePersistedLessonId: jest.fn().mockResolvedValue(null) };
  const mockTenantContext = { assertAccess: jest.fn(), getUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepo },
        { provide: getRepositoryToken(LessonChange), useValue: mockChangeRepo },
        { provide: getRepositoryToken(Group), useValue: mockGroupRepo },
        { provide: RaspScraperService, useValue: mockRaspScraper },
        { provide: LessonIdentifierService, useValue: mockLessonIdentifiers },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: TenantContext, useValue: mockTenantContext },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    jest.clearAllMocks();
    mockGroupRepo.findOne.mockResolvedValue(null);
    mockRaspScraper.getSchedule.mockResolvedValue([]);
    mockLessonIdentifiers.resolvePersistedLessonId.mockResolvedValue(null);
    mockTenantContext.getUser.mockReturnValue(undefined);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findById", () => {
    it("should throw if lesson not found", async () => {
      mockLessonRepo.findOne.mockResolvedValue(null);
      const id = "10000000-0000-4000-8000-000000000001";
      await expect(service.findById(id)).rejects.toThrow(
        `Lesson with id ${id} not found`,
      );
    });

    it("should return lesson if found", async () => {
      const lesson = { id: "10000000-0000-4000-8000-000000000001", subject: "Math" };
      mockLessonRepo.findOne.mockResolvedValue(lesson);
      const result = await service.findById(lesson.id);
      expect(result).toEqual(lesson);
    });

    it("rejects malformed IDs before querying a UUID column", async () => {
      await expect(service.findById("12131")).rejects.toThrow(NotFoundException);
      expect(mockLessonRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe("findAccessibleById", () => {
    it("does not expose another group's lesson to a student", async () => {
      mockLessonRepo.findOne.mockResolvedValue({
        id: "10000000-0000-4000-8000-000000000001",
        organizationId: "uni-1",
        groupId: "group-2",
      });

      await expect(
        service.findAccessibleById("10000000-0000-4000-8000-000000000001", {
          id: "student-1",
          organizationId: "uni-1",
          role: UserRole.STUDENT,
          groupId: "group-1",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("does not expose another teacher's lesson", async () => {
      mockLessonRepo.findOne.mockResolvedValue({
        id: "10000000-0000-4000-8000-000000000001",
        organizationId: "uni-1",
        teacherId: "teacher-2",
      });

      await expect(
        service.findAccessibleById("10000000-0000-4000-8000-000000000001", {
          id: "teacher-1",
          organizationId: "uni-1",
          role: UserRole.TEACHER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("resolves a legacy RASP ID only for the student's own imported group", async () => {
      const localLessonId = "10000000-0000-4000-8000-000000000099";
      mockLessonIdentifiers.resolvePersistedLessonId.mockResolvedValue(localLessonId);
      mockLessonRepo.findOne.mockResolvedValue({
        id: localLessonId,
        organizationId: "uni-1",
        groupId: "group-uuid",
        subject: "Математика",
      });

      const result = await service.findAccessibleById("rasp-5725936-12131", {
        id: "student-1",
        organizationId: "uni-1",
        role: UserRole.STUDENT,
        groupId: "group-uuid",
      });

      expect(mockLessonIdentifiers.resolvePersistedLessonId).toHaveBeenCalledWith(
        "rasp-5725936-12131",
        "uni-1",
      );
      expect(mockLessonRepo.findOne).toHaveBeenCalledWith({
        where: { id: localLessonId, organizationId: "uni-1" },
      });
      expect(result.id).toBe(localLessonId);
    });

    it("does not resolve a legacy RASP ID for another group", async () => {
      await expect(service.findAccessibleById("rasp-5725936-12131", {
        id: "student-1",
        organizationId: "uni-1",
        role: UserRole.STUDENT,
        groupId: "12130",
      })).rejects.toThrow(NotFoundException);
      expect(mockRaspScraper.getSchedule).not.toHaveBeenCalled();
      expect(mockLessonRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe("student schedule scope", () => {
    it("keeps the legacy numeric group ID 101 on the external schedule path", async () => {
      mockRaspScraper.getSchedule.mockResolvedValue([{
        lessonId: "legacy-lesson",
        groupId: "101",
        groupName: "ИН-25",
        date: "2026-09-28",
        startTime: "09:00",
        endTime: "10:30",
        pairNumber: 1,
        subject: "История",
      }]);

      const result = await service.findForStudentDateRange(
        "uni-1", "101", "2026-09-28", "2026-09-28",
      );

      expect(mockRaspScraper.getSchedule).toHaveBeenCalledWith("101");
      expect(result.data.map((lesson) => lesson.id)).toEqual(["rasp-legacy-lesson-101"]);
      expect(mockLessonRepo.findAndCount).not.toHaveBeenCalled();
    });

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
            organizationId: "uni-1",
            groupId: "group-1",
          }),
        }),
      );
    });

    it("keeps using the external schedule when the group is imported locally", async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: "group-uuid", externalId: "12136" });
      mockRaspScraper.getSchedule.mockResolvedValue([{
        lessonId: "source-lesson",
        groupId: "12136",
        groupName: "ГМУ-25",
        date: "2026-09-28",
        startTime: "09:00",
        endTime: "10:30",
        pairNumber: 1,
        subject: "История",
      }]);

      const result = await service.findForStudentDateRange(
        "uni-1",
        "12136",
        "2026-09-26",
        "2026-10-02",
      );

      expect(mockRaspScraper.getSchedule).toHaveBeenCalledWith("12136");
      expect(mockGroupRepo.findOne).not.toHaveBeenCalled();
      expect(mockLessonRepo.findAndCount).not.toHaveBeenCalled();
      expect(result.data.map((lesson) => lesson.id)).toEqual(["rasp-source-lesson-12136"]);
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

    it("selects external lessons by instant when a viewer uses another time zone", async () => {
      mockRaspScraper.getSchedule.mockResolvedValue([{
        lessonId: "omsks-morning",
        groupId: "12136",
        groupName: "ГМУ-25",
        date: "2026-09-29",
        dayOfWeek: 2,
        startTime: "08:30",
        endTime: "10:00",
        pairNumber: 1,
        weekType: "both",
        subject: "Занятие в Омске",
      }]);
      const result = await service.findForStudentDateRange(
        "uni-1", "12136", "2026-09-28T07:00:00Z", "2026-09-29T06:59:59Z", undefined, "America/Los_Angeles",
      );
      expect(result.data).toMatchObject([{ date: "2026-09-29", startDate: new Date("2026-09-29T02:30:00Z") }]);
    });

    it("paginates SIBIT lessons without repeating records on later pages", async () => {
      mockRaspScraper.getSchedule.mockResolvedValue(
        Array.from({ length: 101 }, (_, index) => ({
          lessonId: `source-${index + 1}`,
          groupId: "12136",
          groupName: "ГМУ-25",
          date: "2026-09-28",
          startTime: "09:00",
          endTime: "10:30",
          pairNumber: index + 1,
          subject: `Занятие ${index + 1}`,
        })),
      );

      const firstPage = await service.findForStudentDateRange(
        "uni-1",
        "12136",
        "2026-09-28",
        "2026-09-28",
        { page: 1, limit: 100 } as any,
      );
      const secondPage = await service.findForStudentDateRange(
        "uni-1",
        "12136",
        "2026-09-28",
        "2026-09-28",
        { page: 2, limit: 100 } as any,
      );

      expect(firstPage.data).toHaveLength(100);
      expect(secondPage.data.map((lesson) => lesson.id)).toEqual([
        "rasp-source-101-12136",
      ]);
      expect(firstPage.meta).toEqual({ page: 1, limit: 100, total: 101, totalPages: 2 });
      expect(secondPage.meta).toEqual({ page: 2, limit: 100, total: 101, totalPages: 2 });
    });
  });


  describe("inclusive schedule ranges", () => {
    it.each(["student", "teacher", "university"])("includes lessons on the final calendar day for %s", async (role) => {
      if (role === "student") await service.findForStudentDateRange("uni-1", "group-1", "2026-10-05", "2026-10-11");
      else if (role === "teacher") await service.findByTeacherDateRange("uni-1", "teacher-1", "2026-10-05", "2026-10-11");
      else await service.findByDateRange("uni-1", "2026-10-05", "2026-10-11");
      const options = mockLessonRepo.findAndCount.mock.calls[0][0];
      expect(options.where.startDate.value.map((date: Date) => date.toISOString())).toEqual(["2026-10-05T00:00:00.000Z", "2026-10-11T23:59:59.999Z"]);
      expect(options.where.organizationId).toBe("uni-1");
      if (role === "student") expect(options.where.groupId).toBe("group-1");
      if (role === "teacher") expect(options.where.teacherId).toBe("teacher-1");
    });
    it("preserves explicit timezone-adjusted timestamps from My Day", async () => {
      await service.findForStudentDateRange("uni-1", "group-1", "2026-10-10T18:00:00.000Z", "2026-10-11T17:59:59.999Z");
      const options = mockLessonRepo.findAndCount.mock.calls[0][0];
      expect(options.where.startDate.value.map((date: Date) => date.toISOString())).toEqual(["2026-10-10T18:00:00.000Z", "2026-10-11T17:59:59.999Z"]);
    });
    it("uses the SIBIT external id even when a matching local group exists", async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: "local-group-uuid", externalId: "12131" });
      mockRaspScraper.getSchedule.mockResolvedValue([{
        lessonId: "lesson-1",
        groupId: "12131",
        groupName: "ИН-25",
        date: "2026-10-05",
        dayOfWeek: 1,
        dayName: "Понедельник",
        startTime: "09:00",
        endTime: "10:30",
        pairNumber: 1,
        subject: "Гражданское право",
        subjectType: "пр",
        weekType: "both",
        academicYear: "2026-2027",
        isReplacement: false,
      }]);

      const result = await service.findForStudentDateRange(
        "uni-1",
        "12131",
        "2026-10-05",
        "2026-10-11",
      );

      expect(mockRaspScraper.getSchedule).toHaveBeenCalledWith("12131");
      expect(mockLessonRepo.findAndCount).not.toHaveBeenCalled();
      expect(result.data.map((lesson) => lesson.id)).toEqual(["rasp-lesson-1-12131"]);
      expect(result.data[0].subject).toBe("Гражданское право");
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
        organizationId: "uni-1",
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
        id: "10000000-0000-4000-8000-000000000001",
        organizationId: "uni-1",
      });
      await service.delete("10000000-0000-4000-8000-000000000001");
      expect(mockLessonRepo.delete).toHaveBeenCalledWith("10000000-0000-4000-8000-000000000001");
    });

    it("rejects a teacher deleting a colleague's lesson", async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: "teacher-1",
        role: UserRole.TEACHER,
        organizationId: "uni-1",
      });
      mockLessonRepo.findOne.mockResolvedValue({
        id: "10000000-0000-4000-8000-000000000001",
        organizationId: "uni-1",
        teacherId: "teacher-2",
      });

      await expect(service.delete("10000000-0000-4000-8000-000000000001")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockLessonRepo.delete).not.toHaveBeenCalled();
    });
  });
});
