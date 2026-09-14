import { Test, TestingModule } from '@nestjs/testing';
import { PairSpaceService } from './pair-space.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { DiscussionMessage } from './entities/discussion-message.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';
import { NotFoundException } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant-context';

describe('PairSpaceService', () => {
  let service: PairSpaceService;

  const mockRepo = (name: string) => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => ({ id: '1', ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PairSpaceService,
        { provide: getRepositoryToken(PairSpace), useValue: mockRepo('PairSpace') },
        { provide: getRepositoryToken(Announcement), useValue: mockRepo('Announcement') },
        { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
        { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
        { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
        { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
        { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<PairSpaceService>(PairSpaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByLesson', () => {
    it('should throw NotFoundException if not found', async () => {
      await expect(service.findByLesson('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAnnouncement', () => {
    it('should create announcement', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1' }) };
      const announcementRepo = { create: jest.fn().mockImplementation((dto) => ({ id: 'a1', ...dto })), save: jest.fn().mockImplementation((e) => Promise.resolve(e)) };

      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          { provide: getRepositoryToken(Announcement), useValue: announcementRepo },
          { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn() } },
        ],
      }).compile();

      const svc = module2.get<PairSpaceService>(PairSpaceService);
      const result = await svc.createAnnouncement('ps-1', 'author-1', { text: 'Hello' } as any);
      expect(result.text).toBe('Hello');
    });
  });
});
