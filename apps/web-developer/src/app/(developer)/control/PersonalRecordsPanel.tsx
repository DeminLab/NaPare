'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Button, Notice, Pager, errorText, inputClass, panelClass, roles, useResource } from './control-ui';

type UserRow = { id: string; email: string; firstName: string; lastName: string; role: string; universityId: string | null; universityName: string | null; groupId: string | null; isActive: boolean };
type UserCard = { id: string; email: string; firstName: string; lastName: string; role: string; universityId: string | null; groupId: string | null; isActive: boolean; createdAt: string; updatedAt: string; university: { id: string; name: string; city: string } | null; group: { id: string | null; name: string; externalId: string | null } | null };
type Preferences = { id: string; universityId: string; updatedAt: string; settings: Record<string, boolean | string | null> };
type Favorite = { id: string; universityId: string; kind: 'group' | 'teacher'; externalId: string; label: string; createdAt: string; updatedAt: string };
type LessonNote = { id: string; universityId: string; pairSpaceId: string; content: string; createdAt: string; updatedAt: string; lesson: { id: string; subject: string; date: string; pairNumber: number } | null };
type HomeworkProgress = { id: string; homeworkId: string; state: 'todo' | 'in_progress' | 'done'; subtasks: Array<{ id: string; title: string; done: boolean }>; homework: { title: string; deadline: string | null }; pairSpace: { id: string; subject: string; date: string; pairNumber: number; universityId: string } };
type UserRecords = { user: UserCard; sections: { notificationPreferences: Preferences[]; favorites: Favorite[]; lessonNotes: LessonNote[]; homeworkProgress: HomeworkProgress[] }; meta: { counts: Record<string, number>; accessedAt: string } };
type Editor = { section: 'preferences' | 'favorites' | 'notes' | 'progress'; id: string; deleteId?: string };
const boolPreferenceKeys = ['scheduleChanges', 'cancellations', 'roomChanges', 'homeworkCreated', 'deadlines', 'messages', 'announcements', 'systemAlerts', 'telegramEnabled', 'quietHoursEnabled'] as const;
const preferenceLabels: Record<(typeof boolPreferenceKeys)[number], string> = { scheduleChanges: 'Изменения расписания', cancellations: 'Отмены', roomChanges: 'Смена аудитории', homeworkCreated: 'Новая подготовка', deadlines: 'Сроки', messages: 'Сообщения', announcements: 'Объявления', systemAlerts: 'Системные оповещения', telegramEnabled: 'Уведомления в Telegram', quietHoursEnabled: 'Тихие часы' };
const progressLabels = { todo: 'Не начато', in_progress: 'В процессе', done: 'Подготовка завершена' };

