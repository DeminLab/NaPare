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
const sourceCache = new Map();
function sourceInfo(filename) {
  if (sourceCache.has(filename)) return sourceCache.get(filename);
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = new Map();
  for (const statement of source.statements.filter(ts.isImportDeclaration)) {
    if (!statement.moduleSpecifier.text.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(filename), statement.moduleSpecifier.text + '.ts');
    if (!fs.existsSync(resolved)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) imports.set(item.name.text, { file: resolved, name: item.propertyName?.text || item.name.text });
  }
  const info = { source, imports };
  sourceCache.set(filename, info);
  return info;
}
function traceService(filename, className, methodName, depth = 0, visited = new Set()) {
  const key = `${filename}:${className}.${methodName}`;
  if (depth > 5 || visited.has(key)) return [];
  visited.add(key);
  const { source, imports } = sourceInfo(filename);
  const declaration = source.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === className);
  const method = declaration?.members.filter(ts.isMethodDeclaration).find(item => item.name.getText(source) === methodName);
  if (!method?.body) return [];
  const dependencies = new Map();
  const constructor = declaration.members.find(ts.isConstructorDeclaration);
  for (const parameter of constructor?.parameters || []) {
    const type = parameter.type?.getText(source);
    if (type && imports.has(type)) dependencies.set(parameter.name.getText(source), imports.get(type));
  }
  const found = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const expression = node.expression.getText(source);
      const argumentsText = node.arguments.map(item => item.getText(source)).join(', ').replace(/\s+/g, ' ');
      if (/assertAccess|assertUniversityScope|requireUniversityId|assert(?:Group|Student|Course|Lesson|.*Manage|.*Read)|\.company$|\.center$|\.require(?:Owner)?$/.test(expression) ||
          (/\.(?:find\w*|where|andWhere|exists\w*|delete|update)$/.test(expression) && /universityId|university_id/.test(argumentsText))) {
        found.push({ file: path.relative(root, filename).replaceAll('\\', '/'), line: lineOf(node, source), check: `${expression.replace(/\s+/g, ' ').slice(0, 120)}(${argumentsText.slice(0, 180)})` });
      }
      const match = /^this\.(?:(\w+)\.)?(\w+)$/.exec(expression);
      if (match) {
        if (!match[1]) found.push(...traceService(filename, className, match[2], depth + 1, visited));
        else if (dependencies.has(match[1])) {
          const dependency = dependencies.get(match[1]);
          found.push(...traceService(dependency.file, dependency.name, match[2], depth + 1, visited));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(method.body);
  return found;
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
            serviceEvidence: traceService(filename, controller.name.text, handler.name.getText(source)),
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
    '| Маршрут | Источник scope и проверка | Обработчик / вызов сервиса | Условие в сервисе (статический путь) |',
    '| --- | --- | --- | --- |',
    ...routes.map(route => {
      const calls = [...new Set(route.calls.map(call => call.call.replace(/^this\./, '')))].join(', ') || 'controller-local';
      const checks = route.serviceEvidence.slice(0, 4).map(item => `[${path.basename(item.file)}:${item.line}](../../${item.file}) \`${item.check.replaceAll('|', '\\|').replaceAll('`', "'")}\``).join('; ') || 'Контроллер/self/public либо проверка вне статически прослеженного пути; требуется предметная проверка';
      return `| \`${route.method} ${route.path}\` | ${tenantRule(route)} | [${route.controller}.${route.handler}](../../${route.file}) → \`${calls}\` | ${checks} |`;
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
