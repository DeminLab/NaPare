import { describe, expect, it, vi } from 'vitest';
import { getInitData, initializeMax } from './max-bridge';

describe('MAX Bridge wrapper', () => {
  it('falls back outside MAX', async () => {
    expect(await initializeMax()).toBeNull();
    expect(getInitData()).toBeNull();
  });

  it('initializes the bridge without trusting launch data as identity', async () => {
    const ready = vi.fn();
    const expand = vi.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { WebApp: { initData: 'signed-launch-data', ready, expand } },
    });

    const app = await initializeMax();

    expect(app).not.toBeNull();
    expect(ready).toHaveBeenCalledOnce();
    expect(expand).toHaveBeenCalledOnce();
    expect(getInitData()).toBe('signed-launch-data');
    delete (globalThis as { window?: unknown }).window;
  });
});
