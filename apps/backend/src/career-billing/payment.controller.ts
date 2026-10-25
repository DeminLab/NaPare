import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, RefundPaymentDto } from './payment.dto';
import { TkassaPayload } from './tkassa.provider';

type ActorRequest = { user: AuthenticatedUser };
@ApiTags('career-payments')
@Controller('career/payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}
  @Get() @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  list(@Request() req: ActorRequest, @Query('companyId', ParseUUIDPipe) companyId: string) { return this.payments.list(req.user, companyId); }
  @Get('options') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  options(@Request() req: ActorRequest, @Query('companyId', ParseUUIDPipe) companyId: string) { return this.payments.options(req.user, companyId); }
  @Post() @UseGuards(JwtAuthGuard) @ApiBearerAuth() @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Оплатить услугу платформы по серверной цене; выплаты исполнителям не выполняются' })
  create(@Request() req: ActorRequest, @Body() dto: CreatePaymentDto) { return this.payments.create(req.user, dto); }
  @Get(':id') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  get(@Request() req: ActorRequest, @Param('id', ParseUUIDPipe) id: string) { return this.payments.get(req.user, id); }
  @Get(':id/history') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  history(@Request() req: ActorRequest, @Param('id', ParseUUIDPipe) id: string) { return this.payments.history(req.user, id); }
  @Post(':id/refresh') @UseGuards(JwtAuthGuard) @ApiBearerAuth() @HttpCode(200)
  refresh(@Request() req: ActorRequest, @Param('id', ParseUUIDPipe) id: string) { return this.payments.refresh(req.user, id); }
  @Post(':id/refund') @UseGuards(JwtAuthGuard) @ApiBearerAuth() @HttpCode(200)
  @ApiOperation({ summary: 'Возврат по решению владельца платформы' })
  refund(@Request() req: ActorRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundPaymentDto) { return this.payments.refund(req.user, id, dto); }
  @Post('notification') @HttpCode(200)
  @ApiOperation({ summary: 'Уведомление Т-Кассы: подпись и обязательная server-to-server сверка' })
  notification(@Body() body: TkassaPayload) { return this.payments.notification(body); }
}
