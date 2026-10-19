import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/interfaces/user-role';
import { CareerService, assertCareerResultUrl, assertCareerTransition } from './career.service';
import { CareerTask, CareerProfile, CareerMembership, CareerAdmission, CareerTest, CareerTestAttempt, CareerNotice, CareerPortfolio, CareerWork, CareerReview, CareerApplication, CareerCompany, CareerPartnership } from './career.entities';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';

const student={id:'student-a',email:'student@test',role:UserRole.STUDENT,universityId:'university-a'};
describe('Career resource boundaries',()=>{
  it('rejects unsafe result URLs and accepts HTTPS only',()=>{for(const url of ['javascript:alert(1)','http://example.com','https://secret:pass@example.com'])expect(()=>assertCareerResultUrl(url)).toThrow(BadRequestException);expect(()=>assertCareerResultUrl('https://example.com/work')).not.toThrow();});
  it('does not accept a work or select a student twice',()=>{expect(()=>assertCareerTransition('accepted',['submitted'])).toThrow(ConflictException);expect(()=>assertCareerTransition('assigned',['open'])).toThrow(ConflictException);});
  it('denies an application to a task at another university before reading a profile',async()=>{
    const getRepository=jest.fn(()=>({findOne:jest.fn().mockResolvedValue({id:'task-a',universityId:'university-b',state:'open'})}));
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.apply(student,'task-a',{message:'I am a qualified applicant'})).rejects.toThrow(ForbiddenException);expect(getRepository).toHaveBeenCalledTimes(1);
  });
  it('requires verified professional profile before an application',async()=>{
    const getRepository=jest.fn(entity=>entity===CareerTask?{findOne:jest.fn().mockResolvedValue({universityId:'university-a',state:'open',deadline:'2099-12-01'})}:{existsBy:jest.fn().mockResolvedValue(false)});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.apply(student,'task-a',{message:'I am a qualified applicant'})).rejects.toThrow('Подтвердите профессиональный профиль');expect(getRepository).toHaveBeenCalledWith(CareerProfile);
  });
  it('requires admission for the exact profiled direction',async()=>{
    const getRepository=jest.fn(entity=>entity===CareerTask?{findOne:jest.fn().mockResolvedValue({universityId:'university-a',state:'open',deadline:'2099-12-01',profiled:true,skill:'design'})}:entity===CareerProfile?{existsBy:jest.fn().mockResolvedValue(true)}:{existsBy:jest.fn().mockResolvedValue(false)});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.apply(student,'task-a',{message:'I am a qualified applicant'})).rejects.toThrow('Нет допуска');expect(getRepository).toHaveBeenCalledWith(CareerAdmission);
  });
  it('does not allow a student to verify their own profile',async()=>{
    const getRepository=jest.fn(entity=>entity===CareerProfile?{findOneBy:jest.fn().mockResolvedValue({universityId:'university-a'})}:{existsBy:jest.fn().mockResolvedValue(false)});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.verifyProfile(student,'profile-a',{decision:'approved',reason:''})).rejects.toThrow(ForbiddenException);expect(getRepository).toHaveBeenCalledWith(CareerMembership);
  });
  it('returns test questions without correct answers',async()=>{
    const getRepository=jest.fn(()=>({find:jest.fn().mockResolvedValue([{id:'test-a',title:'Test',skill:'design',passingPercent:70,questions:[{prompt:'Question',options:['One','Two'],answer:0}]}])}));
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    const tests=await service.tests(student);expect(tests[0].questions[0]).toEqual({prompt:'Question',options:['One','Two']});expect(getRepository).toHaveBeenCalledWith(CareerTest);
  });
  it('does not allow an employer to answer a student admission test',async()=>{
    const service=new CareerService({} as DataSource,{} as AuthService);
    await expect(service.attempt({...student,role:UserRole.EMPLOYER,universityId:null},'test-a',{answers:[0,0,0]})).rejects.toThrow(ForbiddenException);
  });

});

