'use client';
import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
export const inputClass = 'mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20';
export const panelClass = 'rounded-xl border border-slate-700 bg-slate-900/70 p-4 sm:p-5';
export interface Access { owner: boolean; ownerConfigured: boolean; permissions: string[]; serviceIds: string[]; agentConfigured: boolean; actorId: string }
export interface Page<T> { data: T[]; meta: { total: number; page: number; totalPages: number } }
export function useTargetUserId(): string { const [userId, setUserId] = useState(''); useEffect(() => { setUserId(new URLSearchParams(window.location.search).get('userId') || ''); }, []); return userId; }
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос.';
export function Button({ className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className={`min-h-11 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-400 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>{children}</button>; }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <p role={error ? 'alert' : 'status'} className={`break-words rounded-lg border p-3 text-sm ${error ? 'border-amber-400/40 bg-amber-400/10 text-amber-100' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'}`}>{children}</p>; }
export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (value: number) => void }) { return totalPages > 1 ? <div className="flex items-center justify-between gap-2 pt-3"><Button disabled={page === 1} onClick={() => onChange(page - 1)}>Назад</Button><span className="text-sm text-slate-400">{page} / {totalPages}</span><Button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Далее</Button></div> : null; }
export function useResource<T>(path: string | null, interval = 0) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!path) { setData(null); return; }
    const abort = new AbortController();
    const load = () => { setLoading(true); void apiFetch<T>(path, { signal: abort.signal, cache: 'no-store' }).then(result => { if (!abort.signal.aborted) { setData(result); setError(''); } }).catch(reason => { if (!abort.signal.aborted) { setError(errorText(reason)); setData(null); } }).finally(() => { if (!abort.signal.aborted) setLoading(false); }); };
    const delay = window.setTimeout(load, 150);
    const timer = interval ? window.setInterval(load, interval) : undefined;
    return () => { abort.abort(); window.clearTimeout(delay); window.clearInterval(timer); };
  }, [path, interval, revision]);
  return { data, error, loading, refresh };
}
export const roles: Record<string, string> = { student: 'Студент', teacher: 'Преподаватель', curator: 'Куратор · прежняя роль', faculty_dean: 'Деканат', department_head: 'Заведующий кафедрой', university_admin: 'Администратор вуза', superadmin: 'Суперадминистратор', developer: 'Разработчик', employer: 'Работодатель', career_staff: 'Карьерный центр', career_admin: 'Администратор карьерного центра' };
export const permissionLabels: Record<string, string> = { 'services.read': 'Состояние сервисов', 'services.restart': 'Перезапуск сервисов', 'services.rebuild': 'Пересборка сервисов', 'logs.read': 'Чтение логов', 'accounts.read': 'Просмотр аккаунтов всех вузов', 'accounts.write': 'Изменение аккаунтов', 'universities.read': 'Просмотр вузов', 'universities.write': 'Изменение вузов', 'student-data.read': 'Просмотр посещаемости и отсутствий всех вузов', 'student-data.write': 'Исправление посещаемости и отсутствий', 'personal-data.read': 'Просмотр личных записей пользователей', 'personal-data.write': 'Изменение личных записей пользователей', 'career-data.read': 'Просмотр карьерных профилей и допусков', 'career-data.write': 'Редактирование и решение по карьерным профилям и допускам', 'discussion-data.read': 'Просмотр глобальных обсуждений', 'discussion-data.write': 'Правка, скрытие и восстановление сообщений', 'settings.read': 'Просмотр настроек', 'settings.write': 'Изменение настроек', 'audit.read': 'Журнал действий' };
export const services = ['backend', 'web-portal', 'web-student', 'web-staff', 'web-admin', 'web-developer', 'nginx', 'postgres', 'redis'];
