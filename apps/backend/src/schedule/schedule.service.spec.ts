import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { UserRole } from '../auth/interfaces/user-role';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantContext } from '../common/tenant/tenant-context';
import { DataSource } from 'typeorm';

describe('ScheduleService', () => {
  let service: ScheduleService;

  const mockLessonRepo = {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockChangeRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
  const mockTenantContext = { assertAccess: jest.fn(), getUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepo },
        { provide: getRepositoryToken(LessonChange), useValue: mockChangeRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: TenantContext, useValue: mockTenantContext },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    jest.clearAllMocks();
    mockTenantContext.getUser.mockReturnValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should throw if lesson not found', async () => {
      mockLessonRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow('Lesson with id nonexistent not found');
    });

    it('should return lesson if found', async () => {
      const lesson = { id: '1', subject: 'Math' };
      mockLessonRepo.findOne.mockResolvedValue(lesson);
      const result = await service.findById('1');
      expect(result).toEqual(lesson);
    });
  });

  describe('findAccessibleById', () => {
    it('does not expose another group\'s lesson to a student', async () => {
      mockLessonRepo.findOne.mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', groupId: 'group-2' });

      await expect(service.findAccessibleById('lesson-1', {
        id: 'student-1', universityId: 'uni-1', role: UserRole.STUDENT, groupId: 'group-1',
      })).rejects.toThrow(ForbiddenException);
    });

    it('does not expose another teacher\'s lesson', async () => {
      mockLessonRepo.findOne.mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', teacherId: 'teacher-2' });

      await expect(service.findAccessibleById('lesson-1', {
        id: 'teacher-1', universityId: 'uni-1', role: UserRole.TEACHER,
      })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('student schedule scope', () => {
    it('filters the database fallback by the student group', async () => {
      await service.findForStudentDateRange('uni-1', 'group-1', '2026-09-26', '2026-10-02');

      expect(mockLessonRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ universityId: 'uni-1', groupId: 'group-1' }),
      }));
    });
  });

  describe('create', () => {
    it('should create and save a lesson', async () => {
      const dto = { subject: 'Math', groupId: 'g1', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', pairNumber: 1, startDate: new Date(), endDate: new Date() };
      const result = await service.create(dto as any);
      expect(result.id).toBe('1');
      expect(mockLessonRepo.save).toHaveBeenCalled();
    });

    it('rejects a teacher attempting to create a lesson for a colleague', async () => {
      mockTenantContext.getUser.mockReturnValue({ id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1' });

      await expect(service.create({ subject: 'Math', groupId: 'g1', teacherId: 'teacher-2', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', pairNumber: 1, startDate: new Date(), endDate: new Date() } as any)).rejects.toThrow(ForbiddenException);

      expect(mockLessonRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a lesson', async () => {
      mockLessonRepo.findOne.mockResolvedValue({ id: '1', universityId: 'uni-1' });
      await service.delete('1');
      expect(mockLessonRepo.delete).toHaveBeenCalledWith('1');
    });

    it('rejects a teacher deleting a colleague\'s lesson', async () => {
      mockTenantContext.getUser.mockReturnValue({ id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1' });
      mockLessonRepo.findOne.mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', teacherId: 'teacher-2' });

      await expect(service.delete('lesson-1')).rejects.toThrow(ForbiddenException);
      expect(mockLessonRepo.delete).not.toHaveBeenCalled();
    });
  });
});
