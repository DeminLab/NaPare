import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { ScheduleService } from '../schedule/schedule.service';
import { CareerAvailability, CareerProfile, CareerAdmission, CareerWork, CareerTask, CareerPortfolio } from './career.entities';
import { assessTask, CareerPlanningService, freeMinutes, mergeIntervals, validateAvailability } from './career-planning.service';
const task={id:'task',hours:3,deadline:'2099-12-01',profiled:true,skill:'design',level:'starter'};
const context={verified:true,skills:['design'],activeCount:0,budget:8,reservedHours:2,days:[{date:'2026-10-14',minutes:360}],scheduleKnown:true,serverToday:'2026-10-13'};
describe('Career planning rules',()=>{
  it('merges overlapping work and lesson intervals without double counting',()=>{expect(mergeIntervals([[10,50],[20,70],[90,100]])).toEqual([[10,70],[90,100]]);expect(freeMinutes([[0,120],[60,180]],[[30,90],[60,120]])).toBe(90);});
  it('does not subtract classes outside selected windows',()=>{expect(freeMinutes([[600,720]],[[480,540],[750,840]])).toBe(120);expect(freeMinutes([[600,720]],[[590,730]])).toBe(0);});
  it('uses the smaller of declared budget and windows, then reserves active work',()=>{expect(assessTask(task,context)).toMatchObject({canApply:true,fit:'fits',availableHours:4});expect(assessTask({...task,hours:5},context)).toMatchObject({canApply:true,fit:'tight',availableHours:4});});
  it('respects deadlines within the seven-day horizon',()=>{expect(assessTask({...task,deadline:'2026-10-13'},context)).toMatchObject({canApply:true,fit:'tight',availableHours:0});});
  it('does not claim free time when settings or schedule are missing',()=>{expect(assessTask(task,{...context,budget:null})).toMatchObject({fit:'unknown',availableHours:null});expect(assessTask(task,{...context,scheduleKnown:false})).toMatchObject({fit:'unknown',availableHours:null});});
  it.each([{verified:false},{skills:[]},{activeCount:3},{serverToday:'2100-01-01'}])('shows a concrete access blocker without computing a student score (%j)',change=>{expect(assessTask(task,{...context,...change})).toMatchObject({canApply:false,fit:'blocked'});});
  it('allows nonprofile tasks without inventing a skill admission',()=>{expect(assessTask({...task,profiled:false},{...context,skills:[]})).toMatchObject({canApply:true,fit:'fits'});});
  it('rejects invalid timezone, reversed windows and impossible block dates',()=>{const dto={weeklyHours:8,timeZone:'Asia/Omsk',windows:[{day:1,start:'18:00',end:'20:00'}],blockedDates:[]};expect(()=>validateAvailability(dto)).not.toThrow();for(const bad of [{...dto,timeZone:'invalid'},{...dto,windows:[{day:1,start:'20:00',end:'18:00'}]},{...dto,blockedDates:[{start:'2026-02-30',end:'2026-03-02'}]}])expect(()=>validateAvailability(bad)).toThrow(BadRequestException);});
});
describe('Career planning privacy',()=>{
  it('rejects employers before any schedule or availability read',async()=>{const getRepository=jest.fn();const schedule={findForStudentDateRange:jest.fn()};const service=new CareerPlanningService({getRepository} as unknown as DataSource,schedule as unknown as ScheduleService);await expect(service.get({id:'e',role:UserRole.EMPLOYER,universityId:null,email:'e@test'})).rejects.toThrow(ForbiddenException);expect(getRepository).not.toHaveBeenCalled();expect(schedule.findForStudentDateRange).not.toHaveBeenCalled();});
  it('returns unknown when the own schedule fails and never leaks lesson subjects',async()=>{
    const actor={id:'student',universityId:'uni',role:UserRole.STUDENT,email:'s@test',groupId:'own-group'};
    const availability={weeklyHours:8,timeZone:'Asia/Omsk',windows:[{day:1,start:'18:00',end:'20:00'}],blockedDates:[]};
    const getRepository=jest.fn(entity=>entity===CareerAvailability?{findOneBy:jest.fn().mockResolvedValue(availability)}:entity===CareerProfile?{findOneBy:jest.fn().mockResolvedValue({verification:'verified'})}:entity===CareerAdmission?{find:jest.fn().mockResolvedValue([{skill:'design'}])}:entity===CareerWork?{find:jest.fn().mockResolvedValue([]),countBy:jest.fn().mockResolvedValue(0)}:entity===CareerTask?{find:jest.fn().mockResolvedValue([task])}:entity===CareerPortfolio?{countBy:jest.fn().mockResolvedValue(0)}:{});
    const schedule={findForStudentDateRange:jest.fn().mockRejectedValue(new Error('upstream private details'))};
    const service=new CareerPlanningService({getRepository} as unknown as DataSource,schedule as unknown as ScheduleService);
    const result=await service.get(actor);expect(result.scheduleStatus).toBe('unavailable');expect(result.fits[0].fit).toBe('unknown');expect(schedule.findForStudentDateRange.mock.calls[0].slice(0,2)).toEqual(['uni','own-group']);expect(JSON.stringify(result)).not.toContain('upstream private details');
  });
});


describe('Planning calendar and unavailable periods',()=>{
  afterEach(()=>jest.useRealTimers());
  it('cuts elapsed time, blocks inclusive dates and exposes no lesson details',async()=>{
    jest.useFakeTimers({now:new Date('2026-10-13T08:00:00Z')});
    const availability={weeklyHours:8,timeZone:'Asia/Omsk',windows:[{day:2,start:'12:00',end:'18:00'},{day:3,start:'12:00',end:'18:00'}],blockedDates:[{start:'2026-10-14',end:'2026-10-14'}]};
    const getRepository=jest.fn(entity=>entity===CareerAvailability?{findOneBy:jest.fn().mockResolvedValue(availability)}:entity===CareerProfile?{findOneBy:jest.fn().mockResolvedValue({verification:'verified'})}:entity===CareerAdmission?{find:jest.fn().mockResolvedValue([{skill:'design'}])}:entity===CareerWork?{find:jest.fn().mockResolvedValue([]),countBy:jest.fn().mockResolvedValue(0)}:entity===CareerTask?{find:jest.fn().mockResolvedValue([task])}:{countBy:jest.fn().mockResolvedValue(0)});
    const schedule={findForStudentDateRange:jest.fn().mockResolvedValue({data:[{startDate:new Date('2026-10-13T14:00:00Z'),startTime:'14:00',endTime:'15:00',subject:'PRIVATE SUBJECT',teacherName:'PRIVATE TEACHER'}],meta:{totalPages:1}})};
    const service=new CareerPlanningService({getRepository} as unknown as DataSource,schedule as unknown as ScheduleService);
    const result=await service.get({id:'s',universityId:'u',groupId:'g',role:UserRole.STUDENT,email:'s@test'});
    expect(result.days[0]).toMatchObject({date:'2026-10-13',minutes:180});expect(result.days[1]).toMatchObject({date:'2026-10-14',minutes:0,blocked:true});expect(result.fits[0]).toMatchObject({fit:'fits',availableHours:3});expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
});
