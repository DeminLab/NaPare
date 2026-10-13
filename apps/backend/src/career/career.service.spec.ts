import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/interfaces/user-role';
import { CareerService, assertCareerResultUrl, assertCareerTransition } from './career.service';
import { CareerTask, CareerProfile, CareerMembership, CareerAdmission, CareerTest, CareerPortfolio, CareerWork, CareerReview } from './career.entities';

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
