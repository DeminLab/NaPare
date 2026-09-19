import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { ScheduleService } from '../schedule/schedule.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuditLog } from '../common/entities/audit-log.entity';

describe('AdminService', () => {
  let service: AdminService;

  const mockUsersService = {
    findByUniversityId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
  };

  const mockScheduleService = {
    importLessons: jest.fn().mockResolvedValue({ imported: 0, updated: 0 }),
  };

  const mockRepo = (defaults: any = {}) => ({
    find: jest.fn().mockResolvedValue(defaults.find || []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne || null),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: getRepositoryToken(University), useValue: mockRepo({ findOne: { id: 'uni-1', name: 'Test Uni' } }) },
        { provide: getRepositoryToken(Faculty), useValue: mockRepo() },
        { provide: getRepositoryToken(Group), useValue: mockRepo() },
        { provide: getRepositoryToken(AuditLog), useValue: { ...mockRepo(), findAndCount: jest.fn().mockResolvedValue([[], 0]) } },
        { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateUserRole', () => {
    it('does not allow university admins to assign the developer role', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', universityId: 'uni-1' });
      await expect(
        service.updateUserRole('uni-1', 'u1', { role: UserRole.DEVELOPER }, UserRole.UNIVERSITY_ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if requester cannot assign role', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', universityId: 'uni-1' });
      await expect(
        service.updateUserRole('uni-1', 'u1', { role: UserRole.SUPERADMIN }, UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update role if requester has permission', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'u1', universityId: 'uni-1' });
      mockUsersService.update.mockResolvedValue({ id: 'u1', role: UserRole.TEACHER });
      const result = await service.updateUserRole(
        'uni-1',
        'u1',
        { role: UserRole.TEACHER },
        UserRole.UNIVERSITY_ADMIN,
      );
      expect(result.role).toBe(UserRole.TEACHER);
    });
  });

  describe('getUniversityUsers', () => {
    it('hides platform roles from university administrators', async () => {
      const pagination = { page: 1, limit: 20 } as any;

      await service.getUniversityUsers('uni-1', pagination, UserRole.UNIVERSITY_ADMIN);

      expect(mockUsersService.findByUniversityId).toHaveBeenCalledWith(
        'uni-1',
        pagination,
        expect.not.arrayContaining([UserRole.DEVELOPER, UserRole.SUPERADMIN]),
      );
    });
  });

  describe('getUniversity', () => {
    it('should return university', async () => {
      const result = await service.getUniversity('uni-1');
      expect(result.id).toBe('uni-1');
    });
  });
});