describe('Career test list pagination',()=>{
  const center={...student,id:'center-a',role:UserRole.CAREER_STAFF};
  const makeHarness=(actor:{id:string;email:string;role:UserRole;universityId:string|null},items:Array<any>,total:number,membershipAllowed=false)=>{
    const query:any={where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([items,total])};
    const attemptQuery:any={select:jest.fn(function(){return this;}),addSelect:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),groupBy:jest.fn(function(){return this;}),getRawMany:jest.fn().mockResolvedValue([])};
    const queryBuilder=jest.fn(()=>query);const find=jest.fn().mockResolvedValue(items);const membershipExists=jest.fn().mockResolvedValue(membershipAllowed);
    const getRepository=jest.fn(entity=>entity===CareerTest?{find,createQueryBuilder:queryBuilder}:entity===CareerTestAttempt?{createQueryBuilder:jest.fn(()=>attemptQuery)}:entity===CareerMembership?{existsBy:membershipExists}:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,attemptQuery,find,queryBuilder,getRepository,membershipExists};
  };
  it.each([
    {name:'empty list',items:[],total:0,offset:'0',hasMore:false},
    {name:'exactly 100 records',items:Array.from({length:20},(_,index)=>({id:`test-${index}`,questions:[]})),total:100,offset:'80',hasMore:false},
    {name:'record after the old cap',items:[{id:'test-101',questions:[]}],total:101,offset:'100',hasMore:false},
    {name:'next page remains available before the end',items:Array.from({length:20},(_,index)=>({id:`test-${index}`,questions:[]})),total:101,offset:'80',hasMore:true},
  ])('returns $name with accurate metadata',async({items,total,offset,hasMore})=>{
    const {service,query}=makeHarness(student,items,total);
    await expect(service.tests(student,{offset,limit:'20'})).resolves.toMatchObject({items,total,offset:Number(offset),limit:20,hasMore});
    expect(query.where).toHaveBeenCalledWith('test.universityId = :universityId',{universityId:student.universityId});
    expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);
    expect(query.orderBy).toHaveBeenCalledWith('test.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('test.id','DESC');
  });
  it('searches title and skill and strips answer keys from paged student rows',async()=>{
    const record={id:'test-a',universityId:'university-a',title:'Design basics',skill:'design',passingPercent:70,createdAt:new Date(),questions:[{prompt:'Question',options:['One','Two'],answer:1}]};
    const {service,query}=makeHarness(student,[record],1);
    const result=await service.tests(student,{offset:'0',limit:'20',q:' DESIGN '});
    expect(query.andWhere).toHaveBeenCalledWith('(LOWER(test.title) LIKE :testSearch OR LOWER(test.skill) LIKE :testSearch)',{testSearch:'%design%'});
    expect(result).toMatchObject({items:[{id:'test-a',questions:[{prompt:'Question',options:['One','Two']}]}],total:1});
    expect(JSON.stringify(result)).not.toContain('answer');
  });
  it('returns only the signed-in student’s remaining rolling-day attempts',async()=>{
    const record={id:'test-a',title:'Test',skill:'design',passingPercent:70,questions:[{prompt:'Question',options:['One','Two'],answer:0}]};
    const {service,attemptQuery,getRepository}=makeHarness(student,[record],1);
    attemptQuery.getRawMany.mockResolvedValue([{testId:'test-a',attemptCount:'2'}]);

    const result=await service.tests(student,{offset:'0',limit:'20'});

    expect(result).toMatchObject({items:[{id:'test-a',remainingAttempts:1,questions:[{prompt:'Question',options:['One','Two']}]}]});
    expect(JSON.stringify(result)).not.toContain('answer');
    expect(attemptQuery.where).toHaveBeenCalledWith('attempt.studentId = :studentId',{studentId:student.id});
    expect(attemptQuery.andWhere).toHaveBeenNthCalledWith(1,'attempt.testId IN (:...testIds)',{testIds:['test-a']});
    expect(attemptQuery.andWhere).toHaveBeenNthCalledWith(2,'attempt.createdAt >= :windowStart',{windowStart:expect.any(Date)});
    expect(getRepository).toHaveBeenCalledWith(CareerTestAttempt);
  });
  it('does not query student attempts for career-center staff',async()=>{
    const {service,getRepository}=makeHarness(center,[],0,true);

    await service.tests(center,{offset:'0',limit:'20'});

    expect(getRepository).not.toHaveBeenCalledWith(CareerTestAttempt);
  });
  it('keeps clients without page params on the legacy array response and removes answers',async()=>{
    const record={id:'test-a',title:'Test',skill:'design',passingPercent:70,questions:[{prompt:'Question',options:['One','Two'],answer:0}]};
    const {service,find,queryBuilder}=makeHarness(student,[record],1);
    const result=await service.tests(student);
    expect(result).toEqual([{id:'test-a',title:'Test',skill:'design',passingPercent:70,questions:[{prompt:'Question',options:['One','Two']}]}]);
    expect(find).toHaveBeenCalledWith({where:{universityId:'university-a'},order:{createdAt:'DESC',id:'DESC'},take:100});expect(queryBuilder).not.toHaveBeenCalled();
  });
  it('requires and scopes a center membership to the actor university before reading tests',async()=>{
    const staff={...student,id:'staff-a',role:UserRole.TEACHER};const allowed=makeHarness(staff,[],0,true);
    await allowed.service.tests(staff,{offset:'0'});
    expect(allowed.membershipExists).toHaveBeenCalledWith({userId:'staff-a',universityId:'university-a',role:In(['career_admin','career_staff']),revokedAt:expect.anything()});
    expect(allowed.query.where).toHaveBeenCalledWith('test.universityId = :universityId',{universityId:'university-a'});
    const revoked=makeHarness(staff,[],0,false);
    await expect(revoked.service.tests(staff,{offset:'0'})).rejects.toThrow(ForbiddenException);
    expect(revoked.getRepository).not.toHaveBeenCalledWith(CareerTest);
  });
  it('denies employers before reading any tests',async()=>{
    const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};const {service,getRepository}=makeHarness(employer,[],0);
    await expect(service.tests(employer,{offset:'0'})).rejects.toThrow(ForbiddenException);
    expect(getRepository).not.toHaveBeenCalledWith(CareerTest);
  });
  it('validates page limits',async()=>{
    const {service}=makeHarness(student,[],0);
    await expect(service.tests(student,{limit:'51'})).rejects.toThrow(BadRequestException);
    await expect(service.tests(student,{offset:'-1'})).rejects.toThrow(BadRequestException);
  });
});

describe('Career notice pagination and ownership',()=>{
  const makeHarness=(rows:Array<any>,total:number,unreadCount=0,affected=0)=>{
    const query:any={where:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([rows,total])};
    const countBy=jest.fn().mockResolvedValue(unreadCount);const update=jest.fn().mockResolvedValue({affected});
    const repository={createQueryBuilder:jest.fn(()=>query),countBy,update};const getRepository=jest.fn(entity=>entity===CareerNotice?repository:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,countBy,update,getRepository};
  };
  it.each([
    {name:'empty list',rows:[],total:0,offset:'0',hasMore:false},
    {name:'100 records',rows:Array.from({length:20},(_,index)=>({id:`notice-${index}`,userId:student.id,title:'Title',body:'Body',isRead:false,createdAt:new Date('2026-01-01')})),total:100,offset:'80',hasMore:false},
    {name:'101st record',rows:[{id:'notice-101',userId:student.id,title:'Title',body:'Body',isRead:false,createdAt:new Date('2025-01-01')}],total:101,offset:'100',hasMore:false},
    {name:'continuation after 100',rows:Array.from({length:20},(_,index)=>({id:`notice-${index}`,userId:student.id,title:'Title',body:'Body',isRead:false,createdAt:new Date('2026-01-01')})),total:101,offset:'80',hasMore:true},
  ])('returns $name with stable page metadata',async({rows,total,offset,hasMore})=>{
    const {service,query}=makeHarness(rows,total);
    await expect(service.listNotices(student,{offset,limit:'20'})).resolves.toMatchObject({items:rows.map(({id,title,body,isRead,createdAt})=>({id,title,body,isRead,createdAt})),total,offset:Number(offset),limit:20,hasMore});
    expect(query.where).toHaveBeenCalledWith('notice.userId = :userId',{userId:student.id});expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);
    expect(query.orderBy).toHaveBeenCalledWith('notice.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('notice.id','DESC');
  });
  it('never queries or returns another user notices',async()=>{
    const own={id:'own',userId:student.id,title:'Mine',body:'Body',isRead:false,createdAt:new Date()};const {service,query}=makeHarness([own],1);
    const result=await service.listNotices(student,{});
    expect(query.where).toHaveBeenCalledWith('notice.userId = :userId',{userId:student.id});expect(result.items).toEqual([{id:'own',title:'Mine',body:'Body',isRead:false,createdAt:own.createdAt}]);expect(JSON.stringify(result)).not.toContain('foreign-user');
  });
  it('returns exact unread count for the actor only',async()=>{
    const {service,countBy}=makeHarness([],0,7);
    await expect(service.unreadNoticeCount(student)).resolves.toEqual({count:7});expect(countBy).toHaveBeenCalledWith({userId:student.id,isRead:false});
  });
  it('denies marking another user notice read while retaining own read behavior',async()=>{
    const denied=makeHarness([],0,0,0);await expect(denied.service.readNotice(student,'foreign-notice')).rejects.toThrow(NotFoundException);expect(denied.update).toHaveBeenCalledWith({id:'foreign-notice',userId:student.id},{isRead:true});
    const allowed=makeHarness([],0,0,1);await expect(allowed.service.readNotice(student,'own-notice')).resolves.toEqual({success:true});expect(allowed.update).toHaveBeenCalledWith({id:'own-notice',userId:student.id},{isRead:true});
  });
});


