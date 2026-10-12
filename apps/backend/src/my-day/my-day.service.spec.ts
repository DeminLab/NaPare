import { MyDayService } from "./my-day.service";
import { UserRole } from "../auth/interfaces/user-role";
import { BadRequestException } from "@nestjs/common";

describe("MyDayService", () => {
  const today = new Date().toISOString().slice(0, 10);
  const futureDate = new Date(`${today}T12:00:00.000Z`);
  futureDate.setUTCDate(futureDate.getUTCDate() + 3);

  const scheduleService = {
    findForStudentDateRange: jest.fn(),
    findByTeacher: jest.fn(),
    findByTeacherDateRange: jest.fn(),
    findByDate: jest.fn(),
    findByDateRange: jest.fn(),
  };
  const pairSpaceService = {
    getOrCreateByLesson: jest.fn(),
    listPreparationsForLessons: jest.fn(),
  };
  const absencesService = { findByStudent: jest.fn(), findByLesson: jest.fn() };
  const notificationsService = { getUnreadCount: jest.fn() };

  let service: MyDayService;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduleService.findForStudentDateRange.mockResolvedValue({
      data: [
        { id: "today-lesson", startDate: new Date(`${today}T10:00:00.000Z`) },
        { id: "next-lesson", startDate: futureDate },
      ],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    pairSpaceService.listPreparationsForLessons.mockResolvedValue([
      { id: "prep-1", lessonId: "next-lesson", title: "Повторить тему" },
    ]);
    pairSpaceService.getOrCreateByLesson.mockResolvedValue({
      lessonId: "today-lesson",
    });
    absencesService.findByStudent.mockResolvedValue({ data: [] });
    absencesService.findByLesson.mockResolvedValue({ data: [] });
    notificationsService.getUnreadCount.mockResolvedValue(0);

    service = new MyDayService(
      scheduleService as never,
      pairSpaceService as never,
      absencesService as never,
      notificationsService as never,
    );
  });

  it("returns today's lessons and preparation deadlines across the next 30 days", async () => {
    const result = await service.getMyDay(
      "student-1",
      "university-1",
      UserRole.STUDENT,
      "group-1",
    );

    expect(result.lessons.map((lesson) => lesson.id)).toEqual(["today-lesson"]);
    expect(result.upcomingPreparations).toHaveLength(1);
    expect(scheduleService.findForStudentDateRange).toHaveBeenCalledWith(
      "university-1",
      "group-1",
      `${today}T00:00:00.000Z`,
      expect.stringMatching(/T23:59:59\.999Z$/),
      expect.objectContaining({ page: 1, limit: 100 }),
      "UTC",
    );
    expect(pairSpaceService.listPreparationsForLessons).toHaveBeenCalledWith(
      ["today-lesson", "next-lesson"],
      "university-1",
    );
  });

  it("keeps the non-student daily schedule behavior and does not query student preparation", async () => {
    scheduleService.findByTeacherDateRange.mockResolvedValue({ data: [] });

    await service.getMyDay("teacher-1", "university-1", UserRole.TEACHER);

    expect(scheduleService.findByTeacherDateRange).toHaveBeenCalled();
    expect(pairSpaceService.listPreparationsForLessons).not.toHaveBeenCalled();
    expect(absencesService.findByStudent).not.toHaveBeenCalled();
  });

  it("uses scoped lesson absences for staff and deduplicates a multi-lesson absence", async () => {
    scheduleService.findByTeacherDateRange.mockResolvedValue({ data: [{ id: "first" }, { id: "second" }] });
    absencesService.findByLesson.mockResolvedValue({ data: [{ id: "absence-1", startDate: `${today}T00:00:00Z`, endDate: `${today}T23:59:59Z` }] });
    const result = await service.getMyDay("teacher-1", "university-1", UserRole.TEACHER);
    expect(absencesService.findByStudent).not.toHaveBeenCalled();
    expect(absencesService.findByLesson.mock.calls).toEqual([["first"], ["second"]]);
    expect(result.absences).toHaveLength(1);
    expect(result.summary.totalAbsences).toBe(1);
  });

  it("includes an absence that began yesterday and continues today", async () => {
    const yesterday = new Date(`${today}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    absencesService.findByStudent.mockResolvedValue({ data: [{ id: "ongoing", startDate: yesterday, endDate: `${today}T23:59:59Z` }] });
    const result = await service.getMyDay("student-1", "university-1", UserRole.STUDENT, "group-1");
    expect(result.absences.map(absence => absence.id)).toEqual(["ongoing"]);
  });

  it("uses the requested IANA timezone to determine the local day", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-28T20:00:00.000Z"));
    scheduleService.findForStudentDateRange.mockResolvedValue({
      data: [
        { id: "local-today", startDate: new Date("2026-09-28T20:05:00.000Z") },
        { id: "utc-yesterday", startDate: new Date("2026-09-28T10:00:00.000Z") },
      ],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });

    try {
      const result = await service.getMyDay(
        "student-1",
        "university-1",
        UserRole.STUDENT,
        "group-1",
        "Asia/Omsk",
      );

      expect(result.date).toBe("2026-09-29");
      expect(result.lessons.map((lesson) => lesson.id)).toEqual(["local-today"]);
      expect(scheduleService.findForStudentDateRange).toHaveBeenCalledWith(
        "university-1",
        "group-1",
        "2026-09-28T18:00:00.000Z",
        "2026-10-29T17:59:59.999Z",
        expect.anything(),
        "Asia/Omsk",
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects an invalid IANA timezone", async () => {
    await expect(service.getMyDay(
      "teacher-1",
      "university-1",
      UserRole.TEACHER,
      undefined,
      "Not/A-Timezone",
    )).rejects.toThrow(BadRequestException);
  });
});
