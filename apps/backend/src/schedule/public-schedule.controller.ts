import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicScheduleLessonsQueryDto, PublicScheduleSearchQueryDto } from './dto/public-schedule-query.dto';
import { PublicScheduleService } from './public-schedule.service';

@ApiTags('public-schedule')
@Controller('public/schedule')
export class PublicScheduleController {
  constructor(private readonly publicSchedule: PublicScheduleService) {}

  @Get('universities')
  @ApiOperation({ summary: 'Список вузов, опубликовавших расписание из кабинета' })
  @ApiOkResponse({ description: 'Публичные вузы получены' })
  listUniversities() {
    return this.publicSchedule.listUniversities();
  }

  @Get('universities/:organizationId/groups')
  @ApiOperation({ summary: 'Группы публичного расписания выбранного вуза' })
  @ApiOkResponse({ description: 'Публичные группы получены' })
  listGroups(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.publicSchedule.listGroups(organizationId);
  }

  @Get('lessons')
  @ApiOperation({ summary: 'Импортированные занятия опубликованной группы' })
  @ApiOkResponse({ description: 'Публичное расписание получено' })
  listLessons(@Query() query: PublicScheduleLessonsQueryDto) {
    return this.publicSchedule.listLessons(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Публичный поиск занятий по преподавателю или аудитории в опубликованном вузе' })
  @ApiOkResponse({ description: 'Занятия опубликованного вуза за выбранную неделю' })
  searchLessons(@Query() query: PublicScheduleSearchQueryDto) {
    return this.publicSchedule.searchLessons(query);
  }
}
