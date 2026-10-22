import { DataSource } from 'typeorm';
import { TenantContext } from '../src/common/tenant/tenant-context';

/** Explicit capability for disposable test setup/assertions; HTTP keeps the real scoped source. */
export function fixtureDatabase(source: DataSource, context: TenantContext): DataSource {
  const tables = source.entityMetadatas.filter(entity => entity.columns.some(column => ['universityId', 'university_id'].includes(column.databaseName))).map(entity => entity.tableName);
  const scope = { tables, universityIds: null, write: true };
  const factories = new Set(['getRepository', 'getTreeRepository', 'createQueryBuilder', 'createQueryRunner', 'createEntityManager']);
  const wrap = <T extends object>(target: T): T => new Proxy(target, {
    get(object, key) {
      const value = Reflect.get(object, key, object);
      if (key === 'manager' && value) return wrap(value);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => context.runWithDatabaseAccess(scope, () => {
        const result = value.apply(object, args);
        if (result === object) return wrap(object);
        return factories.has(String(key)) && result ? wrap(result) : result;
      });
    },
  });
  return wrap(source);
}
