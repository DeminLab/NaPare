import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apps = [
  {
    app: 'portal',
    directory: 'web-portal',
    basePath: '',
    origin: process.env.NAPARE_PORTAL_ORIGIN ?? 'http://localhost:3006',
  },
  {
    app: 'student',
    directory: 'web-student',
    basePath: '/student',
    origin: process.env.NAPARE_STUDENT_ORIGIN ?? 'http://localhost:3001',
  },
  {
    app: 'staff',
    directory: 'web-staff',
    basePath: '/staff',
    origin: process.env.NAPARE_STAFF_ORIGIN ?? 'http://localhost:3002',
  },
  {
    app: 'university admin',
    directory: 'web-admin',
    basePath: '/deanery',
    origin: process.env.NAPARE_ADMIN_ORIGIN ?? 'http://localhost:3003',
  },
  {
    app: 'developer',
    directory: 'web-developer',
    basePath: '/developer',
    origin: process.env.NAPARE_DEVELOPER_ORIGIN ?? 'http://localhost:3004',
  },
];

const sampleId = '00000000-0000-4000-8000-000000000001';

async function findPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findPageFiles(fullPath);
    return entry.isFile() && entry.name === 'page.tsx' ? [fullPath] : [];
  }));
  return nested.flat();
}

function routeFromPageFile(app, file) {
  const appDirectory = path.join(root, 'apps', app.directory, 'src', 'app');
  const segments = path.relative(appDirectory, file)
    .split(path.sep)
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map((segment) => /^\[{1,2}\.\.\..+\]{1,2}$/.test(segment) || /^\[.+\]$/.test(segment)
      ? sampleId
      : segment);
  const route = segments.length > 0 ? `/${segments.join('/')}` : '';
  return `${app.basePath}${route}` || '/';
}

function titleFrom(html) {
  const match = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

function isNotFound(html, title) {
  return /^404\b/i.test(title) || /<h1(?:\s[^>]*)?>\s*404\s*<\/h1>/i.test(html);
}

const routes = (await Promise.all(apps.map(async (app) => {
  const appDirectory = path.join(root, 'apps', app.directory, 'src', 'app');
  const pageFiles = await findPageFiles(appDirectory);
  return pageFiles.map((file) => ({ app: app.app, origin: app.origin, path: routeFromPageFile(app, file) }));
}))).flat().sort((left, right) => left.app.localeCompare(right.app) || left.path.localeCompare(right.path));

let failures = 0;

for (const { app, origin, path: routePath } of routes) {
  const url = new URL(routePath, origin);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const html = await response.text();
    const title = titleFrom(html);
    const contentType = response.headers.get('content-type') ?? '';
    const ok = response.ok && contentType.includes('text/html') && title.length > 0 && !isNotFound(html, title);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${app.padEnd(16)} ${routePath} -> ${response.status} ${title || '(no title)'}`);
    if (!ok) failures += 1;
  } catch (error) {
    failures += 1;
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${app.padEnd(16)} ${routePath} -> ${reason}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} of ${routes.length} local route check(s) failed. Start the corresponding web app and retry.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${routes.length} active App Router page route(s) returned HTML with a title.`);
  console.log('This is an HTTP/SSR reachability check; it does not run client JavaScript or verify auth/API behavior.');
}
