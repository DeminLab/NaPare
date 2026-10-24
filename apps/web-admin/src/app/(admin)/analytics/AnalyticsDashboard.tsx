'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import styles from './analytics.module.css';

type Metric={id:string;label:string;unit:'count'|'hours'|'percent';definition:string;value:number|null;numerator?:number;denominator?:number;reason?:string;partial?:boolean};
type Report={enabled:boolean;generatedAt:string;period:{weekStart:string;weekEnd:string;semesterStart:string;semesterEnd:string};coverage:{collectionStartedAt:string|null;qrUnknownRecords:number;retentionDays:number}|null;metrics:Metric[];limitations:string[]};
const groups=[{title:'Использование платформы',ids:['semester_retention','weekly_active_users','weekly_active_students_share']},{title:'Подключение и учебный процесс',ids:['onboarding_hours','qr_mark_share','homework_publications','schedule_group_coverage']},{title:'Рабочие процессы',ids:['schedule_import_success','office_on_time_closure','career_accepted_work_share']}];
const reasons:Record<string,string>={collection_disabled:'Сбор отключён',no_observations:'Наблюдений пока нет',period_in_progress:'Семестр ещё не завершён',incomplete_collection:'Нет полной истории с начала семестра',outside_retention:'Период за пределами хранения',empty_cohort:'Нет наблюдаемой начальной когорты',readiness_not_observed:'Готовность ещё не зафиксирована'};
const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
function defaults(){const now=new Date(),year=now.getUTCFullYear(),month=now.getUTCMonth();const monday=new Date(Date.UTC(year,month,now.getUTCDate()-((now.getUTCDay()+6)%7)));return {weekStart:monday.toISOString().slice(0,10),semesterStart:month===0?`${year-1}-09-01`:month>=7?`${year}-09-01`:`${year}-02-01`,semesterEnd:month===0?`${year}-01-31`:month>=7?`${year+1}-01-31`:`${year}-06-30`};}
function date(value:string){return new Date(value).toLocaleDateString('ru-RU',{timeZone:'UTC'});}

export default function AnalyticsDashboard(){
  const [initial]=useState(defaults),[weekStart,setWeekStart]=useState(initial.weekStart),[semesterStart,setSemesterStart]=useState(initial.semesterStart),[semesterEnd,setSemesterEnd]=useState(initial.semesterEnd);
  const [report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sessionChanged,setSessionChanged]=useState(false);
  const pending=useRef<AbortController|null>(null);
  const load=useCallback(async(period:ReturnType<typeof defaults>)=>{
    pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setError('');setReport(null);
    try{const response=await apiFetch<Report>(`/analytics/report?${new URLSearchParams(period)}`,{signal:controller.signal,cache:'no-store'});if(!controller.signal.aborted)setReport(response);}
    catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Не удалось загрузить аналитику.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  },[]);
  useEffect(()=>{void load(initial);return()=>pending.current?.abort();},[initial,load]);
  useEffect(()=>{const clear=(event:StorageEvent)=>{if(event.key===null||['accessToken','refreshToken'].includes(event.key)){pending.current?.abort();setReport(null);setBusy(false);setSessionChanged(true);setError('Сессия изменилась. Обновите страницу, чтобы загрузить данные своего вуза.');}};window.addEventListener('storage',clear);return()=>window.removeEventListener('storage',clear);},[]);
  function submit(event:FormEvent){event.preventDefault();if(!sessionChanged)void load({weekStart,semesterStart,semesterEnd});}
  return <div className={styles.page}>
    <Link className={styles.back} href="/university">← Настройки университета</Link>
    <header className={styles.intro}><p className={styles.eyebrow}>Данные своего вуза · 10 показателей</p><h1>Аналитика использования</h1><p>Наблюдаемая активность, учебный процесс и работа сервисов. Каждый показатель показывает свой источник и ограничения расчёта.</p></header>
    <form onSubmit={submit} className={styles.filters}>
      <label>Начало учебной недели<input type="date" required value={weekStart} onChange={event=>setWeekStart(event.target.value)} disabled={sessionChanged}/></label>
      <label>Начало семестра<input type="date" required value={semesterStart} onChange={event=>setSemesterStart(event.target.value)} disabled={sessionChanged}/></label>
      <label>Конец семестра<input type="date" required min={semesterStart} value={semesterEnd} onChange={event=>setSemesterEnd(event.target.value)} disabled={sessionChanged}/></label>
      <button type="submit" disabled={busy||sessionChanged}>{busy?'Загрузка…':'Рассчитать'}</button>
      <p>Неделя — 7 суток UTC с выбранной даты. Семестр — от 14 до 210 дней; удержание сравнивает первые и последние 7 дней.</p>
    </form>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <div aria-live="polite" aria-busy={busy}>
      {busy&&<p className={styles.notice} role="status">Загружаем показатели своего вуза…</p>}
      {report&&<>
        {!report.enabled&&<section className={styles.notice}><h2>Сбор аналитики отключён</h2><p>Оператор может включить его для вашего вуза после утверждения политики обработки данных. Определения показателей доступны ниже; значения пока не собираются.</p></section>}
        <p className={styles.period}>Неделя с {date(report.period.weekStart)} по {date(new Date(new Date(report.period.weekEnd).getTime()-86400000).toISOString())}. Снимок: {new Date(report.generatedAt).toLocaleString('ru-RU')}.</p>
        {report.enabled&&<p className={styles.notice}>Начало наблюдений: {report.coverage?.collectionStartedAt?new Date(report.coverage.collectionStartedAt).toLocaleString('ru-RU'):'ещё не зафиксировано'}. Отметок с неизвестным каналом за неделю: {report.coverage?.qrUnknownRecords??0}.</p>}
        {groups.map(group=><section className={styles.group} key={group.title}><h2>{group.title}</h2><div className={styles.metrics}>{group.ids.map(id=>{const metric=report.metrics.find(row=>row.id===id);if(!metric)return null;return <article key={id} className={styles.metric}>
          <h3>{metric.label}</h3><p className={styles.value}>{metric.value===null?'—':`${number.format(metric.value)}${metric.unit==='percent'?' %':metric.unit==='hours'?' ч':''}`}</p>
          {metric.reason&&<p className={styles.explanation}>{reasons[metric.reason]||'Данных для расчёта недостаточно'}</p>}
          {metric.partial&&<p className={styles.explanation}>Неполный период или история наблюдений</p>}
          {metric.numerator!==undefined&&metric.denominator!==undefined&&metric.denominator>0&&<p className={styles.fraction}>{number.format(metric.numerator)} из {number.format(metric.denominator)}</p>}
          <p className={styles.definition}>{metric.definition}</p>
        </article>;})}</div></section>)}
        <section className={styles.notice}><h2>Как читать эти данные</h2><ul>{report.limitations.map(item=><li key={item}>{item}</li>)}</ul></section>
      </>}
    </div>
  </div>;
}
