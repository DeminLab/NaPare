'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, useResource } from './control-ui';
import AccountsPanel from './AccountsPanel';
interface University { id?: string; name: string; city: string; status: string; connectorType?: string; reason?: string }
interface AdministratorDraft { username: string; password: string }
interface CreatedUniversityResponse { university: University; administrator: { username: string } }
interface Faculty { id: string; organizationId: string; name: string; code: string; groupCount: number; archivedAt?: string | null }
interface Group { id: string; organizationId: string; facultyId: string; facultyName: string; name: string; externalId: string | null; curriculumYear: number; specialization: string; curatorManagedSeparately: boolean; archivedAt?: string | null }
interface ScheduleConnector { provider: 'rasp-sano' | 'file-only'; enabled: boolean; config: { academicYear?: string }; sourceHost: string | null; raspSanoAvailable?: boolean }
interface ScheduleConnectorCheck { status: string; provider: string; sourceHost: string; academicYear: string | null; academicYearsAvailable: number; groupsAvailable: number; checkedAt: string }
interface AuditEntry { id: string; userId: string; action: string; entity: string; entityId: string | null; createdAt: string; newValues?: Record<string, unknown> }
type OrganizationStatus = 'active' | 'archived' | 'all';
type ArchiveTarget = { kind: 'faculty' | 'group'; id: string; name: string; action: 'archive' | 'restore'; reason: string };
type FacultyForm = { id?: string; name: string; code: string; reason: string };
type GroupForm = { id?: string; facultyId: string; name: string; curriculumYear: number; specialization: string; reason: string };
const universityStatuses: Record<string, string> = { active: 'Активен', inactive: 'Неактивен', pending: 'Ожидает подключения' };
const shortId = (id?: string) => id ? id.replace(/-/g, '').slice(0, 8).toUpperCase() : 'ID недоступен';
const auditActionNames: Record<string, string> = {
  'platform.universities.search': 'Просмотр списка вузов',
  'platform.university.created': 'Создание вуза',
  'platform.university.updated': 'Изменение сведений вуза',
  'platform.university.schedule_connector.updated': 'Изменение источника расписания',
  'platform.organization.faculty.created': 'Создание факультета',
  'platform.organization.faculty.updated': 'Изменение факультета',
  'platform.organization.faculty.archived': 'Архивация факультета',
  'platform.organization.faculty.restored': 'Восстановление факультета',
  'platform.organization.group.created': 'Создание учебной группы',
  'platform.organization.group.updated': 'Изменение учебной группы',
  'platform.organization.group.archived': 'Архивация учебной группы',
  'platform.organization.group.restored': 'Восстановление учебной группы',
  'platform.account.created': 'Создание аккаунта',
  'platform.account.updated': 'Изменение аккаунта',
  'platform.account.archived': 'Архивация аккаунта',
  'platform.account.restored': 'Восстановление аккаунта',
};
const auditActionLabel = (action: string) => auditActionNames[action] || 'Другое действие управления';
export default function UniversitiesPanel({ access }: { access: Access }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(1), [form, setForm] = useState<University | null>(null), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [administrator, setAdministrator] = useState<AdministratorDraft>({ username: '', password: '' });
  const [structureUniversity, setStructureUniversity] = useState(''), [orgQuery, setOrgQuery] = useState(''), [facultyPage, setFacultyPage] = useState(1), [groupPage, setGroupPage] = useState(1), [facultyForm, setFacultyForm] = useState<FacultyForm | null>(null), [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [facultyStatus, setFacultyStatus] = useState<OrganizationStatus>('active'), [groupStatus, setGroupStatus] = useState<OrganizationStatus>('active'), [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'people' | 'structure' | 'schedule' | 'history'>('overview');
  const [connectorReason, setConnectorReason] = useState(''), [connectorBusy, setConnectorBusy] = useState(false), [connectorError, setConnectorError] = useState(''), [connectorNotice, setConnectorNotice] = useState(''), [connectorCheck, setConnectorCheck] = useState<ScheduleConnectorCheck | null>(null), [connectorDraft, setConnectorDraft] = useState<ScheduleConnector | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const universityId = params.get('universityId');
    const universityQuery = params.get('universityQuery');
    if (universityQuery) setQ(universityQuery.slice(0, 100));
    if (universityId) setStructureUniversity(universityId);
  }, []);
  const list = useResource<Page<University>>(`/platform/universities?q=${encodeURIComponent(q)}&page=${page}&limit=20`);
  const organizationQuery = `organizationId=${encodeURIComponent(structureUniversity)}&q=${encodeURIComponent(orgQuery)}&limit=20`;
  const faculties = useResource<Page<Faculty>>(structureUniversity ? `/platform/organization/faculties?${organizationQuery}&status=${facultyStatus}&page=${facultyPage}` : null);
  const groups = useResource<Page<Group>>(structureUniversity ? `/platform/organization/groups?${organizationQuery}&status=${groupStatus}&page=${groupPage}` : null);
  const connector = useResource<ScheduleConnector>(structureUniversity ? `/platform/universities/${encodeURIComponent(structureUniversity)}/schedule-connector` : null);
  const audit = useResource<Page<AuditEntry>>(structureUniversity && access.permissions.includes('audit.read') ? `/platform/audit?organizationId=${encodeURIComponent(structureUniversity)}&page=${auditPage}&limit=20` : null);
  const selectedUniversity = list.data?.data.find(item => item.id === structureUniversity);
  const writable = access.permissions.includes('universities.write');
  const canReadAccounts = access.permissions.includes('accounts.read');
  const canWriteAccounts = access.permissions.includes('accounts.write');
  const canAccessPeople = canReadAccounts || canWriteAccounts;
  const canManageUniversity = writable && access.owner;
  const beginCreateUniversity = () => {
    setAdministrator({ username: '', password: '' });
    setError('');
    setNotice('');
    setForm({ name: '', city: '', status: 'active' });
  };
  const save = async () => {
    if (!form) return;
    if (!form.id && !canWriteAccounts) {
      setError('Для создания вуза вместе с аккаунтом администратора нужно право accounts.write.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        city: form.city.trim(),
        status: form.status,
        ...(form.id
          ? { reason: form.reason?.trim() }
          : { administrator: { ...administrator, username: administrator.username.trim() } }),
      };
      if (form.id) {
        await apiFetch(`/platform/universities/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
        setNotice('Университет сохранён.');
      } else {
        const created = await apiFetch<CreatedUniversityResponse>('/platform/universities', { method: 'POST', body: JSON.stringify(body) });
        setNotice(`Создан вуз «${created.university.name}» и аккаунт администратора. Логин: ${created.administrator.username}.`);
        setAdministrator(current => ({ ...current, password: '' }));
      }
      setForm(null);
      list.refresh();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  const saveFaculty = async () => { if (!facultyForm || !structureUniversity) return; setBusy(true); setError(''); try { const { id, ...body } = facultyForm; await apiFetch('/platform/organization/faculties' + (id ? `/${id}` : `?organizationId=${encodeURIComponent(structureUniversity)}`), { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); setFacultyForm(null); setNotice('Факультет сохранён.'); faculties.refresh(); groups.refresh(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  const saveGroup = async () => { if (!groupForm || !structureUniversity) return; setBusy(true); setError(''); try { const { id, ...body } = groupForm; await apiFetch('/platform/organization/groups' + (id ? `/${id}` : `?organizationId=${encodeURIComponent(structureUniversity)}`), { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); setGroupForm(null); setNotice('Группа сохранена.'); groups.refresh(); faculties.refresh(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  const saveConnector = async () => {
    const value = connectorDraft ?? connector.data;
    if (!structureUniversity || !value || connectorReason.trim().length < 3 || !access.permissions.includes('universities.write')) return;
    setConnectorBusy(true); setConnectorError(''); setConnectorNotice(''); setConnectorCheck(null);
    try {
      const updated = await apiFetch<ScheduleConnector>(`/platform/universities/${encodeURIComponent(structureUniversity)}/schedule-connector`, { method: 'PATCH', body: JSON.stringify({ provider: value.provider, enabled: value.enabled, config: value.config, reason: connectorReason.trim() }) });
      setConnectorDraft({ ...updated, raspSanoAvailable: updated.raspSanoAvailable ?? connector.data?.raspSanoAvailable }); setConnectorReason(''); setConnectorNotice('Настройки источника сохранены.'); connector.refresh();
    } catch (cause) { setConnectorError(errorText(cause)); }
    finally { setConnectorBusy(false); }
  };
  const testConnector = async () => {
    if (!structureUniversity || !connector.data?.enabled || !connector.data.raspSanoAvailable || !access.permissions.includes('universities.read')) return;
    setConnectorBusy(true); setConnectorError(''); setConnectorNotice(''); setConnectorCheck(null);
    try {
      const result = await apiFetch<ScheduleConnectorCheck>(`/platform/universities/${encodeURIComponent(structureUniversity)}/schedule-connector/test`, { method: 'POST' });
      setConnectorCheck(result); setConnectorNotice('Проверка завершена. Данные расписания не изменялись.');
    } catch (cause) { setConnectorError(errorText(cause)); }
    finally { setConnectorBusy(false); }
  };
  const changeArchive = async () => {
    if (!archiveTarget || archiveTarget.reason.trim().length < 3) return;
    const { kind, id, action, reason } = archiveTarget;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/platform/organization/${kind === 'faculty' ? 'faculties' : 'groups'}/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      setArchiveTarget(null);
      setNotice(`${kind === 'faculty' ? 'Факультет' : 'Группа'} ${action === 'archive' ? 'перемещён(а) в архив' : 'восстановлен(а)'}.`);
      faculties.refresh(); groups.refresh();
    } catch (cause) {
      const message = errorText(cause);
      setError(`${message}${action === 'archive' && kind === 'faculty' ? ' Если у факультета есть активные группы, сначала переместите их в архив.' : action === 'restore' && kind === 'group' ? ' Для восстановления группы её факультет должен быть активным.' : ''}`);
    } finally { setBusy(false); }
  };
  const statusFilter = (label: string, value: OrganizationStatus, onChange: (status: OrganizationStatus) => void) => <label className="flex items-center gap-2 text-xs text-slate-400">{label}<select className={inputClass + ' min-h-10 py-2'} value={value} onChange={event => { onChange(event.target.value as OrganizationStatus); if (label === 'Статус факультетов') setFacultyPage(1); else setGroupPage(1); }}><option value="active">Активные</option><option value="archived">В архиве</option><option value="all">Все</option></select></label>;
  const field = (label: string, value: string, onChange: (value: string) => void, maxLength: number, required = true) => <label className="block text-sm">{label}<input className={inputClass} maxLength={maxLength} required={required} value={value} onChange={event => onChange(event.target.value)} /></label>;
  return <div className="space-y-4">
    {!selectedUniversity && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Университеты</h2><p className="mt-1 text-sm text-slate-400">{access.owner ? 'Вся платформа' : access.organizationIds === null ? 'Вся платформа' : `Разрешено вузов: ${access.organizationIds?.length ?? 0}`}</p></div>{canManageUniversity && <Button disabled={!canWriteAccounts} title={!canWriteAccounts ? 'Для создания вуза вместе с администратором нужно право accounts.write.' : undefined} onClick={beginCreateUniversity}>Добавить университет</Button>}</div>
      {canManageUniversity && !canWriteAccounts && <Notice>Создание вуза требует права `accounts.write`, потому что вместе с вузом создаётся аккаунт его администратора. Обратитесь к владельцу платформы за этим разрешением.</Notice>}
      {writable && !access.owner && <Notice>Можно редактировать структуру разрешённых вузов. Название, город и статус вуза меняет только владелец платформы.</Notice>}
      <label className="block text-sm">Найти вуз<input className={inputClass} type="search" value={q} maxLength={100} placeholder="Название вуза" onChange={event => { setQ(event.target.value); setPage(1); }} /></label>
      {(error || list.error) && <Notice error>{error || list.error}</Notice>}{notice && <Notice>{notice}</Notice>}
      {list.loading && !list.data && <p role="status" className="rounded-xl border border-slate-700 p-4 text-sm text-slate-400">Загружаем вузы…</p>}
      {list.error && <Button onClick={list.refresh}>Повторить загрузку</Button>}
      <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">{list.data?.data.map(uni => <article key={uni.id || `${uni.name}-${uni.city}`} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"><div className="min-w-0"><p className="break-words text-sm font-semibold">{uni.name}</p><p className="mt-1 text-xs text-slate-400">{uni.city} · {universityStatuses[uni.status] || `Статус: ${uni.status}`}{uni.connectorType ? ` · источник: ${uni.connectorType}` : ''}</p><p className="mt-1 font-mono text-[11px] text-slate-500">Код: {shortId(uni.id)}</p></div><div className="flex flex-wrap gap-2">{canManageUniversity && <Button onClick={() => setForm({ ...uni, reason: '' })}>Изменить</Button>}<Button disabled={!uni.id} onClick={() => { setStructureUniversity(uni.id || ''); setWorkspaceTab('overview'); setOrgQuery(''); setFacultyPage(1); setGroupPage(1); setFacultyForm(null); setGroupForm(null); setConnectorDraft(null); setConnectorReason(''); setConnectorCheck(null); setConnectorError(''); setConnectorNotice(''); }}>Открыть вуз</Button></div></article>)}</div>
      {list.data && <p className="text-xs text-slate-400">Найдено вузов: {list.data.meta.total}</p>}
      {list.data?.data.length === 0 && <div className="rounded-xl border border-dashed border-slate-600 p-5 text-sm text-slate-400">{q ? 'По этому запросу вузы не найдены.' : 'В доступной области пока нет вузов.'}{q && <Button className="ml-2" onClick={() => { setQ(''); setPage(1); }}>Сбросить поиск</Button>}</div>}
      {list.data && <Pager page={page} totalPages={list.data.meta.totalPages} onChange={setPage} />}
    </>}
    {(error || notice) && <Notice error={!!error}>{error || notice}</Notice>}
    {form && <form className={panelClass + ' space-y-3'} onSubmit={event => { event.preventDefault(); void save(); }}><h3 className="font-semibold">{form.id ? 'Изменить университет' : 'Новый университет'}</h3>{field('Название', form.name, name => setForm({ ...form, name }), 200)}{field('Город', form.city, city => setForm({ ...form, city }), 100)}<label className="block text-sm">Статус<select className={inputClass} value={form.status} onChange={event => setForm({ ...form, status:event.target.value })}><option value="active">Активен</option><option value="inactive">Неактивен</option><option value="pending">Ожидает подключения</option></select></label>{form.id ? field('Причина изменения', form.reason || '', reason => setForm({ ...form, reason }), 500) : <fieldset className="space-y-3 rounded-xl border border-[var(--color-border)] p-4"><legend className="px-1 font-semibold">Доступ администратора вуза</legend><p className="text-sm text-slate-400">Будет создан отдельный аккаунт с ролью администратора и доступом только к этому вузу.</p><label className="block text-sm">Логин для входа<input className={inputClass} autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" required value={administrator.username} onChange={event => setAdministrator({ ...administrator, username: event.target.value })} /><span className="mt-1 block text-xs text-slate-400">3–32 символа: латинские буквы, цифры, точка, дефис или подчёркивание.</span></label><label className="block text-sm">Пароль<input className={inputClass} type="password" autoComplete="new-password" minLength={6} maxLength={72} required value={administrator.password} onChange={event => setAdministrator({ ...administrator, password: event.target.value })} /><span className="mt-1 block text-xs text-slate-400">Пароль не попадёт в журнал и не будет показан повторно после создания.</span></label></fieldset>}<div className="flex gap-2"><Button type="submit" disabled={busy || (!form.id && !canWriteAccounts) || (Boolean(form.id) && (form.reason?.trim().length ?? 0) < 3)}>{busy ? 'Сохраняем…' : form.id ? 'Сохранить университет' : 'Создать вуз и администратора'}</Button><Button disabled={busy} onClick={() => { setForm(null); setAdministrator({ username: '', password: '' }); }}>Отмена</Button></div></form>}
    {selectedUniversity && <>
      <section className={panelClass + ' space-y-4'} aria-label={`Университет: ${selectedUniversity.name}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">Рабочее пространство вуза</p><h2 className="mt-1 break-words text-xl font-semibold">{selectedUniversity.name}</h2><p className="mt-1 text-sm text-slate-400">{selectedUniversity.city} · {universityStatuses[selectedUniversity.status] || selectedUniversity.status} · код {shortId(selectedUniversity.id)}</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => { setStructureUniversity(''); setForm(null); setConnectorDraft(null); const url = new URL(window.location.href); url.searchParams.delete('universityId'); url.searchParams.delete('universityQuery'); window.history.pushState(null, '', url); }}>К списку вузов</Button>{canManageUniversity && <Button onClick={() => setForm({ ...selectedUniversity, reason: '' })}>Изменить сведения</Button>}</div></div>
        <nav aria-label="Разделы вуза" className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
          {([['overview', 'Обзор'], ...(canAccessPeople ? [['people', 'Люди'] as const] : []), ['structure', 'Структура'], ['schedule', 'Расписание и источники'], ...(access.permissions.includes('audit.read') ? [['history', 'История'] as const] : [])] as const).map(([id, label]) => <Button key={id} aria-current={workspaceTab === id ? 'page' : undefined} aria-pressed={workspaceTab === id} onClick={() => setWorkspaceTab(id)} className={workspaceTab === id ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]' : ''}>{label}</Button>)}
        </nav>
      </section>
      {workspaceTab === 'overview' && <section className={panelClass + ' space-y-4'} aria-labelledby="university-overview-heading">
        <div><h3 id="university-overview-heading" className="font-semibold">Состояние и состав</h3><p className="mt-1 text-sm text-slate-400">Показаны только сведения, которые доступны в текущем API.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><article className="rounded-lg border border-[var(--color-border)] p-3"><p className="text-xs text-slate-400">Факультеты</p><p className="mt-1 text-lg font-semibold">{faculties.loading ? 'Загрузка…' : faculties.error ? 'Недоступно' : faculties.data?.meta.total ?? '—'}</p></article><article className="rounded-lg border border-[var(--color-border)] p-3"><p className="text-xs text-slate-400">Учебные группы</p><p className="mt-1 text-lg font-semibold">{groups.loading ? 'Загрузка…' : groups.error ? 'Недоступно' : groups.data?.meta.total ?? '—'}</p></article></div>
        {(faculties.error || groups.error) && <Notice error>{faculties.error || groups.error}</Notice>}
        <div className="rounded-lg border border-[var(--color-border)] p-3"><p className="text-sm font-medium">Источник расписания</p><p className="mt-1 text-sm text-slate-400">{connector.loading ? 'Проверяем настройки…' : connector.error ? 'Не удалось загрузить настройки источника.' : connector.data?.enabled && connector.data.raspSanoAvailable ? 'Включён каталог расписания СИБИТ (rasp.sano.ru)' : connector.data?.provider === 'rasp-sano' ? 'Источник требует проверки возможности использования' : connector.data?.provider === 'file-only' ? 'Загрузка расписания файлом' : 'Не настроен'}</p>{connector.error && <Button className="mt-2" onClick={connector.refresh}>Повторить</Button>}</div>
        <p className="text-xs text-slate-400">Счётчики пользователей и преподавателей не показаны: платформа пока не предоставляет их для этой сводки.</p>
      </section>}
      {workspaceTab === 'people' && canAccessPeople && <section className="space-y-3" aria-label={`Пользователи вуза ${selectedUniversity.name}`}><p className="text-sm text-slate-400">Поиск в рамках выбранного вуза. Создание аккаунтов доступно при наличии права `accounts.write`.</p><AccountsPanel access={access} organizationId={structureUniversity} /></section>}
      {workspaceTab === 'schedule' && <section className={panelClass + ' space-y-4'} aria-labelledby="university-schedule-heading">
        <div><h3 id="university-schedule-heading" className="font-semibold">Расписание и источник данных</h3><p className="mt-1 text-sm text-slate-400">Каталог rasp.sano.ru доступен только для единственного активного вуза СИБИТ (Омск). Для остальных вузов используется файловый импорт через кабинет вуза.</p></div>
        {connector.error && <><Notice error>{connector.error}</Notice><Button onClick={connector.refresh}>Повторить загрузку настроек</Button></>}
        {connector.loading && !connector.data && <p role="status" className="text-sm text-slate-400">Загружаем настройки источника…</p>}
        {connector.data && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void saveConnector(); }}>
          {!connector.data.raspSanoAvailable && connector.data.provider === 'rasp-sano' && !connectorDraft && <div className="space-y-2"><Notice error>Каталог rasp.sano.ru доступен только единственному активному вузу СИБИТ в Омске. Существующая настройка для этого вуза не может быть проверена или изменена.</Notice>{writable && <Button disabled={connectorBusy} onClick={() => setConnectorDraft({ ...connector.data!, provider: 'file-only', enabled: false })}>Переключить на файловый импорт</Button>}</div>}
          {(!connector.data.raspSanoAvailable && connector.data.provider === 'rasp-sano' && connectorDraft) || connector.data.provider === 'file-only' ? <label className="block text-sm">Источник<select className={inputClass} disabled={!writable || connectorBusy} value={(connectorDraft ?? connector.data).provider} onChange={event => { const current = connectorDraft ?? connector.data!; setConnectorDraft({ ...current, provider: event.target.value as ScheduleConnector['provider'], enabled: false }); }}><option value="file-only">Файловый импорт через кабинет вуза</option>{connector.data.raspSanoAvailable && <option value="rasp-sano">Каталог СИБИТ · rasp.sano.ru</option>}</select></label> : connector.data.raspSanoAvailable && <label className="block text-sm">Источник<select className={inputClass} disabled={!writable || connectorBusy} value={(connectorDraft ?? connector.data).provider} onChange={event => { const current = connectorDraft ?? connector.data!; setConnectorDraft({ ...current, provider: event.target.value as ScheduleConnector['provider'], enabled: event.target.value === 'rasp-sano' ? current.enabled : false }); }}><option value="file-only">Файловый импорт через кабинет вуза</option><option value="rasp-sano">Каталог СИБИТ · rasp.sano.ru</option></select></label>}
          {(connectorDraft ?? connector.data).provider === 'rasp-sano' && connector.data.raspSanoAvailable && <>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={!writable || connectorBusy} checked={(connectorDraft ?? connector.data).enabled} onChange={event => { const current = connectorDraft ?? connector.data!; setConnectorDraft({ ...current, enabled: event.target.checked }); }} />Использовать rasp.sano.ru для этого вуза</label>
            <label className="block text-sm">Учебный год, необязательно<input className={inputClass} disabled={!writable || connectorBusy} inputMode="numeric" pattern="\d{4}-\d{4}" placeholder="2026-2027" value={(connectorDraft ?? connector.data).config?.academicYear ?? ''} onChange={event => { const current = connectorDraft ?? connector.data!; setConnectorDraft({ ...current, config: { ...current.config, academicYear: event.target.value || undefined } }); }} /><span className="mt-1 block text-xs text-slate-400">Формат: ГГГГ-ГГГГ. Если оставить пустым, источник выберет актуальный период.</span></label>
          </>}
          <p className="text-xs text-slate-400">Изменение настройки не запускает импорт и не публикует расписание. Проверка подключения только читает каталог источника.</p>
          {writable && <><label className="block text-sm">Причина изменения<textarea className={`${inputClass} min-h-20`} required minLength={3} maxLength={500} value={connectorReason} onChange={event => setConnectorReason(event.target.value)} placeholder="Укажите, зачем меняется источник расписания" /></label><Button type="submit" disabled={connectorBusy || !connectorDraft || connectorReason.trim().length < 3}>{connectorBusy ? 'Сохраняем…' : 'Сохранить источник'}</Button></>}
        </form>}
        {connector.data?.enabled && connector.data.raspSanoAvailable && <Button disabled={connectorBusy} onClick={() => void testConnector()}>{connectorBusy ? 'Проверяем…' : 'Проверить подключение'}</Button>}
        {connectorError && <Notice error>{connectorError}</Notice>}{connectorNotice && <Notice>{connectorNotice}</Notice>}
        {connectorCheck && <dl className="grid gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Источник и проверка</dt><dd className="mt-1">{connectorCheck.sourceHost} · подключение доступно</dd></div><div><dt className="text-xs text-slate-400">Учебный год</dt><dd className="mt-1">{connectorCheck.academicYear || 'Определён источником'}</dd></div><div><dt className="text-xs text-slate-400">Доступные периоды</dt><dd className="mt-1">{connectorCheck.academicYearsAvailable}</dd></div><div><dt className="text-xs text-slate-400">Найдено групп в источнике</dt><dd className="mt-1">{connectorCheck.groupsAvailable}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-400">Проверено</dt><dd className="mt-1">{new Date(connectorCheck.checkedAt).toLocaleString('ru-RU')}</dd></div></dl>}
        <Notice>Загрузка, предварительный просмотр и запуск импорта остаются в кабинете администратора вуза. Настройка этого источника не даёт доступа к чужой сессии вуза.</Notice>
      </section>}
      {workspaceTab === 'history' && access.permissions.includes('audit.read') && <section className={panelClass + ' space-y-3'} aria-label="История действий по вузу"><div><h3 className="font-semibold">История действий</h3><p className="mt-1 text-sm text-slate-400">Показаны события, которые API связывает с выбранным вузом.</p></div>{audit.error && <Notice error>{audit.error}</Notice>}{audit.loading && !audit.data && <p role="status" className="text-sm text-slate-400">Загружаем журнал…</p>}{audit.data?.data.map(entry => <article key={entry.id} className="rounded-lg border border-[var(--color-border)] p-3"><p className="text-sm font-medium">{auditActionLabel(entry.action)}</p><p className="mt-1 text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString('ru-RU')} · оператор {shortId(entry.userId)}</p>{typeof entry.newValues?.reason === 'string' && <p className="mt-1 break-words text-sm text-slate-400">Причина: {entry.newValues.reason}</p>}</article>)}{audit.data?.data.length === 0 && <p className="rounded-lg border border-dashed border-slate-600 p-4 text-sm text-slate-400">Действий, связанных с этим вузом, в доступном журнале нет.</p>}{audit.data && <Pager page={auditPage} totalPages={audit.data.meta.totalPages} onChange={setAuditPage} />}</section>}
      {workspaceTab === 'structure' && <section className={panelClass + ' space-y-5'} aria-label={`Структура: ${selectedUniversity.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Структура · {selectedUniversity.name}</h3><p className="mt-1 text-xs text-slate-400">Внешний ID группы доступен только для чтения. Назначения кураторов меняются отдельно. Архивирование сохраняет историю; университеты здесь не архивируются.</p></div>{writable && <div className="flex flex-wrap gap-2"><Button onClick={() => setFacultyForm({ name: '', code: '', reason: '' })}>Добавить факультет</Button><Button disabled={facultyStatus !== 'active' || !faculties.data?.data.some(item => !item.archivedAt)} title={facultyStatus !== 'active' ? 'Для создания группы выберите активные факультеты.' : undefined} onClick={() => setGroupForm({ facultyId: faculties.data?.data.find(item => !item.archivedAt)?.id || '', name: '', curriculumYear: 1, specialization: '', reason: '' })}>Добавить группу</Button></div>}</div>
      {faculties.error && <Notice error>{faculties.error}</Notice>}{groups.error && <Notice error>{groups.error}</Notice>}{faculties.loading && !faculties.data && <p role="status" className="text-sm text-slate-400">Загружаем факультеты…</p>}{groups.loading && !groups.data && <p role="status" className="text-sm text-slate-400">Загружаем учебные группы…</p>}
      <label className="block text-sm">Поиск факультета или группы<input className={inputClass} maxLength={100} value={orgQuery} onChange={event => { setOrgQuery(event.target.value); setFacultyPage(1); setGroupPage(1); }} placeholder="Название, код, ID или внешний ID" /></label>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Факультеты</h4>{statusFilter('Статус факультетов', facultyStatus, setFacultyStatus)}</div><div className="divide-y divide-slate-700 rounded-xl border border-slate-700">{faculties.data?.data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.name}{item.archivedAt && <span className="ml-2 inline-flex rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-200">В архиве</span>}</p><p className="mt-1 text-xs text-slate-400">Код: {item.code} · групп: {item.groupCount}{item.archivedAt ? ` · архивирован: ${new Date(item.archivedAt).toLocaleDateString('ru-RU')}` : ''}</p></div>{writable && <div className="flex flex-wrap gap-2">{!item.archivedAt && <Button onClick={() => setFacultyForm({ id: item.id, name: item.name, code: item.code, reason: '' })}>Изменить</Button>}<Button disabled={busy} onClick={() => setArchiveTarget({ kind: 'faculty', id: item.id, name: item.name, action: item.archivedAt ? 'restore' : 'archive', reason: '' })}>{item.archivedAt ? 'Восстановить' : 'В архив'}</Button></div>}</div>)}{faculties.data?.data.length === 0 && <p className="p-3 text-sm text-slate-400">{facultyStatus === 'archived' ? 'В архиве факультетов нет.' : orgQuery ? 'Факультеты не найдены по этому запросу.' : 'Факультетов пока нет.'}</p>}</div>{faculties.data && <Pager page={facultyPage} totalPages={faculties.data.meta.totalPages} onChange={setFacultyPage} />}</div>
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Группы</h4>{statusFilter('Статус групп', groupStatus, setGroupStatus)}</div><div className="divide-y divide-slate-700 rounded-xl border border-slate-700">{groups.data?.data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.name} · {item.curriculumYear} курс{item.archivedAt && <span className="ml-2 inline-flex rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-200">В архиве</span>}</p><p className="mt-1 break-words text-xs text-slate-400">{item.facultyName || 'Факультет не указан'}{item.specialization ? ` · ${item.specialization}` : ''}{item.externalId ? ` · внешний ID: ${item.externalId}` : ''}{item.archivedAt ? ` · архивирована: ${new Date(item.archivedAt).toLocaleDateString('ru-RU')}` : ''}</p></div>{writable && <div className="flex flex-wrap gap-2">{!item.archivedAt && <Button onClick={() => setGroupForm({ id: item.id, facultyId: item.facultyId, name: item.name, curriculumYear: item.curriculumYear, specialization: item.specialization, reason: '' })}>Изменить</Button>}<Button disabled={busy} onClick={() => setArchiveTarget({ kind: 'group', id: item.id, name: item.name, action: item.archivedAt ? 'restore' : 'archive', reason: '' })}>{item.archivedAt ? 'Восстановить' : 'В архив'}</Button></div>}</div>)}{groups.data?.data.length === 0 && <p className="p-3 text-sm text-slate-400">{groupStatus === 'archived' ? 'В архиве групп нет.' : orgQuery ? 'Группы не найдены по этому запросу.' : 'Групп пока нет.'}</p>}</div>{groups.data && <Pager page={groupPage} totalPages={groups.data.meta.totalPages} onChange={setGroupPage} />}</div>
      </div>
      {archiveTarget && <form className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" onSubmit={event => { event.preventDefault(); void changeArchive(); }} aria-label={`${archiveTarget.action === 'archive' ? 'Архивирование' : 'Восстановление'}: ${archiveTarget.name}`}><h4 className="font-semibold">{archiveTarget.action === 'archive' ? 'Переместить в архив' : 'Восстановить из архива'} · {archiveTarget.name}</h4><p className="text-sm text-slate-300">{archiveTarget.action === 'archive' ? 'Данные и связанные учебные записи сохранятся. Архивный объект перестанет участвовать в активной структуре.' : 'Объект снова станет доступен в активной структуре, если его родитель активен.'}</p><label className="block text-sm">Причина {archiveTarget.action === 'archive' ? 'архивирования' : 'восстановления'}<textarea className={inputClass + ' min-h-24'} required minLength={3} maxLength={500} value={archiveTarget.reason} onChange={event => setArchiveTarget({ ...archiveTarget, reason: event.target.value })} placeholder="Укажите причину (не менее 3 символов)" /></label><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || archiveTarget.reason.trim().length < 3}>{busy ? 'Сохраняем…' : archiveTarget.action === 'archive' ? 'Подтвердить архивирование' : 'Подтвердить восстановление'}</Button><Button disabled={busy} onClick={() => setArchiveTarget(null)}>Отмена</Button></div></form>}
      {facultyForm && <form className="space-y-3 rounded-xl border border-slate-700 p-4" onSubmit={event => { event.preventDefault(); void saveFaculty(); }}><h4 className="font-semibold">{facultyForm.id ? 'Изменить факультет' : 'Новый факультет'}</h4>{field('Название', facultyForm.name, name => setFacultyForm({ ...facultyForm, name }), 200)}{field('Код', facultyForm.code, code => setFacultyForm({ ...facultyForm, code }), 40)}{field('Причина изменения', facultyForm.reason, reason => setFacultyForm({ ...facultyForm, reason }), 500)}<div className="flex gap-2"><Button type="submit" disabled={busy}>Сохранить факультет</Button><Button disabled={busy} onClick={() => setFacultyForm(null)}>Отмена</Button></div></form>}
      {groupForm && <form className="space-y-3 rounded-xl border border-slate-700 p-4" onSubmit={event => { event.preventDefault(); void saveGroup(); }}><h4 className="font-semibold">{groupForm.id ? 'Изменить группу' : 'Новая группа'}</h4><label className="block text-sm">Факультет<select className={inputClass} required value={groupForm.facultyId} onChange={event => setGroupForm({ ...groupForm, facultyId: event.target.value })}><option value="">Выберите факультет</option>{(faculties.data?.data ?? []).filter(item => !item.archivedAt).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{field('Название', groupForm.name, name => setGroupForm({ ...groupForm, name }), 120)}<label className="block text-sm">Курс<input className={inputClass} type="number" min={1} max={12} required value={groupForm.curriculumYear} onChange={event => setGroupForm({ ...groupForm, curriculumYear: Number(event.target.value) })} /></label>{field('Специализация', groupForm.specialization, specialization => setGroupForm({ ...groupForm, specialization }), 200, false)}{field('Причина изменения', groupForm.reason, reason => setGroupForm({ ...groupForm, reason }), 500)}<div className="flex gap-2"><Button type="submit" disabled={busy || !faculties.data?.data.some(item => !item.archivedAt)}>Сохранить группу</Button><Button disabled={busy} onClick={() => setGroupForm(null)}>Отмена</Button></div></form>}
    </section>}
    </>}
  </div>;
}
