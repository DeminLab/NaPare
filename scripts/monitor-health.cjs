const fs = require('node:fs/promises');
const path = require('node:path');

async function checkHealth(url, fetcher = fetch) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) throw new Error('Health URL must use HTTPS or loopback HTTP');
  if (parsed.username || parsed.password) throw new Error('Health URL must not contain credentials');
  try {
    const response = await fetcher(parsed, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return false;
    const payload = await response.json();
    const data = payload.data || payload;
    return data.status === 'ok' && data.database === 'ok' && ['ok', 'not_configured'].includes(data.queue);
  } catch { return false; }
}

function nextState(previous, healthy, threshold = 3) {
  const failures = healthy ? 0 : previous.failures + 1;
  const event = healthy && previous.alerted ? 'recovered' : failures >= threshold && !previous.alerted ? 'unhealthy' : null;
  return { failures, alerted: healthy ? false : previous.alerted || event === 'unhealthy', event };
}

async function monitor(env = process.env, fetcher = fetch) {
  if (!env.HEALTH_URL || !env.HEALTH_STATE_FILE) throw new Error('HEALTH_URL and HEALTH_STATE_FILE required');
  const file = path.resolve(env.HEALTH_STATE_FILE);
  let previous = { failures: 0, alerted: false };
  try {
    previous = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Number.isSafeInteger(previous.failures) || previous.failures < 0 || typeof previous.alerted !== 'boolean') throw new Error('Invalid health state');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const healthy = await checkHealth(env.HEALTH_URL, fetcher);
  const state = nextState(previous, healthy);
  const enabled = env.MONITOR_SEND_ALERTS === 'true';
  if (state.event && enabled) {
    const webhook = new URL(env.ALERT_WEBHOOK_URL || '');
    if (webhook.protocol !== 'https:') throw new Error('HTTPS ALERT_WEBHOOK_URL required');
    const response = await fetcher(webhook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service: 'napare-api', event: state.event }) });
    if (!response.ok) throw new Error('Alert delivery failed');
  }
  // A dry run must not suppress the first real alert on subsequent execution.
  if (!enabled && state.event) state.alerted = previous.alerted;
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state), { mode: 0o600 });
  await fs.rename(temp, file);
  return { healthy, failures: state.failures, event: state.event, alertsEnabled: enabled };
}

if (require.main === module) monitor().then(result => {
  console.log(JSON.stringify(result));
  if (!result.healthy) process.exitCode = 1;
}).catch(() => { console.error('Health monitor failed; inspect private configuration and state.'); process.exitCode = 1; });

module.exports = { checkHealth, nextState, monitor };
