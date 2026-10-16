import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

/** Offline one-time binding; never auto-claims a future registration by email. */
export async function bindPlatformOwner(db: DataSource, email: string) {
  if (!email || !email.includes('@')) throw new Error('Pass the existing owner account email');
  return db.transaction(async manager => {
    await manager.query('SELECT pg_advisory_xact_lock(707247125)');
    const existing = await manager.query('SELECT "ownerId" FROM platform_control WHERE id = $1', ['platform']);
    if (existing.length) throw new Error('An owner is already bound. Ownership cannot be replaced by this command.');
    const users = await manager.query('SELECT id, role, "isActive" FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (users.length !== 1 || !users[0].isActive || !['developer', 'superadmin'].includes(users[0].role)) throw new Error('Expected one existing active developer/superadmin account; no account was created or promoted.');
    await manager.query('INSERT INTO platform_control (id, "ownerId") VALUES ($1, $2)', ['platform', users[0].id]);
    await manager.query('INSERT INTO audit_logs ("userId", action, entity, "entityId", "newValues") VALUES ($1, $2, $3, $4, $5)', [users[0].id, 'platform.owner.bound', 'platform', users[0].id, JSON.stringify({ source: 'offline-owner-bootstrap' })]);
    return users[0].id as string;
  });
}
if (require.main === module) {
  const email = process.argv[process.argv.indexOf('--email') + 1];
  if (!process.argv.includes('--email')) throw new Error('Usage: bootstrap-owner --email existing-owner@example.org');
  const db = new DataSource({ type: 'postgres', ...(process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME }), entities: [], migrations: [join(__dirname, '../migrations/*.{js,ts}')], synchronize: false });
  db.initialize().then(() => bindPlatformOwner(db, email)).then(() => console.log('Existing account bound as the single platform owner.')).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.isInitialized && db.destroy());
}
