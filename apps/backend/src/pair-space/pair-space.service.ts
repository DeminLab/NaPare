import { Injectable, NotFoundException } from '@nestjs/common';
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
  ) {}

  async findById(id: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id },
      relations: ['announcements', 'homeworks', 'files', 'messages'],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace with id ${id} not found`);
    }

    return pairSpace;
  }

  async findByLesson(lessonId: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { lessonId },
      relations: ['announcements', 'homeworks', 'files', 'messages'],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace for lesson ${lessonId} not found`);
    }

    return pairSpace;
  }

  async createAnnouncement(
    pairSpaceId: string,
    authorId: string,
    createAnnouncementDto: CreateAnnouncementDto,
  ): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      ...createAnnouncementDto,
      pairSpaceId,
      authorId,
    });

    return this.announcementRepository.save(announcement);
  }

  async getAnnouncements(pairSpaceId: string): Promise<Announcement[]> {
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
    const homework = this.homeworkRepository.create({
      ...createHomeworkDto,
      pairSpaceId,
      authorId,
    });

    return this.homeworkRepository.save(homework);
  }

  async getHomeworks(pairSpaceId: string): Promise<Homework[]> {
    return this.homeworkRepository.find({
      where: { pairSpaceId },
      order: { deadline: 'ASC' },
    });
  }

  async uploadFile(
    pairSpaceId: string,
    uploadedBy: string,
    fileData: any,
  ): Promise<FileAttachment> {
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

  async getMessages(pairSpaceId: string): Promise<DiscussionMessage[]> {
    return this.messageRepository.find({
      where: { pairSpaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async createMessage(
    pairSpaceId: string,
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<DiscussionMessage> {
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
    });

    if (!homework) {
      throw new NotFoundException(`Homework with id ${homeworkId} not found`);
    }

    homework.isCompleted = true;
    return this.homeworkRepository.save(homework);
  }
}
