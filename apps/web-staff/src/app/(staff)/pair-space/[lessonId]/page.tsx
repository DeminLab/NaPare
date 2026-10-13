"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { lessonTabFromSearch } from "@napare/ui/workspace-shell";
import { apiFetch } from "@/lib/api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  RequestState,
  Skeleton,
  TabBar,
} from "@/components/ui";

interface Announcement {
  id: string;
  text: string;
  isPinned: boolean;
  authorName?: string;
  createdAt: string;
}
interface Homework {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  isCompleted?: boolean;
}
interface Message {
  id: string;
  text: string;
  authorName?: string;
  createdAt: string;
}
interface FileItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
  createdAt: string;
}
interface PairSpace {
  id: string;
  lessonId: string;
  moodleUrl?: string;
  announcements: Announcement[];
  homeworks: Homework[];
  messages: Message[];
  files?: FileItem[];
}
interface Lesson {
  id: string;
  subject: string;
  subjectType?: string;
  room?: string;
  startDate?: string;
  startTime: string;
  endTime: string;
  groupName?: string;
  isChanged?: boolean;
  changeDescription?: string;
}

function timeAgo(value: string) {
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`;
  return `${Math.floor(diff / 86400)} дн`;
}

export default function PairSpacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = params.lessonId as string;
  const [activeTab, setActiveTab] = useState(
    lessonTabFromSearch(searchParams.toString()),
  );
  useEffect(() => {
    setActiveTab(lessonTabFromSearch(searchParams.toString()));
  }, [searchParams]);
  const selectTab = (tab: string) => {
    setActiveTab(tab);
    const query = new URLSearchParams(searchParams.toString());
    query.set("tab", tab);
    router.push("/pair-space/" + lessonId + "?" + query.toString(), { scroll: false });
  };
  const [pairSpace, setPairSpace] = useState<PairSpace | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<
    "announcement" | "homework" | "file" | null
  >(searchParams.get("compose") === "homework" ? "homework" : null);
  const [announcementText, setAnnouncementText] = useState("");
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkDescription, setHomeworkDescription] = useState("");
  const [homeworkDeadline, setHomeworkDeadline] = useState("");
  const [file, setFile] = useState({
    fileUrl: "",
    fileName: "",
    fileType: "pdf",
    size: "0",
  });
  const [newMessage, setNewMessage] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<PairSpace>(`/pair-spaces/${lessonId}`),
      apiFetch<Lesson>(`/schedule/lessons/${lessonId}`),
    ])
      .then(([space, currentLesson]) => {
        setPairSpace(space);
        setLesson(currentLesson);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось открыть пространство пары.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [lessonId]);
  const run = async <T,>(
    action: () => Promise<T>,
    message: string,
    update: (value: T) => void,
  ) => {
    if(submitting) return;
    setSuccess("");
    setSubmitting(true);
    setError("");
    try {
      const value = await action();
      update(value);
      setModal(null);
      setSuccess(message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось выполнить действие.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const sendMessage = () => {
    if (submitting || !newMessage.trim()) return;
    void run(
      () =>
        apiFetch<Message>(`/pair-spaces/${lessonId}/messages`, {
          method: "POST",
          body: JSON.stringify({ text: newMessage }),
        }),
      "Сообщение отправлено.",
      (message) => {
        setPairSpace((current) =>
          current
            ? { ...current, messages: [...current.messages, message] }
            : current,
        );
        setNewMessage("");
      },
    );
  };
  if (loading)
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-12" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  if (error && !pairSpace)
    return (
      <div className="mx-auto max-w-[1200px]">
        <RequestState
          title="Не удалось открыть пространство пары"
          description={error}
          onRetry={load}
        />
      </div>
    );
  if (!pairSpace || !lesson)
    return (
      <div className="mx-auto max-w-[1200px]">
        <EmptyState
          title="Пространство пары недоступно"
          description="Для этого занятия пока не создан рабочий контекст."
        />
      </div>
    );
  const tabs = [
    { id: "overview", label: "Главное" },
    { id: "homeworks", label: "Подготовка", count: pairSpace.homeworks.length },
    {
      id: "materials",
      label: "Материалы",
      count: pairSpace.files?.length || 0,
    },
    { id: "discussion", label: "Обсуждение", count: pairSpace.messages.length },
  ];
  const action = (kind: "announcement" | "homework" | "file") => {
    setSuccess("");
    setModal(kind);
  };
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <Icon name="chevron-left" size={16} />
        Назад
      </button>
      <Card className="px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {lesson.subject}
              </h1>
              <Badge variant="sky">Рабочее пространство</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-800">
                {lesson.startTime.includes("T") ? lesson.startTime.slice(11,16) : lesson.startTime}–{lesson.endTime.includes("T") ? lesson.endTime.slice(11,16) : lesson.endTime}
              </span>
              <span>{lesson.startDate ? new Date(lesson.startDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long"}) : "Дата не указана"}</span><span>{lesson.groupName || "Группа не указана"}</span>
              <span>Ауд. {lesson.room || "—"}</span>
              <span>{({ lecture: "Лекция", seminar: "Семинар", practice: "Практика", lab: "Лабораторная", exam: "Экзамен", consultation: "Консультация", other: "Занятие" } as Record<string, string>)[lesson.subjectType || ""] || "Занятие"}</span>
            </div>
            {lesson.isChanged && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {lesson.changeDescription || "Расписание пары изменилось"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/attendance?lesson=${lessonId}`} className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold text-sky-700">Посещаемость пары →</Link>
            {pairSpace.moodleUrl && (
              <a
                href={pairSpace.moodleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
              >
                <Icon name="arrow-right" size={15} />
                Открыть Moodle
              </a>
            )}
            <Button size="sm" onClick={() => action("announcement")}>
              <Icon name="bell" size={15} />
              Объявление
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => action("homework")}
            >
              <Icon name="clipboard" size={15} />
              Подготовка к паре
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => action("file")}
            >
              <Icon name="upload" size={15} />
              Ссылка на материал
            </Button>
          </div>
        </div>
      </Card>
      <TabBar tabs={tabs} activeTab={activeTab} onChange={selectTab} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          {success}
        </p>
      )}
      {activeTab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card padding="sm"><h2 className="text-base font-bold text-slate-900">Объявления для группы</h2><div className="mt-4 space-y-3">{pairSpace.announcements.length ? [...pairSpace.announcements].sort((a,b)=>Number(b.isPinned)-Number(a.isPinned)||b.createdAt.localeCompare(a.createdAt)).map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-center gap-2">{item.isPinned && <Badge variant="sky">Закреплено</Badge>}<span className="text-xs text-slate-500">{timeAgo(item.createdAt)}</span></div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.text}</p></article>) : <p className="text-sm text-slate-500">Опубликуйте организационные детали, чтобы группа увидела их перед занятием.</p>}</div></Card>
          <Card padding="sm"><h2 className="text-base font-bold text-slate-900">Подготовка группы</h2><p className="mt-3 text-sm leading-6 text-slate-600">{pairSpace.homeworks.length} ориентиров · {pairSpace.files?.length || 0} материалов</p>{pairSpace.homeworks.length>0 && <ul className="mt-3 space-y-2">{pairSpace.homeworks.slice(0,3).map(item=><li key={item.id} className="rounded-lg bg-slate-50 p-3"><p className="break-words text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.deadline ? new Date(item.deadline).toLocaleDateString('ru-RU') : 'Без срока'}</p></li>)}</ul>}<Button variant="secondary" fullWidth className="mt-4" onClick={() => selectTab("homeworks")}>Проверить подготовку</Button><p className="mt-4 text-xs leading-5 text-slate-500">Сдачи и оценки остаются в Moodle. Здесь размещайте план подготовки и материалы к этой паре.</p></Card>
        </div>
      )}
      {activeTab === "materials" &&
        (!pairSpace.files?.length ? (
          <EmptyState
            title="Материалов пока нет"
            description="Добавьте ссылку на файл, доступный группе."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pairSpace.files.map((item) => (
              <Card key={item.id} padding="sm">
                <div className="flex items-center gap-3">
                  <Icon name="file" className="text-sky-700" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.fileUrl?.startsWith("https://") ? item.fileUrl : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-semibold text-slate-900 hover:text-sky-700"
                    >
                      {item.fileName}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.fileType?.toUpperCase() || "Материал"} ·{" "}
                      {item.size > 0 ? `${Math.round(item.size / 1024)} KB` : "Размер не указан"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}
      {activeTab === "homeworks" &&
        (!pairSpace.homeworks.length ? (
          <EmptyState
            title="Подготовок пока нет"
            description="Добавьте, что группе нужно подготовить к этому занятию."
          />
        ) : (
          <div className="space-y-3">
            {pairSpace.homeworks.map((item) => (
              <Card key={item.id} padding="sm">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-slate-600">
                      {item.description}
                    </p>
                  )}
                  {item.deadline && (
                    <p className="mt-2 text-xs text-slate-500">
                      Подготовить к:{" "}
                      {new Date(item.deadline).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ))}
      {activeTab === "discussion" && (
        <div className="space-y-3">
          {!pairSpace.messages.length ? (
            <EmptyState
              title="Нет сообщений"
              description="Начните обсуждение с группой."
            />
          ) : (
            pairSpace.messages.map((item) => (
              <Card key={item.id} padding="sm">
                <div className="flex items-start gap-3">
                  <Avatar name={item.authorName || "Участник"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {item.authorName || "Участник"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{item.text}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
          <form onSubmit={event=>{event.preventDefault();sendMessage();}} className="rounded-xl border bg-white p-4"><label htmlFor="staff-discussion" className="text-sm font-semibold">Сообщение группе</label><textarea id="staff-discussion" rows={3} disabled={submitting} value={newMessage} onChange={event=>setNewMessage(event.target.value)} placeholder="Вопрос или пояснение к занятию…" className="mt-3 w-full rounded-xl border p-3 text-sm"/><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Сообщение увидят участники пары.</p><Button type="submit" loading={submitting} disabled={submitting || !newMessage.trim()}>Отправить сообщение</Button></div></form>
        </div>
      )}
      <Modal
        open={modal === "announcement"}
        onClose={() => setModal(null)}
        title="Новое объявление"
      >
        <div className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <textarea
            value={announcementText}
            onChange={(event) => setAnnouncementText(event.target.value)}
            rows={4}
            aria-label="Текст объявления"
            placeholder="Что важно сообщить группе?"
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setModal(null)}
            >
              Отмена
            </Button>
            <Button
              fullWidth
              loading={submitting}
              onClick={() => {
                if (!announcementText.trim()) return;
                void run(
                  () =>
                    apiFetch<Announcement>(
                      `/pair-spaces/${lessonId}/announcements`,
                      {
                        method: "POST",
                        body: JSON.stringify({ text: announcementText }),
                      },
                    ),
                  "Объявление опубликовано.",
                  (item) => {
                    setPairSpace({
                      ...pairSpace,
                      announcements: [...pairSpace.announcements, item],
                    });
                    setAnnouncementText("");
                  },
                );
              }}
            >
              Опубликовать
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={modal === "homework"}
        onClose={() => setModal(null)}
        title="Подготовка к занятию"
      >
        <div className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Input
            label="Что подготовить"
            value={homeworkTitle}
            onChange={(event) => setHomeworkTitle(event.target.value)}
            placeholder="Например, сообщение о применении нейросетей"
          />
          <textarea
            value={homeworkDescription}
            onChange={(event) => setHomeworkDescription(event.target.value)}
            rows={3}
            placeholder="Контекст: тема лекции, формат и что принести"
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <Input
            label="К какой дате"
            type="date"
            value={homeworkDeadline}
            onChange={(event) => setHomeworkDeadline(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setModal(null)}
            >
              Отмена
            </Button>
            <Button
              fullWidth
              loading={submitting}
              onClick={() => {
                if (!homeworkTitle.trim()) return;
                void run(
                  () =>
                    apiFetch<Homework>(`/pair-spaces/${lessonId}/homeworks`, {
                      method: "POST",
                      body: JSON.stringify({
                        title: homeworkTitle,
                        description: homeworkDescription,
                        deadline: homeworkDeadline || undefined,
                      }),
                    }),
                  "Подготовка опубликована.",
                  (item) => {
                    setPairSpace({
                      ...pairSpace,
                      homeworks: [...pairSpace.homeworks, item],
                    });
                    setHomeworkTitle("");
                    setHomeworkDescription("");
                    setHomeworkDeadline("");
                  },
                );
              }}
            >
              Опубликовать
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Сдачи, оценки и критерии остаются в Moodle; здесь — только ориентир
            для конкретной пары.
          </p>
        </div>
      </Modal>
      <Modal
        open={modal === "file"}
        onClose={() => setModal(null)}
        title="Добавить ссылку на материал"
      >
        <div className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Input
            label="Название файла"
            value={file.fileName}
            onChange={(event) =>
              setFile({ ...file, fileName: event.target.value })
            }
            placeholder="lecture-03.pdf"
          />
          <Input
            label="URL файла"
            value={file.fileUrl}
            onChange={(event) =>
              setFile({ ...file, fileUrl: event.target.value })
            }
            placeholder="https://..."
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Тип"
              value={file.fileType}
              onChange={(event) =>
                setFile({ ...file, fileType: event.target.value })
              }
            />
            <Input
              label="Размер, байт"
              type="number"
              value={file.size}
              onChange={(event) =>
                setFile({ ...file, size: event.target.value })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setModal(null)}
            >
              Отмена
            </Button>
            <Button
              fullWidth
              loading={submitting}
              onClick={() => {
                if (!file.fileName.trim() || !file.fileUrl.trim()) return;
                void run(
                  () =>
                    apiFetch<FileItem>(`/pair-spaces/${lessonId}/files`, {
                      method: "POST",
                      body: JSON.stringify({
                        ...file,
                        size: Number(file.size) || 0,
                      }),
                    }),
                  "Материал добавлен.",
                  (item) => {
                    setPairSpace({
                      ...pairSpace,
                      files: [...(pairSpace.files || []), item],
                    });
                    setFile({
                      fileUrl: "",
                      fileName: "",
                      fileType: "pdf",
                      size: "0",
                    });
                  },
                );
              }}
            >
              Добавить
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            API ожидает URL уже загруженного файла; multipart-загрузка пока не
            подключена.
          </p>
        </div>
      </Modal>
    </div>
  );
}
