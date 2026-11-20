'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { careerApi } from './api';
import { PagedCareerSelect } from './PagedCareerSelect';
import s from './career.module.css';

type Mode = 'student' | 'center' | 'employer';
type Page<T> = { data: T[]; meta: { page: number; totalPages: number; total: number } };
type Application = {
  id: string;
  status: 'submitted' | 'proposed' | 'confirmed' | 'declined';
  resume: { name: string; headline: string; about: string; skills: string[] };
  startsAt: string | null;
  endsAt: string | null;
  meetingDetails: string;
  updatedAt: string;
};
type Vacancy = {
  id: string;
  title: string;
  description: string;
  kind: 'job' | 'internship';
  companyName: string;
  status: 'pending' | 'open' | 'rejected' | 'closed';
  reviewReason?: string;
  application: Application | null;
};

const root = '/career/vacancies';
const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});
const localTime = new Intl.DateTimeFormat('ru-RU', { timeStyle: 'short' });
const vacancyLabels = { pending: 'На проверке', open: 'Опубликована', rejected: 'Отклонена', closed: 'Закрыта' };
const applicationLabels = { submitted: 'Резюме отправлено', proposed: 'Предложено собеседование', confirmed: 'Собеседование подтверждено', declined: 'Время отклонено' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Действие не выполнено';
const write = <T,>(path: string, method: string, body?: Record<string, unknown>) =>
  careerApi<T>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });

