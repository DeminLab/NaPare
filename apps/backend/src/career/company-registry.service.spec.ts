import { ConfigService } from '@nestjs/config';
import { CompanyRegistryService, validateCompanyInn } from './company-registry.service';

describe('Company registry: exact public-record lookup, no CAPTCHA bypass', () => {
  const inn = '7707083893';
  const record = { i: inn, k: 'ul', n: 'Синтетическая организация', o: '1027700132195', cnt: '1' };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let service: CompanyRegistryService;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const ticket = () => fetchMock.mockResolvedValueOnce(json({ t: 'synthetic_registry_ticket' }));
  beforeEach(() => {
    fetchMock = jest.fn(); global.fetch = fetchMock;
    service = new CompanyRegistryService(new ConfigService({ CAREER_COMPANY_REGISTRY_ENABLED: 'true' }));
  });
  afterEach(() => { global.fetch = originalFetch; });

  it('validates both checksum formats and rejects invalid input without network', async () => {
    expect(validateCompanyInn(` ${inn} `)).toBe(inn);
    expect(validateCompanyInn('500100732259')).toBe('500100732259');
    for (const input of ['0000000000', '7707083894', '500100732258', 'x'.repeat(12), 'https://example.test', '7707 083893']) {
      await expect(service.lookup(input)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('is disabled unless explicitly enabled and does not call any external service', async () => {
    service = new CompanyRegistryService(new ConfigService());
    expect(await service.lookup(inn)).toMatchObject({ status: 'disabled', checkedAt: null, legalName: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('accepts one exact INN/kind record and sends only bounded fixed-host search requests', async () => {
    ticket(); fetchMock.mockResolvedValueOnce(json({ rows: [record] }));
    expect(await service.lookup(inn)).toMatchObject({ inn, status: 'matched', legalName: record.n, ogrn: record.o, source: 'https://egrul.nalog.ru/' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://egrul.nalog.ru/');
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('query')).toBe(inn);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
    expect(fetchMock.mock.calls[1][0]).toBe('https://egrul.nalog.ru/search-result/synthetic_registry_ticket');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([{ e: '01.01.2020' }, { v: '01.01.2020' }])('marks explicit termination/invalid registration separately: %p', async flags => {
    ticket(); fetchMock.mockResolvedValueOnce(json({ rows: [{ ...record, ...flags }] }));
    expect((await service.lookup(inn)).status).toBe('inactive');
  });
  it('keeps the individual-entrepreneur registry kind and 15-digit identifier distinct', async () => {
    ticket(); fetchMock.mockResolvedValueOnce(json({ rows: [{ i: '500100732259', k: 'fl', n: 'Синтетический ИП', o: '304500116000157' }] }));
    expect(await service.lookup('500100732259')).toMatchObject({ status: 'matched', ogrn: '304500116000157' });
  });
  it.each([{ rows: [] }, { rows: [{ cnt: '0' }] }])('reports absence only for a complete empty result: %p', async response => {
    ticket(); fetchMock.mockResolvedValueOnce(json(response));
    expect((await service.lookup(inn)).status).toBe('not_found');
  });
  it.each([
    { rows: [{ ...record, i: '7707329152' }] }, { rows: [{ ...record, k: 'fl' }] }, { rows: [record, record] },
  ])('never marks a foreign, wrong-kind or duplicate result as matched: %p', async response => {
    ticket(); fetchMock.mockResolvedValueOnce(json(response));
    expect((await service.lookup(inn)).status).toBe('ambiguous');
  });
  it.each([{ captchaRequired: true }, { ERRORS: { captchaSearch: ['required'] } }])('stops immediately when a challenge is required: %p', async response => {
    fetchMock.mockResolvedValueOnce(json(response));
    expect((await service.lookup(inn)).status).toBe('captcha_required');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not mistake a validation rejection for a challenge or absence', async () => {
    fetchMock.mockResolvedValueOnce(json({ ERRORS: { query: ['invalid'] } }));
    expect((await service.lookup(inn)).status).toBe('unavailable');
  });
  it('does not follow redirects or interpolate an untrusted ticket into a URL', async () => {
    fetchMock.mockResolvedValueOnce(json({ t: 'https://example.test/path' }));
    expect((await service.lookup(inn)).status).toBe('unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([{ rows: 'wrong' }, { status: 'error', rows: [] }, { rows: [{ ...record, o: 'malformed' }] },
    { rows: [{ ...record, o: '304500116000157' }] }, { rows: [{ ...record, e: false }] }])('treats protocol changes as unavailable: %p', async response => {
    ticket(); fetchMock.mockResolvedValueOnce(json(response));
    expect((await service.lookup(inn)).status).toBe('unavailable');
  });
  it('bounds waiting and never turns a pending search into a not-found result', async () => {
    ticket(); fetchMock.mockImplementation(async () => json({ status: 'wait' }));
    expect(await service.lookup(inn)).toMatchObject({ status: 'unavailable', reason: 'registry_wait_timeout' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('bounds response bytes and releases its concurrency lease after rejection', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x'.repeat(256 * 1024 + 1)));
    expect((await service.lookup(inn)).reason).toBe('registry_response_too_large');
    ticket(); fetchMock.mockResolvedValueOnce(json({ rows: [record] }));
    expect((await service.lookup(inn)).status).toBe('matched');
  });
  it('limits concurrent external lookups without starting an additional request', async () => {
    let finish!: (response: Response) => void;
    const waiting = new Promise<Response>(resolve => { finish = resolve; });
    fetchMock.mockImplementation(() => waiting);
    const one = service.lookup(inn), two = service.lookup(inn);
    expect(await service.lookup(inn)).toMatchObject({ status: 'unavailable', reason: 'registry_busy' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    finish(json({ captchaRequired: true }));
    await Promise.all([one, two]);
  });
});
