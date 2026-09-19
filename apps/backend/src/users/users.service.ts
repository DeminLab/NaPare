import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    this.tenantContext.assertAccess(createUserDto.universityId);
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (user) this.tenantContext.assertAccess(user.universityId);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  async findByUniversityId(
    universityId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    roles?: UserRole[],
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.usersRepository.findAndCount({
      where: { universityId, ...(roles?.length ? { role: In(roles) } : {}) },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findByGroupId(
    groupId: string,
    universityId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.usersRepository.findAndCount({
      where: { groupId, universityId },
      order: { lastName: 'ASC', firstName: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findActiveByUniversityId(universityId: string): Promise<User[]> {
    this.tenantContext.assertAccess(universityId);
    return this.usersRepository.find({
      where: { universityId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findActiveByGroupId(universityId: string, groupId: string): Promise<User[]> {
    this.tenantContext.assertAccess(universityId);
    return this.usersRepository.find({
      where: { universityId, groupId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    Object.assign(user, updateData);
    return this.usersRepository.save(user);
  }

  async bindGroup(id: string, groupId: string): Promise<User> {
    return this.update(id, { groupId });
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;
    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    await this.usersRepository.update(user.id, { isActive: false });
  }
}
