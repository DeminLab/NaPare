import { Injectable, ForbiddenException } from '@nestjs/common';

import { UsersService } from '../users/users.service';
import { ScheduleService } from '../schedule/schedule.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ImportScheduleDto } from './dto/import-schedule.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly scheduleService: ScheduleService,
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
    // Check permissions
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
    // TODO: Parse schedule from file
    // This is a placeholder
    return this.scheduleService.importLessons(universityId, []);
  }

  async getUniversityStats(universityId: string): Promise<any> {
    // TODO: Implement actual stats
    return {
      totalUsers: 0,
      totalStudents: 0,
      totalTeachers: 0,
      totalLessons: 0,
    };
  }

  private canManageRole(requesterRole: string, targetRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      developer: 8,
      superadmin: 7,
      university_admin: 6,
      department_head: 5,
      faculty_dean: 4,
      curator: 3,
      teacher: 2,
      student: 1,
    };

    return (roleHierarchy[requesterRole] || 0) > (roleHierarchy[targetRole] || 0);
  }
}
