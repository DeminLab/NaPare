import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { ScheduleService } from '../schedule/schedule.service';
import { SibitConnectorService } from '../schedule/connectors/sibit-connector.service';
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
  let module: TestingModule;

  const mockUsersService = {
    findByUniversityId: jest.fn().mockResolvedValue([]),
    findByGroupId: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
  };

  const mockScheduleService = {
    importLessons: jest.fn().mockResolvedValue({ imported: 0, updated: 0 }),
    getTeacherGroupIds: jest.fn().mockResolvedValue([]),
  };

  const mockSibitConnectorService = {
    sync: jest.fn().mockResolvedValue({ groups: 26, lessons: 3000, teachers: 120 }),
  };

  const mockRepo = (defaults: any = {}) => ({
    find: jest.fn().mockResolvedValue(defaults.find || []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne || null),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: SibitConnectorService, useValue: mockSibitConnectorService },
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

  describe('attendance group access', () => {
    it('does not expose students from a group without the teacher\'s lessons', async () => {
      mockScheduleService.getTeacherGroupIds.mockResolvedValue(['group-1']);

      await expect(service.getGroupStudents('uni-1', 'group-2', { page: 1, limit: 50 } as any, 'teacher-1', UserRole.TEACHER))
        .rejects.toThrow(ForbiddenException);
      expect(mockUsersService.findByGroupId).not.toHaveBeenCalled();
    });

    it('returns only the teacher\'s own lesson groups for attendance', async () => {
      mockScheduleService.getTeacherGroupIds.mockResolvedValue(['group-1']);
      const groupRepository = module.get(getRepositoryToken(Group));
      groupRepository.findAndCount.mockResolvedValue([[{ id: 'group-1', name: 'ПИ-21' }], 1]);

      const result = await service.getAttendanceGroups('uni-1', 'teacher-1', UserRole.TEACHER, { page: 1, limit: 50 } as any);

      expect(result.data).toEqual([{ id: 'group-1', name: 'ПИ-21' }]);
      expect(groupRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { universityId: 'uni-1', id: expect.anything() } }));
    });
  });

  describe('importSchedule', () => {
    const importRow = {
      date: '2026-09-26',
      startTime: '09:00',
      endTime: '10:30',
      pairNumber: 1,
      subject: 'Математика',
      group: 'ПИ-21',
      teacher: 'Иванов И.И.',
      room: '305',
    };

    it('resolves a university group and imports the actual parsed lesson rows', async () => {
      const groupRepository = module.get(getRepositoryToken(Group));
      groupRepository.find.mockResolvedValue([{ id: 'group-1', name: 'ПИ-21', universityId: 'uni-1' }]);
      mockScheduleService.importLessons.mockClear();

      await service.importSchedule('uni-1', {
        fileName: 'schedule.csv',
        format: 'csv',
        rows: [importRow],
      });

      expect(mockScheduleService.importLessons).toHaveBeenCalledWith('uni-1', [expect.objectContaining({
        groupId: 'group-1',
        groupName: 'ПИ-21',
        subject: 'Математика',
        startTime: '09:00',
        endTime: '10:30',
        pairNumber: 1,
      })]);
    });

    it('rejects rows that reference groups outside the university structure', async () => {
      const groupRepository = module.get(getRepositoryToken(Group));
      groupRepository.find.mockResolvedValue([]);

      await expect(service.importSchedule('uni-1', {
        fileName: 'schedule.csv',
        format: 'csv',
        rows: [importRow],
      })).rejects.toThrow('Не найдены группы ВУЗа');
    });
  });

  describe('syncSchedule', () => {
    it('runs the SIBIT connector and reports the fetched counts', async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      const result = await service.syncSchedule('uni-1');

      expect(mockSibitConnectorService.sync).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        status: 'synced',
        groups: 26,
        lessons: 3000,
        teachers: 120,
      });
      expect(typeof result.timestamp).toBe('string');
      expect(universityRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        connectorConfig: expect.objectContaining({ status: 'active', lastSync: result.timestamp }),
      }));
    });
  });

  describe('connectors', () => {
    it('identifies Moodle as an LMS connector without offering schedule sync', async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({ id: 'uni-1', name: 'СИБИТ', connectorType: 'moodle', connectorConfig: { status: 'inactive' } });

      const result = await service.getConnectors('uni-1', { page: 1, limit: 20 } as any);

      expect(result.data).toEqual([expect.objectContaining({
        id: 'moodle',
        name: 'Moodle',
        type: 'lms',
        capabilities: { learningManagement: true },
      })]);
      expect(result.data[0].capabilities.scheduleSync).toBeUndefined();
    });

    it('persists a connector status inside the current university configuration', async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({ id: 'uni-1', name: 'СИБИТ', connectorType: 'rasp-sano', connectorConfig: { status: 'active' } });

      const result = await service.updateConnector('uni-1', 'sibit', { status: 'inactive' });

      expect(result.status).toBe('inactive');
      expect(universityRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        connectorConfig: expect.objectContaining({ status: 'inactive', updatedAt: expect.any(String) }),
      }));
    });
  });
});
