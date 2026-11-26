import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { UsersService } from "../users/users.service";
import { ScheduleService } from "../schedule/schedule.service";
import { SibitConnectorService } from "../schedule/connectors/sibit-connector.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { University } from "../users/entities/university.entity";
import { Faculty } from "../users/entities/faculty.entity";
import { Group } from "../users/entities/group.entity";
import { User } from "../users/entities/user.entity";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "../auth/interfaces/user-role";
import { TenantContext } from "../common/tenant/tenant-context";
import { AuditLog } from "../common/entities/audit-log.entity";
import { Lesson } from "../schedule/entities/lesson.entity";
import { EventBusService } from "../events/event-bus.service";
import { MoodleConnectorService } from "../moodle/moodle-connector.service";
import { ScheduleImportService } from '../schedule/connectors/schedule-import.service';
import { RaspScraperService } from "../auth/rasp-scraper.service";

describe("AdminService", () => {
  let service: AdminService;
  let module: TestingModule;

  const mockUsersService = {
    findByOrganizationId: jest.fn().mockResolvedValue([]),
    findByGroupId: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    findById: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    findByUsername: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockImplementation((data) =>
        Promise.resolve({ id: "created-user", ...data }),
      ),
    update: jest.fn(),
    invalidateSessions: jest.fn(),
  };

  const mockScheduleService = {
    importLessons: jest.fn().mockResolvedValue({ imported: 0, updated: 0 }),
    getTeacherGroupIds: jest.fn().mockResolvedValue([]),
  };

  const mockSibitConnectorService = {
    sync: jest.fn().mockResolvedValue({
      groups: 26,
      lessons: 3000,
      teachers: 120,
      catalog: { groups: [], lessons: [], academicYear: "2026-2027" },
    }),
  };
  const mockScheduleImports = { submit: jest.fn().mockResolvedValue({ status: 'queued', jobId: 'job-1' }) };
  const mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const mockMoodleConnectorService = {
    configure: jest.fn(),
    testConnection: jest.fn(),
  };
  const mockRaspScraperService = { isValidGroup: jest.fn().mockResolvedValue(false) };

  const mockRepo = (defaults: any = {}) => ({
    find: jest.fn().mockResolvedValue(defaults.find || []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne || null),
    create: jest.fn().mockImplementation((dto) => ({ id: "1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn(),
  });
  let mockUniversityRepository: ReturnType<typeof mockRepo>;
  let mockUserRepository: ReturnType<typeof mockRepo>;
  let sibitFacultyRepository: any;
  let sibitGroupRepository: any;
  let mockAuditQueryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  const configureSibitTransaction = (options: { faculties?: any[]; groups?: any[] } = {}) => {
    const facultyRows = options.faculties ?? [];
    const groupRows = options.groups ?? [];
    const facultyQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(facultyRows),
    };
    const groupQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(groupRows[0] ?? null),
    };
    sibitFacultyRepository = {
      ...mockRepo(),
      createQueryBuilder: jest.fn().mockReturnValue(facultyQueryBuilder),
    };
    sibitGroupRepository = {
      ...mockRepo(),
      createQueryBuilder: jest.fn().mockReturnValue(groupQueryBuilder),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => entity === Faculty ? sibitFacultyRepository : sibitGroupRepository),
    };
    const groupRepository = module.get(getRepositoryToken(Group));
    groupRepository.manager = {
      transaction: jest.fn((callback: (transactionManager: typeof manager) => Promise<unknown>) => callback(manager)),
    };
    return { facultyQueryBuilder, groupQueryBuilder };
  };

  beforeEach(async () => {
    mockUniversityRepository = mockRepo({ findOne: { id: "uni-1", name: "Test Uni" } });
    mockUserRepository = mockRepo();
    mockRaspScraperService.isValidGroup.mockReset().mockResolvedValue(false);
    mockAuditQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: ScheduleImportService, useValue: mockScheduleImports },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: SibitConnectorService, useValue: mockSibitConnectorService },
        { provide: RaspScraperService, useValue: mockRaspScraperService },
        { provide: getRepositoryToken(University), useValue: mockUniversityRepository },
        { provide: getRepositoryToken(Faculty), useValue: mockRepo() },
        { provide: getRepositoryToken(Group), useValue: mockRepo() },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            ...mockRepo(),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            createQueryBuilder: jest.fn().mockReturnValue(mockAuditQueryBuilder),
          },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Lesson), useValue: mockRepo() },
        {
          provide: TenantContext,
          useValue: { assertAccess: jest.fn(), getUser: jest.fn() },
        },
        { provide: EventBusService, useValue: mockEventBus },
        {
          provide: MoodleConnectorService,
          useValue: mockMoodleConnectorService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    mockEventBus.publish.mockClear();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("faculty dean assignment", () => {
    it("assigns only an active faculty dean from the same university", async () => {
      const facultyRepository = module.get(getRepositoryToken(Faculty));
      mockUserRepository.findOne.mockResolvedValue({ id: "dean-1" });

      await service.createFaculty("uni-1", {
        name: "Информатика",
        code: "ИНФ",
        deanUserId: "dean-1",
      });

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: "dean-1", organizationId: "uni-1", role: UserRole.FACULTY_DEAN, isActive: true },
        select: { id: true },
      });
      expect(facultyRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        name: "Информатика",
        deanUserId: "dean-1",
        organizationId: "uni-1",
      }));
    });

    it("rejects dean accounts outside the university or with an inactive/wrong role", async () => {
      const facultyRepository = module.get(getRepositoryToken(Faculty));
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.createFaculty("uni-1", {
        name: "Информатика",
        code: "ИНФ",
        deanUserId: "other-university-user",
      })).rejects.toThrow(BadRequestException);

      expect(facultyRepository.save).not.toHaveBeenCalled();
    });

    it("allows clearing an existing dean without requiring a replacement", async () => {
      const facultyRepository = module.get(getRepositoryToken(Faculty));
      const existing = { id: "faculty-1", organizationId: "uni-1", deanUserId: "dean-1" };
      facultyRepository.findOne.mockResolvedValue(existing);

      await expect(service.updateFaculty("faculty-1", { deanUserId: null }))
        .resolves.toMatchObject({ deanUserId: null });

      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(facultyRepository.save).toHaveBeenCalledWith(existing);
    });
  });

  describe("getAuditLog", () => {
    it("filters audit events by university without limiting the account set", async () => {
      const event = {
        id: "event-101",
        userId: "user-101",
        action: "profile.updated",
        entity: "profile",
        entityId: "profile-101",
        oldValues: {},
        newValues: {},
        ip: "127.0.0.1",
        userAgent: "test-agent",
        createdAt: new Date("2026-10-18T00:00:00.000Z"),
      } as AuditLog;
      mockAuditQueryBuilder.getManyAndCount.mockResolvedValue([[event], 51]);
      mockUsersService.findByOrganizationId.mockClear();

      const result = await service.getAuditLog("uni-1", { page: 2, limit: 25 });

      expect(mockAuditQueryBuilder.innerJoin).toHaveBeenCalledWith(
        User,
        "auditUser",
        "auditUser.id = auditLog.userId",
      );
      expect(mockAuditQueryBuilder.where).toHaveBeenCalledWith(
        "auditUser.organizationId = :organizationId",
        { organizationId: "uni-1" },
      );
      expect(mockAuditQueryBuilder.skip).toHaveBeenCalledWith(25);
      expect(mockAuditQueryBuilder.take).toHaveBeenCalledWith(25);
      expect(mockUsersService.findByOrganizationId).not.toHaveBeenCalled();
      expect(result.data).toEqual([{ ...event, source: "user action" }]);
      expect(result.meta.total).toBe(51);
    });
  });

  describe("updateUserRole", () => {
    it("does not allow university admins to assign the developer role", async () => {
      mockUsersService.findById.mockResolvedValue({
        id: "u1",
        organizationId: "uni-1",
      });
      await expect(
        service.updateUserRole(
          "uni-1",
          "u1",
          { role: UserRole.DEVELOPER },
          "admin-1",
          UserRole.UNIVERSITY_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if requester cannot assign role", async () => {
      mockUsersService.findById.mockResolvedValue({
        id: "u1",
        organizationId: "uni-1",
      });
      await expect(
        service.updateUserRole(
          "uni-1",
          "u1",
          { role: UserRole.SUPERADMIN },
          "student-1",
          UserRole.STUDENT,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should update role if requester has permission", async () => {
      mockUsersService.findById.mockResolvedValue({
        id: "u1",
        organizationId: "uni-1",
      });
      mockUsersService.update.mockResolvedValue({
        id: "u1",
        role: UserRole.TEACHER,
      });
      const result = await service.updateUserRole(
        "uni-1",
        "u1",
        { role: UserRole.TEACHER },
        "admin-1",
        UserRole.UNIVERSITY_ADMIN,
      );
      expect(result.role).toBe(UserRole.TEACHER);
      expect(mockUsersService.invalidateSessions).toHaveBeenCalledWith("u1", { afterAuthorizedRoleChange: true });
    });

    it("lets a developer change lower roles but blocks peer and higher accounts", async () => {
      mockUsersService.findById.mockResolvedValue({ id: "student-1", organizationId: "uni-1", role: UserRole.STUDENT });
      mockUsersService.update.mockResolvedValue({ id: "student-1", role: UserRole.TEACHER });
      await expect(service.updateUserRole("uni-1", "student-1", { role: UserRole.TEACHER }, "developer-1", UserRole.DEVELOPER)).resolves.toMatchObject({ role: UserRole.TEACHER });

      mockUsersService.findById.mockResolvedValue({ id: "developer-2", organizationId: "uni-1", role: UserRole.DEVELOPER });
      await expect(service.updateUserRole("uni-1", "developer-2", { role: UserRole.STUDENT }, "developer-1", UserRole.DEVELOPER)).rejects.toThrow(ForbiddenException);
      await expect(service.updateUserRole("uni-1", "developer-2", { role: UserRole.SUPERADMIN }, "developer-1", UserRole.DEVELOPER)).rejects.toThrow(ForbiddenException);
    });

    it("lets a superadmin promote a developer and blocks self role changes", async () => {
      mockUsersService.findById.mockResolvedValue({ id: "developer-2", organizationId: "uni-1", role: UserRole.DEVELOPER });
      mockUsersService.update.mockResolvedValue({ id: "developer-2", role: UserRole.SUPERADMIN });
      await expect(service.updateUserRole("uni-1", "developer-2", { role: UserRole.SUPERADMIN }, "superadmin-1", UserRole.SUPERADMIN)).resolves.toMatchObject({ role: UserRole.SUPERADMIN });
      await expect(service.updateUserRole("uni-1", "superadmin-1", { role: UserRole.STUDENT }, "superadmin-1", UserRole.SUPERADMIN)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("university user lifecycle", () => {
    it("creates a tenant-scoped account with a password hash", async () => {
      const result = await service.createUniversityUser(
        "uni-1",
        {
          username: "student.one",
          email: "student@university.ru",
          password: "temporary-password-2026",
          firstName: "Анна",
          lastName: "Иванова",
          role: UserRole.STUDENT,
        },
        UserRole.UNIVERSITY_ADMIN,
      );

      expect(result).toEqual(
        expect.objectContaining({
          organizationId: "uni-1",
          email: "student@university.ru",
          passwordHash: expect.any(String),
        }),
      );
      expect(result.passwordHash).not.toBe("temporary-password-2026");
    });

    it("creates a student with the validated external SIBIT group id", async () => {
      mockUniversityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        city: "Омск",
        connectorType: "rasp-sano",
      });
      mockRaspScraperService.isValidGroup.mockResolvedValue(true);

      const result = await service.createUniversityUser(
        "uni-1",
        {
          username: "student.two",
          email: "student@university.ru",
          password: "temporary-password-2026",
          firstName: "Анна",
          lastName: "Иванова",
          role: UserRole.STUDENT,
          groupId: "12131",
        },
        UserRole.UNIVERSITY_ADMIN,
      );

      expect(mockRaspScraperService.isValidGroup).toHaveBeenCalledWith("12131");
      expect(result.groupId).toBe("12131");
    });

    it("does not let an operator deactivate their own account", async () => {
      await expect(
        service.updateUniversityUserStatus(
          "uni-1",
          "admin-1",
          { isActive: false },
          "admin-1",
          UserRole.UNIVERSITY_ADMIN,
        ),
      ).rejects.toThrow("собственной учётной записи");
    });

    it("blocks a developer from changing developer and superadmin statuses", async () => {
      mockUsersService.findById.mockResolvedValue({ id: "developer-2", organizationId: "uni-1", role: UserRole.DEVELOPER });
      await expect(service.updateUniversityUserStatus("uni-1", "developer-2", { isActive: false }, "developer-1", UserRole.DEVELOPER)).rejects.toThrow(ForbiddenException);
      mockUsersService.findById.mockResolvedValue({ id: "superadmin-1", organizationId: "uni-1", role: UserRole.SUPERADMIN });
      await expect(service.updateUniversityUserStatus("uni-1", "superadmin-1", { isActive: false }, "developer-1", UserRole.DEVELOPER)).rejects.toThrow(ForbiddenException);
    });

    it("lets a superadmin change a developer status", async () => {
      mockUsersService.findById.mockResolvedValue({ id: "developer-2", organizationId: "uni-1", role: UserRole.DEVELOPER });
      mockUsersService.update.mockResolvedValue({ id: "developer-2", isActive: false });
      await expect(service.updateUniversityUserStatus("uni-1", "developer-2", { isActive: false }, "superadmin-1", UserRole.SUPERADMIN)).resolves.toMatchObject({ isActive: false });
    });

    it("replaces a managed user password with a hash", async () => {
      mockUsersService.findById.mockResolvedValue({
        id: "student-1",
        organizationId: "uni-1",
        role: UserRole.STUDENT,
      });
      mockUsersService.update.mockImplementation((id, data) =>
        Promise.resolve({ id, ...data }),
      );

      const result = await service.resetUniversityUserPassword(
        "uni-1",
        "student-1",
        { password: "replacement-password-2026" },
        UserRole.UNIVERSITY_ADMIN,
      );

      expect(result.passwordHash).toEqual(expect.any(String));
      expect(result.passwordHash).not.toBe("replacement-password-2026");
      expect(mockUsersService.invalidateSessions).toHaveBeenCalledWith(
        "student-1",
      );
    });

    it("does not reset a password for a platform role", async () => {
      mockUsersService.findById.mockResolvedValue({
        id: "developer-1",
        organizationId: "uni-1",
        role: UserRole.DEVELOPER,
      });

      await expect(
        service.resetUniversityUserPassword(
          "uni-1",
          "developer-1",
          { password: "replacement-password-2026" },
          UserRole.UNIVERSITY_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getUniversityUsers", () => {
    it("hides platform roles from university administrators", async () => {
      const pagination = { page: 1, limit: 20 } as any;

      await service.getUniversityUsers(
        "uni-1",
        pagination,
        UserRole.UNIVERSITY_ADMIN,
      );

      expect(mockUsersService.findByOrganizationId).toHaveBeenCalledWith(
        "uni-1",
        pagination,
        expect.not.arrayContaining([UserRole.DEVELOPER, UserRole.SUPERADMIN]),
      );
    });
  });

  describe("getUniversity", () => {
    it("should return university", async () => {
      const result = await service.getUniversity("uni-1");
      expect(result.id).toBe("uni-1");
    });

    it("does not allow tenant updates to change university lifecycle status", async () => {
      mockUniversityRepository.findOne.mockResolvedValue({ id: "uni-1", name: "Test Uni", status: "pending" });

      await service.updateUniversity("uni-1", { name: "Updated" , status: "active" } as any);

      expect(mockUniversityRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        name: "Updated",
        status: "pending",
      }));
    });
  });

  describe("getUniversityStats", () => {
    it("counts the current university instead of returning a placeholder dashboard", async () => {
      const userRepository = module.get(getRepositoryToken(User));
      const lessonRepository = module.get(getRepositoryToken(Lesson));
      userRepository.count
        .mockResolvedValueOnce(250)
        .mockResolvedValueOnce(211)
        .mockResolvedValueOnce(18)
        .mockResolvedValueOnce(47);
      lessonRepository.count.mockResolvedValueOnce(1_800);

      await expect(service.getUniversityStats("uni-1")).resolves.toEqual({
        totalUsers: 250,
        totalStudents: 211,
        totalTeachers: 18,
        totalLessons: 1_800,
        activeToday: 47,
      });
      expect(userRepository.count).toHaveBeenCalledWith({
        where: { organizationId: "uni-1" },
      });
      expect(lessonRepository.count).toHaveBeenCalledWith({
        where: { organizationId: "uni-1" },
      });
    });
  });

  describe("attendance group access", () => {
    it("does not expose students from a group without the teacher's lessons", async () => {
      mockScheduleService.getTeacherGroupIds.mockResolvedValue(["group-1"]);

      await expect(
        service.getGroupStudents(
          "uni-1",
          "group-2",
          { page: 1, limit: 50 } as any,
          "teacher-1",
          UserRole.TEACHER,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUsersService.findByGroupId).not.toHaveBeenCalled();
    });

    it("returns only the teacher's own lesson groups for attendance", async () => {
      mockScheduleService.getTeacherGroupIds.mockResolvedValue(["group-1"]);
      const groupRepository = module.get(getRepositoryToken(Group));
      groupRepository.findAndCount.mockResolvedValue([
        [{ id: "group-1", name: "ПИ-21" }],
        1,
      ]);

      const result = await service.getAttendanceGroups(
        "uni-1",
        "teacher-1",
        UserRole.TEACHER,
        { page: 1, limit: 50 } as any,
      );

      expect(result.data).toEqual([{ id: "group-1", name: "ПИ-21" }]);
      expect(groupRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "uni-1", id: expect.anything() },
        }),
      );
    });
  });

  describe('importSchedule', () => {
    it('always delegates to the durable import service', async () => {
      const input = { fileName: 'schedule.csv', format: 'csv', rows: [{ date: '2026-10-22', startTime: '09:00', endTime: '10:00', pairNumber: 1, subject: 'Math', group: 'G' }] };
      expect(await service.importSchedule('uni-1', input)).toEqual({ status: 'queued', jobId: 'job-1' });
      expect(mockScheduleImports.submit).toHaveBeenCalledWith('uni-1', input);
    });
  });

  describe("syncSchedule", () => {
    it("imports source groups and lessons, and links students with the source group id", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      const userRepository = module.get(getRepositoryToken(User));
      const lessonRepository = module.get(getRepositoryToken(Lesson));
      configureSibitTransaction();
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "rasp-sano",
        connectorConfig: {},
      });
      userRepository.find.mockResolvedValue([
        { id: "student-1", role: UserRole.STUDENT, groupId: "12136" },
        {
          id: "teacher-1",
          role: UserRole.TEACHER,
          firstName: "Иван",
          lastName: "Иванов",
        },
      ]);
      mockSibitConnectorService.sync.mockResolvedValue({
        groups: 1,
        lessons: 1,
        teachers: 1,
        catalog: {
          academicYear: "2026-2027",
          groups: [
            {
              groupId: "12136",
              name: "ГМУ-25",
              faculty: "ДОО",
              facultyId: 24,
              course: 2,
              academicYear: "2026-2027",
            },
          ],
          lessons: [
            {
              lessonId: "5632268",
              groupId: "12136",
              groupName: "ГМУ-25",
              date: "2026-09-17",
              dayOfWeek: 4,
              startTime: "10:10",
              endTime: "11:40",
              pairNumber: 2,
              subject: "Тестовый предмет",
              teacher: "Иванов И.И.",
              weekType: "odd",
              academicYear: "2026-2027",
              isReplacement: false,
            },
          ],
        },
      });
      const result = await service.syncSchedule("uni-1");

      expect(mockSibitConnectorService.sync).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        status: "synced",
        groups: 1,
        lessons: 1,
        teachers: 1,
        imported: 1,
        updated: 0,
        studentsLinked: 1,
      });
      expect(sibitFacultyRepository.save).toHaveBeenCalled();
      expect(sibitGroupRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ externalId: "12136", name: "ГМУ-25" }),
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "student-1", groupId: "1" }),
      );
      expect(lessonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: "5632268",
          source: "sibit",
          teacherId: "teacher-1",
        }),
      );
      expect(typeof result.timestamp).toBe("string");
      expect(universityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorConfig: expect.objectContaining({
            status: "active",
            lastSync: result.timestamp,
          }),
        }),
      );
    });

    it("does not route an LMS connector to the schedule synchronizer", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "moodle",
        connectorConfig: { status: "active" },
      });
      mockSibitConnectorService.sync.mockClear();

      await expect(service.syncSchedule("uni-1")).rejects.toThrow(
        "не настроен источник расписания",
      );
      expect(mockSibitConnectorService.sync).not.toHaveBeenCalled();
    });

    it("does not rewrite an unchanged SIBIT lesson on a repeated sync", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      const userRepository = module.get(getRepositoryToken(User));
      const lessonRepository = module.get(getRepositoryToken(Lesson));
      configureSibitTransaction({
        faculties: [{ id: "faculty-1", organizationId: "uni-1", name: "ДОО", code: "sibit-24", archivedAt: null }],
        groups: [{ id: "group-1", organizationId: "uni-1", facultyId: "faculty-1", name: "ГМУ-25", externalId: "12136", archivedAt: null }],
      });
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "rasp-sano",
        connectorConfig: {},
      });
      userRepository.find.mockResolvedValue([]);
      lessonRepository.find.mockResolvedValue([
        {
          id: "lesson-1",
          organizationId: "uni-1",
          groupId: "group-1",
          teacherId: undefined,
          sourceTeacherId: null,
          subject: "Тестовый предмет",
          subjectType: undefined,
          room: undefined,
          dayOfWeek: 4,
          startTime: "10:10",
          endTime: "11:40",
          pairNumber: 2,
          weekType: "odd",
          startDate: new Date("2026-09-17T10:10:00"),
          endDate: new Date("2026-09-17T11:40:00"),
          teacherName: "Иванов И.И.",
          groupName: "ГМУ-25",
          subgroup: undefined,
          faculty: "ДОО",
          notes: undefined,
          isChanged: false,
          changeDescription: undefined,
          source: "sibit",
          externalId: "5632268",
        },
      ]);
      mockSibitConnectorService.sync.mockResolvedValue({
        groups: 1,
        lessons: 1,
        teachers: 1,
        catalog: {
          academicYear: "2026-2027",
          groups: [
            {
              groupId: "12136",
              name: "ГМУ-25",
              faculty: "ДОО",
              facultyId: 24,
              course: 2,
              academicYear: "2026-2027",
            },
          ],
          lessons: [
            {
              lessonId: "5632268",
              groupId: "12136",
              groupName: "ГМУ-25",
              date: "2026-09-17",
              dayOfWeek: 4,
              startTime: "10:10",
              endTime: "11:40",
              pairNumber: 2,
              subject: "Тестовый предмет",
              teacher: "Иванов И.И.",
              weekType: "odd",
              academicYear: "2026-2027",
              isReplacement: false,
            },
          ],
        },
      });

      await expect(service.syncSchedule("uni-1")).resolves.toMatchObject({
        imported: 0,
        updated: 0,
        studentsLinked: 0,
      });
      expect(lessonRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();

      lessonRepository.find.mockResolvedValue([
        {
          id: "lesson-1",
          organizationId: "uni-1",
          groupId: "group-1",
          source: "sibit",
          externalId: "5632268",
          room: "201",
          startDate: new Date("2026-09-17T10:10:00"),
          endDate: new Date("2026-09-17T11:40:00"),
        },
      ]);

      await expect(service.syncSchedule("uni-1")).resolves.toMatchObject({
        updated: 1,
      });
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "room.changed",
          target: { type: "lesson", id: "lesson-1" },
          payload: expect.objectContaining({ groupId: "group-1" }),
        }),
      );
    });

    it("does not create active duplicates or link students and lessons for archived source structure", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      const userRepository = module.get(getRepositoryToken(User));
      const lessonRepository = module.get(getRepositoryToken(Lesson));
      const archivedFaculty = { id: "faculty-archived", organizationId: "uni-1", name: "ДОО", code: "sibit-24", archivedAt: new Date() };
      const archivedGroup = { id: "group-archived", organizationId: "uni-1", facultyId: archivedFaculty.id, name: "ГМУ-25", externalId: "12136", archivedAt: new Date() };
      const { groupQueryBuilder } = configureSibitTransaction({ faculties: [archivedFaculty], groups: [archivedGroup] });
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1", name: "СИБИТ", connectorType: "rasp-sano", connectorConfig: {},
      });
      userRepository.find.mockResolvedValue([
        { id: "student-1", role: UserRole.STUDENT, groupId: "12136" },
      ]);
      mockSibitConnectorService.sync.mockResolvedValue({
        groups: 1,
        lessons: 1,
        teachers: 0,
        catalog: {
          academicYear: "2026-2027",
          groups: [{ groupId: "12136", name: "ГМУ-25", faculty: "ДОО", facultyId: 24, course: 2, academicYear: "2026-2027" }],
          lessons: [{ lessonId: "5632268", groupId: "12136", groupName: "ГМУ-25", date: "2026-09-17", dayOfWeek: 4, startTime: "10:10", endTime: "11:40", pairNumber: 2, subject: "Тестовый предмет", teacher: "Иванов И.И.", weekType: "odd", academicYear: "2026-2027", isReplacement: false }],
        },
      });

      await expect(service.syncSchedule("uni-1")).resolves.toMatchObject({
        imported: 0, updated: 0, studentsLinked: 0,
      });
      expect(groupQueryBuilder.getOne).toHaveBeenCalledTimes(1);
      expect(sibitGroupRepository.save).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(lessonRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("connectors", () => {
    it("identifies Moodle as an LMS connector without offering schedule sync", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "moodle",
        connectorConfig: { status: "inactive" },
      });

      const result = await service.getConnectors("uni-1", {
        page: 1,
        limit: 20,
      } as any);

      expect(result.data).toEqual([
        expect.objectContaining({
          id: "moodle",
          name: "Moodle",
          type: "lms",
          capabilities: { learningManagement: true },
        }),
      ]);
      expect(result.data[0].capabilities.scheduleSync).toBeUndefined();
    });

    it("persists a connector status inside the current university configuration", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "rasp-sano",
        connectorConfig: { status: "active" },
      });

      const result = await service.updateConnector("uni-1", "sibit", {
        status: "inactive",
      });

      expect(result.status).toBe("inactive");
      expect(universityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorConfig: expect.objectContaining({
            status: "inactive",
            updatedAt: expect.any(String),
          }),
        }),
      );
    });

    it("stores only the encrypted Moodle connection fields and never returns the token", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "moodle",
        connectorConfig: { status: "inactive" },
      });
      mockMoodleConnectorService.configure.mockReturnValue({
        baseUrl: "https://moodle.sibit.ru/",
        encryptedToken: "ciphertext",
        tokenIv: "iv",
        tokenTag: "tag",
      });

      await expect(
        service.configureMoodleConnector("uni-1", {
          baseUrl: "https://moodle.sibit.ru/",
          token: "plain-secret-token",
        }),
      ).resolves.toMatchObject({
        baseUrl: "https://moodle.sibit.ru/",
        tokenConfigured: true,
      });
      expect(universityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorConfig: expect.objectContaining({
            encryptedToken: "ciphertext",
            tokenIv: "iv",
            tokenTag: "tag",
          }),
        }),
      );
      expect(
        JSON.stringify(universityRepository.save.mock.calls),
      ).not.toContain("plain-secret-token");
    });

    it("marks a saved Moodle connector active after a successful REST check", async () => {
      const universityRepository = module.get(getRepositoryToken(University));
      universityRepository.findOne.mockResolvedValue({
        id: "uni-1",
        name: "СИБИТ",
        connectorType: "moodle",
        connectorConfig: {
          baseUrl: "https://moodle.sibit.ru/",
          encryptedToken: "ciphertext",
          tokenIv: "iv",
          tokenTag: "tag",
        },
      });
      mockMoodleConnectorService.testConnection.mockResolvedValue({
        siteName: "СИБИТ Moodle",
        userName: "api-user",
        release: "4.5",
      });

      await expect(service.testMoodleConnector("uni-1")).resolves.toMatchObject(
        {
          status: "active",
          siteName: "СИБИТ Moodle",
        },
      );
      expect(mockMoodleConnectorService.testConnection).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: "https://moodle.sibit.ru/" }),
      );
    });
  });
});
