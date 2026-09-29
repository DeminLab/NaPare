import { Test, TestingModule } from "@nestjs/testing";
import { PairSpaceService } from "./pair-space.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PairSpace } from "./entities/pair-space.entity";
import { Announcement } from "./entities/announcement.entity";
import { Homework } from "./entities/homework.entity";
import { FileAttachment } from "./entities/file-attachment.entity";
import { DiscussionMessage } from "./entities/discussion-message.entity";
import { HomeworkSubmission } from "./entities/homework-submission.entity";
import { HomeworkProgress } from "./entities/homework-progress.entity";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { TenantContext } from "../common/tenant/tenant-context";
import { UserRole } from "../auth/interfaces/user-role";
import { EventBusService } from "../events/event-bus.service";
import { Lesson } from "../schedule/entities/lesson.entity";
import { Group } from "../users/entities/group.entity";
import { University } from "../users/entities/university.entity";
import { PersonalLessonNote } from "./entities/personal-lesson-note.entity";

describe("PairSpaceService", () => {
  let service: PairSpaceService;
  let pairSpaceRepository: ReturnType<typeof mockRepo>;
  let personalNoteRepository: ReturnType<typeof mockRepo>;
  let tenantContext: { assertAccess: jest.Mock; getUser: jest.Mock };

  const mockRepo = (name: string) => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((dto) => ({ id: "1", ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  });

  beforeEach(async () => {
    pairSpaceRepository = mockRepo("PairSpace");
    personalNoteRepository = mockRepo("PersonalLessonNote");
    tenantContext = { assertAccess: jest.fn(), getUser: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PairSpaceService,
        {
          provide: getRepositoryToken(PairSpace),
          useValue: pairSpaceRepository,
        },
        {
          provide: getRepositoryToken(Announcement),
          useValue: mockRepo("Announcement"),
        },
        {
          provide: getRepositoryToken(Homework),
          useValue: mockRepo("Homework"),
        },
        {
          provide: getRepositoryToken(FileAttachment),
          useValue: mockRepo("FileAttachment"),
        },
        {
          provide: getRepositoryToken(DiscussionMessage),
          useValue: mockRepo("DiscussionMessage"),
        },
        {
          provide: getRepositoryToken(HomeworkSubmission),
          useValue: mockRepo("HomeworkSubmission"),
        },
        { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
        {
          provide: getRepositoryToken(PersonalLessonNote),
          useValue: personalNoteRepository,
        },
        {
          provide: TenantContext,
          useValue: tenantContext,
        },
      ],
    }).compile();

    service = module.get<PairSpaceService>(PairSpaceService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("personal lesson notes", () => {
    const lessonId = "lesson-1";
    const pairSpace = { id: "space-1", lessonId, universityId: "uni-1" };
    const user = { id: "user-1", universityId: "uni-1", role: UserRole.STUDENT, groupId: "group-1" };

    beforeEach(() => {
      tenantContext.getUser.mockReturnValue(user);
      pairSpaceRepository.findOne.mockResolvedValue(pairSpace);
      tenantContext.assertAccess.mockImplementation(() => undefined);
    });

    it("returns only the current user's note within the authorized pair space", async () => {
      const note = { pairSpaceId: "space-1", universityId: "uni-1", userId: "user-1", content: "Read chapter 4" };
      personalNoteRepository.findOne.mockResolvedValue(note);
      // A minimal lesson repository lets the service enforce student group scope.
      const module = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepository },
          { provide: getRepositoryToken(Announcement), useValue: mockRepo("Announcement") },
          { provide: getRepositoryToken(Homework), useValue: mockRepo("Homework") },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo("FileAttachment") },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo("DiscussionMessage") },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo("HomeworkSubmission") },
            { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: TenantContext, useValue: tenantContext },
          { provide: getRepositoryToken(Lesson), useValue: { findOne: jest.fn().mockResolvedValue({ id: lessonId, universityId: "uni-1", groupId: "group-1" }) } },
        ],
      }).compile();
      const scopedService = module.get<PairSpaceService>(PairSpaceService);

      await expect(scopedService.getPersonalNote(lessonId, "uni-1")).resolves.toBe(note);
      expect(personalNoteRepository.findOne).toHaveBeenCalledWith({ where: { pairSpaceId: "space-1", universityId: "uni-1", userId: "user-1" } });
    });

    it("upserts a note under the authenticated user and deletes it when cleared", async () => {
      // For a student, provide the role-scope repository in a focused instance.
      const module = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepository },
          { provide: getRepositoryToken(Announcement), useValue: mockRepo("Announcement") },
          { provide: getRepositoryToken(Homework), useValue: mockRepo("Homework") },
          { provide: getRepositoryToken(FileAttachment), useValue: mockRepo("FileAttachment") },
          { provide: getRepositoryToken(DiscussionMessage), useValue: mockRepo("DiscussionMessage") },
          { provide: getRepositoryToken(HomeworkSubmission), useValue: mockRepo("HomeworkSubmission") },
            { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: TenantContext, useValue: tenantContext },
          { provide: getRepositoryToken(Lesson), useValue: { findOne: jest.fn().mockResolvedValue({ id: lessonId, universityId: "uni-1", groupId: "group-1" }) } },
        ],
      }).compile();
      const scopedService = module.get<PairSpaceService>(PairSpaceService);
      const note = { id: "note-1", content: "Review the examples" };
      personalNoteRepository.findOne.mockResolvedValue(note);

      await expect(scopedService.savePersonalNote(lessonId, "uni-1", { content: note.content })).resolves.toBe(note);
      expect(personalNoteRepository.upsert).toHaveBeenCalledWith({ pairSpaceId: "space-1", universityId: "uni-1", userId: "user-1", content: note.content }, { conflictPaths: ["pairSpaceId", "userId"] });
      await expect(scopedService.savePersonalNote(lessonId, "uni-1", { content: "" })).resolves.toBeNull();
      expect(personalNoteRepository.delete).toHaveBeenCalledWith({ pairSpaceId: "space-1", userId: "user-1", universityId: "uni-1" });
    });
  });

  describe("listPreparationsForLessons", () => {
    it("scopes preparation reminders to the tenant and supplied lesson ids", async () => {
      const lessonId = "8d4f43a2-0b62-4d5e-85b1-c3e1eb730b56";
      pairSpaceRepository.find.mockResolvedValue([
        {
          lessonId,
          subject: "Математика",
          homeworks: [
            {
              id: "prep-later",
              title: "Подготовить вопросы",
              deadline: new Date("2026-10-02T12:00:00.000Z"),
            },
            {
              id: "prep-soon",
              title: "Прочитать главу",
              deadline: new Date("2026-09-30T12:00:00.000Z"),
            },
            { id: "prep-no-date", title: "Повторить тему", deadline: null },
          ],
        },
      ]);

      const result = await service.listPreparationsForLessons(
        [lessonId, "rasp-external-lesson"],
        "university-1",
      );

      expect(tenantContext.assertAccess).toHaveBeenCalledWith("university-1");
      const findOptions = pairSpaceRepository.find.mock.calls[0][0];
      expect(findOptions.where.universityId).toBe("university-1");
      expect(findOptions.where.lessonId).toMatchObject({
        _type: "in",
        _value: [lessonId],
      });
      expect(result.map((item) => item.id)).toEqual([
        "prep-soon",
        "prep-later",
        "prep-no-date",
      ]);
      expect(result[0]).toMatchObject({
        lessonId,
        subject: "Математика",
      });
    });

    it("does not query for an empty schedule", async () => {
      await expect(service.listPreparationsForLessons([], "university-1"))
        .resolves.toEqual([]);
      expect(pairSpaceRepository.find).not.toHaveBeenCalled();
    });
  });

  describe("findByLesson", () => {
    it("should throw NotFoundException if not found", async () => {
      await expect(service.findByLesson("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("does not expose a different group's pair space to a student", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          universityId: "uni-1",
          lessonId: "lesson-1",
        }),
      };
      const lessonRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "lesson-1",
          universityId: "uni-1",
          groupId: "group-2",
        }),
      };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "student-1",
                role: UserRole.STUDENT,
                universityId: "uni-1",
                groupId: "group-1",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .findByLesson("lesson-1", "uni-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("resolves a numeric SIBIT group id before granting student access", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          universityId: "uni-1",
          lessonId: "lesson-1",
          announcements: [],
          homeworks: [],
          files: [],
          messages: [],
        }),
      };
      const lessonRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "lesson-1",
          universityId: "uni-1",
          groupId: "group-uuid",
        }),
      };
      const groupRepo = {
        findOne: jest.fn().mockResolvedValue({ id: "group-uuid" }),
      };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          { provide: getRepositoryToken(Group), useValue: groupRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "student-1",
                role: UserRole.STUDENT,
                universityId: "uni-1",
                groupId: "12136",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .findByLesson("lesson-1", "uni-1"),
      ).resolves.toMatchObject({ id: "ps-1" });
      expect(groupRepo.findOne).toHaveBeenCalledWith({
        where: { universityId: "uni-1", externalId: "12136" },
      });
    });

    it("exposes only an active Moodle base URL, never connector credentials", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          universityId: "uni-1",
          lessonId: "lesson-1",
          announcements: [],
          homeworks: [],
          files: [],
          messages: [],
        }),
      };
      const universityRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "uni-1",
          connectorType: "moodle",
          connectorConfig: {
            status: "active",
            baseUrl: "https://moodle.example.edu/",
            tokenCiphertext: "encrypted-secret",
          },
        }),
      };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(University), useValue: universityRepo },
          {
            provide: TenantContext,
            useValue: { assertAccess: jest.fn(), getUser: jest.fn() },
          },
        ],
      }).compile();

      const pairSpace = await module2
        .get<PairSpaceService>(PairSpaceService)
        .findByLesson("lesson-1", "uni-1");

      expect(pairSpace).toMatchObject({
        id: "ps-1",
        moodleUrl: "https://moodle.example.edu/",
      });
      expect(pairSpace).not.toHaveProperty("tokenCiphertext");
    });
  });

  describe("getOrCreateByLesson", () => {
    it("creates an empty pair space from an authorized teacher lesson on first access", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: "space-1",
          lessonId: "lesson-1",
          universityId: "uni-1",
          announcements: [],
          homeworks: [],
          files: [],
          messages: [],
        }),
        create: jest.fn().mockImplementation((value) => value),
        save: jest.fn().mockResolvedValue({ id: "space-1" }),
      };
      const lessonRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "lesson-1",
          universityId: "uni-1",
          teacherId: "teacher-1",
          courseId: null,
          occurrenceId: null,
          subject: "Математика",
          startDate: new Date("2026-09-26T09:00:00Z"),
          pairNumber: 1,
          teacherName: "Иванов И.И.",
          groupName: "ПИ-21",
          room: "305",
        }),
      };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "teacher-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .getOrCreateByLesson("lesson-1", "uni-1"),
      ).resolves.toMatchObject({ id: "space-1", lessonId: "lesson-1" });
      expect(pairSpaceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lessonId: "lesson-1",
          universityId: "uni-1",
          subject: "Математика",
          group: "ПИ-21",
        }),
      );
    });

    it("does not create a space when a teacher opens another teacher’s lesson", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        save: jest.fn(),
      };
      const lessonRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "lesson-1",
          universityId: "uni-1",
          teacherId: "teacher-2",
          groupId: "group-1",
        }),
      };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "teacher-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .getOrCreateByLesson("lesson-1", "uni-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(pairSpaceRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("createAnnouncement", () => {
    it("rejects a student even when the pair space belongs to their university", async () => {
      const pairSpaceRepo = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: "ps-1", universityId: "uni-1" }),
      };
      const announcementRepo = { create: jest.fn(), save: jest.fn() };

      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: announcementRepo,
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "student-1",
                role: UserRole.STUDENT,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      const svc = module2.get<PairSpaceService>(PairSpaceService);
      await expect(
        svc.createAnnouncement("ps-1", "student-1", { text: "Hello" } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(announcementRepo.create).not.toHaveBeenCalled();
    });

    it("should create announcement", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          lessonId: "lesson-1",
          universityId: "uni-1",
        }),
      };
      const lessonRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "lesson-1",
          universityId: "uni-1",
          teacherId: "author-1",
        }),
      };
      const announcementRepo = {
        create: jest.fn().mockImplementation((dto) => ({ id: "a1", ...dto })),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      };

      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: announcementRepo,
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "author-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      const svc = module2.get<PairSpaceService>(PairSpaceService);
      const result = await svc.createAnnouncement("ps-1", "author-1", {
        text: "Hello",
      } as any);
      expect(result.text).toBe("Hello");
    });

    it("rejects a teacher publishing in another teacher's lesson space", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          lessonId: "lesson-1",
          universityId: "uni-1",
        }),
      };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const announcementRepo = { create: jest.fn(), save: jest.fn() };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: announcementRepo,
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "teacher-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .createAnnouncement("ps-1", "teacher-1", { text: "Чужая группа" }),
      ).rejects.toThrow(ForbiddenException);
      expect(announcementRepo.create).not.toHaveBeenCalled();
    });

    it("publishes a notification link using the lesson route, not the internal pair-space id", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          universityId: "uni-1",
          lessonId: "lesson-1",
        }),
      };
      const lessonRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "lesson-1",
          universityId: "uni-1",
          teacherId: "author-1",
          groupId: "group-1",
        }),
      };
      const announcementRepo = {
        create: jest.fn().mockImplementation((dto) => ({ id: "a1", ...dto })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: announcementRepo,
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "author-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
          { provide: EventBusService, useValue: eventBus },
        ],
      }).compile();

      await module2
        .get<PairSpaceService>(PairSpaceService)
        .createAnnouncement("ps-1", "author-1", { text: "Hello" } as any);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            deepLink: "/pair-space/lesson-1",
          }),
        }),
      );
    });
  });

  describe("submitHomework", () => {
    it("rejects a staff account attempting to submit a student homework item", async () => {
      const homeworkRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "homework-1",
          pairSpace: {
            id: "ps-1",
            universityId: "uni-1",
            lessonId: "lesson-1",
          },
        }),
      };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          {
            provide: getRepositoryToken(PairSpace),
            useValue: mockRepo("PairSpace"),
          },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          { provide: getRepositoryToken(Homework), useValue: homeworkRepo },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: mockRepo("DiscussionMessage"),
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "teacher-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .submitHomework("homework-1", "teacher-1", {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("createMessage", () => {
    it("rejects a teacher message in a colleague's lesson space", async () => {
      const pairSpaceRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "ps-1",
          lessonId: "lesson-1",
          universityId: "uni-1",
        }),
      };
      const lessonRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const messageRepo = { create: jest.fn(), save: jest.fn() };
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PairSpaceService,
          { provide: getRepositoryToken(PersonalLessonNote), useValue: personalNoteRepository },
          { provide: getRepositoryToken(PairSpace), useValue: pairSpaceRepo },
          {
            provide: getRepositoryToken(Announcement),
            useValue: mockRepo("Announcement"),
          },
          {
            provide: getRepositoryToken(Homework),
            useValue: mockRepo("Homework"),
          },
          {
            provide: getRepositoryToken(FileAttachment),
            useValue: mockRepo("FileAttachment"),
          },
          {
            provide: getRepositoryToken(DiscussionMessage),
            useValue: messageRepo,
          },
          {
            provide: getRepositoryToken(HomeworkSubmission),
            useValue: mockRepo("HomeworkSubmission"),
          },
          { provide: getRepositoryToken(HomeworkProgress), useValue: mockRepo("HomeworkProgress") },
          { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
          {
            provide: TenantContext,
            useValue: {
              assertAccess: jest.fn(),
              getUser: jest.fn().mockReturnValue({
                id: "teacher-1",
                role: UserRole.TEACHER,
                universityId: "uni-1",
              }),
            },
          },
        ],
      }).compile();

      await expect(
        module2
          .get<PairSpaceService>(PairSpaceService)
          .createMessage("ps-1", "teacher-1", { text: "Чужая группа" }),
      ).rejects.toThrow(ForbiddenException);
      expect(messageRepo.create).not.toHaveBeenCalled();
    });
  });
});
