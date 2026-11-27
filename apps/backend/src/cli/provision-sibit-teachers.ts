import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantContext } from '../common/tenant/tenant-context';
import { installTenantDatabase } from '../common/tenant/tenant-database';

interface TeacherInput {
  sourceTeacherId: string;
  email: string | null;
}

interface ProvisionedCredential {
  sourceTeacherId: string;
  username: string;
  email?: string;
  temporaryPassword?: string;
  passwordStatus: 'temporary_password_assigned' | 'unchanged_existing';
  accountStatus: 'created' | 'existing';
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function teacherUsername(sourceTeacherId: string): string {
  const username = `teacher${sourceTeacherId}`;
  if (!/^teacher[0-9]+$/.test(username) || username.length > 32) {
    throw new Error(`Teacher ID ${sourceTeacherId} cannot be represented by a valid username of at most 32 characters.`);
  }
  return username;
}

async function assertUsernameAvailable(
  manager: EntityManager,
  tenant: TenantContext,
  username: string,
  exceptUserId?: string,
): Promise<void> {
  const rows = await tenant.runWithDatabaseAccess({ tables: ['users'], organizationIds: null }, () => manager.query(
    'SELECT 1 FROM users WHERE lower(username) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1',
    [username, exceptUserId ?? null],
  )) as unknown[];
  if (rows.length) throw new Error(`Login ${username} is already used by another account.`);
}

function parseTeachers(raw: string): TeacherInput[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Input must be a non-empty JSON array of teacher mappings.');
  }
  const seen = new Set<string>();
  const seenEmails = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Row ${index + 1} is invalid.`);
    const teacher = item as Partial<TeacherInput>;
    const sourceTeacherId = String(teacher.sourceTeacherId || '').trim();
    const rawEmail = typeof teacher.email === 'string' ? teacher.email.trim().toLowerCase() : '';
    const email = rawEmail || null;
    if (!/^\d+$/.test(sourceTeacherId) || (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new Error(`Row ${index + 1} needs a numeric sourceTeacherId and, when supplied, a valid email.`);
    }
    teacherUsername(sourceTeacherId);
    if (seen.has(sourceTeacherId)) throw new Error(`Duplicate sourceTeacherId ${sourceTeacherId}.`);
    if (email && seenEmails.has(email)) throw new Error(`Duplicate email ${email}.`);
    seen.add(sourceTeacherId);
    if (email) seenEmails.add(email);
    return { sourceTeacherId, email };
  });
}

async function main() {
  const organizationId = option('--university-id');
  const inputPath = option('--input');
  const credentialsPath = option('--credentials-output');
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run');
  if (!organizationId || !inputPath || (!apply && !dryRun) || (apply && !credentialsPath)) {
    throw new Error('Usage: provision-sibit-teachers --university-id UUID --input /run/secrets/sibit-teachers.json --dry-run | --apply --credentials-output /tmp/sibit-teacher-credentials.json');
  }
  if (apply && dryRun) throw new Error('Choose either --dry-run or --apply.');

  const teachers = parseTeachers(await readFile(inputPath, 'utf8'));
  if (apply) await writeFile(credentialsPath!, '', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  const db = new DataSource({
    type: 'postgres',
    ...(process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || 5432),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        }),
    entities: [],
    synchronize: false,
  });

  const tenant = new TenantContext();
  installTenantDatabase(db, tenant);
  try {
    await db.initialize();
  } catch (error) {
    if (apply) await rm(credentialsPath!, { force: true });
    throw error;
  }
  await tenant.runWithDatabaseAccess({ tables: ['users', 'lessons'], organizationIds: [organizationId], write: apply }, async () => {
  let databaseCommitted = false;
  try {
    const universities = await db.query(
      'SELECT id FROM universities WHERE id = $1 AND "connectorType" = $2',
      [organizationId, 'rasp-sano'],
    );
    if (universities.length !== 1) throw new Error('University ID must point to one SIBIT rasp-sano tenant.');

    const lessonRows = await db.query(
      `SELECT "sourceTeacherId", min("teacherName") AS "teacherName", count(*)::int AS lessons, count(DISTINCT "groupId")::int AS groups
       FROM lessons WHERE "organizationId" = $1 AND source = 'sibit'
       GROUP BY "sourceTeacherId"`,
      [organizationId],
    ) as Array<{ sourceTeacherId: string | null; teacherName: string | null; lessons: number; groups: number }>;
    const lessonMap = new Map(lessonRows.filter((row) => row.sourceTeacherId).map((row) => [row.sourceTeacherId!, row]));
    for (const teacher of teachers) {
      if (!lessonMap.has(teacher.sourceTeacherId)) {
        throw new Error(`No synced SIBIT lessons for teacher ID ${teacher.sourceTeacherId}; sync the schedule first.`);
      }
      if (/вакансия/i.test(lessonMap.get(teacher.sourceTeacherId)?.teacherName || '')) {
        throw new Error(`Teacher ID ${teacher.sourceTeacherId} is a vacancy label, not a human account.`);
      }
    }

    if (dryRun) {
      for (const teacher of teachers) {
        const schedule = lessonMap.get(teacher.sourceTeacherId)!;
        const desiredUsername = teacherUsername(teacher.sourceTeacherId);
        const linkedRows = await db.query(
          'SELECT id, username, email, role, "sourceTeacherId", "isActive" FROM users WHERE "organizationId" = $1 AND "sourceTeacherId" = $2',
          [organizationId, teacher.sourceTeacherId],
        ) as Array<{ id: string; username: string | null; email: string | null; role: string; sourceTeacherId: string | null; isActive: boolean }>;
        const emailRows = !linkedRows.length && teacher.email ? await db.query(
          'SELECT id, username, role, "sourceTeacherId", "isActive" FROM users WHERE "organizationId" = $1 AND lower(email) = lower($2)',
          [organizationId, teacher.email],
        ) as Array<{ id: string; username: string | null; role: string; sourceTeacherId: string | null; isActive: boolean }> : [];
        const existing = linkedRows[0] || emailRows[0];
        if (existing && (existing.role !== 'teacher' || !existing.isActive || (existing.sourceTeacherId && existing.sourceTeacherId !== teacher.sourceTeacherId))) {
          throw new Error(`Teacher ID ${teacher.sourceTeacherId} conflicts with an existing inactive, non-teacher, or differently linked account.`);
        }
        if (linkedRows[0] && teacher.email && linkedRows[0].email?.toLowerCase() !== teacher.email) {
          throw new Error(`Teacher ID ${teacher.sourceTeacherId} is already linked to another email; update the input email before rerunning.`);
        }
        const username = existing?.username || desiredUsername;
        if (!existing?.username) await assertUsernameAvailable(db.manager, tenant, desiredUsername, existing?.id);
        process.stdout.write(`${teacher.sourceTeacherId}\t${schedule.teacherName}\t${username}\t${teacher.email ?? '(email not provided)'}\t${existing ? 'existing account' : 'new account'}\t${schedule.lessons} lessons\t${schedule.groups} groups\n`);
      }
      process.stdout.write(`Dry run complete: ${teachers.length} teacher accounts, no database changes.\n`);
      return;
    }

    const accountDetails: ProvisionedCredential[] = [];
    const result = await db.transaction(async (manager) => {
      let created = 0;
      let linked = 0;
      const groupLinks: Array<{ teacher: string; groups: number; lessons: number }> = [];

      for (const teacher of teachers) {
        const sourceName = lessonMap.get(teacher.sourceTeacherId)?.teacherName?.trim() || '';
        const [lastName = '', ...firstNames] = sourceName.split(/\s+/);
        const firstName = firstNames.join(' ') || lastName;
        if (!sourceName || !lastName) throw new Error(`No source teacher name for ID ${teacher.sourceTeacherId}.`);
        let userRows = await manager.query(
          'SELECT id, username, email, role, "sourceTeacherId", "isActive" FROM users WHERE "organizationId" = $1 AND "sourceTeacherId" = $2 FOR UPDATE',
          [organizationId, teacher.sourceTeacherId],
        ) as Array<{ id: string; username: string | null; email: string | null; role: string; sourceTeacherId: string | null; isActive: boolean }>;
        let user = userRows[0];
        let newPassword: string | undefined;
        let wasCreated = false;
        if (user && teacher.email && user.email?.toLowerCase() !== teacher.email) {
          throw new Error(`Teacher ID ${teacher.sourceTeacherId} is already linked to another email; update the input email before rerunning.`);
        }
        if (!user) {
          const emailRows = teacher.email ? await manager.query(
            'SELECT id, username, email, role, "organizationId", "sourceTeacherId", "isActive" FROM users WHERE lower(email) = lower($1) FOR UPDATE',
            [teacher.email],
          ) as Array<{ id: string; username: string | null; email: string | null; role: string; organizationId: string | null; sourceTeacherId: string | null; isActive: boolean }> : [];
          const existing = emailRows[0];
          if (existing) {
            if (existing.organizationId !== organizationId || existing.role !== 'teacher' || !existing.isActive || (existing.sourceTeacherId && existing.sourceTeacherId !== teacher.sourceTeacherId)) {
              throw new Error(`Email ${teacher.email} belongs to a different account and was not modified.`);
            }
            user = existing;
            await manager.query('UPDATE users SET "sourceTeacherId" = $1 WHERE id = $2', [teacher.sourceTeacherId, user.id]);
            linked++;
          } else {
            const username = teacherUsername(teacher.sourceTeacherId);
            await assertUsernameAvailable(manager, tenant, username);
            const temporaryPassword = randomBytes(18).toString('base64url');
            const passwordHash = await bcrypt.hash(temporaryPassword, 12);
            const id = randomUUID();
            await manager.query(
              `INSERT INTO users (id, username, email, "passwordHash", "firstName", "lastName", role, "organizationId", "sourceTeacherId", "isActive", "sessionVersion", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, 'teacher', $7, $8, true, 0, now(), now())`,
              [id, username, teacher.email, passwordHash, firstName, lastName, organizationId, teacher.sourceTeacherId],
            );
            user = { id, username, email: teacher.email, role: 'teacher', sourceTeacherId: teacher.sourceTeacherId, isActive: true };
            newPassword = temporaryPassword;
            wasCreated = true;
            created++;
          }
        } else if (user.role !== 'teacher' || !user.isActive) {
          throw new Error(`Source teacher ${teacher.sourceTeacherId} is linked to a non-teacher or inactive account.`);
        }

        if (user && !user.username) {
          const username = teacherUsername(teacher.sourceTeacherId);
          await assertUsernameAvailable(manager, tenant, username, user.id);
          await manager.query('UPDATE users SET username = $1 WHERE id = $2', [username, user.id]);
          user.username = username;
        }
        if (!user?.username) throw new Error(`Could not assign a username to teacher ID ${teacher.sourceTeacherId}.`);
        accountDetails.push({
          sourceTeacherId: teacher.sourceTeacherId,
          username: user.username,
          ...(user.email ? { email: user.email } : {}),
          ...(newPassword ? { temporaryPassword: newPassword } : {}),
          passwordStatus: newPassword ? 'temporary_password_assigned' : 'unchanged_existing',
          accountStatus: wasCreated ? 'created' : 'existing',
        });

        await manager.query(
          `UPDATE lessons SET "teacherId" = $1
           WHERE "organizationId" = $2 AND source = 'sibit' AND "sourceTeacherId" = $3`,
          [user.id, organizationId, teacher.sourceTeacherId],
        );
        const linkCounts = await manager.query(
          `SELECT COUNT(*)::int AS lessons, COUNT(DISTINCT "groupId")::int AS groups
           FROM lessons
           WHERE "organizationId" = $1 AND source = 'sibit'
             AND "sourceTeacherId" = $2 AND "teacherId" = $3`,
          [organizationId, teacher.sourceTeacherId, user.id],
        ) as Array<{ lessons: number; groups: number }>;
        groupLinks.push({
          teacher: teacher.sourceTeacherId,
          groups: Number(linkCounts[0]?.groups ?? 0),
          lessons: Number(linkCounts[0]?.lessons ?? 0),
        });
      }
      const credentialFile = JSON.stringify({ createdAt: new Date().toISOString(), accounts: accountDetails }, null, 2) + '\n';
      await writeFile(credentialsPath!, credentialFile, { encoding: 'utf8', mode: 0o600 });
      await chmod(credentialsPath!, 0o600);
      return { created, linked, groupLinks };
    });
    databaseCommitted = true;

    process.stdout.write(`Created ${result.created} accounts; linked ${result.linked} existing accounts.\n`);
    for (const row of result.groupLinks) process.stdout.write(`${row.teacher}: ${row.lessons} lessons linked across ${row.groups} groups.\n`);
    process.stdout.write(`Account access details were saved to ${credentialsPath} with owner-only permissions. Existing-account passwords were not changed or included. Distribute securely, then delete the file.\n`);
  } catch (error) {
    if (!databaseCommitted && apply) await rm(credentialsPath!, { force: true });
    throw error;
  } finally {
    await db.destroy();
  }
  });
}

if (require.main === module) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
