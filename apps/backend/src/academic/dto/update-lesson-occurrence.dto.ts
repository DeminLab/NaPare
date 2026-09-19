import { PartialType } from '@nestjs/swagger';

import { CreateLessonOccurrenceDto } from './create-lesson-occurrence.dto';

export class UpdateLessonOccurrenceDto extends PartialType(CreateLessonOccurrenceDto) {}
