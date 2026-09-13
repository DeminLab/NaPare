import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';

@Injectable()
export class SuperadminService {
  constructor(
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
  ) {}

  async getUniversities(): Promise<University[]> {
    return this.universityRepository.find({
      order: { name: 'ASC' },
    });
  }

  async createUniversity(data: any): Promise<University> {
    const university = this.universityRepository.create(data);
    return this.universityRepository.save(university as any) as Promise<University>;
  }

  async updateUniversity(id: string, updateData: any): Promise<University> {
    const university = await this.universityRepository.findOne({ where: { id } });

    if (!university) {
      throw new NotFoundException(`University with id ${id} not found`);
    }

    Object.assign(university, updateData);
    return this.universityRepository.save(university) as Promise<University>;
  }

  async deleteUniversity(id: string): Promise<void> {
    const university = await this.universityRepository.findOne({ where: { id } });

    if (!university) {
      throw new NotFoundException(`University with id ${id} not found`);
    }

    await this.universityRepository.delete(id);
  }

  async getConnectors(): Promise<any[]> {
    return [
      { id: 'sibit', name: 'SIBIT', type: 'api', status: 'active' },
      { id: 'excel', name: 'Excel Import', type: 'file', status: 'active' },
    ];
  }

  async updateConnector(id: string, updateData: any): Promise<any> {
    return { id, ...updateData, updatedAt: new Date().toISOString() };
  }
}
