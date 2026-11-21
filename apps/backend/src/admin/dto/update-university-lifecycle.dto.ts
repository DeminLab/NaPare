import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateUniversityDto } from './update-university.dto';

/** Update shape for the legacy superadmin route, which owns lifecycle fields. */
export class UpdateUniversityLifecycleDto extends UpdateUniversityDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'pending'] })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: string;
}
