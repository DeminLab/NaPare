const fs = require('node:fs'), path = require('node:path');
const { inventory } = require('./security-route-inventory.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output');
const filename = path.resolve(root, process.env.BUSINESS_ROUTE_EVIDENCE_FILE || 'output/business-route-evidence.jsonl');
const relative = path.relative(output, filename);
if (relative.startsWith('..') || path.isAbsolute(relative) || !filename.endsWith('.jsonl')) throw new Error('Evidence input must be JSONL inside output');
const key = (method, route) => method + ' ' + route.replace(/\/+$/, '').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param');
const records = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); } catch { throw new Error(`Invalid evidence JSONL at line ${index + 1}`); }
}) : [];
if (process.argv.includes('--require-evidence') && !records.length) throw new Error('No real business HTTP evidence was collected');
const roles = new Set([...require('../apps/backend/test/fixtures/role-policy.json').roles, 'anonymous', 'other']);
for (const record of records) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).sort().join(',') !== 'caseId,method,path,role,scope,status,suite' || !['GET','POST','PUT','PATCH','DELETE'].includes(record.method)
    || typeof record.path !== 'string' || !/^\/api\/v1(?:\/[A-Za-z0-9_:/.*()-]*)?$/.test(record.path) || !Number.isInteger(record.status) || record.status < 100 || record.status > 599
    || !roles.has(record.role) || !['primary','secondary','other','none'].includes(record.scope) || !/^[a-z0-9.-]+\.e2e-spec\.ts$/i.test(record.suite) || !/^[a-f0-9]{16}$/.test(record.caseId)) throw new Error('Invalid metadata-only HTTP evidence schema');
}
const observed = new Map();
for (const record of records) {
  const id = key(record.method, record.path), group = observed.get(id) || [];
  group.push(record); observed.set(id, group);
}
const routes = inventory().map(route => {
  const hits = observed.get(key(route.method, route.path)) || [];
  return { method: route.method, path: route.path, controller: route.controller, handler: route.handler, source: route.file,
    requests: hits.length, statuses: [...new Set(hits.map(hit => hit.status))].sort((a,b) => a-b), roles: [...new Set(hits.map(hit => hit.role))].sort(), scopes: [...new Set(hits.map(hit => hit.scope))].sort(),
    cases: [...new Set(hits.map(hit => hit.suite + ':' + hit.caseId))].sort() };
});
const known = new Set(routes.map(route => key(route.method, route.path)));
const unknown = [...observed.keys()].filter(id => !known.has(id));
const summary = { declarations: routes.length, observedDeclarations: routes.filter(route => route.requests).length, unobservedDeclarations: routes.filter(route => !route.requests).length,
  requests: records.length, unknownTemplates: unknown.length, evidence: 'observations, not verified isolation coverage' };
const context = { commit: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || '') ? process.env.GITHUB_SHA : 'local-unpinned',
  run: /^\d+$/.test(process.env.GITHUB_RUN_ID || '') ? process.env.GITHUB_RUN_ID : null };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'business-route-evidence-report.json'), JSON.stringify({ context, summary, unknown, routes }, null, 2) + '\n');
const table = routes.map(route => `| ${route.method} ${route.path} | ${route.requests} | ${route.statuses.join(', ') || 'none'} | ${route.roles.join(', ') || 'none'} | ${route.cases.length} |`).join('\n');
fs.writeFileSync(path.join(output, 'business-route-evidence-report.md'), '# Observed business HTTP routes\n\n' +
  'Metadata from real test AppModules only; guard probes are excluded. Setup calls are included. Responses do not prove DTO/service execution, foreign-resource denial, matching A/B controls or unchanged database rows. Auth guards may reject before a handler. Missing observations can also mean a fixture is not instrumented. This is not a security verdict or production evidence.\n\n' +
  'Summary: ' + JSON.stringify(summary) + '\n\n| Declared route | Requests | Statuses | Roles | Cases |\n| --- | --- | --- | --- | --- |\n' + table + '\n');
console.log(JSON.stringify(summary));
