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
    name: "Кузюков Виктор Александрович",
    role: "Отвечает за дизайн платформы и его реализацию в интерфейсе.",
    area: "Дизайн платформы",
    initials: "КВ",
  },
  {
    name: "Манахов Кузьма Романович",
    role: "Отвечает за внешнее визуальное оформление проекта.",
    area: "Внешний дизайн",
    initials: "МК",
  },
  {
    name: "Зырянов Антон Николаевич",
    role: "Отвечает за дизайн платформы и его реализацию в интерфейсе.",
    area: "Дизайн платформы",
    initials: "ЗА",
  },
  {
    name: "Агафонов Дмитрий Юрьевич",
    role: "Отвечает за системное администрирование серверов проекта.",
    area: "Серверная инфраструктура",
    initials: "АД",
  },
  {
    name: "Демин Данила Алексеевич",
    role: "Разрабатывает платформу НаПаре и направление «Карьерный центр».",
    area: "Разработка",
    initials: "ДД",
  },
  {
    name: "Степашин Глеб Васильевич",
    role: "Отвечает за администрирование Карьерного центра.",
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
