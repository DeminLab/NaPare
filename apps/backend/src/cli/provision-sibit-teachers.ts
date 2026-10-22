import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantContext } from '../common/tenant/tenant-context';
import { installTenantDatabase } from '../common/tenant/tenant-database';

interface TeacherInput {
  sourceTeacherId: string;
  email: string;
}

interface ProvisionedCredential {
  sourceTeacherId: string;
  email: string;
  temporaryPassword: string;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
    const email = String(teacher.email || '').trim().toLowerCase();
    if (!/^\d+$/.test(sourceTeacherId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Row ${index + 1} needs numeric sourceTeacherId and email.`);
    }
    if (seen.has(sourceTeacherId)) throw new Error(`Duplicate sourceTeacherId ${sourceTeacherId}.`);
    if (seenEmails.has(email)) throw new Error(`Duplicate email ${email}.`);
    seen.add(sourceTeacherId);
    seenEmails.add(email);
    return { sourceTeacherId, email };
  });
}

async function main() {
  const universityId = option('--university-id');
  const inputPath = option('--input');
  const credentialsPath = option('--credentials-output');
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run');
  if (!universityId || !inputPath || (!apply && !dryRun) || (apply && !credentialsPath)) {
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
  await tenant.runWithDatabaseAccess({ tables: ['users', 'lessons'], universityIds: [universityId], write: apply }, async () => {
  let databaseCommitted = false;
  try {
    const universities = await db.query(
      'SELECT id FROM universities WHERE id = $1 AND "connectorType" = $2',
      [universityId, 'rasp-sano'],
    );
    if (universities.length !== 1) throw new Error('University ID must point to one SIBIT rasp-sano tenant.');

    const lessonRows = await db.query(
      `SELECT "sourceTeacherId", min("teacherName") AS "teacherName", count(*)::int AS lessons, count(DISTINCT "groupId")::int AS groups
       FROM lessons WHERE "universityId" = $1 AND source = 'sibit'
       GROUP BY "sourceTeacherId"`,
      [universityId],
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
        process.stdout.write(`${teacher.sourceTeacherId}\t${schedule.teacherName}\t${teacher.email}\t${schedule.lessons} lessons\t${schedule.groups} groups\n`);
      }
      process.stdout.write(`Dry run complete: ${teachers.length} teacher accounts, no database changes.\n`);
      return;
    }

    const temporaryCredentials: ProvisionedCredential[] = [];
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
          'SELECT id, email, role, "sourceTeacherId", "isActive" FROM users WHERE "universityId" = $1 AND "sourceTeacherId" = $2 FOR UPDATE',
          [universityId, teacher.sourceTeacherId],
        ) as Array<{ id: string; email: string; role: string; sourceTeacherId: string | null; isActive: boolean }>;
        let user = userRows[0];
        if (user && user.email.toLowerCase() !== teacher.email) {
          throw new Error(`Teacher ID ${teacher.sourceTeacherId} is already linked to ${user.email}; update the input email before rerunning.`);
        }
        if (!user) {
          const emailRows = await manager.query(
            'SELECT id, email, role, "universityId", "sourceTeacherId", "isActive" FROM users WHERE lower(email) = lower($1) FOR UPDATE',
            [teacher.email],
          ) as Array<{ id: string; email: string; role: string; universityId: string | null; sourceTeacherId: string | null; isActive: boolean }>;
          const existing = emailRows[0];
          if (existing) {
            if (existing.universityId !== universityId || existing.role !== 'teacher' || !existing.isActive || (existing.sourceTeacherId && existing.sourceTeacherId !== teacher.sourceTeacherId)) {
              throw new Error(`Email ${teacher.email} belongs to a different account and was not modified.`);
            }
            user = existing;
            await manager.query('UPDATE users SET "sourceTeacherId" = $1 WHERE id = $2', [teacher.sourceTeacherId, user.id]);
            linked++;
          } else {
            const temporaryPassword = randomBytes(18).toString('base64url');
            const passwordHash = await bcrypt.hash(temporaryPassword, 12);
            const id = randomUUID();
            await manager.query(
              `INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, "universityId", "sourceTeacherId", "isActive", "sessionVersion", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, 'teacher', $6, $7, true, 0, now(), now())`,
              [id, teacher.email, passwordHash, firstName, lastName, universityId, teacher.sourceTeacherId],
            );
            user = { id, email: teacher.email, role: 'teacher', sourceTeacherId: teacher.sourceTeacherId, isActive: true };
            temporaryCredentials.push({ sourceTeacherId: teacher.sourceTeacherId, email: teacher.email, temporaryPassword });
            created++;
          }
        } else if (user.role !== 'teacher' || !user.isActive) {
          throw new Error(`Source teacher ${teacher.sourceTeacherId} is linked to a non-teacher or inactive account.`);
        }

        const updated = await manager.query(
          `UPDATE lessons SET "teacherId" = $1
           WHERE "universityId" = $2 AND source = 'sibit' AND "sourceTeacherId" = $3
           RETURNING "groupId"`,
          [user.id, universityId, teacher.sourceTeacherId],
        ) as Array<{ groupId: string }>;
        groupLinks.push({ teacher: teacher.sourceTeacherId, groups: new Set(updated.map((row) => row.groupId)).size, lessons: updated.length });
      }
      const credentialFile = JSON.stringify({ createdAt: new Date().toISOString(), credentials: temporaryCredentials }, null, 2) + '\n';
      await writeFile(credentialsPath!, credentialFile, { encoding: 'utf8', mode: 0o600 });
      await chmod(credentialsPath!, 0o600);
      return { created, linked, groupLinks };
    });
    databaseCommitted = true;

    process.stdout.write(`Created ${result.created} accounts; linked ${result.linked} existing accounts.\n`);
    for (const row of result.groupLinks) process.stdout.write(`${row.teacher}: ${row.lessons} lessons linked across ${row.groups} groups.\n`);
    process.stdout.write(`Temporary credentials were saved to ${credentialsPath} with owner-only permissions. Distribute them securely, then delete that file.\n`);
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
