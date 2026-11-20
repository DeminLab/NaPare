import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateVacancyDto, ProposeInterviewDto, RespondInterviewDto, ReviewVacancyDto, VacancyQuery } from './vacancies.dto';
import { VacanciesService } from './vacancies.service';

type Session = { user: AuthenticatedUser };

@ApiTags('career')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('career/vacancies')
export class VacanciesController {
  constructor(private readonly vacancies: VacanciesService) {}

  @Get()
  list(@Request() req: Session, @Query() query: VacancyQuery) {
    return this.vacancies.list(req.user, query.workspace, query);
  }

  @Post()
  create(@Request() req: Session, @Body() body: CreateVacancyDto) {
    return this.vacancies.create(req.user, body);
  }

  @Patch(':id/review')
  review(@Request() req: Session, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReviewVacancyDto) {
    return this.vacancies.review(req.user, id, body);
  }

  @Patch(':id/close')
  close(@Request() req: Session, @Param('id', ParseUUIDPipe) id: string) {
    return this.vacancies.close(req.user, id);
  }

  @Put(':id/application')
  apply(@Request() req: Session, @Param('id', ParseUUIDPipe) id: string) {
    return this.vacancies.apply(req.user, id);
  }

  @Get(':id/applications')
  applications(@Request() req: Session, @Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    return this.vacancies.applications(req.user, id, query);
  }

  @Put(':vacancyId/applications/:id/interview')
  propose(
    @Request() req: Session, @Param('vacancyId', ParseUUIDPipe) vacancyId: string,
    @Param('id', ParseUUIDPipe) id: string, @Body() body: ProposeInterviewDto,
  ) {
    return this.vacancies.propose(req.user, vacancyId, id, body);
  }

  @Patch('applications/:id/interview')
  respond(@Request() req: Session, @Param('id', ParseUUIDPipe) id: string, @Body() body: RespondInterviewDto) {
    return this.vacancies.respond(req.user, id, body);
  }
}
