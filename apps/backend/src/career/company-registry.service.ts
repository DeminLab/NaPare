import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RegistryStatus = 'disabled' | 'unavailable' | 'captcha_required' | 'not_found' | 'matched' | 'inactive' | 'ambiguous';
export interface RegistryResult {
  inn: string; status: RegistryStatus; checkedAt: Date | null;
  legalName: string | null; ogrn: string | null;
  source: 'https://egrul.nalog.ru/'; reason: string | null;
}

export function validateCompanyInn(value: string): string {
  const inn = value.trim();
  if (!/^\d{10}$|^\d{12}$/.test(inn) || /^0+$/.test(inn)) throw new BadRequestException('Укажите ИНН из 10 или 12 цифр.');
  const check = (weights: number[]) => weights.reduce((sum, weight, index) => sum + weight * Number(inn[index]), 0) % 11 % 10;
  const valid = inn.length === 10 ? check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[9])
    : check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[10]) && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[11]);
  if (!valid) throw new BadRequestException('Проверьте контрольные цифры ИНН.');
  return inn;
}

type RegistryRow = { i?: unknown; k?: unknown; n?: unknown; o?: unknown; e?: unknown; v?: unknown; cnt?: unknown };
function challenge(response: Record<string, unknown>): boolean {
  const errors = response.ERRORS;
  return response.captchaRequired === true || !!(errors && typeof errors === 'object' &&
    ('captchaSearch' in errors || 'captchaVyp' in errors));
}
@Injectable()
export class CompanyRegistryService {
  constructor(private readonly config: ConfigService) {}
  private active = 0;

  private async json(url: string, signal: AbortSignal, options: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await fetch(url, { ...options, signal, redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json', ...options.headers } });
    if (!response.ok) throw new Error(`registry_http_${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('registry_empty_response');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 256 * 1024) throw new Error('registry_response_too_large');
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    let data: unknown;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('registry_invalid_json'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('registry_invalid_response');
    return data as Record<string, unknown>;
  }

  async lookup(value: string): Promise<RegistryResult> {
    const inn = validateCompanyInn(value);
    const base = { inn, legalName: null, ogrn: null, source: 'https://egrul.nalog.ru/' as const };
    const result = (status: RegistryStatus, reason: string | null = null): RegistryResult => ({ ...base, status, reason, checkedAt: status === 'disabled' ? null : new Date() });
    if (this.config.get<string>('CAREER_COMPANY_REGISTRY_ENABLED') !== 'true') return result('disabled', 'registry_disabled');
    if (this.active >= 2) return result('unavailable', 'registry_busy');
    this.active++;
    const signal = AbortSignal.timeout(10000);
    try {
      const ticket = await this.json('https://egrul.nalog.ru/', signal, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ query: inn, region: '', page: '1', nameEq: 'on', vyp3CaptchaToken: '' }).toString() });
      if (challenge(ticket)) return result('captcha_required', 'registry_challenge');
      if (ticket.ERRORS) return result('unavailable', 'registry_rejected');
      if (typeof ticket.t !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(ticket.t)) return result('unavailable', 'registry_invalid_ticket');
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await this.json(`https://egrul.nalog.ru/search-result/${encodeURIComponent(ticket.t)}`, signal);
        if (challenge(response)) return result('captcha_required', 'registry_challenge');
        if (response.ERRORS) return result('unavailable', 'registry_rejected');
        if (response.status === 'wait') {
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        if (!Array.isArray(response.rows) || response.rows.length > 100 || (response.status && !['done', 'ok'].includes(String(response.status)))) return result('unavailable', 'registry_invalid_result');
        const rows = response.rows as RegistryRow[];
        const matching = rows.filter(row => row && typeof row === 'object' && row.i === inn && row.k === (inn.length === 10 ? 'ul' : 'fl'));
        if (!matching.length) return rows.length === 0 || rows.every(row => row?.cnt === '0')
          ? result('not_found') : result('ambiguous', 'registry_no_exact_match');
        if (matching.length !== 1) return result('ambiguous', 'registry_multiple_matches');
        const row = matching[0];
        if (typeof row.n !== 'string' || !row.n.trim() || row.n.length > 500 || typeof row.o !== 'string' ||
          !(inn.length === 10 ? /^\d{13}$/ : /^\d{15}$/).test(row.o) ||
          (row.e !== undefined && typeof row.e !== 'string') || (row.v !== undefined && typeof row.v !== 'string')) return result('unavailable', 'registry_invalid_record');
        const status = row.e || row.v ? 'inactive' : 'matched';
        return { ...result(status), legalName: row.n.trim(), ogrn: row.o };
      }
      return result('unavailable', 'registry_wait_timeout');
    } catch (error) {
      const known = error instanceof Error && /^registry_[a-z0-9_]+$/.test(error.message) ? error.message : signal.aborted ? 'registry_timeout' : 'registry_network';
      return result('unavailable', known);
    } finally { this.active--; }
  }
}
