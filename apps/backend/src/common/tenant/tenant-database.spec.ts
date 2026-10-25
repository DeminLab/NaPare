import { DataSource, QueryRunner } from 'typeorm';

import { UserRole } from '../../auth/interfaces/user-role';
import { TenantContext } from './tenant-context';
import { installTenantDatabase } from './tenant-database';

describe('Tenant database connection scope', () => {
  function fixture(active = false) {
    const context = new TenantContext();
    const execute = jest.fn().mockResolvedValue([]);
    const runner = { query: execute, stream: jest.fn(), isTransactionActive: active } as unknown as QueryRunner;
    const source = { options: { type: 'postgres' }, createQueryRunner: () => runner } as unknown as DataSource;
    installTenantDatabase(source, context);
    return { context, execute, runner: source.createQueryRunner() };
  }

  it('sets local configuration on the same runner inside a short transaction', async () => {
    const { context, execute, runner } = fixture();
    await context.runInRequest(async () => {
      context.setUser({ id: 'actor', email: 'a@test', role: UserRole.STUDENT, universityId: 'university-a' });
      await runner.query('SELECT * FROM users');
    });
    expect(execute.mock.calls.map(call => call[0])).toEqual([
      'START TRANSACTION', expect.stringContaining("set_config('app.university_id'"), 'SELECT * FROM users', 'COMMIT',
    ]);
    expect(execute.mock.calls[1][1]).toEqual(['university-a', 'actor', '[]']);
  });

  it('preserves existing transactions and does not commit them', async () => {
    const { execute, runner } = fixture(true);
    await runner.query('SELECT 1');
    expect(execute.mock.calls.map(call => call[0])).toEqual([expect.stringContaining('set_config'), 'SELECT 1']);
    expect(execute.mock.calls[0][1]).toEqual(['', '', '[]']);
  });

  it('does not run a settings query before setting a transaction read-only', async () => {
    const { execute, runner } = fixture(true);
    await runner.query('SET TRANSACTION READ ONLY');
    expect(execute.mock.calls).toEqual([['SET TRANSACTION READ ONLY', undefined, undefined]]);
  });

  it('rolls back failed implicit statements before allowing runner reuse', async () => {
    const { execute, runner } = fixture();
    execute.mockImplementation(async sql => { if (sql === 'bad query') throw new Error('failed'); return []; });
    await expect(runner.query('bad query')).rejects.toThrow('failed');
    await runner.query('SELECT 1');
    expect(execute.mock.calls.map(call => call[0])).toEqual([
      'START TRANSACTION', expect.stringContaining('set_config'), 'bad query', 'ROLLBACK',
      'START TRANSACTION', expect.stringContaining('set_config'), 'SELECT 1', 'COMMIT',
    ]);
  });

  it('serializes simultaneous statements and captures their separate ALS identities', async () => {
    const { context, execute, runner } = fixture();
    await Promise.all(['a', 'b'].map(id => context.runInRequest(async () => {
      context.setUser({ id, email: `${id}@test`, role: UserRole.STUDENT, universityId: id });
      await runner.query(`SELECT '${id}'`);
    })));
    const settings = execute.mock.calls.filter(call => call[0].includes('set_config'));
    expect(settings.map(call => call[1])).toEqual([['a', 'a', '[]'], ['b', 'b', '[]']]);
    expect(execute.mock.calls.map(call => call[0]).filter(sql => ['COMMIT', 'START TRANSACTION'].includes(sql)))
      .toEqual(['START TRANSACTION', 'COMMIT', 'START TRANSACTION', 'COMMIT']);
  });

  it('fails closed for SQL streams that bypass query()', async () => {
    const { runner } = fixture();
    await expect(runner.stream('SELECT * FROM users')).rejects.toThrow('Tenant-scoped SQL streams');
  });
});
