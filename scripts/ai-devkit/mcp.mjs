import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parse } from './runtime/node_modules/smol-toml/dist/index.js';

// No downloads or install scripts at MCP startup. Resolve locked runtime bins.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dbhubConfig = resolve(root, '.cache/ai-devkit/dbhub.toml');
const specs = {
  context7: ['@upstash/context7-mcp', []],
  playwright: ['@playwright/mcp', ['--headless', '--isolated', '--browser', 'chrome']],
  chrome_devtools: ['chrome-devtools-mcp', ['--headless', '--isolated', '--no-usage-statistics', '--no-performance-crux']],
  dbhub: ['@bytebase/dbhub', ['--transport', 'stdio', '--config', dbhubConfig]],
  next_devtools: ['next-devtools-mcp', []],
};
const spec = specs[process.argv[2]];
if (!spec) throw new Error('Unknown DevKit MCP server');
if (process.argv[2] === 'next_devtools') throw new Error('Next DevTools is intentionally not installed: Next.js 16+ required; current NaPare uses 15.5.28. Review dependencies before enabling.');
if (process.argv[2] === 'dbhub') {
  if (!existsSync(dbhubConfig)) {
    throw new Error('Run py scripts/ai-devkit/test-database.py start to initialize the isolated synthetic database.');
  }
  if (!isSyntheticDbhubConfig(dbhubConfig)) {
    throw new Error('DBHub requires the isolated loopback fixture and read-only tools. Check the generated DevKit config.');
  }
}
const base = resolve(root, 'scripts/ai-devkit/runtime/node_modules', spec[0]);
const pkg = JSON.parse(readFileSync(resolve(base, 'package.json'), 'utf8'));
const bin = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0];
const child = spawn(process.execPath, [resolve(base, bin), ...spec[1]], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('MCP launch failed; run DevKit installer.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

function isSyntheticDbhubConfig(file) {
  try {
    const { sources, tools } = parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(sources) || sources.length !== 1 || !Array.isArray(tools) || tools.length !== 2) {
      return false;
    }

    const [source] = sources;
    if (typeof source.dsn !== 'string') return false;
    const dsn = new URL(source.dsn);
    const executeSql = tools.find(tool => tool.name === 'execute_sql');
    return source.id === 'napare_devkit_test'
      && dsn.protocol === 'postgres:'
      && dsn.hostname === '127.0.0.1'
      && dsn.port === '55439'
      && dsn.pathname === '/napare_devkit_test'
      && dsn.username === 'devkit_reader'
      && dsn.password !== ''
      && dsn.search === '?sslmode=disable'
      && dsn.hash === ''
      && tools.every(tool => tool.source === source.id)
      && executeSql?.readonly === true
      && tools.some(tool => tool.name === 'search_objects');
  } catch {
    // The source file contains credentials. Never include it or parser errors in diagnostics.
    return false;
  }
}
