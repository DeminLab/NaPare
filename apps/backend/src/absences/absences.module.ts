import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Absence } from './entities/absence.entity';
import { AbsenceConfirmation } from './entities/absence-confirmation.entity';
import { AbsencesService } from './absences.service';
import { AbsencesController } from './absences.controller';
import { CuratorController } from './curator.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Absence, AbsenceConfirmation]),
    EventsModule,
  ],
  providers: [AbsencesService],
  controllers: [AbsencesController, CuratorController],
  exports: [AbsencesService],
})
export class AbsencesModule {}
