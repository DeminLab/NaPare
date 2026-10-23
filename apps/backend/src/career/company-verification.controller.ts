import { Body, Controller, Header, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyRegistryCheckDto } from './career.dto';
import { CompanyVerificationService } from './company-verification.service';

@ApiTags('career') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('career/companies')
export class CompanyVerificationController {
  constructor(private readonly verification: CompanyVerificationService) {}
  @Post(':id/registry-check') @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Header('Cache-Control', 'no-store, private')
  @ApiOperation({ summary: 'Повторная проверка ИНН владельцем компании; не подтверждает партнёрство' })
  recheck(@Request() request: { user: AuthenticatedUser }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompanyRegistryCheckDto) {
    return this.verification.recheck(request.user, id, dto.inn);
  }
}
