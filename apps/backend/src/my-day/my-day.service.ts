import { Injectable } from '@nestjs/common';

import { ScheduleService } from '../schedule/schedule.service';
import { PairSpaceService } from '../pair-space/pair-space.service';
import { AbsencesService } from '../absences/absences.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MyDayService {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly pairSpaceService: PairSpaceService,
    private readonly absencesService: AbsencesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMyDay(userId: string, universityId: string, roles: string[]) {
    const today = new Date().toISOString().split('T')[0];

    // Get today's schedule
    let lessons;
    if (roles.includes('student')) {
      // TODO: Get student's group
      lessons = await this.scheduleService.findByDate(universityId, today);
    } else if (roles.includes('teacher')) {
      lessons = await this.scheduleService.findByTeacher(universityId, userId, today);
    } else {
      lessons = await this.scheduleService.findByDate(universityId, today);
    }

    // Get PairSpaces for today's lessons
    const pairSpaces: any[] = [];
    for (const lesson of lessons) {
      try {
        const pairSpace = await this.pairSpaceService.findByLesson(lesson.id);
        pairSpaces.push(pairSpace);
      } catch {
        // PairSpace not created yet
      }
    }

    // Get absences for today
    const absences = await this.absencesService.findByStudent(userId);

    // Get unread notifications count
    const unreadCount = await this.notificationsService.getUnreadCount(userId);

    return {
      date: today,
      lessons,
      pairSpaces,
      absences: absences.filter(
        (a) => new Date(a.startDate).toISOString().split('T')[0] === today,
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
