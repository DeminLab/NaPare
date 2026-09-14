import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';
import { ConnectorResponseDto } from './dto/connector-response.dto';
import { CreateUniversityDto } from './dto/create-university.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';

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

  async getUniversities(
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<University>> {
    const [data, total] = await this.universityRepository.findAndCount({
      order: { name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createUniversity(data: CreateUniversityDto): Promise<University> {
    const university = this.universityRepository.create(data);
    return this.universityRepository.save(university);
  }

  async updateUniversity(id: string, updateData: UpdateUniversityDto): Promise<University> {
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

  async getConnectors(
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<ConnectorResponseDto>> {
    const connectors: ConnectorResponseDto[] = [
      { id: 'sibit', name: 'SIBIT', type: 'api', status: 'active' },
      { id: 'excel', name: 'Excel Import', type: 'file', status: 'active' },
    ];
    const start = (pagination.page - 1) * pagination.limit;
    return toPaginatedResponse(connectors.slice(start, start + pagination.limit), connectors.length, pagination);
  }

  async updateConnector(
    id: string,
    updateData: UpdateConnectorDto,
  ): Promise<{ id: string; updatedAt: string } & UpdateConnectorDto> {
    return { id, ...updateData, updatedAt: new Date().toISOString() };
  }
}
