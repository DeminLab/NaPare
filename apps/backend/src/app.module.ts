import { CareerModule } from './career/career.module';
import { CurationModule } from './curation/curation.module';
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PlatformModule } from './platform/platform.module';
import { PlatformDataModule } from './platform-data/platform-data.module';
import { PlatformRecordsModule } from './platform-records/platform-records.module';
import { PlatformCareerModule } from './platform-career/platform-career.module';
import { PlatformDiscussionsModule } from './platform-discussions/platform-discussions.module';
import { PlatformHomeworkModule } from './platform-homework/platform-homework.module';
import { PlatformNotificationsModule } from './platform-notifications/platform-notifications.module';
import { PlatformCurationModule } from './platform-curation/platform-curation.module';
import { PlatformAttendanceQrModule } from './platform-attendance-qr/platform-attendance-qr.module';
import { PlatformPairSpaceModule } from './platform-pair-space/platform-pair-space.module';
import { PlatformAcademicModule } from './platform-academic/platform-academic.module';
import { PlatformEventsModule } from './platform-events/platform-events.module';
import { PlatformAttachmentsModule } from './platform-attachments/platform-attachments.module';
import { PlatformMaintenanceInterceptor } from './platform/platform-maintenance.interceptor';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from './schedule/schedule.module';
import { PairSpaceModule } from './pair-space/pair-space.module';
import { AbsencesModule } from './absences/absences.module';
import { FavoritesModule } from './favorites/favorites.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { MyDayModule } from './my-day/my-day.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { validateEnvironment } from './config/validate-environment';
import { AppConfig } from './config/configuration';
import { TenantContextModule } from './common/tenant/tenant-context.module';
import { EventsModule } from './events/events.module';
import { AcademicModule } from './academic/academic.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validate: validateEnvironment,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig & Record<string, unknown>>) => {
        // Support both DATABASE_URL and individual DB_* vars
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            autoLoadEntities: true,
            migrations: [join(__dirname, 'migrations/*.{js,ts}')],
            migrationsRun: configService.getOrThrow('nodeEnv') === 'production',
            synchronize: configService.getOrThrow('nodeEnv') !== 'production',
          };
        }
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'napare'),
          autoLoadEntities: true,
          migrations: [join(__dirname, 'migrations/*.{js,ts}')],
          migrationsRun: configService.getOrThrow('nodeEnv') === 'production',
          synchronize: configService.getOrThrow('nodeEnv') !== 'production',
        };
      },
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig & Record<string, unknown>>) => [{
        ttl: configService.get<number>('rateLimit.windowMs', 60000),
        limit: configService.get<number>('rateLimit.max', 100),
      }],
    }),
    CareerModule,
    PlatformModule,
    PlatformDataModule,
    PlatformRecordsModule,
    PlatformCareerModule,
    PlatformDiscussionsModule,
    PlatformHomeworkModule,
    PlatformNotificationsModule,
    PlatformCurationModule,
    PlatformAttendanceQrModule,
    PlatformPairSpaceModule,
    PlatformAcademicModule,
    PlatformEventsModule,
    PlatformAttachmentsModule,
    CurationModule,
    AuthModule,
    UsersModule,
    ScheduleModule,
    PairSpaceModule,
    AbsencesModule,
    FavoritesModule,
    NotificationsModule,
    AdminModule,
    MyDayModule,
    DatabaseModule,
    TenantContextModule,
    EventsModule,
    AcademicModule,
    SearchModule,
  ],
  controllers: [AppController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_INTERCEPTOR, useClass: PlatformMaintenanceInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Middleware can be added here
  }
}
