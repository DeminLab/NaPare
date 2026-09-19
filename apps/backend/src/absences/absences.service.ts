import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ArrayContains } from 'typeorm';

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

export const ABSENCE_STAFF_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.CURATOR,
  UserRole.DEPARTMENT_HEAD,
  UserRole.FACULTY_DEAN,
  UserRole.UNIVERSITY_ADMIN,
  UserRole.SUPERADMIN,
];

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(Absence)
    private readonly absenceRepository: Repository<Absence>,
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
    const absence = this.absenceRepository.create({
      universityId,
      studentId: user.id,
      type: createAbsenceDto.type,
      startDate: new Date(createAbsenceDto.startDate),
      endDate: new Date(createAbsenceDto.endDate),
      comment: createAbsenceDto.comment,
      source: 'manual',
      syncStatus: 'synced',
    });
    const saved = await this.absenceRepository.save(absence);
    await this.publishAbsence('absence.created', saved, 'normal');
    return saved;
  }

  async update(id: string, updateAbsenceDto: UpdateAbsenceDto): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.assertCanMutate(absence);

    Object.assign(absence, {
      ...updateAbsenceDto,
      ...(updateAbsenceDto.startDate && { startDate: new Date(updateAbsenceDto.startDate) }),
      ...(updateAbsenceDto.endDate && { endDate: new Date(updateAbsenceDto.endDate) }),
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

  async confirm(id: string, curatorId: string, comment?: string): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.assertStaffAccess(absence.universityId);

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

    absence.comment = reason;
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

  private assertStaffAccess(universityId: string): void {
    const user = this.tenantContext.getUser();
    if (!user || !ABSENCE_STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('Staff role required');
    }
    this.tenantContext.assertAccess(universityId);
  }

  private async publishAbsence(
    type: 'absence.created' | 'absence.updated',
    absence: Absence,
    priority: 'normal' | 'high',
  ): Promise<void> {
    const user = this.tenantContext.getUser();
    await this.eventBus?.publish({
      type,
      universityId: absence.universityId,
      actor: user ? { id: user.id, type: 'user', role: user.role } : { type: 'system' },
      target: { type: 'absence', id: absence.id },
      payload: {
        studentId: absence.studentId,
        startDate: absence.startDate.toISOString(),
        endDate: absence.endDate.toISOString(),
        deepLink: `/attendance/absences/${absence.id}`,
      },
      priority,
      recipients: [absence.studentId],
    });
  }
}
