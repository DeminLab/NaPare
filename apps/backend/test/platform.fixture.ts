import { createCurationFixture } from './curation.fixture';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { bindPlatformOwner } from '../src/platform/bootstrap-owner';
import { PlatformControl1700000000021 } from '../src/migrations/1700000000021-PlatformControl';

export async function createPlatformFixture(url: string) {
  const fixture = await createCurationFixture(url);
  // Exercise the production migration on a disposable local database only.
  await fixture.db.query('DROP TABLE platform_grants');
  await fixture.db.query('DROP TABLE platform_control');
  const runner = fixture.db.createQueryRunner(); await runner.connect();
  try { await new PlatformControl1700000000021().up(runner); } finally { await runner.release(); }
  const base = { passwordHash: fixture.users.student.passwordHash, firstName:'Тест', isActive:true };
  const owner = await fixture.db.getRepository(User).save({ ...base, lastName:'Владелец', email:'owner@platform.example.test', role:UserRole.DEVELOPER, universityId:null });
  const developer = await fixture.db.getRepository(User).save({ ...base, lastName:'Разработчик', email:'developer@platform.example.test', role:UserRole.DEVELOPER, universityId:null });
  const superadmin = await fixture.db.getRepository(User).save({ ...base, lastName:'Суперадминистратор', email:'root@platform.example.test', role:UserRole.SUPERADMIN, universityId:fixture.uni.id });
  await bindPlatformOwner(fixture.db, owner.email);
  return { ...fixture, owner, developer, superadmin };
}
