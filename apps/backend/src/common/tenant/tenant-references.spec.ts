import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import { ScheduleService } from '../../schedule/schedule.service';
import { Lesson } from '../../schedule/entities/lesson.entity';
import { LessonChange } from '../../schedule/entities/lesson-change.entity';
import { Group } from '../../users/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../auth/interfaces/user-role';
import { TenantContext } from './tenant-context';

describe('Tenant boundaries of mutable references', () => {
  const actor = { id: 'admin-a', email: 'admin@a.test', role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-a' };
  const context = new TenantContext();
  const groups = { findOne: jest.fn() };
  const users = { findOne: jest.fn(), save: jest.fn() };
  const lessons = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const teacherRepository = { findOne: jest.fn() };
  const db = { getRepository: jest.fn(() => teacherRepository), transaction: jest.fn() };
  const service = new ScheduleService(
    lessons as unknown as Repository<Lesson>, {} as Repository<LessonChange>,
    new EventEmitter2(), context, db as unknown as DataSource,
    undefined, undefined, undefined, undefined, groups as unknown as Repository<Group>,
  );
  const userService = new UsersService(users as unknown as Repository<User>, context, undefined, undefined, groups as unknown as Repository<Group>);
  const ownLesson = { id: 'lesson-a', universityId: 'uni-a', groupId: 'group-a', teacherId: 'teacher-a' };
  beforeEach(() => {
    jest.clearAllMocks();
    groups.findOne.mockResolvedValue(null);
    users.findOne.mockResolvedValue({ ...actor });
    teacherRepository.findOne.mockResolvedValue(null);
    lessons.findOne.mockResolvedValue({ ...ownLesson });
  });
  const asActor = <T>(callback: () => Promise<T>) => context.runInRequest(() => {
    context.setUser(actor);
    return callback();
  });

  it('rejects changing a lesson university before opening a transaction', async () => {
    await expect(asActor(() => service.update('lesson-a', { universityId: 'uni-b' }))).rejects.toThrow(ForbiddenException);
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rejects attaching a lesson to a foreign group', async () => {
    await expect(asActor(() => service.update('lesson-a', { groupId: 'group-b' }))).rejects.toThrow(NotFoundException);
    expect(groups.findOne).toHaveBeenCalledWith({ where: { id: 'group-b', universityId: 'uni-a' } });
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rejects attaching a lesson to a foreign teacher', async () => {
    await expect(asActor(() => service.update('lesson-a', { teacherId: 'teacher-b' }))).rejects.toThrow(NotFoundException);
    expect(teacherRepository.findOne).toHaveBeenCalledWith({ where: { id: 'teacher-b', universityId: 'uni-a' } });
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rejects binding a profile to a foreign group', async () => {
    await expect(asActor(() => userService.bindGroup('admin-a', 'group-b'))).rejects.toThrow(NotFoundException);
    expect(users.save).not.toHaveBeenCalled();
  });
  it('allows binding an own-university group', async () => {
    groups.findOne.mockResolvedValue({ id: 'group-a', universityId: 'uni-a' });
    users.save.mockImplementation(value => value);
    await expect(asActor(() => userService.bindGroup('admin-a', 'group-a'))).resolves.toMatchObject({ groupId: 'group-a' });
  });
});
