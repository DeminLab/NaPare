import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { Column, DataSource, Entity, PrimaryColumn, Repository } from 'typeorm';

import { TenantContext } from '../src/common/tenant/tenant-context';
import { assertTenantDatabase, installTenantDatabase } from '../src/common/tenant/tenant-database';
import { TenantRowSecurity1700000000029 } from '../src/migrations/1700000000029-TenantRowSecurity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { CareerCompany, CareerMembership, CareerPartnership, CareerTask, CareerProfile, CareerAdmission, CareerApplication } from '../src/career/career.entities';

@Entity('tenant_fixture_camel')
class TenantRow {
  @PrimaryColumn('text') id: string;
  @Column('uuid') universityId: string;
  @Column('text') label: string;
}

@Entity('tenant_fixture_snake')
class SnakeRow {
  @PrimaryColumn('text') id: string;
  @Column('uuid', { name: 'university_id' }) universityId: string;
}

@Entity('users')
class AuthRow {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { nullable: true }) universityId: string | null;
  @Column('text') email: string;
  @Column('text', { nullable: true }) maxUserId: string | null;
}

const adminUrl = process.env.TENANT_RLS_TEST_ADMIN_URL;
const integration = adminUrl ? describe : describe.skip;
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const actorA = { id: A, universityId: A, role: UserRole.STUDENT, email: 'a@tenant.test' };

