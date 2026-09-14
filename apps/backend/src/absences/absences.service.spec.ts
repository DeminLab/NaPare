import { Test, TestingModule } from '@nestjs/testing';
import { AbsencesService } from './absences.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Absence } from './entities/absence.entity';
import { NotFoundException } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant-context';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbsencesService,
        { provide: getRepositoryToken(Absence), useValue: mockRepo },
        { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<AbsencesService>(AbsencesService);
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
      const absence = { id: '1', confirmationRequired: true };
      mockRepo.findOne.mockResolvedValue(absence);
      const result = await service.confirm('1', 'curator-1');
      expect(result.confirmationRequired).toBe(false);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if absence not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
