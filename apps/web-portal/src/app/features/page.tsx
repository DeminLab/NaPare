import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@napare/ui";
import { PortalFooter } from "../../components/PortalFooter";
import { PortalHeader } from "../../components/PortalHeader";
import { ProductShowcase } from "../../components/ProductShowcase";

export const metadata: Metadata = {
  title: "Возможности — НаПаре",
  description:
    "Возможности НаПаре: расписание и изменения, пространство пары, материалы, задания, статусы отсутствий и практика у работодателей.",
  alternates: { canonical: "/features" },
};

const lessonFeatures = [
  {
    icon: "refresh" as IconName,
    title: "Расписание и изменения",
    text: "Новое время и аудитория сразу видны у нужной пары — без переписки и ручного поиска.",
  },
  {
    icon: "bell" as IconName,
    title: "Уведомления",
    text: "Внутренние события ведут к паре с обновлёнными данными и не теряются среди сообщений.",
  },
  {
    icon: "layers" as IconName,
    title: "Материалы рядом",
    text: "Объявления, файлы и обсуждение собраны в пространстве конкретного занятия.",
  },
  {
    icon: "clipboard" as IconName,
    title: "Подготовка к паре",
    text: "Личный прогресс — в НаПаре. Сдача работ и оценки остаются в Moodle.",
  },
] as const;

const roles = [
  {
    title: "Студентам",
    icon: "book" as IconName,
    text: "Актуальное расписание на день и неделю, изменения пар, дедлайны и статусы отсутствий — без десятка чатов.",
    bullets: [
      "«Сегодня» — сводка на сейчас",
      "Материалы и обсуждение занятия",
      "Статус отсутствия в пару кликов",
    ],
  },
  {
    title: "Преподавателям",
    icon: "users" as IconName,
    text: "Объявления, подготовка к паре и файлы публикуются в контексте занятия — группа видит их сразу.",
    bullets: [
      "Быстрая подготовка к паре",
      "Список отсутствующих",
      "Материалы и обсуждение уроков",
    ],
  },
  {
    title: "Университетам",
    icon: "building" as IconName,
    text: "Одна цифровая среда для учебной работы — от структуры вуза и ролей до расписания и контроля изменений.",
    bullets: [
      "Прозрачная работа деканата и кураторов",
      "Структура вуза и пользователи",
      "Загрузка и синхронизация расписания",
    ],
  },
] as const;

const connectors = [
  ["01", "Excel и CSV", "Проверка файла и импорт расписания с понятным отчётом об ошибках."],
  ["02", "iCal", "Подключение календаря и обновление занятий из внешнего источника."],
  ["03", "Moodle", "Связь учебного курса с парами, заданиями и материалами занятия."],
  ["04", "СИБИТ и РУЭ", "Отдельные коннекторы для источников расписания этих университетов."],
] as const;

const career = [
  ["Студенту", "Задачи с понятными сроками и нагрузкой можно совмещать с учёбой. Принятые работы и отзывы пополняют портфолио."],
  ["Работодателю", "Опубликуйте задачу, выберите исполнителя, примите результат и оставьте отзыв."],
  ["Карьерному центру", "Проверяйте профили и достижения студентов, управляйте допусками и работайте с компаниями-партнёрами."],
] as const;

