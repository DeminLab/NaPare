import Link from 'next/link';
import { Icon } from '@napare/ui';

export default function HomePage() {
  return (
    <main>
      <header className="portal-header">
        <Link href="/" className="brand"><span>Н</span>НаПаре</Link>
        <Link href="/login" className="text-link">Войти</Link>
      </header>
      <section className="hero">
        <p className="eyebrow">Цифровая среда университета</p>
        <h1>Учебный день —<br /><em>в одном месте.</em></h1>
        <p className="lead">Расписание, занятия, посещаемость и объявления для студентов, преподавателей и деканата.</p>
        <Link href="/login" className="primary-action">Войти в НаПаре <Icon name="arrow-right" size={17} /></Link>
      </section>
      <section className="role-grid" aria-label="Возможности НаПаре">
        <article><h2>Студентам</h2><p>Актуальное расписание, пространство пары и важные изменения.</p></article>
        <article><h2>Преподавателям</h2><p>Группы, посещаемость и коммуникация со студентами.</p></article>
        <article><h2>Деканату</h2><p>Управление пользователями, структурой и расписанием университета.</p></article>
      </section>
      <footer>© 2026 НаПаре · Учётные записи выдаёт университет.</footer>
    </main>
  );
}
