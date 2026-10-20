'use client';

import { useEffect, useState } from 'react';

interface Lesson {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  room: string;
  teacherName: string;
  isChanged: boolean;
  changeDescription: string;
}

export default function MyDayPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/schedule?date=${today}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setLessons(data);
        }
      } catch (error) {
        console.error('Failed to fetch schedule:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC]">
        <div role="status" className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-500 shadow-sm">Загрузка расписания…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">Личный кабинет студента</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Мой день</h1>
        <p className="mb-7 text-sm text-slate-500">Расписание на сегодня</p>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 sm:text-xl">
            Расписание на сегодня
          </h2>

          {lessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <p className="font-semibold text-slate-700">Нет занятий на сегодня</p>
              <p className="mt-1 text-sm text-slate-500">Расписание на этот день пока пустое.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`rounded-xl border p-4 sm:p-5 ${
                    lesson.isChanged
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {lesson.subject}
                      </h3>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-700">
                        {lesson.startTime} - {lesson.endTime}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Аудитория: {lesson.room}
                      </p>
                      <p className="text-sm text-slate-500">
                        Преподаватель: {lesson.teacherName}
                      </p>
                    </div>
                    {lesson.isChanged && (
                      <span className="mt-3 inline-flex rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 sm:mt-0">
                        Изменение: {lesson.changeDescription}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
