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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Мой день</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Расписание на сегодня
          </h2>

          {lessons.length === 0 ? (
            <p className="text-gray-500">Нет занятий на сегодня</p>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`p-4 rounded-lg border ${
                    lesson.isChanged
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {lesson.subject}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {lesson.startTime} - {lesson.endTime}
                      </p>
                      <p className="text-sm text-gray-500">
                        Аудитория: {lesson.room}
                      </p>
                      <p className="text-sm text-gray-500">
                        Преподаватель: {lesson.teacherName}
                      </p>
                    </div>
                    {lesson.isChanged && (
                      <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded">
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
