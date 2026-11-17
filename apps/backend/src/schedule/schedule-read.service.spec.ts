import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../auth/interfaces/user-role';
import { ScheduleReadService } from './schedule-read.service';

const actor = (overrides: Record<string, unknown> = {}) => ({
  id: 'student-a',
  role: UserRole.STUDENT,
  organizationId: 'university-a',
  groupId: 'group-a',
  ...overrides,
});

const lesson = (overrides: Record<string, unknown> = {}) => ({
  id: 'lesson-a',
  organizationId: 'university-a',
  groupId: 'group-a',
  teacherId: 'teacher-a',
  subject: 'Математика',
  subjectType: 'lecture',
  room: '301',
  building: 'A',
  subgroup: null,
  pairNumber: 2,
  startTime: '10:00',
  endTime: '11:30',
  startDate: new Date('2026-11-16T10:00:00.000Z'),
  endDate: new Date('2026-11-16T11:30:00.000Z'),
  isChanged: false,
  changeDescription: '',
  seriesId: null,
  occurrenceId: null,
  ...overrides,
});

const occurrence = (overrides: Record<string, unknown> = {}) => ({
  id: 'occurrence-a',
  organizationId: 'university-a',
  seriesId: 'series-a',
  courseId: 'course-a',
  groupId: 'group-a',
  teacherId: 'teacher-a',
  startsAt: new Date('2026-11-16T10:00:00.000Z'),
  endsAt: new Date('2026-11-16T11:30:00.000Z'),
  room: '301',
  building: 'A',
  status: 'scheduled',
  changeReason: null,
  legacyLessonId: null,
  ...overrides,
});

const build = (options: {
  lessons?: Array<Record<string, unknown>>;
  occurrences?: Array<Record<string, unknown>>;
  series?: Array<Record<string, unknown>>;
  groups?: Array<Record<string, unknown>>;
  users?: Array<Record<string, unknown>>;
} = {}) => {
  const lessonFind = jest.fn().mockResolvedValue(options.lessons ?? []);
  const occurrenceFind = jest.fn().mockResolvedValue(options.occurrences ?? []);
  const seriesFind = jest.fn().mockResolvedValue(options.series ?? []);
  const groupFind = jest.fn().mockResolvedValue(options.groups ?? []);
  const userFind = jest.fn().mockResolvedValue(options.users ?? []);
  const tenantContext = { assertAccess: jest.fn() };
  const service = new ScheduleReadService(
    { find: lessonFind } as never,
    { find: occurrenceFind } as never,
    { find: seriesFind } as never,
    { find: groupFind } as never,
    { find: userFind } as never,
    tenantContext as never,
  );
  return { service, lessonFind, occurrenceFind, seriesFind, groupFind, userFind, tenantContext };
};

describe('Schedule read model', () => {
  it('returns every day of the period, including empty ones', async () => {
    const { service } = build({ lessons: [lesson()] });
    const result = await service.readRange(actor(), { from: '2026-11-16', to: '2026-11-18' });
    expect(result.days.map(day => day.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(result.days[0].lessons).toHaveLength(1);
    expect(result.days[1].lessons).toEqual([]);
  });

  it('maps a legacy lesson into a dated entry with names', async () => {
    const { service } = build({
      lessons: [lesson({ isChanged: true, changeDescription: 'Перенос в другой корпус' })],
      groups: [{ id: 'group-a', name: 'ИС-21' }],
      users: [{ id: 'teacher-a', firstName: 'Иван', lastName: 'Иванов' }],
    });
    const result = await service.readRange(actor(), { from: '2026-11-16', to: '2026-11-16' });
    expect(result.days[0].lessons[0]).toMatchObject({
      id: 'lesson:lesson-a',
      source: 'lesson',
      subject: 'Математика',
      groupName: 'ИС-21',
      teacherName: 'Иван Иванов',
      state: 'changed',
      change: { type: 'changed', reason: 'Перенос в другой корпус' },
    });
  });

  it('merges a series occurrence with its legacy lesson without duplicating the slot', async () => {
    const { service } = build({
      lessons: [lesson({ occurrenceId: 'occurrence-a', seriesId: 'series-a' })],
      occurrences: [occurrence({ legacyLessonId: 'lesson-a', status: 'rescheduled', changeReason: 'Аудитория занята' })],
      series: [{ id: 'series-a', title: 'Математика', subjectType: 'lecture', pairNumber: 2 }],
    });
    const result = await service.readRange(actor(), { from: '2026-11-16', to: '2026-11-16' });
    expect(result.days[0].lessons).toHaveLength(1);
    expect(result.days[0].lessons[0]).toMatchObject({
      id: 'occurrence:occurrence-a',
      source: 'series',
      subject: 'Математика',
      state: 'changed',
      lessonId: 'lesson-a',
      occurrenceId: 'occurrence-a',
    });
  });

  it('keeps a cancelled occurrence visible instead of dropping it', async () => {
    const { service } = build({ occurrences: [occurrence({ status: 'cancelled' })] });
    const result = await service.readRange(actor(), { from: '2026-11-16', to: '2026-11-16' });
    expect(result.days[0].lessons[0].state).toBe('cancelled');
  });

  it('forces a student to their own group even if another group is requested', async () => {
    const { service, lessonFind } = build();
    await service.readRange(actor(), { from: '2026-11-16', to: '2026-11-16', groupId: 'group-b' });
    expect(lessonFind.mock.calls[0][0].where.groupId).toBe('group-a');
  });

  it('forces a teacher to their own lessons', async () => {
    const { service, lessonFind, occurrenceFind } = build();
    await service.readRange(actor({ id: 'teacher-a', role: UserRole.TEACHER, groupId: null }), {
      from: '2026-11-16', to: '2026-11-16', teacherId: 'teacher-b', groupId: 'group-b',
    });
    expect(lessonFind.mock.calls[0][0].where.teacherId).toBe('teacher-a');
    expect(lessonFind.mock.calls[0][0].where.groupId).toBeUndefined();
    expect(occurrenceFind.mock.calls[0][0].where.teacherId).toBe('teacher-a');
  });

  it('rejects an inverted or oversized period', async () => {
    const { service } = build();
    await expect(service.readRange(actor(), { from: '2026-11-18', to: '2026-11-16' })).rejects.toThrow(BadRequestException);
    await expect(service.readRange(actor(), { from: '2026-01-01', to: '2026-12-31' })).rejects.toThrow('Период больше');
  });

  it('checks organization access and rejects an actor without a university', async () => {
    const { service, tenantContext } = build();
    await expect(service.readRange(actor({ organizationId: null }), { from: '2026-11-16', to: '2026-11-16' })).rejects.toThrow(BadRequestException);
    expect(tenantContext.assertAccess).not.toHaveBeenCalled();
  });
});
