# Backend Module: PairSpace — Детальная реализация

## Структура модуля

```
apps/backend/src/pair-space/
├── pair-space.module.ts
├── pair-space.controller.ts
├── pair-space.service.ts
├── entities/
│   ├── pair-space.entity.ts
│   ├── announcement.entity.ts
│   ├── homework.entity.ts
│   ├── homework-submission.entity.ts
│   ├── file-attachment.entity.ts
│   └── discussion-message.entity.ts
└── dto/
    ├── create-announcement.dto.ts
    ├── create-homework.dto.ts
    ├── submit-homework.dto.ts
    ├── create-message.dto.ts
    └── file-upload.dto.ts
```

## pair-space.service.ts

```typescript
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { DiscussionMessage } from './entities/discussion-message.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AnnouncementCreatedEvent } from '../notifications/events/announcement-created.event';
import { HomeworkCreatedEvent } from '../notifications/events/homework-created.event';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PairSpaceService {
  constructor(
    @InjectRepository(PairSpace)
    private readonly pairSpaceRepository: Repository<PairSpace>,
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(Homework)
    private readonly homeworkRepository: Repository<Homework>,
    @InjectRepository(HomeworkSubmission)
    private readonly submissionRepository: Repository<HomeworkSubmission>,
    @InjectRepository(FileAttachment)
    private readonly fileRepository: Repository<FileAttachment>,
    @InjectRepository(DiscussionMessage)
    private readonly messageRepository: Repository<DiscussionMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getByLessonId(lessonId: string, userId: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { lessonId },
      relations: [
        'lesson', 'lesson.group', 'lesson.teacher',
        'announcements', 'announcements.author',
        'homeworks', 'homeworks.author', 'homeworks.submissions',
        'files', 'files.uploader',
        'messages', 'messages.user',
      ],
    });

    if (!pairSpace) {
      throw new NotFoundException('Пространство пары не найдено');
    }

    await this.checkAccess(pairSpace, userId);
    return pairSpace;
  }

  private async checkAccess(pairSpace: PairSpace, userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Пользователь не найден');

    if (user.roles.includes('student') && pairSpace.lesson.groupId !== user.groupId) {
      throw new ForbiddenException('Нет доступа к этому пространству');
    }

    if (user.roles.includes('teacher') && pairSpace.lesson.teacherId !== userId) {
      throw new ForbiddenException('Нет доступа к этому пространству');
    }
  }

  async createAnnouncement(pairSpaceId: string, userId: string, dto: CreateAnnouncementDto): Promise<Announcement> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id: pairSpaceId }, relations: ['lesson'],
    });
    if (!pairSpace) throw new NotFoundException('Пространство пары не найдено');
    await this.checkTeacherAccess(pairSpace.lesson.teacherId, userId);

    const announcement = this.announcementRepository.create({
      pairSpaceId, authorId: userId, text: dto.text, isPinned: dto.isPinned || false,
    });
    const saved = await this.announcementRepository.save(announcement);

    this.eventEmitter.emit('announcement.created', new AnnouncementCreatedEvent(
      pairSpaceId, pairSpace.lesson.groupId, pairSpace.lesson.subject,
    ));

    return saved;
  }

  async createHomework(pairSpaceId: string, userId: string, dto: CreateHomeworkDto): Promise<Homework> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id: pairSpaceId }, relations: ['lesson'],
    });
    if (!pairSpace) throw new NotFoundException('Пространство пары не найдено');
    await this.checkTeacherAccess(pairSpace.lesson.teacherId, userId);

    const homework = this.homeworkRepository.create({
      pairSpaceId, title: dto.title, description: dto.description,
      deadline: dto.deadline ? new Date(dto.deadline) : null, createdBy: userId,
    });
    const saved = await this.homeworkRepository.save(homework);

    this.eventEmitter.emit('homework.created', new HomeworkCreatedEvent(
      pairSpaceId, pairSpace.lesson.groupId, pairSpace.lesson.subject, dto.title,
    ));

    return saved;
  }

  async submitHomework(homeworkId: string, studentId: string): Promise<HomeworkSubmission> {
    const homework = await this.homeworkRepository.findOne({ where: { id: homeworkId } });
    if (!homework) throw new NotFoundException('Домашнее задание не найдено');

    if (homework.deadline && new Date(homework.deadline) < new Date()) {
      throw new BadRequestException('Дедлайн истёк');
    }

    let submission = await this.submissionRepository.findOne({
      where: { homeworkId, studentId },
    });

    if (submission) {
      submission.status = 'submitted';
      submission.submittedAt = new Date();
    } else {
      submission = this.submissionRepository.create({
        homeworkId, studentId, status: 'submitted', submittedAt: new Date(),
      });
    }

    return this.submissionRepository.save(submission);
  }

  async uploadFile(pairSpaceId: string, userId: string, file: Express.Multer.File): Promise<FileAttachment> {
    const pairSpace = await this.pairSpaceRepository.findOne({ where: { id: pairSpaceId } });
    if (!pairSpace) throw new NotFoundException('Пространство пары не найдено');

    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Файл слишком большой (максимум 50 МБ)');
    }

    const fileUrl = `https://storage.napare.ru/files/${pairSpaceId}/${file.originalname}`;

    const fileAttachment = this.fileRepository.create({
      pairSpaceId, fileUrl, fileName: file.originalname,
      fileType: file.mimetype, fileSize: file.size, uploadedBy: userId,
    });

    return this.fileRepository.save(fileAttachment);
  }

  async createMessage(pairSpaceId: string, userId: string, dto: CreateMessageDto): Promise<DiscussionMessage> {
    const pairSpace = await this.pairSpaceRepository.findOne({ where: { id: pairSpaceId } });
    if (!pairSpace) throw new NotFoundException('Пространство пары не найдено');

    if (dto.parentId) {
      const parent = await this.messageRepository.findOne({
        where: { id: dto.parentId, pairSpaceId },
      });
      if (!parent) throw new NotFoundException('Родительское сообщение не найдено');
    }

    const message = this.messageRepository.create({
      pairSpaceId, userId, text: dto.text, parentId: dto.parentId,
    });

    return this.messageRepository.save(message);
  }

  private async checkTeacherAccess(lessonTeacherId: string, userId: string): Promise<void> {
    if (lessonTeacherId !== userId) {
      throw new ForbiddenException('Только преподаватель может выполнять это действие');
    }
  }
}
```

## pair-space.controller.ts

```typescript
import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, UseInterceptors, UploadedFile, ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';

