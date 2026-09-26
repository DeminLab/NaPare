import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ArrayContains, In } from 'typeorm';

import { Absence } from './entities/absence.entity';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';
import { EventBusService } from '../events/event-bus.service';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { Lesson } from '../schedule/entities/lesson.entity';
import { User } from '../users/entities/user.entity';

export const ABSENCE_STAFF_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.CURATOR,
  UserRole.DEPARTMENT_HEAD,
  UserRole.FACULTY_DEAN,
  UserRole.UNIVERSITY_ADMIN,
  UserRole.SUPERADMIN,
];

export type PendingAbsence = Absence & {
  student: Pick<User, 'id' | 'firstName' | 'lastName' | 'groupId'> | null;
};

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(Absence)
    private readonly absenceRepository: Repository<Absence>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tenantContext: TenantContext,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async findByStudent(
    studentId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Absence>> {
    const user = this.tenantContext.getUser();
    const [data, total] = await this.absenceRepository.findAndCount({
      where: user && user.role !== UserRole.SUPERADMIN
        ? { studentId, universityId: user.universityId }
        : { studentId },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findByLesson(
    lessonId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Absence>> {
    const user = this.tenantContext.getUser();
    const lesson = await this.lessonRepository.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException(`Lesson with id ${lessonId} not found`);
    this.assertStaffAccess(lesson.universityId);
    this.assertTeacherOwnsLesson(lesson);
    const [data, total] = await this.absenceRepository.findAndCount({
      where: user && user.role !== UserRole.SUPERADMIN
        ? {
            affectedLessonIds: ArrayContains([lessonId]),
            universityId: user.universityId,
          }
        : { affectedLessonIds: ArrayContains([lessonId]) },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findByDateRange(
    universityId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Absence>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.absenceRepository.findAndCount({
      where: {
        universityId,
        startDate: Between(new Date(startDate), new Date(endDate)),
      },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async create(createAbsenceDto: CreateAbsenceDto, universityId: string): Promise<Absence> {
    const user = this.tenantContext.getUser();
    if (!user || user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can create absences');
    }
    this.tenantContext.assertAccess(universityId);
    const startDate = new Date(createAbsenceDto.startDate);
    const endDate = new Date(createAbsenceDto.endDate);
    this.assertValidDateRange(startDate, endDate);
    let lesson: Lesson | null = null;
    if (createAbsenceDto.lessonId) {
      lesson = await this.lessonRepository.findOne({
        where: { id: createAbsenceDto.lessonId, universityId },
      });
      if (!lesson) throw new NotFoundException('Занятие не найдено в текущем ВУЗе.');
      if (user.groupId && lesson.groupId !== user.groupId) {
        throw new ForbiddenException('Можно сообщить об отсутствии только на занятии своей группы.');
      }
    }
    const absence = this.absenceRepository.create({
      universityId,
      studentId: user.id,
      type: createAbsenceDto.type,
      startDate,
      endDate,
      comment: createAbsenceDto.comment,
      source: 'manual',
      syncStatus: 'synced',
      ...(lesson ? { affectedLessonIds: [lesson.id], affectedLessonsCount: 1 } : {}),
    });
    const saved = await this.absenceRepository.save(absence);
    await this.publishAbsence('absence.created', saved, 'normal', lesson?.teacherId);
    return saved;
  }

  async update(id: string, updateAbsenceDto: UpdateAbsenceDto): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.assertCanMutate(absence);

    const startDate = updateAbsenceDto.startDate ? new Date(updateAbsenceDto.startDate) : absence.startDate;
    const endDate = updateAbsenceDto.endDate ? new Date(updateAbsenceDto.endDate) : absence.endDate;
    this.assertValidDateRange(startDate, endDate);

    Object.assign(absence, {
      ...updateAbsenceDto,
      ...(updateAbsenceDto.startDate && { startDate }),
      ...(updateAbsenceDto.endDate && { endDate }),
    });
    const saved = await this.absenceRepository.save(absence);
    await this.publishAbsence('absence.updated', saved, 'normal');
    return saved;
  }

  async findByUniversity(
    universityId: string,
    status?: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Absence>> {
    this.tenantContext.assertAccess(universityId);
    const where: { universityId: string; confirmationRequired?: boolean } = { universityId };
    if (status === 'pending') {
      where.confirmationRequired = true;
    }
    const [data, total] = await this.absenceRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findPendingForCurrentUniversity(
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<PendingAbsence>> {
    const user = this.tenantContext.getUser();
    if (!user || !ABSENCE_STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('Staff role required');
    }
    this.tenantContext.assertAccess(user.universityId);
    const [data, total] = await this.absenceRepository.findAndCount({
      where: { universityId: user.universityId, confirmationRequired: true },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    const studentIds = [...new Set(data.map((absence) => absence.studentId))];
    const students = studentIds.length
      ? await this.userRepository.find({
          where: {
            id: In(studentIds),
            universityId: user.universityId,
            role: UserRole.STUDENT,
          },
        })
      : [];
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const items: PendingAbsence[] = data.map((absence) => {
      const student = studentsById.get(absence.studentId);
      return {
        ...absence,
        student: student
          ? {
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              groupId: student.groupId,
            }
          : null,
      };
    });
    return toPaginatedResponse(items, total, pagination);
  }

  async confirm(id: string, curatorId: string, comment?: string): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.assertStaffAccess(absence.universityId);
    await this.assertTeacherCanReviewAbsence(absence);

    absence.confirmationRequired = false;
    if (comment) {
      absence.comment = comment;
    }
    const saved = await this.absenceRepository.save(absence);
    await this.publishAbsence('absence.updated', saved, 'normal');
    return saved;
  }

  async reject(
    id: string,
    curatorId: string,
    reason: string,
  ): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.assertStaffAccess(absence.universityId);
    await this.assertTeacherCanReviewAbsence(absence);

    absence.comment = reason;
    absence.confirmationRequired = false;
    const saved = await this.absenceRepository.save(absence);
    await this.publishAbsence('absence.updated', saved, 'high');
    return saved;
  }

  async delete(id: string): Promise<void> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.assertCanMutate(absence);

    await this.absenceRepository.delete(id);
  }

  async getStats(
    universityId: string,
    studentId: string,
  ): Promise<{ total: number; byType: Record<string, number> }> {
    this.tenantContext.assertAccess(universityId);
    const absences = await this.absenceRepository.find({
      where: { universityId, studentId },
    });

    const total = absences.length;
    const byType: Record<string, number> = {};
    for (const absence of absences) {
      byType[absence.type] = (byType[absence.type] || 0) + 1;
    }

    return { total, byType };
  }

  async findAttendanceForLesson(
    lessonId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const lesson = await this.lessonRepository.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException(`Lesson with id ${lessonId} not found`);
    this.assertStaffAccess(lesson.universityId);
    this.assertTeacherOwnsLesson(lesson);
    const [data, total] = await this.attendanceRepository.findAndCount({
      where: { lessonId, universityId: lesson.universityId },
      order: { updatedAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async markAttendance(
    universityId: string,
    markedById: string,
    dto: MarkAttendanceDto,
  ): Promise<AttendanceRecord[]> {
    this.assertStaffAccess(universityId);
    const studentIds = dto.entries.map((entry) => entry.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('Один студент не может быть отмечен дважды в одной паре.');
    }

    const lesson = await this.lessonRepository.findOne({ where: { id: dto.lessonId, universityId } });
    if (!lesson) throw new NotFoundException('Занятие не найдено в текущем ВУЗе.');
    this.assertTeacherOwnsLesson(lesson);

    const students = await this.userRepository.find({
      where: {
        id: In(studentIds),
        universityId,
        groupId: lesson.groupId,
        role: UserRole.STUDENT,
      },
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException('В отметках есть студенты не из группы выбранного занятия.');
    }

    const existing = await this.attendanceRepository.find({
      where: { lessonId: lesson.id, studentId: In(studentIds) },
    });
    const existingByStudent = new Map(existing.map((record) => [record.studentId, record]));
    const records = dto.entries.map((entry) => this.attendanceRepository.create({
      ...existingByStudent.get(entry.studentId),
      universityId,
      lessonId: lesson.id,
      studentId: entry.studentId,
      status: entry.status,
      comment: entry.comment?.trim() || null,
      markedById,
    }));
    const saved = await this.attendanceRepository.save(records);
    const user = this.tenantContext.getUser();
    await this.eventBus?.publish({
      type: 'attendance.updated',
      universityId,
      actor: user ? { id: user.id, type: 'user', role: user.role } : { id: markedById, type: 'user' },
      target: { type: 'lesson', id: lesson.id },
      payload: { lessonId: lesson.id, records: saved.length },
      priority: 'normal',
      recipients: studentIds,
    });
    return saved;
  }

  private assertCanMutate(absence: Absence): void {
    const user = this.tenantContext.getUser();
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }
    this.tenantContext.assertAccess(absence.universityId);
    if (user.role === UserRole.STUDENT && absence.studentId !== user.id) {
      throw new ForbiddenException('Students can only mutate their own absences');
    }
  }

  private assertValidDateRange(startDate: Date, endDate: Date): void {
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('Дата окончания отсутствия не может быть раньше даты начала.');
    }
  }

  private assertStaffAccess(universityId: string): void {
    const user = this.tenantContext.getUser();
    if (!user || !ABSENCE_STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('Staff role required');
    }
    this.tenantContext.assertAccess(universityId);
  }

  private assertTeacherOwnsLesson(lesson: Lesson): void {
    const user = this.tenantContext.getUser();
    if (user?.role === UserRole.TEACHER && lesson.teacherId !== user.id) {
      throw new ForbiddenException('Teachers can only access attendance for their own lessons');
    }
  }

  private async assertTeacherCanReviewAbsence(absence: Absence): Promise<void> {
    const user = this.tenantContext.getUser();
    if (user?.role !== UserRole.TEACHER) return;
    const lessonId = absence.affectedLessonIds?.[0];
    if (!lessonId) {
      throw new ForbiddenException('Teachers can only review absences linked to their own lessons');
    }
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, universityId: absence.universityId, teacherId: user.id },
    });
    if (!lesson) {
      throw new ForbiddenException('Teachers can only review absences linked to their own lessons');
    }
  }

  private async publishAbsence(
    type: 'absence.created' | 'absence.updated',
    absence: Absence,
    priority: 'normal' | 'high',
    teacherId?: string | null,
  ): Promise<void> {
    const user = this.tenantContext.getUser();
    const universityReviewers = await this.userRepository.find({
      where: {
        universityId: absence.universityId,
        isActive: true,
        role: In([
          UserRole.CURATOR,
          UserRole.DEPARTMENT_HEAD,
          UserRole.FACULTY_DEAN,
          UserRole.UNIVERSITY_ADMIN,
        ]),
      },
    });
    const lessonId = absence.affectedLessonIds?.[0];
    const recipientDeepLinks: Record<string, string> = {
      [absence.studentId]: '/today',
      ...Object.fromEntries(universityReviewers.map((reviewer) => [reviewer.id, `/absences?absence=${absence.id}`])),
    };
    if (teacherId) {
      recipientDeepLinks[teacherId] = lessonId
        ? `/attendance?lesson=${lessonId}&absence=${absence.id}`
        : '/inbox';
    }
    await this.eventBus?.publish({
      type,
      universityId: absence.universityId,
      actor: user ? { id: user.id, type: 'user', role: user.role } : { type: 'system' },
      target: { type: 'absence', id: absence.id },
      payload: {
        studentId: absence.studentId,
        startDate: absence.startDate.toISOString(),
        endDate: absence.endDate.toISOString(),
        deepLink: '/notifications',
        recipientDeepLinks,
      },
      priority,
      recipients: [...new Set([absence.studentId, teacherId, ...universityReviewers.map((reviewer) => reviewer.id)].filter((id): id is string => Boolean(id)))],
    });
  }
}
