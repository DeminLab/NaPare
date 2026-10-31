const { readFileSync } = require('node:fs');

// Role-workspace protected paths were removed by owner decision on 31 October 2026
// (see docs/ai/change-safety.md). Only the unrelated UI invariant checks below remain.

function assertRequestStateRetryHitArea() {
  for (const role of ['staff', 'admin', 'developer']) {
    const path = `apps/web-${role}/src/components/ui/RequestState.tsx`;
    const source = readFileSync(path, 'utf8');
    if (!/min-h-(?:11|\[44px\])/.test(source)) {
      throw new Error(`${path} retry button must keep a minimum 44px hit area.`);
    }
  }
}

function assertDeveloperSemanticAliases() {
  const path = 'apps/web-developer/src/app/globals.css';
  const source = readFileSync(path, 'utf8');
  for (const name of ['success', 'warning', 'danger']) {
    const expected = `var(--workspace-${name})`;
    const declarations = [...source.matchAll(new RegExp(`--color-${name}:\\s*([^;]+);`, 'g'))];
    const divergent = declarations
      .map((match) => match[1].trim())
      .filter((value) => value !== expected);
    if (divergent.length) {
      throw new Error(`${path} must keep --color-${name} aliased to ${expected}, found ${divergent.join(', ')}.`);
    }
  }
}

function run() {
  assertRequestStateRetryHitArea();
  assertDeveloperSemanticAliases();
  console.log('role workspace boundary guard: passed');
}

run();