describe('Career case descriptions',()=>{
  it('denies another student case before reading accepted work',async()=>{
    const repository={findOneBy:jest.fn().mockResolvedValue(null)};
    const service=new CareerService({manager:{getRepository:()=>repository}} as unknown as DataSource,{} as AuthService);
    await expect(service.saveCaseText(student,'foreign','Описание')).rejects.toThrow();
    expect(repository.findOneBy).toHaveBeenCalledWith({id:'foreign',studentId:student.id});
  });
  it('stores author text separately and hides an edited published case',async()=>{
    const item={id:'case',workId:'work',studentId:student.id,published:true,caseText:''};const update=jest.fn(async (_where,value)=>Object.assign(item,value));
    const getRepository=jest.fn(entity=>entity===CareerPortfolio?{findOneBy:jest.fn().mockResolvedValue(item),update}:entity===CareerWork?{findOneBy:jest.fn().mockResolvedValue({submission:'Original accepted result',taskId:'task'})}:entity===CareerReview?{findOneBy:jest.fn().mockResolvedValue({body:'Original review'})}:{findOne:jest.fn().mockResolvedValue({title:'Task',criteria:'Criteria'})});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.saveCaseText(student,'case','  Описание автора  ')).resolves.toMatchObject({caseText:'Описание автора',published:false});
    expect(update).toHaveBeenCalledWith({id:'case',studentId:student.id},{caseText:'Описание автора',published:false});
  });
});

describe('Career task list pagination',()=>{
  const makeHarness=(actor:{id:string;email:string;role:UserRole;universityId:string|null},items:Array<{id:string}>,total:number,memberships:Array<Record<string,unknown>>=[],applications:Array<{taskId:string}>=[])=>{
    const query:any={where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([items,total])};
    const getRepository=jest.fn(entity=>entity===CareerMembership?{find:jest.fn().mockResolvedValue(memberships),existsBy:jest.fn().mockResolvedValue(false)}:entity===CareerApplication?{find:jest.fn().mockResolvedValue(applications)}:entity===CareerTask?{createQueryBuilder:jest.fn(()=>query)}:entity===CareerCompany?{find:jest.fn().mockResolvedValue([])}:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,getRepository};
  };
  it.each([
    {name:'empty list',offset:'0',items:[],total:0,hasMore:false},
    {name:'exactly 100 records',offset:'80',items:Array.from({length:20},(_,index)=>({id:`task-${index}`})),total:100,hasMore:false},
    {name:'more results after the old cap',offset:'80',items:Array.from({length:20},(_,index)=>({id:`task-${index}`})),total:101,hasMore:true},
    {name:'record after the old cap',offset:'100',items:[{id:'task-101'}],total:101,hasMore:false},
  ])('returns accurate metadata for $name',async({offset,items,total,hasMore})=>{
    const {service,query}=makeHarness(student,items,total);
    await expect(service.listTasks(student,undefined,{offset,limit:'20'})).resolves.toMatchObject({items,total,offset:Number(offset),limit:20,hasMore,appliedTaskIds:[]});
    expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);
    expect(query.orderBy).toHaveBeenCalledWith('task.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('task.id','DESC');
  });
  it('keeps student lists inside their university and includes already-applied task ids',async()=>{
    const applied={id:'applied-task'};const {service,query}=makeHarness(student,[applied],1,[],[{taskId:applied.id}]);
    const result=await service.listTasks(student,'student',{offset:'0'});
    expect(query.where).toHaveBeenCalledWith('task.universityId = :universityId',{universityId:'university-a'});
    expect(query.andWhere).toHaveBeenCalledWith('(task.state = :openState OR task.id IN (:...applicationTaskIds))',{openState:'open',applicationTaskIds:[applied.id]});
    expect(result.appliedTaskIds).toEqual([applied.id]);
  });
  it('limits employer and center queries to their current company or university scope',async()=>{
    const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};
    const companyScope=makeHarness(employer,[],0,[{companyId:'company-a',role:'company_owner'},{companyId:'company-b',role:'company_member'},{companyId:'company-denied',role:'career_staff'}]);
    await companyScope.service.listTasks(employer,'employer',{offset:'0'});
    expect(companyScope.query.where).toHaveBeenCalledWith('task.companyId IN (:...companyIds)',{companyIds:['company-a','company-b']});
    const center={...student,id:'center-a',role:UserRole.CAREER_STAFF};
    const universityScope=makeHarness(center,[],0);
    await universityScope.service.listTasks(center,'center',{offset:'0'});
    expect(universityScope.query.where).toHaveBeenCalledWith('task.universityId = :universityId',{universityId:'university-a'});
  });
  it('applies search, category and workflow state filters on the server',async()=>{
    const center={...student,id:'center-a',role:UserRole.CAREER_STAFF};const {service,query}=makeHarness(center,[],0);
    await service.listTasks(center,'center',{q:'  Дизайн  ',category:'profiled',state:'review'});
    expect(query.andWhere).toHaveBeenCalledWith('task.state = :taskState',{taskState:'review'});
    expect(query.andWhere).toHaveBeenCalledWith('task.profiled = :profiled',{profiled:true});
    expect(query.andWhere).toHaveBeenCalledWith('(LOWER(task.title) LIKE :taskSearch OR LOWER(task.description) LIKE :taskSearch OR LOWER(task.skill) LIKE :taskSearch)',{taskSearch:'%дизайн%'});
  });
  it('does not infer center access from an unrelated university membership role',async()=>{
    const teacher={...student,id:'teacher-a',role:UserRole.TEACHER};const {service}=makeHarness(teacher,[],0,[{universityId:'university-a',role:'company_member'}]);
    await expect(service.listTasks(teacher,'center',{offset:'0'})).rejects.toThrow(ForbiddenException);
  });
  it('rejects invalid pagination without querying task records',async()=>{
    const {service,getRepository}=makeHarness(student,[],0);
    await expect(service.listTasks(student,undefined,{offset:'-1'})).rejects.toThrow(BadRequestException);
    expect(getRepository).not.toHaveBeenCalledWith(CareerTask);
  });
});

