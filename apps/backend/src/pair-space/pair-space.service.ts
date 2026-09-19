import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { DiscussionMessage } from './entities/discussion-message.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFileDto } from './dto/create-file.dto';
import { TenantContext } from '../common/tenant/tenant-context';
import { EventBusService } from '../events/event-bus.service';
import { Lesson } from '../schedule/entities/lesson.entity';
import { UserRole } from '../auth/interfaces/user-role';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';

const CONTENT_AUTHOR_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.CURATOR,
  UserRole.DEPARTMENT_HEAD,
  UserRole.FACULTY_DEAN,
  UserRole.UNIVERSITY_ADMIN,
  UserRole.SUPERADMIN,
];

@Injectable()
export class PairSpaceService {
  constructor(
    @InjectRepository(PairSpace)
    private readonly pairSpaceRepository: Repository<PairSpace>,
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(Homework)
    private readonly homeworkRepository: Repository<Homework>,
    @InjectRepository(FileAttachment)
    private readonly fileAttachmentRepository: Repository<FileAttachment>,
    @InjectRepository(DiscussionMessage)
    private readonly messageRepository: Repository<DiscussionMessage>,
    @InjectRepository(HomeworkSubmission)
    private readonly submissionRepository: Repository<HomeworkSubmission>,
    private readonly tenantContext: TenantContext,
    @Optional() @InjectRepository(Lesson)
    private readonly lessonRepository?: Repository<Lesson>,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async findById(id: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id },
      relations: ['announcements', 'homeworks', 'files', 'messages'],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace with id ${id} not found`);
    }
    this.tenantContext.assertAccess(pairSpace.universityId);

    return pairSpace;
  }

  async findByLesson(lessonId: string, universityId?: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: universityId ? { lessonId, universityId } : { lessonId },
      relations: ['announcements', 'homeworks', 'files', 'messages'],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace for lesson ${lessonId} not found`);
    }
    this.tenantContext.assertAccess(pairSpace.universityId);

    return pairSpace;
  }

  async createAnnouncement(
    pairSpaceId: string,
    authorId: string,
    createAnnouncementDto: CreateAnnouncementDto,
  ): Promise<Announcement> {
    await this.assertCanPublishContent(pairSpaceId, authorId);
    const announcement = this.announcementRepository.create({
      ...createAnnouncementDto,
      pairSpaceId,
      authorId,
      source: 'manual',
      syncStatus: 'synced',
    });

    const saved = await this.announcementRepository.save(announcement);
    const pairSpace = await this.findById(pairSpaceId);
    await this.eventBus?.publish({
      type: 'announcement.created',
      universityId: pairSpace.universityId,
      actor: this.eventActor(authorId),
      target: { type: 'announcement', id: saved.id },
      payload: {
        pairSpaceId,
        ...(await this.lessonContext(pairSpace)),
        groupName: pairSpace.group ?? null,
        deepLink: `/pair-space/${pairSpaceId}/announcements`,
      },
      priority: 'normal',
    });
    return saved;
  }

  async getAnnouncements(pairSpaceId: string): Promise<Announcement[]> {
    await this.assertPairSpaceAccess(pairSpaceId);
    return this.announcementRepository.find({
      where: { pairSpaceId },
      order: { isPinned: 'DESC', createdAt: 'DESC' },
    });
  }

  async createHomework(
    pairSpaceId: string,
    authorId: string,
    createHomeworkDto: CreateHomeworkDto,
  ): Promise<Homework> {
    await this.assertCanPublishContent(pairSpaceId, authorId);
    const homework = this.homeworkRepository.create({
      ...createHomeworkDto,
      pairSpaceId,
      authorId,
      source: 'manual',
      syncStatus: 'synced',
    });

    const saved = await this.homeworkRepository.save(homework);
    const pairSpace = await this.findById(pairSpaceId);
    await this.eventBus?.publish({
      type: 'homework.created',
      universityId: pairSpace.universityId,
      actor: this.eventActor(authorId),
      target: { type: 'homework', id: saved.id },
      payload: {
        pairSpaceId,
        ...(await this.lessonContext(pairSpace)),
        groupName: pairSpace.group ?? null,
        deadline: saved.deadline?.toISOString() ?? null,
        deepLink: `/pair-space/${pairSpaceId}/homeworks/${saved.id}`,
      },
      priority: 'normal',
    });
    return saved;
  }

  async getHomeworks(pairSpaceId: string): Promise<Homework[]> {
    await this.assertPairSpaceAccess(pairSpaceId);
    return this.homeworkRepository.find({
      where: { pairSpaceId },
      order: { deadline: 'ASC' },
    });
  }

  async uploadFile(
    pairSpaceId: string,
    uploadedBy: string,
    fileData: CreateFileDto,
  ): Promise<FileAttachment> {
    await this.assertCanPublishContent(pairSpaceId, uploadedBy);
    const file = this.fileAttachmentRepository.create({
      pairSpaceId,
      uploadedBy,
      fileUrl: fileData.fileUrl,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      size: fileData.size,
    });

    return this.fileAttachmentRepository.save(file);
  }

  async getMessages(
    pairSpaceId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<DiscussionMessage>> {
    await this.assertPairSpaceAccess(pairSpaceId);
    const [data, total] = await this.messageRepository.findAndCount({
      where: { pairSpaceId },
      order: { createdAt: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createMessage(
    pairSpaceId: string,
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<DiscussionMessage> {
    await this.assertPairSpaceAccess(pairSpaceId);
    const message = this.messageRepository.create({
      pairSpaceId,
      userId,
      text: createMessageDto.text,
      parentId: createMessageDto.parentId,
    });

    const saved = await this.messageRepository.save(message);
    const pairSpace = await this.findById(pairSpaceId);
    await this.eventBus?.publish({
      type: 'message.created',
      universityId: pairSpace.universityId,
      actor: this.eventActor(userId),
      target: { type: 'message', id: saved.id },
      payload: {
        pairSpaceId,
        ...(await this.lessonContext(pairSpace)),
        groupName: pairSpace.group ?? null,
        deepLink: `/pair-space/${pairSpaceId}/discussion`,
      },
      priority: 'normal',
    });
    return saved;
  }

  async submitHomework(
    homeworkId: string,
    studentId: string,
    submitHomeworkDto: SubmitHomeworkDto,
  ): Promise<HomeworkSubmission> {
    const homework = await this.homeworkRepository.findOne({
      where: { id: homeworkId },
      relations: ['pairSpace'],
    });
    if (!homework) {
      throw new NotFoundException(`Homework with id ${homeworkId} not found`);
    }
    this.tenantContext.assertAccess(homework.pairSpace.universityId);

    const existing = await this.submissionRepository.findOne({
      where: { homeworkId, studentId },
    });

    if (existing) {
      existing.status = 'submitted';
      existing.submittedAt = new Date();
      if (submitHomeworkDto.fileUrl) {
        existing.fileUrl = submitHomeworkDto.fileUrl;
      }
      if (submitHomeworkDto.comment) {
        existing.comment = submitHomeworkDto.comment;
      }
      return this.submissionRepository.save(existing);
    }

    const submission = this.submissionRepository.create({
      homeworkId,
      studentId,
      status: 'submitted',
      submittedAt: new Date(),
      fileUrl: submitHomeworkDto.fileUrl,
      comment: submitHomeworkDto.comment,
    });

    return this.submissionRepository.save(submission);
  }

  async completeHomework(homeworkId: string): Promise<Homework> {
    const homework = await this.homeworkRepository.findOne({
      where: { id: homeworkId },
      relations: ['pairSpace'],
    });

    if (!homework) {
      throw new NotFoundException(`Homework with id ${homeworkId} not found`);
    }
    this.tenantContext.assertAccess(homework.pairSpace.universityId);

    homework.isCompleted = true;
    const saved = await this.homeworkRepository.save(homework);
    await this.eventBus?.publish({
      type: 'homework.updated',
      universityId: homework.pairSpace.universityId,
      actor: this.eventActor(),
      target: { type: 'homework', id: saved.id },
      payload: {
        pairSpaceId: homework.pairSpaceId,
        ...(await this.lessonContext(homework.pairSpace)),
        deepLink: `/pair-space/${homework.pairSpaceId}/homeworks/${saved.id}`,
      },
      priority: 'normal',
    });
    return saved;
  }

  private async assertPairSpaceAccess(pairSpaceId: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({ where: { id: pairSpaceId } });
    if (!pairSpace) {
      throw new NotFoundException(`PairSpace with id ${pairSpaceId} not found`);
    }
    this.tenantContext.assertAccess(pairSpace.universityId);
    return pairSpace;
  }

  private async assertCanPublishContent(pairSpaceId: string, actorId: string): Promise<PairSpace> {
    const user = this.tenantContext.getUser();
    if (!user || !CONTENT_AUTHOR_ROLES.includes(user.role)) {
      throw new ForbiddenException('Staff role required to publish pair space content');
    }
    if (user.id !== actorId) {
      throw new ForbiddenException('Users can only publish pair space content as themselves');
    }
    return this.assertPairSpaceAccess(pairSpaceId);
  }

  private eventActor(id?: string) {
    const user = this.tenantContext.getUser();
    return user ? { id: user.id, type: 'user' as const, role: user.role } : id ? { id, type: 'user' as const } : { type: 'system' as const };
  }

  private async lessonContext(pairSpace: PairSpace): Promise<{ groupId?: string; teacherId?: string }> {
    if (!this.lessonRepository) return {};
    const lesson = await this.lessonRepository.findOne({ where: { id: pairSpace.lessonId } });
    return lesson ? { groupId: lesson.groupId, teacherId: lesson.teacherId } : {};
  }
}
