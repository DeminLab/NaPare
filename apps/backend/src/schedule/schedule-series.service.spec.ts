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
  item?: LessonSeries | null;
  existing?: Array<{ id: string; startsAt: Date }>;
  legacy?: { id: string; occurrenceId?: string | null; seriesId?: string | null } | null;
  series?: LessonSeries[];
  ownedLessons?: Array<{ id: string }>;
  conflicts?: unknown[];
  calendar?: (date: string) => unknown;
} = {}) => {
  const existing = options.existing ?? [];
  const save = jest.fn(async (value: unknown) => value);
  let occurrenceSeq = 0;
  const create = jest.fn((value: unknown) => ({ ...(value as object), id: `occurrence-${occurrenceSeq += 1}` }));
  const find = jest.fn().mockResolvedValue(existing);
  const seriesFind = jest.fn().mockResolvedValue(options.series ?? []);
  const seriesRemove = jest.fn(async (value: unknown) => value);
  const seriesSave = jest.fn(async (value: unknown) => value);
  const seriesCreate = jest.fn((value: unknown) => value);
  const findOne = jest.fn().mockResolvedValue(options.item === undefined ? series() : options.item);
  const lessonSave = jest.fn(async (value: unknown) => value);
  const lessonCreate = jest.fn((value: unknown) => value);
  const lessonFindOne = jest.fn().mockResolvedValue(options.legacy ?? null);
  const lessonFind = jest.fn().mockResolvedValue(options.ownedLessons ?? []);
  const calendar = { getWeekType: jest.fn(async (_org: string, date: string) => options.calendar ? options.calendar(date) : week('odd')) };
  const tenantContext = { assertAccess: jest.fn() };
  const scheduleService = {
    findConflicts: jest.fn().mockResolvedValue(options.conflicts ?? []),
    assertLessonReferences: jest.fn(),
  };
  const service = new ScheduleSeriesService(
    { findOne, find: seriesFind, remove: seriesRemove, save: seriesSave, create: seriesCreate } as never,
    { find, save, create } as never,
    { findOne: lessonFindOne, find: lessonFind, save: lessonSave, create: lessonCreate } as never,
    calendar as never,
    tenantContext as never,
    scheduleService as never,
  );
  return { service, save, create, find, calendar, tenantContext, lessonSave, lessonCreate, lessonFindOne, seriesFind, seriesSave, seriesRemove, scheduleService };
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

  it('mirrors every occurrence into a linked legacy lesson', async () => {
    const { service, lessonCreate, lessonSave } = build();
    await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29' });

    expect(lessonCreate).toHaveBeenCalledTimes(2);
    const first = lessonCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(first).toMatchObject({
      organizationId: 'university-a',
      groupId: 'group-a',
      courseId: 'course-a',
      seriesId: 'series-a',
      occurrenceId: 'occurrence-1',
      teacherId: 'teacher-a',
      subject: 'Математика',
      subjectType: 'lecture',
      room: '301',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:30',
      pairNumber: 2,
    });
    expect((first.startDate as Date).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect((first.endDate as Date).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    const linked = lessonSave.mock.calls.map(call => call[0] as { id?: string });
    expect(linked.map(lesson => lesson.id)).toEqual([undefined, undefined]);
  });

  it('links a legacy lesson that already belongs to the series', async () => {
    const { service, lessonCreate, lessonSave } = build({ legacy: { id: 'lesson-imported', occurrenceId: null, seriesId: 'series-a' } });
    await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-16' });

    expect(lessonCreate).not.toHaveBeenCalled();
    const stored = lessonSave.mock.calls[0][0] as Record<string, unknown>;
    expect(stored).toMatchObject({ id: 'lesson-imported', occurrenceId: 'occurrence-1', seriesId: 'series-a' });
  });

  it('leaves a slot that belongs to another lesson untouched', async () => {
    const { service, lessonCreate, lessonSave, save } = build({ legacy: { id: 'lesson-other', occurrenceId: null, seriesId: 'other-series' } });
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-16' });

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([{ date: '2026-11-16', reason: 'Слот занят другим занятием' }]);
    expect(lessonCreate).not.toHaveBeenCalled();
    expect(lessonSave).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not write anything in dry-run mode', async () => {
    const { service, save, lessonSave } = build();
    const result = await service.expandSeries('series-a', { from: '2026-11-16', to: '2026-11-29', dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.created).toHaveLength(2);
    expect(save).not.toHaveBeenCalled();
    expect(lessonSave).not.toHaveBeenCalled();
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


describe('Lesson series CRUD', () => {
  const input = {
    groupId: 'group-a',
    teacherId: 'teacher-a',
    courseId: 'course-a',
    title: 'Математика',
    subjectType: 'lecture',
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '11:30',
    pairNumber: 2,
    room: '301',
    validFrom: '2026-09-01',
  };

  it('lists the series of the university with optional filters', async () => {
    const { service, seriesFind, tenantContext } = build({ series: [series()] });
    const result = await service.list('university-a', { groupId: 'group-a' });

    expect(result).toHaveLength(1);
    expect(seriesFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'university-a', groupId: 'group-a' },
    }));
    expect(tenantContext.assertAccess).toHaveBeenCalledWith('university-a');
  });

  it('creates a series after checking references and conflicts', async () => {
    const { service, scheduleService } = build();
    const created = await service.create('university-a', input);

    expect(created).toMatchObject({ groupId: 'group-a', dayOfWeek: 1, startTime: '10:00', endTime: '11:30', weekType: 'both', source: 'manual' });
    expect(scheduleService.assertLessonReferences).toHaveBeenCalledWith('university-a', 'group-a', 'teacher-a');
    expect(scheduleService.findConflicts).toHaveBeenCalled();
  });

  it('rejects a series that clashes with an existing lesson', async () => {
    const { service, scheduleService } = build({
      conflicts: [{ type: 'group', lessonId: 'lesson-a', subject: 'Физика', startTime: '10:00', endTime: '11:30', dateFrom: '2026-11-23', dateTo: '2026-11-23' }],
    });

    await expect(service.create('university-a', input)).rejects.toMatchObject({
      response: { code: 'SCHEDULE_CONFLICT' },
    });
    expect(scheduleService.findConflicts).toHaveBeenCalled();
  });

  it('does not count the lessons generated by the series being edited', async () => {
    const { service, scheduleService } = build({
      ownedLessons: [{ id: 'lesson-own' }],
      conflicts: [{ type: 'group', lessonId: 'lesson-own', subject: 'Математика', startTime: '10:00', endTime: '11:30', dateFrom: '2026-11-23', dateTo: '2026-11-23' }],
    });

    await expect(service.update('series-a', { room: '302' })).resolves.toMatchObject({ room: '302' });
    expect(scheduleService.findConflicts).toHaveBeenCalled();
  });

  it('validates the series window before writing', async () => {
    const { service } = build();
    await expect(service.create('university-a', { ...input, startTime: '12:00', endTime: '11:00' }))
      .rejects.toThrow('Окончание занятия должно быть позже начала');
    await expect(service.create('university-a', { ...input, validTo: '2026-08-01' }))
      .rejects.toThrow('Дата окончания действия раньше начала');
  });

  it('removes the template and reports a missing series', async () => {
    const { service, seriesRemove } = build();
    await expect(service.remove('series-a')).resolves.toEqual({ id: 'series-a', deleted: true });
    expect(seriesRemove).toHaveBeenCalled();

    const missing = build({ item: null });
    await expect(missing.service.remove('series-x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
