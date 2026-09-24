import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { MaxAuthDto } from './dto/max-auth.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AppConfig } from '../config/configuration';
import { UserRole } from './interfaces/user-role';
import { User } from '../users/entities/user.entity';
import { validateMaxInitData } from './max-init-data';

export type PortalWorkspace = 'student' | 'staff' | 'admin';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig & Record<string, unknown>>,
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

  async portalLogin(loginDto: LoginDto): Promise<AuthResponse & { workspace: PortalWorkspace }> {
    const response = await this.login(loginDto);
    const workspace = this.getPortalWorkspace(response.user.role);

    if (!workspace) {
      throw new ForbiddenException('Для разработчиков используется отдельный вход.');
    }

    return { ...response, workspace };
  }

  async maxAuth(maxAuthDto: MaxAuthDto): Promise<AuthResponse> {
    const botToken = this.configService.get<string>('max.botToken') ?? '';
    if (!botToken) {
      throw new ServiceUnavailableException({
        code: 'MAX_NOT_CONFIGURED',
        message: 'Вход через MAX не настроен: задайте MAX_BOT_TOKEN',
      });
    }

    if (Boolean(maxAuthDto.email) !== Boolean(maxAuthDto.password)) {
      throw new BadRequestException('Email и password должны указываться вместе');
    }

    const maxAgeSeconds = Number(this.configService.get('max.initDataTtlSeconds') ?? 3600);
    const payload = validateMaxInitData(maxAuthDto.initData, botToken, { maxAgeSeconds });
    if (!payload) {
      throw new UnauthorizedException({
        code: 'MAX_INVALID_INIT_DATA',
        message: 'Данные входа MAX недействительны или устарели',
      });
    }

    let user = await this.usersService.findByMaxUserId(payload.maxUserId);

    if (!user) {
      if (!maxAuthDto.email || !maxAuthDto.password) {
        throw new UnauthorizedException({
          code: 'MAX_ACCOUNT_NOT_LINKED',
          message: 'Аккаунт MAX не привязан. Войдите по email и паролю, чтобы привязать его.',
        });
      }

      user = await this.linkMaxAccount(
        payload.maxUserId,
        maxAuthDto.email.trim(),
        maxAuthDto.password,
      );
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (!user.isActive) {
      throw new ForbiddenException('Аккаунт деактивирован');
    }

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

  private async linkMaxAccount(
    maxUserId: string,
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    try {
      return await this.usersService.update(user.id, { maxUserId });
    } catch (error) {
      const driverCode = (error as { driverError?: { code?: string } })?.driverError?.code;
      if (driverCode === '23505') {
        throw new ConflictException('Этот аккаунт MAX уже привязан к другому пользователю');
      }
      throw error;
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

  private getPortalWorkspace(role: UserRole): PortalWorkspace | null {
    if (role === UserRole.STUDENT) return 'student';
    if ([UserRole.TEACHER, UserRole.CURATOR, UserRole.FACULTY_DEAN, UserRole.DEPARTMENT_HEAD].includes(role)) return 'staff';
    if ([UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN].includes(role)) return 'admin';
    return null;
  }
}
