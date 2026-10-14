import { ReactNode } from 'react';
import s from './career.module.css';

export type CareerTaskView = {id:string;title:string;companyId:string;universityId:string;description:string;criteria:string;requirements:string;level:string;skill:string;profiled:boolean;rewardKopecks:number;hours:number;deadline:string;state:string};
type Fit = {fit:'fits'|'tight'|'unknown'|'blocked';reasons:string[]};
const fits = {fits:'Совместима с планом',tight:'Не помещается в план',unknown:'Время не подтверждено',blocked:'Нужен допуск'};
const levels = {starter:'Стартовая',standard:'Обычная',advanced:'Сложная'};
const currency = new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});

export function TaskCard({task,company,state,fit,children}:{task:CareerTaskView;company:string;state:string;fit?:Fit;children?:ReactNode}) {
  return <article className={`${s.card} ${s.taskCard}`}>
    <div className={s.row}><span className={s.tag}>{state}</span><span className={s.muted}>{levels[task.level as keyof typeof levels]||'Обычная'}</span>{fit&&<span className={fit.fit==='tight'||fit.fit==='blocked'?s.warningTag:s.tag}>{fits[fit.fit]}</span>}</div>
    <h2>{task.title}</h2><p className={s.muted}>{company}{task.skill?` · ${task.skill}`:''}</p>
    <div className={s.taskTerms}><strong>{currency.format(task.rewardKopecks/100)}</strong><span>{task.hours} ч.</span><span>До {new Date(task.deadline+'T12:00:00').toLocaleDateString('ru-RU')}</span><span>{task.profiled?'Профильная':'Непрофильная'}</span></div>
    <p className={s.excerpt}>{task.description}</p>
    <details className={s.taskDetails}><summary>Подробнее о задаче</summary><h3>Что нужно сделать</h3><p className={s.result}>{task.description}</p><h3>Требования</h3><p>{task.requirements||'Дополнительные требования не указаны. Уточните их перед откликом.'}</p><p className={s.muted}>Уровень сложности указан работодателем.</p><h3>Критерии приёмки</h3><p className={s.result}>{task.criteria}</p>{fit&&<section className={s.fit}><h3>Почему такая совместимость</h3><ul>{fit.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></section>}{children}</details>
  </article>;
}