describe('Career workflow pagination',()=>{
  const makeHarness=(actor:{id:string;email:string;role:UserRole;universityId:string|null},kind:'applications'|'works',records:Array<Record<string,any>>,total:number,memberships:Array<Record<string,unknown>>=[],taskRows:Array<Record<string,any>>=[])=>{
    const query:any={innerJoin:jest.fn(function(){return this;}),leftJoin:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([records,total])};
    const entity=kind==='applications'?CareerApplication:CareerWork;
    const membershipFind=jest.fn().mockResolvedValue(memberships);
    const getRepository=jest.fn(repo=>repo===CareerMembership?{find:membershipFind,existsBy:jest.fn().mockResolvedValue(false)}:repo===entity?{createQueryBuilder:jest.fn(()=>query)}:repo===CareerTask?{find:jest.fn().mockResolvedValue(taskRows)}:repo===CareerCompany?{find:jest.fn().mockResolvedValue([])}:repo===CareerReview?{find:jest.fn().mockResolvedValue([])}:{find:jest.fn().mockResolvedValue([])});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,getRepository,membershipFind};
  };
  it.each([
    {name:'empty result',records:[],total:0,offset:'0',hasMore:false},
    {name:'exactly 100 results',records:Array.from({length:20},(_,index)=>({id:`record-${index}`,taskId:'task-a',studentId:student.id,state:'pending',createdAt:new Date('2026-01-01')})),total:100,offset:'80',hasMore:false},
    {name:'101st result remains reachable',records:[{id:'record-101',taskId:'task-a',studentId:student.id,state:'pending',createdAt:new Date('2025-01-01')}],total:101,offset:'100',hasMore:false},
  ])('returns $name with stable page metadata',async({records,total,offset,hasMore})=>{
    const task={id:'task-a',companyId:'company-a',universityId:'university-a',title:'Task'};const {service,query}=makeHarness(student,'applications',records,total,[],records.length?[task]:[]);
    await expect(service.listWorkflows(student,'student',{kind:'applications',offset,limit:'20'})).resolves.toMatchObject({items:records.map(record=>expect.objectContaining({task,company:'Работодатель'})),total,offset:Number(offset),limit:20,hasMore});
    expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);expect(query.orderBy).toHaveBeenCalledWith('application.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('application.id','DESC');
  });
  it('keeps student history scoped to the actor and their university',async()=>{
    const record={id:'application-a',taskId:'task-a',studentId:student.id,state:'selected',createdAt:new Date()};const task={id:'task-a',companyId:'company-a',universityId:'university-a'};const {service,query}=makeHarness(student,'applications',[record],1,[],[task]);
    await service.listWorkflows(student,'student',{kind:'applications'});
    expect(query.where).toHaveBeenCalledWith('application.studentId = :studentId',{studentId:student.id});expect(query.andWhere).toHaveBeenCalledWith('task.universityId = :universityId',{universityId:'university-a'});
  });
  it('restricts employer records to active company owner/member memberships',async()=>{
    const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};const memberships=[{companyId:'company-a',role:'company_owner',revokedAt:null},{companyId:'company-b',role:'company_member',revokedAt:null},{companyId:'company-denied',role:'career_staff',revokedAt:null}];const {service,query,membershipFind}=makeHarness(employer,'works',[],0,memberships);
    await service.listWorkflows(employer,'employer',{kind:'works'});
    expect(query.where).toHaveBeenCalledWith('task.companyId IN (:...companyIds)',{companyIds:['company-a','company-b']});
    expect(membershipFind).toHaveBeenCalledWith({where:{userId:employer.id,revokedAt:expect.anything()}});
    expect((query.innerJoin.mock.calls[0] as unknown[])[0]).toBe(CareerTask);
  });
  it('fails closed without company scope and rejects center workflow access',async()=>{
    const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};const empty=makeHarness(employer,'works',[],0);await empty.service.listWorkflows(employer,'employer',{kind:'works'});expect(empty.query.where).toHaveBeenCalledWith('1 = 0');
    const center={...student,id:'center-a',role:UserRole.CAREER_STAFF};const centerHarness=makeHarness(center,'works',[],0);await expect(centerHarness.service.listWorkflows(center,'center',{kind:'works'})).rejects.toThrow(ForbiddenException);
  });
  it('searches applications on task and applicant professional fields and exposes only approved exact task skills',async()=>{
    const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};const record={id:'application-a',taskId:'task-a',studentId:'student-a',state:'pending',createdAt:new Date()};const task={id:'task-a',companyId:'company-a',universityId:'university-a',profiled:true,skill:'design',title:'Design'};
    const query:any={innerJoin:jest.fn(function(){return this;}),leftJoin:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([[record],1])};
    const user={id:'student-a',firstName:'A',lastName:'B',role:UserRole.STUDENT,isActive:true};const profile={studentId:'student-a',headline:'Designer',skills:['design','writing']};const admission={studentId:'student-a',universityId:'university-a',skill:'design',basis:'center'};const profileFind=jest.fn().mockResolvedValue([profile]);const userFind=jest.fn().mockResolvedValue([user]);const admissionFind=jest.fn().mockResolvedValue([admission]);
    const getRepository=jest.fn(repo=>repo===CareerMembership?{find:jest.fn().mockResolvedValue([{companyId:'company-a',role:'company_owner'}])}:repo===CareerApplication?{createQueryBuilder:jest.fn(()=>query)}:repo===CareerTask?{find:jest.fn().mockResolvedValue([task])}:repo===CareerCompany?{find:jest.fn().mockResolvedValue([{id:'company-a',name:'Company'}])}:repo===CareerProfile?{find:profileFind}:repo===User?{find:userFind}:repo===CareerAdmission?{find:admissionFind}:{});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);const result=await service.listWorkflows(employer,'employer',{kind:'applications',q:'designer'});
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('applicantProfile.headline'),{workflowSearch:'%designer%'});expect(result.items[0]).toMatchObject({candidate:{studentId:'student-a',approvedSkills:[{skill:'design',basis:'center'}]}});
    expect(profileFind).toHaveBeenCalledWith({where:{studentId:In(['student-a'])},select:{studentId:true,headline:true,skills:true}});expect(userFind).toHaveBeenCalledWith({where:{id:In(['student-a']),role:UserRole.STUDENT,isActive:true},select:{id:true,firstName:true,lastName:true}});expect(admissionFind).toHaveBeenCalledWith({where:{studentId:In(['student-a']),universityId:In(['university-a']),state:'approved'},select:{studentId:true,universityId:true,skill:true,basis:true}});
  });
});

