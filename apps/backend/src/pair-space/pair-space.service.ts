import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';

@Injectable()
export class PairSpaceService {
  constructor(
    @InjectRepository(PairSpace)
    private readonly pairSpaceRepository: Repository<PairSpace>,
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(Homework)
    private readonly homeworkRepository: Repository<Homework>,
  ) {}

  async findById(id: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id },
      relations: ['announcements', 'homeworks'],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace with id ${id} not found`);
    }

    return pairSpace;
  }

  async findByLesson(lessonId: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { lessonId },
      relations: ['announcements', 'homeworks'],
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
    const pairSpace = await this.findById(pairSpaceId);

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
