import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import { CreateLessonDto } from "../dto/create-lesson.dto";
import {
  RaspGroup,
  RaspCatalog,
  RaspLesson,
  RaspScraperService,
} from "../../auth/rasp-scraper.service";

const SIBIT_SOURCE = "sibit";
const ACADEMIC_YEAR_START_MONTH = 9;
const ACADEMIC_YEAR_END_MONTH = 8;
const ACADEMIC_YEAR_END_DAY = 31;

export interface SibitTeacher {
  id: string;
  name: string;
  lessonCount: number;
  groups: Array<{ id: string; name: string }>;
}

export interface SibitSyncSummary {
  groups: number;
  lessons: number;
  teachers: number;
}

export interface SibitSyncResult extends SibitSyncSummary {
  catalog: RaspCatalog;
}

@Injectable()
export class SibitConnectorService {
  private readonly logger = new Logger(SibitConnectorService.name);

  constructor(private readonly raspScraperService: RaspScraperService) {}

  async getGroups(year?: string): Promise<string[]> {
    const groups = await this.raspScraperService.getGroups(year);
    return groups.map((group) => group.name);
  }

  async getSchedule(
    group: string,
    startDate: string,
    endDate: string,
  ): Promise<CreateLessonDto[]> {
    const academicYear = await this.resolveAcademicYear(startDate);
    const groups = await this.raspScraperService.getGroups(academicYear);
    const match = groups.find(
      (item) => item.name.trim().toLowerCase() === group.trim().toLowerCase(),
    );
    if (!match) {
      throw new NotFoundException(
        `Группа «${group}» не найдена в расписании СИБИТа`,
      );
    }

    const lessons = await this.raspScraperService.getSchedule(
      match.groupId,
      academicYear,
    );
    const from = startDate.slice(0, 10);
    const to = endDate.slice(0, 10);
    return lessons
      .filter((lesson) => lesson.date >= from && lesson.date <= to)
      .map((lesson) => this.toLessonDto(lesson, match));
  }

  async getTeachers(year?: string): Promise<SibitTeacher[]> {
    const catalog = await this.raspScraperService.getCatalog(year);
    return this.collectTeachers(catalog.lessons);
  }

  async sync(year?: string): Promise<SibitSyncResult> {
    const catalog = await this.raspScraperService.getCatalog(year);
    const summary: SibitSyncSummary = {
      groups: catalog.groups.length,
      lessons: catalog.lessons.length,
      teachers: this.collectTeachers(catalog.lessons).length,
    };
    this.logger.log(
      `SIBIT sync for ${catalog.academicYear}: ${summary.groups} groups, ${summary.lessons} lessons, ${summary.teachers} teachers`,
    );
    return { ...summary, catalog };
  }

  private async resolveAcademicYear(
    startDate: string,
  ): Promise<string | undefined> {
    const years = (await this.raspScraperService.getYears()).map(
      (item) => item.value,
    );
    const date = startDate.slice(0, 10);
    const match = years.find((year) => {
      const startYear = Number(year.slice(0, 4));
      if (!Number.isInteger(startYear)) return false;
      const from = `${startYear}-${String(ACADEMIC_YEAR_START_MONTH).padStart(2, "0")}-01`;
      const to = `${startYear + 1}-${String(ACADEMIC_YEAR_END_MONTH).padStart(2, "0")}-${ACADEMIC_YEAR_END_DAY}`;
      return date >= from && date <= to;
    });
    return match ?? years[years.length - 1];
  }

  private toLessonDto(lesson: RaspLesson, group: RaspGroup): CreateLessonDto {
    return {
      groupId: group.groupId,
      subject: lesson.subject,
      subjectType: lesson.subjectType,
      room: lesson.room,
      dayOfWeek: lesson.dayOfWeek,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      pairNumber: lesson.pairNumber,
      weekType: lesson.weekType,
      startDate: new Date(`${lesson.date}T${lesson.startTime}:00`),
      endDate: new Date(`${lesson.date}T${lesson.endTime}:00`),
      teacherName: lesson.teacher,
      groupName: lesson.groupName,
      subgroup: lesson.subgroup,
      faculty: group.faculty,
      isChanged: lesson.isReplacement,
      changeDescription: lesson.isReplacement
        ? "Замена по источнику rasp.sano.ru"
        : undefined,
      source: SIBIT_SOURCE,
      externalId: lesson.lessonId,
    };
  }

  private collectTeachers(lessons: RaspLesson[]): SibitTeacher[] {
    const teachers = new Map<string, SibitTeacher>();
    for (const lesson of lessons) {
      const name = lesson.teacher?.trim();
      if (!name) continue;
      const id = lesson.teacherId || name;
      const teacher = teachers.get(id) ?? { id, name, lessonCount: 0, groups: [] };
      teacher.lessonCount++;
      if (!teacher.groups.some((group) => group.id === lesson.groupId)) {
        teacher.groups.push({ id: lesson.groupId, name: lesson.groupName });
      }
      teachers.set(id, teacher);
    }
    return [...teachers.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
  }
}