describe('Career center review queues',()=>{
  const center={...student,id:'center-a',role:UserRole.CAREER_STAFF};
  const makeHarness=(kind:'profiles'|'admissions',records:Array<Record<string,any>>,total:number,students:Array<Record<string,any>>=[],membershipAllowed=false)=>{
    const query:any={innerJoin:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([records,total])};
    const entity=kind==='profiles'?CareerProfile:CareerAdmission;const studentFind=jest.fn().mockResolvedValue(students);const membershipExists=jest.fn().mockResolvedValue(membershipAllowed);
    const getRepository=jest.fn(repo=>repo===CareerMembership?{existsBy:membershipExists}:repo===entity?{createQueryBuilder:jest.fn(()=>query)}:repo===User?{find:studentFind}:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,getRepository,studentFind,membershipExists};
  };
  it.each([
    {name:'empty queue',records:[],total:0,offset:'0',hasMore:false},
    {name:'100 records',records:Array.from({length:20},(_,index)=>({id:`profile-${index}`,studentId:'student-a',verification:'pending',createdAt:new Date('2026-01-01')})),total:100,offset:'80',hasMore:false},
    {name:'record beyond the former cap',records:[{id:'profile-101',studentId:'student-a',verification:'pending',createdAt:new Date('2025-01-01')}],total:101,offset:'100',hasMore:false},
  ])('paginates $name with accurate metadata',async({records,total,offset,hasMore})=>{
    const {service,query}=makeHarness('profiles',records,total,records.length?[{id:'student-a',firstName:'Ada',lastName:'Lovelace'}]:[]);
    await expect(service.listCenterReviews(center,{kind:'profiles',offset,limit:'20'})).resolves.toMatchObject({total,offset:Number(offset),limit:20,hasMore});
    expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);expect(query.orderBy).toHaveBeenCalledWith('profile.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('profile.id','DESC');
  });
  it('requires center permission before reading a queue and rejects a revoked delegated membership',async()=>{
    const teacher={...student,id:'teacher-a',role:UserRole.TEACHER};const {service,getRepository,membershipExists}=makeHarness('profiles',[],0,[],false);
    await expect(service.listCenterReviews(teacher,{kind:'profiles'})).rejects.toThrow(ForbiddenException);
    expect(membershipExists).toHaveBeenCalledWith(expect.objectContaining({userId:teacher.id,universityId:teacher.universityId,revokedAt:expect.anything()}));
    expect(getRepository).not.toHaveBeenCalledWith(CareerProfile);expect(getRepository).not.toHaveBeenCalledWith(CareerAdmission);
  });
  it('uses only the actor university and active student accounts for queue rows',async()=>{
    const records=[{id:'profile-a',studentId:'student-a',universityId:'university-a',headline:'Designer',verification:'pending',createdAt:new Date()}];const {service,query,studentFind}=makeHarness('profiles',records,1,[{id:'student-a',firstName:'Ada',lastName:'Lovelace'}]);
    const result=await service.listCenterReviews(center,{kind:'profiles',q:'Ada'});
    expect(query.where).toHaveBeenCalledWith('profile.universityId = :universityId',{universityId:'university-a'});expect(query.andWhere).toHaveBeenCalledWith('student.universityId = :universityId',{universityId:'university-a'});expect(query.andWhere).toHaveBeenCalledWith('student.role = :studentRole',{studentRole:UserRole.STUDENT});expect(query.andWhere).toHaveBeenCalledWith('student.isActive = true');expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('student.firstName'),{reviewSearch:'%ada%'});
    expect(studentFind).toHaveBeenCalledWith({where:{id:In(['student-a']),universityId:'university-a',role:UserRole.STUDENT,isActive:true},select:{id:true,firstName:true,lastName:true}});expect(result.items[0]).toMatchObject({studentName:'Ada Lovelace'});
  });
  it('returns admissions independently even when no professional profile exists',async()=>{
    const admission={id:'admission-a',studentId:'student-a',universityId:'university-a',skill:'design',evidence:'Portfolio',state:'pending',reason:'',basis:'unspecified',createdAt:new Date()};const {service,getRepository,query}=makeHarness('admissions',[admission],1,[{id:'student-a',firstName:'Ada',lastName:'Lovelace'}]);
    const result=await service.listCenterReviews(center,{kind:'admissions',state:'pending'});
    expect(result.items).toMatchObject([{id:'admission-a',skill:'design',studentName:'Ada Lovelace'}]);expect(query.where).toHaveBeenCalledWith('admission.universityId = :universityId',{universityId:'university-a'});expect(getRepository).not.toHaveBeenCalledWith(CareerProfile);
  });
  it('keeps admission decision authorization and updates its decision basis',async()=>{
    const admission={id:'admission-a',universityId:'university-a',state:'pending',basis:'unspecified',reason:''};const save=jest.fn(async value=>value);const getRepository=jest.fn(repo=>repo===CareerAdmission?{findOneBy:jest.fn().mockResolvedValue(admission),save}:{});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.decideAdmission(center,'admission-a',{decision:'approved',reason:'Проверено карьерным центром'})).resolves.toMatchObject({state:'approved',basis:'center',reason:'Проверено карьерным центром'});
    expect(save).toHaveBeenCalledWith(admission);
  });
});

describe('Career partnership pagination and eligibility',()=>{
  const center={...student,id:'center-a',role:UserRole.CAREER_STAFF};
  const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};
  const makeHarness=(actor:{id:string;email:string;role:UserRole;universityId:string|null},items:Array<Record<string,any>>,total:number,memberships:Array<Record<string,unknown>>=[])=>{
    const query:any={innerJoin:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([items,total])};
    const membershipFind=jest.fn().mockResolvedValue(memberships);
    const getRepository=jest.fn(repo=>repo===CareerMembership?{find:membershipFind,existsBy:jest.fn().mockResolvedValue(false)}:repo===CareerPartnership?{createQueryBuilder:jest.fn(()=>query)}:repo===CareerCompany?{find:jest.fn().mockResolvedValue([{id:'company-a',name:'Company A'}])}:repo===University?{find:jest.fn().mockResolvedValue([{id:'university-a',name:'University A'}])}:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,getRepository,membershipFind};
  };
  it.each([
    {name:'empty list',items:[],total:0,offset:'0',hasMore:false},
    {name:'100 partnerships',items:Array.from({length:20},(_,index)=>({id:`pair-${index}`,companyId:'company-a',universityId:'university-a',state:'pending',createdAt:new Date('2026-01-01')})),total:100,offset:'80',hasMore:false},
    {name:'partnership after record 100',items:[{id:'pair-101',companyId:'company-a',universityId:'university-a',state:'pending',createdAt:new Date('2025-01-01')}],total:101,offset:'100',hasMore:false},
  ])('returns accurate metadata for $name',async({items,total,offset,hasMore})=>{
    const {service,query}=makeHarness(center,items,total);
    await expect(service.listPartnerships(center,'center',{offset,limit:'20'})).resolves.toMatchObject({total,offset:Number(offset),limit:20,hasMore});
    expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);expect(query.orderBy).toHaveBeenCalledWith('partnership.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('partnership.id','DESC');
  });
  it('scopes center to its university and employers to active owner/member companies',async()=>{
    const centerPage=makeHarness(center,[],0);await centerPage.service.listPartnerships(center,'center',{});expect(centerPage.query.where).toHaveBeenCalledWith('partnership.universityId = :universityId',{universityId:'university-a'});
    const employerPage=makeHarness(employer,[],0,[{companyId:'company-a',role:'company_owner'},{companyId:'company-b',role:'company_member'},{companyId:'company-denied',role:'career_staff'}]);await employerPage.service.listPartnerships(employer,'employer',{});expect(employerPage.membershipFind).toHaveBeenCalledWith({where:{userId:employer.id,revokedAt:expect.anything()}});expect(employerPage.query.where).toHaveBeenCalledWith('partnership.companyId IN (:...companyIds)',{companyIds:['company-a','company-b']});
  });
  it('denies a student requesting the center queue before creating a partnership query',async()=>{
    const {service,query}=makeHarness(student,[],0);
    await expect(service.listPartnerships(student,'center',{})).rejects.toThrow(ForbiddenException);expect(query.getManyAndCount).not.toHaveBeenCalled();
  });
  it('checks the exact pair directly, including verified partnerships beyond the first 100',async()=>{
    const records=Array.from({length:101},(_,index)=>({companyId:'company-a',universityId:`university-${index}`,state:'pending'}));records.push({companyId:'company-a',universityId:'university-target',state:'verified'});
    const findOneBy=jest.fn(async(where:{companyId:string;universityId:string})=>records.find(record=>record.companyId===where.companyId&&record.universityId===where.universityId)||null);
    const getRepository=jest.fn(repo=>repo===CareerMembership?{existsBy:jest.fn().mockResolvedValue(true)}:repo===University?{existsBy:jest.fn().mockResolvedValue(true)}:repo===CareerPartnership?{findOneBy}:{});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.checkPartnershipEligibility(employer,'company-a','university-target')).resolves.toEqual({companyId:'company-a',universityId:'university-target',eligible:true,state:'verified'});
    await expect(service.checkPartnershipEligibility(employer,'company-a','university-unrelated')).resolves.toEqual({companyId:'company-a',universityId:'university-unrelated',eligible:false,state:'missing'});
    expect(findOneBy).toHaveBeenNthCalledWith(1,{companyId:'company-a',universityId:'university-target'});expect(findOneBy).toHaveBeenNthCalledWith(2,{companyId:'company-a',universityId:'university-unrelated'});
  });
  it('rejects task creation unless that exact company/university pair is verified',async()=>{
    const membershipExists=jest.fn().mockResolvedValue(true);const partnershipExists=jest.fn().mockResolvedValue(false);
    const getRepository=jest.fn(repo=>repo===CareerMembership?{existsBy:membershipExists}:repo===University?{existsBy:jest.fn().mockResolvedValue(true)}:repo===CareerPartnership?{existsBy:partnershipExists}:{});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.createTask(employer,{companyId:'company-a',universityId:'university-target',title:'A clear task',description:'A detailed description that is long enough',criteria:'An accepted result description',skill:'design',profiled:false,deadline:'2099-01-01',rewardKopecks:100,hours:2} as any)).rejects.toThrow(ForbiddenException);
    expect(partnershipExists).toHaveBeenCalledWith({companyId:'company-a',universityId:'university-target',state:'verified'});
  });
});

