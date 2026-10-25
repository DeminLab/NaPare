import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoodleModule } from '../moodle/moodle.module';
import { AcademicIdentity } from './academic-identity.entity';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';

@Module({ imports: [TypeOrmModule.forFeature([AcademicIdentity]), MoodleModule], controllers: [SemesterController], providers: [SemesterService] })
export class SemesterModule {}
