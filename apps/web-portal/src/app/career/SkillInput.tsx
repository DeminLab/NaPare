"use client";
import { useId, useState } from 'react';
import s from './career.module.css';

export function SkillInput({name,label,initialValue}:{name:string;label:string;initialValue:string}) {
  const id=useId();const [skills,setSkills]=useState(()=>[...new Set(initialValue.split(',').map(value=>value.trim()).filter(Boolean))]);const [draft,setDraft]=useState('');const [error,setError]=useState('');
  function add(){const values=draft.split(',').map(value=>value.trim()).filter(Boolean);const next=[...new Set([...skills,...values])];if(next.length>20||next.some(value=>value.length>80)){setError('Можно указать до 20 навыков, каждый не длиннее 80 символов.');return;}setSkills(next);setDraft('');setError('');}
  return <div className={`${s.field} ${s.wide}`}><label htmlFor={id}>{label}</label><input type="hidden" name={name} value={skills.join(', ')}/><div className={s.row}>{skills.map(skill=><button type="button" key={skill} className={s.skillChip} onClick={()=>setSkills(values=>values.filter(value=>value!==skill))} aria-label={`Удалить навык: ${skill}`}>{skill}<span aria-hidden="true">×</span></button>)}</div><div className={s.row}><input id={id} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} placeholder="Например, Excel или Python…" onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();add();}}} className={s.grow}/><button type="button" className={s.button} onClick={add} disabled={!draft.trim()}>Добавить навык</button></div>{error&&<p role="alert" className={s.error}>{error}</p>}<small className={s.muted}>Enter добавляет навык. Нажмите на тег, чтобы удалить. Добавьте введённый текст перед отправкой профиля.</small></div>;
}
