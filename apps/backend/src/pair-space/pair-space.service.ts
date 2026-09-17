import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    });

    return this.announcementRepository.save(announcement);
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
    });

    return this.homeworkRepository.save(homework);
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

    return this.messageRepository.save(message);
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
    return this.homeworkRepository.save(homework);
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
}
