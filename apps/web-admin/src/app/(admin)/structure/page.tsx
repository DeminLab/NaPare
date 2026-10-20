'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetchAllPages } from '@/lib/api';
import { Card, EmptyState, RequestState, Skeleton } from '@/components/ui';

interface Faculty { id: string; name: string; }
interface Group { id: string; name: string; facultyId: string; }
interface User { id: string; firstName: string; lastName: string; email: string; role?: string; groupId?: string; }

export default function StructurePage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetchAllPages<Faculty>('/admin/faculties?limit=100'),
      apiFetchAllPages<Group>('/admin/groups?limit=100'),
      apiFetchAllPages<User>('/admin/users?limit=100'),
    ]).then(([facultyItems, groupItems, userItems]) => {
      setFaculties(facultyItems);
      setGroups(groupItems);
      setUsers(userItems);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить структуру университета.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const normalized = query.trim().toLowerCase();
  const tree = useMemo(() => faculties.map((faculty) => ({
    ...faculty,
    groups: groups.filter((group) => group.facultyId === faculty.id).map((group) => ({
      ...group,
      users: users.filter((user) => user.groupId === group.id),
    })),
  })).map((faculty) => ({
    ...faculty,
    groups: faculty.groups.filter((group) => !normalized || `${faculty.name} ${group.name} ${group.users.map((user) => `${user.firstName} ${user.lastName}`).join(' ')}`.toLowerCase().includes(normalized)),
  })).filter((faculty) => !normalized || faculty.groups.length || faculty.name.toLowerCase().includes(normalized)), [faculties, groups, users, normalized]);
  const unassignedGroups = groups.filter((group) => !faculties.some((faculty) => faculty.id === group.facultyId)).filter((group) => !normalized || group.name.toLowerCase().includes(normalized));
  const unassignedUsers = users.filter((user) => user.role === 'student' && (!user.groupId || !groups.some((group) => group.id === user.groupId))).filter((user) => !normalized || `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(normalized));
  const assignedStudents = users.filter((user) => user.role === 'student' && user.groupId && groups.some((group) => group.id === user.groupId)).length;

  return <div className="mx-auto max-w-[var(--layout-content-max)] space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="workspace-kicker">Университет</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">Структура университета</h1><p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">Факультеты, учебные группы и их состав в одном представлении.</p></div>
      <Link href="/faculties" className="role-link role-link-secondary">Управлять факультетами</Link>
    </header>

    <div className="grid gap-3 sm:grid-cols-3" aria-label="Сводка структуры">
      {[{ label: 'Факультеты', value: faculties.length }, { label: 'Группы', value: groups.length }, { label: 'Студенты в группах', value: assignedStudents }].map((item) => <Card key={item.label} padding="sm" className="!rounded-2xl !p-5"><p className="text-sm text-[var(--color-text-secondary)]">{item.label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">{item.value}</p></Card>)}
    </div>

    <label className="block rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5"><span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Поиск по структуре</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Факультет, группа или имя студента…" className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 text-sm text-[var(--color-text)] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]" /></label>

    {loading ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.85fr)]" aria-busy="true"><Skeleton className="h-96" /><Skeleton className="h-72" /></div> : error ? <RequestState title="Не удалось загрузить структуру" description={error} onRetry={load} /> : !tree.length && !unassignedGroups.length && !unassignedUsers.length ? <EmptyState title={query ? 'Совпадений нет' : 'Факультеты пока не добавлены'} description={query ? 'Измените поисковый запрос.' : 'Добавьте первый факультет, чтобы организовать структуру университета.'} action={<Link href="/faculties" className="role-link role-link-primary">Открыть факультеты</Link>} /> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.85fr)]">
      <Card padding="md" className="!rounded-2xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-[var(--color-text)]">Факультеты и группы</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Найдено факультетов: {tree.length}</p></div><span className="rounded-full bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand)]">{groups.length} групп</span></div>
        {tree.length ? <div className="space-y-3">{tree.map((faculty) => <details key={faculty.id} open={Boolean(normalized)} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-background)]"><span className="min-w-0"><span className="block truncate font-semibold text-[var(--color-text)]">{faculty.name}</span><span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{faculty.groups.length} групп</span></span><span aria-hidden="true" className="text-lg text-[var(--color-brand)]">⌄</span></summary><div className="space-y-2 border-t border-[var(--color-border)] bg-[var(--color-background)]/70 p-3">{faculty.groups.length ? faculty.groups.map((group) => <details key={group.id} open={Boolean(normalized)} className="rounded-xl border border-[var(--color-border)] bg-white"><summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2"><span className="font-medium text-[var(--color-text)]">{group.name}</span><span className="shrink-0 text-xs text-[var(--color-text-secondary)]">{group.users.length} студентов</span></summary><div className="border-t border-[var(--color-border)] px-4 py-3">{group.users.length ? <ul className="divide-y divide-[var(--color-border)]">{group.users.map((user) => <li key={user.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><span className="font-medium text-[var(--color-text)]">{user.lastName} {user.firstName}</span><span className="break-all text-sm text-[var(--color-text-secondary)]">{user.email}</span></li>)}</ul> : <p className="text-sm text-[var(--color-text-secondary)]">Студенты ещё не назначены.</p>}<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--color-border)] pt-3"><Link href={`/groups?q=${encodeURIComponent(group.name)}`} className="text-sm font-semibold text-[var(--color-brand)] hover:underline">Данные группы →</Link><Link href={`/users?group=${encodeURIComponent(group.id)}`} className="text-sm font-semibold text-[var(--color-brand)] hover:underline">Пользователи группы →</Link></div></div></details>) : <p className="px-3 py-4 text-sm text-[var(--color-text-secondary)]">Группы пока не добавлены.</p>}</div></details>)}</div> : <EmptyState title="Совпадений нет" description="Попробуйте изменить поисковый запрос." />}
      </Card>

      <Card padding="md" className="!rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-[var(--color-text)]">Нужна привязка</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Пользователи и группы без места в структуре.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{unassignedUsers.length + unassignedGroups.length}</span></div>
        {unassignedGroups.length > 0 && <section className="mb-5"><h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Группы без факультета</h3><ul className="space-y-2">{unassignedGroups.map((group) => <li key={group.id}><Link href={`/groups?q=${encodeURIComponent(group.name)}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-brand)]"><span>{group.name}</span><span className="text-[var(--color-brand)]">→</span></Link></li>)}</ul></section>}
        {unassignedUsers.length > 0 && <section><h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Студенты без группы</h3><ul className="space-y-2">{unassignedUsers.map((user) => <li key={user.id}><Link href={`/users?q=${encodeURIComponent(user.email)}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm hover:border-[var(--color-brand)]"><span className="min-w-0"><span className="block truncate font-medium text-[var(--color-text)]">{user.lastName} {user.firstName}</span><span className="block truncate text-xs text-[var(--color-text-secondary)]">{user.email}</span></span><span className="shrink-0 text-[var(--color-brand)]">→</span></Link></li>)}</ul></section>}
        {!unassignedGroups.length && !unassignedUsers.length && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Все доступные группы и студенты связаны со структурой.</div>}
      </Card>
    </div>}
  </div>;
}
