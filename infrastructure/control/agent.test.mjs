import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createAgent, redact } from './agent.mjs';

test('private agent: signatures, replay prevention, allowlist, durable jobs and redacted logs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'napare-control-test-'));
  const secret = randomUUID() + randomUUID(), calls = [];
  const run = async (_file, args, options) => {
    calls.push(args);
    if (args.includes('ps')) return JSON.stringify([{ Service:'backend', State:'running', Health:'healthy', Image:'napare-backend', Command:'password=do-not-expose' }]);
    if (args.includes('logs')) return 'password=do-not-expose Bearer private-token';
    options.onOutput?.('building token=private-token\n');
    await new Promise(resolve => setTimeout(resolve, 40)); return 'done';
  };
  const instance = await createAgent({ secret, repo: dir, stateDir: path.join(dir,'state'), run, healthWaitMs: 50 });
  await new Promise(resolve => instance.server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + instance.server.address().port;
  const sign = (url, method, body) => { const timestamp = String(Date.now()), nonce = randomUUID(); return { 'Content-Type':'application/json','x-control-time':timestamp,'x-control-nonce':nonce,'x-control-signature':createHmac('sha256',secret).update([timestamp,nonce,method,url,createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex') }; };
  const call = (url, method = 'GET', value) => { const body = value === undefined ? '' : JSON.stringify(value); return fetch(base+url,{method,headers:sign(url,method,body),...(body?{body}:{})}); };
  try {
    assert.equal((await fetch(base+'/services')).status,401);
    const headers = sign('/services','GET','');
    const first = await fetch(base+'/services',{headers});
    assert.equal(first.status,200); assert.equal((await first.text()).includes('do-not-expose'),false);
    assert.equal((await fetch(base+'/services',{headers})).status,401);
    const payload = {service:'backend',action:'rebuild',confirm:'backend',idempotencyKey:randomUUID(),actorId:randomUUID()};
    assert.equal((await call('/jobs','POST',{...payload,service:'backend; echo hacked'})).status,400);
    assert.equal((await call('/jobs','POST',{...payload,command:'whoami'})).status,400);
    assert.equal((await call('/jobs','POST',{...payload,confirm:'wrong'})).status,400);
    assert.equal((await call('/jobs','POST',{...payload,service:'postgres',confirm:'postgres'})).status,400);
    const accepted = await call('/jobs','POST',payload); assert.equal(accepted.status,202);
    assert.equal((await call('/jobs','POST',payload)).status,200);
    assert.equal((await call('/jobs','POST',{...payload,actorId:randomUUID()})).status,409);
    let job;
    for (let attempt=0;attempt<40;attempt++) { job=await (await call('/jobs/'+payload.idempotencyKey)).json(); if(job.status==='succeeded')break; await new Promise(resolve=>setTimeout(resolve,20)); }
    assert.equal(job.status,'succeeded'); assert.equal(job.log.includes('private-token'),false);
    assert.equal(calls.filter(args=>args.includes('build')).length,1);
    assert.equal(calls.some(args=>args.includes('--no-deps')),true);
    assert.equal((await (await call('/logs/backend')).text()).includes('do-not-expose'),false);
    assert.equal((await call('/logs/../../etc/passwd')).status,401);
    assert.equal(JSON.parse(await fs.readFile(path.join(dir,'state',payload.idempotencyKey+'.json'),'utf8')).status,'succeeded');
    await instance.close();
    const reopened = await createAgent({secret,repo:dir,stateDir:path.join(dir,'state'),run});
    await new Promise(resolve => reopened.server.listen(0,'127.0.0.1',resolve));
    await reopened.close();
    assert.equal(redact('secret=abc123 Bearer sample-token'), 'secret=[REDACTED] Bearer [REDACTED]');
  } finally { if(instance.server.listening) await instance.close(); /* Keep the isolated temp fixture for diagnosis; no working data is removed. */ }
});
