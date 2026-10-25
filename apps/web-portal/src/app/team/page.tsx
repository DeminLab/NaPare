import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./team.css";

export const metadata: Metadata = {
  title: "Команда — НаПаре",
  description: "Команда проекта НаПаре и направления её работы.",
};

const team = [
  {
    name: "Демин Данила Алексеевич",
    role: "Владелец проекта и full-stack-разработчик. Разрабатывает и развивает платформу НаПаре и направление «Карьерный центр».",
    area: "Владелец · разработка",
    initials: "ДД",
  },
  {
    name: "Агафонов Дмитрий Юрьевич",
    role: "Системный администратор. Отвечает за серверы и инфраструктуру проекта.",
    area: "Серверная инфраструктура",
    initials: "АД",
  },
  {
    name: "Кузюков Виктор Александрович",
    role: "UI/UX-дизайнер и frontend-разработчик. Проектирует интерфейс платформы и реализует его в веб-приложении.",
    area: "Дизайн интерфейса · frontend",
    initials: "КВ",
  },
  {
    name: "Манахов Кузьма Романович",
    role: "Графический дизайнер. Отвечает за внешнее визуальное оформление проекта.",
    area: "Внешнее оформление",
    initials: "МК",
  },
  {
    name: "Зырянов Антон Николаевич",
    role: "UI/UX-дизайнер и frontend-разработчик. Работает над дизайном платформы и его реализацией в интерфейсе.",
    area: "Дизайн интерфейса · frontend",
    initials: "ЗА",
  },
  {
    name: "Степашин Глеб Васильевич",
    role: "Администратор «Карьерного центра». Отвечает за работу направления.",
    area: "Карьерный центр",
    initials: "ГС",
  },
] as const;

export default function TeamPage() {
  return (
    <main className="team-page">
      <header className="team-topbar">
        <Link href="/" className="team-brand">
          <Image src="/brand/np-mark.png" alt="" width={34} height={34} unoptimized />
          НаПаре
        </Link>
        <Link href="/" className="team-back">На главную</Link>
      </header>

      <section className="team-content" aria-labelledby="team-title">
        <div className="team-intro">
          <p className="team-kicker">Проект НаПаре</p>
          <h1 id="team-title">Команда</h1>
          <p className="team-lead">
            Люди, которые проектируют, разрабатывают и поддерживают платформу
            и Карьерный центр.
          </p>
        </div>

        <ul className="team-list" aria-label="Участники команды и их обязанности">
          {team.map((person) => (
            <li className="team-member" key={person.name}>
              <span className="team-monogram" aria-hidden="true">{person.initials}</span>
              <div className="team-member-copy">
                <h2>{person.name}</h2>
                <p>{person.role}</p>
              </div>
              <span className="team-area">{person.area}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="team-footer">
        <Link href="/">НаПаре</Link>
        <span>© 2026 НаПаре</span>
        <Link href="/privacy">Политика конфиденциальности</Link>
      </footer>
    </main>
  );
}
