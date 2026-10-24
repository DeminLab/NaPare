import { CareerPlanningService } from './career-planning.service';
import { CareerAiService } from './career-ai.service';
import { Query, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CareerService } from './career.service';
import { CareerModerationService } from './career-moderation.service';
import { CareerTestDto, CareerAttemptDto, EmployerRegistrationDto, CareerCompanyDto, CareerProfileDto, CareerTaskDto, CareerMessageDto, CareerSubmissionDto, CareerDecisionDto, CareerReviewDto, CareerMembershipDto, CareerAdmissionDto, CareerPublishDto, CareerPartnershipDto, CareerAiConsentDto, CareerAiTaskDto, CareerCaseTextDto, CareerAvailabilityDto } from './career.dto';
type CareerRequest = {user:AuthenticatedUser};

@ApiTags('career')
@Controller('career/accounts')
export class CareerAccountsController {
  constructor(private readonly service:CareerService) {}
  @Get('portfolio/:studentId/cases') publicPortfolioCases(@Param('studentId',ParseUUIDPipe) id:string,@Query('offset') offset?:string,@Query('limit') limit?:string){return this.service.publicPortfolioCases(id,{offset,limit});}
  @Get('portfolio/:studentId') publicPortfolio(@Param('studentId',ParseUUIDPipe) id:string){return this.service.publicPortfolio(id);}
  @Post('register') @Throttle({default:{ttl:60000,limit:3}}) @ApiOperation({summary:'Регистрация работодателя без доступа к учебным данным'})
  register(@Body() dto:EmployerRegistrationDto) {return this.service.register(dto);}
}
@ApiTags('career') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('career')
export class CareerController {
  constructor(private readonly service:CareerService, private readonly ai:CareerAiService, private readonly planning:CareerPlanningService, private readonly moderation:CareerModerationService) {}
  @Get('planning') planningStatus(@Request() req:CareerRequest){return this.planning.get(req.user);}
  @Put('availability') saveAvailability(@Request() req:CareerRequest,@Body() dto:CareerAvailabilityDto){return this.planning.save(req.user,dto);}
  @Get('ai/status') aiStatus(){return this.ai.status();}
  @Post('ai/task-draft') @Throttle({default:{ttl:60000,limit:3}}) taskDraft(@Request() req:CareerRequest,@Body() dto:CareerAiTaskDto){return this.ai.task(req.user,dto);}
  @Post('portfolio/:id/ai-draft') @Throttle({default:{ttl:60000,limit:3}}) caseDraft(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerAiConsentDto){return this.ai.portfolio(req.user,id,dto.consent);}
  @Put('portfolio/:id/description') saveDescription(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerCaseTextDto){return this.service.saveCaseText(req.user,id,dto.caseText);}
  @Get('notices/unread-count') @ApiOperation({summary:'Точное число непрочитанных уведомлений текущего пользователя'}) unreadNoticeCount(@Request() req:CareerRequest){return this.service.unreadNoticeCount(req.user);}
  @Get('notices') @ApiOperation({summary:'Страничный список уведомлений текущего пользователя'}) notices(@Request() req:CareerRequest,@Query('offset') offset?:string,@Query('limit') limit?:string){return this.service.listNotices(req.user,{offset,limit});}
  @Post('notices/:id/read') readNotice(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.readNotice(req.user,id);}
  @Get('tests') @ApiOperation({summary:'Тесты допуска без ключей правильных ответов; страничный поиск доступен ученикам и центру'}) tests(@Request() req:CareerRequest,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string){return this.service.tests(req.user,{offset,limit,q});}
  @Get('student/admissions') @ApiOperation({summary:'Страничная история допусков текущего студента и полный список подтверждённых направлений'}) studentAdmissions(@Request() req:CareerRequest,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string,@Query('state') state?:string){return this.service.listStudentAdmissions(req.user,{offset,limit,q,state});}
  @Get('student/portfolio') @ApiOperation({summary:'Страничные кейсы и агрегаты портфолио текущего студента'}) studentPortfolio(@Request() req:CareerRequest,@Query('offset') offset?:string,@Query('limit') limit?:string){return this.service.listStudentPortfolio(req.user,{offset,limit});}
  @Post('tests') createTest(@Request() req:CareerRequest,@Body() dto:CareerTestDto){return this.service.createTest(req.user,dto);}
  @Post('tests/:id/attempts') attempt(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerAttemptDto){return this.service.attempt(req.user,id,dto);}
  @Get('tasks') @ApiOperation({summary:'Страничный список карьерных задач в границах доступного кабинета'}) taskList(@Request() req:CareerRequest,@Query('workspace') workspace?:string,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string,@Query('category') category?:string,@Query('state') state?:string){return this.service.listTasks(req.user,workspace,{offset,limit,q,category,state});}
  @Get('workflows') @ApiOperation({summary:'Страничные отклики и работы в границах доступного кабинета'}) workflowList(@Request() req:CareerRequest,@Query('workspace') workspace?:string,@Query('kind') kind?:string,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string,@Query('state') state?:string){return this.service.listWorkflows(req.user,workspace,{kind,offset,limit,q,state});}
  @Get('center/reviews') @ApiOperation({summary:'Страничные очереди профилей и допусков карьерного центра'}) centerReviews(@Request() req:CareerRequest,@Query('kind') kind?:string,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string,@Query('state') state?:string){return this.service.listCenterReviews(req.user,{kind,offset,limit,q,state});}
  @Get('partnerships') @ApiOperation({summary:'Страничные партнёрства в границах центра или активных компаний'}) partnerships(@Request() req:CareerRequest,@Query('workspace') workspace?:string,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string,@Query('state') state?:string){return this.service.listPartnerships(req.user,workspace,{offset,limit,q,state});}
  @Get('universities') @ApiOperation({summary:'Страничный список активных вузов для работодателя'}) universities(@Request() req:CareerRequest,@Query('workspace') workspace?:string,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string){return this.service.listUniversities(req.user,workspace,{offset,limit,q});}
  @Get('center/assignable-staff') @ApiOperation({summary:'Активные сотрудники своего вуза, которых администратор центра может назначить'}) assignableStaff(@Request() req:CareerRequest,@Query('offset') offset?:string,@Query('limit') limit?:string,@Query('q') q?:string){return this.service.listAssignableStaff(req.user,{offset,limit,q});}
  @Get('partnership-eligibility') @ApiOperation({summary:'Проверка подтверждения точной пары компании и вуза для черновика задачи'}) partnershipEligibility(@Request() req:CareerRequest,@Query('companyId',ParseUUIDPipe) companyId:string,@Query('universityId',ParseUUIDPipe) universityId:string){return this.service.checkPartnershipEligibility(req.user,companyId,universityId);}
  @Get() @ApiOperation({summary:'Кабинет практики и работы с учётом прав пользователя'}) overview(@Request() req:CareerRequest,@Query('workspace') workspace?:string){return this.service.overview(req.user,workspace);}
  @Put('profile') saveProfile(@Request() req:CareerRequest,@Body() dto:CareerProfileDto){return this.service.saveProfile(req.user,dto);}
  @Post('profiles/:id/verify') verifyProfile(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerDecisionDto){return this.service.verifyProfile(req.user,id,dto);}
  @Post('admissions') requestAdmission(@Request() req:CareerRequest,@Body() dto:CareerAdmissionDto){return this.service.requestAdmission(req.user,dto);}
  @Post('admissions/:id/decision') decideAdmission(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerDecisionDto){return this.service.decideAdmission(req.user,id,dto);}
  @Post('companies') @Throttle({default:{ttl:60000,limit:3}}) @Header('Cache-Control','no-store, private') createCompany(@Request() req:CareerRequest,@Body() dto:CareerCompanyDto){return this.service.createCompany(req.user,dto);}
  @Post('companies/:id/partnerships') partnership(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerPartnershipDto){return this.service.addPartnership(req.user,id,dto.universityId);}
  @Post('partnerships/:id/verify') verifyPartnership(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerDecisionDto){return this.service.verifyPartnership(req.user,id,dto);}
  @Post('memberships') membership(@Request() req:CareerRequest,@Body() dto:CareerMembershipDto){return this.service.addMembership(req.user,dto);}
  @Post('tasks') createTask(@Request() req:CareerRequest,@Body() dto:CareerTaskDto){return this.service.createTask(req.user,dto);}
  @Post('tasks/:id/publish') publishTask(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string){return this.moderation.publish(req.user,id);}
  @Post('tasks/:id/approve') approveTask(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string){return this.moderation.decide(req.user,id,'approve');}
  @Post('tasks/:id/apply') apply(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerMessageDto){return this.service.apply(req.user,id,dto);}
  @Post('applications/:id/select') select(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.select(req.user,id);}
  @Post('works/:id/submit') submit(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerSubmissionDto){return this.service.submit(req.user,id,dto);}
  @Post('works/:id/decision') decideWork(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerDecisionDto){return this.service.decideWork(req.user,id,dto);}
  @Post('works/:id/review') review(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerReviewDto){return this.service.review(req.user,id,dto);}
  @Patch('portfolio/:id') publishPortfolio(@Request() req:CareerRequest,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CareerPublishDto){return this.service.publishPortfolio(req.user,id,dto.published);}
}
