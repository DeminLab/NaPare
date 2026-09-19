'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, apiFetchList, getUser } from '@/lib/api';
import { Card, Badge, Button, Input, TabBar, EmptyState, Avatar, Skeleton, Icon, RequestState } from '@/components/ui';

interface Announcement {
  id: string;
  text: string;
  isPinned: boolean;
  authorName: string;
  createdAt: string;
}

interface Homework {
  id: string;
  title: string;
  description: string;
  deadline: string;
  isCompleted: boolean;
}

interface Message {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

interface PairSpace {
  id: string;
  lessonId: string;
  announcements: Announcement[];
  homeworks: Homework[];
  messages: Message[];
  files?: { id: string; name?: string; fileName?: string; fileUrl?: string; createdAt: string }[];
}

interface Lesson {
  id: string;
  subject: string;
  subjectType: string;
  teacherName: string;
  room: string;
  startTime: string;
  endTime: string;
  groupName: string;
  date?: string;
}

const typeLabels: Record<string, string> = {
  lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная',
  exam: 'Экзамен', consultation: 'Консультация',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`;
  return `${Math.floor(diff / 86400)} дн`;
}

export default function PairSpacePage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [pairSpace, setPairSpace] = useState<PairSpace | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [messageSaving, setMessageSaving] = useState(false);
  const [homeworkSaving, setHomeworkSaving] = useState('');
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    setError('');
    Promise.all([
      apiFetch<PairSpace>(`/pair-spaces/${lessonId}`),
      apiFetch<Lesson>(`/schedule/lessons/${lessonId}`),
      apiFetchList<Lesson>(`/schedule/range?startDate=${new Date().toISOString().split('T')[0]}&endDate=${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}`).catch(() => []),
    ]).then(([ps, l, lessons]) => {
      setPairSpace(ps);
      setLesson(l);
      setNextLesson(lessons.filter(item => item.id !== l.id && new Date(item.startTime).getTime() > new Date(l.startTime).getTime()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] || null);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить пространство пары.')).finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(`pair-space-notes-${lessonId}`);
    if (saved) setNotes(saved);
  }, [lessonId]);

  const saveNotes = (value: string) => {
    setNotes(value);
    window.localStorage.setItem(`pair-space-notes-${lessonId}`, value);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setMessageSaving(true);
    setError('');
    try {
      const msg = await apiFetch<Message>(`/pair-spaces/${lessonId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: newMessage }),
      });
      setPairSpace(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setNewMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение.');
    } finally {
      setMessageSaving(false);
    }
  };

  const handleSubmitHomework = async (id: string) => {
    setHomeworkSaving(id); setError('');
    try { await apiFetch(`/pair-spaces/homeworks/${id}/submit`, { method: 'PATCH', body: JSON.stringify({}) }); setPairSpace(prev => prev ? { ...prev, homeworks: prev.homeworks.map(homework => homework.id === id ? { ...homework, isCompleted: true } : homework) } : prev); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сдать задание.'); } finally { setHomeworkSaving(''); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error && !pairSpace) {
    return <div className="mx-auto max-w-3xl"><RequestState title="Не удалось открыть PairSpace" description={error} onRetry={() => window.location.reload()} /></div>;
  }

  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'announcements', label: 'Объявления', count: pairSpace?.announcements.length },
    { id: 'homeworks', label: 'Задания', count: pairSpace?.homeworks.length },
    { id: 'materials', label: 'Материалы', count: pairSpace?.files?.length },
    { id: 'discussion', label: 'Обсуждение', count: pairSpace?.messages.length },
    { id: 'attendance', label: 'Посещаемость' },
    { id: 'grades', label: 'Оценки' },
    { id: 'notes', label: 'Заметки' },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div>
        <div className="mb-4 text-xs font-medium text-slate-400">НаПаре <span aria-hidden="true">/</span> Расписание <span aria-hidden="true">/</span> <span className="text-slate-600">{lesson?.subject || 'Пространство пары'}</span></div><button onClick={() => router.push('/week')} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к расписанию
        </button>
        {lesson && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{lesson.subject}</h1><div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Badge variant="subject">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge><span>{lesson.startTime?.slice(11, 16)}–{lesson.endTime?.slice(11, 16)}</span><span>· Ауд. {lesson.room || '—'}</span></div><p className="mt-3 text-sm text-slate-600"><span className="font-medium">Преподаватель:</span> {lesson.teacherName || 'Не указан'}</p></div><button onClick={() => setActiveTab('discussion')} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Открыть чат</button></div>
        )}
      </div>

      <div className="sticky top-16 z-20 -mx-2 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-2 py-2 backdrop-blur sm:mx-0"><TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} /></div>
      {error && <RequestState title="Не удалось выполнить действие" description={error} onRetry={() => setError('')} />}

      {activeTab === 'overview' && <><Card><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Action Center</p><h2 className="mt-1 text-lg font-bold text-slate-950">Что нужно сделать</h2></div><Badge variant="warning">{pairSpace?.homeworks.filter(homework => !homework.isCompleted).length || 0}</Badge></div>{pairSpace?.homeworks.filter(homework => !homework.isCompleted).length ? <div className="mt-4 space-y-3">{pairSpace.homeworks.filter(homework => !homework.isCompleted).map(homework => <div key={homework.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3"><div><p className="text-sm font-semibold text-slate-900">{homework.title}</p><p className="mt-1 text-xs text-slate-600">{homework.deadline ? 'Срок: ' + new Date(homework.deadline).toLocaleDateString('ru-RU') : 'Срок не указан'}</p></div><Button size="sm" variant="secondary" loading={homeworkSaving === homework.id} onClick={() => void handleSubmitHomework(homework.id)}>Сдать</Button></div>)}</div> : <EmptyState title="Активных заданий нет" description="Можно сосредоточиться на материалах и обсуждении." />}</Card><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6"><Card><h2 className="text-lg font-bold text-slate-950">Следующее занятие</h2>{nextLesson ? <Link href={`/pair-space/${nextLesson.id}`} className="mt-4 block rounded-xl border border-slate-200 p-4 hover:border-indigo-300"><p className="text-xs font-semibold text-indigo-600">{nextLesson.startTime?.slice(11, 16)}–{nextLesson.endTime?.slice(11, 16)}</p><p className="mt-2 font-semibold text-slate-900">{nextLesson.subject}</p><p className="mt-1 text-sm text-slate-500">{nextLesson.teacherName || 'Преподаватель не указан'} · ауд. {nextLesson.room || '—'}</p></Link> : <p className="mt-3 text-sm text-slate-500">Следующее занятие не найдено в расписании.</p>}</Card><Card><h2 className="text-lg font-bold text-slate-950">Описание</h2><p className="mt-3 text-sm leading-6 text-slate-500">Материалы, объявления, задания и обсуждение по занятию собраны в одном пространстве.</p></Card><Card><h2 className="text-lg font-bold text-slate-950">Последние объявления</h2>{pairSpace?.announcements.length ? <div className="mt-3 space-y-3">{pairSpace.announcements.slice(0, 3).map(a => <div key={a.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{a.text}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">Объявлений пока нет.</p>}<h2 className="mt-6 text-lg font-bold text-slate-950">Ближайшие задания</h2>{pairSpace?.homeworks.length ? <div className="mt-3 space-y-3">{pairSpace.homeworks.slice(0, 3).map(h => <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="truncate">{h.title}</span><span className="shrink-0 text-xs text-slate-500">{h.deadline ? new Date(h.deadline).toLocaleDateString('ru-RU') : 'Без срока'}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Заданий пока нет.</p>}</Card></div><aside className="space-y-4"><Card padding="sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Следующее занятие</p><p className="mt-2 font-semibold">{nextLesson?.subject || 'Не найдено'}</p></Card><Card padding="sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ближайший дедлайн</p><p className="mt-2 font-semibold">{pairSpace?.homeworks.filter(h => h.deadline && !h.isCompleted).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0]?.title || 'Нет активных заданий'}</p></Card><Card padding="sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Участники</p><p className="mt-2 font-semibold">Состав группы</p><p className="mt-1 text-sm text-slate-500">Список участников пока не возвращается API.</p></Card></aside></div></>}

      {/* Announcements */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {pairSpace?.announcements.length === 0 ? (
            <EmptyState title="Нет объявлений" description="Объявления от преподавателя появятся здесь" />
          ) : (
            pairSpace?.announcements.map(a => (
              <Card key={a.id} padding="sm" className={a.isPinned ? 'border-amber-200 bg-amber-50/50' : ''}>
                <div className="flex items-start gap-3">
                  <Icon name={a.isPinned ? 'Pin' : 'MessageCircle'} className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{a.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{a.authorName} · {timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'materials' && (
        <Card><div className="flex items-center gap-3"><Icon name="Paperclip" className="h-5 w-5 text-indigo-500" /><div><h3 className="font-semibold text-slate-900">Материалы</h3><p className="text-sm text-slate-500">Файлы, добавленные в пространство пары.</p></div></div>{pairSpace?.files?.length ? <div className="mt-5 divide-y divide-slate-100">{pairSpace.files.map(file => <div key={file.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium text-slate-800">{file.name || file.fileName || 'Файл'}</p><p className="mt-1 text-xs text-slate-400">{timeAgo(file.createdAt)}</p></div>{file.fileUrl?.startsWith('https://') ? <a href={file.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Открыть</a> : <span className="text-xs text-slate-400">Файл недоступен</span>}</div>)}</div> : <EmptyState title="Материалов пока нет" description="Файлы от преподавателя появятся здесь." />}</Card>
      )}

      {activeTab === 'participants' && (
        <Card><h3 className="font-semibold text-slate-900">Участники</h3><p className="mt-2 text-sm text-slate-500">Список участников пока не возвращается текущим API pair-space.</p></Card>
      )}

      {activeTab === 'attendance' && (
        <Card><div className="flex items-center gap-3"><Icon name="ClipboardCheck" className="h-5 w-5 text-indigo-500" /><div><h3 className="font-semibold text-slate-900">Посещаемость</h3><p className="text-sm text-slate-500">Состояние посещаемости по этой паре.</p></div></div><div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">Данные ещё не возвращаются student API</p><p className="mt-1 text-sm leading-6 text-slate-500">Когда backend начнёт отдавать attendance record, здесь появятся статус и история без изменения структуры Pair Space.</p></div></Card>
      )}

      {activeTab === 'grades' && (
        <Card><div className="flex items-center gap-3"><Icon name="FileText" className="h-5 w-5 text-indigo-500" /><div><h3 className="font-semibold text-slate-900">Оценки</h3><p className="text-sm text-slate-500">Результаты по предмету и этой паре.</p></div></div><div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">Данные ещё не возвращаются student API</p><p className="mt-1 text-sm leading-6 text-slate-500">Раздел готов как контекст, но не показывает выдуманные значения и ждёт отдельного grades contract.</p></div></Card>
      )}

      {activeTab === 'notes' && (
        <Card>
          <div className="flex items-center gap-3"><Icon name="FileText" className="h-5 w-5 text-indigo-500" /><div><h3 className="font-semibold text-slate-900">Личные заметки</h3><p className="text-sm text-slate-500">Сохраняются только на этом устройстве.</p></div></div>
          <textarea value={notes} onChange={e => saveNotes(e.target.value)} placeholder="Запишите важные мысли по занятию..." className="mt-5 min-h-48 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
        </Card>
      )}

      {/* Homeworks */}
      {activeTab === 'homeworks' && (
        <div className="space-y-3">
          {pairSpace?.homeworks.length === 0 ? (
            <EmptyState title="Нет домашних заданий" description="Задания от преподавателя появятся здесь" />
          ) : (
            pairSpace?.homeworks.map(h => (
              <Card key={h.id} padding="sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{h.title}</h3>
                    {h.description && <p className="mt-1 text-sm text-slate-600">{h.description}</p>}
                    {h.deadline && (
                      <p className="mt-2 text-xs text-slate-400">
                        Срок: {new Date(h.deadline).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                  {!h.isCompleted && (
                    <Button size="sm" variant="secondary" loading={homeworkSaving === h.id} onClick={() => void handleSubmitHomework(h.id)}>Сдать</Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Chat */}
      {activeTab === 'discussion' && (
        <div className="space-y-3">
          {pairSpace?.messages.length === 0 ? (
            <EmptyState title="Нет сообщений" description="Начните обсуждение" />
          ) : (
            pairSpace?.messages.map(m => (
              <Card key={m.id} padding="sm">
                <div className="flex items-start gap-3">
                  <Avatar name={m.authorName} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{m.authorName}</span>
                      <span className="text-xs text-slate-400">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{m.text}</p>
                  </div>
                </div>
              </Card>
            ))
          )}

          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Сообщение..."
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            />
            <Button loading={messageSaving} onClick={handleSendMessage} aria-label="Отправить сообщение"><Icon name="Send" className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
