import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { Absence } from './entities/absence.entity';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(Absence)
    private readonly absenceRepository: Repository<Absence>,
  ) {}

  async findByStudent(studentId: string): Promise<Absence[]> {
    return this.absenceRepository.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByLesson(lessonId: string): Promise<Absence[]> {
    return this.absenceRepository.find({
      where: { affectedLessonIds: lessonId } as any,
    });
  }

  async findByDateRange(
    universityId: string,
    startDate: string,
    endDate: string,
  ): Promise<Absence[]> {
    return this.absenceRepository.find({
      where: {
        universityId,
        startDate: Between(new Date(startDate), new Date(endDate)),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async create(createAbsenceDto: CreateAbsenceDto): Promise<Absence> {
    const absence = this.absenceRepository.create(createAbsenceDto);
    return this.absenceRepository.save(absence);
  }

  async update(id: string, updateAbsenceDto: UpdateAbsenceDto): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }

    Object.assign(absence, updateAbsenceDto);
    return this.absenceRepository.save(absence);
  }

  async findByUniversity(
    universityId: string,
    status?: string,
  ): Promise<Absence[]> {
    const where: any = { universityId };
    if (status === 'pending') {
      where.confirmationRequired = true;
    }
    return this.absenceRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async confirm(id: string, curatorId: string, comment?: string): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }

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

    absence.comment = reason;
    return this.absenceRepository.save(absence);
  }

  async delete(id: string): Promise<void> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }

    await this.absenceRepository.delete(id);
  }

  async getStats(
    universityId: string,
    studentId: string,
  ): Promise<{ total: number; byType: Record<string, number> }> {
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