import { PairSpaceService } from './pair-space.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Pair Space')
@Controller('api/v1/pair-spaces')
@UseGuards(JwtAuthGuard)
export class PairSpaceController {
  constructor(private readonly pairSpaceService: PairSpaceService) {}

  @Get(':lessonId')
  @ApiOperation({ summary: 'Получить пространство пары' })
  async getByLessonId(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: any,
  ) {
    return this.pairSpaceService.getByLessonId(lessonId, user.userId);
  }

  @Post(':lessonId/announcements')
  @ApiOperation({ summary: 'Создать объявление' })
  async createAnnouncement(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: any,
  ) {
    const pairSpace = await this.pairSpaceService.getByLessonId(lessonId, user.userId);
    return this.pairSpaceService.createAnnouncement(pairSpace.id, user.userId, dto);
  }

  @Post(':lessonId/homeworks')
  @ApiOperation({ summary: 'Создать домашнее задание' })
  async createHomework(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateHomeworkDto,
    @CurrentUser() user: any,
  ) {
    const pairSpace = await this.pairSpaceService.getByLessonId(lessonId, user.userId);
    return this.pairSpaceService.createHomework(pairSpace.id, user.userId, dto);
  }

  @Patch('homeworks/:homeworkId/submit')
  @ApiOperation({ summary: 'Отметить сдачу ДЗ' })
  async submitHomework(
    @Param('homeworkId', ParseUUIDPipe) homeworkId: string,
    @CurrentUser() user: any,
  ) {
    return this.pairSpaceService.submitHomework(homeworkId, user.userId);
  }

  @Post(':lessonId/files')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Загрузить файл' })
  @ApiConsumes('multipart/form-data')
  async uploadFile(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const pairSpace = await this.pairSpaceService.getByLessonId(lessonId, user.userId);
    return this.pairSpaceService.uploadFile(pairSpace.id, user.userId, file);
  }

  @Get(':lessonId/messages')
  @ApiOperation({ summary: 'Получить сообщения обсуждения' })
  async getMessages(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: any,
  ) {
    const pairSpace = await this.pairSpaceService.getByLessonId(lessonId, user.userId);
    return pairSpace.messages;
  }

  @Post(':lessonId/messages')
  @ApiOperation({ summary: 'Написать сообщение' })
  async createMessage(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: any,
  ) {
    const pairSpace = await this.pairSpaceService.getByLessonId(lessonId, user.userId);
    return this.pairSpaceService.createMessage(pairSpace.id, user.userId, dto);
  }
}
```

## DTO

```typescript
// dto/create-announcement.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Важное объявление по лабораторной' })
  @IsString()
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isPinned?: boolean;
}

// dto/create-homework.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsDateString } from 'class-validator';

export class CreateHomeworkDto {
  @ApiProperty({ example: 'Лабораторная работа №3' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Выполнить задания 1-5 из методички' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-09-15T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

// dto/create-message.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Когда будет следующая лабораторная?' })
  @IsString()
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
```
