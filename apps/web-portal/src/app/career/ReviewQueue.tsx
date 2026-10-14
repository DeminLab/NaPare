"use client";
import { ReactNode, useEffect, useRef, useState } from 'react';
import s from './career.module.css';
type Item={id:string;title:string;summary:string;state:string};
export function ReviewQueue({items,label,render,revision}:{items:Item[];label:string;revision?:unknown;render:(id:string)=>ReactNode}) {
  const dirty=useRef(false);useEffect(()=>{dirty.current=false;},[revision]);const maySwitch=()=>!dirty.current||window.confirm('Перейти к другой записи без сохранения введённого текста?');
  const detail=useRef<HTMLElement>(null);const [selected,setSelected]=useState('');const [query,setQuery]=useState('');
  const visible=items.filter(item=>`${item.title} ${item.summary} ${item.state}`.toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU')));
  const current=visible.find(item=>item.id===selected)||visible[0];
  return <div className={s.reviewQueue}><section className={s.queueList} aria-label={label}><label className={s.field}>Поиск в очереди<input type="search" value={query} onChange={event=>{if(maySwitch()){dirty.current=false;setQuery(event.target.value);}}} placeholder="Имя, направление или статус…"/></label><p className={s.muted}>Записей: {visible.length}</p><div className={s.queueItems}>{visible.map(item=><button key={item.id} className={item.id===current?.id?s.queueSelected:s.queueItem} aria-pressed={item.id===current?.id} onClick={()=>{if(item.id!==current?.id&&!maySwitch())return;dirty.current=false;setSelected(item.id);requestAnimationFrame(()=>detail.current?.focus());}}><strong>{item.title}</strong><span>{item.summary}</span><small>{item.state}</small></button>)}</div>{!visible.length&&<p>По этим условиям записей нет.</p>}</section><section onInput={()=>{dirty.current=true;}} ref={detail} tabIndex={-1} className={s.queueDetail} aria-label="Выбранная запись">{current?render(current.id):<p>Измените поиск, чтобы открыть запись.</p>}</section></div>;
}
