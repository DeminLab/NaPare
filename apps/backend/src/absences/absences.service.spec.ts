import { Test, TestingModule } from '@nestjs/testing';
import { AbsencesService } from './absences.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Absence } from './entities/absence.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbsencesService,
        { provide: getRepositoryToken(Absence), useValue: mockRepo },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<AbsencesService>(AbsencesService);
    jest.clearAllMocks();
    mockRepo.findAndCount.mockResolvedValue([[], 0]);
    mockRepo.findOne.mockResolvedValue(null);
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
