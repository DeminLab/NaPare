import { DataSource, QueryRunner } from 'typeorm';

import { TenantContext } from './tenant-context';

const installed = new WeakSet<DataSource>();
const transactionControl = /^\s*(?:START TRANSACTION|BEGIN|COMMIT|ROLLBACK(?: TO SAVEPOINT typeorm_\d+)?|SAVEPOINT typeorm_\d+|RELEASE SAVEPOINT typeorm_\d+|SET TRANSACTION READ ONLY|SET TRANSACTION ISOLATION LEVEL (?:READ UNCOMMITTED|READ COMMITTED|REPEATABLE READ|SERIALIZABLE))\s*;?\s*$/i;

/** Check before migrations/synchronization; a privileged runtime must not mutate schema. */
export async function assertTenantDatabaseRole(source: DataSource): Promise<void> {
  const [role] = await source.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error('Backend database role must be NOSUPERUSER NOBYPASSRLS for tenant row security');
  }
}

/** Startup invariant, including tables added after the original migration. */
export async function assertTenantDatabase(source: DataSource): Promise<void> {
  await assertTenantDatabaseRole(source);
  const uncovered = await source.query(`
    SELECT DISTINCT c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
      AND a.attname IN ('universityId', 'university_id') AND a.attnum > 0 AND NOT a.attisdropped
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR
        (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid AND NOT p.polpermissive
          AND p.polname IN ('napare_tenant_select', 'napare_tenant_insert', 'napare_tenant_update', 'napare_tenant_delete')) <> 4)
  `);
  if (uncovered.length) throw new Error(`Missing tenant row security: ${uncovered.map(row => row.relname).join(', ')}`);
}

/**
 * TypeORM Repository, EntityManager and raw DataSource queries all eventually
 * use createQueryRunner(). Patch that seam, never a separate request runner.
 * Each statement gets transaction-local settings on its own connection; an
 * existing TypeORM transaction keeps its atomicity. SSE holds no transaction.
 */
export function installTenantDatabase(source: DataSource, tenant: TenantContext): DataSource {
  if (source.options.type !== 'postgres' || installed.has(source)) return source;
  installed.add(source);
  const createRunner = source.createQueryRunner.bind(source);
  source.createQueryRunner = (mode) => scopeRunner(createRunner(mode), tenant);
  return source;
}

function scopeRunner(runner: QueryRunner, tenant: TenantContext): QueryRunner {
  const query = runner.query.bind(runner);
  let queue: Promise<unknown> = Promise.resolve();
  runner.query = (sql: string, parameters?: unknown[], structured?: boolean): Promise<any> => {
    // Capture now, not when another queued statement finishes in a different ALS.
    const actor = tenant.getUser();
    const capabilities = tenant.getDatabaseAccess();
    const replaceActor = capabilities.some(capability => 'replaceActor' in capability && capability.replaceActor);
    const access = JSON.stringify(capabilities);
    const execute = async () => {
      if (transactionControl.test(sql)) return query(sql, parameters, structured);
      const ownTransaction = !runner.isTransactionActive;
      if (ownTransaction) await query('START TRANSACTION');
      try {
        await query(
          "SELECT set_config('app.university_id', $1, true), set_config('app.actor_id', $2, true), set_config('app.tenant_access', $3, true)",
          [replaceActor ? '' : actor?.universityId ?? '', replaceActor ? '' : actor?.id ?? '', access],
        );
        const result = await query(sql, parameters, structured);
        if (ownTransaction) await query('COMMIT');
        return result;
      } catch (error) {
        if (ownTransaction) await query('ROLLBACK');
        throw error;
      }
    };
    const result = queue.then(execute);
    queue = result.catch(() => undefined);
    return result;
  };
  // TypeORM's stream() goes directly to pg, bypassing query(). No application
  // uses SQL streams. Fail closed until streaming has its own scoped lifetime.
  runner.stream = async () => { throw new Error('Tenant-scoped SQL streams are not supported'); };
  return runner;
}
