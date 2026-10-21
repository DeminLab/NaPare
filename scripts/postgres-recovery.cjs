const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

const MAGIC = Buffer.from('NAPARE01');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function required(env, name) {
  if (!env[name] || !env[name].trim()) throw new Error(`Required: ${name}`);
  return env[name].trim();
}

function config(env = process.env) {
  for (const name of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSFILE']) required(env, name);
  if (env.PGPASSWORD || env.PGSERVICE || env.PGHOSTADDR) throw new Error('Use explicit PG settings and PGPASSFILE, not PGPASSWORD/PGSERVICE/PGHOSTADDR');
  const keyPath = required(env, 'BACKUP_KEY_FILE');
  const key = fs.readFileSync(keyPath);
  if (key.length !== 32) throw new Error('BACKUP_KEY_FILE must contain exactly 32 random bytes');
  if (process.platform !== 'win32' && (fs.statSync(keyPath).mode & 0o077)) throw new Error('Key file permissions must be 0600');
  return { key, env: { ...env, PGCONNECT_TIMEOUT: '10', PGAPPNAME: 'napare-recovery' } };
}

function launch(executable, args, env) {
  return spawn(executable, args, { env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

function completion(child, label) {
  // Capture no tool output: database errors and rclone config may contain secrets.
  child.stderr.resume();
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error(`${label}: executable could not start`)));
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`${label}: command failed`)));
  });
}

