import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { json, RequestHandler } from 'express';
import { UserRole } from '../src/auth/interfaces/user-role';
import { University } from '../src/users/entities/university.entity';
import { Faculty } from '../src/users/entities/faculty.entity';
import { Group } from '../src/users/entities/group.entity';
import { User } from '../src/users/entities/user.entity';
import { Absence } from '../src/absences/entities/absence.entity';
import { Lesson } from '../src/schedule/entities/lesson.entity';
import { CuratorAssignments1700000000020 } from '../src/migrations/1700000000020-CuratorAssignments';
import { TenantRowSecurity1700000000029 } from '../src/migrations/1700000000029-TenantRowSecurity';
import { OfficeReports1700000000042 } from '../src/migrations/1700000000042-OfficeReports';
import { TenantOrganizationAlias1700000000046 } from '../src/migrations/1700000000046-TenantOrganizationAlias';
import { CareerVacancies1700000000052 } from '../src/migrations/1700000000052-CareerVacancies';
import { Invites1700000000049 } from '../src/migrations/1700000000049-Invites';
import { PublicPortfolioRead1700000000053 } from '../src/migrations/1700000000053-PublicPortfolioRead';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { fixtureDatabase } from './tenant-database.fixture';
import { installHttpRouteEvidence } from './http-route-evidence';

/** Destructive setup is allowed ONLY in a new disposable curation_test_* database. */
export async function createCurationFixture(url: string, options: { organizationIds?: [string,string] } = {}) {
  const target = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/curation_test_[a-z0-9_]+$/.test(target.pathname)) throw new Error('A local disposable curation_test_* database is required');
  Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'), JWT_ACCESS_EXPIRATION: '15m', JWT_REFRESH_EXPIRATION: '30d', TELEGRAM_BOT_TOKEN: '', TELEGRAM_BOT_USERNAME: '', TELEGRAM_WEBHOOK_SECRET: '', MAX_BOT_TOKEN: '', SENTRY_DSN: '', RATE_LIMIT_MAX: '10000' });
  const { AppModule } = await import('../src/app.module');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = module.createNestApplication({ logger: false });
  let evidenceUniversities: string[] = [];
  installHttpRouteEvidence(app, () => evidenceUniversities);
  const uploadJson = json({ limit: '3mb' });
  app.use('/api/v1/admin/schedule/upload', ((req, res, next) => uploadJson(req, res, next)) as RequestHandler);
  app.use('/api/v1/requests/reports/debt-snapshots', ((req, res, next) => uploadJson(req, res, next)) as RequestHandler);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const db = fixtureDatabase(app.get(DataSource), app.get(TenantContext));
  if (await db.getRepository(User).count()) { await app.close(); throw new Error('Fixture database must contain no existing users'); }
  const uni = await db.getRepository(University).save({ ...(options.organizationIds?{id:options.organizationIds[0]}:{}), name: 'Кураторство — тест', city: 'Омск', status: 'active' });
  const otherUni = await db.getRepository(University).save({ ...(options.organizationIds?{id:options.organizationIds[1]}:{}), name: 'Другой вуз — тест', city: 'Омск', status: 'active' });
  evidenceUniversities = [uni.id, otherUni.id];
  const faculty = await db.getRepository(Faculty).save({ organizationId: uni.id, name: 'Информатика', code: 'ИН' });
  const otherFaculty = await db.getRepository(Faculty).save({ organizationId: otherUni.id, name: 'Другой факультет', code: 'ДР' });
  const groups = await db.getRepository(Group).save([
    { organizationId: uni.id, facultyId: faculty.id, name: 'ИН-25', curriculumYear: 2, externalId: '101' },
    { organizationId: uni.id, facultyId: faculty.id, name: 'ИН-34', curriculumYear: 3, externalId: '102' },
    { organizationId: uni.id, facultyId: faculty.id, name: 'ИН-43', curriculumYear: 4, externalId: '103' },
    { organizationId: otherUni.id, facultyId: otherFaculty.id, name: 'Чужая группа', curriculumYear: 2 },
  ]);
  const password = randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(password, 4);
  const definitions = [
    ['student', UserRole.STUDENT, uni.id, groups[0].id, true, 'Анна', 'Иванова'],
    ['peer', UserRole.STUDENT, uni.id, '101', true, 'Иван', 'Петров'],
    ['otherStudent', UserRole.STUDENT, uni.id, groups[2].id, true, 'Олег', 'Сидоров'],
    ['teacher', UserRole.TEACHER, uni.id, null, true, 'Мария', 'Соколова'],
    ['dean', UserRole.FACULTY_DEAN, uni.id, null, true, 'Елена', 'Орлова'],
    ['admin', UserRole.UNIVERSITY_ADMIN, uni.id, null, true, 'Павел', 'Кузнецов'],
    ['legacy', UserRole.CURATOR, uni.id, null, true, 'Ольга', 'Морозова'],
    ['outsider', UserRole.TEACHER, otherUni.id, null, true, 'Виктор', 'Зайцев'],
    ['blocked', UserRole.STUDENT, uni.id, groups[0].id, false, 'Пётр', 'Волков'],
  ] as const;
  const users: Record<string, User> = {};
  for (const [key, role, organizationId, groupId, isActive, firstName, lastName] of definitions) users[key] = await db.getRepository(User).save({ email: `${key}@curation.example.test`, firstName, lastName, role, organizationId, groupId: groupId ?? undefined, isActive, passwordHash });
  await db.getRepository(Group).update(groups[1].id, { curatorId: users.legacy.id });
  await db.getRepository(Group).update(groups[2].id, { curatorId: users.outsider.id });
  // Exercise the real migration, including rejection of a cross-university legacy pointer.
  await db.query('DROP TABLE curator_assignments');
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    // ADR-0008 expand around the historic tail: alias first so migrations 20/29/42
    // see their legacy column names, canonicalize after they recreate legacy text.
    await new TenantOrganizationAlias1700000000046().up(runner);
    await new CuratorAssignments1700000000020().up(runner);
    await new TenantRowSecurity1700000000029().up(runner);
    await new OfficeReports1700000000042().up(runner);
    await new TenantOrganizationAlias1700000000046().up(runner);
    // Migration 29 above re-created the invite policies without their relation
    // predicate; re-run 49 (idempotent) so the public claim path keeps working.
    await new Invites1700000000049().up(runner);
    await new CareerVacancies1700000000052().up(runner);
    // The public portfolio reads the published student and task rows through a
    // relation capability; renew it after the migration-29 replay above.
    await new PublicPortfolioRead1700000000053().up(runner);
  } finally { await runner.release(); }
  const now = new Date(); now.setHours(8, 30, 0, 0);
  const lesson = await db.getRepository(Lesson).save({ organizationId: uni.id, groupId: groups[0].id, teacherId: users.teacher.id, subject: 'Технологии программирования', teacherName: 'Соколова М.', groupName: groups[0].name, startDate: now, endDate: new Date(now.getTime() + 5400000), startTime: '08:30', endTime: '10:00', dayOfWeek: now.getDay(), pairNumber: 1, room: '416' });
  const makeAbsence = async (student = users.peer) => db.getRepository(Absence).save({ organizationId: student.organizationId!, studentId: student.id, type: 'sick', startDate: now, endDate: new Date(now.getTime() + 86400000), comment: 'По болезни', confirmationRequired: true });
  return { app, db, uni, otherUni, groups, users, password, lesson, makeAbsence };
}
