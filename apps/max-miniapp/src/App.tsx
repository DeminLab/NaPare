import { useEffect, useState } from 'react';
import { getInitData, initializeMax } from './lib/max-bridge';

type Tab = 'today' | 'schedule' | 'lessons' | 'notifications' | 'profile';

const lessons = [
  { time: '10:15', end: '11:50', title: 'Алгоритмы и структуры данных', room: 'Ауд. 305', teacher: 'Иванов А. В.', current: true },
  { time: '12:20', end: '13:55', title: 'Дискретная математика', room: 'Ауд. 402', teacher: 'Петрова М. С.', current: false },
];

const navigation: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'today', icon: '⌂', label: 'Сегодня' },
  { id: 'schedule', icon: '□', label: 'Расписание' },
  { id: 'lessons', icon: '♧', label: 'Пары' },
  { id: 'notifications', icon: '◌', label: 'Уведомления' },
  { id: 'profile', icon: '♙', label: 'Профиль' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [insideMax, setInsideMax] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    initializeMax().then((app) => setInsideMax(Boolean(app)));
  }, []);

  const title = navigation.find((item) => item.id === tab)?.label;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand">НаПаре</p>
          <p className="subtitle">Всё важное о твоих парах</p>
        </div>
        <button className="avatar" aria-label="Открыть профиль" onClick={() => setTab('profile')}>А</button>
      </header>

      {tab === 'today' ? (
        <section className="screen" aria-labelledby="today-title">
          <div className="screen-heading"><h1 id="today-title">Сегодня</h1><p>16 сентября, вторник</p></div>
          <article className="next-lesson">
            <div className="lesson-status"><span>Следующая пара</span><span>Через 34 минуты</span></div>
            <h2>Алгоритмы и структуры данных</h2>
            <div className="lesson-details"><span>◷ 10:15 — 11:50</span><span>⌖ Ауд. 305</span><span>♙ Иванов А. В.</span></div>
            <div className="deadline"><span>▤</span><div><p>Ближайший дедлайн</p><strong>Сдать лабораторную работу №3</strong></div><time>18 сентября</time></div>
            <button className="absence-button" onClick={() => { setAbsenceOpen(true); setSubmitted(false); }}>Сообщить об отсутствии</button>
          </article>
          <section className="schedule-section" aria-labelledby="schedule-title">
            <div className="section-title"><h2 id="schedule-title">Сегодня в расписании</h2><button onClick={() => setTab('schedule')}>Все пары →</button></div>
            <div className="lesson-list">{lessons.map((lesson) => <button className="lesson-row" key={lesson.time} onClick={() => setTab('lessons')}><time>{lesson.time}<small>{lesson.end}</small></time><span className="divider"/><span className="lesson-copy"><strong>{lesson.title}</strong><small>{lesson.room} · {lesson.teacher}</small></span>{lesson.current && <em>Сейчас</em>}</button>)}</div>
          </section>
        </section>
      ) : (
        <section className="screen secondary-screen" aria-live="polite"><div className="screen-heading"><h1>{title}</h1><p>{tab === 'lessons' ? 'Открой пару, материалы и задания' : 'Раздел подключается к данным НаПаре'}</p></div>{tab === 'lessons' && <article className="lesson-space"><h2>Алгоритмы и структуры данных</h2><p>Лабораторная работа №3 · до 18 сентября</p><a href="#materials">Открыть материалы</a></article>}<p className="empty-state">В демо показан ключевой сценарий «Сегодня». После авторизации через MAX здесь появятся ваши данные.</p>{insideMax && <p className="bridge-state">MAX Bridge подключён. Данные запуска не используются как учётная запись.</p>}{!insideMax && <p className="bridge-state">Режим браузера: MAX Bridge недоступен.</p>}</section>
      )}

      <nav className="bottom-nav" aria-label="Основная навигация">{navigation.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>

      {absenceOpen && <div className="dialog-backdrop" role="presentation"><section className="absence-dialog" role="dialog" aria-modal="true" aria-labelledby="absence-title"><button className="close" aria-label="Закрыть" onClick={() => setAbsenceOpen(false)}>×</button>{submitted ? <><h2 id="absence-title">Заявка отправлена</h2><p>Куратор увидит период отсутствия и комментарий.</p><button className="primary" onClick={() => setAbsenceOpen(false)}>Готово</button></> : <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><h2 id="absence-title">Сообщить об отсутствии</h2><label>Причина<select required defaultValue="learning"><option value="learning">Учебная причина</option><option value="sick">Болезнь</option><option value="other">Другое</option></select></label><div className="date-grid"><label>С<input type="date" required /></label><label>По<input type="date" required /></label></div><label>Комментарий<textarea maxLength={500} placeholder="Необязательно" /></label><button className="primary" type="submit">Отправить заявку</button></form>}</section></div>}
      {getInitData() && <span className="sr-only">MAX launch data available for secure server validation</span>}
    </main>
  );
}
