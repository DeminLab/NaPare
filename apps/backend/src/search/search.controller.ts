import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Найти занятия, преподавателей, аудитории, подготовку и материалы в доступном scope' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Строка поиска от 2 до 80 символов' })
  @ApiOkResponse({ description: 'Результаты поиска' })
  async search(@Query() query: SearchQueryDto, @Request() req) {
    return this.searchService.search(query, req.user);
  }
}
