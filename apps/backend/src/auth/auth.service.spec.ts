import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { University } from '../users/entities/university.entity';
import { RaspScraperService } from './rasp-scraper.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;
  let raspScraperService: { isValidGroup: jest.Mock };

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
    raspScraperService = { isValidGroup: jest.fn() };

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
        { provide: getRepositoryToken(University), useValue: { findOne: jest.fn().mockResolvedValue({ id: 'uni-1', name: 'СИБИТ', city: 'Омск', status: 'active' }) } },
        { provide: RaspScraperService, useValue: raspScraperService },
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

  describe('register', () => {
    it('should throw ConflictException for existing user', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue({ id: '1' });
      await expect(
        service.register({
          email: 'test@test.com',
          password: 'pass',
          firstName: 'Test',
          lastName: 'User',
          universityId: 'uni-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('normalizes an email before creating a student account', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.create as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'student@sibit.ru',
        firstName: 'Тест',
        lastName: 'Студент',
        role: 'student',
        universityId: 'uni-1',
        groupId: '12136',
      });
      raspScraperService.isValidGroup.mockResolvedValue(true);

      await service.register({
        email: ' Student@SIBIT.RU ', password: 'correct-password', firstName: 'Тест', lastName: 'Студент', universityId: 'uni-1', groupId: '12136',
      });

      expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'student@sibit.ru' }));
    });
  });
});
