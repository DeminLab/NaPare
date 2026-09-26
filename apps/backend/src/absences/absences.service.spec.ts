import { Test, TestingModule } from '@nestjs/testing';
import { AbsencesService } from './absences.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Absence } from './entities/absence.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { User } from '../users/entities/user.entity';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';

describe('AbsencesService', () => {
  let service: AbsencesService;

  const mockRepo = {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const mockTenantContext = {
    assertAccess: jest.fn(),
    getUser: jest.fn(),
  };
  const mockAttendanceRepository = {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    create: jest.fn().mockImplementation((dto) => ({ id: 'attendance-1', ...dto })),
    save: jest.fn().mockImplementation((records) => Promise.resolve(records)),
  };
  const mockLessonRepository = { findOne: jest.fn().mockResolvedValue(null) };
  const mockUserRepository = { find: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbsencesService,
        { provide: getRepositoryToken(Absence), useValue: mockRepo },
        { provide: getRepositoryToken(AttendanceRecord), useValue: mockAttendanceRepository },
        { provide: getRepositoryToken(Lesson), useValue: mockLessonRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<AbsencesService>(AbsencesService);
    jest.clearAllMocks();
    mockRepo.findAndCount.mockResolvedValue([[], 0]);
    mockRepo.findOne.mockResolvedValue(null);
    mockAttendanceRepository.find.mockResolvedValue([]);
    mockLessonRepository.findOne.mockResolvedValue(null);
    mockUserRepository.find.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByStudent', () => {
    it('should return absences for student', async () => {
      const absences = [{ id: '1', studentId: 's1' }];
      mockRepo.findAndCount.mockResolvedValue([absences, 1]);
      const result = await service.findByStudent('s1');
      expect(result).toEqual({
        data: absences,
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });
    });
  });

  describe('confirm', () => {
    it('should throw NotFoundException if absence not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.confirm('nonexistent', 'curator-1')).rejects.toThrow(NotFoundException);
    });

    it('should confirm absence', async () => {
      const absence = { id: '1', universityId: 'uni-1', confirmationRequired: true };
      mockRepo.findOne.mockResolvedValue(absence);
      mockTenantContext.getUser.mockReturnValue({
        id: 'curator-1',
        role: UserRole.CURATOR,
        universityId: 'uni-1',
      });
      const result = await service.confirm('1', 'curator-1');
      expect(result.confirmationRequired).toBe(false);
    });

    it('rejects a student confirmation attempt', async () => {
      mockRepo.findOne.mockResolvedValue({ id: '1', universityId: 'uni-1' });
      mockTenantContext.getUser.mockReturnValue({
        id: 'student-1',
        role: UserRole.STUDENT,
        universityId: 'uni-1',
      });

      await expect(service.confirm('1', 'student-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a teacher confirmation for a colleague\'s lesson', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'absence-1', universityId: 'uni-1', confirmationRequired: true, affectedLessonIds: ['lesson-1'],
      });
      mockTenantContext.getUser.mockReturnValue({
        id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1',
      });
      mockLessonRepository.findOne.mockResolvedValue(null);

      await expect(service.confirm('absence-1', 'teacher-1')).rejects.toThrow(ForbiddenException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findPendingForCurrentUniversity', () => {
    it('includes a minimal student identity for university reviewers', async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: 'admin-1', role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-1',
      });
      mockRepo.findAndCount.mockResolvedValue([[{
        id: 'absence-1', studentId: 'student-1', universityId: 'uni-1', confirmationRequired: true,
      }], 1]);
      mockUserRepository.find.mockResolvedValue([{
        id: 'student-1', firstName: 'Ирина', lastName: 'Иванова', groupId: 'group-1',
      }]);

      const result = await service.findPendingForCurrentUniversity();

      expect(result.data[0]).toEqual(expect.objectContaining({
        id: 'absence-1',
        student: { id: 'student-1', firstName: 'Ирина', lastName: 'Иванова', groupId: 'group-1' },
      }));
      expect(mockUserRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ universityId: 'uni-1', role: UserRole.STUDENT }),
      }));
    });
  });

  describe('reject', () => {
    it('resolves the pending queue while preserving the decision comment', async () => {
      const absence = { id: 'absence-1', universityId: 'uni-1', confirmationRequired: true, comment: null };
      mockRepo.findOne.mockResolvedValue(absence);
      mockTenantContext.getUser.mockReturnValue({
        id: 'curator-1', role: UserRole.CURATOR, universityId: 'uni-1',
      });

      const result = await service.reject('absence-1', 'curator-1', 'Нужна справка деканата');

      expect(result).toEqual(expect.objectContaining({
        confirmationRequired: false,
        comment: 'Нужна справка деканата',
      }));
    });
  });

  describe('create', () => {
    it('persists the date-range absence fields for the authenticated student', async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: 'student-1',
        role: UserRole.STUDENT,
        universityId: 'uni-1',
      });
      const dto = {
        type: 'sick',
        startDate: '2026-09-16',
        endDate: '2026-09-18',
        comment: 'Medical leave',
      } as unknown as import('./dto/create-absence.dto').CreateAbsenceDto;

      await service.create(dto, 'uni-1');

      expect(mockRepo.create).toHaveBeenCalledWith({
        studentId: 'student-1',
        universityId: 'uni-1',
        type: 'sick',
        startDate: new Date('2026-09-16'),
        endDate: new Date('2026-09-18'),
        comment: 'Medical leave',
        source: 'manual',
        syncStatus: 'synced',
      });
    });

    it('links a student absence to their own lesson and notifies its teacher', async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: 'student-1',
        role: UserRole.STUDENT,
        universityId: 'uni-1',
        groupId: 'group-1',
      });
      mockLessonRepository.findOne.mockResolvedValue({
        id: 'lesson-1', universityId: 'uni-1', groupId: 'group-1', teacherId: 'teacher-1',
      });

      await service.create({
        type: 'learning', startDate: '2026-09-26', endDate: '2026-09-26', lessonId: 'lesson-1',
      }, 'uni-1');

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        affectedLessonIds: ['lesson-1'], affectedLessonsCount: 1,
      }));
    });

    it('rejects an absence whose end date is before its start date', async () => {
      mockTenantContext.getUser.mockReturnValue({ id: 'student-1', role: UserRole.STUDENT, universityId: 'uni-1' });

      await expect(service.create({
        type: 'sick', startDate: '2026-09-20', endDate: '2026-09-19',
      }, 'uni-1')).rejects.toThrow(BadRequestException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects a student update of another student\'s absence', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'absence-1',
        studentId: 'student-2',
        universityId: 'uni-1',
      });
      mockTenantContext.getUser.mockReturnValue({
        id: 'student-1',
        role: UserRole.STUDENT,
        universityId: 'uni-1',
      });

      await expect(service.update('absence-1', {})).rejects.toThrow(ForbiddenException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('markAttendance', () => {
    it('persists every selected attendance status for students in the lesson group', async () => {
      mockTenantContext.getUser.mockReturnValue({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        universityId: 'uni-1',
      });
      mockLessonRepository.findOne.mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', groupId: 'group-1', teacherId: 'teacher-1' });
      mockUserRepository.find.mockResolvedValue([{ id: 'student-1' }, { id: 'student-2' }]);

      const result = await service.markAttendance('uni-1', 'teacher-1', {
        lessonId: 'lesson-1',
        entries: [
          { studentId: 'student-1', status: 'present' },
          { studentId: 'student-2', status: 'late', comment: 'Пришёл после начала пары' },
        ],
      });

      expect(result).toHaveLength(2);
      expect(mockAttendanceRepository.save).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ studentId: 'student-1', status: 'present', markedById: 'teacher-1' }),
        expect.objectContaining({ studentId: 'student-2', status: 'late', comment: 'Пришёл после начала пары' }),
      ]));
    });

    it('rejects a teacher trying to mark another teacher\'s lesson', async () => {
      mockTenantContext.getUser.mockReturnValue({ id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1' });
      mockLessonRepository.findOne.mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', groupId: 'group-1', teacherId: 'teacher-2' });

      await expect(service.markAttendance('uni-1', 'teacher-1', {
        lessonId: 'lesson-1', entries: [{ studentId: 'student-1', status: 'present' }],
      })).rejects.toThrow(ForbiddenException);
      expect(mockAttendanceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if absence not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('rejects a student deletion of another student\'s absence', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'absence-1',
        studentId: 'student-2',
        universityId: 'uni-1',
      });
      mockTenantContext.getUser.mockReturnValue({
        id: 'student-1',
        role: UserRole.STUDENT,
        universityId: 'uni-1',
      });

      await expect(service.delete('absence-1')).rejects.toThrow(ForbiddenException);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
