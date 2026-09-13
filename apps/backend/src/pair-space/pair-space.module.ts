import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PairSpace } from './entities/pair-space.entity';
import { Announcement } from './entities/announcement.entity';
import { Homework } from './entities/homework.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { DiscussionMessage } from './entities/discussion-message.entity';
import { HomeworkSubmission } from './entities/homework-submission.entity';
import { PairSpaceService } from './pair-space.service';
import { PairSpaceController } from './pair-space.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PairSpace,
      Announcement,
      Homework,
      FileAttachment,
      DiscussionMessage,
      HomeworkSubmission,
    ]),
  ],
  providers: [PairSpaceService],
  controllers: [PairSpaceController],
  exports: [PairSpaceService],
})
export class PairSpaceModule {}
