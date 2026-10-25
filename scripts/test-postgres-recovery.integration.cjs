const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { config, dumpEncrypted, restore } = require('./postgres-recovery.cjs');

test('real isolated PostgreSQL dump, authenticated restore, FORCE RLS and repeat refusal', {
  skip: process.env.RECOVERY_DRILL_ENABLE !== 'true',
}, async () => {
  // The operator supplies a disposable cluster and the two pre-created databases.
  // Never seed arbitrary environment-provided database names or a non-loopback host.
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGDATABASE, 'napare_backup_fixture');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'napare-drill-test-'));
  const bin = process.env.PG_BIN_DIR || '';
  const psql = path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql');
  const key = path.join(temp, 'backup.key');
  const pass = path.join(temp, 'pgpass');
  const archive = path.join(temp, 'fixture.dump.enc');
  try {
    await fs.writeFile(key, crypto.randomBytes(32), { mode: 0o600 });
    await fs.writeFile(pass, '', { mode: 0o600 });
    const source = { ...process.env, BACKUP_KEY_FILE: key, PGPASSFILE: pass };
    const query = (env, sql) => execFileSync(psql, ['-X', '-w', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    query(source, "CREATE TABLE recovery_fixture(id integer PRIMARY KEY, university_id uuid NOT NULL); INSERT INTO recovery_fixture VALUES(1,'11111111-1111-4111-8111-111111111111'),(2,'22222222-2222-4222-8222-222222222222'); ALTER TABLE recovery_fixture ENABLE ROW LEVEL SECURITY; ALTER TABLE recovery_fixture FORCE ROW LEVEL SECURITY; CREATE POLICY tenant ON recovery_fixture USING (university_id::text = current_setting('app.university_id',true))");
    await dumpEncrypted(archive, config(source));
    assert.notEqual((await fs.readFile(archive)).subarray(0, 5).toString(), 'PGDMP');
    const target = { ...source, PGDATABASE: 'napare_restore_drill', PGUSER: 'napare_restore_drill', RESTORE_CONFIRM: 'isolated-empty-test-database', RESTORE_BACKUP_FILE: archive };
    const result = await restore(target);
    assert.equal(result.status, 'ok');
    assert.equal(query(target, 'SELECT count(*) FROM recovery_fixture'), '2');
    assert.equal(query(target, "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname='recovery_fixture'"), 't');
    await assert.rejects(restore(target), /target must be empty/);
    await assert.rejects(restore({ ...target, PGDATABASE: 'postgres' }), /napare_restore_/);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
