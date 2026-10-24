import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// A parser crash must fail a child process, rather than taking Jest down with it.
const run = promisify(execFile);
const fixture = String.raw`
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const { createRequire } = require('node:module');
const nest = createRequire(require.resolve('@nestjs/platform-express'));
const express = nest('express');
const bodyParser = nest('body-parser');
const multer = nest('multer');
const app = express();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let lateFilterCompleted = false;
app.use(bodyParser.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/json', (req, res) => res.json(req.body));
app.post('/upload', multer({ storage: multer.memoryStorage() }).single('file'),
  (req, res) => res.json({ size: req.file.size, name: req.file.originalname }));
app.post('/teardown', multer({
  fileHwm: 1,
  fileFilter(req, file, callback) {
    if (file.originalname === 'pending.txt') {
      setTimeout(() => { lateFilterCompleted = true; callback(null, true); }, 100);
    } else req.once('end', () => setImmediate(() => callback(new Error('fixture rejection'))));
  },
}).any(), (_req, res) => res.sendStatus(204));
app.use((error, _req, res, _next) => res.status(error.status || 400).json({ rejected: true }));
const server = app.listen(0, '127.0.0.1', async () => {
  const send = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port,
      method: 'POST', path, headers }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
  const healthy = () => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/health' }, res => {
      res.resume(); res.on('end', () => {
        try { assert.equal(res.statusCode, 200); resolve(); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
  const multipart = names => Buffer.from(names.map(name =>
    '--parser-fixture\r\nContent-Disposition: form-data; name="file"; filename="' + name +
    '"\r\nContent-Type: text/plain\r\n\r\nhello\r\n').join('') + '--parser-fixture--\r\n');
  try {
    const value = { title: 'fixture', count: 3 };
    for (const encoding of ['identity', 'gzip', 'deflate']) {
      const raw = Buffer.from(JSON.stringify(value));
      const body = encoding === 'gzip' ? zlib.gzipSync(raw) : encoding === 'deflate' ? zlib.deflateSync(raw) : raw;
      const result = await send('/json', body, { 'Content-Type': 'application/json', 'Content-Encoding': encoding });
      assert.equal(result.status, 200); assert.deepEqual(result.body, value);
    }
    // Trailing bytes after a complete compressed frame must leave the process alive.
    for (const encoding of ['gzip', 'deflate']) {
      const raw = Buffer.from(JSON.stringify(value));
      const frame = encoding === 'gzip' ? zlib.gzipSync(raw) : zlib.deflateSync(raw);
      const body = Buffer.concat([frame, Buffer.from([0]), Buffer.alloc(100 * 1024, 88)]);
      const result = await send('/json', body, { 'Content-Type': 'application/json', 'Content-Encoding': encoding, 'Content-Length': body.length });
      assert.ok([200, 400].includes(result.status));
      await sleep(100); await healthy();
    }
    const headers = { 'Content-Type': 'multipart/form-data; boundary=parser-fixture' };
    const upload = await send('/upload', multipart(['normal.txt']), headers);
    assert.equal(upload.status, 200); assert.deepEqual(upload.body, { size: 5, name: 'normal.txt' });
    const truncated = multipart(['pending.txt', 'rejected.txt']).subarray(0, -Buffer.byteLength('--parser-fixture--\r\n'));
    const rejected = await send('/teardown', truncated, { ...headers, 'Content-Length': truncated.length });
    assert.equal(rejected.status, 400);
    await sleep(200); assert.equal(lateFilterCompleted, true); await healthy();
    console.log(JSON.stringify({ jsonEncodings: 3, trailingFrameCases: 2, multipart: true, lateFilter: true }));
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); server.closeAllConnections(); }
});
`;

describe('Installed Nest/Express request parsers', () => {
  it('preserves JSON and uploads and survives late compressed/multipart errors', async () => {
    const { stdout, stderr } = await run(process.execPath, ['-e', fixture], {
      cwd: process.cwd(), timeout: 15000, maxBuffer: 1024 * 1024,
    });
    expect(stderr).toBe('');
    expect(JSON.parse(stdout.trim())).toEqual({
      jsonEncodings: 3, trailingFrameCases: 2, multipart: true, lateFilter: true,
    });
  }, 20000);
});