describe('Career selector pagination and authorization',()=>{
  const employer={...student,id:'employer-a',role:UserRole.EMPLOYER,universityId:null};
  const admin={...student,id:'center-admin',role:UserRole.CAREER_ADMIN};
  const makeQuery=(items:Array<Record<string,any>>,total:number)=>{
    const query:any={select:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([items,total])};return query;
  };
  it.each([
    {name:'zero universities',items:[],total:0,offset:'0',hasMore:false},
    {name:'page ending at 100',items:Array.from({length:20},(_,index)=>({id:`university-${index}`,name:`University ${index}`,city:'City'})),total:100,offset:'80',hasMore:false},
    {name:'university beyond the former cap',items:[{id:'university-101',name:'University 101',city:'City'}],total:101,offset:'100',hasMore:false},
  ])('returns accurate university metadata for $name',async({items,total,offset,hasMore})=>{
    const query=makeQuery(items,total);const getRepository=jest.fn(repo=>repo===University?{createQueryBuilder:jest.fn(()=>query)}:{});const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.listUniversities(employer,'employer',{offset,limit:'20'})).resolves.toMatchObject({items,total,offset:Number(offset),limit:20,hasMore});
    expect(query.where).toHaveBeenCalledWith('university.status = :status',{status:'active'});expect(query.orderBy).toHaveBeenCalledWith('university.name','ASC');expect(query.addOrderBy).toHaveBeenCalledWith('university.id','ASC');expect(query.skip).toHaveBeenCalledWith(Number(offset));
  });
  it('searches active university names/cities, returns minimal fields, and denies non-employer selector access before reads',async()=>{
    const query=makeQuery([{id:'u1',name:'North University',city:'Omsk',status:'active',connectorConfig:{secret:'omitted'}}],1);const getRepository=jest.fn(repo=>repo===University?{createQueryBuilder:jest.fn(()=>query)}:{});const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    const result=await service.listUniversities(employer,'employer',{q:' Omsk '});expect(result.items).toEqual([{id:'u1',name:'North University',city:'Omsk'}]);expect(query.andWhere).toHaveBeenCalledWith('(LOWER(university.name) LIKE :search OR LOWER(university.city) LIKE :search)',{search:'%omsk%'});
    const deniedRepo=jest.fn();const denied=new CareerService({manager:{getRepository:deniedRepo}} as unknown as DataSource,{} as AuthService);await expect(denied.listUniversities(student,'employer',{})).rejects.toThrow(ForbiddenException);await expect(denied.listUniversities({...student,role:UserRole.TEACHER},'employer',{})).rejects.toThrow(ForbiddenException);expect(deniedRepo).not.toHaveBeenCalled();
  });
  it.each([
    {name:'zero assignable staff',items:[],total:0,offset:'0',hasMore:false},
    {name:'page ending at 100',items:Array.from({length:20},(_,index)=>({id:`staff-${index}`,firstName:`Name ${index}`,lastName:'User',role:UserRole.TEACHER})),total:100,offset:'80',hasMore:false},
    {name:'staff member beyond the former cap',items:[{id:'staff-101',firstName:'Long',lastName:'List',role:UserRole.TEACHER}],total:101,offset:'100',hasMore:false},
  ])('returns accurate staff metadata for $name',async({items,total,offset,hasMore})=>{
    const query=makeQuery(items,total);const getRepository=jest.fn(repo=>repo===User?{createQueryBuilder:jest.fn(()=>query)}:{});const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.listAssignableStaff(admin,{offset,limit:'20'})).resolves.toMatchObject({items,total,offset:Number(offset),limit:20,hasMore});
    expect(query.where).toHaveBeenCalledWith('user.universityId = :universityId',{universityId:admin.universityId});expect(query.andWhere).toHaveBeenNthCalledWith(1,'user.isActive = true');expect(query.andWhere).toHaveBeenNthCalledWith(2,'user.role NOT IN (:...blockedRoles)',{blockedRoles:[UserRole.STUDENT,UserRole.EMPLOYER,UserRole.DEVELOPER,UserRole.SUPERADMIN]});expect(query.orderBy).toHaveBeenCalledWith('user.lastName','ASC');expect(query.addOrderBy).toHaveBeenCalledWith('user.firstName','ASC');expect(query.addOrderBy).toHaveBeenCalledWith('user.id','ASC');
  });
  it('requires strict center-admin access before querying users; career staff cannot promote themselves or others',async()=>{
    const query=makeQuery([],0);const membershipExists=jest.fn().mockResolvedValue(false);const getRepository=jest.fn(repo=>repo===CareerMembership?{existsBy:membershipExists}:repo===User?{createQueryBuilder:jest.fn(()=>query)}:{});const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    const delegated={...student,id:'delegated-staff',role:UserRole.CAREER_STAFF};
    await expect(service.listAssignableStaff(delegated,{})).rejects.toThrow(ForbiddenException);expect(getRepository).toHaveBeenCalledWith(CareerMembership);expect(membershipExists).toHaveBeenCalledWith({userId:delegated.id,universityId:delegated.universityId,role:In(['career_admin']),revokedAt:expect.anything()});expect(getRepository).not.toHaveBeenCalledWith(User);
    await expect(service.addMembership(delegated,{userId:'target',role:'career_admin'} as any)).rejects.toThrow(ForbiddenException);expect(getRepository).not.toHaveBeenCalledWith(User);
  });
  it('keeps staff lookup constrained to active same-university accounts and searches names',async()=>{
    const query=makeQuery([],0);const getRepository=jest.fn(repo=>repo===User?{createQueryBuilder:jest.fn(()=>query)}:{});const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await service.listAssignableStaff(admin,{q:'Ada Lovelace'});expect(query.where).toHaveBeenCalledWith('user.universityId = :universityId',{universityId:admin.universityId});expect(query.andWhere).toHaveBeenCalledWith('(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search)',{search:'%ada lovelace%'});
  });
});

