import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
  Request,
  ClassSerializerInterceptor,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";

import { AdminService } from "./admin.service";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UpdateUniversityDto } from "./dto/update-university.dto";
import { CreateFacultyDto } from "./dto/create-faculty.dto";
import { UpdateFacultyDto } from "./dto/update-faculty.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { ImportScheduleDto } from "./dto/import-schedule.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/interfaces/user-role";
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from "../common/dto/pagination-query.dto";
import { UpdateConnectorDto } from "./dto/update-connector.dto";
import { EventBusService } from "../events/event-bus.service";
import { CreateUniversityUserDto } from "./dto/create-university-user.dto";
import { UpdateUniversityUserStatusDto } from "./dto/update-university-user-status.dto";
import { ResetUniversityUserPasswordDto } from "./dto/reset-university-user-password.dto";
import { UpdateUniversityUserUsernameDto } from "./dto/update-university-user-username.dto";
import { ConfigureMoodleConnectorDto } from "./dto/configure-moodle-connector.dto";
import { LinkSibitTeacherDto } from "./dto/link-sibit-teacher.dto";
import { ScheduleImportService } from '../schedule/connectors/schedule-import.service';

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly eventBus: EventBusService,
    private readonly scheduleImports: ScheduleImportService,
  ) {}

  @Get("users")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить пользователей университета" })
  @ApiOkResponse({
    description: "Пользователи получены",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getUsers(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getUniversityUsers(
      req.user.organizationId,
      pagination,
      req.user.role,
    );
  }

  @Get("sibit/teachers")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить преподавателей и расписание из каталога СИБИТа" })
  async getSibitTeachers(@Request() req) {
    return this.adminService.getSibitTeachers(req.user.organizationId);
  }

  @Patch("users/:id/roles")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Изменить роль пользователя" })
  @ApiResponse({ status: 200, description: "Роль обновлена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateUserRole(
    @Request() req,
    @Param("id") id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(
      req.user.organizationId,
      id,
      updateUserRoleDto,
      req.user.id,
      req.user.role,
    );
  }

  @Patch("users/:id/username")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Назначить или изменить логин пользователя" })
  async updateUserUsername(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUniversityUserUsernameDto,
  ) {
    return this.adminService.updateUniversityUserUsername(
      req.user.organizationId,
      id,
      dto,
      req.user.role,
    );
  }

  @Post("users")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Создать учётную запись в своём университете" })
  async createUser(
    @Request() req,
    @Body() createUserDto: CreateUniversityUserDto,
  ) {
    return this.adminService.createUniversityUser(
      req.user.organizationId,
      createUserDto,
      req.user.role,
    );
  }

  @Patch("users/:id/sibit-teacher")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Связать учётную запись с преподавателем СИБИТа и синхронизировать его пары" })
  async linkSibitTeacher(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: LinkSibitTeacherDto,
  ) {
    return this.adminService.linkSibitTeacher(req.user.organizationId, id, dto.sourceTeacherId ?? null);
  }

  @Patch("users/:id/status")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Изменить статус учётной записи университета" })
  async updateUserStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() updateUserStatusDto: UpdateUniversityUserStatusDto,
  ) {
    return this.adminService.updateUniversityUserStatus(
      req.user.organizationId,
      id,
      updateUserStatusDto,
      req.user.id,
      req.user.role,
    );
  }

  @Post("users/:id/reset-password")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: "Выдать новый временный пароль пользователю университета",
  })
  async resetUserPassword(
    @Request() req,
    @Param("id") id: string,
    @Body() resetPasswordDto: ResetUniversityUserPasswordDto,
  ) {
    return this.adminService.resetUniversityUserPassword(
      req.user.organizationId,
      id,
      resetPasswordDto,
      req.user.role,
    );
  }

  @Post("schedule/upload")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Загрузить расписание" })
  @ApiResponse({ status: 201, description: "Расписание загружено" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async uploadSchedule(
    @Request() req,
    @Body() importScheduleDto: ImportScheduleDto,
  ) {
    return this.adminService.importSchedule(
      req.user.organizationId,
      importScheduleDto,
    );
  }

  @Get('schedule/imports/:id')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Статус задания импорта расписания своего вуза' })
  getScheduleImport(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleImports.getJob(req.user.organizationId, id);
  }

  @Get('schedule/imports/:id/changes')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Добавления, изменения и отмены в задании импорта' })
  getScheduleImportChanges(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Query() pagination: PaginationQueryDto) {
    return this.scheduleImports.getChanges(req.user.organizationId, id, pagination);
  }

  @Get('import-runs/:id')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Запись импорта: dry-run или применение, хеш файла, порог и результат по строкам (FR-IMP-04/05)' })
  @ApiResponse({ status: 200, description: 'Запись импорта найдена' })
  @ApiResponse({ status: 404, description: 'Запись импорта не найдена' })
  getImportRun(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleImports.getRun(req.user.organizationId, id);
  }

  @Get('import-runs/:id/report')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'CSV-отчёт записи импорта: строки, предупреждения и ошибки (FR-IMP-04)' })
  @ApiResponse({ status: 200, description: 'Отчёт в формате CSV' })
  async getImportRunReport(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const report = await this.scheduleImports.getReport(req.user.organizationId, id);
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report.fileName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(report.csv);
  }

  @Post('import-runs/:id/rollback')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Компенсирующий откат применённого импорта в течение 30 дней (FR-IMP-05)' })
  @ApiResponse({ status: 201, description: 'Откат выполнен: восстановлено занятий и конфликты' })
  @ApiResponse({ status: 400, description: 'Импорт не откатывается (срок, статус или повторный откат)' })
  rollbackImportRun(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleImports.rollback(req.user.organizationId, id);
  }

  @Post("schedule/sync")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Синхронизировать расписание" })
  @ApiResponse({ status: 200, description: "Синхронизация запущена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async syncSchedule(@Request() req) {
    const result = await this.adminService.syncSchedule(req.user.organizationId);
    await this.eventBus.publish({
      type: "sync.completed",
      organizationId: req.user.organizationId,
      actor: { id: req.user.id, type: "user", role: req.user.role },
      target: { type: "schedule", id: req.user.organizationId },
      payload: result,
      priority: "normal",
    });
    return result;
  }

  @Get("schedule/sync-status")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить статус синхронизации" })
  @ApiResponse({ status: 200, description: "Статус получен" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSyncStatus(@Request() req) {
    const university = await this.adminService.getUniversity(
      req.user.organizationId,
    );
    const config = university.connectorConfig || {};
    return {
      lastSync: typeof config.lastSync === "string" ? config.lastSync : null,
      status: typeof config.status === "string" ? config.status : "idle",
    };
  }

  @Get("university")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить информацию об университете" })
  @ApiResponse({ status: 200, description: "Информация получена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getUniversity(@Request() req) {
    return this.adminService.getUniversity(req.user.organizationId);
  }

  @Patch("university")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Обновить информацию об университете" })
  @ApiResponse({ status: 200, description: "Информация обновлена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateUniversity(
    @Request() req,
    @Body() updateUniversityDto: UpdateUniversityDto,
  ) {
    return this.adminService.updateUniversity(
      req.user.organizationId,
      updateUniversityDto,
    );
  }

  @Get("faculties")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить список факультетов" })
  @ApiOkResponse({
    description: "Факультеты получены",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getFaculties(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getFaculties(req.user.organizationId, pagination);
  }

  @Post("faculties")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Создать факультет" })
  @ApiResponse({ status: 201, description: "Факультет создан" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createFaculty(
    @Request() req,
    @Body() createFacultyDto: CreateFacultyDto,
  ) {
    return this.adminService.createFaculty(
      req.user.organizationId,
      createFacultyDto,
    );
  }

  @Patch("faculties/:id")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Обновить факультет" })
  @ApiResponse({ status: 200, description: "Факультет обновлён" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateFaculty(
    @Param("id") id: string,
    @Body() updateFacultyDto: UpdateFacultyDto,
  ) {
    return this.adminService.updateFaculty(id, updateFacultyDto);
  }

  @Get("groups")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить список групп" })
  @ApiOkResponse({ description: "Группы получены", type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getGroups(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getGroups(req.user.organizationId, pagination);
  }

  @Get("attendance-groups")
  @Roles(
    UserRole.TEACHER,
    UserRole.CURATOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.FACULTY_DEAN,
    UserRole.UNIVERSITY_ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: "Получить группы, доступные для посещаемости" })
  async getAttendanceGroups(
    @Request() req,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.adminService.getAttendanceGroups(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      pagination,
    );
  }

  @Get("groups/:id/students")
  @Roles(
    UserRole.TEACHER,
    UserRole.CURATOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.FACULTY_DEAN,
    UserRole.UNIVERSITY_ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: "Получить студентов группы своего университета" })
  @ApiOkResponse({
    description: "Студенты получены",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getGroupStudents(
    @Request() req,
    @Param("id") id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.adminService.getGroupStudents(
      req.user.organizationId,
      id,
      pagination,
      req.user.id,
      req.user.role,
    );
  }

  @Post("groups")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Создать группу" })
  @ApiResponse({ status: 201, description: "Группа создана" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createGroup(@Request() req, @Body() createGroupDto: CreateGroupDto) {
    return this.adminService.createGroup(req.user.organizationId, createGroupDto);
  }

  @Patch("groups/:id")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Обновить группу" })
  @ApiResponse({ status: 200, description: "Группа обновлена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateGroup(
    @Param("id") id: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.adminService.updateGroup(id, updateGroupDto);
  }

  @Get("stats")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить статистику университета" })
  @ApiResponse({ status: 200, description: "Статистика получена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getStats(@Request() req) {
    return this.adminService.getUniversityStats(req.user.organizationId);
  }

  @Get("audit-log")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить журнал критических изменений" })
  @ApiOkResponse({
    description: "Журнал изменений получен",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getAuditLog(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getAuditLog(req.user.organizationId, pagination);
  }

  @Get("connectors")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить коннекторы университета" })
  @ApiOkResponse({
    description: "Коннекторы получены",
    type: PaginatedResponseDto,
  })
  async getConnectors(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getConnectors(req.user.organizationId, pagination);
  }

  @Post("connectors/moodle/configure")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Сохранить защищённые параметры Moodle" })
  async configureMoodleConnector(
    @Request() req,
    @Body() dto: ConfigureMoodleConnectorDto,
  ) {
    return this.adminService.configureMoodleConnector(
      req.user.organizationId,
      dto,
    );
  }

  @Post("connectors/moodle/test")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Проверить подключение Moodle Web Services" })
  async testMoodleConnector(@Request() req) {
    return this.adminService.testMoodleConnector(req.user.organizationId);
  }

  @Patch("connectors/:id")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Обновить коннектор университета" })
  async updateConnector(
    @Request() req,
    @Param("id") id: string,
    @Body() updateConnectorDto: UpdateConnectorDto,
  ) {
    return this.adminService.updateConnector(
      req.user.organizationId,
      id,
      updateConnectorDto,
    );
  }
}
