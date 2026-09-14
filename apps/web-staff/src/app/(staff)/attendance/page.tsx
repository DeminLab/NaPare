'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, apiFetchList } from '@/lib/api';
import { Card, Button, EmptyState, Skeleton, Badge, RequestState } from '@/components/ui';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

interface Absence {
  id: string;
  studentId: string;
  isExcused: boolean;
}

interface Lesson {
  id: string;
  subject: string;
  groupName: string;
  startTime: string;
}

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get('group');
  const [students, setStudents] = useState<Student[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    setError('');
    Promise.all([
      apiFetchList<Student>(`/admin/groups/${groupId}/students`),
      apiFetchList<Lesson>(`/schedule/range?startDate=${new Date().toISOString().split('T')[0]}&endDate=${new Date().toISOString().split('T')[0]}`),
    ]).then(([s, l]) => {
      setStudents(s);
      setLessons(l);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить студентов или пары.')).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (!selectedLesson) {
      setAbsences([]);
      return;
    }
    apiFetchList<Absence>(`/absences/lesson/${selectedLesson}`)
      .then(setAbsences)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить отметки посещаемости.'));
  }, [selectedLesson]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    students.forEach(s => {
      initial[s.id] = !absences.some(a => a.studentId === s.id);
    });
    setChecked(initial);
  }, [students, absences]);

  const handleSubmit = async () => {
    if (!selectedLesson) return;
    setSubmitting(true);
    const absentIds = students.filter(s => !checked[s.id]).map(s => s.id);
    try {
      await apiFetch('/absences', {
        method: 'POST',
        body: JSON.stringify({ lessonId: selectedLesson, studentIds: absentIds }),
      });
      setSuccess('Посещаемость сохранена.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить посещаемость.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!groupId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Посещаемость</h1>
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="Выберите группу"
          description="Перейдите из раздела «Группы» и выберите группу"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Посещаемость</h1>
        <p className="text-sm text-slate-500">Отметьте присутствующих студентов</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : error ? (
        <RequestState title="Не удалось загрузить посещаемость" description={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Выберите пару</label>
            <select
              value={selectedLesson}
              onChange={e => setSelectedLesson(e.target.value)}
              className="block min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-100"
            >
              <option value="">— Выберите пару —</option>
              {lessons.map(l => (
                <option key={l.id} value={l.id}>{l.subject} ({l.startTime})</option>
              ))}
            </select>
          </div>

          {selectedLesson && students.length === 0 && (
            <EmptyState title="Нет студентов" description="В этой группе нет студентов" />
          )}

          {selectedLesson && students.length > 0 && (
            <>
              <div className="space-y-2">
                {students.map(student => (
                  <Card key={student.id} padding="sm">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked[student.id] ?? true}
                        onChange={e => setChecked(prev => ({ ...prev, [student.id]: e.target.checked }))}
                        className="h-5 w-5 rounded-lg border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{student.lastName} {student.firstName}</span>
                        {checked[student.id] === false && (
                          <Badge variant="red" size="sm">Пропуск</Badge>
                        )}
                      </div>
                    </label>
                  </Card>
                ))}
              </div>

              <Button fullWidth loading={submitting} onClick={handleSubmit}>
                Сохранить посещаемость
              </Button>
              {success && <p role="status" className="text-center text-sm font-medium text-emerald-700">{success}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