async function command(executable, args, env) {
  const child = launch(executable, args, env);
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  await completion(child, executable);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function pgBin(env, name) {
  return env.PG_BIN_DIR ? path.join(env.PG_BIN_DIR, process.platform === 'win32' ? `${name}.exe` : name) : name;
}

async function sql(env, query) {
  return command(pgBin(env, 'psql'), ['-X', '--no-password', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1', '--command', query], env);
}

function destination(env, remotes) {
  const dest = required(env, 'BACKUP_DESTINATION');
  const match = /^([a-zA-Z0-9_-]{2,}):([^\r\n]+)$/.exec(dest);
  if (!match || /^[a-z]:[\\/]/i.test(dest)) throw new Error('BACKUP_DESTINATION must be a named rclone remote:path');
  if (required(env, 'BACKUP_OFFSITE_ACK') !== 'destination-is-on-another-machine') throw new Error('Off-server destination acknowledgement required');
  const remote = remotes[match[1]];
  if (!remote || !['sftp', 's3', 'b2', 'azureblob'].includes(remote.type)) throw new Error('Only direct sftp/s3/b2/azureblob off-server remotes are allowed');
  if (remote.type === 'sftp' && (!remote.host || LOCAL_HOSTS.has(remote.host.toLowerCase()) || remote.host === env.PGHOST || remote.host === os.hostname())) throw new Error('SFTP destination must be off-server');
  if (remote.type === 'sftp' && (!remote.known_hosts_file || !fs.existsSync(remote.known_hosts_file))) throw new Error('SFTP requires an existing known_hosts_file');
  if (env.RCLONE_NO_CHECK_CERTIFICATE === 'true') throw new Error('TLS certificate verification must remain enabled');
  if (remote.endpoint) {
    const endpoint = new URL(remote.endpoint);
    if (endpoint.protocol !== 'https:') throw new Error('Object endpoint requires HTTPS');
    const host = endpoint.hostname.replace(/^\[|\]$/g, '');
    if (LOCAL_HOSTS.has(host) || host === env.PGHOST || host === os.hostname()) throw new Error('Object endpoint must be off-server');
  }
  return dest.replace(/\/$/, '');
}

async function backup(env = process.env) {
  const cfg = config(env);
  env = cfg.env;
  const rclone = env.RCLONE_BIN || 'rclone';
  const remotes = JSON.parse(await command(rclone, ['config', 'dump'], env));
  const remote = destination(env, remotes);
  const directory = path.resolve(required(env, 'BACKUP_WORK_DIR'));
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32' && (fs.statSync(directory).mode & 0o077)) throw new Error('Work directory permissions must be 0700');
  const id = `napare-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  const file = path.join(directory, `${id}.dump.enc`);
  await dumpEncrypted(file, cfg);
  // Read the uploaded ciphertext back and compare bytes; independent of remote hash support.
  const remoteFile = `${remote}/${path.basename(file)}`;
  await command(rclone, ['copyto', file, remoteFile, '--immutable'], env);
  const childCheck = launch(rclone, ['cat', remoteFile], env);
  const digest = crypto.createHash('sha256');
  const checkEnded = completion(childCheck, 'rclone verification');
  await Promise.all([checkEnded, pipeline(childCheck.stdout, digest)]);
  const localDigest = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), localDigest);
  if (digest.digest('hex') !== localDigest.digest('hex')) throw new Error('Off-server backup verification failed');
  await fsp.rm(file);
  return { status: 'ok', artifact: path.basename(file), verifiedOffsite: true };
}

async function dumpEncrypted(file, cfg) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cfg.key, nonce);
  cipher.setAAD(MAGIC);
  await fsp.writeFile(file, Buffer.concat([MAGIC, nonce]), { mode: 0o600, flag: 'wx' });
  const child = launch(pgBin(cfg.env, 'pg_dump'), ['--no-password', '--format=custom', '--no-owner', '--no-acl'], cfg.env);
  const ended = completion(child, 'pg_dump');
  try {
    await Promise.all([ended, pipeline(child.stdout, cipher, fs.createWriteStream(file, { flags: 'a' }))]);
    await fsp.appendFile(file, cipher.getAuthTag());
  } catch (error) {
    child.kill();
    await ended.catch(() => {});
    await fsp.rm(file, { force: true });
    throw error;
  }
}

async function decrypt(file, target, key) {
  const size = (await fsp.stat(file)).size;
  if (size < 37) throw new Error('Invalid encrypted backup');
  const handle = await fsp.open(file, 'r');
  const header = Buffer.alloc(20);
  const tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally { await handle.close(); }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Unsupported backup format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8));
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  await pipeline(fs.createReadStream(file, { start: 20, end: size - 17 }), decipher,
    fs.createWriteStream(target, { mode: 0o600, flags: 'wx' }));
}

function assertRestoreTarget(env) {
  if (required(env, 'RESTORE_CONFIRM') !== 'isolated-empty-test-database') throw new Error('Restore acknowledgement required');
  if (!LOCAL_HOSTS.has(env.PGHOST.toLowerCase())) throw new Error('Restore must run on the isolated machine against its loopback PostgreSQL');
  if (!/^napare_restore_[a-z0-9_]+$/.test(env.PGDATABASE) || !/^napare_restore_[a-z0-9_]+$/.test(env.PGUSER)) throw new Error('Restore database and user must use napare_restore_ prefix');
  if (env.NODE_ENV === 'production') throw new Error('Restore is forbidden in production');
}

async function restore(env = process.env) {
  const cfg = config(env);
  env = cfg.env;
  assertRestoreTarget(env);
  const identity = JSON.parse(await sql(env, `SELECT json_build_object('database',current_database(),'user',current_user,'super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'marker',shobj_description(d.oid,'pg_database')) FROM pg_roles r CROSS JOIN pg_database d WHERE r.rolname=current_user AND d.datname=current_database()`));
  if (identity.database !== env.PGDATABASE || identity.user !== env.PGUSER || identity.super || identity.createdb || identity.createrole || identity.marker !== 'napare:isolated-restore') throw new Error('Restore database identity/permissions/marker rejected');
  const objects = await sql(env, "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_') + (SELECT count(*) FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_')");
  if (objects !== '0') throw new Error('Restore target must be empty; never clean an existing database');
  const file = path.resolve(required(env, 'RESTORE_BACKUP_FILE'));
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'napare-restore-'));
  await fsp.chmod(temp, 0o700);
  const dump = path.join(temp, 'verified.dump');
  try {
    await decrypt(file, dump, cfg.key); // Authenticate entire archive before executing any SQL.
    await command(pgBin(env, 'pg_restore'), ['--list', dump], env);
    await command(pgBin(env, 'pg_restore'), ['--no-password', '--dbname', env.PGDATABASE, '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', dump], env);
    const tableCount = await sql(env, "SELECT count(*) FROM pg_tables WHERE schemaname='public'");
    if (Number(tableCount) < 1) throw new Error('Restored archive has no public tables');
    return { status: 'ok', restoredTables: Number(tableCount), isolation: 'loopback-empty-marked-database' };
  } finally {
    await fsp.rm(temp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const operation = process.argv[2];
  if (!['backup', 'restore'].includes(operation)) {
    console.error('Usage: node scripts/postgres-recovery.cjs backup|restore');
    process.exitCode = 1;
  } else {
    (operation === 'backup' ? backup() : restore()).then(result => console.log(JSON.stringify(result))).catch(() => {
      // Errors are deliberately sanitized; never print external command stderr.
      console.error('Recovery operation failed; verify configuration, tool availability and isolated credentials using the runbook. No external command output is logged.');
      process.exitCode = 1;
    });
  }
}

module.exports = { MAGIC, config, destination, assertRestoreTarget, backup, restore, decrypt, dumpEncrypted };
