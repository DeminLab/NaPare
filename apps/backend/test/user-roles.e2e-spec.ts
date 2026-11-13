import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

import { createCurationFixture } from './curation.fixture';
import { UserRole } from '../src/auth/interfaces/user-role';
import { User } from '../src/users/entities/user.entity';
import { UserRoleMembership } from '../src/users/entities/user-role.entity';
import { UserRoles1700000000047 } from '../src/migrations/1700000000047-UserRoles';

const suite = process.env.USER_ROLES_TEST_DATABASE_URL ? describe : describe.skip;

/** ADR-0009 acceptance: roles live per organization, guards read the effective set. */
suite('ADR-0009 user_role: two organizations, dual-write and backfill', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  const tokens: Record<string, string> = {};
  const http = () => request(fixture.app.getHttpServer());
  const login = async () => {
    const response = await http().post('/api/v1/auth/login').send({ email: fixture.users.student.email, password: fixture.password }).expect(200);
    tokens.student = response.body.accessToken;
  };
  const memberships = () => fixture.db.getRepository(UserRoleMembership).find({ where: { userId: fixture.users.student.id } });
  const adminUsers = () => http().get('/api/v1/admin/users').auth(tokens.student, { type: 'bearer' });
  const changeRole = (role: UserRole) => http()
    .patch(`/api/v1/admin/users/${fixture.users.student.id}/roles`)
    .auth(tokens.owner, { type: 'bearer' })
    .send({ role });

  beforeAll(async () => {
    fixture = await createCurationFixture(process.env.USER_ROLES_TEST_DATABASE_URL!);
    // Role assignment follows ROLE_HIERARCHY (admin.service): only a strictly
    // higher role may grant university_admin, so the requester is a superadmin.
    const owner = await fixture.db.getRepository(User).save({
      email: 'owner@user-roles.example.test',
      firstName: 'Супер',
      lastName: 'Админ',
      role: UserRole.SUPERADMIN,
      organizationId: fixture.uni.id,
      isActive: true,
      passwordHash: await bcrypt.hash(fixture.password, 4),
    });
    const loginOwner = await http().post('/api/v1/auth/login').send({ email: owner.email, password: fixture.password }).expect(200);
    tokens.owner = loginOwner.body.accessToken;
    await login();
  }, 90000);

  it('ignores a membership that belongs to another organization', async () => {
    await fixture.db.getRepository(UserRoleMembership).save({
      userId: fixture.users.student.id,
      organizationId: fixture.otherUni.id,
      role: UserRole.UNIVERSITY_ADMIN,
    });

    await adminUsers().expect(403);

    const rows = await memberships();
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe(fixture.otherUni.id);
  });

  it('dual-writes the granted role and keeps the second organization membership', async () => {
    await changeRole(UserRole.UNIVERSITY_ADMIN).expect(200);

    const rows = await memberships();
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.organizationId === fixture.uni.id)?.role).toBe(UserRole.UNIVERSITY_ADMIN);
    expect(rows.find(row => row.organizationId === fixture.otherUni.id)?.role).toBe(UserRole.UNIVERSITY_ADMIN);

    // The legacy mirror follows the active organization's role.
    const user = await fixture.db.getRepository(User).findOneByOrFail({ id: fixture.users.student.id });
    expect(user.role).toBe(UserRole.UNIVERSITY_ADMIN);

    // Role assignment invalidates the session; the fresh token carries the admin role set.
    await login();
    await adminUsers().expect(200);
  });

  it('replaces only the active organization memberships on a role change', async () => {
    await changeRole(UserRole.TEACHER).expect(200);

    const rows = await memberships();
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.organizationId === fixture.uni.id)?.role).toBe(UserRole.TEACHER);
    // The other organization's membership is never touched by an active-organization role change.
    expect(rows.find(row => row.organizationId === fixture.otherUni.id)?.role).toBe(UserRole.UNIVERSITY_ADMIN);

    await login();
    await adminUsers().expect(403);
  });

  it('falls back to the legacy users.role when the active organization has no membership', async () => {
    await changeRole(UserRole.UNIVERSITY_ADMIN).expect(200);
    await fixture.db.getRepository(UserRoleMembership).delete({
      userId: fixture.users.student.id,
      organizationId: fixture.uni.id,
    });

    await login();
    await adminUsers().expect(200);
  });

  it('backfills every account and restores users.role on rollback', async () => {
    const runner = fixture.db.createQueryRunner();
    await runner.connect();
    const users = await fixture.db.getRepository(User).find();
    const withOrganization = users.filter(user => user.organizationId);
    try {
      await runner.query('DROP TABLE "user_role"');
      await new UserRoles1700000000047().up(runner);

      const rows: Array<{ userId: string; organizationId: string; role: string }> = await fixture.db.getRepository(UserRoleMembership).find();
      expect(rows).toHaveLength(withOrganization.length);
      for (const user of withOrganization) {
        expect(rows.find(row => row.userId === user.id && row.organizationId === user.organizationId)?.role)
          .toBe(user.role);
      }

      await new UserRoles1700000000047().down(runner);
      const gone = await runner.query(`SELECT to_regclass('user_role') IS NULL AS dropped`);
      expect(gone[0].dropped).toBe(true);
      const rolledBack = await fixture.db.getRepository(User).find();
      for (const user of users) {
        expect(rolledBack.find(row => row.id === user.id)?.role).toBe(user.role);
      }
    } finally {
      // Leave the schema in its expanded shape for any run after this suite.
      try { await new UserRoles1700000000047().up(runner); } finally { await runner.release(); }
    }
  });
});
