import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const handler = fileURLToPath(new URL('./ecc-session-start.mjs', import.meta.url));
const eccDirectory = fileURLToPath(new URL('../../docs/ecc/', import.meta.url));
const event = { hook_event_name: 'SessionStart', source: 'startup', cwd: eccDirectory };

function invoke(payload, script = handler) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  return result.stdout;
}

test('startup and resume return the same bounded reminder', () => {
  const startup = invoke(event);
  assert.equal(startup, invoke({ ...event, source: 'resume' }));
  assert.equal(startup, invoke(event));
  const output = JSON.parse(startup).hookSpecificOutput;
  assert.equal(output.hookEventName, 'SessionStart');
  for (const file of ['REQUIREMENTS.md', 'PLAN.md', 'PROGRESS.md']) {
    assert.ok(output.additionalContext.includes(`docs/ecc/${file}`));
  }
  assert.ok(startup.length < 512);
});

test('malformed or oversized input, unsupported events and other directories are silent', () => {
  const rejected = [
    '',
    '{',
    'null',
    'x'.repeat(70 * 1024),
    { ...event, hook_event_name: 'PreToolUse' },
    { ...event, source: 'compact' },
    { ...event, cwd: '.' },
    { ...event, cwd: tmpdir() },
  ];
  for (const payload of rejected) assert.equal(invoke(payload), '');
});

test('missing checkpoint is silent and contents are omitted when it exists', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'napare-ecc-hook-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const copiedHandler = join(fixture, 'scripts', 'ai-devkit', 'ecc-session-start.mjs');
  mkdirSync(join(fixture, 'scripts', 'ai-devkit'), { recursive: true });
  copyFileSync(handler, copiedHandler);
  const cwd = join(fixture, 'docs', 'ecc');
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, 'REQUIREMENTS.md'), 'synthetic-requirements');
  writeFileSync(join(cwd, 'PLAN.md'), 'synthetic-plan');
  assert.equal(invoke({ ...event, cwd }, copiedHandler), '');
  writeFileSync(join(cwd, 'PROGRESS.md'), 'synthetic-progress');
  assert.equal(invoke({ ...event, cwd }, copiedHandler), invoke(event));
});
