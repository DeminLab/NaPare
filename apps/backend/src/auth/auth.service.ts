import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AppConfig } from '../config/configuration';
import { UserRole } from './interfaces/user-role';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { RaspScraperService, SIBIT_UNIVERSITY } from './rasp-scraper.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig & Record<string, unknown>>,
    @InjectRepository(University)
    private readonly universitiesRepository: Repository<University>,
    private readonly raspScraperService: RaspScraperService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email.trim());

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const university = await this.universitiesRepository.findOne({
      where: {
        id: registerDto.universityId,
        name: SIBIT_UNIVERSITY.name,
        city: SIBIT_UNIVERSITY.city,
        status: 'active',
      },
    });
    if (!university) {
      throw new BadRequestException('Регистрация доступна только для СИБИТа в Омске');
    }

    if (registerDto.groupId && !(await this.raspScraperService.isValidGroup(registerDto.groupId))) {
      throw new BadRequestException('Выбранная группа отсутствует в актуальном расписании СИБИТа');
    }

    const email = registerDto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.create({
      email,
      passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.STUDENT,
      universityId: registerDto.universityId,
      groupId: registerDto.groupId,
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('auth.jwt.refreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || user.role !== payload.role) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      universityId: user.universityId,
      groupId: user.groupId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('auth.jwt.refreshSecret'),
      expiresIn: this.configService.getOrThrow<string>('auth.jwt.refreshExpiration'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
