import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SibitUniversityBootstrapService } from './sibit-university-bootstrap.service';
import { UsersModule } from '../users/users.module';
import { University } from '../users/entities/university.entity';
import { AppConfig } from '../config/configuration';
import { RaspModule } from '../rasp/rasp.module';

@Module({
  imports: [
    UsersModule,
    RaspModule,
    PassportModule,
    TypeOrmModule.forFeature([University]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig & Record<string, unknown>>) => ({
        secret: configService.getOrThrow<string>('auth.jwt.secret'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('auth.jwt.accessExpiration'),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, SibitUniversityBootstrapService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
