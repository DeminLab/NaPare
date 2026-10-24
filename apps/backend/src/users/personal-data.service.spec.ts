import { EventEmitter } from 'node:events';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import { PersonalDataService } from './personal-data.service';

describe('Personal export connection lifecycle', () => {
  function fixture() {
    const tenant = new TenantContext();
    const runner = {
      isTransactionActive: false,
      connect: jest.fn(), release: jest.fn(),
      startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }),
      commitTransaction: jest.fn(async () => { runner.isTransactionActive = false; }),
      rollbackTransaction: jest.fn(async () => { runner.isTransactionActive = false; }),
      query: jest.fn(async (sql: string) => sql.startsWith('SELECT id FROM users') ? [{ id: 'self' }] : sql.includes('transaction_timestamp()') ? [{ at: '2026-10-23T00:00:00Z' }] : []),
    };
    const service = new PersonalDataService({ createQueryRunner: () => runner } as unknown as DataSource, tenant);
    const emitter = new EventEmitter();
    const response = Object.assign(emitter, {
      headersSent: false, destroyed: false,
      setHeader: jest.fn(),
      write: jest.fn((_chunk: string) => { response.headersSent = true; return true; }),
      end: jest.fn(),
      destroy: jest.fn(() => { response.destroyed = true; emitter.emit('close'); }),
    });
    const run = <T>(fn: () => T) => tenant.runInRequest(() => {
      tenant.setUser({ id: 'self', email: 'self@example.test', role: UserRole.STUDENT, universityId: 'uni' });
      return fn();
    });
    return { runner, service, response, run };
  }
  it('rolls back and closes a partial response on query failure; releases its lease for the next attempt', async () => {
    const { runner, service, response, run } = fixture();
    const ordinary = runner.query.getMockImplementation()!;
    runner.query.mockImplementation(async sql => {
      if (sql.includes('FROM "personal_lesson_notes"')) throw new Error('Database interrupted');
      return ordinary(sql);
    });
    await run(() => service.download(response as unknown as Response));
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(response.destroy).toHaveBeenCalledTimes(1);
    expect(response.end).not.toHaveBeenCalled();
    expect(response.write.mock.calls.map(call => call[0]).join('')).not.toContain('"complete":true');
    runner.query.mockImplementation(ordinary);
    response.destroyed = false;
    await run(() => service.download(response as unknown as Response));
    expect(response.end).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(2);
    expect(response.listenerCount('close')).toBe(0);
  });
  it('rejects a simultaneous self export and releases the runner when a stalled client disconnects', async () => {
    const { runner, service, response, run } = fixture();
    let written!: () => void;
    const firstWrite = new Promise<void>(resolve => { written = resolve; });
    response.write.mockImplementation(() => { response.headersSent = true; written(); return false; });
    const ongoing = run(() => service.download(response as unknown as Response));
    await firstWrite;
    await expect(run(() => service.download(response as unknown as Response))).rejects.toMatchObject({ status: 429 });
    response.destroy();
    await ongoing;
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(response.listenerCount('drain')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
    expect(response.listenerCount('error')).toBe(0);
  });
});
