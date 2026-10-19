import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';

export class PlatformPairSpaceAnnouncementQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ description: 'Поиск по тексту объявления, предмету, группе и автору.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class PlatformPairSpaceAnnouncementPatchDto {
  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class PlatformPairSpaceQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр по активности пространства пары.' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  isActive?: boolean;
}

export class PlatformPairSpacePatchDto {
  @ApiProperty({ description: 'Активно ли пространство пары.' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
