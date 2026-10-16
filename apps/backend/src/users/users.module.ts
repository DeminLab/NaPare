import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { University } from './entities/university.entity';
import { Faculty } from './entities/faculty.entity';
import { Group } from './entities/group.entity';
import { Teacher } from './entities/teacher.entity';
import { TelegramLinkChallenge } from './entities/telegram-link-challenge.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    PlatformModule,
    TypeOrmModule.forFeature([User, University, Faculty, Group, Teacher, TelegramLinkChallenge]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
