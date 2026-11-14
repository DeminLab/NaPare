import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@napare/ui";
import { PortalFooter } from "../../components/PortalFooter";
import { PortalHeader } from "../../components/PortalHeader";

export const metadata: Metadata = {
  title: "Команда — НаПаре",
  description: "Команда проекта НаПаре и направления её работы.",
  alternates: { canonical: "/team" },
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

const principles = [
  {
    icon: "layers" as IconName,
    title: "Один продукт, общий контекст",
    text: "Учебный день, материалы занятия и практика связаны между собой, а не живут в отдельных сервисах.",
  },
  {
    icon: "users" as IconName,
    title: "Понятно каждой роли",
    text: "Студент, преподаватель, куратор и университет видят свои приоритеты в знакомом интерфейсе.",
  },
  {
    icon: "lock" as IconName,
    title: "Бережно с данными",
    text: "Доступ ограничен ролью и вузом, а действия с данными остаются прозрачными и проверяемыми.",
  },
] as const;

export default function TeamPage() {
  return (
    <main>
      <PortalHeader />

      <section className="hero">
        <Image
          src="/brand/campus-learning.png"
          alt=""
          aria-hidden="true"
          className="hero-background"
          fill
          priority
          sizes="100vw"
          unoptimized
        />
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Проект НаПаре</p>
            <h1>Команда</h1>
            <p className="lead">
              Люди, которые проектируют, разрабатывают и поддерживают платформу
              и Карьерный центр.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="primary-action">
                Войти в кабинет <Icon name="arrow-right" size={17} />
              </Link>
              <a href="mailto:support@napare.ru" className="secondary-action">
                Написать нам
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="team" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Участники</p>
            <h2 className="section-title">Кто делает НаПаре</h2>
            <p className="section-lead center">
              Разработка, инфраструктура, дизайн и работа с университетами —
              разные направления одной команды.
            </p>
          </div>
          <div className="role-grid role-grid-page" aria-label="Участники команды и их обязанности">
            {team.map((person) => (
              <article key={person.name}>
                <span className="role-icon" aria-hidden="true">
                  {person.initials}
                </span>
                <h3>{person.name}</h3>
                <p>{person.role}</p>
                <ul className="role-bullets">
                  <li>{person.area}</li>
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="principles" className="section section-alt">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Подход</p>
            <h2 className="section-title">Как мы работаем</h2>
            <p className="section-lead center">
              Продукт развивается вокруг учебного дня и задач, которые важно
              решать без лишних экранов.
            </p>
          </div>
          <div className="feature-grid">
            {principles.map((item) => (
              <article key={item.title} className="feature-card">
                <span className="feature-icon" aria-hidden="true">
                  <Icon name={item.icon} size={20} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta section">
        <div className="section-inner final-cta-inner">
          <p className="eyebrow">Связаться</p>
          <h2 className="section-title">Есть вопрос или предложение?</h2>
          <p className="section-lead">
            Напишите нам — поможем с доступом, запуском или обсудим развитие платформы.
          </p>
          <div className="hero-actions final-cta-actions">
            <a href="mailto:support@napare.ru" className="primary-action">
              Написать в поддержку
            </a>
            <Link href="/features" className="secondary-action">
              Возможности
            </Link>
          </div>
        </div>
      </section>

      <PortalFooter />
    </main>
  );
}
