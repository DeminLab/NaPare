import { ConflictException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { ScheduleService } from './schedule.service';

const base = {
  organizationId: 'university-a',
  groupId: 'group-a',
  teacherId: 'teacher-a',
  room: '301',
  dayOfWeek: 1,
  startDate: '2026-09-01',
  endDate: '2026-12-25',
  startTime: '10:00',
  endTime: '11:30',
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'lesson-existing',
  organizationId: 'university-a',
  groupId: 'group-a',
  groupName: 'ИС-21',
  teacherId: 'teacher-a',
  teacherName: 'Иванов',
  room: '301',
  subject: 'Математика',
  dayOfWeek: 1,
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2026-12-25T00:00:00.000Z'),
  startTime: '10:00',
  endTime: '11:30',
  weekType: 'both',
  ...overrides,
});

const buildService = (rows: Array<Record<string, unknown>>) => {
  const find = jest.fn().mockResolvedValue(rows);
  const lessonRepository = { find } as unknown as ConstructorParameters<typeof ScheduleService>[0];
  const service = new ScheduleService(
    lessonRepository,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, find };
};

const operatorValue = (value: unknown) => value instanceof FindOperator ? value.value : value;

describe('Schedule conflicts', () => {
  it('reports teacher, group and room clashes for an overlapping lesson', async () => {
    const { service, find } = buildService([row()]);
    const conflicts = await service.findConflicts(base);
    expect(conflicts.map(conflict => conflict.type)).toEqual(['teacher', 'group', 'room']);
    expect(conflicts[0]).toMatchObject({ lessonId: 'lesson-existing', dateFrom: '2026-09-01' });
    expect(find).toHaveBeenCalledTimes(1);
    const where = find.mock.calls[0][0].where;
    expect(where.organizationId).toBe('university-a');
    expect(where.dayOfWeek).toBe(1);
    expect(operatorValue(where.startTime)).toBe('11:30');
    expect(operatorValue(where.endTime)).toBe('10:00');
    expect(where.startDate).toBeInstanceOf(FindOperator);
    expect(where.endDate).toBeInstanceOf(FindOperator);
  });

  it('ignores lessons on the other week and the lesson being edited', async () => {
    const { service } = buildService([
      row({ id: 'odd-lesson', weekType: 'odd' }),
      row({ id: 'edited-lesson' }),
    ]);
    expect(await service.findConflicts({ ...base, weekType: 'even' }, 'edited-lesson')).toHaveLength(0);
  });

  it('does not treat a different room, group or teacher as a conflict', async () => {
    const { service } = buildService([
      row({ groupId: 'group-b', teacherId: 'teacher-b', room: '302' }),
    ]);
    expect(await service.findConflicts(base)).toHaveLength(0);
  });

  it('lets a lesson keep its own slot when nothing else overlaps', async () => {
    const { service } = buildService([]);
    expect(await service.findConflicts(base)).toHaveLength(0);
  });

  it('rejects an invalid time interval before querying the database', async () => {
    const { service, find } = buildService([row()]);
    expect(await service.findConflicts({ ...base, startTime: '12:00', endTime: '11:00' })).toHaveLength(0);
    expect(find).not.toHaveBeenCalled();
  });

  it('refuses to guess when the weekday is missing', async () => {
    const { service, find } = buildService([row()]);
    expect(await service.findConflicts({ ...base, dayOfWeek: undefined })).toHaveLength(0);
    expect(await service.findConflicts({ ...base, dayOfWeek: null })).toHaveLength(0);
    expect(find).not.toHaveBeenCalled();
  });

  it('throws a conflict error with a readable reason and machine-readable list', async () => {
    const { service } = buildService([row()]);
    const error = await (service as unknown as {
      assertNoScheduleConflicts: (candidate: unknown) => Promise<void>;
    }).assertNoScheduleConflicts(base).catch(reason => reason);
    expect(error).toBeInstanceOf(ConflictException);
    const response = error.getResponse() as { code: string; message: string; conflicts: unknown[] };
    expect(response.code).toBe('SCHEDULE_CONFLICT');
    expect(response.message).toContain('Иванов');
    expect(response.message).toContain('10:00–11:30');
    expect(response.conflicts).toHaveLength(3);
  });
});
