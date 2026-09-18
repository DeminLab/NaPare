const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'coverage']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : walk(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

const markdown = walk(root);
assert.ok(markdown.length >= 200, 'Expected at least 200 Markdown files, found ' + markdown.length + '.');

const required = ['AGENTS.md', 'AI_CONTEXT.md', 'docs/ai/README.md', 'docs/ai/project-map.md', 'docs/ai/source-cards/README.md', 'docs/ai/maintenance.md'];
for (const relative of required) assert.ok(fs.existsSync(path.join(root, relative)), 'Missing AI entry document: ' + relative);

const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
assert.match(agents, /AI_CONTEXT\.md/, 'AGENTS.md must direct agents to AI_CONTEXT.md.');
const context = fs.readFileSync(path.join(root, 'AI_CONTEXT.md'), 'utf8');
assert.match(context, /source-cards/, 'AI_CONTEXT.md must link to source cards.');

const cardsDir = path.join(root, 'docs/ai/source-cards');
const cards = fs.readdirSync(cardsDir).filter((file) => file.endsWith('.md') && file !== 'README.md');
assert.ok(cards.length >= 100, 'Expected at least 100 source cards, found ' + cards.length + '.');
for (const card of cards) {
  const body = fs.readFileSync(path.join(cardsDir, card), 'utf8');
  const match = body.match(/## Canonical source\s+\s*`([^`]+)`/);
  assert.ok(match, 'Missing canonical source in ' + card + '.');
  assert.ok(fs.existsSync(path.join(root, match[1])), 'Broken source reference in ' + card + ': ' + match[1]);
  assert.match(body, /## Verification/, 'Missing verification section in ' + card + '.');
}

console.log('AI documentation check passed: ' + markdown.length + ' Markdown files, ' + cards.length + ' source cards.');
