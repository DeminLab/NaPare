import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { TenantContext } from '../common/tenant/tenant-context';
import { AcademicCalendarService, WeekTypeInfo } from './academic-calendar.service';

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
 */
@Injectable()
export class ScheduleSeriesService {
  constructor(
    @InjectRepository(LessonSeries)
    private readonly seriesRepository: Repository<LessonSeries>,
    @InjectRepository(LessonOccurrence)
    private readonly occurrenceRepository: Repository<LessonOccurrence>,
    private readonly calendar: AcademicCalendarService,
    private readonly tenantContext: TenantContext,
  ) {}

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
        await this.occurrenceRepository.save(entities);
        created.push(...planned.map(item => item.date));
      } catch {
        // A concurrent request may have created the same slot first. Keep the
        // unique (seriesId, startsAt) guarantee and report the clash per date.
        for (const item of planned) {
          try {
            await this.occurrenceRepository.save(this.occurrenceRepository.create({
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

  private async weekFor(organizationId: string, date: string): Promise<WeekTypeInfo | null> {
    try {
      return await this.calendar.getWeekType(organizationId, date);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
