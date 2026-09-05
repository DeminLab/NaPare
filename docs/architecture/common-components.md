# Common Guards, Interceptors, Filters

## Структура

```
apps/backend/src/common/
├── decorators/
│   ├── roles.decorator.ts
│   ├── current-user.decorator.ts
│   └── university.decorator.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── jwt-refresh.guard.ts
│   ├── roles.guard.ts
│   └── university.guard.ts
├── interceptors/
│   ├── transform.interceptor.ts
│   ├── logging.interceptor.ts
│   └── cache.interceptor.ts
├── filters/
│   └── http-exception.filter.ts
└── pipes/
    ├── validation.pipe.ts
    └── parse-uuid.pipe.ts
```

## Guards

```typescript
// guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}

// guards/jwt-refresh.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}

// guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../shared/constants/roles';
import { ROLE_HIERARCHY } from '../../shared/constants/roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.roles) {
      return false;
    }

    // Пользователь имеет доступ если его роль выше или равна требуемой
    const userMaxRole = Math.max(...user.roles.map((r: Role) => ROLE_HIERARCHY[r] || 0));
    const requiredMinRole = Math.min(...requiredRoles.map((r: Role) => ROLE_HIERARCHY[r] || 0));

    return userMaxRole >= requiredMinRole;
  }
}

// guards/university.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class UniversityGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipUniversity = this.reflector.getAllAndOverride<boolean>('skipUniversity', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipUniversity) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.universityId) {
      request.universityId = user.universityId;
    }

    return true;
  }
}
```

## Decorators

```typescript
// decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../../shared/constants/roles';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);

// decorators/university.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UniversityId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.universityId || request.user?.universityId;
  },
);

// decorators/is-public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

// decorators/skip-university.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const SKIP_UNIVERSITY_KEY = 'skipUniversity';
export const SkipUniversity = () => SetMetadata(SKIP_UNIVERSITY_KEY, true);
```

## Interceptors

```typescript
// interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: {
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}

// interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, user } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startTime;
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;

        this.logger.log(
          `${method} ${url} ${statusCode} ${elapsed}ms - ${ip} - ${user?.id || 'anonymous'}`,
        );
      }),
    );
  }
}

// interceptors/cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.method !== 'GET') {
      return next.handle();
    }

    const key = this.generateKey(request);
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.data);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 минут
        });
      }),
    );
  }

  private generateKey(request: any): string {
    return `${request.url}-${request.user?.id || 'anonymous'}`;
  }
}
```

## Exception Filter

```typescript
// filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.getStatusCode(exception);
    const code = this.getErrorCode(exception);
    const message = this.getMessage(exception);
    const details = this.getDetails(exception);

    // Логируем ошибку
    this.logger.error({
      statusCode: status,
      code,
      message,
      path: request.url,
      method: request.method,
      userId: (request as any).user?.id,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      details,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Отправляем в Sentry для 5xx ошибок
    if (status >= 500) {
      Sentry.captureException(exception as Error, {
        extra: {
          path: request.url,
          userId: (request as any).user?.id,
          statusCode: status,
        },
      });
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details && { details }),
      },
    });
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return this.httpStatusToCode(status);
      }

      return (response as any)?.error?.code || this.httpStatusToCode(status);
    }
    return 'INTERNAL_ERROR';
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      return (response as any)?.message || exception.message;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Внутренняя ошибка сервера';
  }

  private getDetails(exception: unknown): any[] | undefined {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && Array.isArray((response as any)?.message)) {
        return (response as any).message.map((msg: string) => ({
          message: msg,
        }));
      }
    }
    return undefined;
  }

  private httpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'ALREADY_EXISTS',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      502: 'EXTERNAL_SERVICE_ERROR',
    };
    return map[status] || 'INTERNAL_ERROR';
  }
}
```

## Validation Pipe

```typescript
// pipes/validation.pipe.ts
import { ValidationPipe as NestValidationPipe } from '@nestjs/common';

export const AppValidationPipe = new NestValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});
```

## app.module.ts (пример использования)

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from './schedule/schedule.module';
import { PairSpaceModule } from './pair-space/pair-space.module';
import { AbsencesModule } from './absences/absences.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { DatabaseModule } from './database/database.module';

import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { UniversityMiddleware } from './common/middleware/university.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    AuthModule,
    UsersModule,
    ScheduleModule,
    PairSpaceModule,
    AbsencesModule,
    NotificationsModule,
    AdminModule,
    DatabaseModule,
  ],
  providers: [
    {
      provide: 'APP_INTERCEPTOR',
      useClass: TransformInterceptor,
    },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: LoggingInterceptor,
    },
    {
      provide: 'APP_FILTER',
      useClass: AllExceptionsFilter,
    },
    {
      provide: 'APP_PIPE',
      useValue: AppValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UniversityMiddleware)
      .forRoutes('*');
  }
}
```