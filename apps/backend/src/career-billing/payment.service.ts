import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CareerMembership } from '../career/career.entities';
import { PlatformService } from '../platform/platform.service';
import { CareerPayment, CareerPaymentRefund, CareerPaymentEvent } from './payment.entity';
import { CreatePaymentDto, RefundPaymentDto } from './payment.dto';
import { TkassaPayload, TkassaProvider } from './tkassa.provider';
import { advancePaymentState, normalizeTkassaStatus } from './payment-state';

@Injectable()
export class PaymentService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService, private readonly bank: TkassaProvider, private readonly platform: PlatformService) {}

  private async company(actor: AuthenticatedUser, companyId: string) {
    if (!await this.db.getRepository(CareerMembership).existsBy({ userId: actor.id, companyId, role: In(['company_owner', 'company_member']), revokedAt: IsNull() })) {
      throw new ForbiddenException('Нет доступа к оплате этой компании');
    }
  }
  private price(): number {
    const value = Number(this.config.get('TKASSA_CAREER_ACCESS_PRICE_MINOR'));
    if (!Number.isSafeInteger(value) || value < 1 || value > 999999999) throw new ServiceUnavailableException('Цена услуги платформы не настроена');
    return value;
  }
  private origin(): string {
    try {
      const value = new URL(this.config.getOrThrow<string>('TKASSA_PUBLIC_ORIGIN'));
      if (value.protocol !== 'https:' || value.username || value.password || value.pathname !== '/' || value.search || value.hash) throw new Error();
      return value.origin;
    } catch { throw new ServiceUnavailableException('Адрес платёжных уведомлений не настроен'); }
  }
  private receipt(email: string, amount: number) {
    const taxation = this.config.get<string>('TKASSA_TAXATION');
    const tax = this.config.get<string>('TKASSA_ITEM_TAX');
    if (!['osn', 'usn_income', 'usn_income_outcome', 'patent', 'esn'].includes(taxation || '') || !['none', 'vat0', 'vat5', 'vat7', 'vat10', 'vat22', 'vat105', 'vat107', 'vat110', 'vat122'].includes(tax || '')) {
      throw new ServiceUnavailableException('Параметры чека должны быть согласованы и настроены');
    }
    if (email.length > 64 || this.config.get('TKASSA_TERMINAL_CURRENCY') !== 'RUB') throw new ServiceUnavailableException('Нужны RUB-терминал и допустимый email для чека');
    return { Email: email, Taxation: taxation, Items: [{ Name: 'Доступ к карьерным сервисам НаПаре', Price: amount, Quantity: 1, Amount: amount, Tax: tax, PaymentMethod: 'full_payment', PaymentObject: 'service' }] };
  }
  async list(actor: AuthenticatedUser, companyId: string) {
    await this.company(actor, companyId);
    return this.db.getRepository(CareerPayment).find({ where: { companyId }, order: { createdAt: 'DESC' }, take: 100 });
  }
  async options(actor: AuthenticatedUser, companyId: string) {
    await this.company(actor, companyId);
    try {
      this.bank.assertConfigured();
      const amountMinor = this.price();
      this.origin(); this.receipt(actor.email, amountMinor);
      return { available: true, product: 'career_access', amountMinor, currency: 'RUB', label: 'Доступ к карьерным сервисам НаПаре' };
    } catch { return { available: false, reason: 'Оплата услуг пока не подключена. Обратитесь к оператору платформы.' }; }
  }
  async get(actor: AuthenticatedUser, id: string) {
    const order = await this.db.getRepository(CareerPayment).findOneBy({ id });
    if (!order) throw new NotFoundException('Платёж не найден');
    await this.company(actor, order.companyId);
    return order;
  }
  async history(actor: AuthenticatedUser, id: string) {
    await this.get(actor, id);
    return this.db.getRepository(CareerPaymentEvent).find({ where: { paymentId: id }, order: { createdAt: 'ASC' }, take: 200 });
  }
  private async event(manager: EntityManager, order: CareerPayment, source: string, status: unknown) {
    const providerStatus = String(status);
    const eventKey = createHash('sha256').update(`${order.id}:${source}:${providerStatus}:${order.refundedMinor}`).digest('hex');
    await manager.getRepository(CareerPaymentEvent).createQueryBuilder().insert().values({ paymentId: order.id, eventKey, source, providerStatus, state: order.state }).orIgnore().execute();
  }
  async create(actor: AuthenticatedUser, dto: CreatePaymentDto) {
    await this.company(actor, dto.companyId);
    if (!this.bank.enabled()) throw new ServiceUnavailableException('Платёжные запросы отключены');
    const repository = this.db.getRepository(CareerPayment);
    let order = await repository.findOneBy({ companyId: dto.companyId, idempotencyKey: dto.idempotencyKey });
    if (!order) {
      try { order = await repository.save(repository.create({ ...dto, createdBy: actor.id, receiptEmail: actor.email, amountMinor: this.price(), currency: 'RUB' })); }
      catch (error) {
        if ((error as { driverError?: { code?: string } }).driverError?.code !== '23505') throw error;
        order = await repository.findOneByOrFail({ companyId: dto.companyId, idempotencyKey: dto.idempotencyKey });
      }
    }
    if (order.product !== dto.product) throw new ConflictException('Ключ повторного запроса уже использован для другой услуги');
    const claim = await this.db.transaction(async manager => {
      const payments = manager.getRepository(CareerPayment);
      const current = await payments.findOneOrFail({ where: { id: order!.id }, lock: { mode: 'pessimistic_write' } });
      if (current.state !== 'created') return { order: current, claimed: false };
      this.origin(); this.receipt(actor.email, current.amountMinor);
      // Commit uncertainty before touching the bank. A process crash must never
      // return the order to a state that would blindly issue Init again.
      current.state = 'unknown';
      return { order: await payments.save(current), claimed: true };
    });
    if (!claim.claimed) return claim.order;
    const current = claim.order;
    try {
        const result = await this.bank.request('Init', {
          OrderId: current.id, Amount: current.amountMinor, PayType: 'O',
          Description: 'Доступ к карьерным сервисам НаПаре',
          NotificationURL: `${this.origin()}/api/v1/career/payments/notification`,
          SuccessURL: `${this.origin()}/career?tab=companies&payment=${current.id}`,
          FailURL: `${this.origin()}/career?tab=companies&payment=${current.id}`,
          Receipt: this.receipt(actor.email, current.amountMinor),
        });
        this.checkBankObject(current, result, false);
        return await this.db.transaction(async manager => {
          const saved = await manager.getRepository(CareerPayment).findOneOrFail({ where: { id: current.id }, lock: { mode: 'pessimistic_write' } });
          if (saved.providerPaymentId && saved.providerPaymentId !== String(result.PaymentId)) throw new ConflictException('У заказа несколько банковских попыток');
          saved.providerPaymentId = String(result.PaymentId);
          saved.confirmationUrl = this.bank.confirmationUrl(result.PaymentURL);
          saved.state = advancePaymentState(saved.state, normalizeTkassaStatus(result.Status));
          saved.checkedAt = new Date();
          await manager.save(saved);
          await this.event(manager, saved, 'init', result.Status);
          return saved;
        });
    } catch { return repository.findOneByOrFail({ id: current.id }); }
  }
  private checkBankObject(order: CareerPayment, result: TkassaPayload, requireId = true): void {
    if (result.OrderId !== order.id || result.Amount !== order.amountMinor ||
      !/^\d{1,20}$/.test(String(result.PaymentId)) ||
      (requireId && String(result.PaymentId) !== order.providerPaymentId)) {
      throw new ConflictException('Банковские реквизиты заказа или сумма не совпадают');
    }
  }
  private async reconcile(manager: EntityManager, id: string): Promise<CareerPayment> {
    const repository = manager.getRepository(CareerPayment);
    const order = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!order) throw new NotFoundException('Платёж не найден');
    let result: TkassaPayload;
    if (order.providerPaymentId) result = await this.bank.request('GetState', { PaymentId: order.providerPaymentId });
    else {
      const found = await this.bank.request('CheckOrder', { OrderId: order.id });
      if (found.OrderId !== order.id || !Array.isArray(found.Payments) || found.Payments.length !== 1) throw new ConflictException('Неопределённый результат. Нужна сверка заказа с банком');
      const attempt = found.Payments[0] as TkassaPayload;
      this.checkBankObject(order, { ...attempt, OrderId: found.OrderId }, false);
      result = await this.bank.request('GetState', { PaymentId: String(attempt.PaymentId) });
      this.checkBankObject(order, result, false);
      order.providerPaymentId = String(result.PaymentId);
    }
    this.checkBankObject(order, result);
    order.state = advancePaymentState(order.state, normalizeTkassaStatus(result.Status));
    order.checkedAt = new Date();
    await repository.save(order);
    await this.event(manager, order, 'reconcile', result.Status);
    return order;
  }
  async refresh(actor: AuthenticatedUser, id: string) {
    await this.get(actor, id);
    return this.db.transaction(manager => this.reconcile(manager, id));
  }
  async notification(body: TkassaPayload) {
    if (!this.bank.verifyNotification(body)) throw new ForbiddenException('Неверная подпись банковского уведомления');
    if (typeof body.OrderId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.OrderId)) throw new BadRequestException('Неверный номер заказа');
    // Provider data is verified by a server-to-server lookup. Notification and
    // browser redirects never directly grant paid access.
    await this.db.transaction(async manager => {
      const order = await manager.getRepository(CareerPayment).findOne({ where: { id: body.OrderId as string }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Платёж не найден');
      this.checkBankObject(order, body, !!order.providerPaymentId);
      if (!order.providerPaymentId) { order.providerPaymentId = String(body.PaymentId); await manager.save(order); }
      await this.reconcile(manager, order.id);
    });
    return 'OK';
  }
  async refund(actor: AuthenticatedUser, id: string, dto: RefundPaymentDto) {
    await this.platform.requireOwner();
    if (!this.bank.enabled()) throw new ServiceUnavailableException('Платёжные запросы отключены');
    const intent = await this.db.transaction(async manager => {
      const payments = manager.getRepository(CareerPayment);
      const refunds = manager.getRepository(CareerPaymentRefund);
      const order = await payments.createQueryBuilder('payment').addSelect('payment.receiptEmail')
        .where('payment.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!order) throw new NotFoundException('Платёж не найден');
      const existing = await refunds.findOneBy({ paymentId: id, idempotencyKey: dto.idempotencyKey });
      if (existing) {
        if (existing.amountMinor !== dto.amountMinor) throw new ConflictException('Ключ возврата уже использован с другой суммой');
        return { refund: existing, order, claimed: false };
      }
      if (!['succeeded', 'partially_refunded'].includes(order.state) || !order.providerPaymentId || dto.amountMinor > order.amountMinor - order.refundedMinor) throw new ConflictException('Возврат недоступен для текущей суммы и состояния');
      if (await refunds.existsBy({ paymentId: id, state: In(['pending', 'unknown']) })) throw new ConflictException('Сначала сверить предыдущий возврат с банком');
      const refund = refunds.create({ paymentId: id, actorId: actor.id, idempotencyKey: dto.idempotencyKey, amountMinor: dto.amountMinor, reason: dto.reason, state: 'unknown' });
      this.receipt(order.receiptEmail, dto.amountMinor);
      return { refund: await refunds.save(refund), order, claimed: true };
    });
    if (!intent.claimed) return intent.refund;
    try {
      const response = await this.bank.request('Cancel', {
        PaymentId: intent.order.providerPaymentId, Amount: dto.amountMinor,
        Receipt: this.receipt(intent.order.receiptEmail, dto.amountMinor),
      });
      if (String(response.PaymentId) !== intent.order.providerPaymentId || !['PARTIAL_REFUNDED', 'REFUNDED'].includes(String(response.Status))) throw new Error();
      return await this.db.transaction(async manager => {
        const order = await manager.getRepository(CareerPayment).findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
        const refund = await manager.getRepository(CareerPaymentRefund).findOneByOrFail({ id: intent.refund.id });
        if (refund.state === 'succeeded') return refund;
        refund.state = 'succeeded';
        order.refundedMinor += dto.amountMinor;
        if (order.refundedMinor > order.amountMinor) throw new ConflictException('Требуется сверка суммы возвратов');
        order.state = order.refundedMinor === order.amountMinor ? 'refunded' : 'partially_refunded';
        await manager.save(order);
        await this.event(manager, order, 'refund', response.Status);
        return manager.save(refund);
      });
    } catch { return this.db.getRepository(CareerPaymentRefund).findOneByOrFail({ id: intent.refund.id }); }
  }
}
