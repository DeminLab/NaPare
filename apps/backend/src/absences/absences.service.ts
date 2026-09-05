import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
      order: { date: 'DESC', pairNumber: 'ASC' },
    });
  }

  async findByLesson(lessonId: string): Promise<Absence[]> {
    return this.absenceRepository.find({
      where: { lessonId },
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
        date: Between(new Date(startDate), new Date(endDate)),
      },
      order: { date: 'DESC', pairNumber: 'ASC' },
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

  async confirm(id: string, curatorId: string): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }

    absence.status = 'excused';
    absence.confirmedBy = curatorId;
    absence.confirmedAt = new Date();

    return this.absenceRepository.save(absence);
  }

  async excuse(
    id: string,
    curatorId: string,
    reason: string,
  ): Promise<Absence> {
    const absence = await this.absenceRepository.findOne({ where: { id } });

    if (!absence) {
      throw new NotFoundException(`Absence with id ${id} not found`);
    }

    absence.isExcused = true;
    absence.excusedBy = curatorId;
    absence.excusedAt = new Date();
    absence.reason = reason;
    absence.status = 'excused';

    return this.absenceRepository.save(absence);
  }

  async getStats(
    universityId: string,
    studentId: string,
  ): Promise<{ total: number; excused: number; unexcused: number }> {
    const absences = await this.absenceRepository.find({
      where: { universityId, studentId },
    });

    const total = absences.length;
    const excused = absences.filter((a) => a.isExcused).length;
    const unexcused = total - excused;

    return { total, excused, unexcused };
  }
}

function Between(startDate: Date, endDate: Date) {
  return { $gte: startDate, $lte: endDate } as any;
}