function usePage<T>(endpoint: string, page: number, revision = 0) {
  const [data, setData] = useState<Page<T>>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError('');
    careerApi<Page<T>>(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=15`)
      .then(value => { if (active) setData(value); })
      .catch(reason => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [endpoint, page, revision, retry]);
  return { data, error, repeat: () => setRetry(value => value + 1) };
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (number: number) => void }) {
  if (total < 2) return null;
  return <div className={s.row} aria-label="Страницы">
    <button type="button" className={s.button} disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</button>
    <span aria-live="polite">Страница {page} из {total}</span>
    <button type="button" className={s.button} disabled={page >= total} onClick={() => setPage(page + 1)}>Далее</button>
  </div>;
}

function InterviewDetails({ application }: { application: Application }) {
  const start = application.startsAt ? new Date(application.startsAt) : null;
  const end = application.endsAt ? new Date(application.endsAt) : null;
  return <>
    <p><strong>{applicationLabels[application.status]}</strong></p>
    {start && end && <p>
      <time dateTime={application.startsAt!}>{dateTime.format(start)}</time>
      {' — '}<time dateTime={application.endsAt!}>{(start.toDateString() === end.toDateString() ? localTime : dateTime).format(end)}</time>
    </p>}
    {application.meetingDetails && <p className={s.result}>{application.meetingDetails}</p>}
  </>;
}

function EmployerApplications({ vacancyId }: { vacancyId: string }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const list = usePage<Application>(`${root}/${vacancyId}/applications`, page, revision);

  async function propose(event: FormEvent<HTMLFormElement>, applicationId: string) {
    event.preventDefault();
    setBusy(applicationId);
    setError('');
    try {
      const values = new FormData(event.currentTarget);
      const startsAt = new Date(String(values.get('startsAt')));
      const endsAt = new Date(startsAt.getTime() + Number(values.get('duration')) * 60000);
      await write(`${root}/${vacancyId}/applications/${applicationId}/interview`, 'PUT', {
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), meetingDetails: values.get('meetingDetails'),
      });
      setRevision(value => value + 1);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy('');
    }
  }

  return <div className={s.vacancyActions}>
    {error && <p className={s.error} role="alert">{error}</p>}
    {list.error && <p className={s.error} role="alert">{list.error} <button type="button" className={s.button} onClick={list.repeat}>Повторить</button></p>}
    {!list.data && !list.error && <p role="status">Загружаем отклики…</p>}
    {list.data?.meta.total === 0 && <p>На эту вакансию пока никто не откликнулся.</p>}
    {list.data?.data.map(application => <section key={application.id} className={s.vacancyActions}>
      <h4>{application.resume.name}</h4>
      <p>{application.resume.headline}</p>
      {application.resume.skills.length > 0 && <p>{application.resume.skills.join(', ')}</p>}
      {application.resume.about && <p className={s.result}>{application.resume.about}</p>}
      <InterviewDetails application={application} />
      {['submitted', 'declined'].includes(application.status) && <form className={s.form} onSubmit={event => void propose(event, application.id)}>
        <div className={s.fields}>
          <label className={s.field}>Начало по вашему местному времени<input name="startsAt" type="datetime-local" required /></label>
          <label className={s.field}>Длительность, минуты<input name="duration" type="number" defaultValue={30} min={1} max={480} required /></label>
        </div>
        <label className={s.field}>Место встречи или ссылка<textarea name="meetingDetails" minLength={3} maxLength={1000} required /></label>
        <button className={s.button} disabled={Boolean(busy)}>Предложить собеседование</button>
      </form>}
    </section>)}
    {list.data && <Pager page={page} total={list.data.meta.totalPages} setPage={setPage} />}
  </div>;
}

interface Props {
  mode: Mode;
  companies: { id: string; name: string }[];
  hasProfile: boolean;
  onOpenProfile: () => void;
}

export function VacanciesPanel({ mode, companies, hasProfile, onOpenProfile }: Props) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const list = usePage<Vacancy>(`${root}?workspace=${mode}`, page, revision);

  const mutate = useCallback(async (path: string, method: string, message: string, body?: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await write(path, method, body);
      setRevision(value => value + 1);
      setStatus(message);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (await mutate(root, 'POST', 'Вакансия отправлена в карьерный центр.', values)) {
      form.reset();
      setPage(1);
    }
  }

  return <section className={s.section} aria-labelledby="vacancies-heading">
    <h2 id="vacancies-heading">Вакансии и стажировки</h2>
    {mode === 'employer' && <details className={`${s.card} ${s.section}`}>
      <summary>Новая вакансия</summary>
      {companies.length ? <form className={s.form} onSubmit={event => void create(event)}>
        <label className={s.field}>Компания<select name="companyId" required>
          <option value="">Выберите</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select></label>
        <PagedCareerSelect endpoint="/career/universities?workspace=employer" name="organizationId" label="Вуз"
          itemLabel={item => item.name || item.id} emptyText="В списке пока нет доступных вузов." required />
        <p className={s.muted}>Публикация доступна для подтверждённых партнёров вуза после проверки карьерным центром.</p>
        <label className={s.field}>Тип<select name="kind"><option value="job">Вакансия</option><option value="internship">Стажировка</option></select></label>
        <label className={s.field}>Название<input name="title" minLength={3} maxLength={160} required /></label>
        <label className={s.field}>Обязанности, требования и условия<textarea name="description" minLength={10} maxLength={6000} required /></label>
        <button className={`${s.button} ${s.primary}`} disabled={busy}>Отправить на проверку</button>
      </form> : <p>Добавьте компанию в разделе «Компания», чтобы отправить вакансию на проверку.</p>}
    </details>}
    {status && <p className={s.success} role="status">{status}</p>}
    {error && <p className={s.error} role="alert">{error}</p>}
    {list.error && <p className={s.error} role="alert">{list.error} <button type="button" className={s.button} onClick={list.repeat}>Повторить</button></p>}
    {!list.data && !list.error && <p role="status">Загружаем вакансии…</p>}
    {list.data?.meta.total === 0 && <p className={s.empty}>В этом кабинете пока нет вакансий.</p>}
    <div className={s.taskList}>
      {list.data?.data.map(vacancy => <article key={vacancy.id} className={s.card}>
        <div className={s.row}>
          <span className={s.tag}>{vacancy.kind === 'job' ? 'Вакансия' : 'Стажировка'}</span>
          <span className={s.muted}>{vacancyLabels[vacancy.status]}</span>
        </div>
        <h3 className={s.vacancyTitle}>{vacancy.title}</h3>
        <p>{vacancy.companyName}</p>
        <p className={s.result}>{vacancy.description}</p>
        {mode !== 'student' && vacancy.reviewReason && <p>{vacancy.reviewReason}</p>}
        {mode === 'student' && vacancy.status === 'open' && !vacancy.application && (
          hasProfile ? <details className={s.vacancyActions}>
            <summary>Откликнуться</summary>
            <p>Работодатель получит ваше имя, описание опыта и навыки из профессионального профиля.</p>
            <button type="button" className={s.button} disabled={busy} onClick={() => void mutate(`${root}/${vacancy.id}/application`, 'PUT', 'Резюме отправлено.')}>Отправить резюме</button>
          </details> : <button type="button" className={s.button} onClick={onOpenProfile}>Заполнить профиль для отклика</button>
        )}
        {mode === 'student' && vacancy.application && <div className={s.vacancyActions}>
          <InterviewDetails application={vacancy.application} />
          {vacancy.application.status === 'proposed' && <div className={s.row}>
            {(['confirmed', 'declined'] as const).map(decision => {
              const application = vacancy.application!;
              return <button type="button" key={decision} className={s.button} disabled={busy} onClick={() =>
                void mutate(`${root}/applications/${application.id}/interview`, 'PATCH',
                  decision === 'confirmed' ? 'Собеседование подтверждено.' : 'Время отклонено.',
                  { decision, updatedAt: application.updatedAt })}>
                {decision === 'confirmed' ? 'Проверить расписание и подтвердить' : 'Отклонить время'}
              </button>;
            })}
          </div>}
        </div>}
        {mode === 'center' && vacancy.status === 'pending' && <form className={s.form} onSubmit={event => {
          event.preventDefault();
          const values = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
          void mutate(`${root}/${vacancy.id}/review`, 'PATCH', 'Решение сохранено.', Object.fromEntries(values));
        }}>
          <label className={s.field}>Комментарий к решению<textarea name="reason" maxLength={1000} /></label>
          <div className={s.row}>
            <button className={s.button} name="decision" value="open" disabled={busy}>Опубликовать</button>
            <button className={s.button} name="decision" value="rejected" disabled={busy}>Отклонить</button>
          </div>
        </form>}
        {mode === 'employer' && <div className={s.vacancyActions}>
          <div className={s.row}>
            <button type="button" className={s.button} aria-expanded={expanded === vacancy.id} onClick={() => setExpanded(current => current === vacancy.id ? undefined : vacancy.id)}>Отклики</button>
            {['open', 'pending'].includes(vacancy.status) && <button type="button" className={s.button} disabled={busy}
              onClick={() => void mutate(`${root}/${vacancy.id}/close`, 'PATCH', 'Вакансия закрыта.')}>Закрыть вакансию</button>}
          </div>
          {expanded === vacancy.id && <EmployerApplications vacancyId={vacancy.id} />}
        </div>}
      </article>)}
    </div>
    {list.data && <Pager page={page} total={list.data.meta.totalPages} setPage={setPage} />}
  </section>;
}
