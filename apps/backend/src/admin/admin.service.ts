import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, In, MoreThanOrEqual, Repository } from "typeorm";
import * as bcrypt from "bcrypt";

import { UsersService } from "../users/users.service";
import { ScheduleImportService } from '../schedule/connectors/schedule-import.service';
import { CurationService } from "../curation/curation.service";
import { ScheduleService } from "../schedule/schedule.service";
import { SibitConnectorService } from "../schedule/connectors/sibit-connector.service";
import { RaspCatalog, RaspScraperService, SIBIT_UNIVERSITY } from "../auth/rasp-scraper.service";
import { University } from "../users/entities/university.entity";
import { Faculty } from "../users/entities/faculty.entity";
import { Group } from "../users/entities/group.entity";
import { Room } from "../users/entities/room.entity";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import {
  ImportScheduleDto,
} from "./dto/import-schedule.dto";
import { UserRole } from "../auth/interfaces/user-role";
import { TenantContext } from "../common/tenant/tenant-context";
import { User } from "../users/entities/user.entity";
import { Lesson } from "../schedule/entities/lesson.entity";
import { CreateFacultyDto } from "./dto/create-faculty.dto";
import { UpdateFacultyDto } from "./dto/update-faculty.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { UpdateUniversityDto } from "./dto/update-university.dto";
import { AuditLog } from "../common/entities/audit-log.entity";
import { JsonObject } from "../common/types/json-value.type";
import { EventBusService } from "../events/event-bus.service";
import {
  MoodleConnectionConfig,
  MoodleConnectorService,
} from "../moodle/moodle-connector.service";
import { ConfigureMoodleConnectorDto } from "./dto/configure-moodle-connector.dto";
import { ConnectorResponseDto } from "./dto/connector-response.dto";
import { UpdateConnectorDto } from "./dto/update-connector.dto";
import { CreateUniversityUserDto } from "./dto/create-university-user.dto";
import { UpdateUniversityUserStatusDto } from "./dto/update-university-user-status.dto";
import { ResetUniversityUserPasswordDto } from "./dto/reset-university-user-password.dto";
import { UpdateUniversityUserUsernameDto } from "./dto/update-university-user-username.dto";
import { normalizeUsername } from "../auth/username";
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from "../common/dto/pagination-query.dto";
import { UpdateScheduleConnectorDto } from './dto/update-schedule-connector.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

