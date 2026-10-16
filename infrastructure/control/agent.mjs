import http from 'node:http';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const SERVICES = ['backend', 'web-portal', 'web-student', 'web-staff', 'web-admin', 'web-developer', 'nginx', 'postgres', 'redis'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LOG = 65536;
export function redact(text, secrets = []) {
  let result = String(text);
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length >= 6).sort((a,b) => b.length-a.length)) result = result.split(secret).join('[REDACTED]');
  return result.replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1[REDACTED]').replace(/((?:password|secret|token|api[_-]?key)\s*[=:]\s*)[^\s,;"}]+/gi, '$1[REDACTED]').replace(/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi, '$1[REDACTED]@');
}
export function runCommand(file, args, { cwd, onOutput = () => {}, timeoutMs = 1800000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', timedOut = false;
    const collect = chunk => { const text = chunk.toString(); output = (output + text).slice(-MAX_LOG); onOutput(text); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (timedOut || code !== 0) reject(new Error(timedOut ? 'Command timed out; verify service state before retrying' : `Command failed (${code}): ${output}`)); else resolve(output); });
  });
}
function parsePs(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const rows = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split('\n').map(line => JSON.parse(line));
  return rows.map(row => ({ id: row.Service, state: row.State || 'unknown', health: row.Health || '', image: row.Image || '' }));
}
export async function createAgent(options) {
  const { secret, repo, stateDir, project = 'napare', composeFiles = ['docker-compose.yml', 'docker-compose.control.yml'], run = runCommand, healthWaitMs = 300000 } = options;
  if (!secret || secret.length < 32) throw new Error('CONTROL_SECRET must contain at least 32 characters');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new Error('Invalid Compose project');
  const root = await fs.realpath(repo);
  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const state = await fs.realpath(stateDir);
  const compose = ['compose', '--project-directory', root, '-p', project];
  for (const file of composeFiles) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) throw new Error('Compose files must be inside the repository');
    compose.push('-f', absolute);
  }
  const secrets = [secret, ...Object.entries(process.env).filter(([key]) => /secret|token|password|private_key|dsn/i.test(key)).map(([, value]) => value)];
  // Compose substitution values can occur in build/container output. Never return them.
  try {
    const env = await fs.readFile(path.join(root, '.env'), 'utf8');
    for (const line of env.split(/\r?\n/)) { const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (match && /secret|token|password|private_key|dsn/i.test(match[1])) secrets.push(match[2].replace(/^['"]|['"]$/g, '')); }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const clean = text => redact(text, secrets).slice(-MAX_LOG);
  const jobs = new Map(), nonces = new Map();
  let processing = false, closing = false, persistenceError = '', writes = Promise.resolve();
  const save = job => {
    const snapshot = JSON.stringify(job);
    const task = writes.then(async () => {
      const temp = path.join(state, `${job.id}.${randomUUID()}.tmp`);
      await fs.writeFile(temp, snapshot, { mode: 0o600 });
      // Antivirus/file indexing can briefly lock the destination on Windows.
      for (let attempt = 0; ; attempt++) {
        try { await fs.rename(temp, path.join(state, `${job.id}.json`)); break; }
        catch (error) { if (!['EPERM','EBUSY','EACCES'].includes(error.code) || attempt >= 5) throw error; await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1))); }
      }
    });
    writes = task.catch(() => {}); return task;
  };
  for (const file of await fs.readdir(state)) {
    if (!UUID.test(file.replace(/\.json$/, '')) || !file.endsWith('.json')) continue;
    const job = JSON.parse(await fs.readFile(path.join(state, file), 'utf8'));
    if (job.status === 'running') { job.status = 'interrupted'; job.log = clean(job.log + '\nControl process restarted. Verify actual service state before retrying.'); await save(job); }
    jobs.set(job.id, job);
  }
  const docker = (args, onOutput) => run(options.dockerBinary || 'docker', [...compose, ...args], { cwd: root, onOutput });
  const ps = async () => parsePs(await docker(['ps', '--all', '--format', 'json']));
  const processQueue = async () => {
    if (processing || closing || persistenceError) return;
    const job = [...jobs.values()].find(item => item.status === 'queued');
    if (!job) return;
    processing = true; job.status = 'running'; job.startedAt = new Date().toISOString();
    const append = output => { job.log = clean((job.log || '') + output); };
    let timer;
    try {
      await save(job);
      timer = setInterval(() => { void save(job).catch(error => { persistenceError = clean(error.message); }); }, 1000);
      if (job.action === 'rebuild') { await docker(['build', '--', job.service], append); await docker(['up', '-d', '--no-deps', '--', job.service], append); }
      else await docker(['restart', '--', job.service], append);
      const deadline = Date.now() + healthWaitMs;
      while (true) {
        const rows = (await ps()).filter(row => row.id === job.service);
        if (rows.length && rows.every(row => row.state === 'running' && (!row.health || row.health === 'healthy'))) break;
        if (Date.now() >= deadline) throw new Error('Service did not become healthy within the time limit');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      job.status = 'succeeded';
    } catch (error) { job.status = 'failed'; append('\n' + error.message); }
    finally {
      clearInterval(timer); job.finishedAt = new Date().toISOString();
      try { await save(job); } catch (error) { persistenceError = clean(error.message); }
      processing = false; void processQueue().catch(error => { persistenceError = clean(error.message); });
    }
  };
  const verified = (req, body) => {
    const timestamp = req.headers['x-control-time'], nonce = req.headers['x-control-nonce'], signature = req.headers['x-control-signature'];
    if (typeof timestamp !== 'string' || typeof nonce !== 'string' || typeof signature !== 'string' || !UUID.test(nonce) || Math.abs(Date.now() - Number(timestamp)) > 60000 || !/^\d+$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
    for (const [key, time] of nonces) if (Date.now() - time > 60000) nonces.delete(key);
    if (nonces.has(nonce) || nonces.size > 10000) return false;
    const expected = createHmac('sha256', secret).update([timestamp, nonce, req.method, req.url, createHash('sha256').update(body).digest('hex')].join('\n')).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return false;
    nonces.set(nonce, Date.now()); return true;
  };
  const server = http.createServer(async (req, res) => {
    const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 16384) return send(413, { message: 'Body too large' }); }
      if (!verified(req, body)) return send(401, { message: 'Invalid control signature' });
      const url = req.url;
      if (req.method === 'GET' && url === '/services') {
        const services = await ps();
        let disk = null;
        try { const stats = await fs.statfs(root); disk = { total: stats.blocks * stats.bsize, free: stats.bavail * stats.bsize }; } catch {}
        return send(200, { services: SERVICES.map(id => services.find(row => row.id === id) || { id, state: 'not_created', health: '', image: '' }), host: { cpuCount: os.cpus().length, load: os.loadavg(), memoryTotal: os.totalmem(), memoryFree: os.freemem(), uptime: os.uptime(), disk } });
      }
      if (req.method === 'GET' && url === '/jobs') return send(200, [...jobs.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(({ log, ...job }) => job));
      if (req.method === 'GET' && url.startsWith('/jobs/')) { const job = jobs.get(url.slice(6)); return send(job ? 200 : 404, job || { message: 'Job not found' }); }
      if (req.method === 'GET' && url.startsWith('/logs/')) {
        const service = url.slice(6);
        if (!SERVICES.includes(service)) return send(400, { message: 'Unknown service' });
        return send(200, { service, text: clean(await docker(['logs', '--no-color', '--tail', '200', '--', service])) });
      }
      if (req.method === 'POST' && url === '/jobs') {
        if (persistenceError) return send(503, { message: 'Job storage unavailable; inspect the control agent before retrying' });
        const input = JSON.parse(body);
        if (!SERVICES.includes(input.service) || !['restart', 'rebuild'].includes(input.action) || input.confirm !== input.service || !UUID.test(input.idempotencyKey) || !UUID.test(input.actorId) || Object.keys(input).some(key => !['service','action','confirm','idempotencyKey','actorId'].includes(key))) return send(400, { message: 'Invalid operation' });
        if (input.action === 'rebuild' && ['postgres', 'redis', 'nginx'].includes(input.service)) return send(400, { message: 'Service has no build context' });
        const existing = jobs.get(input.idempotencyKey);
        if (existing) return existing.actorId === input.actorId && existing.service === input.service && existing.action === input.action ? send(200, existing) : send(409, { message: 'Idempotency key already used' });
        if ([...jobs.values()].filter(job => ['queued','running'].includes(job.status)).length >= 10) return send(409, { message: 'Operation queue is full' });
        const job = { id: input.idempotencyKey, actorId: input.actorId, service: input.service, action: input.action, status: 'queued', createdAt: new Date().toISOString(), log: '' };
        jobs.set(job.id, job);
        try { await save(job); } catch (error) { jobs.delete(job.id); throw error; }
        send(202, job); void processQueue().catch(() => {}); return;
      }
      send(404, { message: 'Unknown operation' });
    } catch (error) { send(503, { message: clean(error.message) }); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const close = async () => { closing = true; await new Promise(resolve => server.close(resolve)); await writes; };
  void processQueue().catch(() => {});
  return { server, close };
}
async function main() {
  const stateDir = process.env.CONTROL_STATE_DIR || '/var/lib/napare-control';
  const repo = process.env.CONTROL_REPO;
  if (!repo) throw new Error('CONTROL_REPO is required');
  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const lockPath = path.join(stateDir, 'agent.lock');
  try { const lock = await fs.open(lockPath, 'wx', 0o600); await lock.writeFile(String(process.pid)); await lock.close(); }
  catch (error) { if (error.code !== 'EEXIST') throw error; const pid = Number(await fs.readFile(lockPath, 'utf8')); if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid agent lock; inspect it manually'); try { process.kill(pid, 0); throw new Error('Control process is already running'); } catch (check) { if (check.code !== 'ESRCH') throw check; await fs.unlink(lockPath); return main(); } }
  const agent = await createAgent({ secret: process.env.CONTROL_SECRET, repo, stateDir, project: process.env.CONTROL_PROJECT || 'napare', composeFiles: (process.env.CONTROL_COMPOSE_FILES || 'docker-compose.yml,docker-compose.control.yml').split(',') });
  const socket = process.env.CONTROL_SOCKET || '/run/napare-control/agent.sock';
  if (process.platform !== 'win32') { await fs.mkdir(path.dirname(socket), { recursive: true, mode: 0o750 }); try { await fs.unlink(socket); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  await new Promise(resolve => agent.server.listen(socket, resolve));
  if (process.platform !== 'win32') await fs.chmod(socket, 0o660);
  const stop = async () => { await agent.close(); await fs.unlink(lockPath); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  console.log('NaPare control agent listening on a private socket');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
