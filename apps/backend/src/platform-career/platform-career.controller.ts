import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  PlatformCareerAdmissionPatchDto,
  PlatformCareerAdmissionQueryDto,
  PlatformCareerMembershipQueryDto,
  PlatformCareerCompanyPatchDto,
  PlatformCareerCompanyQueryDto,
  PlatformCareerDecisionDto,
  PlatformCareerPartnershipDecisionDto,
  PlatformCareerPartnershipQueryDto,
  PlatformCareerTaskPatchDto,
  PlatformCareerTaskQueryDto,
  PlatformCareerProfilePatchDto,
  PlatformCareerProfileQueryDto,
  PlatformCareerReasonDto,
  PlatformCareerTransferOwnerDto,
  PlatformCareerTestPatchDto,
  PlatformCareerTestQueryDto,
  PlatformCareerNoticePatchDto,
  PlatformCareerNoticeQueryDto,
  PlatformCareerPortfolioPatchDto,
  PlatformCareerPortfolioQueryDto,
  PlatformCareerReviewPatchDto,
  PlatformCareerReviewQueryDto,
  PlatformCareerAvailabilityPatchDto,
  PlatformCareerAvailabilityQueryDto,
} from './platform-career.dto';
import { PlatformCareerService } from './platform-career.service';

@ApiTags('platform-career')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-career')
export class PlatformCareerController {
  constructor(private readonly career: PlatformCareerService) {}

