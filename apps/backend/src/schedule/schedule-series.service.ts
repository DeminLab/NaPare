import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { TenantContext } from '../common/tenant/tenant-context';
import { AcademicCalendarService, WeekTypeInfo } from './academic-calendar.service';
import { Lesson } from './entities/lesson.entity';
import { ScheduleCandidate, ScheduleConflict, ScheduleService } from './schedule.service';

const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 400;
const NON_WORKING_KINDS = new Set(['holiday', 'vacation', 'session', 'dayoff', 'day_off']);

export interface SeriesExpansionRequest {
  from: string;
  to: string;
  dryRun?: boolean;
}

export interface SeriesExpansionSkip {
  date: string;
  reason: string;
}

export interface SeriesExpansionResult {
  seriesId: string;
  from: string;
  to: string;
  dryRun: boolean;
  created: string[];
  skipped: SeriesExpansionSkip[];
}

export interface LessonSeriesInput {
  groupId: string;
  teacherId?: string | null;
  courseId?: string | null;
  title?: string | null;
  subjectType?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  pairNumber: number;
  weekType?: string | null;
  room?: string | null;
  building?: string | null;
  validFrom: string | Date;
  validTo?: string | Date | null;
}

export interface LessonSeriesFilters {
  groupId?: string;
  teacherId?: string;
}

/** Fully validated series values, ready to be stored or checked for clashes. */
export interface NormalizedSeries {
  groupId: string;
  courseId: string;
  teacherId: string | null;
  title: string | null;
  subjectType: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  pairNumber: number;
  weekType: string;
  room: string | null;
  building: string | null;
  validFrom: Date;
  validTo: Date | null;
}

/** How far ahead a new series is checked for clashes with existing lessons. */
const CONFLICT_HORIZON_DAYS = 62;

export interface OrganizationExpansionResult {
  from: string;
  to: string;
  dryRun: boolean;
  series: SeriesExpansionResult[];
  created: number;
  skipped: number;
}

/** UTC midnight of a `YYYY-MM-DD` string, so expansion never drifts with the host timezone. */
function parseIsoDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('Некорректная дата периода');
  return date;
}

function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * Turns a weekly lesson series into concrete lesson occurrences.
 * The academic calendar decides week parity and non-working days; a university
 * without an active calendar still receives `both` series and gets an explicit
 * skip reason for odd/even ones instead of silent gaps.
 *
 * Every occurrence is mirrored into the legacy `lessons` table, because the
 * daily schedule, attendance and pair spaces still address lessons by that id.
 * The mirror is one-to-one through `lessons.occurrenceId`; an existing lesson
 * for the same slot is linked instead of duplicated, so imports and series can
 * coexist without doubling the timetable.
 */
@Injectable()
export class ScheduleSeriesService {
  constructor(
    @InjectRepository(LessonSeries)
    private readonly seriesRepository: Repository<LessonSeries>,
    @InjectRepository(LessonOccurrence)
    private readonly occurrenceRepository: Repository<LessonOccurrence>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly calendar: AcademicCalendarService,
    private readonly tenantContext: TenantContext,
    private readonly scheduleService: ScheduleService,
  ) {}

