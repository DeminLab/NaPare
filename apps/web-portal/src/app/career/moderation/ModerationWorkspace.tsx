'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountApiError, accountApi, currentSession, type Session } from '../../privacy/account/api';
import { ModerationDecisionCard, type ModerationTask, type ModerationComplaint } from './ModerationDecisionCard';
import career from '../career.module.css';
import layout from '../reports/report.module.css';

type Kind = 'tasks' | 'complaints';
type Queue = { items: (ModerationTask | ModerationComplaint)[]; total: number; hasMore: boolean; policy?: { labels: Record<string,string> } };
export default function ModerationWorkspace() {
  const [kind,setKind]=useState<Kind>('tasks');
  const [offset,setOffset]=useState(0);
  const [queue,setQueue]=useState<Queue|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const session=useRef<Session|null>(null),controller=useRef<AbortController|null>(null),pending=useRef(false);
  const load=useCallback(async()=>{
    controller.current?.abort();const next=new AbortController();controller.current=next;
    session.current=currentSession();setBusy(true);setError('');
    if(!session.current){setQueue(null);setError('Войдите в аккаунт сотрудника карьерного центра.');setBusy(false);return;}
    try{
      const data=await accountApi<Queue>(`/career/moderation/${kind}?offset=${offset}&limit=20`,session.current,next.signal);
      if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0)throw new Error('Не удалось проверить список сервера.');
      setQueue(data);
    }catch(failure){if(!next.signal.aborted){if(failure instanceof AccountApiError&&[401,403,409].includes(failure.status))setQueue(null);setError(failure instanceof Error?failure.message:'Не удалось загрузить очередь.');}}
    finally{if(!next.signal.aborted)setBusy(false);}
  },[kind,offset]);
  useEffect(()=>{
    void load();
    const changed=(event:StorageEvent)=>{if(!event.key||['accessToken','refreshToken'].includes(event.key)){setQueue(null);setStatus('');pending.current=false;void load();}};
    window.addEventListener('storage',changed);return()=>{controller.current?.abort();window.removeEventListener('storage',changed);};
  },[load]);
  async function decide(id:string,decision:string,reason:string,expectedVersion?:number):Promise<boolean>{
    if(pending.current||!session.current)return false;
    pending.current=true;setBusy(true);setError('');setStatus('');
    const next=new AbortController();controller.current=next;
    try{
      await accountApi(`/career/moderation/${kind}/${id}/decision`,session.current,next.signal,{method:'POST',body:JSON.stringify({decision,reason,...(kind==='tasks'?{expectedVersion}:{})})});
      setStatus('Решение сохранено. История рассмотрения обновлена.');await load();return true;
    }catch(failure){if(!next.signal.aborted)setError(failure instanceof Error?failure.message:'Не удалось получить подтверждение решения.');return false;}
    finally{pending.current=false;if(!next.signal.aborted)setBusy(false);}
  }
  function change(value:Kind){setKind(value);setOffset(0);setQueue(null);setError('');setStatus('');}
  return <div aria-busy={busy}>
    <div className={layout.actions} aria-label="Очередь рассмотрения">
      <button type="button" className={kind==='tasks'?career.active:career.button} aria-pressed={kind==='tasks'} disabled={busy} onClick={()=>change('tasks')}>Задачи</button>
      <button type="button" className={kind==='complaints'?career.active:career.button} aria-pressed={kind==='complaints'} disabled={busy} onClick={()=>change('complaints')}>Жалобы студентов</button>
      <button type="button" className={career.button} disabled={busy} onClick={()=>void load()}>Обновить очередь</button>
    </div>
    <div role="status" aria-live="polite">{busy?'Обрабатываем запрос…':status}</div>
    {error&&<p role="alert" className={career.error}>{error}</p>}
    {!queue&&!busy&&<p><Link href="/login">Войти заново</Link>. Права центра назначает администратор вуза.</p>}
    {queue&&<>
      <p>Всего: {queue.total}. Показано: {queue.items.length}.</p>
      {!queue.items.length&&!busy&&<p className={career.empty}>{kind==='tasks'?'Задач на проверку пока нет.':'Открытых жалоб пока нет.'}</p>}
      {queue.items.map(item=><ModerationDecisionCard key={`${kind}:${item.id}:${'moderationContentVersion' in item?item.moderationContentVersion:''}`} item={item} kind={kind} labels={queue.policy?.labels||{}} busy={busy} onDecision={decide}/>)}
      <div className={layout.actions} aria-label="Страницы очереди">
        <button type="button" className={career.button} disabled={busy||offset===0} onClick={()=>{setQueue(null);setOffset(value=>Math.max(0,value-20));}}>Предыдущая страница</button>
        <button type="button" className={career.button} disabled={busy||!queue.hasMore} onClick={()=>{setQueue(null);setOffset(value=>value+20);}}>Следующая страница</button>
      </div>
    </>}
  </div>;
}
