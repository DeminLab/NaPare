'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, getUser } from '@/lib/api';
import { Card, Badge, Button, Input, TabBar, EmptyState, Avatar, Skeleton, Modal } from '@/components/ui';

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
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [homeworkDeadline, setHomeworkDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleCreateAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setSubmitting(true);
    try {
      const a = await apiFetch<Announcement>(`/pair-spaces/${lessonId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ text: announcementText }),
      });
      setPairSpace(prev => prev ? { ...prev, announcements: [...prev.announcements, a] } : prev);
      setAnnouncementText('');
      setShowAnnouncementModal(false);
    } catch {}
    setSubmitting(false);
  };

  const handleCreateHomework = async () => {
    if (!homeworkTitle.trim()) return;
    setSubmitting(true);
    try {
      const h = await apiFetch<Homework>(`/pair-spaces/${lessonId}/homeworks`, {
        method: 'POST',
        body: JSON.stringify({ title: homeworkTitle, description: homeworkDescription, deadline: homeworkDeadline || undefined }),
      });
      setPairSpace(prev => prev ? { ...prev, homeworks: [...prev.homeworks, h] } : prev);
      setHomeworkTitle('');
      setHomeworkDescription('');
      setHomeworkDeadline('');
      setShowHomeworkModal(false);
    } catch {}
    setSubmitting(false);
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
              <Badge variant="purple">{typeLabels[lesson.subjectType] || lesson.subjectType}</Badge>
              {lesson.groupName && <span>{lesson.groupName}</span>}
              {lesson.room && <span>а. {lesson.room}</span>}
            </div>
          </Card>
        )}
      </div>

      <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'announcements' && (
        <div className="space-y-3">
          <Button variant="secondary" fullWidth onClick={() => setShowAnnouncementModal(true)}>
            + Новое объявление
          </Button>
          {pairSpace?.announcements.length === 0 ? (
            <EmptyState title="Нет объявлений" description="Создайте первое объявление для группы" />
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

      {activeTab === 'homeworks' && (
        <div className="space-y-3">
          <Button variant="secondary" fullWidth onClick={() => setShowHomeworkModal(true)}>
            + Новое задание
          </Button>
          {pairSpace?.homeworks.length === 0 ? (
            <EmptyState title="Нет домашних заданий" description="Создайте задание для группы" />
          ) : (
            pairSpace?.homeworks.map(h => (
              <Card key={h.id} padding="sm">
                <div>
                  <h3 className="font-semibold text-slate-900">{h.title}</h3>
                  {h.description && <p className="mt-1 text-sm text-slate-600">{h.description}</p>}
                  {h.deadline && (
                    <p className="mt-2 text-xs text-slate-400">
                      Срок: {new Date(h.deadline).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

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
            <Button onClick={handleSendMessage}>&#10148;</Button>
          </div>
        </div>
      )}

      <Modal open={showAnnouncementModal} onClose={() => setShowAnnouncementModal(false)} title="Новое объявление">
        <div className="space-y-4">
          <textarea
            value={announcementText}
            onChange={e => setAnnouncementText(e.target.value)}
            placeholder="Текст объявления..."
            rows={4}
            className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-100"
          />
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowAnnouncementModal(false)}>Отмена</Button>
            <Button fullWidth loading={submitting} onClick={handleCreateAnnouncement}>Опубликовать</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showHomeworkModal} onClose={() => setShowHomeworkModal(false)} title="Новое задание">
        <div className="space-y-4">
          <Input
            label="Название"
            value={homeworkTitle}
            onChange={e => setHomeworkTitle(e.target.value)}
            placeholder="Название задания"
          />
          <textarea
            value={homeworkDescription}
            onChange={e => setHomeworkDescription(e.target.value)}
            placeholder="Описание (необязательно)"
            rows={3}
            className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-100"
          />
          <Input
            label="Срок сдачи"
            type="date"
            value={homeworkDeadline}
            onChange={e => setHomeworkDeadline(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowHomeworkModal(false)}>Отмена</Button>
            <Button fullWidth loading={submitting} onClick={handleCreateHomework}>Создать</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