  async list(organizationId: string, filters: LessonSeriesFilters = {}): Promise<LessonSeries[]> {
    this.tenantContext.assertAccess(organizationId);
    return this.seriesRepository.find({
      where: {
        organizationId,
        ...(filters.groupId ? { groupId: filters.groupId } : {}),
        ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async create(organizationId: string, input: LessonSeriesInput): Promise<LessonSeries> {
    this.tenantContext.assertAccess(organizationId);
    const values = this.normalize(input);
    await this.scheduleService.assertLessonReferences(organizationId, values.groupId, values.teacherId ?? undefined);
    await this.assertNoConflicts(organizationId, values);
    const series = this.seriesRepository.create({
      ...values,
      organizationId,
      source: 'manual',
      lastSyncedAt: new Date(),
      syncStatus: 'synced',
    });
    return this.seriesRepository.save(series);
  }

  async update(id: string, input: Partial<LessonSeriesInput>): Promise<LessonSeries> {
    const series = await this.findById(id);
    const values = this.normalize({ ...series, ...input }, series);
    await this.scheduleService.assertLessonReferences(series.organizationId, values.groupId, values.teacherId ?? undefined);
    await this.assertNoConflicts(series.organizationId, values, series.id);
    Object.assign(series, values, { lastSyncedAt: new Date(), syncStatus: 'synced' });
    return this.seriesRepository.save(series);
  }

  /** Removes the template only; generated lessons stay as the historical record. */
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const series = await this.findById(id);
    await this.seriesRepository.remove(series);
    return { id, deleted: true };
  }

  private async findById(id: string): Promise<LessonSeries> {
    const series = await this.seriesRepository.findOne({ where: { id } });
    if (!series) throw new NotFoundException('Серия занятий не найдена');
    this.tenantContext.assertAccess(series.organizationId);
    return series;
  }

  private normalize(input: Partial<LessonSeriesInput>, base?: LessonSeries): NormalizedSeries {
    const groupId = input.groupId ?? base?.groupId;
    if (!groupId) throw new BadRequestException('Выберите учебную группу');
    const courseId = input.courseId ?? base?.courseId;
    if (!courseId) throw new BadRequestException('Выберите учебный курс');
    const dayOfWeek = Number(input.dayOfWeek ?? base?.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new BadRequestException('День недели должен быть от 1 до 7');
    }
    const startTime = input.startTime ?? base?.startTime;
    const endTime = input.endTime ?? base?.endTime;
    if (!startTime || !endTime) throw new BadRequestException('Укажите время начала и окончания');
    if (startTime >= endTime) throw new BadRequestException('Окончание занятия должно быть позже начала');
    const pairNumber = Number(input.pairNumber ?? base?.pairNumber);
    if (!Number.isInteger(pairNumber) || pairNumber < 1 || pairNumber > 10) {
      throw new BadRequestException('Номер пары должен быть от 1 до 10');
    }
    const validFrom = new Date(input.validFrom ?? base?.validFrom ?? '');
    if (!Number.isFinite(validFrom.getTime())) throw new BadRequestException('Некорректная дата начала действия');
    const rawValidTo = input.validTo === undefined ? base?.validTo ?? null : input.validTo;
    const validTo = rawValidTo ? new Date(rawValidTo) : null;
    if (validTo && (!Number.isFinite(validTo.getTime()) || validTo < validFrom)) {
      throw new BadRequestException('Дата окончания действия раньше начала');
    }
    return {
      groupId,
      courseId,
      teacherId: input.teacherId === undefined ? base?.teacherId ?? null : input.teacherId,
      title: input.title === undefined ? base?.title ?? null : input.title?.trim() || null,
      subjectType: input.subjectType === undefined ? base?.subjectType ?? null : input.subjectType?.trim() || null,
      dayOfWeek,
      startTime,
      endTime,
      pairNumber,
      weekType: input.weekType ?? base?.weekType ?? 'both',
      room: input.room === undefined ? base?.room ?? null : input.room?.trim() || null,
      building: input.building === undefined ? base?.building ?? null : input.building?.trim() || null,
      validFrom,
      validTo,
    };
  }

  /**
   * A template has no single date, so the nearest occurrences are checked
   * against existing lessons. The dispatcher gets the exact clashing dates
   * instead of an empty timetable after the first expansion.
   */
  private async assertNoConflicts(
    organizationId: string,
    values: NormalizedSeries,
    excludeSeriesId?: string,
  ): Promise<void> {
    const owned = new Set<string>();
    if (excludeSeriesId) {
      const rows = await this.lessonRepository.find({ where: { seriesId: excludeSeriesId }, select: { id: true } });
      for (const row of rows) owned.add(row.id);
    }
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const validFrom = new Date(values.validFrom);
    const from = validFrom.getTime() > today.getTime() ? validFrom : today;
    const horizon = new Date(from.getTime() + CONFLICT_HORIZON_DAYS * DAY_MS);
    const to = values.validTo && new Date(values.validTo).getTime() < horizon.getTime() ? new Date(values.validTo) : horizon;
    const conflicts: ScheduleConflict[] = [];
    for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += DAY_MS) {
      const date = new Date(cursor);
      if (isoWeekday(date) !== values.dayOfWeek) continue;
      const dateKey = date.toISOString().slice(0, 10);
      const candidate: ScheduleCandidate = {
        organizationId,
        groupId: values.groupId,
        teacherId: values.teacherId,
        room: values.room,
        // Legacy lessons count weekdays 0..6, series count 1..7.
        dayOfWeek: values.dayOfWeek % 7,
        startDate: dateKey,
        endDate: dateKey,
        startTime: values.startTime,
        endTime: values.endTime,
        weekType: values.weekType,
      };
      const found = await this.scheduleService.findConflicts(candidate);
      conflicts.push(...found.filter(conflict => !owned.has(conflict.lessonId)));
    }
    if (!conflicts.length) return;
    const dates = [...new Set(conflicts.map(conflict => conflict.dateFrom))].join(', ');
    throw new ConflictException({
      code: 'SCHEDULE_CONFLICT',
      message: `Конфликт расписания: ${dates}`,
      conflicts,
    });
  }

  async expandSeries(seriesId: string, request: SeriesExpansionRequest): Promise<SeriesExpansionResult> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId } });
    if (!series) throw new NotFoundException('Серия занятий не найдена');
    this.tenantContext.assertAccess(series.organizationId);
    return this.expandOne(series, request);
  }

  async expandOrganization(organizationId: string, request: SeriesExpansionRequest): Promise<OrganizationExpansionResult> {
    this.tenantContext.assertAccess(organizationId);
    const series = await this.seriesRepository.find({ where: { organizationId }, order: { dayOfWeek: 'ASC', pairNumber: 'ASC' } });
    const results: SeriesExpansionResult[] = [];
    for (const item of series) results.push(await this.expandOne(item, request));
    return {
      from: request.from.slice(0, 10),
      to: request.to.slice(0, 10),
      dryRun: Boolean(request.dryRun),
      series: results,
      created: results.reduce((total, result) => total + result.created.length, 0),
      skipped: results.reduce((total, result) => total + result.skipped.length, 0),
    };
  }

  private async expandOne(series: LessonSeries, request: SeriesExpansionRequest): Promise<SeriesExpansionResult> {
    const from = parseIsoDate(request.from);
    const to = parseIsoDate(request.to);
    if (to < from) throw new BadRequestException('Конец периода раньше начала');
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Период больше ${MAX_RANGE_DAYS} дней. Разбейте генерацию на части.`);
    }

    const validFrom = new Date(series.validFrom);
    const validTo = series.validTo ? new Date(series.validTo) : null;
    const start = from.getTime() > validFrom.getTime() ? from : new Date(Date.UTC(validFrom.getUTCFullYear(), validFrom.getUTCMonth(), validFrom.getUTCDate()));
    const end = validTo && validTo.getTime() < to.getTime() ? validTo : to;

    const created: string[] = [];
    const skipped: SeriesExpansionSkip[] = [];
    if (end.getTime() < start.getTime()) {
      return { seriesId: series.id, from: request.from.slice(0, 10), to: request.to.slice(0, 10), dryRun: Boolean(request.dryRun), created, skipped };
    }

    const existing = await this.occurrenceRepository.find({
      where: { seriesId: series.id, startsAt: Between(start, new Date(end.getTime() + DAY_MS - 1)) },
      select: { id: true, startsAt: true },
    });
    const existingStarts = new Set(existing.map(occurrence => new Date(occurrence.startsAt).toISOString()));

    const planned: Array<{ date: string; startsAt: Date; endsAt: Date }> = [];
    for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += DAY_MS) {
      const date = new Date(cursor);
      if (isoWeekday(date) !== series.dayOfWeek) continue;
      const dateKey = date.toISOString().slice(0, 10);
      const startsAt = new Date(`${dateKey}T${series.startTime}:00.000Z`);
      const endsAt = new Date(`${dateKey}T${series.endTime}:00.000Z`);
      if (!(endsAt.getTime() > startsAt.getTime())) {
        skipped.push({ date: dateKey, reason: 'Время окончания не позже начала занятия' });
        continue;
      }
      if (existingStarts.has(startsAt.toISOString())) {
        skipped.push({ date: dateKey, reason: 'Занятие уже создано' });
        continue;
      }

      const week = await this.weekFor(series.organizationId, dateKey);
      if (week?.exception?.kind && NON_WORKING_KINDS.has(week.exception.kind)) {
        skipped.push({ date: dateKey, reason: `Нерабочий день: ${week.exception.kind}` });
        continue;
      }
      if (series.weekType !== 'both') {
        if (!week) {
          skipped.push({ date: dateKey, reason: 'Нет учебного календаря для проверки чётности недели' });
          continue;
        }
        if (week.weekType !== series.weekType) {
          skipped.push({ date: dateKey, reason: `Неделя ${week.weekType}, у серии ${series.weekType}` });
          continue;
        }
      }
      // Expansion does not run the conflict check, so a slot that already holds
      // a lesson of another series or an import must stay untouched instead of
      // silently replacing it.
      const occupied = await this.lessonRepository.findOne({
        where: {
          organizationId: series.organizationId,
          groupId: series.groupId,
          startTime: series.startTime,
          startDate: Between(new Date(cursor), new Date(cursor + DAY_MS - 1)),
        },
        select: { id: true, seriesId: true },
      });
      if (occupied && occupied.seriesId !== series.id) {
        skipped.push({ date: dateKey, reason: 'Слот занят другим занятием' });
        continue;
      }
      planned.push({ date: dateKey, startsAt, endsAt });
    }

    if (!request.dryRun && planned.length) {
      const entities = planned.map(item => this.occurrenceRepository.create({
        organizationId: series.organizationId,
        seriesId: series.id,
        courseId: series.courseId,
        groupId: series.groupId,
        teacherId: series.teacherId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        room: series.room,
        building: series.building,
        status: 'scheduled',
        source: series.source ?? 'manual',
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      }));
      try {
        const saved = await this.occurrenceRepository.save(entities);
        await this.materializeLessons(series, saved);
        created.push(...planned.map(item => item.date));
      } catch {
        // A concurrent request may have created the same slot first. Keep the
        // unique (seriesId, startsAt) guarantee and report the clash per date.
        for (const item of planned) {
          try {
            const saved = await this.occurrenceRepository.save(this.occurrenceRepository.create({
              organizationId: series.organizationId,
              seriesId: series.id,
              courseId: series.courseId,
              groupId: series.groupId,
              teacherId: series.teacherId,
              startsAt: item.startsAt,
              endsAt: item.endsAt,
              room: series.room,
              building: series.building,
              status: 'scheduled',
              source: series.source ?? 'manual',
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
            }));
            await this.materializeLessons(series, [saved]);
            created.push(item.date);
          } catch {
            skipped.push({ date: item.date, reason: 'Занятие уже создано параллельным запросом' });
          }
        }
      }
    } else {
      created.push(...planned.map(item => item.date));
    }

    return {
      seriesId: series.id,
      from: request.from.slice(0, 10),
      to: request.to.slice(0, 10),
      dryRun: Boolean(request.dryRun),
      created,
      skipped,
    };
  }

  /**
   * Mirror occurrences into `lessons`, keeping one legacy row per slot. A row
   * that already exists (import or an earlier run) is linked to the occurrence
   * instead of being created again.
   */
  private async materializeLessons(series: LessonSeries, occurrences: LessonOccurrence[]): Promise<void> {
    for (const occurrence of occurrences) {
      if (!occurrence?.id) continue;
      const dateKey = new Date(occurrence.startsAt).toISOString().slice(0, 10);
      const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);
      try {
        const existing = await this.lessonRepository.findOne({
          where: {
            organizationId: series.organizationId,
            groupId: series.groupId,
            startTime: series.startTime,
            startDate: Between(dayStart, dayEnd),
          },
        });
        if (existing && existing.seriesId !== series.id) continue;
        if (existing?.occurrenceId && existing.occurrenceId !== occurrence.id) continue;
        const lesson = existing ?? this.lessonRepository.create({
          organizationId: series.organizationId,
          groupId: series.groupId,
          courseId: series.courseId,
          seriesId: series.id,
          occurrenceId: occurrence.id,
          teacherId: series.teacherId,
          subject: series.title || 'Занятие',
          subjectType: series.subjectType ?? undefined,
          room: series.room ?? undefined,
          building: series.building ?? undefined,
          // Series count ISO weekdays (Mon=1..Sun=7), legacy lessons use 0..6.
          dayOfWeek: series.dayOfWeek % 7,
          startTime: series.startTime,
          endTime: series.endTime,
          pairNumber: series.pairNumber,
          weekType: 'both',
          startDate: dayStart,
          endDate: dayStart,
          source: series.source ?? 'series',
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        });
        if (existing && !existing.occurrenceId) {
          existing.occurrenceId = occurrence.id;
          existing.seriesId = existing.seriesId ?? series.id;
        }
        const stored = await this.lessonRepository.save(lesson);
        if (stored?.id && occurrence.legacyLessonId !== stored.id) {
          occurrence.legacyLessonId = stored.id;
          await this.occurrenceRepository.save(occurrence);
        }
      } catch {
        // The occurrence stays usable; the legacy mirror can be rebuilt later.
      }
    }
  }

  private async weekFor(organizationId: string, date: string): Promise<WeekTypeInfo | null> {
    try {
      return await this.calendar.getWeekType(organizationId, date);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
