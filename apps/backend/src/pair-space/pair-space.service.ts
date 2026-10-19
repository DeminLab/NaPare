import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

import { PairSpace } from "./entities/pair-space.entity";
import { Announcement } from "./entities/announcement.entity";
import { Homework } from "./entities/homework.entity";
import { FileAttachment } from "./entities/file-attachment.entity";
import { DiscussionMessage } from "./entities/discussion-message.entity";
import { PersonalLessonNote } from "./entities/personal-lesson-note.entity";
import { HomeworkProgress, HomeworkProgressState, HomeworkProgressSubtask } from "./entities/homework-progress.entity";
import { HomeworkSubmission } from "./entities/homework-submission.entity";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { CreateHomeworkDto } from "./dto/create-homework.dto";
import { SubmitHomeworkDto } from "./dto/submit-homework.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { CreateFileDto } from "./dto/create-file.dto";
import { UpsertPersonalNoteDto } from "./dto/upsert-personal-note.dto";
import { UpdateHomeworkProgressDto } from "./dto/update-homework-progress.dto";
import { TenantContext } from "../common/tenant/tenant-context";
import { EventBusService } from "../events/event-bus.service";
import { Lesson } from "../schedule/entities/lesson.entity";
import { Group } from "../users/entities/group.entity";
import { University } from "../users/entities/university.entity";
import { UserRole } from "../auth/interfaces/user-role";
import { CurationService } from '../curation/curation.service';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from "../common/dto/pagination-query.dto";

const CONTENT_AUTHOR_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.DEPARTMENT_HEAD,
  UserRole.FACULTY_DEAN,
  UserRole.UNIVERSITY_ADMIN,
  UserRole.SUPERADMIN,
];

export type PairSpaceResponse = Omit<PairSpace, "homeworks"> & {
  homeworks: Array<Homework & { progress?: HomeworkProgressState }>;
  moodleUrl?: string;
};

export interface PairSpacePreparationSummary {
  id: string;
  title: string;
  description: string | null;
  deadline: Date | null;
  lessonId: string;
  subject: string;
  progress: HomeworkProgressState;
  subtasks: HomeworkProgressSubtask[];
}

