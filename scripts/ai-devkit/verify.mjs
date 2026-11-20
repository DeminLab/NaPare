#!/usr/bin/env node
// Offline structure checks. This does not establish Codex discovery or MCP runtime health.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(new URL('./runtime/package.json', import.meta.url));
const { parse } = require('smol-toml');
const errors = [];
const warnings = [];
const fail = message => errors.push(message);
const exists = relative => fs.existsSync(path.join(root, relative));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
function toml(relative) {
  try { return parse(read(relative)); } catch { fail(`Invalid or missing TOML: ${relative}`); return {}; }
}
function walk(relative) {
  if (!exists(relative)) return [];
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', '.cache', '__pycache__'].includes(entry.name)) return [];
    const child = `${relative}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : entry.isFile() ? [child] : [];
  });
}

function checkLocalLinks(file, source) {
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const resolved = path.resolve(root, path.dirname(file), target);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) fail(`Link leaves repository: ${file}`);
    else if (!fs.existsSync(resolved)) fail(`Missing link in ${file}`);
  }
}

const config = toml('.codex/config.toml');
try {
  const marketplace = JSON.parse(read('.agents/plugins/marketplace.json'));
  const manifest = JSON.parse(read('.agents/plugins/ecc/.codex-plugin/plugin.json'));
  const pin = JSON.parse(read('scripts/ai-devkit/skill-adapters/ecc/sources.json'));
  const entry = marketplace.plugins.find(plugin => plugin.name === 'ecc');
  if (marketplace.name !== 'napare-local' || entry?.source?.source !== 'local' ||
      entry?.source?.path !== './.agents/plugins/ecc' ||
      manifest.name !== 'ecc' || manifest.version !== pin.version ||
      config.plugins?.['ecc@napare-local']?.enabled !== true ||
      !exists('.agents/skills/ecc-catalog/SKILL.md')) {
    fail('ECC project marketplace does not match the pinned project definition');
  }
  if ('hooks' in manifest || 'mcpServers' in manifest || 'skills' in manifest) {
    fail('ECC project plugin must use the existing DevKit services and native project Skills');
  }
} catch {
  fail('Invalid or missing ECC project marketplace or manifest');
}
for (const [name, server] of Object.entries(config.mcp_servers ?? {})) {
  if (!server.command && !server.url) fail(`MCP missing command/url: ${name}`);
  if (server.command && server.url) fail(`MCP has both command and url: ${name}`);
  if (server.url && !/^https:\/\//.test(server.url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(server.url)) fail(`MCP URL must be TLS or loopback: ${name}`);
  if (server.bearer_token) fail(`Literal MCP bearer_token: ${name}`);
}
const expectedAgents = ['chief-architect', 'senior-frontend', 'senior-backend', 'ui-ux-designer', 'database-engineer', 'security-engineer', 'qa-engineer', 'devops-engineer', 'performance-engineer', 'product-manager', 'code-reviewer', 'technical-writer'];
const names = new Set();
for (const name of expectedAgents) {
  const agent = toml(`.codex/agents/${name}.toml`);
  if (agent.name !== name || !agent.description || !agent.developer_instructions) fail(`Incomplete agent: ${name}`);
  if (names.has(agent.name)) fail(`Duplicate agent name: ${name}`);
  names.add(agent.name);
  for (const key of ['model', 'model_reasoning_effort', 'sandbox_mode', 'approval_policy', 'mcp_servers']) {
    if (key in agent) fail(`Agent must inherit ${key}: ${name}`);
  }
}

const expectedSkills = ['architect', 'frontend', 'backend', 'design-system', 'ui-ux', 'security', 'database', 'qa', 'devops', 'performance', 'analytics', 'product-manager', 'code-review', 'release', '1c-integration', 'accessibility', 'documentation', 'mobile', 'social', 'observability'].map(name => `napare-${name}`);
const skillFiles = walk('.agents/skills').filter(file => file.endsWith('/SKILL.md'));
const skills = new Map();
for (const file of skillFiles) {
  const source = read(file);
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
  const name = front?.match(/^name:\s*["']?([^\r\n"']+)["']?\s*$/m)?.[1]?.trim();
  if (!name || !/^description:\s*\S/m.test(front ?? '')) { fail(`Skill metadata missing: ${file}`); continue; }
  if (skills.has(name)) fail(`Duplicate skill name: ${name} (${skills.get(name)}, ${file})`);
  skills.set(name, file);
  if (!expectedSkills.includes(name)) continue;
  if (source.length < 1400) fail(`Project skill lacks detail: ${file}`);
  checkLocalLinks(file, source);
}
for (const name of expectedSkills) if (!skills.has(name)) fail(`Missing project skill: ${name}`);

const eccDocs = ['REQUIREMENTS', 'PLAN', 'PROGRESS', 'DECISIONS', 'VERIFICATION'];
for (const name of eccDocs) {
  const file = `docs/ecc/${name}.md`;
  if (!exists(file)) {
    fail(`Missing ECC document: ${file}`);
    continue;
  }
  const source = read(file);
  if (!/^# \S/m.test(source)) fail(`Missing ECC document title: ${file}`);
  checkLocalLinks(file, source);
}

const eccHookPath = 'docs/ecc/.codex/hooks.json';
try {
  const { hooks } = JSON.parse(read(eccHookPath));
  const expected = {
    SessionStart: [{
      matcher: '^(startup|resume)$',
      hooks: [{ type: 'command', command: 'node ../../scripts/ai-devkit/ecc-session-start.mjs', timeout: 5 }],
    }],
  };
  if (!isDeepStrictEqual(hooks, expected) || !exists('scripts/ai-devkit/ecc-session-start.mjs')) {
    fail(`Unexpected ECC hook configuration: ${eccHookPath}`);
  }
} catch { fail(`Invalid or missing ECC hook JSON: ${eccHookPath}`); }

const manifestPath = 'docs/ai-devkit/vendor-skills.json';
const vendorFiles = [];
if (!exists(manifestPath)) fail(`Missing ${manifestPath}`);
else {
  try {
    const manifest = JSON.parse(read(manifestPath));
    // Accept the installer manifest schema without duplicating its implementation.
    const entries = Array.isArray(manifest) ? manifest : manifest.packages ?? [];
    if (!entries.length) fail('Vendor manifest has no sources');
    for (const entry of entries) {
      if (!/^https:\/\/github\.com\//.test(entry.source_url ?? '')) fail('Vendor source lacks official repository URL');
      if (!/^[0-9a-f]{40}$/.test(entry.revision ?? '')) fail('Vendor source lacks pinned commit');
      for (const skill of entry.skills ?? []) {
        if (skill.preserve_existing) {
          if (!exists(`.agents/skills/${skill.name}/SKILL.md`)) fail(`Missing preserved skill: ${skill.name}`);
          warnings.push(`Preserved existing skill; upstream hashes not asserted: ${skill.name}`);
          continue;
        }
        for (const file of skill.files ?? []) {
          const relative = `.agents/skills/${skill.name}/${file.destination}`;
          vendorFiles.push(relative);
          const absolute = path.resolve(root, relative);
          const skillRoot = path.resolve(root, '.agents/skills', skill.name) + path.sep;
          if (!absolute.startsWith(skillRoot)) { fail(`Vendor path escapes skill: ${skill.name}`); continue; }
          if (!exists(relative)) { fail(`Missing vendor file: ${relative}`); continue; }
          const hash = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
          if (hash !== file.sha256) fail(`Vendor hash mismatch: ${relative}`);
        }
      }
    }
  } catch { fail('Invalid vendor manifest JSON'); }
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bsk-(?:proj-|live-)[A-Za-z0-9_-]{24,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
let scanned = 0;
const candidates = new Set([...walk('.codex'), ...walk('scripts/ai-devkit'), ...walk('docs/ai-devkit'), ...walk('docs/ecc'), ...skillFiles, ...vendorFiles, 'AGENTS.md', 'CLAUDE.md']);
for (const file of candidates) {
  if (!exists(file) || !/\.(?:md|toml|json|mjs|cjs|js|yml|yaml|ps1|txt|py|sh|html|css)$/.test(file)) continue;
  const source = read(file); scanned++;
  if (file.endsWith('/verify.mjs')) continue;
  if (secretPatterns.some(pattern => pattern.test(source))) fail(`Possible secret in ${file}; content withheld`);
  if (file.startsWith('.codex/') && /(?:password|token|secret)\s*=\s*["'][^"']{8,}["']/i.test(source) && !file.includes('/agents/')) warnings.push(`Review credential-like configuration in ${file}; values withheld`);
}
console.log(JSON.stringify({ scope: 'offline-structure-only', projectSkills: expectedSkills.length, discoveredSkillMetadata: skills.size, agentContracts: expectedAgents.length, eccDocuments: eccDocs.length, scannedFiles: scanned, warnings, errors }, null, 2));
if (errors.length) process.exitCode = 1;
