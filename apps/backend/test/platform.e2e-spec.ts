import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { createPlatformFixture } from './platform.fixture';
import { bindPlatformOwner } from '../src/platform/bootstrap-owner';
import { User } from '../src/users/entities/user.entity';
import { PlatformGrant } from '../src/platform/platform.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ControlAgentClient } from '../src/platform/control-agent.client';
import { PLATFORM_PERMISSIONS, SERVICE_IDS } from '../src/platform/platform.dto';

const suite = process.env.PLATFORM_TEST_DATABASE_URL ? describe : describe.skip;
suite('Platform owner and explicitly delegated rights: real PostgreSQL/JWT/HTTP', () => {
  let f: Awaited<ReturnType<typeof createPlatformFixture>>;
  const tokens: Record<string,string> = {};
  const http = () => request(f.app.getHttpServer());
  const get = (path: string, who='owner') => http().get('/api/v1'+path).auth(tokens[who],{type:'bearer'});
  const grant = (permissions: string[],serviceIds: string[]=[],who='owner') => http().put('/api/v1/platform/permissions/'+f.developer.id).auth(tokens[who],{type:'bearer'}).send({permissions,serviceIds});
  beforeAll(async () => {
    f = await createPlatformFixture(process.env.PLATFORM_TEST_DATABASE_URL!);
    for(const [key,user] of Object.entries({owner:f.owner,developer:f.developer,superadmin:f.superadmin,student:f.users.student,admin:f.users.admin})) {
      const response = await http().post('/api/v1/auth/login').send({email:user.email,password:f.password}).expect(200);
      tokens[key]=response.body.accessToken;
    }
  },60000);
  afterAll(async()=>{await f?.app.close();});
  it('binds one existing UUID offline and never treats developer/superadmin as automatic owners', async()=>{
    await get('/platform/access').expect(200).expect(({body})=>expect(body).toMatchObject({owner:true,ownerConfigured:true}));
    await get('/platform/access','developer').expect(200).expect(({body})=>expect(body).toMatchObject({owner:false,permissions:[]}));
    await get('/platform/access','superadmin').expect(200).expect(({body})=>expect(body.owner).toBe(false));
    await expect(bindPlatformOwner(f.db,f.developer.email)).rejects.toThrow('already bound');
    await get('/platform/accounts','student').expect(403);
    await get('/platform/permissions','developer').expect(403);
  });
  it('lists accounts across universities without credentials and requires explicit delegation',async()=>{
    await get('/platform/accounts','developer').expect(403);
    const list=await get('/platform/accounts?limit=100').expect(200);
    expect(list.body.data.some((user:User)=>user.universityId===f.otherUni.id)).toBe(true);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|telegramUserId|sessionVersion/);
    await grant(['accounts.read']).expect(200);
    await get('/platform/accounts','developer').expect(200);
    await http().patch('/api/v1/platform/accounts/'+f.users.peer.id).auth(tokens.developer,{type:'bearer'}).send({isActive:false}).expect(403);
    await grant([],[],'developer').expect(403);
  });
  it('protects owner and platform identities through new and old administrative routes',async()=>{
    await http().patch('/api/v1/platform/accounts/'+f.owner.id).auth(tokens.owner,{type:'bearer'}).send({isActive:false}).expect(403);
    await http().patch(`/api/v1/admin/users/${f.owner.id}/roles`).auth(tokens.superadmin,{type:'bearer'}).send({role:'student'}).expect(403);
    await http().patch(`/api/v1/admin/users/${f.users.peer.id}/roles`).auth(tokens.superadmin,{type:'bearer'}).send({role:'developer'}).expect(403);
    await http().post(`/api/v1/platform/accounts/${f.owner.id}/password`).auth(tokens.owner,{type:'bearer'}).send({password:'temporary-test-password-12'}).expect(403);
    await grant(['accounts.write']).expect(200);
    await http().patch('/api/v1/platform/accounts/'+f.superadmin.id).auth(tokens.developer,{type:'bearer'}).send({firstName:'Технический',role:'superadmin'}).expect(200);
    await http().patch('/api/v1/platform/accounts/'+f.superadmin.id).auth(tokens.developer,{type:'bearer'}).send({role:'student'}).expect(403);
    await http().patch('/api/v1/platform/accounts/'+f.owner.id).auth(tokens.developer,{type:'bearer'}).send({isActive:false}).expect(403);
    await http().patch('/api/v1/platform/accounts/'+f.users.peer.id).auth(tokens.developer,{type:'bearer'}).send({role:'superadmin'}).expect(403);
  });
  it('creates and edits a university and creates a usable account without exposing credentials',async()=>{
    const uni=await http().post('/api/v1/platform/universities').auth(tokens.owner,{type:'bearer'}).send({name:'Тестовый вуз',city:'Омск',status:'pending'}).expect(201);
    await http().put('/api/v1/platform/universities/'+uni.body.id).auth(tokens.owner,{type:'bearer'}).send({name:'Тестовый вуз',city:'Омск',status:'active'}).expect(200);
    const account={email:'new-user@platform.example.test',firstName:'Новый',lastName:'Студент',role:'student',universityId:uni.body.id,password:'test-created-account-123'};
    await http().post('/api/v1/platform/accounts').send(account).expect(401);
    await http().post('/api/v1/platform/accounts').auth(tokens.developer,{type:'bearer'}).send(account).expect(403);
    const created=await http().post('/api/v1/platform/accounts').auth(tokens.owner,{type:'bearer'}).set('User-Agent','platform-audit-test').send(account).expect(201);
    expect(created.body.passwordHash).toBeUndefined();
    const createAudit=await f.db.getRepository(AuditLog).findOneByOrFail({action:'platform.account.created',entityId:created.body.id});
    expect(createAudit.userId).toBe(f.owner.id);
    expect(createAudit.ip).toBeTruthy();
    expect(createAudit.userAgent).toBe('platform-audit-test');
    expect(createAudit.newValues).toMatchObject({role:'student',result:'created'});
    await http().post('/api/v1/auth/login').send({email:account.email,password:account.password}).expect(200);
    await http().post('/api/v1/platform/accounts').auth(tokens.owner,{type:'bearer'}).send(account).expect(409);
    await get('/platform/audit').expect(200).expect(({body})=>expect(JSON.stringify(body)).not.toContain(account.password));
  });
  it('limits service operations by action and service; disconnected agent never reports success',async()=>{
    await grant(['services.restart'],['web-student']).expect(200);
    const dto={service:'backend',action:'restart',confirm:'backend',idempotencyKey:'11111111-1111-4111-8111-111111111111'};
    await http().post('/api/v1/platform/jobs').auth(tokens.developer,{type:'bearer'}).send(dto).expect(403);
    await http().post('/api/v1/platform/jobs').auth(tokens.developer,{type:'bearer'}).send({...dto,service:'web-student',confirm:'web-student',action:'rebuild'}).expect(403);
    await http().post('/api/v1/platform/jobs').auth(tokens.owner,{type:'bearer'}).send({...dto,confirm:'wrong'}).expect(400);
    await http().post('/api/v1/platform/jobs').auth(tokens.owner,{type:'bearer'}).send({...dto,action:'rebuild',service:'postgres',confirm:'postgres'}).expect(400);
    if(!process.env.PLATFORM_AGENT_SOCKET) await get('/platform/services').expect(503);
  });
  it('revokes delegated rights on the existing JWT',async()=>{
    await grant(['accounts.read']).expect(200);
    await get('/platform/accounts','developer').expect(200);
    await grant([]).expect(200);
    await get('/platform/accounts','developer').expect(403);
    await get('/users/me','developer').expect(200);
  });
  it('updates campus accounts, invalidates sessions and never stores passwords in audit',async()=>{
    const peer=await http().post('/api/v1/auth/login').send({email:f.users.peer.email,password:f.password}).expect(200);
    await http().patch('/api/v1/platform/accounts/'+f.users.peer.id).auth(tokens.owner,{type:'bearer'}).send({isActive:false}).expect(200);
    await http().get('/api/v1/users/me').auth(peer.body.accessToken,{type:'bearer'}).expect(401);
    const password='test-reset-password-12345';
    await http().post('/api/v1/platform/accounts/'+f.users.peer.id+'/password').auth(tokens.owner,{type:'bearer'}).send({password}).expect(201);
    const audit=await get('/platform/audit').expect(200);
    expect(JSON.stringify(audit.body)).not.toContain(password);
    expect(await f.db.getRepository(PlatformGrant).count()).toBe(1);
  });
  it('persists settings and applies read-only mode while leaving owner control and login operational',async()=>{
    const settings={platformName:'Тестовая платформа',supportEmail:'help@example.test',announcement:'Проверка обслуживания',readOnly:true};
    await http().put('/api/v1/platform/settings').auth(tokens.owner,{type:'bearer'}).send(settings).expect(200);
    await http().patch('/api/v1/users/me').auth(tokens.student,{type:'bearer'}).send({firstName:'Новое имя'}).expect(503);
    await http().get('/api/v1/platform/public-settings').expect(200).expect(({body})=>expect(body).toMatchObject(settings));
    await http().put('/api/v1/platform/settings').auth(tokens.owner,{type:'bearer'}).send({...settings,readOnly:false}).expect(200);
    await http().patch('/api/v1/users/me').auth(tokens.student,{type:'bearer'}).send({firstName:'Новое имя'}).expect(200);
    expect(await f.db.getRepository(AuditLog).countBy({action:'platform.settings.updated'})).toBe(2);
  });
  (process.env.PLATFORM_AGENT_SOCKET ? it : it.skip)('uses the signed agent transport and finishes a queued operation while the API is stopped',async()=>{
    await grant(['services.restart','logs.read'],['web-student']).expect(200);
    const services=await get('/platform/services','developer').expect(200);
    expect(services.body.services.map((service:{id:string})=>service.id)).toEqual(['web-student']);
    await get('/platform/services/backend/logs','developer').expect(403);
    await get('/platform/services/web-student/logs','developer').expect(200).expect(({body})=>expect(body.text).not.toContain('fixture-token'));
    const id=randomUUID();
    await http().post('/api/v1/platform/jobs').auth(tokens.developer,{type:'bearer'}).send({service:'web-student',action:'restart',confirm:'web-student',idempotencyKey:id}).expect(201);
    const agent=f.app.get(ControlAgentClient);
    await f.app.close();
    let status='';
    for(let attempt=0;attempt<40;attempt++) { status=(await agent.call<{status:string}>('/jobs/'+id)).status; if(status==='succeeded')break; await new Promise(resolve=>setTimeout(resolve,50)); }
    expect(status).toBe('succeeded');
    const {AppModule}=await import('../src/app.module');
    const module=await Test.createTestingModule({imports:[AppModule]}).compile();
    f.app=module.createNestApplication({logger:false});
    f.app.setGlobalPrefix('api/v1');
    f.app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await f.app.init();
    f.db=f.app.get(DataSource);
    await get('/platform/jobs/'+id).expect(200).expect(({body})=>expect(body.status).toBe('succeeded'));
    await grant([]).expect(200);
    await get('/platform/jobs/'+id,'developer').expect(403);
  },30000);
  it('allows full DevOps operations but reserves emergency revocation for the owner with password confirmation',async()=>{
    await grant([...PLATFORM_PERMISSIONS],[...SERVICE_IDS]).expect(200);
    await get('/platform/access','developer').expect(200).expect(({body})=>{expect(body.owner).toBe(false);expect(body.permissions).toHaveLength(PLATFORM_PERMISSIONS.length);expect(body.serviceIds).toHaveLength(SERVICE_IDS.length);});
    await get('/platform/accounts','developer').expect(200);
    await get('/platform/settings','developer').expect(200);
    const emergency={confirm:'ОТОЗВАТЬ ТЕХДОСТУП',password:f.password};
    await http().post('/api/v1/platform/trust/emergency-revoke').auth(tokens.developer,{type:'bearer'}).send(emergency).expect(403);
    await http().post('/api/v1/platform/trust/emergency-revoke').auth(tokens.owner,{type:'bearer'}).send({...emergency,confirm:'wrong'}).expect(400);
    await http().post('/api/v1/platform/trust/emergency-revoke').auth(tokens.owner,{type:'bearer'}).send({...emergency,password:'wrong-password'}).expect(403);
    await get('/platform/accounts','developer').expect(200);
    const ownerVersion=(await f.db.getRepository(User).findOneByOrFail({id:f.owner.id})).sessionVersion;
    await http().post('/api/v1/platform/trust/emergency-revoke').auth(tokens.owner,{type:'bearer'}).send(emergency).expect(201).expect(({body})=>{expect(body.grantsRevoked).toBe(1);expect(body.accountsSignedOut).toBeGreaterThanOrEqual(2);});
    await get('/platform/accounts','developer').expect(401);
    await get('/users/me','owner').expect(200);
    await get('/users/me','student').expect(200);
    expect((await f.db.getRepository(User).findOneByOrFail({id:f.owner.id})).sessionVersion).toBe(ownerVersion);
    const relogin=await http().post('/api/v1/auth/login').send({email:f.developer.email,password:f.password}).expect(200);
    await http().get('/api/v1/platform/access').auth(relogin.body.accessToken,{type:'bearer'}).expect(200).expect(({body})=>expect(body.permissions).toEqual([]));
    const audit=await get('/platform/audit').expect(200);
    expect(JSON.stringify(audit.body)).not.toContain(f.password);
    expect(audit.body.data.some((entry:{action:string})=>entry.action==='platform.trust.emergency_revoked')).toBe(true);
  });
});
