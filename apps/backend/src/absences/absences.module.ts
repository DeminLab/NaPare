import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Absence } from './entities/absence.entity';
import { AbsencesService } from './absences.service';
import { AbsencesController } from './absences.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Absence])],
  providers: [AbsencesService],
  controllers: [AbsencesController],
  exports: [AbsencesService],
})
export class AbsencesModule {}
