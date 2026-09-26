import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
import { ScheduleService } from '../schedule/schedule.service';
import { SibitConnectorService } from '../schedule/connectors/sibit-connector.service';
import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ImportScheduleDto, type ImportScheduleRowDto } from './dto/import-schedule.dto';
import { CreateLessonDto } from '../schedule/dto/create-lesson.dto';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { User } from '../users/entities/user.entity';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { ConnectorResponseDto } from './dto/connector-response.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';

export interface UniversityStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalLessons: number;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
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
    private readonly tenantContext: TenantContext,
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

  async getGroupStudents(
    universityId: string,
    groupId: string,
    pagination: PaginationQueryDto,
    requesterId?: string,
    requesterRole?: UserRole,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(universityId);
    if (requesterRole === UserRole.TEACHER && requesterId) {
      const groupIds = await this.scheduleService.getTeacherGroupIds(universityId, requesterId);
      if (!groupIds.includes(groupId)) {
        throw new ForbiddenException('Teachers can only view students from their own lesson groups');
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
    if (!this.canManageRole(requesterRole, updateUserRoleDto.role)) {
      throw new ForbiddenException('Insufficient permissions to assign this role');
    }

    const user = await this.usersService.findById(userId);

    if (!user || user.universityId !== universityId) {
      throw new ForbiddenException('User not found in this university');
    }

    return this.usersService.update(userId, { role: updateUserRoleDto.role });
  }

  async importSchedule(
    universityId: string,
    importScheduleDto: ImportScheduleDto,
  ): Promise<{ imported: number; updated: number }> {
    this.tenantContext.assertAccess(universityId);

    const groupNames = [...new Set(importScheduleDto.rows.map((row) => row.group.trim()).filter(Boolean))];
    const groups = await this.groupRepository.find({
      where: { universityId, name: In(groupNames) },
    });
    const groupsByName = new Map(groups.map((group) => [group.name.trim().toLocaleLowerCase('ru-RU'), group]));
    const unknownGroups = groupNames.filter((name) => !groupsByName.has(name.toLocaleLowerCase('ru-RU')));

    if (unknownGroups.length) {
      throw new BadRequestException(`Не найдены группы ВУЗа: ${unknownGroups.slice(0, 5).join(', ')}${unknownGroups.length > 5 ? '…' : ''}. Сначала добавьте их в структуру ВУЗа.`);
    }

    const lessons = importScheduleDto.rows.map((row, index) => this.toLessonDto(
      row,
      groupsByName.get(row.group.trim().toLocaleLowerCase('ru-RU'))!.id,
      importScheduleDto.fileName,
      index,
    ));

    return this.scheduleService.importLessons(universityId, lessons);
  }

  async syncSchedule(
    universityId: string,
  ): Promise<{ status: string; timestamp: string; groups: number; lessons: number; teachers: number }> {
    this.tenantContext.assertAccess(universityId);
    const summary = await this.sibitConnectorService.sync();
    const university = await this.getUniversity(universityId);
    const timestamp = new Date().toISOString();
    university.connectorConfig = {
      ...(university.connectorConfig || {}),
      status: 'active',
      lastSync: timestamp,
      updatedAt: timestamp,
      lastSyncSummary: summary,
    };
    await this.universityRepository.save(university);
    return {
      status: 'synced',
      timestamp,
      groups: summary.groups,
      lessons: summary.lessons,
      teachers: summary.teachers,
    };
  }

  async getUniversityStats(_universityId: string): Promise<UniversityStats> {
    return {
      totalUsers: 0,
      totalStudents: 0,
      totalTeachers: 0,
      totalLessons: 0,
    };
  }

  async getUniversity(universityId: string): Promise<University> {
    this.tenantContext.assertAccess(universityId);
    const university = await this.universityRepository.findOne({
      where: { id: universityId },
    });

    if (!university) {
      throw new NotFoundException(`University with id ${universityId} not found`);
    }

    return university;
  }

  async updateUniversity(universityId: string, updateData: UpdateUniversityDto): Promise<University> {
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
      order: { name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createFaculty(universityId: string, data: CreateFacultyDto): Promise<Faculty> {
    this.tenantContext.assertAccess(universityId);
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

    Object.assign(faculty, data);
    return this.facultyRepository.save(faculty) as Promise<Faculty>;
  }

  async getGroups(
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Group>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.groupRepository.findAndCount({
      where: { universityId },
      order: { name: 'ASC' },
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
    if (requesterRole !== UserRole.TEACHER) return this.getGroups(universityId, pagination);
    const groupIds = await this.scheduleService.getTeacherGroupIds(universityId, requesterId);
    if (!groupIds.length) return toPaginatedResponse([], 0, pagination);
    const [data, total] = await this.groupRepository.findAndCount({
      where: { universityId, id: In(groupIds) },
      order: { name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createGroup(universityId: string, data: CreateGroupDto): Promise<Group> {
    this.tenantContext.assertAccess(universityId);
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
    const group = await this.groupRepository.findOne({ where: { id } });

    if (!group) {
      throw new NotFoundException(`Group with id ${id} not found`);
    }
    this.tenantContext.assertAccess(group.universityId);

    Object.assign(group, data);
    return this.groupRepository.save(group) as Promise<Group>;
  }

  private canManageRole(requesterRole: UserRole, targetRole: UserRole): boolean {
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

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      throw new BadRequestException(`Строка ${index + 1}: время окончания должно быть позже времени начала.`);
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
      weekType: 'both',
      startDate,
      endDate,
      source: 'university-import',
      externalId: `${fileName}:${index + 1}`,
    };
  }

  async getAuditLog(
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<AuditLog & { source: string }>> {
    this.tenantContext.assertAccess(universityId);
    const universityUsers = await this.usersService.findByUniversityId(universityId, { page: 1, limit: 100 }, Object.values(UserRole));
    const userIds = universityUsers.data.map((user) => user.id);
    if (!userIds.length) return toPaginatedResponse([], 0, pagination);
    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { userId: In(userIds) },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data.map((item) => ({ ...item, source: item.ip ? 'user action' : 'system' })), total, pagination);
  }

  async getConnectors(universityId: string, pagination: PaginationQueryDto): Promise<PaginatedResponse<ConnectorResponseDto & { updatedAt?: string }>> {
    const university = await this.getUniversity(universityId);
    if (!university.connectorType) return toPaginatedResponse([], 0, pagination);
    const config = university.connectorConfig || {};
    const connector = {
      id: connectorId(university.connectorType),
      name: connectorName(university.connectorType),
      type: connectorKind(university.connectorType),
      status: typeof config.status === 'string' ? config.status : 'active',
      capabilities: connectorCapabilities(university.connectorType),
      ...(typeof config.updatedAt === 'string' ? { updatedAt: config.updatedAt } : {}),
    };
    const start = (pagination.page - 1) * pagination.limit;
    return toPaginatedResponse([connector].slice(start, start + pagination.limit), 1, pagination);
  }

  async updateConnector(universityId: string, id: string, updateData: UpdateConnectorDto): Promise<ConnectorResponseDto & { updatedAt: string }> {
    const university = await this.getUniversity(universityId);
    if (!university.connectorType || connectorId(university.connectorType) !== id) throw new NotFoundException(`Connector ${id} not found`);
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
      status: String(university.connectorConfig.status || 'active'),
      capabilities: connectorCapabilities(university.connectorType),
      updatedAt,
    };
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

function connectorId(type: string): string { return type === 'rasp-sano' ? 'sibit' : type; }
function connectorName(type: string): string {
  if (type === 'rasp-sano') return 'СИБИТ Расписание';
  if (type === 'moodle') return 'Moodle';
  return type;
}
function connectorKind(type: string): string {
  if (type === 'rasp-sano') return 'api';
  if (type === 'moodle') return 'lms';
  return 'file';
}
function connectorCapabilities(type: string): ConnectorResponseDto['capabilities'] {
  if (type === 'rasp-sano') return { scheduleSync: true };
  if (type === 'moodle') return { learningManagement: true };
  return {};
}
