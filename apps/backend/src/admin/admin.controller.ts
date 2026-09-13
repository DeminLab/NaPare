import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить пользователей университета' })
  @ApiResponse({ status: 200, description: 'Пользователи получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsers(@Request() req) {
    return this.adminService.getUniversityUsers(req.user.universityId);
  }

  @Patch('users/:id/roles')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Изменить роль пользователя' })
  @ApiResponse({ status: 200, description: 'Роль обновлена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateUserRole(
    @Request() req,
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(
      req.user.universityId,
      id,
      updateUserRoleDto,
      req.user.role,
    );
  }

  @Post('schedule/upload')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Загрузить расписание' })
  @ApiResponse({ status: 201, description: 'Расписание загружено' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadSchedule(@Request() req) {
    return this.adminService.importSchedule(req.user.universityId, {
      fileUrl: '',
      format: 'excel',
    });
  }

  @Post('schedule/sync')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Синхронизировать расписание' })
  @ApiResponse({ status: 200, description: 'Синхронизация запущена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncSchedule(@Request() req) {
    return { status: 'synced', timestamp: new Date().toISOString() };
  }

  @Get('schedule/sync-status')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить статус синхронизации' })
  @ApiResponse({ status: 200, description: 'Статус получен' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSyncStatus(@Request() req) {
    return { lastSync: null, status: 'idle' };
  }

  @Get('university')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить информацию об университете' })
  @ApiResponse({ status: 200, description: 'Информация получена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUniversity(@Request() req) {
    return this.adminService.getUniversity(req.user.universityId);
  }

  @Patch('university')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Обновить информацию об университете' })
  @ApiResponse({ status: 200, description: 'Информация обновлена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateUniversity(
    @Request() req,
    @Body() updateUniversityDto: UpdateUniversityDto,
  ) {
    return this.adminService.updateUniversity(req.user.universityId, updateUniversityDto);
  }

  @Get('faculties')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить список факультетов' })
  @ApiResponse({ status: 200, description: 'Факультеты получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFaculties(@Request() req) {
    return this.adminService.getFaculties(req.user.universityId);
  }

  @Post('faculties')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Создать факультет' })
  @ApiResponse({ status: 201, description: 'Факультет создан' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createFaculty(
    @Request() req,
    @Body() createFacultyDto: CreateFacultyDto,
  ) {
    return this.adminService.createFaculty(req.user.universityId, createFacultyDto);
  }

  @Patch('faculties/:id')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Обновить факультет' })
  @ApiResponse({ status: 200, description: 'Факультет обновлён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateFaculty(
    @Param('id') id: string,
    @Body() updateFacultyDto: UpdateFacultyDto,
  ) {
    return this.adminService.updateFaculty(id, updateFacultyDto);
  }

  @Get('groups')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить список групп' })
  @ApiResponse({ status: 200, description: 'Группы получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getGroups(@Request() req) {
    return this.adminService.getGroups(req.user.universityId);
  }

  @Post('groups')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Создать группу' })
  @ApiResponse({ status: 201, description: 'Группа создана' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createGroup(
    @Request() req,
    @Body() createGroupDto: CreateGroupDto,
  ) {
    return this.adminService.createGroup(req.user.universityId, createGroupDto);
  }

  @Patch('groups/:id')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Обновить группу' })
  @ApiResponse({ status: 200, description: 'Группа обновлена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateGroup(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.adminService.updateGroup(id, updateGroupDto);
  }

  @Get('stats')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить статистику университета' })
  @ApiResponse({ status: 200, description: 'Статистика получена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Request() req) {
    return this.adminService.getUniversityStats(req.user.universityId);
  }
}
