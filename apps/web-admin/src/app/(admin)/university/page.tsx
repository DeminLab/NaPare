'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { apiFetch, apiFetchAllPages } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, RequestState, Skeleton } from '@/components/ui';

interface University { id: string; name: string; city: string; status: 'active' | 'inactive' | 'pending'; connectorType?: string; }
interface Faculty { id: string; name: string; }
interface Group { id: string; name: string; facultyId: string; }
interface UniversityStats { totalStudents: number; totalTeachers: number; }
type Section = 'overview' | 'structure' | 'academic' | 'schedule' | 'notifications' | 'integrations';

const sections: Array<{ id: Section; label: string }> = [{ id: 'overview', label: 'Основная информация' }, { id: 'structure', label: 'Структура' }, { id: 'integrations', label: 'Интеграции' }];
const statusLabels = { active: 'Активен', inactive: 'Неактивен', pending: 'Ожидает активации' };

export default function UniversityPage() {
  const [university, setUniversity] = useState<University | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [section, setSection] = useState<Section>('overview');
  useWorkspaceQuery({ section }, query => setSection(sections.find(item => item.id === query.get('section'))?.id || 'overview'));
  const [connectorType, setConnectorType] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const load = () => { setLoading(true); setError(''); setUnavailable([]); Promise.all([apiFetch<University>('/admin/university'), apiFetchAllPages<Faculty>('/admin/faculties').catch(() => { setUnavailable(items => [...items, 'Факультеты']); return []; }), apiFetchAllPages<Group>('/admin/groups').catch(() => { setUnavailable(items => [...items, 'Группы']); return []; }), apiFetch<UniversityStats>('/admin/stats').catch(() => { setUnavailable(items => [...items, 'Пользователи']); return null; })]).then(([data, facultyItems, groupItems, statsData]) => { setUniversity(data); setName(data.name || ''); setCity(data.city || ''); setConnectorType(data.connectorType || ''); setFaculties(facultyItems); setGroups(groupItems); setStats(statsData); }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить университет.')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const students = stats?.totalStudents ?? '—';
  const teachers = stats?.totalTeachers ?? '—';
  const completenessFields = [university?.name, university?.city];
  const missingProfileFields = [!university?.name && 'Название университета', !university?.city && 'Город'].filter(Boolean);
  const completeness = Math.round((completenessFields.filter(Boolean).length / completenessFields.length) * 100);
  const save = async () => { setSaving(true); setError(''); setSuccess(''); try { const updated = await apiFetch<University>('/admin/university', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), city: city.trim() }) }); setUniversity(updated); setName(updated.name); setCity(updated.city); setEditing(false); setSuccess('Данные университета сохранены.'); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить данные.'); } finally { setSaving(false); } };
  const saveSource = async () => {
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await apiFetch<University>('/admin/university', { method: 'PATCH', body: JSON.stringify({ connectorType }) }); setUniversity(updated); setSuccess('Тип источника сохранён. Проверьте подключение и параметры в разделе «Источники данных».'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить источник.'); }
    finally { setSaving(false); }
  };
  const facultyGroups = useMemo(() => faculties.map((faculty) => ({ ...faculty, count: groups.filter((group) => group.facultyId === faculty.id).length })), [faculties, groups]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  if (!university) return <div className="space-y-4"><RequestState title="Не удалось загрузить университет" description={error || 'Данные недоступны.'} onRetry={load} /><Link href="/onboarding" className="inline-flex min-h-11 items-center font-semibold text-indigo-700 underline">Новый вуз / первичная настройка</Link></div>;

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">Кабинет ВУЗа</p>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Настройки университета</h1><p className="mt-2 text-sm text-slate-500 sm:text-base">Управляйте основной информацией, структурой и источником данных.</p><Link href="/onboarding" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 underline">Открыть мастер подключения вуза</Link></div>
        {!editing && <Button variant="secondary" onClick={() => setEditing(true)}>Редактировать профиль</Button>}
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
    {editing && <Card className="border-indigo-100" padding="sm"><div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><Input label="Название" value={name} onChange={(event) => setName(event.target.value)} /><Input label="Город" value={city} onChange={(event) => setCity(event.target.value)} /><div className="flex gap-2"><Button variant="secondary" onClick={() => { setEditing(false); setName(university.name); setCity(university.city); }}>Отмена</Button><Button loading={saving} disabled={!name.trim() || !city.trim()} onClick={save}>Сохранить</Button></div></div></Card>}
    <section aria-label="Статистика университета" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: 'Факультеты', value: unavailable.includes('Факультеты') ? '—' : faculties.length, href: '/faculties', tone: 'bg-violet-50 text-violet-600' }, { label: 'Группы', value: unavailable.includes('Группы') ? '—' : groups.length, href: '/groups', tone: 'bg-blue-50 text-blue-600' }, { label: 'Студенты', value: unavailable.includes('Пользователи') ? '—' : students, href: '/users?role=student', tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Преподаватели', value: unavailable.includes('Пользователи') ? '—' : teachers, href: '/users?role=teacher', tone: 'bg-amber-50 text-amber-600' }].map((item) => <Link key={item.label} href={item.href} className="group"><Card className="h-full transition-colors hover:border-indigo-200" padding="sm"><div className="flex items-center justify-between gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl ${item.tone}`} aria-hidden="true"><span className="text-lg font-bold">{item.label[0]}</span></span><span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" aria-hidden="true">→</span></div><p className="mt-4 text-sm font-medium text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{item.value}</p></Card></Link>)}
    </section>
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Настройки университета" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:block lg:space-y-1 lg:self-start">
        <p className="hidden px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:block">Разделы</p>
        {sections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-pressed={section === item.id} className={`min-h-11 shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)] lg:block lg:w-full ${section === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{item.label}</button>)}
      </nav>
      <div className="min-w-0">
        {section === 'overview' && <Card padding="sm"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-xl font-bold text-indigo-600" aria-hidden="true">В</span><div><h2 className="text-lg font-bold text-slate-950">Основная информация</h2><p className="mt-1 text-sm text-slate-500">Основные сведения об университете и его статус в системе.</p></div></div><dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4 sm:px-5"><div className="grid gap-1 py-4 sm:grid-cols-[minmax(150px,0.45fr)_1fr] sm:items-center"><dt className="text-sm text-slate-500">Название</dt><dd className="font-semibold text-slate-950">{university.name}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-[minmax(150px,0.45fr)_1fr] sm:items-center"><dt className="text-sm text-slate-500">Город</dt><dd className="font-semibold text-slate-950">{university.city || 'Не указан'}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-[minmax(150px,0.45fr)_1fr] sm:items-center"><dt className="text-sm text-slate-500">Статус</dt><dd><Badge variant={university.status === 'active' ? 'green' : university.status === 'inactive' ? 'red' : 'amber'} dot>{statusLabels[university.status]}</Badge></dd></div></dl></Card>}
        {section === 'structure' && <Card padding="sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Структура университета</h2><p className="mt-1 text-sm text-slate-500">Факультеты и учебные группы, доступные в кабинете.</p></div><Badge>{facultyGroups.length} факультетов · {groups.length} групп</Badge></div><div className="mt-5 divide-y divide-slate-100">{unavailable.includes('Факультеты') || unavailable.includes('Группы') ? <RequestState title="Структура недоступна" description="Не удалось получить факультеты или группы." onRetry={load} /> : facultyGroups.length ? facultyGroups.map((faculty) => <Link key={faculty.id} href={`/faculties?faculty=${faculty.id}`} className="flex min-h-16 items-center justify-between gap-4 py-3 transition-colors hover:text-indigo-700"><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{faculty.name}</span><span className="mt-1 block text-xs text-slate-500">Факультет</span></span><span className="shrink-0 text-sm text-slate-500">{faculty.count} групп <span aria-hidden="true">→</span></span></Link>) : <EmptyState title="Факультеты не созданы" description="Добавьте факультет, чтобы описать структуру университета." />}</div><Link href="/faculties" className="mt-4 inline-flex min-h-11 items-center font-semibold text-indigo-600 hover:text-indigo-800">Управлять структурой <span className="ml-2" aria-hidden="true">→</span></Link></Card>}
        {section === 'integrations' && <Card padding="sm"><h2 className="text-lg font-bold text-slate-950">Интеграции</h2><p className="mt-1 text-sm text-slate-500">Выберите тип внешнего источника, используемого университетом.</p><label className="mt-5 block max-w-2xl text-sm font-semibold text-slate-800">Источник данных<select value={connectorType} onChange={event => setConnectorType(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-ring)]"><option value="" disabled>Выберите источник</option>{connectorType && !['rasp-sano', 'moodle'].includes(connectorType) && <option value={connectorType}>{connectorType} · текущий источник</option>}<option value="rasp-sano">Расписание СИБИТ · rasp.sano.ru</option><option value="moodle">Moodle · учебная система</option></select></label><p className="mt-2 text-sm text-slate-500">Изменение типа не запускает синхронизацию.</p><div className="mt-5 flex flex-wrap items-center gap-4"><Button loading={saving} disabled={!['rasp-sano', 'moodle'].includes(connectorType) || connectorType === university.connectorType} onClick={() => void saveSource()}>Сохранить тип источника</Button><span className="text-sm text-slate-500">{university.connectorType ? `Подключён коннектор: ${university.connectorType}` : 'Коннектор пока не настроен.'}</span></div><Link href="/connectors" className="mt-5 inline-flex min-h-11 items-center font-semibold text-indigo-600 hover:text-indigo-800">Управлять интеграциями <span className="ml-2" aria-hidden="true">→</span></Link></Card>}
      </div>
    </div>
    {missingProfileFields.length > 0 && <Card padding="sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-bold text-slate-950">Профиль университета заполнен не полностью</h2><p className="mt-1 text-sm text-slate-500">Укажите {missingProfileFields.join(' и ').toLowerCase()}, чтобы данные кабинета были актуальны.</p></div><span className="rounded-xl bg-indigo-50 px-4 py-2 text-lg font-bold text-indigo-700">{completeness}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${completeness}%` }} /></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2"><Link href="/schedule-import" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">Импорт расписания →</Link><Link href="/notifications" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">События ВУЗа →</Link></div></Card>}
  </div>;
}
