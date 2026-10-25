import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

function fixture() {
  const handlers: Record<string, (event: object) => void> = {};
  const show = jest.fn().mockResolvedValue(undefined), open = jest.fn().mockResolvedValue(undefined), windows = jest.fn().mockResolvedValue([]);
  runInNewContext(readFileSync(join(__dirname, '../../../web-portal/public/notifications/push-worker.js'), 'utf8'), {
    URL, self: { location: { origin: 'https://napare.example.test' }, addEventListener: (name: string, handler: (event: object) => void) => { handlers[name] = handler; },
      registration: { showNotification: show }, clients: { matchAll: windows, openWindow: open } },
  });
  return { handlers, show, open, windows };
}
describe('Browser push worker privacy and navigation', () => {
  it('always displays neutral text and never consumes private message text or a payload URL', async () => {
    const f = fixture(), waits: Promise<void>[] = [];
    f.handlers.push({ data: { json: () => ({ id: '11111111-1111-4111-8111-111111111111', title: 'PRIVATE_TITLE', body: 'PRIVATE_BODY', deepLink: 'https://attacker.test/' }) }, waitUntil: (value: Promise<void>) => waits.push(value) });
    await Promise.all(waits);
    expect(f.show).toHaveBeenCalledTimes(1);
    expect(f.show.mock.calls[0][0]).toBe('НаПаре');
    const options = f.show.mock.calls[0][1];
    expect(options.tag).toBe('napare-11111111-1111-4111-8111-111111111111');
    expect(options.data.url).toBe('/notifications/setup');
    expect(JSON.stringify(options)).not.toMatch(/PRIVATE_|attacker/);
    expect(f.handlers.fetch).toBeUndefined();
  });
  it('handles a malformed payload without revealing or rendering its content', async () => {
    const f = fixture(), waits: Promise<void>[] = [];
    f.handlers.push({ data: { json: () => { throw new Error('bad JSON'); } }, waitUntil: (value: Promise<void>) => waits.push(value) });
    await Promise.all(waits); expect(f.show.mock.calls[0][1].tag).toBe('napare-update');
  });
  it('opens a fixed same-origin setup route instead of a foreign payload destination', async () => {
    const f = fixture(), waits: Promise<void>[] = [], close = jest.fn();
    f.windows.mockResolvedValue([{ url: 'https://attacker.test/notifications/setup', focus: jest.fn() }, { url: 'https://napare.example.test/student/notifications', focus: jest.fn() }]);
    f.handlers.notificationclick({ notification: { close, data: { url: 'https://attacker.test/' } }, waitUntil: (value: Promise<void>) => waits.push(value) });
    await Promise.all(waits); expect(close).toHaveBeenCalledTimes(1); expect(f.open).toHaveBeenCalledWith('https://napare.example.test/notifications/setup');
  });
  it('focuses an existing setup tab without navigating an unrelated workspace', async () => {
    const f = fixture(), waits: Promise<void>[] = [], focus = jest.fn().mockResolvedValue(undefined);
    f.windows.mockResolvedValue([{ url: 'https://napare.example.test/notifications/setup?from=push', focus }]);
    f.handlers.notificationclick({ notification: { close: jest.fn() }, waitUntil: (value: Promise<void>) => waits.push(value) });
    await Promise.all(waits); expect(focus).toHaveBeenCalledTimes(1); expect(f.open).not.toHaveBeenCalled();
  });
});
