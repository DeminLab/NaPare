import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantContext } from '../common/tenant/tenant-context';
import { TenantDatabaseGrant } from '../common/tenant/tenant-database-access';
import { installTenantDatabase } from '../common/tenant/tenant-database';
import { normalizeUsername } from '../auth/username';

const BOOTSTRAP_LOCK = 707247125;
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

export async function createInitialPlatformOwner(
  db: DataSource,
  input: { username: string; email: string; firstName: string; lastName: string; password: string },
): Promise<string> {
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new Error('Pass a valid owner email.');
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) throw new Error('Owner name and surname are required (maximum 100 characters each).');
  if (input.password.length < 6 || Buffer.byteLength(input.password, 'utf8') > 72) throw new Error('Password must contain at least 6 characters and no more than 72 UTF-8 bytes.');

  const passwordHash = await bcrypt.hash(input.password, 12);
  return db.transaction(async manager => {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK]);
    const existingOwner = await manager.query('SELECT id FROM platform_control LIMIT 1');
    if (existingOwner.length) throw new Error('A platform owner is already configured; refusing to replace it.');

    const existingPlatformAccounts = await manager.query(
      `SELECT id FROM users WHERE role IN ('developer', 'superadmin') LIMIT 1`,
    );
    if (existingPlatformAccounts.length) {
      throw new Error('A developer/superadmin account already exists; bind that existing account with bootstrap-owner instead.');
    }

    const [user] = await manager.query(
      `INSERT INTO users (username, email, "passwordHash", "firstName", "lastName", role, "organizationId", "isActive")
       VALUES ($1, $2, $3, $4, $5, 'developer', NULL, true)
       RETURNING id`,
      [username, email, passwordHash, firstName, lastName],
    );
    await manager.query('INSERT INTO platform_control (id, "ownerId") VALUES ($1, $2)', ['platform', user.id]);
    await manager.query(
      `INSERT INTO audit_logs ("userId", action, entity, "entityId", "newValues")
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [user.id, 'platform.owner.created', 'platform', user.id, JSON.stringify({ source: 'offline-initial-owner-bootstrap', role: 'developer' })],
    );
    return user.id as string;
  });
}

if (require.main === module) {
  const username = option('--username');
  const email = option('--email');
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
    .then(password => db.initialize().then(() => tenant.runWithDatabaseAccess(GLOBAL_USER_ACCESS, () => createInitialPlatformOwner(db, { username, email, firstName, lastName, password }))))
    .then(id => console.log(`Initial platform owner created. Account ID: ${id}`))
    .catch(error => { console.error(error instanceof Error ? error.message : 'Initial owner bootstrap failed.'); process.exitCode = 1; })
    .finally(() => db.isInitialized && db.destroy());
}
