import { CareerModule } from './career/career.module';
import { ProductAnalyticsModule } from './analytics/analytics.module';
import { SemesterModule } from './semester/semester.module';
import { PaymentModule } from './career-billing/payment.module';

import { CurationModule } from './curation/curation.module';
import { RequestModule } from './requests/request.module';
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
import { DataSource, DataSourceOptions } from 'typeorm';
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
import { TenantContext } from './common/tenant/tenant-context';
import { assertTenantDatabase, assertTenantDatabaseRole, installTenantDatabase } from './common/tenant/tenant-database';
import { TenantRowSecurity1700000000029 } from './migrations/1700000000029-TenantRowSecurity';
import { PersonalDataRead1700000000037 } from './migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from './migrations/1700000000038-AccountErasure';
import { CareerModeration1700000000040 } from './migrations/1700000000040-CareerModeration';
import { ProductAnalytics1700000000041 } from './migrations/1700000000041-ProductAnalytics';
import { EventsModule } from './events/events.module';
import { AcademicModule } from './academic/academic.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ProductAnalyticsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validate: validateEnvironment,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, TenantContextModule],
      inject: [ConfigService, TenantContext],
      dataSourceFactory: async (options) => {
        const { tenantContext, ...databaseOptions } = options as DataSourceOptions & { tenantContext: TenantContext };
        // Connect/build metadata first, but never mutate schema before checking
        // that the runtime role cannot bypass row security.
        const source = new DataSource({ ...databaseOptions, synchronize: false, migrationsRun: false } as DataSourceOptions);
        try {
          await source.initialize();
          await assertTenantDatabaseRole(source);
          if (databaseOptions.migrationsRun) await source.runMigrations({ transaction: databaseOptions.migrationsTransactionMode });
          // Development schema synchronization does not run migrations. Apply
          // the same policies so development never silently disables isolation.
          if (databaseOptions.synchronize) {
            await source.synchronize();
            const runner = source.createQueryRunner();
            try { await new TenantRowSecurity1700000000029().up(runner); await new PersonalDataRead1700000000037().up(runner); await new AccountErasure1700000000038().up(runner); await new CareerModeration1700000000040().up(runner); await new ProductAnalytics1700000000041().up(runner); }
            finally { await runner.release(); }
          }
          await assertTenantDatabase(source);
          source.setOptions(databaseOptions as DataSourceOptions);
          return installTenantDatabase(source, tenantContext);
        } catch (error) {
          if (source.isInitialized) await source.destroy();
          throw error;
        }
      },
      useFactory: (configService: ConfigService<AppConfig & Record<string, unknown>>, tenantContext: TenantContext) => {
        // Support both DATABASE_URL and individual DB_* vars
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            tenantContext,
            type: 'postgres' as const,
            url: databaseUrl,
            autoLoadEntities: true,
            migrations: [join(__dirname, 'migrations/*.{js,ts}')],
            migrationsRun: configService.getOrThrow('nodeEnv') === 'production',
            synchronize: configService.getOrThrow('nodeEnv') !== 'production',
          };
        }
        return {
          tenantContext,
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
    PaymentModule,
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
    RequestModule,
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
    SemesterModule,
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
