import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventRecord } from './entities/event-record.entity';
import { EventBusService } from './event-bus.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventRecord]), EventEmitterModule],
  providers: [EventBusService],
  controllers: [EventsController],
  exports: [EventBusService],
})
export class EventsModule {}