export default function PersonalRecordsPanel({ access }: { access: Access }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const filters = new URLSearchParams({ q: query, page: String(page), limit: '20' });
  if (role) filters.set('role', role);
  const users = useResource<Page<UserRow>>(`/platform-records/users?${filters.toString()}`);
  const records = useResource<UserRecords>(userId ? `/platform-records/users/${userId}` : null);
  const writable = access.permissions.includes('personal-data.write');
  const user = records.data?.user.id === userId ? records.data.user : undefined;
  const refresh = () => { records.refresh(); users.refresh(); };
  const startEdit = (next: Editor, initial: Record<string, unknown>) => { setEditor(next); setDraft(initial); setReason(''); setError(''); setNotice(''); };
  const closeEditor = () => { setEditor(null); setDraft({}); setReason(''); };
  const save = async () => {
    if (!editor || reason.trim().length < 3 || busy) return;
    const targetUserId = userId;
    let path = `/platform-records/users/${targetUserId}`;
    let method = 'PUT';
    const body: Record<string, unknown> = { ...draft, reason: reason.trim() };
    if (editor.section === 'preferences') { path += editor.id === 'new' ? '/preferences' : `/preferences/${editor.id}`; method = editor.id === 'new' ? 'PUT' : 'PATCH'; if (editor.id !== 'new') delete body.universityId; }
    if (editor.section === 'favorites') { path += editor.id === 'new' ? '/favorites' : `/favorites/${editor.id}`; method = editor.id === 'new' ? 'PUT' : 'PATCH'; delete body.universityId; }
    if (editor.section === 'notes') { path += editor.deleteId ? `/lesson-notes/${editor.deleteId}` : `/lesson-notes/${editor.id}`; method = editor.deleteId ? 'PATCH' : 'PUT'; }
    if (editor.section === 'progress') { path += editor.deleteId ? `/homework-progress/${editor.deleteId}` : `/homework-progress/${editor.id}`; method = editor.deleteId ? 'PATCH' : 'PUT'; }
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(path, { method, body: JSON.stringify(body) });
      closeEditor(); refresh(); setNotice('Изменение сохранено и добавлено в аудит.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const remove = async (section: 'preferences' | 'favorites' | 'notes' | 'progress', id: string, label: string) => {
    if (reason.trim().length < 3 || busy) return;
    let path = `/platform-records/users/${userId}`;
    if (section === 'preferences') path += `/preferences/${id}`;
    if (section === 'favorites') path += `/favorites/${id}`;
    if (section === 'notes') path += `/lesson-notes/${id}`;
    if (section === 'progress') path += `/homework-progress/${id}`;
    setBusy(true); setError(''); setNotice('');
    try { await apiFetch(path, { method: 'DELETE', body: JSON.stringify({ reason: reason.trim() }) }); closeEditor(); refresh(); setNotice(section === 'preferences' ? 'Настройки сброшены к значениям по умолчанию и записаны в аудит.' : `${label} удалена и записана в аудит.`); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const editButton = (section: Editor['section'], id: string, initial: Record<string, unknown>, label = 'Изменить', deleteId?: string) => <Button disabled={!writable || busy} onClick={() => startEdit({ section, id, deleteId }, initial)}>{label}</Button>;
  const editorForm = (section: Editor['section'], id: string) => editor?.section === section && editor.id === id ? <form className="mt-3 space-y-3 rounded-lg border border-cyan-400/30 bg-slate-950/70 p-3" onSubmit={event => { event.preventDefault(); void save(); }}>
    {section === 'preferences' && <>
      {boolPreferenceKeys.map(key => <label key={key} className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(draft[key])} onChange={event => setDraft({ ...draft, [key]: event.target.checked })} />{preferenceLabels[key]}</label>)}
      <div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm">Начало тихих часов<input className={inputClass} type="time" value={String(draft.quietHoursStart || '')} onChange={event => setDraft({ ...draft, quietHoursStart: event.target.value || null })} /></label><label className="block text-sm">Конец тихих часов<input className={inputClass} type="time" value={String(draft.quietHoursEnd || '')} onChange={event => setDraft({ ...draft, quietHoursEnd: event.target.value || null })} /></label><label className="block text-sm">Часовой пояс<input className={inputClass} maxLength={64} value={String(draft.timeZone || 'UTC')} onChange={event => setDraft({ ...draft, timeZone: event.target.value })} /></label></div>
    </>}
    {section === 'favorites' && <>
      <label className="block text-sm">Тип<select className={inputClass} value={String(draft.kind || 'group')} onChange={event => setDraft({ ...draft, kind: event.target.value })}><option value="group">Группа</option><option value="teacher">Преподаватель</option></select></label>
      <label className="block text-sm">Внешний ID<input className={inputClass} required maxLength={220} value={String(draft.externalId || '')} onChange={event => setDraft({ ...draft, externalId: event.target.value })} /></label>
      <label className="block text-sm">Название<input className={inputClass} required maxLength={220} value={String(draft.label || '')} onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>
    </>}
    {section === 'notes' && <label className="block text-sm">Личная заметка<textarea className={`${inputClass} min-h-32`} required maxLength={20000} value={String(draft.content || '')} onChange={event => setDraft({ ...draft, content: event.target.value })} /></label>}
    {section === 'progress' && <><label className="block text-sm">Состояние подготовки<select className={inputClass} value={String(draft.state || 'todo')} onChange={event => setDraft({ ...draft, state: event.target.value })}>{Object.entries(progressLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="space-y-2"><h4 className="text-sm font-medium">Подзадачи</h4>{(Array.isArray(draft.subtasks) ? draft.subtasks as Array<{ id: string; title: string; done: boolean }> : []).map((task, index) => <label key={task.id} className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={task.done} onChange={event => setDraft({ ...draft, subtasks: (draft.subtasks as Array<{ id: string; title: string; done: boolean }>).map((current, currentIndex) => currentIndex === index ? { ...current, done: event.target.checked } : current) })} />{task.title}</label>)}</div></>}
    <label className="block text-sm">Причина изменения<input className={inputClass} required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || reason.trim().length < 3}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>{editor.id !== 'new' && <Button disabled={busy || reason.trim().length < 3} onClick={() => void remove(section, editor.deleteId || editor.id, section === 'preferences' ? 'Настройки' : 'Запись')}>{section === 'preferences' ? 'Сбросить настройки' : 'Удалить'}</Button>}<Button disabled={busy} onClick={closeEditor}>Отмена</Button></div>
  </form> : null;

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold">Личные записи пользователей</h2><p className="mt-1 text-sm text-slate-400">Настройки уведомлений, избранное, личные заметки и ход подготовки. Просмотр и изменение имеют отдельные права; каждое открытие карточки и изменение попадает в аудит.</p></div>
    {(error || users.error || records.error) && <Notice error>{error || users.error || records.error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        <label className="block text-sm">Найти пользователя<input className={inputClass} type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="ФИО, email, телефон, группа или ID" /></label>
        <label className="block text-sm">Роль<select className={inputClass} value={role} onChange={event => { setRole(event.target.value); setPage(1); }}><option value="">Все роли</option>{Object.entries(roles).filter(([key]) => key !== 'curator').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {users.loading && <p role="status" className="text-sm text-slate-400">Ищем пользователей…</p>}
        <div className="max-h-[32rem] divide-y divide-slate-700 overflow-y-auto rounded-xl border border-slate-700">{users.data?.data.map(item => <button key={item.id} aria-pressed={userId === item.id} className={`block min-h-16 w-full p-3 text-left hover:bg-slate-800 ${userId === item.id ? 'bg-cyan-400/10' : ''}`} onClick={() => { setUserId(item.id); closeEditor(); setError(''); setNotice(''); }}><span className="block text-sm font-semibold">{item.lastName} {item.firstName}</span><span className="mt-1 block break-all text-xs text-slate-400">{item.email} · {roles[item.role] || item.role}</span><span className="mt-1 block text-xs text-slate-500">{item.universityName || 'Без университета'}{item.groupId ? ` · ${item.groupId}` : ''}</span></button>)}</div>
        {users.data && <Pager page={page} totalPages={users.data.meta.totalPages} onChange={setPage} />}
      </div>
      <div className="min-w-0 space-y-4">
        {!userId && <div className={panelClass}><p className="text-sm text-slate-400">Выберите пользователя, чтобы открыть его связанные личные записи.</p></div>}
        {records.loading && <p role="status" className="text-sm text-slate-400">Загружаем личные записи…</p>}
        {user && <>
          <div className={panelClass}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{user.lastName} {user.firstName}</h3><p className="mt-1 break-all text-sm text-slate-400">{user.email}</p><p className="mt-1 text-xs text-slate-500">{roles[user.role] || user.role} · {user.university ? `${user.university.name} · ${user.university.city}` : 'Без университета'}{user.group ? ` · ${user.group.name}` : ''}</p></div><span className={`rounded-full px-2 py-1 text-xs ${user.isActive ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{user.isActive ? 'Активен' : 'Заблокирован'}</span></div><p className="mt-2 text-xs text-slate-500">Карточка открыта {records.data?.meta.accessedAt ? new Date(records.data.meta.accessedAt).toLocaleString('ru-RU') : ''}</p></div>
          <section className={`${panelClass} space-y-3`}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Уведомления</h3>{writable && user.universityId && !records.data?.sections.notificationPreferences.some(item => item.universityId === user.universityId) && <Button onClick={() => startEdit({ section: 'preferences', id: 'new' }, { universityId: user.universityId, scheduleChanges: true, cancellations: true, roomChanges: true, homeworkCreated: true, deadlines: true, messages: true, announcements: true, systemAlerts: true, telegramEnabled: false, quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timeZone: 'UTC' })}>Создать настройки</Button>}</div>
            {!records.data?.sections.notificationPreferences.length && <p className="text-sm text-slate-400">Настройки ещё не создавались.</p>}
            {records.data?.sections.notificationPreferences.map(item => <article key={item.id} className="rounded-lg border border-slate-700 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">Университет {item.universityId}</p><p className="mt-1 text-xs text-slate-400">Тихие часы: {item.settings.quietHoursEnabled ? `${item.settings.quietHoursStart || '—'}–${item.settings.quietHoursEnd || '—'} · ${item.settings.timeZone || 'UTC'}` : 'выключены'}</p></div>{editButton('preferences', item.id, { ...item.settings, universityId: item.universityId })}</div>{editorForm('preferences', item.id)}</article>)}
            {editor?.section === 'preferences' && editor.id === 'new' && <article className="rounded-lg border border-cyan-400/30 p-3">{editorForm('preferences', 'new')}</article>}
          </section>
          <section className={`${panelClass} space-y-3`}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Избранное</h3>{writable && user.universityId && <Button onClick={() => startEdit({ section: 'favorites', id: 'new' }, { kind: 'group', externalId: '', label: '' })}>Добавить</Button>}</div>
            {!records.data?.sections.favorites.length && <p className="text-sm text-slate-400">Избранного пока нет.</p>}
            {records.data?.sections.favorites.map(item => <article key={item.id} className="rounded-lg border border-slate-700 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{item.label}</p><p className="mt-1 break-all text-xs text-slate-400">{item.kind === 'group' ? 'Группа' : 'Преподаватель'} · {item.externalId} · вуз {item.universityId}</p></div>{editButton('favorites', item.id, { universityId: item.universityId, kind: item.kind, externalId: item.externalId, label: item.label })}</div>{editorForm('favorites', item.id)}</article>)}
            {editor?.section === 'favorites' && editor.id === 'new' && <article className="rounded-lg border border-cyan-400/30 p-3">{editorForm('favorites', 'new')}</article>}
          </section>
          <section className={`${panelClass} space-y-3`}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Личные заметки</h3><span className="text-xs text-slate-400">{records.data?.sections.lessonNotes.length ?? 0}</span></div>
            {!records.data?.sections.lessonNotes.length && <p className="text-sm text-slate-400">Заметок нет.</p>}
            {records.data?.sections.lessonNotes.map(item => <article key={item.id} className="rounded-lg border border-slate-700 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{item.lesson?.subject || 'Занятие'}{item.lesson ? ` · пара ${item.lesson.pairNumber}` : ''}</p><p className="mt-1 text-xs text-slate-400">{item.lesson?.date ? new Date(item.lesson.date).toLocaleString('ru-RU') : 'занятие недоступно'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{item.content}</p></div>{editButton('notes', item.pairSpaceId, { content: item.content }, 'Изменить', item.id)}</div>{editorForm('notes', item.pairSpaceId)}</article>)}
          </section>
          <section className={`${panelClass} space-y-3`}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Подготовка к занятиям</h3><span className="text-xs text-slate-400">{records.data?.sections.homeworkProgress.length ?? 0}</span></div>
            {!records.data?.sections.homeworkProgress.length && <p className="text-sm text-slate-400">Записей о подготовке нет. Это личный прогресс, а не сдача или оценка в Moodle.</p>}
            {records.data?.sections.homeworkProgress.map(item => <article key={item.id} className="rounded-lg border border-slate-700 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{item.homework.title}</p><p className="mt-1 text-xs text-slate-400">{item.pairSpace.subject} · {new Date(item.pairSpace.date).toLocaleDateString('ru-RU')}{item.homework.deadline ? ` · срок ${new Date(item.homework.deadline).toLocaleDateString('ru-RU')}` : ''}</p><p className="mt-1 text-xs text-cyan-200">{progressLabels[item.state]} · подзадач: {item.subtasks.filter(task => task.done).length}/{item.subtasks.length}</p></div>{editButton('progress', item.homeworkId, { state: item.state, subtasks: item.subtasks }, 'Изменить', item.id)}</div>{editorForm('progress', item.homeworkId)}</article>)}
          </section>
          {records.data && <p className="text-xs text-slate-500">Доступ к этой карточке записан в аудите. Токены устройств, содержимое уведомлений и внешние идентификаторы подключений не отображаются.</p>}
        </>}
        {records.data && !records.data.sections && <Notice error>Сервер вернул карточку без связанных разделов.</Notice>}
      </div>
    </div>
  </section>;
}
