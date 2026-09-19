import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { EventBusService } from '../events/event-bus.service';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { AcademicService } from './academic.service';
import { AcademicEvent } from './entities/academic-event.entity';
import { Course } from './entities/course.entity';
import { CourseSpace } from './entities/course-space.entity';
import { LessonSpace } from './entities/lesson-space.entity';
import { LessonOccurrence } from './entities/lesson-occurrence.entity';
import { LessonSeries } from './entities/lesson-series.entity';
import { ScheduleChange } from './entities/schedule-change.entity';

const repository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  exists: jest.fn().mockResolvedValue(false),
  create: jest.fn((value) => value),
  save: jest.fn(async (value) => ({ id: 'course-1', ...value })),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('AcademicService', () => {
  let service: AcademicService;
  const context = {
    getUser: jest.fn(),
    assertAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicService,
        { provide: getRepositoryToken(Course), useValue: repository() },
        { provide: getRepositoryToken(LessonSeries), useValue: repository() },
        { provide: getRepositoryToken(LessonOccurrence), useValue: repository() },
        { provide: getRepositoryToken(AcademicEvent), useValue: repository() },
        { provide: getRepositoryToken(CourseSpace), useValue: repository() },
        { provide: getRepositoryToken(LessonSpace), useValue: repository() },
        { provide: getRepositoryToken(ScheduleChange), useValue: repository() },
        { provide: getRepositoryToken(Group), useValue: repository() },
        { provide: getRepositoryToken(Faculty), useValue: repository() },
        { provide: TenantContext, useValue: context },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();
    service = module.get(AcademicService);
  });

  it('rejects course catalog writes outside university operator scope', async () => {
    context.getUser.mockReturnValue({
      id: 'teacher-1',
      role: UserRole.TEACHER,
      universityId: 'university-1',
    });
    await expect(service.createCourse('university-1', { code: 'CS-1', name: 'Programming' }))
      .rejects.toThrow('University operator permission required');
  });
});
