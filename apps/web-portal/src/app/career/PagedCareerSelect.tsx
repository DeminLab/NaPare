"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { careerApi } from './api';
import s from './career.module.css';

type LookupItem={id:string;name?:string;city?:string;firstName?:string;lastName?:string;role?:string};
type LookupPage={items:LookupItem[];total:number;offset:number;limit:number;hasMore:boolean};
type Props={endpoint:string;name:string;label:string;value?:string;onChange?:(value:string)=>void;onSelected?:(item:LookupItem|undefined)=>void;itemLabel:(item:LookupItem)=>string;required?:boolean;emptyText:string};

export function PagedCareerSelect({endpoint,name,label,value,onChange,onSelected,itemLabel,required,emptyText}:Props){
  const [search,setSearch]=useState('');const [page,setPage]=useState<LookupPage|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [selected,setSelected]=useState<LookupItem>();const request=useRef(0);
  const fetchPage=useCallback(async(offset:number,append:boolean,query:string)=>{const sequence=++request.current;setLoading(true);setError('');try{const params=new URLSearchParams({offset:String(offset),limit:'20',q:query});const result=await careerApi<LookupPage>(`${endpoint}${endpoint.includes('?')?'&':'?'}${params}`);if(sequence===request.current)setPage(current=>append&&current?{...result,items:[...current.items,...result.items]}:result);}catch(reason){if(sequence===request.current)setError(reason instanceof Error?reason.message:'Не удалось загрузить список');}finally{if(sequence===request.current)setLoading(false);}},[endpoint]);
  useEffect(()=>{const timer=window.setTimeout(()=>{request.current++;setPage(null);setLoading(false);setError('');void fetchPage(0,false,search);},250);return()=>window.clearTimeout(timer);},[search,fetchPage]);
  const options=page?.items||[];const selectedValue=value??selected?.id??'';const selectedInPage=options.some(item=>item.id===selectedValue);const visibleOptions=selectedValue&&!selectedInPage&&selected?.id===selectedValue?[selected,...options]:options;
  function choose(id:string){const item=visibleOptions.find(option=>option.id===id);setSelected(item);onSelected?.(item);onChange?.(id);}
  return <div className={s.remoteSelect}>
    <label className={s.field}>{label}<input type="search" value={search} onChange={event=>{request.current++;setPage(null);setError('');setSearch(event.target.value);}} placeholder="Поиск по названию" aria-label={`Поиск: ${label}`}/></label>
    <label className={s.field}>{label}<select name={name} value={selectedValue} onChange={event=>choose(event.target.value)} required={required}><option value="">Выберите</option>{visibleOptions.map(item=><option value={item.id} key={item.id}>{itemLabel(item)}</option>)}</select></label>
    <p className={s.muted} role="status" aria-live="polite">{loading?'Загружаем варианты…':page?`Найдено: ${page.total} · показано ${page.items.length}`:'Введите запрос или дождитесь списка.'}</p>
    {error&&<p role="alert" className={s.error}>{error}<button type="button" className={s.button} disabled={loading} onClick={()=>void fetchPage(page?.items.length||0,Boolean(page?.items.length),search)}>Повторить загрузку</button></p>}
    {page?.total===0&&!loading&&!error&&<p className={s.muted}>{search?'Ничего не найдено.':emptyText}</p>}
    {page?.hasMore&&!error&&<button type="button" className={s.button} disabled={loading} onClick={()=>void fetchPage(page.items.length,true,search)}>{loading?'Загружаем…':'Показать ещё'}</button>}
  </div>;
}
