import { NotFoundException } from "@nestjs/common";

import { SibitConnectorService } from "./sibit-connector.service";
import { RaspScraperService } from "../../auth/rasp-scraper.service";

describe("SibitConnectorService", () => {
  const groups = [
    {
      groupId: "12136",
      name: "ГМУ-25",
      faculty: "ДОО",
      facultyId: 24,
      course: 2,
      academicYear: "2026-2027",
    },
    {
      groupId: "12134",
      name: "ИН-16",
      faculty: "ДОО",
      facultyId: 24,
      course: 1,
      academicYear: "2026-2027",
    },
  ];

  const sourceLesson = (overrides: Record<string, unknown> = {}) => ({
    lessonId: "5632268",
    groupId: "12136",
    groupName: "ГМУ-25",
    date: "2026-09-17",
    dayOfWeek: 4,
    dayName: "Четверг",
    startTime: "10:10",
    endTime: "11:40",
    pairNumber: 2,
    subject: "Тестовый предмет",
    subjectType: "лек",
    teacher: "Иванов И.И.",
    teacherId: "7",
    room: "203",
    weekType: "odd",
    academicYear: "2026-2027",
    isReplacement: false,
    ...overrides,
  });

  const scraper = {
    getYears: jest.fn(),
    getGroups: jest.fn(),
    getSchedule: jest.fn(),
    getCatalog: jest.fn(),
  };

  let service: SibitConnectorService;

  beforeEach(() => {
    jest.clearAllMocks();
    scraper.getYears.mockResolvedValue([
      { value: "2025-2026", label: "2025-2026" },
      { value: "2026-2027", label: "2026-2027" },
    ]);
    scraper.getGroups.mockResolvedValue(groups);
    scraper.getSchedule.mockResolvedValue([
      sourceLesson(),
      sourceLesson({
        lessonId: "5632999",
        date: "2026-10-05",
        subject: "Октябрьская пара",
        teacher: "Петров П.П.",
        teacherId: "11",
      }),
    ]);
    service = new SibitConnectorService(
      scraper as unknown as RaspScraperService,
    );
  });

  it("exposes source group names", async () => {
    await expect(service.getGroups()).resolves.toEqual(["ГМУ-25", "ИН-16"]);
    expect(scraper.getGroups).toHaveBeenCalledWith(undefined);
  });

  it("normalizes source lessons into import DTOs and keeps the requested range", async () => {
    const lessons = await service.getSchedule(
      " гму-25 ",
      "2026-09-01",
      "2026-09-30",
    );

    expect(scraper.getSchedule).toHaveBeenCalledWith("12136", "2026-2027");
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toEqual(
      expect.objectContaining({
        groupId: "12136",
        subject: "Тестовый предмет",
        subjectType: "лек",
        room: "203",
        dayOfWeek: 4,
        startTime: "10:10",
        endTime: "11:40",
        pairNumber: 2,
        weekType: "odd",
        teacherName: "Иванов И.И.",
        groupName: "ГМУ-25",
        faculty: "ДОО",
        source: "sibit",
        externalId: "5632268",
        isChanged: false,
      }),
    );
    expect(lessons[0].startDate).toEqual(new Date("2026-09-17T10:10:00"));
    expect(lessons[0].endDate).toEqual(new Date("2026-09-17T11:40:00"));
  });

  it("resolves the academic year that contains the requested date", async () => {
    await service.getSchedule("ГМУ-25", "2025-12-01", "2025-12-31");

    expect(scraper.getGroups).toHaveBeenCalledWith("2025-2026");
  });

  it("rejects a group that the source does not know", async () => {
    await expect(
      service.getSchedule("НЕТ-00", "2026-09-01", "2026-09-30"),
    ).rejects.toThrow(NotFoundException);
    expect(scraper.getSchedule).not.toHaveBeenCalled();
  });

  it("collects unique teachers from the catalog", async () => {
    scraper.getCatalog.mockResolvedValue({
      university: { name: "СИБИТ", city: "Омск" },
      academicYear: "2026-2027",
      source: "https://rasp.sano.ru",
      fetchedAt: "2026-09-24T00:00:00.000Z",
      groups,
      subjects: [],
      lessons: [
        sourceLesson(),
        sourceLesson({ lessonId: "5632269" }),
        sourceLesson({
          lessonId: "5632270",
          teacher: "Петров П.П.",
          teacherId: "11",
        }),
        sourceLesson({ lessonId: "5632271", teacher: "", teacherId: 0 }),
      ],
    });

    await expect(service.getTeachers()).resolves.toEqual([
      {
        id: "7",
        name: "Иванов И.И.",
        lessonCount: 2,
        groups: [{ id: "12136", name: "ГМУ-25" }],
      },
      {
        id: "11",
        name: "Петров П.П.",
        lessonCount: 1,
        groups: [{ id: "12136", name: "ГМУ-25" }],
      },
    ]);
  });

  it("summarises the full catalog for a manual sync", async () => {
    scraper.getCatalog.mockResolvedValue({
      university: { name: "СИБИТ", city: "Омск" },
      academicYear: "2026-2027",
      source: "https://rasp.sano.ru",
      fetchedAt: "2026-09-24T00:00:00.000Z",
      groups,
      subjects: [],
      lessons: [
        sourceLesson(),
        sourceLesson({ lessonId: "5632269" }),
        sourceLesson({
          lessonId: "5632270",
          teacher: "Петров П.П.",
          teacherId: "11",
        }),
      ],
    });

    await expect(service.sync()).resolves.toEqual(
      expect.objectContaining({
        groups: 2,
        lessons: 3,
        teachers: 2,
        catalog: expect.objectContaining({ academicYear: "2026-2027" }),
      }),
    );
    expect(scraper.getCatalog).toHaveBeenCalledWith(undefined);
  });
});
