import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { SemesterService } from './semester.service';
import { MoodleIdentityDto, SemesterQueryDto } from './semester.dto';

@ApiTags('academic') @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) @Controller('academic')
export class SemesterController {
  constructor(private readonly service: SemesterService) {}
  @Get('semester/periods') @Roles(UserRole.STUDENT) @Header('Cache-Control', 'no-store')
  periods() { return this.service.periods(); }
  @Get('semester') @Roles(UserRole.STUDENT) @Header('Cache-Control', 'no-store')
  overview(@Query() query: SemesterQueryDto) { return this.service.overview(query); }
  @Get('identities/moodle/:studentId') @Roles(UserRole.UNIVERSITY_ADMIN) @Header('Cache-Control', 'no-store')
  identity(@Param('studentId', ParseUUIDPipe) id: string) { return this.service.identity(id); }
  @Post('identities/moodle/:studentId') @Roles(UserRole.UNIVERSITY_ADMIN)
  link(@Param('studentId', ParseUUIDPipe) id: string, @Body() dto: MoodleIdentityDto) { return this.service.link(id, dto); }
  @Delete('identities/moodle/:studentId') @Roles(UserRole.UNIVERSITY_ADMIN)
  unlink(@Param('studentId', ParseUUIDPipe) id: string) { return this.service.unlink(id); }
}
