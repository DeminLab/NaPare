'use client';

import { FormEvent, useState } from 'react';
import career from '../career.module.css';
import layout from '../reports/report.module.css';

export type ModerationTask={id:string;title:string;description:string;criteria:string;requirements:string;rewardKopecks:number;hours:number;deadline:string;state:string;moderationStatus:string;moderationFlags:string[];moderationContentVersion:number;moderationReason:string};
export type ModerationComplaint={id:string;taskId:string;category:string;details:string;createdAt:string;taskSnapshot?:{title?:string;description?:string;criteria?:string};task?:{title:string;description:string;criteria:string;companyName:string}|null};
const category:Record<string,string>={prepayment:'Требование оплаты',misleading:'Несоответствие условий',unsafe:'Опасные условия',other:'Другая причина'};
const money=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'});
export function ModerationDecisionCard({item,kind,labels,busy,onDecision}:{item:ModerationTask|ModerationComplaint;kind:'tasks'|'complaints';labels:Record<string,string>;busy:boolean;onDecision:(id:string,decision:string,reason:string,version?:number)=>Promise<boolean>}){
  const [reason,setReason]=useState('');
  const task='moderationContentVersion' in item?item:null;
  const complaint='taskId' in item?item:null;
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    if(!button||busy||reason.trim().length<10)return;
    await onDecision(item.id,button.value,reason.trim(),task?.moderationContentVersion);
  }
  return <article className={career.card} style={{margin:'20px 0'}}>
    {task&&<>
      <h2>{task.title}</h2><p>{task.description}</p>
      <p><strong>{money.format(task.rewardKopecks/100)}</strong> · {task.hours} ч. · до {new Date(task.deadline+'T12:00:00').toLocaleDateString('ru-RU')}</p>
      <h3>Критерии приёмки</h3><p>{task.criteria}</p>
      {task.requirements&&<><h3>Требования</h3><p>{task.requirements}</p></>}
      <h3>На что обратить внимание</h3>
      {task.moderationFlags?.length?<ul>{task.moderationFlags.map(flag=><li key={flag}>{labels[flag]||'Требуется дополнительное рассмотрение условий'}</li>)}</ul>:<p>Автоматические признаки не найдены. Прочитайте условия перед решением.</p>}
      {task.moderationReason&&<p>Предыдущее решение: {task.moderationReason}</p>}
      <p>Ключевые слова требуют чтения в контексте, в том числе при отрицании. Само наличие признака не доказывает мошенничество.</p>
    </>}
    {complaint&&<>
      <h2>{category[complaint.category]||'Жалоба студента'}</h2><p>{complaint.details}</p>
      <p>Отправлено: {new Date(complaint.createdAt).toLocaleString('ru-RU')}.</p>
      {complaint.taskSnapshot?.title&&<><h3>Условия в момент обращения: {complaint.taskSnapshot.title}</h3><p>{complaint.taskSnapshot.description}</p><p>Критерии: {complaint.taskSnapshot.criteria}</p></>}
      {complaint.task&&<details><summary>Текущие условия: {complaint.task.title}</summary><p>{complaint.task.companyName}</p><p>{complaint.task.description}</p><p>{complaint.task.criteria}</p></details>}
      <p>Подтверждение ограничивает новые отклики на открытую задачу. Существующие работы и платежи автоматически не отменяются.</p>
    </>}
    <form onSubmit={submit} className={career.form}>
      <label className={career.field}>Причина решения, видимая участникам
        <textarea value={reason} onChange={event=>setReason(event.target.value)} required minLength={10} maxLength={2000} disabled={busy}/>
      </label>
      <div className={layout.actions}>
        <button className={`${career.button} ${career.primary}`} type="submit" value={kind==='tasks'?'approve':'uphold'} disabled={busy||reason.trim().length<10}>{kind==='tasks'?task?.moderationStatus==='suspended'?'Снять ограничение':'Одобрить публикацию':'Подтвердить жалобу'}</button>
        {(kind==='complaints'||task?.state==='review')&&<button className={career.button} type="submit" value={kind==='tasks'?'reject':'dismiss'} disabled={busy||reason.trim().length<10}>{kind==='tasks'?'Вернуть на исправление':'Отклонить жалобу'}</button>}
      </div>
    </form>
  </article>;
}
