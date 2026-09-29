import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenantContextModule } from '../common/tenant/tenant-context.module';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Group } from '../users/entities/group.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { University } from '../users/entities/university.entity';
import { RaspModule } from '../rasp/rasp.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lesson, Group, University, Homework, FileAttachment, PairSpace]), TenantContextModule, RaspModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
