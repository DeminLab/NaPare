const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const configPath = require.resolve('../next.config.js');

async function rewritesFor(backendUrl) {
  const previous = process.env.BACKEND_URL;
  if (backendUrl === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = backendUrl;
  delete require.cache[configPath];
  const config = require(configPath);
  const rewrites = await config.rewrites();
  if (previous === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = previous;
  return rewrites;
}

test('uses the local API when BACKEND_URL is not configured', async () => {
  const rewrites = await rewritesFor(undefined);
  assert.equal(rewrites[0].destination, 'http://localhost:3000/api/:path*');
});

test('keeps the explicit Docker backend URL', async () => {
  const rewrites = await rewritesFor('http://backend:3000');
  assert.equal(rewrites[0].destination, 'http://backend:3000/api/:path*');
});

test('does not create a password-only nested form', () => {
  const page = readFileSync(require.resolve('../src/app/(auth)/register/page.tsx'), 'utf8');
  const fieldComponent = page.slice(page.indexOf('function Field'), page.indexOf('function GroupSelect'));
  assert.doesNotMatch(fieldComponent, /<form\b/);
});
