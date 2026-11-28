import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';

import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { Group } from '../users/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { Lesson } from './entities/lesson.entity';

const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 62;

export type ScheduleEntryState = 'scheduled' | 'changed' | 'cancelled';
export type ScheduleEntrySource = 'lesson' | 'series';

export interface ScheduleEntry {
  id: string;
  source: ScheduleEntrySource;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  subjectType: string | null;
  groupId: string | null;
  groupName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  room: string | null;
  building: string | null;
  subgroup: string | null;
  pairNumber: number | null;
  weekType?: 'odd' | 'even' | 'both';
  state: ScheduleEntryState;
  isReplacement?: boolean;
  change: { type: ScheduleEntryState; reason: string | null } | null;
  lessonId: string | null;
  seriesId: string | null;
  occurrenceId: string | null;
}

export interface ScheduleDay {
  date: string;
  lessons: ScheduleEntry[];
}

export interface ScheduleRangeResult {
  range: { from: string; to: string; days: number };
  days: ScheduleDay[];
  meta: { lessons: number; occurrences: number };
}

export interface ScheduleReadActor {
  id: string;
  role: UserRole;
  organizationId: string | null;
  groupId?: string | null;
}

export interface ScheduleReadQuery {
  from: string;
  to: string;
  groupId?: string;
  teacherId?: string;
}

function parseIsoDate(value: string, field: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException(`Некорректная дата ${field}`);
  return date;
}

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const isoTime = (date: Date): string => date.toISOString().slice(11, 16);
const slotKey = (date: string, startTime: string, groupId: string | null) => `${date}|${startTime}|${groupId ?? ''}`;

/**
 * One read model over the two schedule storages.
 * Legacy `lessons` and academic `lesson_occurrences` are merged into dated
 * entries, so a consumer never has to know which table a lesson came from.
 */
@Injectable()
export class ScheduleReadService {
  constructor(
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(LessonOccurrence) private readonly occurrences: Repository<LessonOccurrence>,
    @InjectRepository(LessonSeries) private readonly series: Repository<LessonSeries>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly tenantContext: TenantContext,
  ) {}

