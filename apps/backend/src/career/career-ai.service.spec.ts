import { BadGatewayException, ForbiddenException, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CareerAiService, validateAiSuggestion } from './career-ai.service';
import { CareerService } from './career.service';
import { UserRole } from '../auth/interfaces/user-role';
const actor={id:'owner',role:UserRole.EMPLOYER,universityId:null,email:'owner@test'};
const draft={title:'Подготовить каталог',description:'Описать товары по предоставленным материалам.',criteria:'Все товары имеют проверенное описание.',questions:['Сколько товаров?']};
function setup(configured=true,counts=[0,0]) {
  const settings:Record<string,string>=configured?{CAREER_AI_BASE_URL:'https://provider.example/v1',CAREER_AI_API_KEY:'private-test-key',CAREER_AI_MODEL:'selected-model',CAREER_AI_PROVIDER_LABEL:'Тестовый провайдер'}:{};
  const repository={countBy:jest.fn().mockImplementation(async()=>counts.shift()??0),save:jest.fn().mockResolvedValue({id:'request'}),update:jest.fn().mockResolvedValue({affected:1})};
  const query=jest.fn().mockResolvedValue([]);
  const db={transaction:jest.fn(async callback=>callback({query,getRepository:()=>repository})),getRepository:()=>repository};
  const source={title:'Задача',criteria:'Критерии',result:'Принятый результат',review:'Отзыв работодателя'};
  const career={assertCompanyAccess:jest.fn().mockResolvedValue(undefined),portfolioSource:jest.fn().mockResolvedValue(source)};
  const service=new CareerAiService({get:(key:string)=>settings[key]} as ConfigService,db as unknown as DataSource,career as unknown as CareerService);
  return {service,career,repository,db,settings,query};
}
describe('Career AI boundaries and contract',()=>{
  afterEach(()=>jest.restoreAllMocks());
  it('returns disabled status without a provider and never calls upstream',async()=>{const {service,db}=setup(false);const send=jest.spyOn(global,'fetch');expect(service.status()).toEqual({configured:false,providerLabel:null,userDailyLimit:20});await expect(service.task(actor,{companyId:'company',brief:'Описание задачи',consent:true})).rejects.toThrow(ServiceUnavailableException);expect(send).not.toHaveBeenCalled();expect(db.transaction).not.toHaveBeenCalled();});
  it('checks company access before transmitting text',async()=>{const {service,career}=setup();career.assertCompanyAccess.mockRejectedValue(new ForbiddenException());const send=jest.spyOn(global,'fetch');await expect(service.task(actor,{companyId:'foreign',brief:'private',consent:true})).rejects.toThrow(ForbiddenException);expect(send).not.toHaveBeenCalled();});
  it('requires explicit consent even for an owner',async()=>{const {service}=setup();const send=jest.spyOn(global,'fetch');await expect(service.task(actor,{companyId:'company',brief:'private',consent:false})).rejects.toThrow(ForbiddenException);expect(send).not.toHaveBeenCalled();});
  it('status does not expose credentials, model or URL',()=>{const {service}=setup();const status=JSON.stringify(service.status());expect(status).not.toContain('private-test-key');expect(status).not.toContain('provider.example');expect(status).not.toContain('selected-model');});
  it('does not configure HTTP or credential-bearing endpoints',()=>{const {service,settings}=setup();settings.CAREER_AI_BASE_URL='http://provider.example/v1';expect(service.status().configured).toBe(false);settings.CAREER_AI_BASE_URL='https://user:secret@provider.example';expect(service.status().configured).toBe(false);});
  it('reserves a daily quota and sends only the chosen brief',async()=>{const {service,repository,query}=setup();const send=jest.spyOn(global,'fetch').mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]}));const response=await service.task(actor,{companyId:'company',brief:'Каталог из материалов компании',consent:true});expect(response.suggestion).toEqual(draft);expect(query).toHaveBeenCalled();const request=JSON.parse((send.mock.calls[0][1] as RequestInit).body as string);expect(JSON.parse(request.messages[1].content)).toEqual({brief:'Каталог из материалов компании'});expect(request.max_completion_tokens).toBe(1600);expect(repository.update).toHaveBeenCalledWith('request',{state:'success'});});
  it.each([[20,0],[0,200]])('enforces user and service quotas before an upstream request (%i,%i)',async(user,all)=>{const {service}=setup(true,[user,all]);const send=jest.spyOn(global,'fetch');await expect(service.task(actor,{companyId:'company',brief:'Описание',consent:true})).rejects.toBeInstanceOf(HttpException);expect(send).not.toHaveBeenCalled();});
  it('rejects truncated JSON output and records failure',async()=>{const {service,repository}=setup();jest.spyOn(global,'fetch').mockResolvedValue(Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}));await expect(service.task(actor,{companyId:'company',brief:'Описание',consent:true})).rejects.toThrow(BadGatewayException);expect(repository.update).toHaveBeenCalledWith('request',{state:'failed'});});
  it('does not leak an upstream error body',async()=>{const {service}=setup();jest.spyOn(global,'fetch').mockResolvedValue(new Response('private provider details',{status:401}));await expect(service.task(actor,{companyId:'company',brief:'Описание',consent:true})).rejects.toThrow('Провайдер ИИ временно недоступен');});
  it('requires an owned accepted portfolio before generating a case',async()=>{const {service,career}=setup();career.portfolioSource.mockRejectedValue(new ForbiddenException());const send=jest.spyOn(global,'fetch');await expect(service.portfolio(actor,'foreign',true)).rejects.toThrow(ForbiddenException);expect(send).not.toHaveBeenCalled();});
  it('sends only the curated accepted-work fields for a case',async()=>{const {service}=setup();const send=jest.spyOn(global,'fetch').mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'Описание принятого результата',questions:[]})}}]}));await service.portfolio(actor,'case',true);const request=JSON.parse(send.mock.calls[0][1]!.body as string);expect(Object.keys(JSON.parse(request.messages[1].content))).toEqual(['title','criteria','result','review']);});
  it('drops unrequested fields and rejects invalid shapes',()=>{expect(validateAiSuggestion('task',{...draft,rewardKopecks:1,selectedStudent:'foreign'})).toEqual(draft);for(const value of [null,[],{}, {...draft,questions:'bad'},{...draft,title:'x'}])expect(()=>validateAiSuggestion('task',value)).toThrow(BadGatewayException);});
});
