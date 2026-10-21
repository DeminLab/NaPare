const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'apps/backend/src');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : [filename];
  });
}
function decorators(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}
function callDecorator(node, name) {
  return decorators(node).map(item => item.expression).find(expression =>
    ts.isCallExpression(expression) && expression.expression.getText() === name);
}
function stringArgument(call) {
  const argument = call?.arguments[0];
  return argument && ts.isStringLiteral(argument) ? argument.text : '';
}
function lineOf(node, source) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}
function inventory() {
  const routes = [];
  for (const filename of files(sourceRoot).filter(file => file.endsWith('.controller.ts'))) {
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const controller of source.statements.filter(ts.isClassDeclaration)) {
      const prefix = stringArgument(callDecorator(controller, 'Controller'));
      for (const handler of controller.members.filter(ts.isMethodDeclaration)) {
        for (const verb of ['Get', 'Post', 'Patch', 'Put', 'Delete', 'Sse', 'Head', 'Options', 'All']) {
          const decorator = callDecorator(handler, verb);
          if (!decorator) continue;
          const calls = [];
          function visit(node) {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
              const text = node.expression.getText(source);
              if (text.startsWith('this.')) calls.push({ call: text, args: node.arguments.map(arg => arg.getText(source)) });
            }
            ts.forEachChild(node, visit);
          }
          if (handler.body) visit(handler.body);
          const body = handler.body?.getText(source) || '';
          routes.push({
            method: verb === 'Sse' ? 'GET/SSE' : verb.toUpperCase(),
            path: '/api/v1/' + [prefix, stringArgument(decorator)].filter(Boolean).join('/'),
            file: path.relative(root, filename).replaceAll('\\', '/'),
            controller: controller.name.text, handler: handler.name.getText(source),
            line: lineOf(handler, source), calls,
            scopeEvidence: [...new Set(body.match(/(?:req|request)\.user(?:\.[a-zA-Z]+)?|(?:dto|query|body)\.universityId|universityId/g) || [])],
            guards: [callDecorator(controller, 'UseGuards'), callDecorator(handler, 'UseGuards')]
              .filter(Boolean).flatMap(call => call.arguments.map(arg => arg.getText(source))),
          });
        }
      }
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
function tenantRule(route) {
  if (route.controller.startsWith('Platform') && route.controller !== 'PlatformPublicController') {
    return 'Persisted platform permission; universityIds NULL/global, []/none, UUID list; service checks resource university';
  }
  if (route.controller.startsWith('Career')) return 'Career self/company membership, university partnership/admission; universityId input checked in CareerService';
  if (route.controller === 'SuperadminController') return 'SUPERADMIN plus platform owner check for university/connector mutations';
  if (['AppController', 'HealthController', 'PlatformPublicController'].includes(route.controller)) return 'Public technical response; no personal academic data';
  if (route.controller === 'TelegramWebhookController') return 'Webhook secret; verified challenge identifies account';
  if (route.controller === 'AuthController') return route.guards.includes('JwtAuthGuard')
    ? 'Verified JWT identity; self-only account operation'
    : 'Public/authentication boundary; credential/initData/refresh verification or public SIBIT catalog';
  if (route.controller === 'UsersController' || route.controller === 'DevicesController' || route.controller === 'NotificationsController' || route.controller === 'FavoritesController') {
    return 'JWT user.id (self), universityId from verified actor; resource owner check in service';
  }
  if (route.controller === 'CurationController' || route.controller === 'CuratorController') return 'TenantContext actor; active curator assignment + own university, dean/admin manage scope';
  return route.scopeEvidence.some(item => item.includes('.user'))
    ? 'Verified JWT actor university; service university filter + linked resource ownership'
    : 'Resource ID resolved in service; TenantContext.assertAccess / linked resource ownership (ID is not university ID)';
}
function renderInventory(routes) {
  return [
    '<!-- tenant-routes:start -->',
    `Снимок исходников: ${routes.length} объявлений маршрутов в ${new Set(routes.map(route => route.file)).size} controller-файлах. Таблица показывает путь передачи scope и точку входа сервиса; она не заменяет выполнение запроса с реальной БД.`,
    '',
    '| Маршрут | Источник scope и проверка | Обработчик / вызов сервиса |',
    '| --- | --- | --- |',
    ...routes.map(route => {
      const calls = [...new Set(route.calls.map(call => call.call.replace(/^this\./, '')))].join(', ') || 'controller-local';
      return `| \`${route.method} ${route.path}\` | ${tenantRule(route)} | [${route.controller}.${route.handler}](../../${route.file}) → \`${calls}\` |`;
    }),
    '<!-- tenant-routes:end -->',
  ].join('\n');
}
if (require.main === module) {
  const routes = inventory();
  if (process.argv.includes('--write') || process.argv.includes('--check')) {
    const filename = path.join(root, 'docs/security/tenant-isolation.md');
    const source = fs.readFileSync(filename, 'utf8');
    const updated = source.replace(/<!-- tenant-routes:start -->[\s\S]*?<!-- tenant-routes:end -->/, renderInventory(routes));
    if (updated === source && !source.includes('<!-- tenant-routes:start -->')) throw new Error('Tenant inventory markers missing');
    if (process.argv.includes('--check')) {
      if (source !== updated) throw new Error('Tenant route inventory is stale; run node scripts/security-route-inventory.cjs --write');
      console.log(`Tenant route inventory is current (${routes.length} routes).`);
    } else fs.writeFileSync(filename, updated);
  } else process.stdout.write(JSON.stringify(routes, null, 2) + '\n');
}
module.exports = { inventory };