describe('Career student admissions and portfolio',()=>{
  const makeAdmissionHarness=(items:Array<Record<string,any>>,total:number,approved:Array<{skill:string}>=[])=>{
    const query:any={where:jest.fn(function(){return this;}),andWhere:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([items,total])};
    const find=jest.fn().mockResolvedValue(approved);const getRepository=jest.fn(entity=>entity===CareerAdmission?{createQueryBuilder:jest.fn(()=>query),find}:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),query,find,getRepository};
  };
  it.each([
    {name:'empty admissions',items:[],total:0,offset:'0',hasMore:false},
    {name:'page ending at 100',items:Array.from({length:20},(_,i)=>({id:`admission-${i}`,skill:'design',evidence:'Proof',state:'approved',reason:'Verified',createdAt:new Date()})),total:100,offset:'80',hasMore:false},
    {name:'continuation after 100',items:Array.from({length:20},(_,i)=>({id:`admission-${i}`,skill:'design',evidence:'Proof',state:'pending',reason:'',createdAt:new Date()})),total:101,offset:'80',hasMore:true},
    {name:'record after 100',items:[{id:'admission-101',skill:'backend',evidence:'Proof',state:'approved',reason:'',createdAt:new Date()}],total:101,offset:'100',hasMore:false},
  ])('returns $name with full approved skill authority',async({items,total,offset,hasMore})=>{
    const {service,query,find}=makeAdmissionHarness(items,total,[{skill:'design'},{skill:'backend'},{skill:'design'}]);
    const result=await service.listStudentAdmissions(student,{offset,limit:'20'});
    expect(result).toMatchObject({items,total,offset:Number(offset),limit:20,hasMore,approvedSkills:['backend','design']});
    expect(query.where).toHaveBeenCalledWith('admission.studentId = :studentId AND admission.universityId = :universityId',{studentId:student.id,universityId:student.universityId});
    expect(query.orderBy).toHaveBeenCalledWith('admission.createdAt','DESC');expect(query.addOrderBy).toHaveBeenCalledWith('admission.id','DESC');expect(query.skip).toHaveBeenCalledWith(Number(offset));expect(query.take).toHaveBeenCalledWith(20);
    expect(find).toHaveBeenCalledWith({where:{studentId:student.id,universityId:student.universityId,state:'approved'},select:{skill:true}});
  });
  it('searches and filters admission items, but denies other roles before admission reads',async()=>{
    const {service,query}=makeAdmissionHarness([],0);await service.listStudentAdmissions(student,{q:' Design ',state:'pending'});
    expect(query.andWhere).toHaveBeenNthCalledWith(1,'admission.state = :state',{state:'pending'});expect(query.andWhere).toHaveBeenNthCalledWith(2,'(LOWER(admission.skill) LIKE :search OR LOWER(admission.evidence) LIKE :search)',{search:'%design%'});
    const getRepository=jest.fn();const denied=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);await expect(denied.listStudentAdmissions({...student,role:UserRole.TEACHER},{})).rejects.toThrow(ForbiddenException);expect(getRepository).not.toHaveBeenCalled();
  });
  it('returns only accepted reviewed cases and uses the filtered whole-set page count',async()=>{
    const portfolio={id:'portfolio-1',studentId:student.id,workId:'work-1',published:false,caseText:'Case',createdAt:new Date()};
    const pageQuery:any={innerJoin:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getManyAndCount:jest.fn().mockResolvedValue([[portfolio],101])};
    const workFind=jest.fn().mockResolvedValue([{id:'work-1',studentId:student.id,taskId:'task-1',state:'accepted',submission:'Result',resultUrl:''}]);
    const taskFind=jest.fn().mockResolvedValue([{id:'task-1',title:'Task',skill:'design',companyId:'company-1'}]);const companyFind=jest.fn().mockResolvedValue([{id:'company-1',name:'Company'}]);const review={id:'review-1',workId:'work-1',rating:5,body:'Good'};const reviewFind=jest.fn().mockResolvedValue([review]);const countBy=jest.fn().mockResolvedValue(101);
    const aggregate:any={innerJoin:jest.fn(function(){return this;}),select:jest.fn(function(){return this;}),addSelect:jest.fn(function(){return this;}),getRawOne:jest.fn().mockResolvedValue({reviewCount:'80',averageRating:'4.25'})};
    const getRepository=jest.fn(entity=>entity===CareerPortfolio?{createQueryBuilder:jest.fn(()=>pageQuery)}:entity===CareerWork?{find:workFind,countBy}:entity===CareerTask?{find:taskFind}:entity===CareerCompany?{find:companyFind}:entity===CareerReview?{find:reviewFind,createQueryBuilder:jest.fn(()=>aggregate)}:{});
    const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    const result=await service.listStudentPortfolio(student,{offset:'0',limit:'1'});
    expect(result).toMatchObject({total:101,offset:0,limit:1,hasMore:true,stats:{acceptedWorks:101,reviewCount:80,averageRating:4.25},items:[{portfolio,work:{id:'work-1'},task:{id:'task-1',title:'Task',skill:'design',company:{id:'company-1',name:'Company'}},review}]});
    expect(pageQuery.innerJoin).toHaveBeenNthCalledWith(1,CareerWork,'work','work.id = portfolio.workId AND work.studentId = :studentId AND work.state = :accepted',{studentId:student.id,accepted:'accepted'});expect(pageQuery.innerJoin).toHaveBeenNthCalledWith(3,CareerReview,'review','review.workId = work.id');
    expect(pageQuery.where).toHaveBeenCalledWith('portfolio.studentId = :studentId',{studentId:student.id});expect(pageQuery.orderBy).toHaveBeenCalledWith('portfolio.createdAt','DESC');expect(pageQuery.addOrderBy).toHaveBeenCalledWith('portfolio.id','DESC');expect(pageQuery.skip).toHaveBeenCalledWith(0);expect(pageQuery.take).toHaveBeenCalledWith(1);expect(countBy).toHaveBeenCalledWith({studentId:student.id,state:'accepted'});
    expect(aggregate.innerJoin).toHaveBeenCalledWith(CareerWork,'work','work.id = review.workId AND work.studentId = :studentId AND work.state = :accepted',{studentId:student.id,accepted:'accepted'});
  });
  it('computes review count and average across the full own accepted set, not just the loaded page',async()=>{
    const portfolioQuery:any={innerJoin(){return this;},where(){return this;},orderBy(){return this;},addOrderBy(){return this;},skip(){return this;},take(){return this;},getManyAndCount:jest.fn().mockResolvedValue([[],100])};
    const getRepository=jest.fn(entity=>entity===CareerPortfolio?{createQueryBuilder:jest.fn(()=>portfolioQuery)}:entity===CareerWork?{countBy:jest.fn().mockResolvedValue(100)}:entity===CareerReview?{find:jest.fn(),createQueryBuilder:jest.fn(()=>({innerJoin(){return this;},select(){return this;},addSelect(){return this;},getRawOne:jest.fn().mockResolvedValue({reviewCount:'80',averageRating:'4.25'})}))}:{});
    const result=await new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService).listStudentPortfolio(student,{offset:'100'});
    expect(result.stats).toEqual({acceptedWorks:100,reviewCount:80,averageRating:4.25});expect(result.items).toEqual([]);
  });
  it('returns a null average when the full accepted set has no reviews',async()=>{
    const portfolioQuery:any={innerJoin(){return this;},where(){return this;},orderBy(){return this;},addOrderBy(){return this;},skip(){return this;},take(){return this;},getManyAndCount:jest.fn().mockResolvedValue([[],0])};
    const getRepository=jest.fn(entity=>entity===CareerPortfolio?{createQueryBuilder:jest.fn(()=>portfolioQuery)}:entity===CareerWork?{countBy:jest.fn().mockResolvedValue(3)}:entity===CareerReview?{find:jest.fn(),createQueryBuilder:jest.fn(()=>({innerJoin(){return this;},select(){return this;},addSelect(){return this;},getRawOne:jest.fn().mockResolvedValue({reviewCount:'0',averageRating:null})}))}:{});
    const result=await new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService).listStudentPortfolio(student,{});
    expect(result.stats).toEqual({acceptedWorks:3,reviewCount:0,averageRating:null});expect(result.total).toBe(0);
  });
  it('denies non-students before reading private portfolio records',async()=>{
    const getRepository=jest.fn();const service=new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService);
    await expect(service.listStudentPortfolio({...student,role:UserRole.TEACHER},{})).rejects.toThrow(ForbiddenException);expect(getRepository).not.toHaveBeenCalled();
  });
});

