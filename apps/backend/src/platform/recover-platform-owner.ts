import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantContext } from '../common/tenant/tenant-context';
import { TenantDatabaseGrant } from '../common/tenant/tenant-database-access';
import { installTenantDatabase } from '../common/tenant/tenant-database';
import { normalizeUsername } from '../auth/username';

const OWNER_BOOTSTRAP_LOCK = 707247125;
const GLOBAL_USER_ACCESS: TenantDatabaseGrant = {
  tables: ['users'],
  organizationIds: null,
  write: true,
  replaceActor: true,
};

function option(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required option ${name}`);
  return process.argv[index + 1].trim();
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 254) {
    throw new Error('Pass a valid email address.');
  }
  return normalized;
}

async function readPassword(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 4096) throw new Error('Password input is too long.');
    chunks.push(buffer);
  }
  let password = Buffer.concat(chunks).toString('utf8');
  if (password.endsWith('\n')) password = password.slice(0, -1);
  if (password.endsWith('\r')) password = password.slice(0, -1);
  if (password.length < 6) throw new Error('Password must contain at least 6 characters.');
  if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('Password must occupy no more than 72 UTF-8 bytes.');
  return password;
}

export async function recoverPlatformOwnerCredentials(
  db: DataSource,
  input: { currentEmail: string; username: string; email?: string; firstName: string; lastName: string; password: string },
): Promise<string> {
  const currentEmail = normalizeEmail(input.currentEmail);
  const email = input.email ? normalizeEmail(input.email) : undefined;
  const username = normalizeUsername(input.username);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    throw new Error('Owner first name and last name are required and must be at most 100 characters.');
  }
  if (input.password.length < 6 || Buffer.byteLength(input.password, 'utf8') > 72) {
    throw new Error('Password must contain at least 6 characters and no more than 72 UTF-8 bytes.');
  }
  const passwordHash = await bcrypt.hash(input.password, 12);

  return db.transaction(async manager => {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [OWNER_BOOTSTRAP_LOCK]);
    const controls = await manager.query('SELECT id, "ownerId" FROM platform_control WHERE id = $1 FOR UPDATE', ['platform']);
    if (controls.length !== 1) throw new Error('Platform owner is not configured; this recovery command will not create or replace one.');

    const ownerId = controls[0].ownerId as string;
    const owners = await manager.query(
      `SELECT id, username, email, role, "isActive", "firstName", "lastName"
       FROM users WHERE id = $1 FOR UPDATE`,
      [ownerId],
    );
    if (owners.length !== 1) throw new Error('Configured platform owner account was not found.');
    const owner = owners[0];
    if (owner.email.toLowerCase() !== currentEmail) throw new Error('Current email does not match the configured platform owner.');
    if (!owner.isActive || !['developer', 'superadmin'].includes(owner.role)) {
      throw new Error('Configured owner must be an active developer/superadmin account.');
    }

    if (email) {
      const duplicateEmail = await manager.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
        [email, ownerId],
      );
      if (duplicateEmail.length) throw new Error('New email is already used by another account.');
    }
    const duplicateUsername = await manager.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
      [username, ownerId],
    );
    if (duplicateUsername.length) throw new Error('Username is already used by another account.');

    await manager.query(
      `UPDATE users
       SET username = $1, email = COALESCE($2, email), "firstName" = $3, "lastName" = $4,
           "passwordHash" = $5, "sessionVersion" = "sessionVersion" + 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [username, email ?? null, firstName, lastName, passwordHash, ownerId],
    );
    await manager.query(
      `INSERT INTO audit_logs ("userId", action, entity, "entityId", "oldValues", "newValues")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        ownerId,
        'platform.owner.credentials_recovered',
        'platform',
        ownerId,
        JSON.stringify({ username: owner.username, email: owner.email, firstName: owner.firstName, lastName: owner.lastName }),
        JSON.stringify({ username, ...(email ? { email } : {}), firstName, lastName, sessionsRevoked: true, source: 'offline-owner-credential-recovery' }),
      ],
    );
    return ownerId;
  });
}

if (require.main === module) {
  const currentEmail = option('--current-email');
  const username = option('--username');
  const emailArg = process.argv.indexOf('--email');
  const email = emailArg >= 0 ? process.argv[emailArg + 1]?.trim() : undefined;
  const firstName = option('--first-name');
  const lastName = option('--last-name');
  const db = new DataSource({
    type: 'postgres',
    ...(process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    }),
    entities: [],
    migrations: [],
    synchronize: false,
  });
  const tenant = new TenantContext();
  installTenantDatabase(db, tenant);
  readPassword()
    .then(password => db.initialize().then(() => tenant.runWithDatabaseAccess(
      GLOBAL_USER_ACCESS,
      () => recoverPlatformOwnerCredentials(db, { currentEmail, username, email, firstName, lastName, password }),
    )))
    .then(id => console.log(`Platform owner credentials updated. Account ID: ${id}`))
    .catch(error => { console.error(error instanceof Error ? error.message : 'Owner credential recovery failed.'); process.exitCode = 1; })
    .finally(() => db.isInitialized && db.destroy());
}
