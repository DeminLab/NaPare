'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, getUser } from '@/lib/api';
import { Card, Badge, Button, Input, TabBar, EmptyState, Avatar, Skeleton } from '@/components/ui';

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
  const [activeTab, setActiveTab] = useState('announcements');
  const [pairSpace, setPairSpace] = useState<PairSpace | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<PairSpace>(`/pair-spaces/${lessonId}`),
      apiFetch<Lesson>(`/schedule/lessons/${lessonId}`),
    ]).then(([ps, l]) => {
      setPairSpace(ps);
      setLesson(l);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [lessonId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const msg = await apiFetch<Message>(`/pair-spaces/${lessonId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: newMessage }),
      });
      setPairSpace(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setNewMessage('');
    } catch {}
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const tabs = [
    { id: 'announcements', label: 'Объявления', count: pairSpace?.announcements.length },
    { id: 'homeworks', label: 'Домашки', count: pairSpace?.homeworks.length },
    { id: 'chat', label: 'Чат', count: pairSpace?.messages.length },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>
        {lesson && (
          <Card>
            <h1 className="text-xl font-bold text-slate-900">{lesson.subject}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-500">
              <Badge variant="sky">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge>
              {lesson.groupName && <span>{lesson.groupName}</span>}
              {lesson.teacherName && <span>{lesson.teacherName}</span>}
              {lesson.room && <span>а. {lesson.room}</span>}
            </div>
          </Card>
        )}
      </div>

      <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Announcements */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {pairSpace?.announcements.length === 0 ? (
            <EmptyState title="Нет объявлений" description="Объявления от преподавателя появятся здесь" />
          ) : (
            pairSpace?.announcements.map(a => (
              <Card key={a.id} padding="sm" className={a.isPinned ? 'border-amber-200 bg-amber-50/50' : ''}>
                <div className="flex items-start gap-3">
                  <span className="text-lg">{a.isPinned ? '📌' : '💬'}</span>
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
                    <h3 className="font-semibold text-slate-900">📝 {h.title}</h3>
                    {h.description && <p className="mt-1 text-sm text-slate-600">{h.description}</p>}
                    {h.deadline && (
                      <p className="mt-2 text-xs text-slate-400">
                        Срок: {new Date(h.deadline).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                  {!h.isCompleted && (
                    <Button size="sm" variant="secondary">Сдать</Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Chat */}
      {activeTab === 'chat' && (
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
            <Button onClick={handleSendMessage}>➤</Button>
          </div>
        </div>
      )}
    </div>
  );
}
