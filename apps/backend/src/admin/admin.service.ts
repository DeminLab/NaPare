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

const ROLE_HIERARCHY: Record<string, number> = {
  developer: 0,
  student: 1,
  teacher: 2,
  curator: 3,
  department_head: 4,
  faculty_dean: 5,
  university_admin: 6,
  superadmin: 7,
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
  ) {}

  async getUniversityUsers(universityId: string): Promise<any[]> {
    return this.usersService.findByUniversityId(universityId);
  }

  async updateUserRole(
    universityId: string,
    userId: string,
    updateUserRoleDto: UpdateUserRoleDto,
    requesterRole: string,
  ): Promise<any> {
    if (!this.canManageRole(requesterRole, updateUserRoleDto.role)) {
      throw new ForbiddenException('Insufficient permissions to assign this role');
    }

    const user = await this.usersService.findById(userId);

    if (!user || user.universityId !== universityId) {
      throw new ForbiddenException('User not found in this university');
    }

    return this.usersService.update(userId, { roles: [updateUserRoleDto.role] });
  }

  async importSchedule(
    universityId: string,
    importScheduleDto: ImportScheduleDto,
  ): Promise<{ imported: number; updated: number }> {
    return this.scheduleService.importLessons(universityId, []);
  }

  async getUniversityStats(universityId: string): Promise<any> {
    return {
      totalUsers: 0,
      totalStudents: 0,
      totalTeachers: 0,
      totalLessons: 0,
    };
  }

  async getUniversity(universityId: string): Promise<University> {
    const university = await this.universityRepository.findOne({
      where: { id: universityId },
    });

    if (!university) {
      throw new NotFoundException(`University with id ${universityId} not found`);
    }

    return university;
  }

  async updateUniversity(universityId: string, updateData: any): Promise<University> {
    const university = await this.getUniversity(universityId);
    Object.assign(university, updateData);
    return this.universityRepository.save(university);
  }

  async getFaculties(universityId: string): Promise<Faculty[]> {
    return this.facultyRepository.find({
      where: { universityId },
      order: { name: 'ASC' },
    });
  }

  async createFaculty(universityId: string, data: any): Promise<Faculty> {
    const faculty = this.facultyRepository.create({
      ...data,
      universityId,
    });
    return this.facultyRepository.save(faculty as any) as Promise<Faculty>;
  }

  async updateFaculty(id: string, data: any): Promise<Faculty> {
    const faculty = await this.facultyRepository.findOne({ where: { id } });

    if (!faculty) {
      throw new NotFoundException(`Faculty with id ${id} not found`);
    }

    Object.assign(faculty, data);
    return this.facultyRepository.save(faculty) as Promise<Faculty>;
  }

  async getGroups(universityId: string): Promise<Group[]> {
    return this.groupRepository.find({
      where: { universityId },
      order: { name: 'ASC' },
    });
  }

  async createGroup(universityId: string, data: any): Promise<Group> {
    const group = this.groupRepository.create({
      ...data,
      universityId,
    });
    return this.groupRepository.save(group as any) as Promise<Group>;
  }

  async updateGroup(id: string, data: any): Promise<Group> {
    const group = await this.groupRepository.findOne({ where: { id } });

    if (!group) {
      throw new NotFoundException(`Group with id ${id} not found`);
    }

    Object.assign(group, data);
    return this.groupRepository.save(group) as Promise<Group>;
  }

  private canManageRole(requesterRole: string, targetRole: string): boolean {
    const requesterLevel = ROLE_HIERARCHY[requesterRole] || 0;
    const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
    return requesterLevel > targetLevel;
  }
}