export default function FeaturesPage() {
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
            <p className="eyebrow">Возможности</p>
            <h1>Учебный день собран в одном месте</h1>
            <p className="lead">
              Расписание и изменения, материалы занятия, задания, статусы
              отсутствий и первый профессиональный опыт — в одной понятной среде.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="primary-action">
                Войти в кабинет <Icon name="arrow-right" size={17} />
              </Link>
              <Link href="/career" className="secondary-action">
                Открыть практику
              </Link>
            </div>
            <ul className="hero-points" aria-label="Что даёт НаПаре">
              <li>
                <Icon name="check" size={16} /> Всё вокруг конкретной пары
              </li>
              <li>
                <Icon name="check" size={16} /> Понятный день без лишних экранов
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="classroom" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Пространство пары</p>
            <h2 className="section-title">Каждая пара — отдельный контекст</h2>
            <p className="section-lead center">
              Преподаватель, группа, файлы, задания, объявления, обсуждение,
              история изменений и посещаемость собраны в одной карточке занятия.
            </p>
          </div>
          <div className="feature-grid">
            {lessonFeatures.map((item) => (
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

      <section id="day" className="section section-alt">
        <div className="section-inner split">
          <div>
            <p className="eyebrow">Мой день</p>
            <h2 className="section-title">Сводка на сейчас, а не поиск по чатам</h2>
            <p className="section-lead">
              Персональная сводка собирает расписание, изменения, дедлайны и
              статусы отсутствий в один поток.
            </p>
            <ul className="pain-list">
              <li>Что изменилось на сегодня</li>
              <li>К какой паре готовиться дальше</li>
              <li>Где лежат материалы и задания</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">Центр статуса</p>
            <h2 className="section-title">Пропуски фиксируются понятно</h2>
            <p className="section-lead">
              Студент задаёт статус отсутствия, система рассчитывает затронутые
              пары, куратор подтверждает или отклоняет.
            </p>
            <div className="flow" aria-label="Логика статуса отсутствия">
              <span>Студент</span>
              <Icon name="arrow-right" size={16} />
              <span>Расчёт пар</span>
              <Icon name="arrow-right" size={16} />
              <span>Подтверждение куратора</span>
            </div>
            <p className="section-note">
              История остаётся в системе: видно, какие пары затронуты и кто
              принял решение.
            </p>
          </div>
        </div>
      </section>

      <section id="roles" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Роли</p>
            <h2 className="section-title">Своя рабочая поверхность для каждой роли</h2>
            <p className="section-lead center">
              Общий язык интерфейса, разные приоритеты. После входа НаПаре
              открывает нужный кабинет автоматически.
            </p>
          </div>
          <div className="role-grid role-grid-page" aria-label="Возможности по ролям">
            {roles.map((role) => (
              <article key={role.title}>
                <span className="role-icon" aria-hidden="true">
                  <Icon name={role.icon} size={20} />
                </span>
                <h3>{role.title}</h3>
                <p>{role.text}</p>
                <ul className="role-bullets">
                  {role.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="product-overview section">
        <div className="section-inner product-overview-inner">
          <div className="product-overview-copy">
            <p className="eyebrow">Интерфейс продукта</p>
            <h2 className="section-title">Учебный день — в одном понятном окне</h2>
            <p className="section-lead">
              Расписание, изменения аудиторий, подготовка к занятию и посещаемость
              связаны с конкретной парой. Сдача работ и оценки остаются в Moodle.
            </p>
            <ul className="product-overview-points">
              <li>Актуальное расписание на сегодня</li>
              <li>Объявления преподавателей рядом с парой</li>
              <li>Понятный личный кабинет без лишних экранов</li>
            </ul>
          </div>
          <ProductShowcase />
        </div>
      </section>

      <section id="connectors" className="section section-alt">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Подключение расписания</p>
            <h2 className="section-title">Коннекторы под разные источники</h2>
            <p className="section-lead center">
              Универсальный интерфейс получения расписания: от файла до внешней
              системы университета.
            </p>
          </div>
          <div className="steps">
            {connectors.map(([number, title, text]) => (
              <article key={number}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="career" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Практика и работа</p>
            <h2 className="section-title">От учебных навыков к задачам работодателей</h2>
            <p className="section-lead center">
              Студент, карьерный центр и компания работают вместе: от допуска к
              задаче до принятого результата и отзыва.
            </p>
          </div>
          <div className="role-grid role-grid-page career-grid">
            {career.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="hero-actions career-actions">
            <Link href="/career" className="primary-action">
              Открыть практику и работу
            </Link>
            <Link href="/career/register" className="secondary-action">
              Я работодатель
            </Link>
          </div>
          <p className="career-note">
            Для студентов сервис бесплатен. Онлайн-оплата пока не подключена.
          </p>
        </div>
      </section>

      <section className="final-cta section">
        <div className="section-inner final-cta-inner">
          <p className="eyebrow">Начните сейчас</p>
          <h2 className="section-title">Учёба, практика и поддержка — рядом</h2>
          <p className="section-lead">
            Войдите в свой кабинет или узнайте, как подключить НаПаре для университета.
          </p>
          <div className="hero-actions final-cta-actions">
            <Link href="/login" className="primary-action">
              Войти в кабинет <Icon name="arrow-right" size={17} />
            </Link>
            <a href="mailto:support@napare.ru?subject=Демо%20NaPare" className="secondary-action">
              Обсудить запуск
            </a>
          </div>
        </div>
      </section>

      <PortalFooter />
    </main>
  );
}
