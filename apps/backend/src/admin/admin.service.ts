import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThanOrEqual, Repository } from "typeorm";
import * as bcrypt from "bcrypt";

import { UsersService } from "../users/users.service";
import { CurationService } from "../curation/curation.service";
import { ScheduleService } from "../schedule/schedule.service";
import { SibitConnectorService } from "../schedule/connectors/sibit-connector.service";
import { RaspCatalog, RaspScraperService, SIBIT_UNIVERSITY } from "../auth/rasp-scraper.service";
import { University } from "../users/entities/university.entity";
import { Faculty } from "../users/entities/faculty.entity";
import { Group } from "../users/entities/group.entity";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import {
  ImportScheduleDto,
  type ImportScheduleRowDto,
} from "./dto/import-schedule.dto";
import { CreateLessonDto } from "../schedule/dto/create-lesson.dto";
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
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from "../common/dto/pagination-query.dto";

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
  [UserRole.DEVELOPER]: 0,
  [UserRole.STUDENT]: 1,
  [UserRole.TEACHER]: 2,
  [UserRole.CURATOR]: 3,
  [UserRole.DEPARTMENT_HEAD]: 4,
  [UserRole.FACULTY_DEAN]: 5,
  [UserRole.UNIVERSITY_ADMIN]: 6,
  [UserRole.SUPERADMIN]: 7,
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
    private readonly tenantContext: TenantContext,
    private readonly moodleConnectorService: MoodleConnectorService,
    private readonly raspScraperService: RaspScraperService,
    @Optional() private readonly eventBus?: EventBusService,
    @Optional() private readonly curation?: CurationService,
  ) {}

  async getUniversityUsers(
    universityId: string,
    pagination: PaginationQueryDto,
    requesterRole: UserRole,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(universityId);
    return this.usersService.findByUniversityId(
      universityId,
      pagination,
      this.getVisibleUserRoles(requesterRole),
    );
  }

  async getSibitTeachers(universityId: string) {
    this.tenantContext.assertAccess(universityId);
    const university = await this.universityRepository.findOne({ where: { id: universityId } });
    if (!university || university.connectorType !== "rasp-sano") {
      throw new BadRequestException("Каталог преподавателей СИБИТ недоступен для этого университета");
    }
    const teachers = await this.sibitConnectorService.getTeachers();
    const linkedUsers = await this.userRepository.find({
      where: { universityId, role: UserRole.TEACHER },
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
    universityId: string,
    groupId: string,
    pagination: PaginationQueryDto,
    requesterId?: string,
    requesterRole?: UserRole,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(universityId);
    if (requesterRole === UserRole.CURATOR && this.curation) {
      await this.curation.assertGroup(groupId);
    }
    if (requesterRole === UserRole.TEACHER && requesterId) {
      const groupIds = await this.scheduleService.getTeacherGroupIds(
        universityId,
        requesterId,
      );
      if (!groupIds.includes(groupId)) {
        throw new ForbiddenException(
          "Teachers can only view students from their own lesson groups",
        );
      }
    }
    return this.usersService.findByGroupId(groupId, universityId, pagination);
  }

  async updateUserRole(
    universityId: string,
    userId: string,
    updateUserRoleDto: UpdateUserRoleDto,
    requesterRole: UserRole,
  ): Promise<User> {
    if (updateUserRoleDto.role === UserRole.CURATOR) throw new BadRequestException('Кураторство назначается существующему аккаунту через раздел «Кураторство», без изменения основной роли.');
    if (!this.canManageRole(requesterRole, updateUserRoleDto.role)) {
      throw new ForbiddenException(
        "Insufficient permissions to assign this role",
      );
    }

    const user = await this.usersService.findById(userId);

    if (!user || user.universityId !== universityId) {
      throw new ForbiddenException("User not found in this university");
    }

    const updatedUser = await this.usersService.update(userId, {
      role: updateUserRoleDto.role,
    });
    await this.usersService.invalidateSessions(userId);
    return updatedUser;
  }

  async createUniversityUser(
    universityId: string,
    data: CreateUniversityUserDto,
    requesterRole: UserRole,
  ): Promise<User> {
    this.tenantContext.assertAccess(universityId);
    if (data.role === UserRole.CURATOR) throw new BadRequestException('Создайте аккаунт студента или сотрудника и назначьте ему кураторские группы.');
    if (!this.canManageRole(requesterRole, data.role))
      throw new ForbiddenException(
        "Insufficient permissions to create this role",
      );
    if (await this.usersService.findByEmail(data.email.trim()))
      throw new ConflictException("Пользователь с такой почтой уже существует");
    if (data.groupId) {
      if (/^\d+$/.test(data.groupId)) {
        if (data.role !== UserRole.STUDENT) {
          throw new BadRequestException("Внешний ID учебной группы назначается аккаунту студента.");
        }
        const university = await this.getUniversity(universityId);
        if (university.name !== SIBIT_UNIVERSITY.name || university.city !== SIBIT_UNIVERSITY.city || university.connectorType !== "rasp-sano" || !await this.raspScraperService.isValidGroup(data.groupId)) {
          throw new BadRequestException("Выберите группу из каталога СИБИТ для этого университета.");
        }
      } else {
        const group = await this.groupRepository.findOne({
          where: { id: data.groupId, universityId },
        });
        if (!group)
          throw new BadRequestException(
            "Группа не найдена в структуре этого ВУЗа",
          );
      }
    }
    if (data.sourceTeacherId) {
      if (data.role !== UserRole.TEACHER) throw new BadRequestException("Внешний ID преподавателя можно назначить только учётной записи преподавателя.");
      const university = await this.getUniversity(universityId);
      if (university.connectorType !== "rasp-sano" || !(await this.sibitConnectorService.getTeachers()).some((teacher) => teacher.id === data.sourceTeacherId)) {
        throw new BadRequestException("Преподаватель не найден в каталоге расписания СИБИТа.");
      }
      const existingLink = await this.userRepository.findOne({ where: { universityId, sourceTeacherId: data.sourceTeacherId } });
      if (existingLink) throw new ConflictException("Этот преподаватель СИБИТа уже связан с учётной записью.");
    }
    const created = await this.usersService.create({
      email: data.email.trim(),
      passwordHash: await bcrypt.hash(data.password, 12),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      role: data.role,
      groupId: data.groupId,
      sourceTeacherId: data.sourceTeacherId || null,
      universityId,
    });
    if (data.sourceTeacherId) {
      await this.syncSchedule(universityId);
    }
    return created;
  }

  async linkSibitTeacher(universityId: string, userId: string, sourceTeacherId: string | null) {
    this.tenantContext.assertAccess(universityId);
    const user = await this.userRepository.findOne({ where: { id: userId, universityId } });
    if (!user || user.role !== UserRole.TEACHER) throw new NotFoundException("Учётная запись преподавателя не найдена.");
    if (sourceTeacherId) {
      const university = await this.getUniversity(universityId);
      if (university.connectorType !== "rasp-sano" || !(await this.sibitConnectorService.getTeachers()).some((teacher) => teacher.id === sourceTeacherId)) {
        throw new BadRequestException("Преподаватель не найден в каталоге расписания СИБИТа.");
      }
      const existingLink = await this.userRepository.findOne({ where: { universityId, sourceTeacherId } });
      if (existingLink && existingLink.id !== userId) throw new ConflictException("Этот преподаватель СИБИТа уже связан с другой учётной записью.");
    }
    user.sourceTeacherId = sourceTeacherId;
    await this.userRepository.save(user);
    if (sourceTeacherId) {
      await this.syncSchedule(universityId);
    } else {
      await this.lessonRepository.update(
        { universityId, source: "sibit", teacherId: userId },
        { teacherId: null },
      );
    }
    return user;
  }

  async updateUniversityUserStatus(
    universityId: string,
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
    if (!user || user.universityId !== universityId)
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
    universityId: string,
    userId: string,
    data: ResetUniversityUserPasswordDto,
    requesterRole: UserRole,
  ): Promise<User> {
    this.tenantContext.assertAccess(universityId);
    const user = await this.usersService.findById(userId);
    if (!user || user.universityId !== universityId) {
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

  async importSchedule(
    universityId: string,
    importScheduleDto: ImportScheduleDto,
  ): Promise<{ imported: number; updated: number }> {
    this.tenantContext.assertAccess(universityId);

    const groupNames = [
      ...new Set(
        importScheduleDto.rows.map((row) => row.group.trim()).filter(Boolean),
      ),
    ];
    const groups = await this.groupRepository.find({
      where: { universityId, name: In(groupNames) },
    });
    const groupsByName = new Map(
      groups.map((group) => [
        group.name.trim().toLocaleLowerCase("ru-RU"),
        group,
      ]),
    );
    const unknownGroups = groupNames.filter(
      (name) => !groupsByName.has(name.toLocaleLowerCase("ru-RU")),
    );

    if (unknownGroups.length) {
      throw new BadRequestException(
        `Не найдены группы ВУЗа: ${unknownGroups.slice(0, 5).join(", ")}${unknownGroups.length > 5 ? "…" : ""}. Сначала добавьте их в структуру ВУЗа.`,
      );
    }

    const lessons = importScheduleDto.rows.map((row, index) =>
      this.toLessonDto(
        row,
        groupsByName.get(row.group.trim().toLocaleLowerCase("ru-RU"))!.id,
        importScheduleDto.fileName,
        index,
      ),
    );

    return this.scheduleService.importLessons(universityId, lessons);
  }

  async syncSchedule(universityId: string): Promise<{
    status: string;
    timestamp: string;
    groups: number;
    lessons: number;
    teachers: number;
    imported: number;
    updated: number;
    studentsLinked: number;
  }> {
    this.tenantContext.assertAccess(universityId);
    const university = await this.getUniversity(universityId);
    if (!connectorCapabilities(university.connectorType || "").scheduleSync) {
      throw new BadRequestException(
        "Для этого ВУЗа не настроен источник расписания с поддержкой синхронизации.",
      );
    }
    const { catalog, ...summary } = await this.sibitConnectorService.sync();
    const persisted = await this.persistSibitCatalog(universityId, catalog);
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
    universityId: string,
    catalog: RaspCatalog,
  ): Promise<{ imported: number; updated: number; studentsLinked: number }> {
    const [existingFaculties, existingGroups, users, existingLessons] =
      await Promise.all([
        this.facultyRepository.find({ where: { universityId } }),
        this.groupRepository.find({ where: { universityId } }),
        this.userRepository.find({ where: { universityId } }),
        this.lessonRepository.find({
          where: { universityId, source: "sibit" },
        }),
      ]);

    const facultyByName = new Map(
      existingFaculties.map((faculty) => [
        normalizedKey(faculty.name),
        faculty,
      ]),
    );
    const groupByExternalId = new Map(
      existingGroups
        .filter((group) => group.externalId)
        .map((group) => [group.externalId!, group]),
    );
    const groupByName = new Map(
      existingGroups.map((group) => [normalizedKey(group.name), group]),
    );
    const groupsBySourceId = new Map<string, Group>();

    for (const sourceGroup of catalog.groups) {
      const facultyKey = normalizedKey(sourceGroup.faculty || "Не указан");
      let faculty = facultyByName.get(facultyKey);
      if (!faculty) {
        faculty = await this.facultyRepository.save(
          this.facultyRepository.create({
            universityId,
            name: sourceGroup.faculty || "Не указан",
            code: `sibit-${sourceGroup.facultyId}`,
          }),
        );
        facultyByName.set(facultyKey, faculty);
      }

      let group = groupByExternalId.get(sourceGroup.groupId);
      if (!group) group = groupByName.get(normalizedKey(sourceGroup.name));
      if (group) {
        const changed =
          group.externalId !== sourceGroup.groupId ||
          group.facultyId !== faculty.id ||
          group.name !== sourceGroup.name;
        if (changed) {
          Object.assign(group, {
            externalId: sourceGroup.groupId,
            facultyId: faculty.id,
            name: sourceGroup.name,
          });
          group = await this.groupRepository.save(group);
        }
      } else {
        group = await this.groupRepository.save(
          this.groupRepository.create({
            universityId,
            facultyId: faculty.id,
            name: sourceGroup.name,
            externalId: sourceGroup.groupId,
            curriculumYear: academicStartYear(sourceGroup.academicYear),
          }),
        );
      }
      groupByExternalId.set(sourceGroup.groupId, group);
      groupsBySourceId.set(sourceGroup.groupId, group);
    }

    let studentsLinked = 0;
    for (const user of users) {
      if (user.role !== UserRole.STUDENT || !user.groupId) continue;
      const group = groupsBySourceId.get(user.groupId);
      if (group && user.groupId !== group.id) {
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
      if (!group) continue;
      const key = sibitLessonKey(sourceLesson.lessonId, group.id);
      const existing = lessonBySourceKey.get(key);
      const source = {
        universityId,
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
            universityId,
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

  async getUniversityStats(universityId: string): Promise<UniversityStats> {
    this.tenantContext.assertAccess(universityId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalLessons,
      activeToday,
    ] = await Promise.all([
      this.userRepository.count({ where: { universityId } }),
      this.userRepository.count({
        where: { universityId, role: UserRole.STUDENT },
      }),
      this.userRepository.count({
        where: { universityId, role: UserRole.TEACHER },
      }),
      this.lessonRepository.count({ where: { universityId } }),
      this.userRepository.count({
        where: { universityId, lastLoginAt: MoreThanOrEqual(today) },
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

  async getUniversity(universityId: string): Promise<University> {
    this.tenantContext.assertAccess(universityId);
    const university = await this.universityRepository.findOne({
      where: { id: universityId },
    });

    if (!university) {
      throw new NotFoundException(
        `University with id ${universityId} not found`,
      );
    }

    return university;
  }

  async updateUniversity(
    universityId: string,
    updateData: UpdateUniversityDto,
  ): Promise<University> {
    const university = await this.getUniversity(universityId);
    Object.assign(university, updateData);
    return this.universityRepository.save(university);
  }

  async getFaculties(
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Faculty>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.facultyRepository.findAndCount({
      where: { universityId },
      order: { name: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createFaculty(
    universityId: string,
    data: CreateFacultyDto,
  ): Promise<Faculty> {
    this.tenantContext.assertAccess(universityId);
    if (data.deanUserId) await this.assertFacultyDean(universityId, data.deanUserId);
    const faculty = this.facultyRepository.create({
      ...data,
      universityId,
    });
    return this.facultyRepository.save(faculty);
  }

  async updateFaculty(id: string, data: UpdateFacultyDto): Promise<Faculty> {
    const faculty = await this.facultyRepository.findOne({ where: { id } });

    if (!faculty) {
      throw new NotFoundException(`Faculty with id ${id} not found`);
    }
    this.tenantContext.assertAccess(faculty.universityId);

    if (data.deanUserId !== undefined && data.deanUserId !== null) {
      await this.assertFacultyDean(faculty.universityId, data.deanUserId);
    }

    Object.assign(faculty, data);
    return this.facultyRepository.save(faculty) as Promise<Faculty>;
  }

  private async assertFacultyDean(universityId: string, deanUserId: string): Promise<void> {
    const dean = await this.userRepository.findOne({
      where: { id: deanUserId, universityId, role: UserRole.FACULTY_DEAN, isActive: true },
      select: { id: true },
    });
    if (!dean) {
      throw new BadRequestException(
        "Выбранный декан должен быть активным пользователем с ролью «Декан» в этом университете.",
      );
    }
  }

  async getGroups(
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Group>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.groupRepository.findAndCount({
      where: { universityId },
      order: { name: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async getAttendanceGroups(
    universityId: string,
    requesterId: string,
    requesterRole: UserRole,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Group>> {
    this.tenantContext.assertAccess(universityId);
    if (requesterRole === UserRole.CURATOR && this.curation) {
      const result = await this.curation.groups(pagination);
      const ids = result.data.map(group => group.id);
      const data = ids.length ? await this.groupRepository.find({ where: { id: In(ids), universityId }, order: { name: 'ASC' } }) : [];
      return { ...result, data };
    }
    if (requesterRole !== UserRole.TEACHER)
      return this.getGroups(universityId, pagination);
    const groupIds = await this.scheduleService.getTeacherGroupIds(
      universityId,
      requesterId,
    );
    if (!groupIds.length) return toPaginatedResponse([], 0, pagination);
    const [data, total] = await this.groupRepository.findAndCount({
      where: { universityId, id: In(groupIds) },
      order: { name: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createGroup(
    universityId: string,
    data: CreateGroupDto,
  ): Promise<Group> {
    this.tenantContext.assertAccess(universityId);
    if (data.curatorId) throw new BadRequestException('Назначьте кураторов через управление кураторством после создания группы.');
    const group = this.groupRepository.create({
      name: data.name,
      specialization: data.specialization,
      facultyId: data.facultyId,
      curatorId: data.curatorId,
      universityId,
      curriculumYear: Number(data.curriculumYear),
    });
    return this.groupRepository.save(group);
  }

  async updateGroup(id: string, data: UpdateGroupDto): Promise<Group> {
    if (data.curatorId !== undefined) throw new BadRequestException('Используйте управление кураторством для назначения и снятия кураторов.');
    const group = await this.groupRepository.findOne({ where: { id } });

    if (!group) {
      throw new NotFoundException(`Group with id ${id} not found`);
    }
    this.tenantContext.assertAccess(group.universityId);

    Object.assign(group, data);
    return this.groupRepository.save(group) as Promise<Group>;
  }

  private canManageRole(
    requesterRole: UserRole,
    targetRole: UserRole,
  ): boolean {
    if (targetRole === UserRole.EMPLOYER) return false;
    if (targetRole === UserRole.DEVELOPER) {
      return requesterRole === UserRole.SUPERADMIN;
    }

    const requesterLevel = ROLE_HIERARCHY[requesterRole] ?? -1;
    const targetLevel = ROLE_HIERARCHY[targetRole] ?? -1;
    return requesterLevel > targetLevel;
  }

  private toLessonDto(
    row: ImportScheduleRowDto,
    groupId: string,
    fileName: string,
    index: number,
  ): CreateLessonDto {
    const startDate = new Date(`${row.date}T${row.startTime}:00`);
    const endDate = new Date(`${row.date}T${row.endTime}:00`);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw new BadRequestException(
        `Строка ${index + 1}: время окончания должно быть позже времени начала.`,
      );
    }

    return {
      groupId,
      groupName: row.group.trim(),
      subject: row.subject.trim(),
      teacherName: row.teacher?.trim() || undefined,
      room: row.room?.trim() || undefined,
      dayOfWeek: startDate.getDay(),
      startTime: row.startTime,
      endTime: row.endTime,
      pairNumber: row.pairNumber,
      weekType: "both",
      startDate,
      endDate,
      source: "university-import",
      externalId: `${fileName}:${index + 1}`,
    };
  }

  async getAuditLog(
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<AuditLog & { source: string }>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.auditLogRepository
      .createQueryBuilder("auditLog")
      .innerJoin(User, "auditUser", "auditUser.id = auditLog.userId")
      .where("auditUser.universityId = :universityId", { universityId })
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
    universityId: string,
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
    const university = await this.getUniversity(universityId);
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
    universityId: string,
    id: string,
    updateData: UpdateConnectorDto,
  ): Promise<ConnectorResponseDto & { updatedAt: string }> {
    const university = await this.getUniversity(universityId);
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
    universityId: string,
    dto: ConfigureMoodleConnectorDto,
  ): Promise<{ baseUrl: string; tokenConfigured: true; updatedAt: string }> {
    const university = await this.getMoodleUniversity(universityId);
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

  async testMoodleConnector(universityId: string): Promise<{
    status: "active";
    baseUrl: string;
    siteName: string | null;
    userName: string | null;
    release: string | null;
    verifiedAt: string;
  }> {
    const university = await this.getMoodleUniversity(universityId);
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

  private async getMoodleUniversity(universityId: string): Promise<University> {
    this.tenantContext.assertAccess(universityId);
    const university = await this.getUniversity(universityId);
    if (university.connectorType !== "moodle") {
      throw new BadRequestException(
        "Для этого ВУЗа Moodle-коннектор не настроен.",
      );
    }
    return university;
  }

  private getVisibleUserRoles(requesterRole: UserRole): UserRole[] {
    if (requesterRole === UserRole.SUPERADMIN) {
      return Object.values(UserRole);
    }

    return Object.values(UserRole).filter(
      (role) => role !== UserRole.DEVELOPER && role !== UserRole.SUPERADMIN,
    );
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

/**
 * Prefer the exact external source ID. If no account has a source-ID link,
 * retain the legacy fallback only for one unambiguous name match.
 */
function resolveTeacherId(
  sourceName: string | undefined,
  sourceTeacherId: string | undefined,
  teachers: User[],
): string | undefined {
  if (sourceTeacherId) {
    const linked = teachers.find((teacher) => teacher.sourceTeacherId === sourceTeacherId);
    if (linked) return linked.id;
  }
  if (!sourceName) return undefined;
  const source = normalizedKey(sourceName).replace(/[^а-яa-z]/g, "");
  if (!source) return undefined;
  const matches = teachers.filter((teacher) => {
    const fullName = normalizedKey(
      `${teacher.lastName} ${teacher.firstName}`,
    ).replace(/[^а-яa-z]/g, "");
    const surname = normalizedKey(teacher.lastName).replace(/[^а-яa-z]/g, "");
    const firstInitial = normalizedKey(teacher.firstName).replace(
      /[^а-яa-z]/g,
      "",
    )[0];
    return (
      source === fullName ||
      (Boolean(firstInitial) &&
        source.startsWith(surname) &&
        source[surname.length] === firstInitial)
    );
  });
  return matches.length === 1 ? matches[0].id : undefined;
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
