import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export const CLIENT_APPS = ['portal', 'student', 'staff', 'admin', 'developer', 'android', 'max'] as const;

export class ClientTelemetryEventDto {
  @ApiProperty({ description: 'Стабильное имя события, например page.view или feature.schedule' })
  @IsString() @MaxLength(64) @Matches(/^[a-z][a-z0-9._-]{2,63}$/)
  name: string;

  @ApiPropertyOptional({ description: 'Путь без query-параметров' })
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^\//)
  path?: string;

  @ApiPropertyOptional({ description: 'Необязательные обезличенные атрибуты; секреты отбрасываются' })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ClientTelemetryBatchDto {
  @ApiProperty({ type: [ClientTelemetryEventDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(25) @ValidateNested({ each: true }) @Type(() => ClientTelemetryEventDto)
  events: ClientTelemetryEventDto[];

  @ApiPropertyOptional({ enum: CLIENT_APPS })
  @IsOptional() @IsIn(CLIENT_APPS)
  app?: string;

  @ApiPropertyOptional({ description: 'Локальный идентификатор установки приложения; не является идентификатором пользователя' })
  @IsOptional()
  @Matches(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i, {
    message: 'installId должен быть UUID или 32-символьным hex-идентификатором',
  })
  installId?: string;
}
