'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { CareerTaskView } from './TaskCard';
import styles from './career.module.css';

export function TaskRevisionPanel({task,busy,onSave}:{task:CareerTaskView;busy:boolean;onSave:(value:Record<string,unknown>)=>Promise<boolean>}){
  const [fields,setFields]=useState({title:task.title,description:task.description,criteria:task.criteria,requirements:task.requirements||'',reward:String(task.rewardKopecks/100),hours:String(task.hours),deadline:task.deadline,profiled:task.profiled,skill:task.skill,level:task.level||'standard'});
  const pending=useRef(false);
  const [sessionChanged,setSessionChanged]=useState(false);
  const blocked=busy||sessionChanged;
  useEffect(()=>{const changed=(event:StorageEvent)=>{if(!event.key||['accessToken','refreshToken'].includes(event.key))setSessionChanged(true);};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
  function text(key:keyof typeof fields,value:string){setFields(current=>({...current,[key]:value}));}
  async function submit(event:FormEvent){event.preventDefault();if(blocked||pending.current)return;pending.current=true;
    try{await onSave({...fields,rewardKopecks:Math.round(Number(fields.reward)*100),hours:Number(fields.hours),expectedVersion:task.moderationContentVersion||1,reward:undefined});}
    finally{pending.current=false;}
  }
  return <details><summary>Исправить черновик</summary>
    <p>Менять можно только черновик без откликов и работ. После исправления отправьте задачу на проверку повторно.</p>
    {sessionChanged&&<p role="alert">Аккаунт изменился. Обновите страницу.</p>}
    <form className={styles.form} onSubmit={submit}><fieldset disabled={blocked} style={{border:0,padding:0,margin:0}}>
      <div className={styles.fields}>
        <label className={styles.field}>Название задачи<input value={fields.title} onChange={e=>text('title',e.target.value)} required minLength={5} maxLength={180}/></label>
        <label className={styles.field}>Вознаграждение, ₽<input type="number" value={fields.reward} onChange={e=>text('reward',e.target.value)} required min={1} max={1000000} step="0.01"/></label>
        <label className={styles.field}>Трудоёмкость, ч.<input type="number" value={fields.hours} onChange={e=>text('hours',e.target.value)} required min={1} max={500} step={1}/></label>
        <label className={styles.field}>Срок<input type="date" value={fields.deadline} onChange={e=>text('deadline',e.target.value)} required/></label>
        <label className={styles.field}>Уровень<select value={fields.level} onChange={e=>text('level',e.target.value)}><option value="starter">Стартовая</option><option value="standard">Обычная</option><option value="advanced">Сложная</option></select></label>
        <label className={styles.field}>Направление<input value={fields.skill} onChange={e=>text('skill',e.target.value)} maxLength={80} required={fields.profiled}/></label>
        <label className={`${styles.field} ${styles.wide}`}>Описание<textarea value={fields.description} onChange={e=>text('description',e.target.value)} required minLength={20} maxLength={10000}/></label>
        <label className={`${styles.field} ${styles.wide}`}>Критерии приёмки<textarea value={fields.criteria} onChange={e=>text('criteria',e.target.value)} required minLength={10} maxLength={4000}/></label>
        <label className={`${styles.field} ${styles.wide}`}>Требования<textarea value={fields.requirements} onChange={e=>text('requirements',e.target.value)} maxLength={2000}/></label>
        <label className={styles.field}><input type="checkbox" checked={fields.profiled} onChange={e=>setFields(current=>({...current,profiled:e.target.checked}))}/>Профильная задача</label>
      </div>
    </fieldset><button className={styles.button} type="submit" disabled={blocked}>Сохранить исправления</button></form>
  </details>;
}
