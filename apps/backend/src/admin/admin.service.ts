import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UsersService } from '../users/users.service';
import { ScheduleService } from '../schedule/schedule.service';
import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ImportScheduleDto } from './dto/import-schedule.dto';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { User } from '../users/entities/user.entity';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
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
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
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
  ): Promise<PaginatedResponse<User>> {
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
    return this.scheduleService.importLessons(universityId, []);
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

  private getVisibleUserRoles(requesterRole: UserRole): UserRole[] {
    if (requesterRole === UserRole.SUPERADMIN) {
      return Object.values(UserRole);
    }

    return Object.values(UserRole).filter(
      (role) => role !== UserRole.DEVELOPER && role !== UserRole.SUPERADMIN,
    );
  }
}