export interface UniversityStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalLessons: number;
  activeToday: number;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.EMPLOYER]: 0,
  [UserRole.CAREER_STAFF]: 2,
  [UserRole.CAREER_ADMIN]: 3,
  [UserRole.DEVELOPER]: 7,
  [UserRole.STUDENT]: 1,
  [UserRole.TEACHER]: 2,
  [UserRole.CURATOR]: 3,
  [UserRole.DEPARTMENT_HEAD]: 4,
  [UserRole.FACULTY_DEAN]: 5,
  [UserRole.UNIVERSITY_ADMIN]: 6,
  [UserRole.SUPERADMIN]: 8,
};

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly scheduleService: ScheduleService,
    private readonly sibitConnectorService: SibitConnectorService,
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly tenantContext: TenantContext,
    private readonly moodleConnectorService: MoodleConnectorService,
    private readonly raspScraperService: RaspScraperService,
    private readonly scheduleImports: ScheduleImportService,
    @Optional() private readonly eventBus?: EventBusService,
    @Optional() private readonly curation?: CurationService,
  ) {}

  async getUniversityUsers(
    organizationId: string,
    pagination: PaginationQueryDto,
    requesterRole: UserRole,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(organizationId);
    return this.usersService.findByOrganizationId(
      organizationId,
      pagination,
      this.getVisibleUserRoles(requesterRole),
    );
  }

  async getSibitTeachers(organizationId: string) {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.universityRepository.findOne({ where: { id: organizationId } });
    if (!university || !await this.isRaspScheduleEnabled(university)) {
      throw new BadRequestException("Каталог преподавателей СИБИТ недоступен для этого университета");
    }
    const teachers = await this.sibitConnectorService.getTeachers(
      readScheduleConnectorSettings(university).config.academicYear,
    );
    const linkedUsers = await this.userRepository.find({
      where: { organizationId, role: UserRole.TEACHER },
      select: ["id", "firstName", "lastName", "sourceTeacherId"],
    });
    const links = new Map(linkedUsers.filter((user) => user.sourceTeacherId).map((user) => [user.sourceTeacherId!, user]));
    return teachers.map((teacher) => ({
      ...teacher,
      linkedUser: links.has(teacher.id) ? {
        id: links.get(teacher.id)!.id,
        name: `${links.get(teacher.id)!.lastName} ${links.get(teacher.id)!.firstName}`,
      } : null,
    }));
  }

  async getGroupStudents(
    organizationId: string,
    groupId: string,
    pagination: PaginationQueryDto,
    requesterId?: string,
    requesterRole?: UserRole,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(organizationId);
    if (requesterRole === UserRole.CURATOR && this.curation) {
      await this.curation.assertGroup(groupId);
    }
    if (requesterRole === UserRole.TEACHER && requesterId) {
      const groupIds = await this.scheduleService.getTeacherGroupIds(
        organizationId,
        requesterId,
      );
      if (!groupIds.includes(groupId)) {
        throw new ForbiddenException(
          "Teachers can only view students from their own lesson groups",
        );
      }
    }
    return this.usersService.findByGroupId(groupId, organizationId, pagination);
  }

  async updateUserRole(
    organizationId: string,
    userId: string,
    updateUserRoleDto: UpdateUserRoleDto,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<User> {
    if (updateUserRoleDto.role === UserRole.CURATOR) throw new BadRequestException('Кураторство назначается существующему аккаунту через раздел «Кураторство», без изменения основной роли.');
    const user = await this.usersService.findById(userId);
    if (!user || user.organizationId !== organizationId) {
      throw new ForbiddenException("User not found in this university");
    }
    if (
      userId === requesterId ||
      !this.canManageRole(requesterRole, user.role) ||
      !this.canAssignRole(requesterRole, user.role, updateUserRoleDto.role)
    ) {
      throw new ForbiddenException("Недостаточно прав для изменения роли этой учётной записи");
    }

    const updatedUser = await this.usersService.update(userId, {
      role: updateUserRoleDto.role,
    });
    await this.usersService.invalidateSessions(userId, { afterAuthorizedRoleChange: true });
    return updatedUser;
  }

  async updateUniversityUserUsername(
    organizationId: string,
    userId: string,
    dto: UpdateUniversityUserUsernameDto,
    requesterRole: UserRole,
  ): Promise<User> {
    this.tenantContext.assertAccess(organizationId);
    const user = await this.usersService.findById(userId);
    if (!user || user.organizationId !== organizationId) {
      throw new ForbiddenException("User not found in this university");
    }
    if (!this.canManageRole(requesterRole, user.role)) {
      throw new ForbiddenException("Insufficient permissions to update this account");
    }
    const username = normalizeUsername(dto.username);
    const duplicate = await this.usersService.findByUsername(username);
    if (duplicate && duplicate.id !== user.id) {
      throw new ConflictException("Этот логин уже используется.");
    }
    try {
      const updated = await this.usersService.update(user.id, { username });
      await this.usersService.invalidateSessions(user.id);
      return updated;
    } catch (error) {
      const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code ?? (error as { code?: string }).code;
      if (code === "23505") throw new ConflictException("Этот логин уже используется.");
      throw error;
    }
  }

  async createUniversityUser(
    organizationId: string,
    data: CreateUniversityUserDto,
    requesterRole: UserRole,
  ): Promise<User> {
    this.tenantContext.assertAccess(organizationId);
    if (data.role === UserRole.CURATOR) throw new BadRequestException('Создайте аккаунт студента или сотрудника и назначьте ему кураторские группы.');
    if (!this.canManageRole(requesterRole, data.role))
      throw new ForbiddenException(
        "Insufficient permissions to create this role",
      );
    if (await this.usersService.findByEmail(data.email.trim()))
      throw new ConflictException("Пользователь с такой почтой уже существует");
    const username = normalizeUsername(data.username);
    if (await this.usersService.findByUsername(username)) {
      throw new ConflictException("Этот логин уже используется.");
    }
    if (data.groupId) {
      if (/^\d+$/.test(data.groupId)) {
        if (data.role !== UserRole.STUDENT) {
          throw new BadRequestException("Внешний ID учебной группы назначается аккаунту студента.");
        }
        const university = await this.getUniversity(organizationId);
        if (!await this.isRaspScheduleEnabled(university) || !await this.raspScraperService.isValidGroup(data.groupId, readScheduleConnectorSettings(university).config.academicYear)) {
          throw new BadRequestException("Выберите группу из каталога СИБИТ для этого университета.");
        }
      } else {
        const group = await this.groupRepository.findOne({
          where: { id: data.groupId, organizationId },
        });
        if (!group)
          throw new BadRequestException(
            "Группа не найдена в структуре этого ВУЗа",
          );
      }
    }
    if (data.sourceTeacherId) {
      if (data.role !== UserRole.TEACHER) throw new BadRequestException("Внешний ID преподавателя можно назначить только учётной записи преподавателя.");
      const university = await this.getUniversity(organizationId);
      if (!await this.isRaspScheduleEnabled(university) || !(await this.sibitConnectorService.getTeachers(readScheduleConnectorSettings(university).config.academicYear)).some((teacher) => teacher.id === data.sourceTeacherId)) {
        throw new BadRequestException("Преподаватель не найден в каталоге расписания СИБИТа.");
      }
      const existingLink = await this.userRepository.findOne({ where: { organizationId, sourceTeacherId: data.sourceTeacherId } });
      if (existingLink) throw new ConflictException("Этот преподаватель СИБИТа уже связан с учётной записью.");
    }
    const created = await this.usersService.create({
      username,
      email: data.email.trim(),
      passwordHash: await bcrypt.hash(data.password, 12),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      role: data.role,
      groupId: data.groupId,
      sourceTeacherId: data.sourceTeacherId || null,
      organizationId,
    });
    if (data.sourceTeacherId) {
      await this.syncSchedule(organizationId);
    }
    return created;
  }

  async linkSibitTeacher(organizationId: string, userId: string, sourceTeacherId: string | null) {
    this.tenantContext.assertAccess(organizationId);
    const user = await this.userRepository.findOne({ where: { id: userId, organizationId } });
    if (!user || user.role !== UserRole.TEACHER) throw new NotFoundException("Учётная запись преподавателя не найдена.");
    if (sourceTeacherId) {
      const university = await this.getUniversity(organizationId);
      if (!await this.isRaspScheduleEnabled(university) || !(await this.sibitConnectorService.getTeachers(readScheduleConnectorSettings(university).config.academicYear)).some((teacher) => teacher.id === sourceTeacherId)) {
        throw new BadRequestException("Преподаватель не найден в каталоге расписания СИБИТа.");
      }
      const existingLink = await this.userRepository.findOne({ where: { organizationId, sourceTeacherId } });
      if (existingLink && existingLink.id !== userId) throw new ConflictException("Этот преподаватель СИБИТа уже связан с другой учётной записью.");
    }
    user.sourceTeacherId = sourceTeacherId;
    await this.userRepository.save(user);
    if (sourceTeacherId) {
      await this.syncSchedule(organizationId);
    } else {
      await this.lessonRepository.update(
        { organizationId, source: "sibit", teacherId: userId },
        { teacherId: null },
      );
    }
    return user;
  }

  async updateUniversityUserStatus(
    organizationId: string,
    userId: string,
    data: UpdateUniversityUserStatusDto,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<User> {
    if (userId === requesterId)
      throw new BadRequestException(
        "Нельзя изменить статус собственной учётной записи",
      );
    const user = await this.usersService.findById(userId);
    if (!user || user.organizationId !== organizationId)
      throw new ForbiddenException("User not found in this university");
    if (!this.canManageRole(requesterRole, user.role))
      throw new ForbiddenException(
        "Insufficient permissions to change this user",
      );
    const updatedUser = await this.usersService.update(userId, {
      isActive: data.isActive,
    });
    await this.usersService.invalidateSessions(userId);
    return updatedUser;
  }

  async resetUniversityUserPassword(
    organizationId: string,
    userId: string,
    data: ResetUniversityUserPasswordDto,
    requesterRole: UserRole,
  ): Promise<User> {
    this.tenantContext.assertAccess(organizationId);
    const user = await this.usersService.findById(userId);
    if (!user || user.organizationId !== organizationId) {
      throw new ForbiddenException("User not found in this university");
    }
    if (!this.canManageRole(requesterRole, user.role)) {
      throw new ForbiddenException(
        "Insufficient permissions to reset this user password",
      );
    }
    const updatedUser = await this.usersService.update(userId, {
      passwordHash: await bcrypt.hash(data.password, 12),
    });
    await this.usersService.invalidateSessions(userId);
    return updatedUser;
  }

  importSchedule(organizationId: string, importScheduleDto: ImportScheduleDto) {
    return this.scheduleImports.submit(organizationId, importScheduleDto);
  }

  async getScheduleConnector(organizationId: string) {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.getUniversity(organizationId);
    return { ...scheduleConnectorResponse(university), raspSanoAvailable: await this.isUniqueActiveSibit(university) };
  }

  async updateScheduleConnector(organizationId: string, dto: UpdateScheduleConnectorDto) {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.getUniversity(organizationId);
    const config = { ...(dto.config ?? {}) };
    if (dto.provider === 'file-only' && dto.enabled) {
      throw new BadRequestException('Для файлового источника синхронизация отключена. Загружайте файл через импорт расписания.');
    }
    if (dto.provider === 'rasp-sano') await this.assertUniqueActiveSibit(university);
    if (dto.provider === 'rasp-sano' && dto.enabled) university.connectorType = 'rasp-sano';
    university.connectorConfig = {
      ...(university.connectorConfig ?? {}),
      scheduleConnector: { provider: dto.provider, enabled: dto.enabled, config },
      updatedAt: new Date().toISOString(),
    };
    await this.universityRepository.save(university);
    return { ...scheduleConnectorResponse(university), raspSanoAvailable: await this.isUniqueActiveSibit(university) };
  }

  async testScheduleConnector(organizationId: string) {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.getUniversity(organizationId);
    await this.assertUniqueActiveSibit(university);
    if (!await this.isRaspScheduleEnabled(university)) {
      throw new BadRequestException('Сначала включите источник расписания rasp.sano.ru в настройках университета.');
    }
    const config = readScheduleConnectorSettings(university).config;
    const availableYears = await this.raspScraperService.getYears();
    if (config.academicYear && !availableYears.some((year) => year.value === config.academicYear)) {
      throw new BadRequestException('Выбранный учебный год отсутствует в каталоге rasp.sano.ru.');
    }
    const groups = await this.raspScraperService.getGroups(config.academicYear);
    return {
      status: 'connected' as const,
      provider: 'rasp-sano' as const,
      sourceHost: 'rasp.sano.ru' as const,
      academicYear: config.academicYear ?? availableYears.at(-1)?.value ?? null,
      academicYearsAvailable: availableYears.length,
      groupsAvailable: groups.length,
      checkedAt: new Date().toISOString(),
    };
  }

  async getRooms(organizationId: string, pagination: PaginationQueryDto) {
    this.tenantContext.assertAccess(organizationId);
    const [rooms, total] = await this.roomRepository.findAndCount({
      where: { organizationId },
      order: { archivedAt: 'ASC', name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(rooms.map((room) => ({ ...room, isArchived: !!room.archivedAt })), total, pagination);
  }

  async createRoom(organizationId: string, actorId: string, dto: CreateRoomDto) {
    this.tenantContext.assertAccess(organizationId);
    const room = this.roomRepository.create({
      organizationId,
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      building: dto.building?.trim() || null,
      floor: dto.floor?.trim() || null,
      capacity: dto.capacity ?? null,
      archivedAt: null,
      archiveReason: null,
    });
    try {
      const saved = await this.roomRepository.save(room);
      await this.auditRoom(actorId, 'room.created', saved.id, null, roomAuditValues(saved));
      return { ...saved, isArchived: false };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Аудитория с таким названием или кодом уже существует в этом университете.');
      throw error;
    }
  }

  async updateRoom(organizationId: string, actorId: string, roomId: string, dto: UpdateRoomDto) {
    this.tenantContext.assertAccess(organizationId);
    const room = await this.roomRepository.findOne({ where: { id: roomId, organizationId } });
    if (!room) throw new NotFoundException('Аудитория не найдена в этом университете.');
    const oldValues = roomAuditValues(room);
    const stateChanged = dto.isArchived !== undefined && dto.isArchived !== !!room.archivedAt;
    if (stateChanged && !dto.reason?.trim()) {
      throw new BadRequestException('Укажите причину архивирования или восстановления аудитории.');
    }
    if (dto.name !== undefined) room.name = dto.name.trim();
    if (dto.code !== undefined) room.code = dto.code.trim() || null;
    if (dto.building !== undefined) room.building = dto.building.trim() || null;
    if (dto.floor !== undefined) room.floor = dto.floor.trim() || null;
    if (dto.capacity !== undefined) room.capacity = dto.capacity;
    if (stateChanged) {
      room.archivedAt = dto.isArchived ? new Date() : null;
      room.archiveReason = dto.isArchived ? dto.reason!.trim() : null;
    }
    try {
      const saved = await this.roomRepository.save(room);
      await this.auditRoom(actorId, stateChanged ? (dto.isArchived ? 'room.archived' : 'room.restored') : 'room.updated', room.id, oldValues, { ...roomAuditValues(saved), ...(stateChanged ? { reason: dto.reason!.trim() } : {}) });
      return { ...saved, isArchived: !!saved.archivedAt };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Аудитория с таким названием или кодом уже существует в этом университете.');
      throw error;
    }
  }

  private async auditRoom(actorId: string, action: string, roomId: string, oldValues: JsonObject | null, newValues: JsonObject) {
    await this.auditLogRepository.save(this.auditLogRepository.create({
      userId: actorId,
      action,
      entity: 'room',
      entityId: roomId,
      oldValues,
      newValues,
      ip: undefined,
      userAgent: undefined,
    } as DeepPartial<AuditLog>));
  }

  private async isUniqueActiveSibit(university: University): Promise<boolean> {
    if (university.name !== SIBIT_UNIVERSITY.name || university.city !== SIBIT_UNIVERSITY.city || university.status !== 'active') return false;
    const matches = await this.tenantContext.runWithDatabaseAccess(
      { tables: ['universities'], organizationIds: null, replaceActor: true },
      () => this.universityRepository.find({
        where: { name: SIBIT_UNIVERSITY.name, city: SIBIT_UNIVERSITY.city, status: 'active' },
        select: { id: true, name: true, city: true, status: true },
      }),
    );
    return matches.length === 1 && matches[0].id === university.id;
  }

  private async assertUniqueActiveSibit(university: University): Promise<void> {
    if (university.name !== SIBIT_UNIVERSITY.name || university.city !== SIBIT_UNIVERSITY.city || university.status !== 'active') {
      throw new BadRequestException('Источник rasp.sano.ru поддерживает только активный вуз СИБИТ (Омск). Для другого вуза загрузите файл расписания.');
    }
    const matches = await this.tenantContext.runWithDatabaseAccess(
      { tables: ['universities'], organizationIds: null, replaceActor: true },
      () => this.universityRepository.find({
        where: { name: SIBIT_UNIVERSITY.name, city: SIBIT_UNIVERSITY.city, status: 'active' },
        select: { id: true, name: true, city: true, status: true },
      }),
    );
    if (matches.length > 1) throw new ConflictException('Источник rasp.sano.ru отключён: найдено несколько вузов СИБИТ с одинаковым городом. Сначала разберите дубликаты.');
    if (matches.length !== 1 || matches[0].id !== university.id) {
      throw new BadRequestException('Нельзя подключить rasp.sano.ru: для этого вуза нет единственного подтверждённого каталога СИБИТ.');
    }
  }

  private async isRaspScheduleEnabled(university: University): Promise<boolean> {
    const settings = readScheduleConnectorSettings(university);
    return settings.provider === 'rasp-sano' && settings.enabled && await this.isUniqueActiveSibit(university);
  }

  async syncSchedule(organizationId: string): Promise<{
    status: string;
    timestamp: string;
    groups: number;
    lessons: number;
    teachers: number;
    imported: number;
    updated: number;
    studentsLinked: number;
  }> {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.getUniversity(organizationId);
    if (!await this.isRaspScheduleEnabled(university)) {
      throw new BadRequestException(
        "Для этого ВУЗа не настроен источник расписания с поддержкой синхронизации.",
      );
    }
    const settings = readScheduleConnectorSettings(university);
    const { catalog, ...summary } = await this.sibitConnectorService.sync(settings.config.academicYear);
    const persisted = await this.persistSibitCatalog(organizationId, catalog);
    const timestamp = new Date().toISOString();
    university.connectorConfig = {
      ...(university.connectorConfig || {}),
      status: "active",
      lastSync: timestamp,
      updatedAt: timestamp,
      lastSyncSummary: { ...summary, ...persisted },
    };
    await this.universityRepository.save(university);
    return {
      status: "synced",
      timestamp,
      groups: summary.groups,
      lessons: summary.lessons,
      teachers: summary.teachers,
      ...persisted,
    };
  }

  /**
   * Imports only records owned by the SIBIT connector. Existing manual groups
   * and lessons are retained; source records are updated by their stable
   * external ids, so running the sync twice is safe.
   */
  private async persistSibitCatalog(
    organizationId: string,
    catalog: RaspCatalog,
  ): Promise<{ imported: number; updated: number; studentsLinked: number }> {
    const [users, existingLessons] =
      await Promise.all([
        this.userRepository.find({ where: { organizationId } }),
        this.lessonRepository.find({
          where: { organizationId, source: "sibit" },
        }),
      ]);

    const groupsBySourceId = new Map<string, Group>();
    const blockedSourceGroupIds = new Set<string>();

    for (const sourceGroup of catalog.groups) {
      const sourceFacultyName = sourceGroup.faculty || "Не указан";
      const result = await this.groupRepository.manager.transaction(async manager => {
        const faculties = manager.getRepository(Faculty);
        const groups = manager.getRepository(Group);
        const sameNameFaculties = await faculties.createQueryBuilder('f')
          .where('f."organizationId" = :organizationId AND (LOWER(f.name) = LOWER(:name) OR f.code = :sourceCode)', { organizationId, name: sourceFacultyName, sourceCode: `sibit-${sourceGroup.facultyId}` })
          .setLock('pessimistic_read').getMany();
        let faculty = sameNameFaculties.find(row => row.code === `sibit-${sourceGroup.facultyId}`)
          ?? sameNameFaculties.find(row => !row.archivedAt)
          ?? sameNameFaculties[0];
        const archivedFaculty = !!faculty?.archivedAt;
        if (!faculty) {
          faculty = await faculties.save(faculties.create({ organizationId, name: sourceFacultyName, code: `sibit-${sourceGroup.facultyId}` }));
        }
        const group = await groups.createQueryBuilder('g')
          .where('g."organizationId" = :organizationId AND (g."externalId" = :externalId OR LOWER(g.name) = LOWER(:name))', { organizationId, externalId: sourceGroup.groupId, name: sourceGroup.name })
          .orderBy('CASE WHEN g."externalId" = :externalId THEN 0 ELSE 1 END', 'ASC')
          .setLock('pessimistic_write').getOne();
        if (archivedFaculty || group?.archivedAt) {
          // Preserve source-ID resolution for an archived row, but do not
          // create, move, rename, or reactivate anything under an archive.
          return { group, blocked: true };
        }
        if (group) {
          const changed = group.externalId !== sourceGroup.groupId || group.facultyId !== faculty.id || group.name !== sourceGroup.name;
          if (changed) {
            Object.assign(group, { externalId: sourceGroup.groupId, facultyId: faculty.id, name: sourceGroup.name });
            await groups.save(group);
          }
          return { group, blocked: false };
        }
        const created = await groups.save(groups.create({
          organizationId, facultyId: faculty.id, name: sourceGroup.name,
          externalId: sourceGroup.groupId,
          curriculumYear: academicStartYear(sourceGroup.academicYear),
        }));
        return { group: created, blocked: false };
      });
      let group = result.group;
      if (!group) continue;
      if (result.blocked) blockedSourceGroupIds.add(sourceGroup.groupId);
      groupsBySourceId.set(sourceGroup.groupId, group);
    }

    let studentsLinked = 0;
    for (const user of users) {
      if (user.role !== UserRole.STUDENT || !user.groupId) continue;
      const group = groupsBySourceId.get(user.groupId);
      if (group && !group.archivedAt && !blockedSourceGroupIds.has(user.groupId) && user.groupId !== group.id) {
        user.groupId = group.id;
        await this.userRepository.save(user);
        studentsLinked++;
      }
    }

    const teachers = users.filter((user) => user.role === UserRole.TEACHER);
    const lessonBySourceKey = new Map(
      existingLessons.map((lesson) => [
        sibitLessonKey(lesson.externalId, lesson.groupId),
        lesson,
      ]),
    );
    let imported = 0;
    let updated = 0;
    const syncedAt = new Date();

    for (const sourceLesson of catalog.lessons) {
      const group = groupsBySourceId.get(sourceLesson.groupId);
      if (!group || group.archivedAt || blockedSourceGroupIds.has(sourceLesson.groupId)) continue;
      const key = sibitLessonKey(sourceLesson.lessonId, group.id);
      const existing = lessonBySourceKey.get(key);
      const source = {
        organizationId,
        groupId: group.id,
        teacherId: resolveTeacherId(sourceLesson.teacher, sourceLesson.teacherId, teachers),
        sourceTeacherId: sourceLesson.teacherId ?? null,
        subject: sourceLesson.subject,
        subjectType: sourceLesson.subjectType ?? undefined,
        room: sourceLesson.room ?? undefined,
        building: undefined,
        dayOfWeek: sourceLesson.dayOfWeek,
        startTime: sourceLesson.startTime,
        endTime: sourceLesson.endTime,
        pairNumber: sourceLesson.pairNumber,
        weekType: sourceLesson.weekType,
        startDate: new Date(
          `${sourceLesson.date}T${sourceLesson.startTime}:00`,
        ),
        endDate: new Date(`${sourceLesson.date}T${sourceLesson.endTime}:00`),
        teacherName: sourceLesson.teacher ?? undefined,
        groupName: sourceLesson.groupName,
        subgroup: sourceLesson.subgroup ?? undefined,
        department: undefined,
        faculty:
          catalog.groups.find((item) => item.groupId === sourceLesson.groupId)
            ?.faculty ?? undefined,
        notes: sourceLesson.isReplacement ? "Замена" : undefined,
        isChanged: sourceLesson.isReplacement,
        changeDescription: sourceLesson.isReplacement
          ? "Замена по источнику rasp.sano.ru"
          : undefined,
        source: "sibit",
        externalId: sourceLesson.lessonId,
        lastSyncedAt: syncedAt,
        sourceVersion: catalog.academicYear,
        syncStatus: "synced",
      };
      if (existing) {
        if (sibitLessonChanged(existing, source)) {
          const eventType = sibitScheduleEventType(existing, source);
          Object.assign(existing, source);
          const saved = await this.lessonRepository.save(existing);
          await this.eventBus?.publish({
            type: eventType,
            organizationId,
            actor: { type: "system" },
            target: { type: "lesson", id: saved.id },
            payload: {
              groupId: saved.groupId,
              ...(saved.teacherId ? { teacherId: saved.teacherId } : {}),
              deepLink: `/week?date=${saved.startDate.toISOString().slice(0, 10)}`,
            },
            priority: eventType === "lesson.changed" ? "normal" : "high",
          });
          updated++;
        }
      } else {
        const lesson = await this.lessonRepository.save(
          this.lessonRepository.create(source),
        );
        lessonBySourceKey.set(key, lesson);
        imported++;
      }
    }

    return { imported, updated, studentsLinked };
  }

  async getUniversityStats(organizationId: string): Promise<UniversityStats> {
    this.tenantContext.assertAccess(organizationId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalLessons,
      activeToday,
    ] = await Promise.all([
      this.userRepository.count({ where: { organizationId } }),
      this.userRepository.count({
        where: { organizationId, role: UserRole.STUDENT },
      }),
      this.userRepository.count({
        where: { organizationId, role: UserRole.TEACHER },
      }),
      this.lessonRepository.count({ where: { organizationId } }),
      this.userRepository.count({
        where: { organizationId, lastLoginAt: MoreThanOrEqual(today) },
      }),
    ]);
    return {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalLessons,
      activeToday,
    };
  }

  async getUniversity(organizationId: string): Promise<University> {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.universityRepository.findOne({
      where: { id: organizationId },
    });

    if (!university) {
      throw new NotFoundException(
        `University with id ${organizationId} not found`,
      );
    }

    return university;
  }

  async updateUniversity(
    organizationId: string,
    updateData: UpdateUniversityDto,
  ): Promise<University> {
    const university = await this.getUniversity(organizationId);
    const requestedSchedule = updateData.connectorConfig?.scheduleConnector;
    const requestsRaspSchedule = requestedSchedule && typeof requestedSchedule === 'object'
      && !Array.isArray(requestedSchedule)
      && (requestedSchedule as Record<string, unknown>).provider === 'rasp-sano'
      && (requestedSchedule as Record<string, unknown>).enabled === true;
    if (updateData.connectorType === 'rasp-sano' || requestsRaspSchedule) await this.assertUniqueActiveSibit(university);
    // Tenant administrators can configure the university and its imports, but
    // lifecycle status is controlled by the platform owner only.
    Object.assign(university, {
      name: updateData.name,
      city: updateData.city,
      connectorType: updateData.connectorType,
      connectorConfig: updateData.connectorConfig,
      importMassChangeThreshold: updateData.importMassChangeThreshold,
      publicScheduleEnabled: updateData.publicScheduleEnabled,
    });
    return this.universityRepository.save(university);
  }

  async getFaculties(
    organizationId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Faculty>> {
    this.tenantContext.assertAccess(organizationId);
    const [data, total] = await this.facultyRepository.findAndCount({
      where: { organizationId },
      order: { name: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createFaculty(
    organizationId: string,
    data: CreateFacultyDto,
  ): Promise<Faculty> {
    this.tenantContext.assertAccess(organizationId);
    if (data.deanUserId) await this.assertFacultyDean(organizationId, data.deanUserId);
    const faculty = this.facultyRepository.create({
      ...data,
      organizationId,
    });
    return this.facultyRepository.save(faculty);
  }

  async updateFaculty(id: string, data: UpdateFacultyDto): Promise<Faculty> {
    const faculty = await this.facultyRepository.findOne({ where: { id } });

    if (!faculty) {
      throw new NotFoundException(`Faculty with id ${id} not found`);
    }
    this.tenantContext.assertAccess(faculty.organizationId);

    if (data.deanUserId !== undefined && data.deanUserId !== null) {
      await this.assertFacultyDean(faculty.organizationId, data.deanUserId);
    }

    Object.assign(faculty, data);
    return this.facultyRepository.save(faculty) as Promise<Faculty>;
  }

  private async assertFacultyDean(organizationId: string, deanUserId: string): Promise<void> {
    const dean = await this.userRepository.findOne({
      where: { id: deanUserId, organizationId, role: UserRole.FACULTY_DEAN, isActive: true },
      select: { id: true },
    });
    if (!dean) {
      throw new BadRequestException(
        "Выбранный декан должен быть активным пользователем с ролью «Декан» в этом университете.",
      );
    }
  }

  async getGroups(
    organizationId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Group>> {
    this.tenantContext.assertAccess(organizationId);
    const [data, total] = await this.groupRepository.findAndCount({
      where: { organizationId },
      order: { name: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async getAttendanceGroups(
    organizationId: string,
    requesterId: string,
    requesterRole: UserRole,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Group>> {
    this.tenantContext.assertAccess(organizationId);
    if (requesterRole === UserRole.CURATOR && this.curation) {
      const result = await this.curation.groups(pagination);
      const ids = result.data.map(group => group.id);
      const data = ids.length ? await this.groupRepository.find({ where: { id: In(ids), organizationId }, order: { name: 'ASC' } }) : [];
      return { ...result, data };
    }
    if (requesterRole !== UserRole.TEACHER)
      return this.getGroups(organizationId, pagination);
    const groupIds = await this.scheduleService.getTeacherGroupIds(
      organizationId,
      requesterId,
    );
    if (!groupIds.length) return toPaginatedResponse([], 0, pagination);
    const [data, total] = await this.groupRepository.findAndCount({
      where: { organizationId, id: In(groupIds) },
      order: { name: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createGroup(
    organizationId: string,
    data: CreateGroupDto,
  ): Promise<Group> {
    this.tenantContext.assertAccess(organizationId);
    if (data.curatorId) throw new BadRequestException('Назначьте кураторов через управление кураторством после создания группы.');
    return this.groupRepository.manager.transaction(async manager => {
      const faculty = await manager.getRepository(Faculty).createQueryBuilder('f')
        .where('f.id = :facultyId AND f."organizationId" = :organizationId AND f."archivedAt" IS NULL', { facultyId: data.facultyId, organizationId })
        .setLock('pessimistic_read').getOne();
      if (!faculty) throw new NotFoundException('Факультет своего университета не найден');
      const group = manager.getRepository(Group).create({
        name: data.name,
        specialization: data.specialization,
        facultyId: faculty.id,
        curatorId: data.curatorId,
        organizationId,
        curriculumYear: Number(data.curriculumYear),
      });
      return manager.getRepository(Group).save(group);
    });
  }

  async updateGroup(id: string, data: UpdateGroupDto): Promise<Group> {
    if (data.curatorId !== undefined) throw new BadRequestException('Используйте управление кураторством для назначения и снятия кураторов.');
    return this.groupRepository.manager.transaction(async manager => {
      const group = await manager.getRepository(Group).createQueryBuilder('g').where('g.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!group) throw new NotFoundException(`Group with id ${id} not found`);
      this.tenantContext.assertAccess(group.organizationId);
      if (group.archivedAt) throw new ConflictException('Восстановите группу перед изменением её данных.');
      const facultyId = data.facultyId ?? group.facultyId;
      const faculty = await manager.getRepository(Faculty).createQueryBuilder('f')
        .where('f.id = :facultyId AND f."organizationId" = :organizationId AND f."archivedAt" IS NULL', { facultyId, organizationId: group.organizationId })
        .setLock('pessimistic_read').getOne();
      if (!faculty) throw new NotFoundException('Факультет своего университета не найден');
      Object.assign(group, data);
      return manager.getRepository(Group).save(group);
    });
  }

  private canManageRole(
    requesterRole: UserRole,
    targetRole: UserRole,
  ): boolean {
    if (targetRole === UserRole.EMPLOYER) return false;
    const requesterLevel = ROLE_HIERARCHY[requesterRole] ?? -1;
    const targetLevel = ROLE_HIERARCHY[targetRole] ?? -1;
    return requesterLevel > targetLevel;
  }

  private canAssignRole(requesterRole: UserRole, currentTargetRole: UserRole, role: UserRole): boolean {
    if (role === UserRole.EMPLOYER) return false;
    const requesterLevel = ROLE_HIERARCHY[requesterRole] ?? -1;
    const targetLevel = ROLE_HIERARCHY[role] ?? -1;
    const promoteDeveloperToSuperadmin = requesterRole === UserRole.SUPERADMIN &&
      currentTargetRole === UserRole.DEVELOPER && role === UserRole.SUPERADMIN;
    return promoteDeveloperToSuperadmin || targetLevel < requesterLevel;
  }

  async getAuditLog(
    organizationId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<AuditLog & { source: string }>> {
    this.tenantContext.assertAccess(organizationId);
    const [data, total] = await this.auditLogRepository
      .createQueryBuilder("auditLog")
      .innerJoin(User, "auditUser", "auditUser.id = auditLog.userId")
      .where("auditUser.organizationId = :organizationId", { organizationId })
      .orderBy("auditLog.createdAt", "DESC")
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();
    return toPaginatedResponse(
      data.map((item) => ({
        ...item,
        source: item.ip ? "user action" : "system",
      })),
      total,
      pagination,
    );
  }

  async getConnectors(
    organizationId: string,
    pagination: PaginationQueryDto,
  ): Promise<
    PaginatedResponse<
      ConnectorResponseDto & {
        updatedAt?: string;
        baseUrl?: string;
        tokenConfigured?: boolean;
      }
    >
  > {
    const university = await this.getUniversity(organizationId);
    if (!university.connectorType)
      return toPaginatedResponse([], 0, pagination);
    const config = university.connectorConfig || {};
    const connector = {
      id: connectorId(university.connectorType),
      name: connectorName(university.connectorType),
      type: connectorKind(university.connectorType),
      status: typeof config.status === "string" ? config.status : "active",
      capabilities: connectorCapabilities(university.connectorType),
      ...(typeof config.updatedAt === "string"
        ? { updatedAt: config.updatedAt }
        : {}),
      ...(university.connectorType === "moodle" &&
      typeof config.baseUrl === "string"
        ? { baseUrl: config.baseUrl }
        : {}),
      ...(university.connectorType === "moodle"
        ? { tokenConfigured: typeof config.encryptedToken === "string" }
        : {}),
    };
    const start = (pagination.page - 1) * pagination.limit;
    return toPaginatedResponse(
      [connector].slice(start, start + pagination.limit),
      1,
      pagination,
    );
  }

  async updateConnector(
    organizationId: string,
    id: string,
    updateData: UpdateConnectorDto,
  ): Promise<ConnectorResponseDto & { updatedAt: string }> {
    const university = await this.getUniversity(organizationId);
    if (
      !university.connectorType ||
      connectorId(university.connectorType) !== id
    )
      throw new NotFoundException(`Connector ${id} not found`);
    const updatedAt = new Date().toISOString();
    university.connectorConfig = {
      ...(university.connectorConfig || {}),
      ...(updateData.config || {}),
      ...(updateData.status ? { status: updateData.status } : {}),
      updatedAt,
    };
    await this.universityRepository.save(university);
    return {
      id,
      name: connectorName(university.connectorType),
      type: connectorKind(university.connectorType),
      status: String(university.connectorConfig.status || "active"),
      capabilities: connectorCapabilities(university.connectorType),
      updatedAt,
    };
  }

  async configureMoodleConnector(
    organizationId: string,
    dto: ConfigureMoodleConnectorDto,
  ): Promise<{ baseUrl: string; tokenConfigured: true; updatedAt: string }> {
    const university = await this.getMoodleUniversity(organizationId);
    const connection = this.moodleConnectorService.configure(
      dto.baseUrl,
      dto.token,
    );
    const updatedAt = new Date().toISOString();
    university.connectorConfig = {
      ...(university.connectorConfig || {}),
      ...connection,
      status: "configured",
      updatedAt,
      lastError: null,
    };
    await this.universityRepository.save(university);
    return { baseUrl: connection.baseUrl, tokenConfigured: true, updatedAt };
  }

  async testMoodleConnector(organizationId: string): Promise<{
    status: "active";
    baseUrl: string;
    siteName: string | null;
    userName: string | null;
    release: string | null;
    verifiedAt: string;
  }> {
    const university = await this.getMoodleUniversity(organizationId);
    const config = readMoodleConnectionConfig(university.connectorConfig);
    try {
      const info = await this.moodleConnectorService.testConnection(config);
      const verifiedAt = new Date().toISOString();
      university.connectorConfig = {
        ...(university.connectorConfig || {}),
        status: "active",
        lastVerifiedAt: verifiedAt,
        updatedAt: verifiedAt,
        lastError: null,
        moodleSiteName: info.siteName,
        moodleRelease: info.release,
      };
      await this.universityRepository.save(university);
      return { status: "active", baseUrl: config.baseUrl, ...info, verifiedAt };
    } catch (error) {
      university.connectorConfig = {
        ...(university.connectorConfig || {}),
        status: "error",
        updatedAt: new Date().toISOString(),
        lastError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Moodle connection failed",
      };
      await this.universityRepository.save(university);
      throw error;
    }
  }

  private async getMoodleUniversity(organizationId: string): Promise<University> {
    this.tenantContext.assertAccess(organizationId);
    const university = await this.getUniversity(organizationId);
    if (university.connectorType !== "moodle") {
      throw new BadRequestException(
        "Для этого ВУЗа Moodle-коннектор не настроен.",
      );
    }
    return university;
  }

  private getVisibleUserRoles(requesterRole: UserRole): UserRole[] {
    const requesterLevel = ROLE_HIERARCHY[requesterRole] ?? -1;
    return Object.values(UserRole).filter((role) => ROLE_HIERARCHY[role] < requesterLevel);
  }
}

function connectorId(type: string): string {
  return type === "rasp-sano" ? "sibit" : type;
}

function readMoodleConnectionConfig(
  value: Record<string, unknown> | null | undefined,
): MoodleConnectionConfig {
  const baseUrl = value?.baseUrl;
  const encryptedToken = value?.encryptedToken;
  const tokenIv = value?.tokenIv;
  const tokenTag = value?.tokenTag;
  if (
    typeof baseUrl !== "string" ||
    typeof encryptedToken !== "string" ||
    typeof tokenIv !== "string" ||
    typeof tokenTag !== "string"
  ) {
    throw new BadRequestException(
      "Сначала сохраните URL и токен Moodle в настройках коннектора.",
    );
  }
  return { baseUrl, encryptedToken, tokenIv, tokenTag };
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}

function academicStartYear(value: string): number {
  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

function sibitLessonKey(externalId: string | null, groupId: string): string {
  return `${externalId ?? ""}::${groupId}`;
}

function sibitLessonChanged(current: Lesson, next: Partial<Lesson>): boolean {
  return (
    current.groupId !== next.groupId ||
    current.teacherId !== next.teacherId ||
    current.sourceTeacherId !== next.sourceTeacherId ||
    current.subject !== next.subject ||
    current.subjectType !== next.subjectType ||
    current.room !== next.room ||
    current.dayOfWeek !== next.dayOfWeek ||
    current.startTime !== next.startTime ||
    current.endTime !== next.endTime ||
    current.pairNumber !== next.pairNumber ||
    current.weekType !== next.weekType ||
    current.teacherName !== next.teacherName ||
    current.groupName !== next.groupName ||
    current.subgroup !== next.subgroup ||
    current.faculty !== next.faculty ||
    current.notes !== next.notes ||
    current.isChanged !== next.isChanged ||
    current.changeDescription !== next.changeDescription ||
    new Date(current.startDate).getTime() !==
      new Date(next.startDate ?? 0).getTime() ||
    new Date(current.endDate).getTime() !==
      new Date(next.endDate ?? 0).getTime()
  );
}

function sibitScheduleEventType(
  current: Lesson,
  next: Partial<Lesson>,
): "lesson.changed" | "lesson.rescheduled" | "room.changed" {
  if (current.room !== next.room) return "room.changed";
  if (
    current.startTime !== next.startTime ||
    current.endTime !== next.endTime ||
    new Date(current.startDate).getTime() !==
      new Date(next.startDate ?? 0).getTime() ||
    new Date(current.endDate).getTime() !==
      new Date(next.endDate ?? 0).getTime()
  ) {
    return "lesson.rescheduled";
  }
  return "lesson.changed";
}

/** Link imported lesson rows only to accounts explicitly linked by source ID. */
function resolveTeacherId(
  sourceName: string | undefined,
  sourceTeacherId: string | undefined,
  teachers: User[],
): string | undefined {
  void sourceName;
  if (!sourceTeacherId) return undefined;
  return teachers.find((teacher) => teacher.sourceTeacherId === sourceTeacherId)?.id;
}

function readScheduleConnectorSettings(university: University): {
  provider: 'rasp-sano' | 'file-only';
  enabled: boolean;
  config: { academicYear?: string };
} {
  const stored = university.connectorConfig?.scheduleConnector;
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const value = stored as Record<string, unknown>;
    const provider = value.provider === 'rasp-sano' ? 'rasp-sano' : 'file-only';
    const configValue = value.config && typeof value.config === 'object' && !Array.isArray(value.config)
      ? value.config as Record<string, unknown>
      : {};
    const academicYear = configValue.academicYear;
    return {
      provider,
      enabled: provider === 'rasp-sano' && value.enabled === true,
      config: typeof academicYear === 'string' && /^\d{4}-\d{4}$/.test(academicYear) ? { academicYear } : {},
    };
  }
  // The existing connectorType is the legacy explicit provider setting for SIBIT tenants.
  return university.connectorType === 'rasp-sano'
    ? { provider: 'rasp-sano', enabled: true, config: {} }
    : { provider: 'file-only', enabled: false, config: {} };
}

function scheduleConnectorResponse(university: University) {
  const settings = readScheduleConnectorSettings(university);
  return {
    ...settings,
    sourceHost: settings.provider === 'rasp-sano' ? 'rasp.sano.ru' as const : null,
  };
}

function roomAuditValues(room: Room): JsonObject {
  return {
    name: room.name,
    code: room.code,
    building: room.building,
    floor: room.floor,
    capacity: room.capacity,
    isArchived: !!room.archivedAt,
    archiveReason: room.archiveReason,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const value = error as { code?: string; driverError?: { code?: string } };
  return value?.code === '23505' || value?.driverError?.code === '23505';
}
function connectorName(type: string): string {
  if (type === "rasp-sano") return "СИБИТ Расписание";
  if (type === "moodle") return "Moodle";
  return type;
}
function connectorKind(type: string): string {
  if (type === "rasp-sano") return "api";
  if (type === "moodle") return "lms";
  return "file";
}
function connectorCapabilities(
  type: string,
): ConnectorResponseDto["capabilities"] {
  if (type === "rasp-sano") return { scheduleSync: true };
  if (type === "moodle") return { learningManagement: true };
  return {};
}
