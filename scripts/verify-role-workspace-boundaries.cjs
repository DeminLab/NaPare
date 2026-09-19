const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const protectedPath = /^(?:apps\/web-student\/|apps\/[^/]+\/src\/components\/navigation\/|apps\/[^/]+\/src\/components\/ui\/Avatar\.tsx$)|(?:^|\/)[^/]*logo[^/]*(?:\/|$)/i;

function assertAllowed(paths) {
  const allowedMigrationPath = 'apps/web-student/next.config.js';
  const blocked = paths.filter((path) => {
    const normalizedPath = path.replace(/\\/g, '/');
    return normalizedPath !== allowedMigrationPath && protectedPath.test(normalizedPath);
  });
  if (blocked.length) {
    throw new Error(`Role workspace foundation changes include protected paths:\n${blocked.map((path) => `- ${path}`).join('\n')}`);
  }
}

function changedPaths() {
  const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => line.slice(3).split(' -> ').map((path) => path.trim()))
    .filter(Boolean);
}

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
  assertAllowed([
    'apps/web-staff/src/app/globals.css',
    'apps/web-admin/src/components/ui/Card.tsx',
  ]);

  for (const path of [
    'apps/web-student/src/app/page.tsx',
    'apps/web-staff/src/components/navigation/Sidebar.tsx',
    'apps/web-admin/src/components/ui/Avatar.tsx',
    'apps/web-developer/public/logo.svg',
    'apps/web-staff/public/logomark.svg',
  ]) {
    let rejected = false;
    try {
      assertAllowed([path]);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Static guard did not reject protected path: ${path}`);
  }

  assertAllowed(changedPaths());
  assertRequestStateRetryHitArea();
  assertDeveloperSemanticAliases();
  console.log('role workspace boundary guard: passed');
}

run();
