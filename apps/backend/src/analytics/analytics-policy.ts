import { BadRequestException } from '@nestjs/common';

export const ANALYTICS_RETENTION_DAYS = 400;
export function analyticsConfiguration(enabled: unknown, universities: unknown) {
  if (enabled !== undefined && enabled !== '' && enabled !== 'true' && enabled !== 'false') throw new Error('PRODUCT_ANALYTICS_ENABLED must be true or false');
  const ids = typeof universities === 'string' ? universities.split(',').map(value=>value.trim().toLowerCase()).filter(Boolean) : [];
  if (ids.length > 1000 || ids.some(value=>! /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value))) throw new Error('PRODUCT_ANALYTICS_UNIVERSITY_IDS must contain university UUIDs');
  return {enabled:enabled==='true',universities:new Set(ids)};
}
export function analyticsDate(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) throw new BadRequestException('Нужна существующая дата YYYY-MM-DD');
  return new Date(`${value}T00:00:00.000Z`);
}
export function analyticsPeriod(weekStart:string,semesterStart:string,semesterEnd:string) {
  const week=analyticsDate(weekStart),start=analyticsDate(semesterStart),end=analyticsDate(semesterEnd);
  const days=(end.getTime()-start.getTime())/86400000+1;
  if(days<14||days>210) throw new BadRequestException('Семестр должен занимать от 14 до 210 дней');
  const add=(date:Date,days:number)=>new Date(date.getTime()+days*86400000);
  return {weekStart:week,weekEnd:add(week,7),semesterStart:start,semesterEnd:add(end,1),cohortEnd:add(start,7),returnStart:add(end,-6)};
}
export function qualifiesForProductActivity(path:string,role:string) {
  if(!['student','teacher','curator','faculty_dean','department_head','university_admin','career_staff','career_admin'].includes(role))return false;
  return /^\/(?:api\/v1\/)?(?:schedule|pair-space|my-day|absences|academic|requests|career|admin)(?:\/|$)/.test(path.split('?')[0]);
}
export function percentage(numerator:number,denominator:number):number|null {
  return denominator>0 ? Math.round(numerator/denominator*10000)/100 : null;
}
