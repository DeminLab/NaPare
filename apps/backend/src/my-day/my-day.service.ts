import { BadRequestException, Injectable } from "@nestjs/common";

import { ScheduleService } from "../schedule/schedule.service";
import { PairSpaceService } from "../pair-space/pair-space.service";
import { AbsencesService } from "../absences/absences.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UserRole } from "../auth/interfaces/user-role";
import { PairSpace } from "../pair-space/entities/pair-space.entity";
import { Lesson } from "../schedule/entities/lesson.entity";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";

const PREPARATION_LOOKAHEAD_DAYS = 30;
const SCHEDULE_PAGE_SIZE = 100;

function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
  } catch {
    throw new BadRequestException("timeZone must be a valid IANA timezone");
  }
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDateTimeInTimeZone(
  dateKey: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let timestamp = targetWallTime;

  // Resolve the UTC instant for a local wall-clock time. Two adjustments are
  // enough for standard/DST offsets, including zones that are not whole hours.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]),
    );
    const observedWallTime = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
      millisecond,
    );
    const adjustment = targetWallTime - observedWallTime;
    if (!adjustment) break;
    timestamp += adjustment;
  }

  return new Date(timestamp);
}

@Injectable()
export class MyDayService {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly pairSpaceService: PairSpaceService,
    private readonly absencesService: AbsencesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMyDay(
    userId: string,
    universityId: string,
    role: UserRole,
    groupId?: string | null,
    timeZone = "UTC",
  ) {
    const today = getDateKeyInTimeZone(new Date(), timeZone);
    const lookaheadEndDate = addCalendarDays(today, PREPARATION_LOOKAHEAD_DAYS);
    const dayStart = getDateTimeInTimeZone(today, 0, 0, 0, 0, timeZone);
    const dayEnd = getDateTimeInTimeZone(today, 23, 59, 59, 999, timeZone);
    let upcomingPreparations: Awaited<
      ReturnType<PairSpaceService["listPreparationsForLessons"]>
    > = [];

    // Get today's schedule
    let lessons: Lesson[];
    if (role === UserRole.STUDENT) {
      const rangeEnd = getDateTimeInTimeZone(
        lookaheadEndDate,
        23,
        59,
        59,
        999,
        timeZone,
      );

      const query = new PaginationQueryDto();
      query.limit = SCHEDULE_PAGE_SIZE;
      const schedule = await this.scheduleService.findForStudentDateRange(
        universityId,
        groupId,
        dayStart.toISOString(),
        rangeEnd.toISOString(),
        query,
        timeZone,
      );
      const futureLessons = [...schedule.data];

      for (
        let page = 2;
        page <= schedule.meta.totalPages &&
        futureLessons.length < schedule.meta.total;
        page += 1
      ) {
        const nextPage = new PaginationQueryDto();
        nextPage.page = page;
        nextPage.limit = SCHEDULE_PAGE_SIZE;
        const result = await this.scheduleService.findForStudentDateRange(
          universityId,
          groupId,
          dayStart.toISOString(),
          rangeEnd.toISOString(),
          nextPage,
          timeZone,
        );
        futureLessons.push(...result.data);
      }

      const uniqueFutureLessons = [
        ...new Map(futureLessons.map((lesson) => [lesson.id, lesson])).values(),
      ].filter((lesson) => {
        const lessonDate = getDateKeyInTimeZone(new Date(lesson.startDate), timeZone);
        return lessonDate >= today && lessonDate <= lookaheadEndDate;
      });
      lessons = uniqueFutureLessons.filter(
        (lesson) => getDateKeyInTimeZone(new Date(lesson.startDate), timeZone) === today,
      );
      upcomingPreparations = await this.pairSpaceService.listPreparationsForLessons(
        uniqueFutureLessons.map((lesson) => lesson.id),
        universityId,
      );
    } else if (role === UserRole.TEACHER) {
      lessons = (
        await this.scheduleService.findByTeacherDateRange(
          universityId,
          userId,
          dayStart.toISOString(),
          dayEnd.toISOString(),
        )
      ).data;
    } else {
      lessons = (await this.scheduleService.findByDateRange(
        universityId,
        dayStart.toISOString(),
        dayEnd.toISOString(),
      )).data;
    }

    // Get PairSpaces for today's lessons
    const pairSpaces: PairSpace[] = [];
    for (const lesson of lessons) {
      try {
        const pairSpace = await this.pairSpaceService.getOrCreateByLesson(
          lesson.id,
          universityId,
        );
        pairSpaces.push(pairSpace);
      } catch {
        // A lesson outside the current role scope is intentionally omitted.
      }
    }

    // Get absences for today
    const absencePages = role === UserRole.STUDENT
      ? [await this.absencesService.findByStudent(userId)]
      : await Promise.all(lessons.map(lesson => this.absencesService.findByLesson(lesson.id)));
    const absences = [...new Map(absencePages.flatMap(page => page.data).map(absence => [absence.id, absence])).values()];

    // Get unread notifications count
    const unreadCount = await this.notificationsService.getUnreadCount(userId);

    return {
      date: today,
      lessons,
      pairSpaces,
      upcomingPreparations,
      absences: absences.filter(
        (absence) => new Date(absence.startDate) <= dayEnd && new Date(absence.endDate) >= dayStart,
      ),
      notifications: {
        unreadCount,
      },
      summary: {
        totalLessons: lessons.length,
        changedLessons: lessons.filter((l) => l.isChanged).length,
        totalAbsences: absences.length,
      },
    };
  }
}
