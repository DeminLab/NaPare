import { Client } from './runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from './runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { StreamableHTTPClientTransport } from './runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const report = [];
const fixture = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html lang="ru"><title>NaPare DevKit fixture</title><body><h1>DevKit synthetic fixture</h1><button type="button" onclick="this.textContent=\'Clicked\'">Check</button></body></html>');
});
await new Promise(r => fixture.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${fixture.address().port}`;

async function local(name, check) {
  const client = new Client({ name: 'napare-devkit-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [resolve(root, 'scripts/ai-devkit/mcp.mjs'), name], cwd: root, stderr: 'pipe' });
  // Never publish raw stderr: database URLs and remote diagnostics may contain secrets.
  transport.stderr?.on('data', () => {});
  const entry = { name, transport: 'stdio', status: 'error' };
  try {
    await client.connect(transport, { timeout: 45000 });
    const tools = (await client.listTools()).tools;
    entry.tools = tools.map(t => t.name);
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
      if (result.isError) throw new Error(`Tool failed: ${name}: ${JSON.stringify(result.content).slice(0, 1000)}`);
      return result;
    };
    entry.checks = await check(call, tools);
    entry.status = 'verified';
  } catch (error) { entry.error = String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"]+/g, '[redacted]'); }
  finally { await client.close().catch(() => {}); }
  report.push(entry);
  console.log(JSON.stringify(entry));
}
try {
  await local('context7', async call => {
    const result = await call('resolve-library-id', { libraryName: 'Next.js', query: 'Next.js 15 App Router documentation' });
    const text = JSON.stringify(result);
    if (/API key|rate limit|unauthorized|forbidden/i.test(text)) throw new Error('Context7 requires API key or free-tier quota refresh');
    if (!/nextjs|next\.js|vercel\/next/i.test(text)) throw new Error('Library response did not contain Next.js');
    return ['resolve-library-id returned Next.js documentation'];
  });
  await local('playwright', async call => {
    await call('browser_navigate', { url });
    const result = await call('browser_evaluate', { function: '() => { document.querySelector("button").click(); return document.querySelector("button").textContent; }' });
    if (!JSON.stringify(result).includes('Clicked')) throw new Error('Browser click did not update fixture');
    await call('browser_close', {});
    return ['isolated Chrome launched', 'loopback fixture navigation and button interaction passed'];
  });
  await local('chrome_devtools', async call => {
    const created = await call('new_page', { url });
    const text = created.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    const pageId = Number(text.match(/(?:^|\n)(\d+):[^\n]*selected/m)?.[1] ?? text.match(/(?:^|\n)(\d+):/m)?.[1]);
    if (!Number.isFinite(pageId)) throw new Error('Cannot identify fixture page ID');
    const result = await call('evaluate_script', { function: '() => document.title', pageId });
    if (!JSON.stringify(result).includes('NaPare DevKit fixture')) throw new Error('Unexpected page title');
    await call('list_network_requests', { pageId });
    await call('list_console_messages', { pageId });
    return ['isolated headless Chrome launched', 'fixture title, network and console tools passed'];
  });
  await local('dbhub', async call => {
    const result = await call('execute_sql', { sql: 'SELECT current_user, current_database(), label FROM public.devkit_fixture' });
    if (!JSON.stringify(result).includes('synthetic-only')) throw new Error('Synthetic database query not confirmed');
    const denied = await clientDenied(call);
    return ['synthetic PostgreSQL SELECT passed', denied];
  });
  report.push({ name: 'next_devtools', status: 'incompatible', checks: ['Next.js 16+ required; vulnerable unused 0.4.0 runtime removed after initial handshake probe'] });
  for (const [name, endpoint] of Object.entries({ github: 'https://api.githubcopilot.com/mcp/', figma: 'https://mcp.figma.com/mcp', sentry: 'https://mcp.sentry.dev/mcp' })) {
    const client = new Client({ name: 'napare-devkit-smoke', version: '1.0.0' });
    const token = name === 'github' ? process.env.GITHUB_PAT_TOKEN : undefined;
    if (name === 'github' && !token) {
      report.push({ name, status: 'requires_authorization', checks: ['GITHUB_PAT_TOKEN absent; authenticated smoke requires a user-provided read-only token'] });
      continue;
    }
    try {
      const transport = new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(name === 'github' ? { 'X-MCP-Readonly': 'true' } : {}) } } });
      await client.connect(transport, { timeout: 20000 });
      const tools = (await client.listTools()).tools;
      report.push({ name, status: 'verified', checks: ['initialize and tools/list only'], tools: tools.map(t => t.name) });
    } catch (error) {
      const auth = [401, 403].includes(error.code) || /401|403|unauthorized|authentication/i.test(String(error.message));
      report.push({ name, status: auth ? 'requires_authorization' : 'error', checks: [auth ? 'server requires authentication' : 'handshake failed; connectivity or server error'], diagnostic: auth ? undefined : String(error.message).slice(0, 180) });
    }
    finally { await client.close().catch(() => {}); }
  }
} finally {
  fixture.close();
  mkdirSync(resolve(root, '.cache/ai-devkit'), { recursive: true });
  writeFileSync(resolve(root, '.cache/ai-devkit/mcp-smoke.json'), JSON.stringify({ date: new Date().toISOString(), report }, null, 2));
  console.log(JSON.stringify(report.map(({ name, status }) => ({ name, status }))));
  // Remote accounts are optional pending user login; local runtime failures fail setup.
  if (report.some(entry => entry.transport === 'stdio' && entry.status === 'error')) process.exitCode = 1;
}

async function clientDenied(call) {
  // No write is attempted: ACL introspection proves the database role's effective table rights.
  const result = await call('execute_sql', { sql: "SELECT CASE WHEN NOT has_table_privilege(current_user, 'public.devkit_fixture', 'INSERT') AND NOT has_table_privilege(current_user, 'public.devkit_fixture', 'UPDATE') AND NOT has_table_privilege(current_user, 'public.devkit_fixture', 'DELETE') AND current_setting('default_transaction_read_only') = 'on' THEN 'DEVKIT_READONLY_CONFIRMED' ELSE 'DEVKIT_READONLY_FAILED' END AS acl_check" });
  const payload = JSON.parse(result.content.find(item => item.type === 'text').text);
  if (!payload.success || payload.data?.statements?.[0]?.rows?.[0]?.acl_check !== 'DEVKIT_READONLY_CONFIRMED') throw new Error('Reader ACL check failed');
  return 'database ACLs deny INSERT/UPDATE/DELETE and default transaction is read-only';
}