export interface PairSpaceGroupSummary {
  id: string;
  lessonId: string;
  subject: string;
  date: Date;
  pairNumber: number;
  teacherName: string | null;
  group: string | null;
  room: string | null;
  isActive: boolean;
  syncStatus: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_TIMELINE_LIMIT = 20;

function visibleAttachments(files: FileAttachment[] | undefined): FileAttachment[] {
  return (files ?? []).filter((file) => !file.revokedAt).map((file) => {
    const { revokedAt: _revokedAt, revokedBy: _revokedBy, revokeReason: _revokeReason, ...visible } = file;
    return visible as FileAttachment;
  });
}

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
    @InjectRepository(PersonalLessonNote)
    private readonly personalNoteRepository: Repository<PersonalLessonNote>,
    @InjectRepository(HomeworkSubmission)
    private readonly submissionRepository: Repository<HomeworkSubmission>,
    @InjectRepository(HomeworkProgress)
    private readonly homeworkProgressRepository: Repository<HomeworkProgress>,
    private readonly tenantContext: TenantContext,
    @Optional()
    @InjectRepository(Lesson)
    private readonly lessonRepository?: Repository<Lesson>,
    @Optional()
    @InjectRepository(Group)
    private readonly groupRepository?: Repository<Group>,
    @Optional()
    @InjectRepository(University)
    private readonly universityRepository?: Repository<University>,
    @Optional() private readonly eventBus?: EventBusService,
    @Optional() private readonly curation?: CurationService,
  ) {}

  private assertPersistedLessonId(lessonId: string): void {
    if (!UUID_PATTERN.test(lessonId)) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }
  }

  async findById(id: string): Promise<PairSpaceResponse> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id },
      relations: ["announcements", "homeworks", "files", "messages"],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace with id ${id} not found`);
    }
    await this.assertRoleScopedAccess(pairSpace);
    pairSpace.files = visibleAttachments(pairSpace.files);
    pairSpace.messages = (pairSpace.messages ?? []).filter(message => message.moderationState !== 'hidden');

    return this.attachMoodleUrl(pairSpace);
  }

  async findByLesson(
    lessonId: string,
    universityId?: string,
  ): Promise<PairSpaceResponse> {
    this.assertPersistedLessonId(lessonId);
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: universityId ? { lessonId, universityId } : { lessonId },
      relations: ["announcements", "homeworks", "files", "messages"],
    });

    if (!pairSpace) {
      throw new NotFoundException(`PairSpace for lesson ${lessonId} not found`);
    }
    await this.assertRoleScopedAccess(pairSpace);
    pairSpace.files = visibleAttachments(pairSpace.files);
    pairSpace.messages = (pairSpace.messages ?? []).filter(message => message.moderationState !== 'hidden');

    return this.attachMoodleUrl(pairSpace);
  }

  async getSubjectTimeline(lessonId: string, universityId: string) {
    this.tenantContext.assertAccess(universityId);
    this.assertPersistedLessonId(lessonId);
    if (!this.lessonRepository) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    const currentLesson = await this.lessonRepository.findOne({
      where: { id: lessonId, universityId },
    });
    if (!currentLesson) throw new NotFoundException(`Lesson ${lessonId} not found`);
    await this.assertLessonScopedAccess(currentLesson);

    const user = this.tenantContext.getUser();
    const scope = {
      universityId,
      subject: currentLesson.subject,
      ...([UserRole.STUDENT, UserRole.CURATOR].includes(user?.role as UserRole)
        ? { groupId: currentLesson.groupId }
        : user?.role === UserRole.TEACHER
          ? { teacherId: user.id }
          : currentLesson.courseId
            ? { courseId: currentLesson.courseId }
            : { groupId: currentLesson.groupId }),
      ...(currentLesson.courseId ? { courseId: currentLesson.courseId } : {}),
    };
    const pagination = new PaginationQueryDto();
    pagination.page = 1;
    pagination.limit = SUBJECT_TIMELINE_LIMIT;
    const [lessons, total] = await Promise.all([
      this.lessonRepository.find({
        where: scope,
        order: { startDate: "DESC", pairNumber: "DESC" },
        take: SUBJECT_TIMELINE_LIMIT,
      }),
      this.lessonRepository.count({ where: scope }),
    ]);
    const lessonIds = lessons.map((lesson) => lesson.id);
    const spaces = lessonIds.length
      ? await this.pairSpaceRepository.find({
          where: { universityId, lessonId: In(lessonIds) },
          relations: ["announcements", "homeworks", "files"],
          order: { date: "DESC" },
        })
      : [];
    for (const space of spaces) space.files = visibleAttachments(space.files);
    const spacesByLesson = new Map(spaces.map((space) => [space.lessonId, space]));

    return toPaginatedResponse(
      lessons.map((lesson) => ({
        lesson,
        pairSpace: spacesByLesson.get(lesson.id) ?? null,
      })),
      total,
      pagination,
    );
  }

  /**
   * Creates the operational context from an already-authorized lesson on first
   * access. The unique lesson index keeps the operation idempotent across
   * concurrent teacher requests.
   */
  async getOrCreateByLesson(
    lessonId: string,
    universityId?: string,
  ): Promise<PairSpaceResponse> {
    this.assertPersistedLessonId(lessonId);
    try {
      return await this.findByLesson(lessonId, universityId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }

    const user = this.tenantContext.getUser();
    const scopedUniversityId = universityId ?? user?.universityId;
    if (!scopedUniversityId || !this.lessonRepository) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }
    this.tenantContext.assertAccess(scopedUniversityId);

    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, universityId: scopedUniversityId },
    });
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} not found`);
    await this.assertLessonScopedAccess(lesson);

    try {
      await this.pairSpaceRepository.save(
        this.pairSpaceRepository.create({
          universityId: lesson.universityId,
          lessonId: lesson.id,
          courseId: lesson.courseId,
          lessonOccurrenceId: lesson.occurrenceId,
          subject: lesson.subject,
          date: lesson.startDate,
          pairNumber: lesson.pairNumber,
          teacherName: lesson.teacherName,
          group: lesson.groupName,
          room: lesson.room,
          source: "manual",
          syncStatus: "synced",
        }),
      );
    } catch (error) {
      const code = (error as { driverError?: { code?: string } }).driverError
        ?.code;
      if (code !== "23505") throw error;
    }

    return this.findByLesson(lessonId, scopedUniversityId);
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
      source: "manual",
      syncStatus: "synced",
    });

    const saved = await this.announcementRepository.save(announcement);
    const pairSpace = await this.findById(pairSpaceId);
    await this.eventBus?.publish({
      type: "announcement.created",
      universityId: pairSpace.universityId,
      actor: this.eventActor(authorId),
      target: { type: "announcement", id: saved.id },
      payload: {
        pairSpaceId,
        ...(await this.lessonContext(pairSpace)),
        groupName: pairSpace.group ?? null,
        deepLink: `/pair-space/${pairSpace.lessonId}`,
      },
      priority: "normal",
    });
    return saved;
  }

  async getAnnouncements(pairSpaceId: string): Promise<Announcement[]> {
    await this.assertPairSpaceAccess(pairSpaceId);
    return this.announcementRepository.find({
      where: { pairSpaceId },
      order: { isPinned: "DESC", createdAt: "DESC" },
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
      deadline: createHomeworkDto.deadline ? new Date(createHomeworkDto.deadline) : undefined,
      pairSpaceId,
      authorId,
      source: "manual",
      syncStatus: "synced",
    });

    const saved = await this.homeworkRepository.save(homework);
    const pairSpace = await this.findById(pairSpaceId);
    await this.eventBus?.publish({
      type: "homework.created",
      universityId: pairSpace.universityId,
      actor: this.eventActor(authorId),
      target: { type: "homework", id: saved.id },
      payload: {
        pairSpaceId,
        ...(await this.lessonContext(pairSpace)),
        groupName: pairSpace.group ?? null,
        deadline: saved.deadline?.toISOString() ?? null,
        deepLink: `/pair-space/${pairSpace.lessonId}`,
      },
      priority: "normal",
    });
    return saved;
  }

  async getHomeworks(pairSpaceId: string): Promise<Homework[]> {
    await this.assertPairSpaceAccess(pairSpaceId);
    return this.homeworkRepository.find({
      where: { pairSpaceId },
      order: { deadline: "ASC" },
    });
  }

  async listPreparationsForLessons(
    lessonIds: string[],
    universityId: string,
  ): Promise<PairSpacePreparationSummary[]> {
    this.tenantContext.assertAccess(universityId);
    const persistedLessonIds = lessonIds.filter((id) => UUID_PATTERN.test(id));
    if (persistedLessonIds.length === 0) return [];

    const pairSpaces = await this.pairSpaceRepository.find({
      where: { universityId, lessonId: In(persistedLessonIds) },
      relations: ["homeworks"],
    });

    const user = this.tenantContext.getUser();
    const homeworkIds = pairSpaces.flatMap((pairSpace) => (pairSpace.homeworks ?? []).map(({ id }) => id));
    const progressRows = user?.role === UserRole.STUDENT && homeworkIds.length
      ? await this.homeworkProgressRepository.find({ where: { studentId: user.id, homeworkId: In(homeworkIds) } })
      : [];
    const progressByHomework = new Map(progressRows.map((row) => [row.homeworkId, row]));

    return pairSpaces
      .flatMap((pairSpace) =>
        (pairSpace.homeworks ?? []).map((homework) => ({
          id: homework.id,
          title: homework.title,
          description: homework.description ?? null,
          deadline: homework.deadline ?? null,
          lessonId: pairSpace.lessonId,
          subject: pairSpace.subject,
          progress: progressByHomework.get(homework.id)?.state ?? "todo",
          subtasks: progressByHomework.get(homework.id)?.subtasks ?? [],
        })),
      )
      .sort((left, right) => {
        if (!left.deadline) return right.deadline ? 1 : 0;
        if (!right.deadline) return -1;
        return left.deadline.getTime() - right.deadline.getTime();
      });
  }

  async listExistingForGroup(
    groupId: string,
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<PairSpaceGroupSummary>> {
    this.tenantContext.assertAccess(universityId);
    if (!this.groupRepository || !this.lessonRepository) {
      throw new ForbiddenException("Group PairSpace listing is unavailable");
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId, universityId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException("Group not found in this university");

    const lessons = await this.lessonRepository.find({
      where: { groupId, universityId },
      select: { id: true },
    });
    const lessonIds = lessons.map(({ id }) => id);
    if (!lessonIds.length) return toPaginatedResponse([], 0, pagination);

    const [spaces, total] = await this.pairSpaceRepository.findAndCount({
      where: { universityId, lessonId: In(lessonIds) },
      order: { date: "DESC", pairNumber: "DESC", id: "DESC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return toPaginatedResponse(
      spaces.map(({ id, lessonId, subject, date, pairNumber, teacherName, group, room, isActive, syncStatus }) => ({
        id,
        lessonId,
        subject,
        date,
        pairNumber,
        teacherName: teacherName ?? null,
        group: group ?? null,
        room: room ?? null,
        isActive,
        syncStatus,
      })),
      total,
      pagination,
    );
  }

  async updateHomeworkProgress(
    homeworkId: string,
    studentId: string,
    dto: UpdateHomeworkProgressDto,
  ): Promise<HomeworkProgress> {
    const user = this.tenantContext.getUser();
    if (!user || user.role !== UserRole.STUDENT || user.id !== studentId) {
      throw new ForbiddenException("Only the authenticated student can update personal preparation progress");
    }
    const homework = await this.homeworkRepository.findOne({ where: { id: homeworkId }, relations: ["pairSpace"] });
    if (!homework) throw new NotFoundException(`Homework with id ${homeworkId} not found`);
    await this.assertRoleScopedAccess(homework.pairSpace);
    if (dto.state === undefined && dto.subtasks === undefined) {
      throw new BadRequestException("At least one of state or subtasks is required");
    }
    if (dto.subtasks && new Set(dto.subtasks.map((item) => item.id)).size !== dto.subtasks.length) {
      throw new BadRequestException("Subtask IDs must be unique within a preparation checklist");
    }
    await this.homeworkProgressRepository.upsert(
      {
        homeworkId,
        studentId,
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.subtasks !== undefined ? { subtasks: dto.subtasks } : {}),
      },
      { conflictPaths: ["homeworkId", "studentId"], skipUpdateIfNoValuesChanged: true },
    );
    return this.homeworkProgressRepository.findOneByOrFail({ homeworkId, studentId });
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

    const saved = await this.fileAttachmentRepository.save(file);
    return visibleAttachments([saved])[0];
  }

  async getMessages(
    pairSpaceId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<DiscussionMessage>> {
    await this.assertPairSpaceAccess(pairSpaceId);
    const [data, total] = await this.messageRepository.findAndCount({
      where: { pairSpaceId, moderationState: 'visible' },
      order: { createdAt: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async getPersonalNote(lessonId: string, universityId: string): Promise<PersonalLessonNote | null> {
    const pairSpace = await this.getOrCreateByLesson(lessonId, universityId);
    const user = this.tenantContext.getUser();
    if (!user) throw new ForbiddenException("Authenticated user required");
    return this.personalNoteRepository.findOne({
      where: { pairSpaceId: pairSpace.id, universityId: pairSpace.universityId, userId: user.id },
    });
  }

  async savePersonalNote(
    lessonId: string,
    universityId: string,
    dto: UpsertPersonalNoteDto,
  ): Promise<PersonalLessonNote | null> {
    const pairSpace = await this.getOrCreateByLesson(lessonId, universityId);
    const user = this.tenantContext.getUser();
    if (!user) throw new ForbiddenException("Authenticated user required");
    if (dto.content.length === 0) {
      await this.personalNoteRepository.delete({ pairSpaceId: pairSpace.id, userId: user.id, universityId: pairSpace.universityId });
      return null;
    }
    await this.personalNoteRepository.upsert({
      pairSpaceId: pairSpace.id,
      universityId: pairSpace.universityId,
      userId: user.id,
      content: dto.content,
    }, { conflictPaths: ["pairSpaceId", "userId"] });
    return this.personalNoteRepository.findOne({
      where: { pairSpaceId: pairSpace.id, universityId: pairSpace.universityId, userId: user.id },
    });
  }

  async createMessage(
    pairSpaceId: string,
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<DiscussionMessage> {
    const pairSpace = await this.assertPairSpaceAccess(pairSpaceId);
    await this.assertTeacherOwnsPairSpace(pairSpace);
    const message = this.messageRepository.create({
      pairSpaceId,
      userId,
      text: createMessageDto.text,
      parentId: createMessageDto.parentId,
    });

    const saved = await this.messageRepository.save(message);
    const eventPairSpace = await this.findById(pairSpaceId);
    await this.eventBus?.publish({
      type: "message.created",
      universityId: eventPairSpace.universityId,
      actor: this.eventActor(userId),
      target: { type: "message", id: saved.id },
      payload: {
        pairSpaceId,
        ...(await this.lessonContext(eventPairSpace)),
        groupName: eventPairSpace.group ?? null,
        deepLink: `/pair-space/${eventPairSpace.lessonId}`,
      },
      priority: "normal",
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
      relations: ["pairSpace"],
    });
    if (!homework) {
      throw new NotFoundException(`Homework with id ${homeworkId} not found`);
    }
    const user = this.tenantContext.getUser();
    if (!user || user.role !== UserRole.STUDENT || user.id !== studentId) {
      throw new ForbiddenException(
        "Only the authenticated student can submit homework",
      );
    }
    await this.assertRoleScopedAccess(homework.pairSpace);

    const existing = await this.submissionRepository.findOne({
      where: { homeworkId, studentId },
    });

    if (existing) {
      existing.status = "submitted";
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
      status: "submitted",
      submittedAt: new Date(),
      fileUrl: submitHomeworkDto.fileUrl,
      comment: submitHomeworkDto.comment,
    });

    return this.submissionRepository.save(submission);
  }

  async completeHomework(homeworkId: string): Promise<Homework> {
    const homework = await this.homeworkRepository.findOne({
      where: { id: homeworkId },
      relations: ["pairSpace"],
    });

    if (!homework) {
      throw new NotFoundException(`Homework with id ${homeworkId} not found`);
    }
    this.tenantContext.assertAccess(homework.pairSpace.universityId);

    homework.isCompleted = true;
    const saved = await this.homeworkRepository.save(homework);
    await this.eventBus?.publish({
      type: "homework.updated",
      universityId: homework.pairSpace.universityId,
      actor: this.eventActor(),
      target: { type: "homework", id: saved.id },
      payload: {
        pairSpaceId: homework.pairSpaceId,
        ...(await this.lessonContext(homework.pairSpace)),
        deepLink: `/pair-space/${homework.pairSpace.lessonId}`,
      },
      priority: "normal",
    });
    return saved;
  }

  private async assertPairSpaceAccess(pairSpaceId: string): Promise<PairSpace> {
    const pairSpace = await this.pairSpaceRepository.findOne({
      where: { id: pairSpaceId },
    });
    if (!pairSpace) {
      throw new NotFoundException(`PairSpace with id ${pairSpaceId} not found`);
    }
    await this.assertRoleScopedAccess(pairSpace);
    return pairSpace;
  }

  private async assertRoleScopedAccess(pairSpace: PairSpace): Promise<void> {
    this.tenantContext.assertAccess(pairSpace.universityId);
    const user = this.tenantContext.getUser();
    if (user?.role === UserRole.CURATOR && this.curation) {
      const lesson = await this.lessonRepository?.findOne({ where: { id: pairSpace.lessonId, universityId: pairSpace.universityId } });
      if (!lesson) throw new ForbiddenException('Занятие недоступно.');
      await this.curation.assertGroup(lesson.groupId);
      return;
    }
    if (user?.role === UserRole.TEACHER) {
      const lesson = await this.lessonRepository?.findOne({
        where: { id: pairSpace.lessonId, universityId: pairSpace.universityId },
      });
      if (!lesson || lesson.teacherId !== user.id) {
        throw new ForbiddenException("Teachers can only access their own lesson spaces");
      }
      return;
    }
    if (!user || user.role !== UserRole.STUDENT) return;
    if (!user.groupId || !this.lessonRepository) {
      throw new ForbiddenException(
        "Student group access cannot be established",
      );
    }
    const lesson = await this.lessonRepository.findOne({
      where: { id: pairSpace.lessonId, universityId: pairSpace.universityId },
    });
    const groupId = await this.resolveStudentGroupId(
      pairSpace.universityId,
      user.groupId,
    );
    if (!lesson || lesson.groupId !== groupId) {
      throw new ForbiddenException(
        "Students can only access pair spaces for their own group",
      );
    }
  }

  private async assertLessonScopedAccess(lesson: Lesson): Promise<void> {
    const user = this.tenantContext.getUser();
    if (!user) throw new ForbiddenException("Authenticated user required");
    if (user.role === UserRole.CURATOR && this.curation) await this.curation.assertGroup(lesson.groupId);
    const groupId = await this.resolveStudentGroupId(
      lesson.universityId,
      user.groupId,
    );
    if (user.role === UserRole.STUDENT && lesson.groupId !== groupId) {
      throw new ForbiddenException(
        "Students can only access pair spaces for their own group",
      );
    }
    if (user.role === UserRole.TEACHER && lesson.teacherId !== user.id) {
      throw new ForbiddenException(
        "Teachers can only access their own lesson spaces",
      );
    }
  }

  private async resolveStudentGroupId(
    universityId: string,
    groupId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (!groupId || !/^\d+$/.test(groupId) || !this.groupRepository) {
      return groupId;
    }
    const group = await this.groupRepository.findOne({
      where: { universityId, externalId: groupId },
    });
    return group?.id ?? groupId;
  }

  private async attachMoodleUrl(
    pairSpace: PairSpace,
  ): Promise<PairSpaceResponse> {
    let response: PairSpaceResponse = pairSpace;
    const user = this.tenantContext.getUser();
    if (user?.role === UserRole.STUDENT && pairSpace.homeworks?.length) {
      const progressRows = await this.homeworkProgressRepository.find({
        where: { studentId: user.id, homeworkId: In(pairSpace.homeworks.map(({ id }) => id)) },
      });
      const progressByHomework = new Map(progressRows.map((row) => [row.homeworkId, row]));
      response = {
        ...pairSpace,
        homeworks: pairSpace.homeworks.map((homework) => ({
          ...homework,
          progress: progressByHomework.get(homework.id)?.state ?? "todo",
          subtasks: progressByHomework.get(homework.id)?.subtasks ?? [],
        })),
      };
    }
    if (!this.universityRepository) return response;
    const university = await this.universityRepository.findOne({
      where: { id: pairSpace.universityId },
    });
    const baseUrl = university?.connectorConfig?.baseUrl;
    if (
      university?.connectorType !== "moodle" ||
      university.connectorConfig?.status !== "active" ||
      typeof baseUrl !== "string" ||
      !baseUrl.startsWith("https://")
    ) {
      return response;
    }
    return { ...response, moodleUrl: baseUrl };
  }

  private async assertCanPublishContent(
    pairSpaceId: string,
    actorId: string,
  ): Promise<PairSpace> {
    const user = this.tenantContext.getUser();
    if (!user || !CONTENT_AUTHOR_ROLES.includes(user.role)) {
      throw new ForbiddenException(
        "Staff role required to publish pair space content",
      );
    }
    if (user.id !== actorId) {
      throw new ForbiddenException(
        "Users can only publish pair space content as themselves",
      );
    }
    const pairSpace = await this.assertPairSpaceAccess(pairSpaceId);
    await this.assertTeacherOwnsPairSpace(pairSpace);
    return pairSpace;
  }

  private async assertTeacherOwnsPairSpace(
    pairSpace: PairSpace,
  ): Promise<void> {
    const user = this.tenantContext.getUser();
    if (user?.role !== UserRole.TEACHER) return;
    if (!this.lessonRepository) {
      throw new ForbiddenException(
        "Teacher lesson access cannot be established",
      );
    }
    const lesson = await this.lessonRepository.findOne({
      where: {
        id: pairSpace.lessonId,
        universityId: pairSpace.universityId,
        teacherId: user.id,
      },
    });
    if (!lesson) {
      throw new ForbiddenException(
        "Teachers can only access their own lesson spaces",
      );
    }
  }

  private eventActor(id?: string) {
    const user = this.tenantContext.getUser();
    return user
      ? { id: user.id, type: "user" as const, role: user.role }
      : id
        ? { id, type: "user" as const }
        : { type: "system" as const };
  }

  private async lessonContext(
    pairSpace: PairSpace,
  ): Promise<{ groupId?: string; teacherId?: string }> {
    if (!this.lessonRepository) return {};
    const lesson = await this.lessonRepository.findOne({
      where: { id: pairSpace.lessonId },
    });
    return lesson
      ? { groupId: lesson.groupId, teacherId: lesson.teacherId ?? undefined }
      : {};
  }
}
