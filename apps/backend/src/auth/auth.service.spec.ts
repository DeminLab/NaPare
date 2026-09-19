import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('15m'),
            getOrThrow: jest.fn((key: string) => key === 'auth.jwt.refreshSecret' ? 'test-refresh-secret' : '30d'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('finds an account with an email entered in a different case', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'student@sibit.ru',
        passwordHash,
        isActive: true,
        firstName: 'Тест',
        lastName: 'Студент',
        role: 'student',
        universityId: 'uni-1',
        groupId: '12136',
      });

      await service.login({ email: 'Student@SIBIT.RU', password: 'correct-password' });

      expect(usersService.findByEmail).toHaveBeenCalledWith('Student@SIBIT.RU');
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  describe('portalLogin', () => {
    it.each([
      ['student', 'student'],
      ['teacher', 'staff'],
      ['university_admin', 'admin'],
    ])('assigns %s to the %s workspace', async (role, workspace) => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'user@sibit.ru', passwordHash, isActive: true, firstName: 'Тест', lastName: 'Пользователь', role, universityId: 'uni-1' });

      await expect(service.portalLogin({ email: 'user@sibit.ru', password: 'correct-password' })).resolves.toMatchObject({ workspace });
    });

    it('rejects the developer role because it has a separate login', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({ id: 'developer-1', email: 'dev@sibit.ru', passwordHash, isActive: true, firstName: 'Тест', lastName: 'Разработчик', role: 'developer', universityId: 'uni-1' });

      await expect(service.portalLogin({ email: 'dev@sibit.ru', password: 'correct-password' })).rejects.toThrow(ForbiddenException);
    });
  });
});
