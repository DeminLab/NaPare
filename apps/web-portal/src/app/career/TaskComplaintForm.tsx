'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { accountApi, currentSession } from '../privacy/account/api';
import styles from './career.module.css';

type Complaint={id:string;category:string;state:string;details:string;resolution:string;createdAt:string};
type Page={items:Complaint[];hasMore:boolean;total:number};
const states:Record<string,string>={open:'Ожидает рассмотрения',resolved:'Подтверждена',dismissed:'Отклонена'};
export function TaskComplaintForm({taskId,disabled}:{taskId:string;disabled:boolean}){
  const [category,setCategory]=useState('other'),[details,setDetails]=useState(''),[page,setPage]=useState<Page|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const [sessionChanged,setSessionChanged]=useState(false);
  const blocked=disabled||sessionChanged;
  const controller=useRef<AbortController|null>(null),pending=useRef(false);
  useEffect(()=>{const changed=(event:StorageEvent)=>{if(!event.key||['accessToken','refreshToken'].includes(event.key)){controller.current?.abort();pending.current=false;setBusy(false);setPage(null);setDetails('');setStatus('');setSessionChanged(true);setError('Аккаунт изменился. Обновите страницу.');}};window.addEventListener('storage',changed);return()=>{controller.current?.abort();window.removeEventListener('storage',changed);};},[]);
  async function load(append=false){
    if(pending.current||blocked)return;const session=currentSession();if(!session){setError('Войдите заново, чтобы посмотреть свои обращения.');return;}
    pending.current=true;setBusy(true);setError('');const next=new AbortController();controller.current=next;
    try{const result=await accountApi<Page>(`/career/complaints/my?taskId=${encodeURIComponent(taskId)}&offset=${append?page?.items.length||0:0}&limit=20`,session,next.signal);
      setPage(current=>append&&current?{...result,items:[...current.items,...result.items]}:result);
    }catch(failure){if(!next.signal.aborted)setError(failure instanceof Error?failure.message:'Не удалось загрузить обращения.');}
    finally{pending.current=false;if(!next.signal.aborted)setBusy(false);}
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(pending.current||blocked||details.trim().length<10)return;
    const session=currentSession();if(!session){setError('Войдите заново, чтобы отправить жалобу.');return;}
    pending.current=true;setBusy(true);setError('');setStatus('');const next=new AbortController();controller.current=next;
    try{await accountApi(`/career/tasks/${taskId}/complaints`,session,next.signal,{method:'POST',body:JSON.stringify({category,details:details.trim()})});
      setStatus('Жалоба отправлена в карьерный центр.');setDetails('');pending.current=false;await load();
    }catch(failure){if(!next.signal.aborted)setError(failure instanceof Error?failure.message:'Не удалось получить подтверждение отправки. Обновите список своих обращений.');}
    finally{pending.current=false;if(!next.signal.aborted)setBusy(false);}
  }
  return <details onToggle={event=>{if(event.currentTarget.open&&!page&&!busy)void load();}}>
    <summary>Сообщить о проблеме и посмотреть свои обращения</summary>
    <p>Обращение увидит карьерный центр вашего вуза. Оно автоматически не отменяет работу или оплату.</p>
    <div role="status" aria-live="polite">{busy?'Обрабатываем запрос…':status}</div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.field}>Причина обращения<select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy||blocked}>
        <option value="prepayment">Требование оплаты</option><option value="misleading">Несоответствие условий</option><option value="unsafe">Опасные условия</option><option value="other">Другая причина</option>
      </select></label>
      <label className={styles.field}>Что произошло<textarea value={details} onChange={e=>setDetails(e.target.value)} minLength={10} maxLength={4000} required disabled={busy||blocked}/></label>
      <button className={styles.button} type="submit" disabled={busy||blocked||details.trim().length<10||page?.items.some(item=>item.state==='open')}>Отправить жалобу</button>
    </form>
    <h3>Свои обращения по этой задаче</h3>
    {page?.total===0&&!busy&&<p>Вы ещё не отправляли обращений по этой задаче.</p>}
    {page?.items.map(item=><article key={item.id}><h4>{states[item.state]||'Статус неизвестен'}</h4><p>{item.details}</p>{item.resolution&&<p>Решение центра: {item.resolution}</p>}</article>)}
    <button type="button" className={styles.button} disabled={busy||blocked} onClick={()=>void load()}>Обновить свои обращения</button>
    {page?.hasMore&&<button type="button" className={styles.button} disabled={busy||blocked} onClick={()=>void load(true)}>Показать ещё обращения</button>}
  </details>;
}
