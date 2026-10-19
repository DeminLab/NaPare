'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button, Card, RequestState, Skeleton } from '@/components/ui';

const events = [
  { key: 'scheduleChanges', label: 'Изменения расписания' },
  { key: 'cancellations', label: 'Отмена занятий' },
  { key: 'roomChanges', label: 'Смена аудитории' },
  { key: 'homeworkCreated', label: 'Новая подготовка к занятию' },
  { key: 'deadlines', label: 'Напоминания о сроках' },
  { key: 'messages', label: 'Сообщения в обсуждениях' },
  { key: 'announcements', label: 'Объявления' },
  { key: 'systemAlerts', label: 'Системные события' },
] as const;
type Preferences = Record<typeof events[number]['key'], boolean> & { telegramEnabled: boolean };
const normalize = (value: Partial<Preferences>): Preferences => Object.fromEntries([...events.map(event => [event.key, value[event.key] !== false]), ['telegramEnabled', value.telegramEnabled === true]]) as Preferences;

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const loadController = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true); setError('');
    apiFetch<Partial<Preferences>>('/notifications/preferences', { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      const value = normalize(response); setPreferences(value); setSaved(value);
    }).catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить настройки уведомлений.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);
  useEffect(() => { load(); return () => loadController.current?.abort(); }, [load]);
  const save = async () => {
    if (!preferences) return;
    setSaving(true); setError(''); setStatus('');
    try {
      const value = normalize(await apiFetch<Partial<Preferences>>('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(preferences) }));
      setPreferences(value); setSaved(value); setStatus('Настройки уведомлений сохранены.');
    } catch { setError('Не удалось сохранить настройки. Ваш выбор остался на экране — попробуйте ещё раз.'); }
    finally { setSaving(false); }
  };
  if (loading) return <div role="status" aria-busy="true" aria-label="Загрузка настроек уведомлений"><Skeleton className="h-72" /></div>;
  if (!preferences) return <RequestState title="Настройки недоступны" description={error} onRetry={load} />;
  const changed = JSON.stringify(preferences) !== JSON.stringify(saved);
  return <Card><h2 className="text-lg font-semibold text-slate-900">Какие события вам нужны</h2>
    <div className="mt-5 space-y-5">{[{title:'Расписание',keys:['scheduleChanges','cancellations','roomChanges']},{title:'Подготовка и общение',keys:['homeworkCreated','deadlines','messages','announcements']},{title:'Система',keys:['systemAlerts']}].map(group=><fieldset key={group.title} className="rounded-xl border border-slate-200 p-3"><legend className="px-2 text-sm font-semibold text-slate-700">{group.title}</legend><div className="grid gap-1 sm:grid-cols-2">{events.filter(event=>group.keys.includes(event.key)).map(event=><label key={event.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-slate-50"><input type="checkbox" className="h-5 w-5 accent-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700" checked={preferences[event.key]} disabled={saving} onChange={e=>{setStatus('');setPreferences(previous=>previous&&{...previous,[event.key]:e.target.checked});}}/><span className="text-sm text-slate-800">{event.label}</span></label>)}</div></fieldset>)}</div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className={`mt-4 flex flex-wrap items-center gap-3 ${changed ? "sticky bottom-20 z-10 rounded-xl border bg-white p-3 shadow-sm lg:bottom-4" : ""}`}><Button onClick={() => void save()} disabled={saving || !changed}>{saving ? 'Сохраняем…' : 'Сохранить настройки'}</Button><span role="status" className="text-sm text-slate-600">{status || (changed ? 'Есть несохранённые изменения' : 'Настройки сохранены')}</span></div>
  </Card>;
}
