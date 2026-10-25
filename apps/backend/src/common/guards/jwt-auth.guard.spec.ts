import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContext } from '../tenant/tenant-context';
import { UserRole } from '../../auth/interfaces/user-role';

describe('Career account isolation',()=>{
 const tenant=new TenantContext();const guard=new JwtAuthGuard(tenant);
 const actor={id:'employer-a',email:'test@example.com',role:UserRole.EMPLOYER,universityId:null};
 const context=(url:string)=>({switchToHttp:()=>({getRequest:()=>({originalUrl:url})})}) as unknown as ExecutionContext;
 it.each(['/api/v1/admin/users','/api/v1/schedule/range','/api/v1/users/other','/api/v1/notifications'])('denies academic route %s',url=>{expect(()=>guard.handleRequest(null,actor,null,context(url))).toThrow(ForbiddenException);});
 it.each(['/api/v1/career','/api/v1/career/tasks','/api/v1/users/me','/api/v1/users/me/export','/api/v1/users/me/deletion-preview','/api/v1/auth/logout'])('allows scoped route %s',url=>{expect(guard.handleRequest(null,actor,null,context(url))).toEqual(actor);});
 it.each(['/api/v1/users/me/export/other','/api/v1/users/me/exported'])('does not expand the self-export exception %s',url=>{expect(()=>guard.handleRequest(null,actor,null,context(url))).toThrow(ForbiddenException);});
 it('does not grant academic access to primary career roles',()=>{expect(()=>guard.handleRequest(null,{...actor,universityId:'university-a',role:UserRole.CAREER_STAFF},null,context('/api/v1/admin/users'))).toThrow(ForbiddenException);});
 it('allows exactly the self WebPush route without opening neighboring device routes',()=>{expect(guard.handleRequest(null,actor,null,context('/api/v1/devices/webpush'))).toEqual(actor);for(const path of ['/api/v1/devices/token','/api/v1/devices/webpush/other','/api/v1/devices/webpushed'])expect(()=>guard.handleRequest(null,actor,null,context(path))).toThrow(ForbiddenException);});
});