integration('PostgreSQL tenant RLS with a non-superuser table owner', () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const databaseName = `tenant_test_rls_${suffix}`;
  const roleName = `tenant_test_rls_role_${suffix}`;
  const rolePassword = randomBytes(24).toString('hex');
  const context = new TenantContext();
  let admin: DataSource;
  let database: DataSource;
  let repository: Repository<TenantRow>;
  let companyId: string;
  let taskId: string;

  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(adminUrl!).hostname)) throw new Error('Tenant RLS tests require a separate local PostgreSQL cluster');
    admin = await new DataSource({ type: 'postgres', url: adminUrl }).initialize();
    await admin.query(`CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${rolePassword}'`);
    await admin.query(`CREATE DATABASE "${databaseName}" OWNER "${roleName}"`);
    const url = new URL(adminUrl!);
    url.username = roleName;
    url.password = rolePassword;
    url.pathname = `/${databaseName}`;
    database = await new DataSource({ type: 'postgres', url: url.toString(), entities: [TenantRow, SnakeRow, AuthRow, CareerCompany, CareerMembership, CareerPartnership, CareerTask, CareerProfile, CareerAdmission, CareerApplication], synchronize: true, extra: { max: 2 } }).initialize();
    await database.getRepository(TenantRow).save([{ id: 'a', universityId: A, label: 'A' }, { id: 'b', universityId: B, label: 'B' }]);
    await database.getRepository(SnakeRow).save([{ id: 'a', universityId: A }, { id: 'b', universityId: B }]);
    await database.getRepository(AuthRow).save([{ id: A, universityId: A, email: 'a@tenant.test', maxUserId: 'max-a' }, { id: B, universityId: B, email: 'b@tenant.test', maxUserId: 'max-b' }]);
    companyId = (await database.getRepository(CareerCompany).save({ name: 'Scoped company', createdBy: C })).id;
    await database.getRepository(CareerMembership).save({ userId: C, companyId, universityId: null, role: 'company_owner' });
    await database.getRepository(CareerPartnership).save({ companyId, universityId: B, state: 'verified' });
    taskId = (await database.getRepository(CareerTask).save({ companyId, universityId: B, title: 'Task B', description: 'Scope fixture', criteria: 'Criteria', rewardKopecks: 0, hours: 1, deadline: '2099-01-01' })).id;
    await database.getRepository(CareerApplication).save({ taskId, studentId: B, message: 'Application' });
    await database.getRepository(CareerProfile).save({ studentId: B, universityId: B, headline: 'Candidate B' });
    const runner = database.createQueryRunner();
    try { await new TenantRowSecurity1700000000029().up(runner); }
    finally { await runner.release(); }
    installTenantDatabase(database, context);
    // This repository is held across requests, as @InjectRepository does.
    repository = database.getRepository(TenantRow);
  }, 30000);

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.query(`DROP ROLE IF EXISTS "${roleName}"`);
      await admin.destroy();
    }
  });

  function asA<T>(run: () => T): T {
    return context.runInRequest(() => { context.setUser(actorA); return run(); });
  }

  it('enables FORCE RLS on every scalar university column and uses no role bypass', async () => {
    await expect(assertTenantDatabase(database)).resolves.toBeUndefined();
    const [role] = await database.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const rows = await database.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('users','tenant_fixture_camel','tenant_fixture_snake') ORDER BY relname");
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('denies all tenant reads without a request actor', async () => {
    expect(await repository.find()).toEqual([]);
    expect(await database.query('SELECT * FROM users')).toEqual([]);
  });

  it('scopes injected repository, query builder, raw queries and snake-case columns', async () => asA(async () => {
    expect((await repository.find()).map(row => row.id)).toEqual(['a']);
    expect(await repository.findOneBy({ id: 'b' })).toBeNull();
    expect(await repository.createQueryBuilder('row').where('row.id = :id', { id: 'b' }).getOne()).toBeNull();
    expect(await database.query('SELECT id FROM tenant_fixture_camel ORDER BY id')).toEqual([{ id: 'a' }]);
    expect((await database.getRepository(SnakeRow).find()).map(row => row.id)).toEqual(['a']);
  }));

  it('blocks foreign inserts, updates, deletes and moving an owned row to B', async () => asA(async () => {
    await expect(repository.insert({ id: 'foreign', universityId: B, label: 'escape' })).rejects.toThrow(/row-level security/);
    expect((await repository.update('b', { label: 'escape' })).affected).toBe(0);
    expect((await repository.delete('b')).affected).toBe(0);
    await expect(repository.update('a', { universityId: B })).rejects.toThrow(/row-level security/);
    await expect(database.getRepository(AuthRow).update(A, { universityId: null })).rejects.toThrow(/row-level security/);
    expect((await repository.findOneByOrFail({ id: 'a' })).universityId).toBe(A);
  }));

  it('propagates scope into DataSource transactions and rolls back forbidden writes', async () => {
    await expect(asA(() => database.transaction(async manager => {
      await manager.update(TenantRow, 'a', { label: 'rolled back' });
      expect(await manager.findOneBy(TenantRow, { id: 'b' })).toBeNull();
      await manager.insert(TenantRow, { id: 'forbidden-tx', universityId: B, label: 'escape' });
    }))).rejects.toThrow(/row-level security/);
    await asA(async () => expect((await repository.findOneByOrFail({ id: 'a' })).label).toBe('A'));
  });

  it('isolates concurrent pooled connections and clears context after failures', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, index) => context.runInRequest(async () => {
      const universityId = index % 2 ? A : B;
      context.setUser({ ...actorA, id: universityId, universityId });
      const rows = await repository.find();
      expect(rows).toHaveLength(1);
      expect(rows[0].universityId).toBe(universityId);
    })));
    expect(await repository.find()).toEqual([]);
    const [settings] = await database.query("SELECT current_setting('app.university_id', true) AS university, current_setting('app.actor_id', true) AS actor");
    expect(settings).toEqual({ university: '', actor: '' });
  });

  it('limits explicit grants by table, university and read/write capability', async () => {
    await context.runWithDatabaseAccess({ tables: ['tenant_fixture_camel'], universityIds: [B] }, async () => {
      expect((await repository.find()).map(row => row.id)).toEqual(['b']);
      expect(await database.getRepository(SnakeRow).find()).toEqual([]);
      await expect(repository.update('b', { label: 'escape' })).rejects.toThrow(/row-level security/);
      expect(await database.transaction(manager => manager.findOne(TenantRow, { where: { id: 'b' }, lock: { mode: 'pessimistic_read' } }))).not.toBeNull();
    });
    await context.runWithDatabaseAccess({ tables: ['tenant_fixture_camel'], universityIds: [] }, async () => expect(await repository.find()).toEqual([]));
    expect(await repository.find()).toEqual([]);
  });

  it('detects missing coverage and cannot be weakened by another permissive policy', async () => {
    await database.query('CREATE POLICY tenant_fixture_external_allow ON tenant_fixture_camel FOR ALL USING (true) WITH CHECK (true)');
    expect(await repository.find()).toEqual([]);
    await database.query('CREATE TABLE tenant_fixture_new (id text, "universityId" uuid)');
    try { await expect(assertTenantDatabase(database)).rejects.toThrow('tenant_fixture_new'); }
    finally { await database.query('DROP TABLE tenant_fixture_new'); }
  });

  it('gives authentication a single user identity without tenant-wide or write access', async () => {
    await context.runWithDatabaseAccess({ authentication: { email: 'B@TENANT.TEST' } }, async () => {
      expect((await database.getRepository(AuthRow).find()).map(row => row.id)).toEqual([B]);
      expect(await repository.find()).toEqual([]);
      await expect(database.getRepository(AuthRow).update(B, { email: 'escape@test' })).rejects.toThrow(/row-level security/);
    });
    await context.runWithDatabaseAccess({ authentication: { id: B, write: true } }, async () => {
      expect((await database.getRepository(AuthRow).update(B, { maxUserId: 'verified-max-b' })).affected).toBe(1);
      expect((await database.getRepository(AuthRow).update(A, { maxUserId: 'escape' })).affected).toBe(0);
    });
    expect(await database.getRepository(AuthRow).find()).toEqual([]);
  });

  it('does not infer a cross-university bypass from SUPERADMIN role', async () => {
    await context.runInRequest(async () => {
      context.setUser({ ...actorA, role: UserRole.SUPERADMIN });
      expect(await repository.findOneBy({ id: 'b' })).toBeNull();
    });
  });

  it('limits university-less employer access to persisted company membership and candidates', async () => {
    await context.runInRequest(async () => {
      context.setUser({ ...actorA, id: C, universityId: null, role: UserRole.EMPLOYER });
      expect((await database.getRepository(CareerMembership).find()).map(row => row.userId)).toEqual([C]);
      expect((await database.getRepository(CareerTask).find()).map(row => row.id)).toEqual([taskId]);
      expect((await database.getRepository(CareerPartnership).find()).map(row => row.companyId)).toEqual([companyId]);
      expect((await database.getRepository(CareerProfile).find()).map(row => row.studentId)).toEqual([B]);
      expect((await database.getRepository(AuthRow).find()).map(row => row.id)).toEqual([B]);
      expect(await repository.find()).toEqual([]);
    });
    await context.runInRequest(async () => {
      context.setUser({ ...actorA, id: '00000000-0000-4000-8000-000000000004', universityId: null, role: UserRole.EMPLOYER });
      expect(await database.getRepository(CareerMembership).find()).toEqual([]);
      expect(await database.getRepository(CareerTask).find()).toEqual([]);
      expect(await database.getRepository(CareerProfile).find()).toEqual([]);
      expect(await database.getRepository(AuthRow).find()).toEqual([]);
    });
  });
});
