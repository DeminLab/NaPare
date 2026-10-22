import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
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
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить пользователей университета" })
  @ApiOkResponse({
    description: "Пользователи получены",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getUsers(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getUniversityUsers(
      req.user.universityId,
      pagination,
      req.user.role,
    );
  }

  @Get("sibit/teachers")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить преподавателей и расписание из каталога СИБИТа" })
  async getSibitTeachers(@Request() req) {
    return this.adminService.getSibitTeachers(req.user.universityId);
  }

  @Patch("users/:id/roles")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Изменить роль пользователя" })
  @ApiResponse({ status: 200, description: "Роль обновлена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateUserRole(
    @Request() req,
    @Param("id") id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(
      req.user.universityId,
      id,
      updateUserRoleDto,
      req.user.role,
    );
  }

  @Post("users")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Создать учётную запись в своём университете" })
  async createUser(
    @Request() req,
    @Body() createUserDto: CreateUniversityUserDto,
  ) {
    return this.adminService.createUniversityUser(
      req.user.universityId,
      createUserDto,
      req.user.role,
    );
  }

  @Patch("users/:id/sibit-teacher")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Связать учётную запись с преподавателем СИБИТа и синхронизировать его пары" })
  async linkSibitTeacher(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: LinkSibitTeacherDto,
  ) {
    return this.adminService.linkSibitTeacher(req.user.universityId, id, dto.sourceTeacherId ?? null);
  }

  @Patch("users/:id/status")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Изменить статус учётной записи университета" })
  async updateUserStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() updateUserStatusDto: UpdateUniversityUserStatusDto,
  ) {
    return this.adminService.updateUniversityUserStatus(
      req.user.universityId,
      id,
      updateUserStatusDto,
      req.user.id,
      req.user.role,
    );
  }

  @Post("users/:id/reset-password")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: "Выдать новый временный пароль пользователю университета",
  })
  async resetUserPassword(
    @Request() req,
    @Param("id") id: string,
    @Body() resetPasswordDto: ResetUniversityUserPasswordDto,
  ) {
    return this.adminService.resetUniversityUserPassword(
      req.user.universityId,
      id,
      resetPasswordDto,
      req.user.role,
    );
  }

  @Post("schedule/upload")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Загрузить расписание" })
  @ApiResponse({ status: 201, description: "Расписание загружено" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async uploadSchedule(
    @Request() req,
    @Body() importScheduleDto: ImportScheduleDto,
  ) {
    return this.adminService.importSchedule(
      req.user.universityId,
      importScheduleDto,
    );
  }

  @Get('schedule/imports/:id')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Статус задания импорта расписания своего вуза' })
  getScheduleImport(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleImports.getJob(req.user.universityId, id);
  }

  @Get('schedule/imports/:id/changes')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Добавления, изменения и отмены в задании импорта' })
  getScheduleImportChanges(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Query() pagination: PaginationQueryDto) {
    return this.scheduleImports.getChanges(req.user.universityId, id, pagination);
  }

  @Post("schedule/sync")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Синхронизировать расписание" })
  @ApiResponse({ status: 200, description: "Синхронизация запущена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async syncSchedule(@Request() req) {
    const result = await this.adminService.syncSchedule(req.user.universityId);
    await this.eventBus.publish({
      type: "sync.completed",
      universityId: req.user.universityId,
      actor: { id: req.user.id, type: "user", role: req.user.role },
      target: { type: "schedule", id: req.user.universityId },
      payload: result,
      priority: "normal",
    });
    return result;
  }

  @Get("schedule/sync-status")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить статус синхронизации" })
  @ApiResponse({ status: 200, description: "Статус получен" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSyncStatus(@Request() req) {
    const university = await this.adminService.getUniversity(
      req.user.universityId,
    );
    const config = university.connectorConfig || {};
    return {
      lastSync: typeof config.lastSync === "string" ? config.lastSync : null,
      status: typeof config.status === "string" ? config.status : "idle",
    };
  }

  @Get("university")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить информацию об университете" })
  @ApiResponse({ status: 200, description: "Информация получена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getUniversity(@Request() req) {
    return this.adminService.getUniversity(req.user.universityId);
  }

  @Patch("university")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Обновить информацию об университете" })
  @ApiResponse({ status: 200, description: "Информация обновлена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateUniversity(
    @Request() req,
    @Body() updateUniversityDto: UpdateUniversityDto,
  ) {
    return this.adminService.updateUniversity(
      req.user.universityId,
      updateUniversityDto,
    );
  }

  @Get("faculties")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить список факультетов" })
  @ApiOkResponse({
    description: "Факультеты получены",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getFaculties(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getFaculties(req.user.universityId, pagination);
  }

  @Post("faculties")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Создать факультет" })
  @ApiResponse({ status: 201, description: "Факультет создан" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createFaculty(
    @Request() req,
    @Body() createFacultyDto: CreateFacultyDto,
  ) {
    return this.adminService.createFaculty(
      req.user.universityId,
      createFacultyDto,
    );
  }

  @Patch("faculties/:id")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
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
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить список групп" })
  @ApiOkResponse({ description: "Группы получены", type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getGroups(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getGroups(req.user.universityId, pagination);
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
      req.user.universityId,
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
      req.user.universityId,
      id,
      pagination,
      req.user.id,
      req.user.role,
    );
  }

  @Post("groups")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Создать группу" })
  @ApiResponse({ status: 201, description: "Группа создана" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createGroup(@Request() req, @Body() createGroupDto: CreateGroupDto) {
    return this.adminService.createGroup(req.user.universityId, createGroupDto);
  }

  @Patch("groups/:id")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
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
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить статистику университета" })
  @ApiResponse({ status: 200, description: "Статистика получена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getStats(@Request() req) {
    return this.adminService.getUniversityStats(req.user.universityId);
  }

  @Get("audit-log")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить журнал критических изменений" })
  @ApiOkResponse({
    description: "Журнал изменений получен",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getAuditLog(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getAuditLog(req.user.universityId, pagination);
  }

  @Get("connectors")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить коннекторы университета" })
  @ApiOkResponse({
    description: "Коннекторы получены",
    type: PaginatedResponseDto,
  })
  async getConnectors(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.adminService.getConnectors(req.user.universityId, pagination);
  }

  @Post("connectors/moodle/configure")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Сохранить защищённые параметры Moodle" })
  async configureMoodleConnector(
    @Request() req,
    @Body() dto: ConfigureMoodleConnectorDto,
  ) {
    return this.adminService.configureMoodleConnector(
      req.user.universityId,
      dto,
    );
  }

  @Post("connectors/moodle/test")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Проверить подключение Moodle Web Services" })
  async testMoodleConnector(@Request() req) {
    return this.adminService.testMoodleConnector(req.user.universityId);
  }

  @Patch("connectors/:id")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Обновить коннектор университета" })
  async updateConnector(
    @Request() req,
    @Param("id") id: string,
    @Body() updateConnectorDto: UpdateConnectorDto,
  ) {
    return this.adminService.updateConnector(
      req.user.universityId,
      id,
      updateConnectorDto,
    );
  }
}
