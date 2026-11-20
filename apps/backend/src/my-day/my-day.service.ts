import { Injectable } from "@nestjs/common";

import { CareerService } from "../career/career.service";
import { ScheduleService } from "../schedule/schedule.service";
import { PairSpaceService } from "../pair-space/pair-space.service";
import { AbsencesService } from "../absences/absences.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UserRole } from "../auth/interfaces/user-role";
import { PairSpace } from "../pair-space/entities/pair-space.entity";
import { Lesson } from "../schedule/entities/lesson.entity";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";

import { addCalendarDays, getDateKeyInTimeZone, getDateTimeInTimeZone } from "../schedule/utils/zoned-calendar";

const PREPARATION_LOOKAHEAD_DAYS = 30;
const SCHEDULE_PAGE_SIZE = 100;

@Injectable()
export class MyDayService {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly pairSpaceService: PairSpaceService,
    private readonly absencesService: AbsencesService,
    private readonly notificationsService: NotificationsService,
    private readonly careerService: CareerService,
  ) {}

  async getMyDay(
    userId: string,
    organizationId: string,
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
        organizationId,
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
          organizationId,
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
        organizationId,
      );
    } else if (role === UserRole.TEACHER) {
      lessons = (
        await this.scheduleService.findByTeacherDateRange(
          organizationId,
          userId,
          dayStart.toISOString(),
          dayEnd.toISOString(),
        )
      ).data;
    } else {
      lessons = (await this.scheduleService.findByDateRange(
        organizationId,
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
          organizationId,
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
    const [unreadCount, careerDeadlines, careerInterviews] = await Promise.all([
      this.notificationsService.getUnreadCount(userId),
      role === UserRole.STUDENT
        ? this.careerService.listStudentDeadlines(userId, organizationId, today, addCalendarDays(today, 6))
        : [],
      role === UserRole.STUDENT
        ? this.careerService.listStudentInterviews(userId, organizationId, dayStart,
          getDateTimeInTimeZone(addCalendarDays(today, 7), 0, 0, 0, 0, timeZone))
        : [],
    ]);

    return {
      date: today,
      lessons,
      pairSpaces,
      upcomingPreparations,
      careerDeadlines,
      careerInterviews,
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
