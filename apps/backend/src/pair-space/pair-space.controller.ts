import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";

import { PairSpaceService } from "./pair-space.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { CreateHomeworkDto } from "./dto/create-homework.dto";
import { SubmitHomeworkDto } from "./dto/submit-homework.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { CreateFileDto } from "./dto/create-file.dto";
import { UpsertPersonalNoteDto } from "./dto/upsert-personal-note.dto";
import { UpdateHomeworkProgressDto } from "./dto/update-homework-progress.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/interfaces/user-role";
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from "../common/dto/pagination-query.dto";

@ApiTags("pair-spaces")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("pair-spaces")
export class PairSpaceController {
  constructor(private readonly pairSpaceService: PairSpaceService) {}

  @Get("groups/:groupId")
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: "Получить существующие пространства пары группы без создания новых" })
  @ApiOkResponse({ type: PaginatedResponseDto, description: "Пространства группы получены" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Group not found in this university" })
  async listExistingForGroup(
    @Param("groupId") groupId: string,
    @Request() req,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.pairSpaceService.listExistingForGroup(
      groupId,
      req.user.universityId,
      pagination,
    );
  }

  @Get(":lessonId")
  @ApiOperation({ summary: "Получить PairSpace по уроку" })
  @ApiResponse({ status: 200, description: "PairSpace найден" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Not found" })
  async findByLesson(@Param("lessonId") lessonId: string, @Request() req) {
    return this.pairSpaceService.getOrCreateByLesson(
      lessonId,
      req.user.universityId,
    );
  }

  @Get(":lessonId/timeline")
  @ApiOperation({ summary: "Получить историю предмета в доступном scope" })
  @ApiOkResponse({ type: PaginatedResponseDto, description: "Хронология занятий и материалов получена" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getSubjectTimeline(@Param("lessonId") lessonId: string, @Request() req) {
    return this.pairSpaceService.getSubjectTimeline(
      lessonId,
      req.user.universityId,
    );
  }

  @Post(":lessonId/announcements")
  @Roles(
    UserRole.TEACHER,
    UserRole.CURATOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.FACULTY_DEAN,
    UserRole.UNIVERSITY_ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: "Создать объявление" })
  @ApiResponse({ status: 201, description: "Объявление создано" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createAnnouncement(
    @Param("lessonId") lessonId: string,
    @Request() req,
    @Body() createAnnouncementDto: CreateAnnouncementDto,
  ) {
    const pairSpace = await this.pairSpaceService.getOrCreateByLesson(
      lessonId,
      req.user.universityId,
    );
    return this.pairSpaceService.createAnnouncement(
      pairSpace.id,
      req.user.id,
      createAnnouncementDto,
    );
  }

  @Post(":lessonId/homeworks")
  @Roles(
    UserRole.TEACHER,
    UserRole.CURATOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.FACULTY_DEAN,
    UserRole.UNIVERSITY_ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: "Создать домашнее задание" })
  @ApiResponse({ status: 201, description: "Домашнее задание создано" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createHomework(
    @Param("lessonId") lessonId: string,
    @Request() req,
    @Body() createHomeworkDto: CreateHomeworkDto,
  ) {
    const pairSpace = await this.pairSpaceService.getOrCreateByLesson(
      lessonId,
      req.user.universityId,
    );
    return this.pairSpaceService.createHomework(
      pairSpace.id,
      req.user.id,
      createHomeworkDto,
    );
  }

  @Post(":lessonId/files")
  @Roles(
    UserRole.TEACHER,
    UserRole.CURATOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.FACULTY_DEAN,
    UserRole.UNIVERSITY_ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: "Загрузить файл" })
  @ApiResponse({ status: 201, description: "Файл загружен" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async uploadFile(
    @Param("lessonId") lessonId: string,
    @Request() req,
    @Body() createFileDto: CreateFileDto,
  ) {
    const pairSpace = await this.pairSpaceService.getOrCreateByLesson(
      lessonId,
      req.user.universityId,
    );
    return this.pairSpaceService.uploadFile(
      pairSpace.id,
      req.user.id,
      createFileDto,
    );
  }

  @Get(":lessonId/messages")
  @ApiOperation({ summary: "Получить сообщения обсуждения" })
  @ApiOkResponse({
    description: "Сообщения получены",
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getMessages(
    @Param("lessonId") lessonId: string,
    @Request() req,
    @Query() pagination: PaginationQueryDto,
  ) {
    const pairSpace = await this.pairSpaceService.getOrCreateByLesson(
      lessonId,
      req.user.universityId,
    );
    return this.pairSpaceService.getMessages(pairSpace.id, pagination);
  }

  @Get(":lessonId/personal-note")
  @ApiOperation({ summary: "Получить личную заметку к занятию" })
  async getPersonalNote(@Param("lessonId") lessonId: string, @Request() req) {
    return this.pairSpaceService.getPersonalNote(lessonId, req.user.universityId);
  }

  @Put(":lessonId/personal-note")
  @ApiOperation({ summary: "Сохранить личную заметку к занятию" })
  async savePersonalNote(
    @Param("lessonId") lessonId: string,
    @Request() req,
    @Body() dto: UpsertPersonalNoteDto,
  ) {
    return this.pairSpaceService.savePersonalNote(lessonId, req.user.universityId, dto);
  }

  @Post(":lessonId/messages")
  @ApiOperation({ summary: "Отправить сообщение" })
  @ApiResponse({ status: 201, description: "Сообщение отправлено" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createMessage(
    @Param("lessonId") lessonId: string,
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const pairSpace = await this.pairSpaceService.getOrCreateByLesson(
      lessonId,
      req.user.universityId,
    );
    return this.pairSpaceService.createMessage(
      pairSpace.id,
      req.user.id,
      createMessageDto,
    );
  }

  @Patch("homeworks/:id/submit")
  @ApiOperation({ summary: "Сдать домашнее задание" })
  @ApiResponse({ status: 200, description: "Домашнее задание сдано" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async submitHomework(
    @Param("id") id: string,
    @Request() req,
    @Body() submitHomeworkDto: SubmitHomeworkDto,
  ) {
    return this.pairSpaceService.submitHomework(
      id,
      req.user.id,
      submitHomeworkDto,
    );
  }

  @Patch("homeworks/:id/progress")
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "Обновить личный статус подготовки к занятию" })
  @ApiResponse({ status: 200, description: "Личный статус подготовки сохранён; статус сдачи в LMS не меняется" })
  @ApiResponse({ status: 403, description: "Подготовка не относится к доступной группе пользователя" })
  async updateHomeworkProgress(
    @Param("id") id: string,
    @Request() req,
    @Body() dto: UpdateHomeworkProgressDto,
  ) {
    return this.pairSpaceService.updateHomeworkProgress(id, req.user.id, dto);
  }
}
