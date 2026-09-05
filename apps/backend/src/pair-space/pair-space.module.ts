import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { PairSpaceService } from './pair-space.service';
import { PairSpaceController } from './pair-space.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PairSpace, Announcement, Homework])],
  providers: [PairSpaceService],
  controllers: [PairSpaceController],
  exports: [PairSpaceService],
})
export class PairSpaceModule {}
