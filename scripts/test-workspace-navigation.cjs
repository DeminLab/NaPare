const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Script } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../packages/ui/src/workspace-navigation.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
new Script(compiled).runInNewContext({ exports: exported, URL, URLSearchParams, Date });
const { activeNavigationIndex, uniqueCommands, searchCommands, lessonTabFromSearch, parseCalendarDate } = exported;

test('navigation distinguishes similar paths and supports nested lessons', () => {
  const items = [{ href: '/pair-space' }, { href: '/pair-space-extra' }, { href: '/' }];
  assert.equal(activeNavigationIndex(items, '/pair-space/lesson-1'), 0);
  assert.equal(activeNavigationIndex(items, '/pair-space-extra'), 1);
  assert.equal(activeNavigationIndex(items, '/missing'), -1);
});
test('specific query and anchor win over a general page', () => {
  const items = [{ href: '/dashboard' }, { href: '/dashboard?view=analytics' }, { href: '/api' }, { href: '/api#events' }];
  assert.equal(activeNavigationIndex(items, '/dashboard', '?view=analytics'), 1);
  assert.equal(activeNavigationIndex(items, '/dashboard', '?view=overview'), 0);
  assert.equal(activeNavigationIndex(items, '/api', '', '#events'), 3);
  assert.equal(activeNavigationIndex(items, '/api', '', '#logs'), 2);
});
test('related views share their parent section and disabled entries stay inactive', () => {
  assert.equal(activeNavigationIndex([{ href: '/week', activePaths: ['/month'] }], '/month'), 0);
  assert.equal(activeNavigationIndex([{ href: '/week', disabled: true }], '/week'), -1);
});
test('duplicate destinations are shown once while different lesson tabs stay available', () => {
  const result = uniqueCommands([{ id: 'nav', href: '/week' }, { id: 'command', href: '/week' }, { id: 'prep', href: '/pair-space/a?tab=homeworks' }, { id: 'material', href: '/pair-space/a?tab=materials' }]);
  assert.deepEqual(Array.from(result, item => item.id), ['nav', 'prep', 'material']);
});
test('search opens the actual material/preparation tab and keeps group schedule context', () => {
  const results = [
    { id: 'm', type: 'material', title: 'Material', subtitle: 'Subject', href: '/pair-space/a' },
    { id: 'p', type: 'preparation', title: 'Preparation', subtitle: 'Subject', href: '/pair-space/a?source=search' },
    { id: 'l', type: 'lesson', title: 'Lesson', subtitle: 'Group', href: '/groups?group=abc&date=2026-10-11' },
  ];
  const mapped = searchCommands({ results });
  assert.equal(mapped[0].href, '/pair-space/a?tab=materials');
  assert.equal(mapped[1].href, '/pair-space/a?source=search&tab=homeworks');
  assert.equal(mapped[2].href, '/groups?group=abc&date=2026-10-11');
});
test('search rejects external and protocol-relative navigation', () => {
  const base = { id: 'x', type: 'lesson', title: 'X', subtitle: '' };
  assert.equal(searchCommands({ results: ['https://example.com', '//example.com', '/\\example.com'].map(href => ({ ...base, href })) }).length, 0);
});

test('search distinguishes repeated subjects by the actual lesson date and time', () => {
  const base = { type: 'lesson', title: 'Математика', subtitle: 'Иванов · ауд. 301' };
  const results = searchCommands({ results: [
    { ...base, id: 'first', href: '/pair-space/first', date: '2026-10-12T12:00:00Z' },
    { ...base, id: 'second', href: '/pair-space/second', date: '2026-10-13T12:00:00Z' },
    { ...base, id: 'unknown', href: '/pair-space/unknown', date: 'invalid' },
  ] });
  assert.notEqual(results[0].description, results[1].description);
  assert.ok(results[0].description.includes(new Date('2026-10-12T12:00:00Z').toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })));
  assert.equal(results[2].description, 'Занятие · Иванов · ауд. 301');
});
test('lesson links preserve supported tabs and old/unavailable tabs fall back to main', () => {
  assert.equal(lessonTabFromSearch('?tab=materials'), 'materials');
  assert.equal(lessonTabFromSearch('?compose=homework'), 'homeworks');
  assert.equal(lessonTabFromSearch('?tab=notes', true), 'notes');
  assert.equal(lessonTabFromSearch('?tab=notes'), 'overview');
  for (const tab of ['attendance', 'grades', 'announcements', 'unknown']) assert.equal(lessonTabFromSearch('?tab=' + tab, true), 'overview');
});
test('calendar dates validate leap years and reject silently rolled-over days', () => {
  assert.equal(parseCalendarDate('2024-02-29').getDate(), 29);
  for (const value of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-1', null]) assert.equal(parseCalendarDate(value), null);
});
