import { BadGatewayException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

export const TKASSA_FETCH = Symbol('TKASSA_FETCH');
export type TkassaPayload = Record<string, unknown>;
const primitive = (value: unknown) => ['string', 'number', 'boolean'].includes(typeof value);

/** T-Kassa v2 signing: sorted root primitives, Password, UTF-8 SHA256. */
export function tkassaToken(payload: TkassaPayload, password: string): string {
  const fields = { ...payload, Password: password };
  const text = Object.keys(fields).filter(key => key !== 'Token' && primitive(fields[key])).sort()
    .map(key => String(fields[key])).join('');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

@Injectable()
export class TkassaProvider {
  constructor(private readonly config: ConfigService, @Optional() @Inject(TKASSA_FETCH) private readonly transport: typeof fetch = fetch) {}

  enabled(): boolean { return this.config.get('TKASSA_SEND_REQUESTS') === 'true'; }
  assertConfigured(): void {
    if (!this.enabled()) throw new ServiceUnavailableException('Платёжные запросы отключены');
    this.terminal(); this.password();
    if (this.config.get('TKASSA_LIVE') === 'true' && this.config.get('TKASSA_LIVE_APPROVED') !== 'true') throw new ServiceUnavailableException('Live-терминал не активирован');
  }
  private terminal(): string {
    const value = this.config.get<string>('TKASSA_TERMINAL_KEY');
    if (!value || !/^[A-Za-z0-9_-]{1,20}$/.test(value)) throw new ServiceUnavailableException('Терминал оплаты не настроен');
    return value;
  }
  private password(): string {
    const value = this.config.get<string>('TKASSA_PASSWORD');
    if (!value) throw new ServiceUnavailableException('Оплата не настроена');
    return value;
  }
  verifyNotification(body: TkassaPayload): boolean {
    if (body.TerminalKey !== this.terminal() || typeof body.Token !== 'string' || !/^[a-f0-9]{64}$/i.test(body.Token)) return false;
    return timingSafeEqual(Buffer.from(body.Token.toLowerCase(), 'hex'), Buffer.from(tkassaToken(body, this.password()), 'hex'));
  }
  async request(method: 'Init' | 'GetState' | 'CheckOrder' | 'Cancel', input: TkassaPayload): Promise<TkassaPayload> {
    if (!this.enabled()) throw new ServiceUnavailableException('Платёжные запросы отключены');
    const live = this.config.get('TKASSA_LIVE') === 'true';
    if (live && this.config.get('TKASSA_LIVE_APPROVED') !== 'true') throw new ServiceUnavailableException('Live-терминал не активирован');
    const base = live ? 'https://securepay.tinkoff.ru/v2/' : 'https://rest-api-test.tinkoff.ru/v2/';
    const body = { ...input, TerminalKey: this.terminal() };
    try {
      const response = await this.transport(`${base}${method}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, Token: tkassaToken(body, this.password()) }),
      });
      if (!response.ok || Number(response.headers.get('content-length') || 0) > 65536) throw new Error();
      const text = await response.text();
      if (text.length > 65536) throw new Error();
      const value = JSON.parse(text) as TkassaPayload;
      if (value.Success !== true || (value.TerminalKey !== undefined && value.TerminalKey !== body.TerminalKey)) throw new Error();
      return value;
    } catch { throw new BadGatewayException('Банк не подтвердил операцию. Повторный платёж автоматически не создаётся'); }
  }
  confirmationUrl(value: unknown): string {
    try {
      const url = new URL(String(value));
      if (url.protocol !== 'https:' || url.username || url.password || !['securepay.tinkoff.ru', 'rest-api-test.tinkoff.ru'].includes(url.hostname)) throw new Error();
      return url.href;
    } catch { throw new BadGatewayException('Банк вернул недопустимую ссылку оплаты'); }
  }
}
