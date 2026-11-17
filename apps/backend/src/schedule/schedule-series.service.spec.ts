import { NotFoundException } from '@nestjs/common';
import { ScheduleSeriesService } from './schedule-series.service';
import { LessonSeries } from '../academic/entities/lesson-series.entity';

const series = (overrides: Partial<LessonSeries> = {}): LessonSeries => ({
  id: 'series-a',
  organizationId: 'university-a',
  courseId: 'course-a',
  groupId: 'group-a',
  teacherId: 'teacher-a',
  title: 'Математика',
  subjectType: 'lecture',
  recurrenceRule: 'weekly',
  dayOfWeek: 1,
  startTime: '10:00',
  endTime: '11:30',
  pairNumber: 2,
  weekType: 'both',
  room: '301',
  building: 'A',
  validFrom: new Date('2026-09-01T00:00:00.000Z'),
  validTo: null,
  source: 'manual',
  lastSyncedAt: null,
  sourceVersion: null,
  syncStatus: 'synced',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as LessonSeries);

const week = (weekType: string, exception: unknown = null) => ({
  date: '',
  weekNumber: 10,
  weekType,
  cyclePosition: 1,
  cycleLength: 2,
  weekStart: '',
  weekEnd: '',
  term: { id: 'term-a', startsOn: '2026-09-01', endsOn: '2026-12-31', week1Anchor: '2026-09-01', week1Type: 'odd' },
  exception,
});

const build = (options: {
  item?: LessonSeries;
  existing?: Array<{ id: string; startsAt: Date }>;
  calendar?: (date: string) => unknown;
} = {}) => {
  const existing = options.existing ?? [];
  const save = jest.fn(async (value: unknown) => value);
  const create = jest.fn((value: unknown) => value);
  const find = jest.fn().mockResolvedValue(existing);
  const findOne = jest.fn().mockResolvedValue(options.item ?? series());
  const calendar = { getWeekType: jest.fn(async (_org: string, date: string) => options.calendar ? options.calendar(date) : week('odd')) };
  const tenantContext = { assertAccess: jest.fn() };
  const service = new ScheduleSeriesService(
    { findOne, find: jest.fn() } as never,
    { find, save, create } as never,
    calendar as never,
    tenantContext as never,
  );
  return { service, save, create, find, calendar, tenantContext };
};

describe('Lesson series expansion', () => {
  it('creates one occurrence per matching weekday inside the period', async () => {
    const { service, save } = build();
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });
    expect(result.created).toEqual(['2026-11-16', '2026-11-23']);
    expect(result.skipped).toEqual([]);
    const saved = save.mock.calls[0][0] as Array<{ startsAt: Date; endsAt: Date; status: string }>;
    expect(saved).toHaveLength(2);
    expect(saved[0].startsAt.toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(saved[0].endsAt.toISOString()).toBe('2026-11-16T11:30:00.000Z');
    expect(saved[0].status).toBe('scheduled');
  });

  it('keeps only the week that matches the series parity', async () => {
    const { service } = build({
      item: series({ weekType: 'odd' }),
      calendar: date => week(date === '2026-11-16' ? 'odd' : 'even'),
    });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });
    expect(result.created).toEqual(['2026-11-16']);
    expect(result.skipped).toEqual([{ date: '2026-11-23', reason: 'Неделя even, у серии odd' }]);
  });

  it('skips non-working days from the academic calendar', async () => {
    const { service } = build({
      calendar: date => week('odd', date === '2026-11-16' ? { id: 'holiday-a', kind: 'holiday', exceptionDate: date, weekNumber: null, weekType: null, note: null } : null),
    });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });
    expect(result.created).toEqual(['2026-11-23']);
    expect(result.skipped).toEqual([{ date: '2026-11-16', reason: 'Нерабочий день: holiday' }]);
  });

  it('is idempotent for already created occurrences', async () => {
    const { service } = build({ existing: [{ id: 'occurrence-a', startsAt: new Date('2026-11-16T10:00:00.000Z') }] });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });
    expect(result.created).toEqual(['2026-11-23']);
    expect(result.skipped).toEqual([{ date: '2026-11-16', reason: 'Занятие уже создано' }]);
  });

  it('does not write anything in dry-run mode', async () => {
    const { service, save } = build();
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29', dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.created).toHaveLength(2);
    expect(save).not.toHaveBeenCalled();
  });

  it('still expands a both-weeks series without an academic calendar', async () => {
    const { service } = build({ calendar: () => { throw new NotFoundException('Дата вне активного учебного календаря'); } });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });
    expect(result.created).toEqual(['2026-11-16', '2026-11-23']);
  });

  it('refuses to guess parity without an academic calendar', async () => {
    const { service } = build({
      item: series({ weekType: 'even' }),
      calendar: () => { throw new NotFoundException('Дата вне активного учебного календаря'); },
    });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-16' });
    expect(result.created).toEqual([]);
    expect(result.skipped[0].reason).toContain('Нет учебного календаря');
  });

  it('never creates occurrences outside the series validity', async () => {
    const { service } = build({ item: series({ validTo: new Date('2026-11-20T00:00:00.000Z') }) });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });
    expect(result.created).toEqual(['2026-11-16']);
  });

  it('rejects an inverted or oversized period', async () => {
    const { service } = build();
    await expect(service.expandSeries('series-a', { from: '2026-11-29', to: '2026-11-16' })).rejects.toThrow('Конец периода раньше начала');
    await expect(service.expandSeries('series-a', { from: '2026-01-01', to: '2028-01-01' })).rejects.toThrow('Период больше');
  });

  it('checks organization access before expanding', async () => {
    const { service, tenantContext } = build();
    await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-16' });
    expect(tenantContext.assertAccess).toHaveBeenCalledWith('university-a');
  });
});