  async readRange(actor: ScheduleReadActor, query: ScheduleReadQuery): Promise<ScheduleRangeResult> {
    const organizationId = actor.organizationId;
    if (!organizationId) throw new BadRequestException('Пользователь не привязан к университету');
    this.tenantContext.assertAccess(organizationId);

    const fromDate = parseIsoDate(query.from, 'начала');
    const toDate = parseIsoDate(query.to, 'окончания');
    if (toDate < fromDate) throw new BadRequestException('Конец периода раньше начала');
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
    if (days > MAX_RANGE_DAYS) throw new BadRequestException(`Период больше ${MAX_RANGE_DAYS} дней`);

    const scope = await this.resolveScope(actor, query, organizationId);
    const from = isoDate(fromDate);
    const to = isoDate(toDate);

    const [lessons, occurrences] = await Promise.all([
      this.lessons.find({
        where: {
          organizationId,
          startDate: Between(fromDate, new Date(toDate.getTime() + DAY_MS - 1)),
          ...(scope.groupId ? { groupId: scope.groupId } : {}),
          ...(scope.teacherId ? { teacherId: scope.teacherId } : {}),
        },
        order: { startDate: 'ASC', pairNumber: 'ASC' },
      }),
      this.occurrences.find({
        where: {
          organizationId,
          startsAt: Between(fromDate, new Date(toDate.getTime() + DAY_MS - 1)),
          ...(scope.groupId ? { groupId: scope.groupId } : {}),
          ...(scope.teacherId ? { teacherId: scope.teacherId } : {}),
        },
        order: { startsAt: 'ASC' },
      }),
    ]);

    const seriesIds = [...new Set(occurrences.map(occurrence => occurrence.seriesId))];
    const seriesRows = seriesIds.length ? await this.series.find({ where: { id: In(seriesIds) } }) : [];
    const seriesById = new Map(seriesRows.map(row => [row.id, row]));
    const groupNames = await this.groupNames(organizationId, [
      ...lessons.map(lesson => lesson.groupId),
      ...occurrences.map(occurrence => occurrence.groupId),
    ]);
    const teacherNames = await this.teacherNames(organizationId, [
      ...lessons.map(lesson => lesson.teacherId),
      ...occurrences.map(occurrence => occurrence.teacherId),
    ]);

    const lessonEntries = lessons.map(lesson => {
      const date = isoDate(new Date(lesson.startDate));
      const entry: ScheduleEntry = {
        id: `lesson:${lesson.id}`,
        source: lesson.seriesId ? 'series' : 'lesson',
        date,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        subject: lesson.subject,
        subjectType: lesson.subjectType || null,
        groupId: lesson.groupId ?? null,
        groupName: lesson.groupName || groupNames.get(lesson.groupId ?? '') || null,
        teacherId: lesson.teacherId ?? null,
        teacherName: lesson.teacherName || teacherNames.get(lesson.teacherId ?? '') || null,
        room: lesson.room || null,
        building: lesson.building || null,
        subgroup: lesson.subgroup || null,
        pairNumber: lesson.pairNumber ?? null,
        weekType: lesson.weekType === 'odd' || lesson.weekType === 'even' ? lesson.weekType : 'both',
        state: lesson.isChanged ? 'changed' : 'scheduled',
        isReplacement: lesson.notes?.trim().toLocaleLowerCase('ru-RU') === 'замена'
          || lesson.changeDescription?.trim().toLocaleLowerCase('ru-RU').startsWith('замена по источнику rasp.sano.ru') === true
          || lesson.changeDescription?.trim().toLocaleLowerCase('ru-RU') === 'занятие изменено в источнике расписания',
        change: lesson.isChanged ? { type: 'changed', reason: lesson.changeDescription || null } : null,
        lessonId: lesson.id,
        seriesId: lesson.seriesId ?? null,
        occurrenceId: lesson.occurrenceId ?? null,
      };
      return entry;
    });

    const occurrenceEntries: ScheduleEntry[] = occurrences.map(occurrence => {
      const seriesRow = seriesById.get(occurrence.seriesId);
      const date = isoDate(new Date(occurrence.startsAt));
      const state: ScheduleEntryState = occurrence.status === 'cancelled'
        ? 'cancelled'
        : occurrence.status === 'rescheduled' || occurrence.changeReason
          ? 'changed'
          : 'scheduled';
      return {
        id: `occurrence:${occurrence.id}`,
        source: 'series',
        date,
        startTime: isoTime(new Date(occurrence.startsAt)),
        endTime: isoTime(new Date(occurrence.endsAt)),
        subject: seriesRow?.title || 'Занятие',
        subjectType: seriesRow?.subjectType ?? null,
        groupId: occurrence.groupId ?? null,
        groupName: groupNames.get(occurrence.groupId ?? '') || null,
        teacherId: occurrence.teacherId ?? null,
        teacherName: teacherNames.get(occurrence.teacherId ?? '') || null,
        room: occurrence.room || null,
        building: occurrence.building || null,
        subgroup: null,
        pairNumber: seriesRow?.pairNumber ?? null,
        weekType: seriesRow?.weekType === 'odd' || seriesRow?.weekType === 'even' ? seriesRow.weekType : 'both',
        state,
        change: occurrence.changeReason ? { type: state, reason: occurrence.changeReason } : null,
        lessonId: occurrence.legacyLessonId ?? null,
        seriesId: occurrence.seriesId,
        occurrenceId: occurrence.id,
      } satisfies ScheduleEntry;
    });

    // The same slot may exist in both storages after a migration. The academic
    // occurrence wins, but it inherits subject and names from the legacy row.
    const bySlot = new Map<string, ScheduleEntry>();
    for (const entry of lessonEntries) bySlot.set(slotKey(entry.date, entry.startTime, entry.groupId), entry);
    for (const entry of occurrenceEntries) {
      const legacy = bySlot.get(slotKey(entry.date, entry.startTime, entry.groupId));
      bySlot.set(slotKey(entry.date, entry.startTime, entry.groupId), legacy
        ? {
            ...entry,
            subject: entry.subject === 'Занятие' ? legacy.subject : entry.subject,
            subjectType: entry.subjectType ?? legacy.subjectType,
            teacherName: entry.teacherName ?? legacy.teacherName,
            groupName: entry.groupName ?? legacy.groupName,
            isReplacement: entry.isReplacement ?? legacy.isReplacement,
            lessonId: entry.lessonId ?? legacy.lessonId,
          }
        : entry);
    }

    const grouped = new Map<string, ScheduleEntry[]>();
    for (let cursor = fromDate.getTime(); cursor <= toDate.getTime(); cursor += DAY_MS) {
      grouped.set(isoDate(new Date(cursor)), []);
    }
    for (const entry of bySlot.values()) {
      if (!grouped.has(entry.date)) continue;
      grouped.get(entry.date)!.push(entry);
    }

    return {
      range: { from, to, days },
      days: [...grouped.entries()].map(([date, entries]) => ({
        date,
        lessons: entries.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      })),
      meta: { lessons: lessonEntries.length, occurrences: occurrenceEntries.length },
    };
  }

  private async resolveScope(actor: ScheduleReadActor, query: ScheduleReadQuery, organizationId: string): Promise<{ groupId: string | null; teacherId: string | null }> {
    if (actor.role === UserRole.STUDENT) {
      if (!actor.groupId) throw new NotFoundException('У студента не указана учебная группа');
      const groupId = isPostgresUuid(actor.groupId)
        ? actor.groupId
        : (await this.groups.findOne({
            where: { externalId: actor.groupId, organizationId },
            select: { id: true },
          }))?.id;
      if (!groupId) throw new NotFoundException('Учебная группа студента не найдена');
      return { groupId, teacherId: null };
    }
    if (actor.role === UserRole.TEACHER) {
      return { groupId: null, teacherId: actor.id };
    }
    return { groupId: query.groupId ?? null, teacherId: query.teacherId ?? null };
  }

  private async groupNames(organizationId: string, ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const rows = await this.groups.find({ where: { id: In(unique), organizationId }, select: { id: true, name: true } });
    return new Map(rows.map(row => [row.id, row.name]));
  }

  private async teacherNames(organizationId: string, ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const rows = await this.users.find({ where: { id: In(unique), organizationId }, select: { id: true, firstName: true, lastName: true } });
    return new Map(rows.map(row => [row.id, `${row.firstName} ${row.lastName}`.trim()]));
  }
}

function isPostgresUuid(value: string): boolean {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
