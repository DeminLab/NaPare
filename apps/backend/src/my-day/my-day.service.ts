import { Injectable } from '@nestjs/common';

import { ScheduleService } from '../schedule/schedule.service';
import { PairSpaceService } from '../pair-space/pair-space.service';
import { AbsencesService } from '../absences/absences.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../auth/interfaces/user-role';
import { PairSpace } from '../pair-space/entities/pair-space.entity';

@Injectable()
export class MyDayService {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly pairSpaceService: PairSpaceService,
    private readonly absencesService: AbsencesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMyDay(userId: string, universityId: string, role: UserRole) {
    const today = new Date().toISOString().split('T')[0];

    // Get today's schedule
    let lessons;
    if (role === UserRole.STUDENT) {
      // TODO: Get student's group
      lessons = (await this.scheduleService.findByDate(universityId, today)).data;
    } else if (role === UserRole.TEACHER) {
      lessons = (await this.scheduleService.findByTeacher(universityId, userId, today)).data;
    } else {
      lessons = (await this.scheduleService.findByDate(universityId, today)).data;
    }

    // Get PairSpaces for today's lessons
    const pairSpaces: PairSpace[] = [];
    for (const lesson of lessons) {
      try {
        const pairSpace = await this.pairSpaceService.findByLesson(lesson.id);
        pairSpaces.push(pairSpace);
      } catch {
        // PairSpace not created yet
      }
    }

    // Get absences for today
    const absences = (await this.absencesService.findByStudent(userId)).data;

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
