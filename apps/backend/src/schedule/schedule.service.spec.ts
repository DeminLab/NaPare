import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleService } from './schedule.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantContext } from '../common/tenant/tenant-context';

describe('ScheduleService', () => {
  let service: ScheduleService;

  const mockLessonRepo = {
    find: jest.fn().mockResolvedValue([]),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepo },
        { provide: getRepositoryToken(LessonChange), useValue: mockChangeRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
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

  describe('create', () => {
    it('should create and save a lesson', async () => {
      const dto = { subject: 'Math', groupId: 'g1', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', pairNumber: 1, startDate: new Date(), endDate: new Date() };
      const result = await service.create(dto as any);
      expect(result.id).toBe('1');
      expect(mockLessonRepo.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a lesson', async () => {
      await service.delete('1');
      expect(mockLessonRepo.delete).toHaveBeenCalledWith('1');
    });
  });
});