describe('Career public portfolio cases',()=>{
  const studentId='public-student';
  const row={portfolio_id:'portfolio-101',portfolio_case_text:'Published case',portfolio_created_at:new Date(),work_id:'work-101',work_submission:'Accepted result',work_result_url:'https://example.test/result',task_id:'task-101',task_title:'Task',task_skill:'design',company_id:'company-1',company_name:'Company',review_id:'review-101',review_body:'Review',review_rating:5};
  const makeBuilder=(rows:Array<Record<string,any>>,total:number)=>{
    const query:any={innerJoin:jest.fn(function(){return this;}),where:jest.fn(function(){return this;}),select:jest.fn(function(){return this;}),orderBy:jest.fn(function(){return this;}),addOrderBy:jest.fn(function(){return this;}),skip:jest.fn(function(){return this;}),take:jest.fn(function(){return this;}),getRawMany:jest.fn().mockResolvedValue(rows),getCount:jest.fn().mockResolvedValue(total)};return query;
  };
  const makeHarness=(rows:Array<Record<string,any>>,total:number,user:any={id:studentId,firstName:'Ada',lastName:'Lovelace'})=>{
    const queries:Array<any>=[];const userFind=jest.fn().mockResolvedValue(user);const getRepository=jest.fn(entity=>entity===User?{findOne:userFind}:entity===CareerPortfolio?{createQueryBuilder:jest.fn(()=>{const query=makeBuilder(rows,total);queries.push(query);return query;})}:{});
    return {service:new CareerService({manager:{getRepository}} as unknown as DataSource,{} as AuthService),queries,getRepository,userFind};
  };
  it.each([
    {name:'empty visible cases',rows:[],total:0,offset:'0',hasMore:false},
    {name:'page ending at 100',rows:Array.from({length:20},(_,i)=>({...row,portfolio_id:`portfolio-${i}`})),total:100,offset:'80',hasMore:false},
    {name:'continuation past 100',rows:Array.from({length:20},(_,i)=>({...row,portfolio_id:`portfolio-${i}`})),total:101,offset:'80',hasMore:true},
    {name:'case beyond 100',rows:[row],total:101,offset:'100',hasMore:false},
  ])('returns paginated $name after eligibility filters',async({rows,total,offset,hasMore})=>{
    const {service,queries,userFind}=makeHarness(rows,total);
    if(total===0){await expect(service.publicPortfolioCases(studentId,{offset,limit:'20'})).rejects.toThrow(NotFoundException);return;}
    const result=await service.publicPortfolioCases(studentId,{offset,limit:'20'});
    expect(result).toMatchObject({name:'Ada Lovelace',total,offset:Number(offset),limit:20,hasMore});
    expect(userFind).toHaveBeenCalledWith({where:{id:studentId,isActive:true,role:UserRole.STUDENT},select:{id:true,firstName:true,lastName:true}});
    expect(queries).toHaveLength(2);for(const query of queries){expect(query.where).toHaveBeenCalledWith('portfolio.studentId = :studentId AND portfolio.published = :published',{studentId,published:true});expect(query.innerJoin).toHaveBeenNthCalledWith(1,CareerWork,'work','work.id = portfolio.workId AND work.studentId = portfolio.studentId AND work.state = :accepted',{accepted:'accepted'});expect(query.innerJoin).toHaveBeenNthCalledWith(4,CareerReview,'review','review.workId = work.id AND review.publishAllowed = :publishAllowed',{publishAllowed:true});}
    expect(queries[0].orderBy).toHaveBeenCalledWith('portfolio.createdAt','DESC');expect(queries[0].addOrderBy).toHaveBeenCalledWith('portfolio.id','DESC');expect(queries[0].skip).toHaveBeenCalledWith(Number(offset));
    const firstRow=rows[0];expect(result.cases[0]).toEqual({portfolio:{id:firstRow.portfolio_id,caseText:firstRow.portfolio_case_text,createdAt:firstRow.portfolio_created_at},work:{id:firstRow.work_id,submission:firstRow.work_submission,resultUrl:firstRow.work_result_url},task:{id:firstRow.task_id,title:firstRow.task_title,skill:firstRow.task_skill,company:{id:firstRow.company_id,name:firstRow.company_name}},review:{id:firstRow.review_id,body:firstRow.review_body,rating:5}});
    expect(JSON.stringify(result)).not.toMatch(/university|studentId|email|decisionReason|criteria/i);
  });
  it('returns the same not-found outcome for missing/inactive users and users without consented accepted cases',async()=>{
    const missing=makeHarness([],0,null);const missingError=await missing.service.publicPortfolioCases(studentId,{}).catch(error=>error);expect(missingError).toBeInstanceOf(NotFoundException);
    const inactive=makeHarness([],0,null);const inactiveError=await inactive.service.publicPortfolioCases(studentId,{}).catch(error=>error);expect(inactiveError).toBeInstanceOf(NotFoundException);
    const noCases=makeHarness([],0);const hiddenError=await noCases.service.publicPortfolioCases(studentId,{}).catch(error=>error);expect(hiddenError).toBeInstanceOf(NotFoundException);
    expect(missingError.message).toBe(inactiveError.message);expect(missingError.message).toBe(hiddenError.message);
  });
});
