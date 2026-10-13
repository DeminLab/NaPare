const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Script } = require('node:vm');
const ts = require('typescript');
const source = readFileSync('apps/web-staff/src/app/(staff)/week/page.tsx', 'utf8');
const start = source.indexOf('function getWeekStart');
const end = source.indexOf('export default function');
const compiled = ts.transpileModule(source.slice(start, end) + '\nexports.lessonDay = lessonDay; exports.statusOf = statusOf;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const model = {};
new Script(compiled).runInNewContext({ exports: model, Date });
test('separate API date and time retain the lesson day', () => {
  assert.equal(model.lessonDay({ startDate: '2026-10-13T03:00:00.000Z', startTime: '09:00' }), '2026-10-13');
  assert.equal(model.lessonDay({ startTime: '2026-10-13T09:00:00' }), '2026-10-13');
});
test('past and future lessons are compared by date before time', () => {
  const now = new Date('2026-10-13T09:15:00');
  assert.equal(model.statusOf({ startDate:'2026-10-12',startTime:'15:00',endTime:'16:30' },now).label,'Завершено');
  assert.equal(model.statusOf({ startDate:'2026-10-14',startTime:'08:00',endTime:'09:30' },now).label,'Предстоит');
  assert.equal(model.statusOf({ startDate:'2026-10-13',startTime:'09:00',endTime:'10:30' },now).label,'Сейчас');
});
test('cancellation remains explicit even for past lessons', () => {
  assert.equal(model.statusOf({startDate:'2026-10-12',startTime:'09:00',endTime:'10:30',status:'cancelled'},new Date('2026-10-13T09:15:00')).label,'Отменено');
});
