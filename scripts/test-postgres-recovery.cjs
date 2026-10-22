const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { MAGIC, config, destination, assertRestoreTarget, decrypt, dumpEncrypted } = require('./postgres-recovery.cjs');
const { checkHealth, nextState, monitor } = require('./monitor-health.cjs');

test('offsite destination rejects local, aliased and unacknowledged storage', () => {
  const env = { BACKUP_DESTINATION: 'archive:napare', BACKUP_OFFSITE_ACK: 'destination-is-on-another-machine', PGHOST: 'database.internal' };
  assert.equal(destination(env, { archive: { type: 's3' } }), 'archive:napare');
  for (const remote of [{ type: 'local' }, { type: 'alias' }, { type: 'sftp', host: '127.0.0.1' }, { type: 's3', endpoint: 'http://localhost:9000' }, { type: 'sftp', host: 'database.internal' }]) {
    assert.throws(() => destination(env, { archive: remote }));
  }
  assert.throws(() => destination({ ...env, BACKUP_DESTINATION: 'C:\\backups' }, {}));
  assert.throws(() => destination({ ...env, BACKUP_OFFSITE_ACK: '' }, { archive: { type: 's3' } }));
});

test('production-like restore targets are rejected before SQL is executed', () => {
  const env = { PGHOST: '127.0.0.1', PGDATABASE: 'napare_restore_drill', PGUSER: 'napare_restore_drill', RESTORE_CONFIRM: 'isolated-empty-test-database' };
  assert.doesNotThrow(() => assertRestoreTarget(env));
  for (const patch of [{ PGHOST: 'db.production' }, { PGDATABASE: 'napare' }, { PGUSER: 'postgres' }, { NODE_ENV: 'production' }, { RESTORE_CONFIRM: '' }]) assert.throws(() => assertRestoreTarget({ ...env, ...patch }));
});

test('connection overrides cannot bypass explicit PostgreSQL host settings', () => {
  const env = { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'napare_restore_drill', PGUSER: 'napare_restore_drill', PGPASSFILE: '/private/pgpass' };
  for (const patch of [{ PGHOSTADDR: '203.0.113.1' }, { PGSERVICE: 'production' }, { PGPASSWORD: 'synthetic' }]) assert.throws(() => config({ ...env, ...patch }), /explicit PG settings/);
});

test('failed pg_dump removes its incomplete encrypted artifact', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'napare-failed-dump-'));
  try {
    const artifact = path.join(dir, 'failed.enc');
    await assert.rejects(dumpEncrypted(artifact, { key: crypto.randomBytes(32), env: { ...process.env, PG_BIN_DIR: path.join(dir, 'missing-bin') } }), /could not start/);
    await assert.rejects(fs.access(artifact), { code: 'ENOENT' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('encrypted archive is authenticated and a tampered backup is rejected', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'napare-crypto-test-'));
  try {
    const key = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(MAGIC);
    const encrypted = Buffer.concat([MAGIC, nonce, cipher.update('PGDMP synthetic fixture'), cipher.final(), cipher.getAuthTag()]);
    const source = path.join(dir, 'source.enc');
    const target = path.join(dir, 'restored.dump');
    await fs.writeFile(source, encrypted);
    await decrypt(source, target, key);
    assert.equal(await fs.readFile(target, 'utf8'), 'PGDMP synthetic fixture');
    encrypted[22] ^= 1;
    await fs.writeFile(source, encrypted);
    await assert.rejects(decrypt(source, path.join(dir, 'tampered.dump'), key));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('health checks reject process-only responses and accept transformed dependency health', async () => {
  assert.equal(await checkHealth('http://localhost/api/v1/health', async () => ({ ok: true, json: async () => ({ status: 'ok' }) })), false);
  assert.equal(await checkHealth('https://example.invalid/api/v1/health', async () => ({ ok: true, json: async () => ({ data: { status: 'ok', database: 'ok', queue: 'not_configured' } }) })), true);
  assert.equal(await checkHealth('https://example.invalid/api/v1/health', async () => { throw Error('timeout'); }), false);
});

test('health alerts require three failures, deduplicate and report recovery', () => {
  let state = { failures: 0, alerted: false };
  for (let i = 0; i < 2; i++) { state = nextState(state, false); assert.equal(state.event, null); }
  state = nextState(state, false);
  assert.equal(state.event, 'unhealthy');
  state = nextState(state, false);
  assert.equal(state.event, null);
  state = nextState(state, true);
  assert.equal(state.event, 'recovered');
});

test('monitor dry run never sends an alert or consumes its delivery state', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'napare-monitor-test-'));
  try {
    const stateFile = path.join(dir, 'state.json');
    await fs.writeFile(stateFile, JSON.stringify({ failures: 2, alerted: false }));
    let requests = 0;
    const result = await monitor({ HEALTH_URL: 'http://localhost/api/v1/health', HEALTH_STATE_FILE: stateFile }, async () => { requests++; return { ok: false }; });
    assert.equal(result.event, 'unhealthy');
    assert.equal(requests, 1);
    assert.equal(JSON.parse(await fs.readFile(stateFile, 'utf8')).alerted, false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('checked-in service templates point to existing scripts and private configuration examples', async () => {
  const root = path.resolve(__dirname, '..');
  const operations = path.join(root, 'deploy', 'operations');
  for (const name of ['backup', 'health', 'restore-drill']) {
    const service = await fs.readFile(path.join(operations, `napare-${name}.service`), 'utf8');
    const timer = await fs.readFile(path.join(operations, `napare-${name}.timer`), 'utf8');
    const script = /ExecStart=\/usr\/bin\/node \/srv\/NaPare\/([^\s]+)/.exec(service)[1];
    await fs.access(path.join(root, script));
    assert.match(service, /UMask=0077/);
    assert.match(service, /EnvironmentFile=\/etc\/napare\//);
    assert.match(timer, new RegExp(`Unit=napare-${name}\\.service`));
  }
  const example = await fs.readFile(path.join(operations, 'backup.environment.example'), 'utf8');
  assert.match(example, /BACKUP_DESTINATION=archive:napare\/daily/);
  assert.match(example, /BACKUP_OFFSITE_ACK=destination-is-on-another-machine/);
});