  @Get('memberships')
  @ApiOperation({ summary: 'Глобальный поиск назначений карьерных прав' })
  memberships(@Query() query: PlatformCareerMembershipQueryDto, @Req() request: Request) { return this.career.memberships(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('memberships/:id/revoke')
  @ApiOperation({ summary: 'Обратимо отозвать назначение карьерных прав' })
  revokeMembership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerReasonDto, @Req() request: Request) { return this.career.revokeMembership(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('memberships/:id/transfer-owner')
  @ApiOperation({ summary: 'Передать владение компанией другому действующему участнику' })
  transferOwner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerTransferOwnerDto, @Req() request: Request) { return this.career.transferCompanyOwner(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('tests')
  @ApiOperation({ summary: 'Глобальный поиск карьерных тестов' })
  tests(@Query() query: PlatformCareerTestQueryDto, @Req() request: Request) { return this.career.tests(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('tests/attempts')
  @ApiOperation({ summary: 'Глобальный поиск истории попыток карьерных тестов' })
  testAttempts(@Query() query: PlatformCareerTestQueryDto, @Req() request: Request) { return this.career.testAttempts(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('tests/:id')
  @ApiOperation({ summary: 'Просмотреть тест и правильные ответы с аудитом' })
  test(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.test(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('tests/:id')
  @ApiOperation({ summary: 'Исправить карьерный тест с причиной и аудитом' })
  patchTest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerTestPatchDto, @Req() request: Request) { return this.career.patchTest(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('portfolios')
  @ApiOperation({ summary: 'Глобальный поиск кейсов карьерного портфолио' })
  portfolios(@Query() query: PlatformCareerPortfolioQueryDto, @Req() request: Request) { return this.career.portfolios(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('portfolios/:id')
  @ApiOperation({ summary: 'Просмотреть карьерный кейс и связанные согласия с аудитом' })
  portfolio(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.portfolio(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('portfolios/:id')
  @ApiOperation({ summary: 'Исправить описание кейса или обратимо скрыть его' })
  patchPortfolio(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerPortfolioPatchDto, @Req() request: Request) { return this.career.patchPortfolio(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('reviews')
  @ApiOperation({ summary: 'Глобальный поиск карьерных отзывов' })
  reviews(@Query() query: PlatformCareerReviewQueryDto, @Req() request: Request) { return this.career.reviews(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('reviews/:id')
  @ApiOperation({ summary: 'Просмотреть карьерный отзыв и согласие на публикацию с аудитом' })
  review(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.review(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Исправить карьерный отзыв с отзывом согласия публикации' })
  patchReview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerReviewPatchDto, @Req() request: Request) { return this.career.patchReview(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('notices')
  @ApiOperation({ summary: 'Глобальный поиск карьерных уведомлений' })
  notices(@Query() query: PlatformCareerNoticeQueryDto, @Req() request: Request) { return this.career.notices(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('notices/:id')
  @ApiOperation({ summary: 'Просмотреть карьерное уведомление с аудитом' })
  notice(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.notice(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('notices/:id')
  @ApiOperation({ summary: 'Исправить или отметить карьерное уведомление с причиной' })
  patchNotice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerNoticePatchDto, @Req() request: Request) { return this.career.patchNotice(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('availability')
  @ApiOperation({ summary: 'Глобальный поиск пользовательских настроек карьерного планирования' })
  availabilities(@Query() query: PlatformCareerAvailabilityQueryDto, @Req() request: Request) { return this.career.availabilities(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('availability/:studentId')
  @ApiOperation({ summary: 'Просмотреть настройки доступности с аудитом' })
  availability(@Param('studentId', ParseUUIDPipe) studentId: string, @Req() request: Request) { return this.career.availability(studentId, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('availability/:studentId')
  @ApiOperation({ summary: 'Исправить настройки доступности с общей бизнес-валидацией и аудитом' })
  patchAvailability(@Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: PlatformCareerAvailabilityPatchDto, @Req() request: Request) { return this.career.patchAvailability(studentId, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('companies')
  @ApiOperation({ summary: 'Глобальный поиск карьерных компаний' })
  companies(@Query() query: PlatformCareerCompanyQueryDto, @Req() request: Request) { return this.career.companies(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Просмотреть компанию и её университетские партнёрства' })
  company(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.company(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('companies/:id')
  @ApiOperation({ summary: 'Исправить название или описание компании с причиной' })
  patchCompany(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerCompanyPatchDto, @Req() request: Request) { return this.career.patchCompany(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('partnerships')
  @ApiOperation({ summary: 'Глобальный поиск партнёрств компаний с университетами' })
  partnerships(@Query() query: PlatformCareerPartnershipQueryDto, @Req() request: Request) { return this.career.partnerships(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('partnerships/:id')
  @ApiOperation({ summary: 'Просмотреть партнёрство компании и университета' })
  partnership(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.partnership(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('partnerships/:id/decision')
  @ApiOperation({ summary: 'Подтвердить или отклонить ожидающее партнёрство' })
  decidePartnership(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerPartnershipDecisionDto, @Req() request: Request) { return this.career.decidePartnership(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('tasks')
  @ApiOperation({ summary: 'Глобальный поиск карьерных задач без изменений связанных работ' })
  tasks(@Query() query: PlatformCareerTaskQueryDto, @Req() request: Request) { return this.career.tasks(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Просмотреть карьерную задачу с аудитом доступа' })
  task(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.task(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Исправить только черновую карьерную задачу без откликов и работ' })
  patchTask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerTaskPatchDto, @Req() request: Request) { return this.career.patchTask(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('profiles')
  @ApiOperation({ summary: 'Глобальный поиск карьерных профилей студентов' })
  profiles(@Query() query: PlatformCareerProfileQueryDto, @Req() request: Request) { return this.career.profiles(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('profiles/:id')
  @ApiOperation({ summary: 'Просмотреть карьерный профиль с аудитом доступа' })
  profile(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.profile(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('profiles/:id')
  @ApiOperation({ summary: 'Исправить карьерный профиль с возвратом на повторную проверку' })
  patchProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerProfilePatchDto, @Req() request: Request) { return this.career.patchProfile(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('profiles/:id/decision')
  @ApiOperation({ summary: 'Подтвердить или отклонить карьерный профиль' })
  decideProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerDecisionDto, @Req() request: Request) { return this.career.decideProfile(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('admissions')
  @ApiOperation({ summary: 'Глобальный поиск карьерных допусков студентов' })
  admissions(@Query() query: PlatformCareerAdmissionQueryDto, @Req() request: Request) { return this.career.admissions(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('admissions/:id')
  @ApiOperation({ summary: 'Просмотреть заявку на карьерный допуск с аудитом доступа' })
  admission(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.admission(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('admissions/:id')
  @ApiOperation({ summary: 'Исправить заявку на допуск с возвратом на повторное рассмотрение' })
  patchAdmission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerAdmissionPatchDto, @Req() request: Request) { return this.career.patchAdmission(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('admissions/:id/decision')
  @ApiOperation({ summary: 'Одобрить или отклонить карьерный допуск' })
  decideAdmission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerDecisionDto, @Req() request: Request) { return this.career.decideAdmission(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }
}
