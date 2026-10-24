'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountApiError,accountApi,currentSession } from '../../privacy/account/api';
import career from '../career.module.css';
import layout from '../reports/report.module.css';

type Complaint={id:string;state:string;details:string;resolution:string;createdAt:string;resolvedAt:string|null;taskSnapshot?:{title?:string;description?:string}};
type Page={items:Complaint[];total:number;hasMore:boolean};
const statuses:Record<string,string>={open:'Ожидает рассмотрения',resolved:'Подтверждена',dismissed:'Отклонена'};
export default function MyComplaintHistory(){
  const [page,setPage]=useState<Page|null>(null),[offset,setOffset]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{
    controller.current?.abort();const next=new AbortController();controller.current=next;setBusy(true);setError('');const session=currentSession();
    if(!session){setPage(null);setBusy(false);setError('Войдите в свой студенческий аккаунт.');return;}
    try{const data=await accountApi<Page>(`/career/complaints/my?offset=${offset}&limit=20`,session,next.signal);if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total))throw new Error('Не удалось проверить список сервера.');setPage(data);}
    catch(failure){if(!next.signal.aborted){if(failure instanceof AccountApiError&&[401,403,409].includes(failure.status))setPage(null);setError(failure instanceof Error?failure.message:'Не удалось загрузить обращения.');}}
    finally{if(!next.signal.aborted)setBusy(false);}
  },[offset]);
  useEffect(()=>{void load();const changed=(event:StorageEvent)=>{if(!event.key||['accessToken','refreshToken'].includes(event.key)){setPage(null);void load();}};window.addEventListener('storage',changed);return()=>{controller.current?.abort();window.removeEventListener('storage',changed);};},[load]);
  return <div aria-busy={busy}>
    <div role="status" aria-live="polite">{busy?'Загружаем обращения…':page?`Всего: ${page.total}`:''}</div>
    {error&&<p role="alert" className={career.error}>{error}</p>}
    <div className={layout.actions}><button className={career.button} type="button" disabled={busy} onClick={()=>void load()}>Обновить обращения</button>{!page&&!busy&&<Link href="/login">Войти заново</Link>}</div>
    {page?.total===0&&!busy&&<p>Вы ещё не отправляли жалобы на карьерные задачи.</p>}
    {page?.items.map(item=><article className={career.card} style={{margin:'20px 0'}} key={item.id}>
      <h2>{item.taskSnapshot?.title||'Обращение по карьерной задаче'}</h2><p><strong>{statuses[item.state]||'Статус неизвестен'}</strong></p>
      <p>Отправлено: {new Date(item.createdAt).toLocaleString('ru-RU')}.</p><p>{item.details}</p>
      {item.resolution&&<p>Решение центра: {item.resolution}</p>}
      {item.resolvedAt&&<p>Рассмотрено: {new Date(item.resolvedAt).toLocaleString('ru-RU')}.</p>}
      {item.taskSnapshot?.description&&<details><summary>Условия задачи в момент обращения</summary><p>{item.taskSnapshot.description}</p></details>}
    </article>)}
    {page&&<div className={layout.actions}><button className={career.button} type="button" disabled={busy||offset===0} onClick={()=>{setPage(null);setOffset(v=>Math.max(0,v-20));}}>Предыдущая страница</button><button className={career.button} type="button" disabled={busy||!page.hasMore} onClick={()=>{setPage(null);setOffset(v=>v+20);}}>Следующая страница</button></div>}
  </div>;
}
