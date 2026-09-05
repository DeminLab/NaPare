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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
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
  async getUsers(@Request() req) {
    return this.adminService.getUniversityUsers(req.user.universityId);
  }

  @Patch('users/:userId/role')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Изменить роль пользователя' })
  async updateUserRole(
    @Request() req,
    @Param('userId') userId: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(
      req.user.universityId,
      userId,
      updateUserRoleDto,
      req.user.role,
    );
  }

  @Post('schedule/import')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Импортировать расписание' })
  async importSchedule(@Request() req) {
    return this.adminService.importSchedule(req.user.universityId, {
      fileUrl: '',
      format: 'excel',
    });
  }

  @Get('stats')
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить статистику университета' })
  async getStats(@Request() req) {
    return this.adminService.getUniversityStats(req.user.universityId);
  }
}
