const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = [
  {
    file: 'apps/web-staff/src/app/(staff)/today/page.tsx',
    dataHook: "apiFetch<MyDayResponse>('/my-day')",
  },
  {
    file: 'apps/web-admin/src/app/(admin)/dashboard/page.tsx',
    dataHook: "apiFetch<Stats>('/admin/stats')",
  },
  {
    file: 'apps/web-developer/src/app/(developer)/overview/page.tsx',
    dataHook: 'getHealth()',
  },
];

const styles = [
  'apps/web-staff/src/app/globals.css',
  'apps/web-admin/src/app/globals.css',
  'apps/web-developer/src/app/globals.css',
];

for (const page of pages) {
  const source = fs.readFileSync(path.join(root, page.file), 'utf8');
  assert.ok(source.includes(page.dataHook), `${page.file}: existing data hook must remain`);
}

for (const file of styles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /workspace-hero/, `${file}: must define the hero visual primitive`);
  assert.match(source, /metric-rail/, `${file}: must define the metric rail primitive`);
  assert.match(source, /:has\(> h1\)/, `${file}: page titles must adopt the workspace hero treatment`);
}

console.log('Role workspace overview checks passed.');
