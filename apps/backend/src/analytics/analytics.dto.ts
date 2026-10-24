import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class AnalyticsReportDto {
  @ApiProperty({example:'2026-10-19'}) @Matches(/^\d{4}-\d{2}-\d{2}$/) weekStart:string;
  @ApiProperty({example:'2026-09-01'}) @Matches(/^\d{4}-\d{2}-\d{2}$/) semesterStart:string;
  @ApiProperty({example:'2026-12-31'}) @Matches(/^\d{4}-\d{2}-\d{2}$/) semesterEnd:string;
}
export class AnalyticsReadinessDto {
  @ApiProperty() @IsDateString({strict:true}) startDate:string;
  @ApiProperty() @IsDateString({strict:true}) endDate:string;
}
