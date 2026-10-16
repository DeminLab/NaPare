import { Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurationService } from './curation.service';
import { CurationQueryDto } from './curation-query.dto';

@ApiTags('curation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('curation')
export class CurationController {
  constructor(private readonly curation: CurationService) {}
  @Get('context') @ApiOperation({ summary: 'Кураторство текущего аккаунта' })
  context() { return this.curation.context(); }
  @Get('groups') @ApiOperation({ summary: 'Мои кураторские группы' })
  groups(@Query() query: CurationQueryDto) { return this.curation.groups(query); }
  @Get('manage/groups') @ApiOperation({ summary: 'Группы для назначения кураторов деканатом' })
  manageableGroups(@Query() query: CurationQueryDto) { return this.curation.groups(query, true); }
  @Get('manage/candidates') @ApiOperation({ summary: 'Действующие аккаунты для назначения куратора' })
  candidates(@Query() query: CurationQueryDto) { return this.curation.candidates(query); }
  @Get('groups/:groupId/curators') @ApiOperation({ summary: 'Кураторы группы для деканата' })
  curators(@Param('groupId', ParseUUIDPipe) groupId: string, @Query() query: CurationQueryDto) { return this.curation.curators(groupId, query); }
  @Put('groups/:groupId/curators/:userId') @ApiOperation({ summary: 'Назначить куратором существующий аккаунт' })
  grant(@Param('groupId', ParseUUIDPipe) groupId: string, @Param('userId', ParseUUIDPipe) userId: string) { return this.curation.setAssignment(groupId, userId, true); }
  @Delete('groups/:groupId/curators/:userId') @ApiOperation({ summary: 'Снять кураторство, сохранив историю' })
  revoke(@Param('groupId', ParseUUIDPipe) groupId: string, @Param('userId', ParseUUIDPipe) userId: string) { return this.curation.setAssignment(groupId, userId, false); }
  @Get('groups/:groupId/students') @ApiOperation({ summary: 'Студенты назначенной кураторской группы' })
  students(@Param('groupId', ParseUUIDPipe) groupId: string, @Query() query: CurationQueryDto) { return this.curation.students(groupId, query); }
  @Get('groups/:groupId/lessons') @ApiOperation({ summary: 'Расписание назначенной кураторской группы' })
  lessons(@Param('groupId', ParseUUIDPipe) groupId: string, @Query() query: CurationQueryDto) { return this.curation.lessons(groupId, query); }
  @Get('absences') @ApiOperation({ summary: 'Обращения только назначенных групп' })
  absences(@Query() query: CurationQueryDto) { return this.curation.absences(query); }
  @Get('absences/:id/context') @ApiOperation({ summary: 'Назначенная группа обращения из уведомления' })
  absenceContext(@Param('id', ParseUUIDPipe) id: string) { return this.curation.absenceContext(id); }
}
