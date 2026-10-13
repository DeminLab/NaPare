import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/interfaces/user-role';
import { requireUniversityId } from '../common/tenant/require-university';
import { ScheduleService } from '../schedule/schedule.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CareerAvailability, CareerWork, CareerTask, CareerProfile, CareerAdmission, CareerPortfolio } from './career.entities';
import { CareerAvailabilityDto } from './career.dto';

type Interval=[number,number];
export function mergeIntervals(intervals:Interval[]):Interval[] {
  const result:Interval[]=[];
  for(const interval of [...intervals].sort((a,b)=>a[0]-b[0])){const last=result.at(-1);if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else result.push([...interval]);}
  return result;
}
export function freeMinutes(windows:Interval[], busy:Interval[]):number {
  const blocked=mergeIntervals(busy);let total=0;
  for(const [start,end] of mergeIntervals(windows)){total+=end-start;for(const [a,b] of blocked)total-=Math.max(0,Math.min(end,b)-Math.max(start,a));}
  return Math.max(0,total);
}
function minute(value:string){const [h,m]=value.split(':').map(Number);return h*60+m;}
function dateKey(value:Date,zone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function addDays(value:string,days:number){const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function validateAvailability(dto:CareerAvailabilityDto):void {
  try{new Intl.DateTimeFormat('en',{timeZone:dto.timeZone}).format(new Date());}catch{throw new BadRequestException('Укажите действующий часовой пояс');}
  if(dto.windows.some(w=>minute(w.start)>=minute(w.end)))throw new BadRequestException('Конец рабочего окна должен быть позже начала. Ночные окна разделите на два дня.');
  for(const range of dto.blockedDates){if(![range.start,range.end].every(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value)||range.end<range.start)throw new BadRequestException('Укажите существующие даты и правильный порядок периода');}
}
export type FitResult={taskId:string;canApply:boolean;fit:'fits'|'tight'|'unknown'|'blocked';reasons:string[];availableHours:number|null;level:string};
export function assessTask(task:Pick<CareerTask,'id'|'hours'|'deadline'|'profiled'|'skill'|'level'>,context:{verified:boolean;skills:string[];activeCount:number;budget:number|null;reservedHours:number;days:Array<{date:string;minutes:number}>;scheduleKnown:boolean;serverToday:string}):FitResult {
  const reasons:string[]=[];let canApply=true;
  if(!context.verified){canApply=false;reasons.push('Сначала подтвердите профессиональный профиль в карьерном центре.');}
  if(task.profiled&&!context.skills.includes(task.skill)){canApply=false;reasons.push('Нужен подтверждённый допуск: '+task.skill+'.');}else reasons.push(task.profiled?'Допуск к направлению подтверждён.':'Профильный допуск для этой задачи не требуется.');
  if(context.activeCount>=3){canApply=false;reasons.push('У вас три активные работы — сначала завершите одну.');}
  if(task.deadline<context.serverToday){canApply=false;reasons.push('Срок задачи истёк.');}
  const windowHours=context.days.filter(day=>day.date<=task.deadline).reduce((sum,day)=>sum+day.minutes,0)/60;
  const availableHours=context.budget===null||!context.scheduleKnown?null:Math.floor(Math.max(0,Math.min(context.budget,windowHours)-context.reservedHours)*10)/10;
  let fit:FitResult['fit']=!canApply?'blocked':availableHours===null?'unknown':task.hours<=availableHours?'fits':'tight';
  if(availableHours===null)reasons.push(context.budget===null?'Укажите рабочие окна и бюджет времени.':'Расписание не подтверждено: совместимость по времени неизвестна.');
  else reasons.push(`До срока в пределах ближайших 7 дней оценочно доступно ${availableHours} ч.; задача заявлена на ${task.hours} ч.`);
  if(context.reservedHours)reasons.push(`Под активные работы зарезервирован весь заявленный объём: ${context.reservedHours} ч. Прогресс выполнения не известен.`);
  if(task.level==='starter')reasons.push('Работодатель отметил задачу как стартовую. Проверьте требования.');
  return {taskId:task.id,canApply,fit,reasons,availableHours,level:task.level};
}
@Injectable()
export class CareerPlanningService {
  constructor(private readonly db:DataSource,private readonly schedule:ScheduleService){}
  private student(actor:AuthenticatedUser){if(actor.role!==UserRole.STUDENT)throw new ForbiddenException('Планирование доступно только самому студенту');return requireUniversityId(actor);}
  async save(actor:AuthenticatedUser,dto:CareerAvailabilityDto){const universityId=this.student(actor);validateAvailability(dto);return this.db.getRepository(CareerAvailability).save({...dto,studentId:actor.id,universityId});}
  async get(actor:AuthenticatedUser){
    const universityId=this.student(actor);
    const [availability,profile,admissions,works,tasks,acceptedCount,portfolioCount]=await Promise.all([
      this.db.getRepository(CareerAvailability).findOneBy({studentId:actor.id,universityId}),
      this.db.getRepository(CareerProfile).findOneBy({studentId:actor.id,universityId}),
      this.db.getRepository(CareerAdmission).find({where:{studentId:actor.id,universityId,state:'approved'}}),
      this.db.getRepository(CareerWork).find({where:{studentId:actor.id,state:In(['in_progress','revision','submitted'])}}),
      this.db.getRepository(CareerTask).find({where:{universityId,state:'open'},order:{createdAt:'DESC'},take:100}),
      this.db.getRepository(CareerWork).countBy({studentId:actor.id,state:'accepted'}),
      this.db.getRepository(CareerPortfolio).countBy({studentId:actor.id}),
    ]);
    const activeTasks=works.length?await this.db.getRepository(CareerTask).find({where:{id:In(works.map(w=>w.taskId)),universityId}}):[];
    const reservedHours=activeTasks.reduce((sum,task)=>sum+task.hours,0);
    const zone=availability?.timeZone||'Asia/Omsk';const today=dateKey(new Date(),zone);const end=addDays(today,6);
    let scheduleStatus:'not_set'|'no_group'|'empty'|'loaded'|'unavailable'=!availability?'not_set':!actor.groupId?'no_group':'loaded';
    const lessons:Array<{date:string;start:string;end:string}>=[];
    if(scheduleStatus==='loaded')try{
      const pagination=new PaginationQueryDto();pagination.limit=100;
      const result=await this.schedule.findForStudentDateRange(universityId,actor.groupId,today,end,pagination);
      if(result.meta.totalPages>10)throw new Error('Schedule exceeds planning limit');
      const all=[...result.data];
      for(let page=2;page<=result.meta.totalPages;page++){pagination.page=page;all.push(...(await this.schedule.findForStudentDateRange(universityId,actor.groupId,today,end,pagination)).data);}
      for(const lesson of all){const date=new Date(lesson.startDate).toISOString().slice(0,10);if(/^\d{2}:\d{2}/.test(lesson.startTime)&&/^\d{2}:\d{2}/.test(lesson.endTime)&&minute(lesson.endTime)>minute(lesson.startTime))lessons.push({date,start:lesson.startTime,end:lesson.endTime});else throw new Error('Invalid lesson times');}
      if(!lessons.length)scheduleStatus='empty';
    }catch{scheduleStatus='unavailable';lessons.length=0;}
    const currentParts=new Intl.DateTimeFormat('en',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const current=Object.fromEntries(currentParts.map(p=>[p.type,p.value]));
    const days=Array.from({length:7},(_,index)=>{const date=addDays(today,index);const day=new Date(date+'T12:00:00Z').getUTCDay();const blocked=availability?.blockedDates.some(range=>date>=range.start&&date<=range.end);
      const windows:Interval[]=blocked?[]:(availability?.windows.filter(w=>w.day===day).map(w=>[minute(w.start),minute(w.end)] as Interval)||[]);
      const busy:Interval[]=lessons.filter(lesson=>lesson.date===date).map(lesson=>[minute(lesson.start),minute(lesson.end)]);
      if(index===0)busy.push([0,Number(current.hour)*60+Number(current.minute)]);
      return {date,minutes:freeMinutes(windows,busy),lessonCount:lessons.filter(lesson=>lesson.date===date).length,blocked:Boolean(blocked)};
    });
    const fits=tasks.map(task=>assessTask(task,{verified:profile?.verification==='verified',skills:admissions.map(a=>a.skill),activeCount:works.length,budget:availability?.weeklyHours??null,reservedHours,days,scheduleKnown:scheduleStatus==='loaded',serverToday:new Date().toISOString().slice(0,10)}));
    return {availability,range:{start:today,end,timeZone:zone},scheduleStatus,days,reservedHours,activeCount:works.length,acceptedCount,portfolioCount,hasProfile:Boolean(profile),profileVerified:profile?.verification==='verified',admissionCount:admissions.length,fits};
  }
}
