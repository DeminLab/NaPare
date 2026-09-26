import { Test, TestingModule } from '@nestjs/testing';
import { PairSpaceService } from './pair-space.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { DiscussionMessage } from './entities/discussion-message.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import { EventBusService } from '../events/event-bus.service';
import { Lesson } from '../schedule/entities/lesson.entity';

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

    it('does not expose a different group\'s pair space to a student', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1', universityId: 'uni-1', lessonId: 'lesson-1' }) };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', groupId: 'group-2' }) };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          { provide: getRepositoryToken(Announcement), useValue: mockRepo('Announcement') },
          { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn().mockReturnValue({ id: 'student-1', role: UserRole.STUDENT, universityId: 'uni-1', groupId: 'group-1' }) } },
        ],
      }).compile();

      await expect(module2.get<PairSpaceService>(PairSpaceService).findByLesson('lesson-1', 'uni-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createAnnouncement', () => {
    it('rejects a student even when the pair space belongs to their university', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1', universityId: 'uni-1' }) };
      const announcementRepo = { create: jest.fn(), save: jest.fn() };

      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          { provide: getRepositoryToken(Announcement), useValue: announcementRepo },
          { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({ id: 'student-1', role: UserRole.STUDENT, universityId: 'uni-1' }),
            },
          },
        ],
      }).compile();

      const svc = module2.get<PairSpaceService>(PairSpaceService);
      await expect(svc.createAnnouncement('ps-1', 'student-1', { text: 'Hello' } as any))
        .rejects.toThrow(ForbiddenException);
      expect(announcementRepo.create).not.toHaveBeenCalled();
    });

    it('should create announcement', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1', lessonId: 'lesson-1', universityId: 'uni-1' }) };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', teacherId: 'author-1' }) };
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
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({ id: 'author-1', role: UserRole.TEACHER, universityId: 'uni-1' }),
            },
          },
        ],
      }).compile();

      const svc = module2.get<PairSpaceService>(PairSpaceService);
      const result = await svc.createAnnouncement('ps-1', 'author-1', { text: 'Hello' } as any);
      expect(result.text).toBe('Hello');
    });

    it('rejects a teacher publishing in another teacher\'s lesson space', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1', lessonId: 'lesson-1', universityId: 'uni-1' }) };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const announcementRepo = { create: jest.fn(), save: jest.fn() };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          { provide: getRepositoryToken(Announcement), useValue: announcementRepo },
          { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn().mockReturnValue({ id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1' }) } },
        ],
      }).compile();

      await expect(module2.get<PairSpaceService>(PairSpaceService).createAnnouncement('ps-1', 'teacher-1', { text: 'Чужая группа' }))
        .rejects.toThrow(ForbiddenException);
      expect(announcementRepo.create).not.toHaveBeenCalled();
    });

    it('publishes a notification link using the lesson route, not the internal pair-space id', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1', universityId: 'uni-1', lessonId: 'lesson-1' }) };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue({ id: 'lesson-1', universityId: 'uni-1', teacherId: 'author-1', groupId: 'group-1' }) };
      const announcementRepo = { create: jest.fn().mockImplementation((dto) => ({ id: 'a1', ...dto })), save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)) };
      const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          { provide: getRepositoryToken(Announcement), useValue: announcementRepo },
          { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn().mockReturnValue({ id: 'author-1', role: UserRole.TEACHER, universityId: 'uni-1' }) } },
          { provide: EventBusService, useValue: eventBus },
        ],
      }).compile();

      await module2.get<PairSpaceService>(PairSpaceService).createAnnouncement('ps-1', 'author-1', { text: 'Hello' } as any);

      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ deepLink: '/pair-space/lesson-1' }),
      }));
    });
  });

  describe('submitHomework', () => {
    it('rejects a staff account attempting to submit a student homework item', async () => {
      const homeworkRepo = { findOne: jest.fn().mockResolvedValue({ id: 'homework-1', pairSpace: { id: 'ps-1', universityId: 'uni-1', lessonId: 'lesson-1' } }) };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: mockRepo('PairSpace') },
          { provide: getRepositoryToken(Announcement), useValue: mockRepo('Announcement') },
          { provide: getRepositoryToken(Homework), useValue: homeworkRepo },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo('DiscussionMessage') },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn().mockReturnValue({ id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1' }) } },
        ],
      }).compile();

      await expect(module2.get<PairSpaceService>(PairSpaceService).submitHomework('homework-1', 'teacher-1', {})).rejects.toThrow(ForbiddenException);
    });

  });

  describe('createMessage', () => {
    it('rejects a teacher message in a colleague\'s lesson space', async () => {
      const pairSpaceRepo = { findOne: jest.fn().mockResolvedValue({ id: 'ps-1', lessonId: 'lesson-1', universityId: 'uni-1' }) };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const messageRepo = { create: jest.fn(), save: jest.fn() };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          { provide: getRepositoryToken(Announcement), useValue: mockRepo('Announcement') },
          { provide: getRepositoryToken(Homework), useValue: mockRepo('Homework') },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo('FileAttachment') },
          { provide: getRepositoryToken(DiscussionMessage), useValue: messageRepo },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo('HomeworkSubmission') },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          { provide: TenantContext, useValue: { assertAccess: jest.fn(), getUser: jest.fn().mockReturnValue({ id: 'teacher-1', role: UserRole.TEACHER, universityId: 'uni-1' }) } },
        ],
      }).compile();

      await expect(module2.get<PairSpaceService>(PairSpaceService).createMessage('ps-1', 'teacher-1', { text: 'Чужая группа' }))
        .rejects.toThrow(ForbiddenException);
      expect(messageRepo.create).not.toHaveBeenCalled();
    });
  });

});
