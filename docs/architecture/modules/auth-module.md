# Backend Module: Auth — Детальная реализация

## Структура модуля

```
apps/backend/src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── jwt-refresh.strategy.ts
├── dto/
│   ├── request-code.dto.ts
│   ├── verify-code.dto.ts
│   ├── refresh.dto.ts
│   └── max-auth.dto.ts
└── interfaces/
    └── auth-result.interface.ts
```

## auth.module.ts

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { User } from '../users/entities/user.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, DeviceToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_EXPIRY', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

## auth.service.ts

```typescript
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

import { User } from '../users/entities/user.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResult } from './interfaces/auth-result.interface';

@Injectable()
export class AuthService {
  // Временное хранилище кодов (в проде — Redis)
  private readonly codeStorage = new Map<string, { code: string; expiresAt: Date }>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Отправка кода верификации на телефон
   */
  async requestCode(phone: string): Promise<{ message: string }> {
    // Генерация 6-значного кода
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Сохранение кода (в проде — Redis с TTL)
    this.codeStorage.set(phone, { code, expiresAt });

    // TODO: Отправка SMS через провайдера
    console.log(`[DEV] SMS код для ${phone}: ${code}`);

    return { message: 'Код отправлен' };
  }

  /**
   * Верификация кода и выдача токенов
   */
  async verifyCode(phone: string, code: string): Promise<AuthResult> {
    // Проверка кода
    const stored = this.codeStorage.get(phone);
    if (!stored) {
      throw new BadRequestException('Код не запрашивался');
    }

    if (stored.expiresAt < new Date()) {
      this.codeStorage.delete(phone);
      throw new BadRequestException('Код истёк');
    }

    if (stored.code !== code) {
      throw new BadRequestException('Неверный код');
    }

    // Удаление использованного кода
    this.codeStorage.delete(phone);

    // Поиск или создание пользователя
    let user = await this.userRepository.findOne({ where: { phone } });

    if (!user) {
      user = this.userRepository.create({
        phone,
        firstName: 'Студент', // Временно, потом спросим в онбординге
        lastName: '',
        roles: ['student'],
        needsOnboarding: true,
      });
      user = await this.userRepository.save(user);
    }

    // Генерация токенов
    return this.generateTokens(user);
  }

  /**
   * Обновление access token
   */
  async refreshTokens(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Невалидный refresh token');
    }
  }

  /**
   * Выход (инвалидация refresh token)
   */
  async logout(userId: string, deviceToken?: string): Promise<void> {
    // Удаление device token для push уведомлений
    if (deviceToken) {
      await this.deviceTokenRepository.delete({ token: deviceToken });
    }

    // В проде — добавить refresh token в blacklist (Redis)
  }

  /**
   * Авторизация через MAX
   */
  async maxAuth(initData: string): Promise<AuthResult> {
    // TODO: Валидация initData через MAX SDK
    // Пока заглушка
    const mockPhone = `+7${randomInt(1000000000, 9999999999)}`;

    let user = await this.userRepository.findOne({ where: { phone: mockPhone } });

    if (!user) {
      user = this.userRepository.create({
        phone: mockPhone,
        firstName: 'MAX User',
        lastName: '',
        roles: ['student'],
        needsOnboarding: true,
      });
      user = await this.userRepository.save(user);
    }

    return this.generateTokens(user);
  }

  /**
   * Генерация пары токенов
   */
  private async generateTokens(user: User): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      universityId: user.universityId,
      roles: user.roles,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '60d'),
      }),
    ]);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        roles: user.roles,
        universityId: user.universityId,
        groupId: user.groupId,
        needsOnboarding: user.needsOnboarding,
      },
      accessToken,
      refreshToken,
    };
  }
}
```

## auth.controller.ts

```typescript
import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MaxAuthDto } from './dto/max-auth.dto';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh.guard';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  @ApiOperation({ summary: 'Отправка SMS кода' })
  @ApiResponse({ status: 200, description: 'Код отправлен' })
  @ApiResponse({ status: 400, description: 'Неверный формат телефона' })
  async requestCode(@Body() dto: RequestCodeDto) {
    return this.authService.requestCode(dto.phone);
  }

  @Post('verify-code')
  @ApiOperation({ summary: 'Верификация кода и вход' })
  @ApiResponse({ status: 200, description: 'Успешная авторизация' })
  @ApiResponse({ status: 400, description: 'Неверный или истёкший код' })
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto.phone, dto.code);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Обновление access token' })
  @ApiResponse({ status: 200, description: 'Новые токены' })
  @ApiResponse({ status: 401, description: 'Невалидный refresh token' })
  async refresh(@Request() req) {
    return this.authService.refreshTokens(req.user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход из системы' })
  async logout(@Request() req) {
    return this.authService.logout(req.user?.id, req.body?.deviceToken);
  }

  @Post('max')
  @ApiOperation({ summary: 'Авторизация через MAX' })
  async maxAuth(@Body() dto: MaxAuthDto) {
    return this.authService.maxAuth(dto.initData);
  }
}
```

## DTO

```typescript
// dto/request-code.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RequestCodeDto {
  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон должен быть в формате +7XXXXXXXXXX' })
  phone: string;
}

// dto/verify-code.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @Matches(/^\+7\d{10}$/)
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

// dto/refresh.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

// dto/max-auth.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MaxAuthDto {
  @ApiProperty()
  @IsString()
  initData: string;
}
```

## JWT Strategy

```typescript
// strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      universityId: user.universityId,
      roles: user.roles,
      groupId: user.groupId,
    };
  }
}

// strategies/jwt-refresh.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, refreshToken: payload };
  }
}
```

## Интерфейсы

```typescript
// interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // userId
  universityId: string;
  roles: string[];
}

// interfaces/auth-result.interface.ts
export interface AuthResult {
  user: {
    id: string;
    phone?: string;
    email?: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    roles: string[];
    universityId?: string;
    groupId?: string;
    needsOnboarding: boolean;
  };
  accessToken: string;
  refreshToken: string;
}
```

## Тесты

```typescript
// auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;

  const mockUser = {
    id: 'uuid-1',
    phone: '+79991234567',
    firstName: 'Test',
    lastName: 'User',
    roles: ['student'],
    universityId: 'uuid-university',
    groupId: 'uuid-group',
    isActive: true,
    needsOnboarding: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DeviceToken),
          useValue: {
            delete: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRY: '15m',
                JWT_REFRESH_EXPIRY: '60d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestCode', () => {
    it('should generate and store code', async () => {
      const result = await service.requestCode('+79991234567');
      expect(result.message).toBe('Код отправлен');
    });
  });

  describe('verifyCode', () => {
    it('should return tokens for valid code', async () => {
      // Setup code storage
      await service.requestCode('+79991234567');

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.verifyCode('+79991234567', '123456');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw for invalid code', async () => {
      await service.requestCode('+79991234567');
      
      await expect(
        service.verifyCode('+79991234567', '000000'),
      ).rejects.toThrow('Неверный код');
    });
  });
});
```

## auth.controller.e2e-spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth.module';
import { User } from '../users/entities/user.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, DeviceToken],
          synchronize: true,
        }),
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/request-code (POST)', () => {
    it('should send code', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/request-code')
        .send({ phone: '+79991234567' })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Код отправлен');
        });
    });

    it('should return 400 for invalid phone', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/request-code')
        .send({ phone: 'invalid' })
        .expect(400);
    });
  });
});
```