import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(Absence)
    private readonly absenceRepository: Repository<Absence>,
    private readonly tenantContext: TenantContext,
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
    this.tenantContext.assertAccess(universityId);
    const absence = this.absenceRepository.create({ ...createAbsenceDto, universityId });
    return this.absenceRepository.save(absence);
  }

  async update(id: string, updateAbsenceDto: UpdateAbsenceDto): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.tenantContext.assertAccess(absence.universityId);

    Object.assign(absence, updateAbsenceDto);
    return this.absenceRepository.save(absence);
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
    this.tenantContext.assertAccess(absence.universityId);

    absence.confirmationRequired = false;
    if (comment) {
      absence.comment = comment;
    }
    return this.absenceRepository.save(absence);
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
    this.tenantContext.assertAccess(absence.universityId);

    absence.comment = reason;
    return this.absenceRepository.save(absence);
  }

  async delete(id: string): Promise<void> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }
    this.tenantContext.assertAccess(absence.universityId);

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
}
