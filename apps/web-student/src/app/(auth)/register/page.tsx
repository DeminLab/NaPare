'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { register, getUniversities, getRaspGroups, type UniversityOption, type RaspGroup } from '@/lib/api';

type Form = { firstName: string; lastName: string; email: string; password: string; confirmPassword: string; university: string; groupId: string };
const initial: Form = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '', university: '', groupId: '' };

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm text-white">Н</span>
      НаПаре
    </Link>
  );
}

function Field({ id, label, value, onChange, type = 'text', placeholder, error, autoComplete }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: string; placeholder: string; error?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input id={id} name={id} type={type} value={value} autoComplete={autoComplete}
        onChange={event => onChange(event.target.value)} placeholder={placeholder}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-indigo-100 ${error ? 'border-red-400' : 'border-slate-200 focus:border-indigo-400'}`} />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function GroupSelect({ value, onChange, error, groups, loading }: { value: string; onChange: (v: string) => void; error?: string; groups: RaspGroup[]; loading: boolean }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.faculty.toLowerCase().includes(q)
    );
  }, [groups, search]);

  const selected = groups.find(g => g.groupId === value);

  return (
    <div>
      <label htmlFor="group" className="mb-2 block text-sm font-medium text-slate-700">Группа</label>
      {selected && (
        <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">
          <span className="font-medium text-indigo-700">{selected.name}</span>
          <span className="ml-2 text-indigo-500">· {selected.faculty}</span>
          <span className="ml-2 text-indigo-400">· {selected.course} курс</span>
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={loading ? 'Загрузка групп...' : 'Поиск группы...'}
        disabled={loading}
        className="mb-2 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
      />
      <select id="group" name="group" value={value}
        onChange={event => onChange(event.target.value)}
        size={8}
        aria-invalid={!!error} aria-describedby={error ? 'group-error' : undefined}
        className={`min-h-[180px] w-full rounded-xl border bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-indigo-100 ${error ? 'border-red-400' : 'border-slate-200 focus:border-indigo-400'}`}>
        {loading && <option value="" disabled>Загрузка...</option>}
        {!loading && filtered.length === 0 && <option value="" disabled>Группы не найдены</option>}
        {!loading && filtered.map(g => (
          <option key={g.groupId} value={g.groupId}>{g.name} — {g.faculty} ({g.course} курс)</option>
        ))}
      </select>
      {error && <p id="group-error" className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ProfilePreview({ form, groups, universities }: { form: Form; groups: RaspGroup[]; universities: UniversityOption[] }) {
  const uni = universities.find(u => u.id === form.university);
  const group = groups.find(g => g.groupId === form.groupId);
  return (
    <aside className="sticky top-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(30,64,175,0.10)]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <span className="text-sm font-semibold text-slate-500">Предпросмотр профиля</span>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">Новый профиль</span>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
          {(form.firstName[0] || 'Н')}{(form.lastName[0] || 'П')}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{form.firstName || form.lastName ? `${form.firstName} ${form.lastName}` : 'Ваше имя'}</p>
          <p className="text-xs text-slate-400">Студент</p>
        </div>
      </div>
      <div className="mt-6 divide-y divide-slate-100 rounded-xl bg-slate-50 px-4">
        <div className="py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Email</p>
          <p className="mt-1 truncate text-sm text-slate-700">{form.email || 'you@university.ru'}</p>
        </div>
        <div className="py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Группа</p>
          <p className="mt-1 text-sm text-slate-700">{group ? `${group.name} · ${group.faculty}` : 'Группа не выбрана'}</p>
          {group && <p className="mt-1 text-xs text-slate-400">{group.course} курс</p>}
        </div>
        <div className="py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Университет</p>
          <p className="mt-1 truncate text-sm text-slate-700">{uni?.name || 'СИБИТ'}</p>
        </div>
      </div>
      <div className="mt-5 flex gap-2 text-xs text-slate-500">
        <span className="text-emerald-600">✓</span> Профиль можно дополнить позже
      </div>
    </aside>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [universitiesError, setUniversitiesError] = useState('');
  const [groups, setGroups] = useState<RaspGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');

  useEffect(() => {
    getUniversities().then(unis => {
      setUniversities(unis);
      if (unis.length === 1) {
        setForm(prev => ({ ...prev, university: unis[0].id }));
      }
    }).catch(err => setUniversitiesError(err instanceof Error ? err.message : 'Не удалось загрузить СИБИТ'));
    getRaspGroups().then(setGroups).catch(err => setGroupsError(err instanceof Error ? err.message : 'Не удалось загрузить группы')).finally(() => setGroupsLoading(false));
  }, []);

  const update = (key: keyof Form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
    setError('');
  };

  const validate = (current: number) => {
    const next: Record<string, string> = {};
    if (current === 1) {
      if (!form.firstName.trim()) next.firstName = 'Введите имя';
      if (!form.lastName.trim()) next.lastName = 'Введите фамилию';
      if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Введите корректный email';
      if (form.password.length < 6) next.password = 'Минимум 6 символов';
      if (form.password !== form.confirmPassword) next.confirmPassword = 'Пароли не совпадают';
    }
    if (current === 2) {
      if (universitiesError || universities.length === 0) next.university = 'СИБИТ временно недоступен. Повторите попытку позже';
      if (groupsError) next.groupId = 'Список групп временно недоступен. Повторите попытку позже';
      else if (!form.groupId) next.groupId = 'Выберите группу';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const nextStep = () => { setError(''); if (validate(step)) setStep(step + 1); };

  const submit = async () => {
    if (!validate(2)) return;
    setLoading(true);
    setError('');
    try {
      const uniId = form.university || universities[0]?.id || '';
      await register({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, universityId: uniId, groupId: form.groupId });
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать аккаунт');
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Brand />
            <span className="text-sm text-slate-500">Аккаунт создан</span>
          </div>
        </header>
        <section className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
            <h1 className="mt-6 text-3xl font-bold text-slate-950">Ваш профиль готов</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Теперь у вас есть доступ к расписанию, парам и учебным уведомлениям.</p>
            <button onClick={() => router.push('/today')} className="mt-8 min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
              Перейти в НаПаре →
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Brand />
          <p className="text-sm text-slate-500">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Войти</Link>
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-12">
        <section className="min-w-0">
          <div className="mb-9 flex max-w-xl items-center">
            <div className="flex flex-1 items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
              <span className="hidden text-sm font-semibold text-slate-700 sm:block">Аккаунт</span>
            </div>
            <div className={`h-px flex-1 ${step > 1 ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            <div className="flex flex-1 items-center justify-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
              <span className="hidden text-sm font-semibold text-slate-700 sm:block">Группа</span>
            </div>
            <div className={`h-px flex-1 ${step > 2 ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            <div className="flex flex-1 items-center justify-end gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
              <span className="hidden text-sm font-semibold text-slate-700 sm:block">Готово</span>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-semibold text-indigo-600">Шаг {step} из 3</p>

            {step === 1 && (
              <>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Создайте аккаунт</h1>
                <p className="mt-2 text-sm text-slate-500">Основные данные для входа в НаПаре.</p>
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <Field id="firstName" label="Имя" value={form.firstName} onChange={v => update('firstName', v)} placeholder="Иван" autoComplete="given-name" error={errors.firstName} />
                  <Field id="lastName" label="Фамилия" value={form.lastName} onChange={v => update('lastName', v)} placeholder="Иванов" autoComplete="family-name" error={errors.lastName} />
                </div>
                <div className="mt-5 grid gap-5">
                  <Field id="email" label="Email" value={form.email} onChange={v => update('email', v)} type="email" placeholder="you@university.ru" autoComplete="email" error={errors.email} />
                  <Field id="password" label="Пароль" value={form.password} onChange={v => update('password', v)} type="password" placeholder="Минимум 6 символов" autoComplete="new-password" error={errors.password} />
                  <Field id="confirmPassword" label="Подтвердите пароль" value={form.confirmPassword} onChange={v => update('confirmPassword', v)} type="password" placeholder="Ещё раз" autoComplete="new-password" error={errors.confirmPassword} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Выберите группу</h1>
                <p className="mt-2 text-sm text-slate-500">Данные СИБИТа загружаются с сайта rasp.sano.ru</p>
                <div className="mt-8 grid gap-5">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Вуз</p>
                    <p className="mt-1 text-sm font-semibold text-indigo-900">СИБИТ · Омск</p>
                  </div>
                  {errors.university && <p className="-mt-3 text-xs text-red-600">{errors.university}</p>}
                  <GroupSelect value={form.groupId} onChange={v => update('groupId', v)} error={errors.groupId} groups={groups} loading={groupsLoading} />
                  {groupsError && <p className="-mt-3 text-xs text-red-600">{groupsError}</p>}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Проверьте данные</h1>
                <p className="mt-2 text-sm text-slate-500">Убедитесь, что всё заполнено верно.</p>
                <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">
                  <div className="flex justify-between gap-5 py-4 text-sm">
                    <span className="text-slate-500">Имя</span>
                    <b className="text-right">{form.firstName} {form.lastName}</b>
                  </div>
                  <div className="flex justify-between gap-5 py-4 text-sm">
                    <span className="text-slate-500">Email</span>
                    <b className="break-all text-right">{form.email}</b>
                  </div>
                  <div className="flex justify-between gap-5 py-4 text-sm">
                    <span className="text-slate-500">Университет</span>
                    <b className="text-right">СИБИТ</b>
                  </div>
                  <div className="flex justify-between gap-5 py-4 text-sm">
                    <span className="text-slate-500">Группа</span>
                    <b className="text-right">{groups.find(g => g.groupId === form.groupId)?.name || '—'}</b>
                  </div>
                  <div className="flex justify-between gap-5 py-4 text-sm">
                    <span className="text-slate-500">Специальность</span>
                    <b className="text-right">{groups.find(g => g.groupId === form.groupId)?.faculty || '—'}</b>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1 || loading}
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:invisible">
                Назад
              </button>
              {step < 3 ? (
                <button type="button" onClick={nextStep}
                  className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
                  Продолжить →
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={loading}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-wait disabled:opacity-60">
                  {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {loading ? 'Создаём...' : 'Создать аккаунт'}
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="hidden lg:block">
          <ProfilePreview form={form} groups={groups} universities={universities} />
        </div>
      </div>
    </main>
  );
}
