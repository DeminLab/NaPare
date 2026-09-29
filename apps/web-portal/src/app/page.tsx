import Link from "next/link";
import Image from "next/image";
import { Icon, type IconName } from "@napare/ui";
import { ProductShowcase } from "../components/ProductShowcase";
import { MaxLaunchAuth } from "../components/MaxLaunchAuth";

const roles = [
  {
    title: "Студентам",
    icon: "book" as IconName,
    text: "Актуальное расписание на день и неделю, изменения пар, дедлайны и статусы отсутствий — без десятка чатов.",
    bullets: [
      "«Мой день» — сводка на сейчас",
      "Пространство каждой пары",
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
    text: "Одна цифровая среда для учебной операционки — от структуры вуза и ролей до расписания и контроля изменений.",
    bullets: [
      "Прозрачная работа деканата и кураторов",
      "Структура вуза и пользователи",
      "Загрузка и синхронизация расписания",
    ],
  },
] as const;

const features = [
  {
    icon: "calendar" as IconName,
    title: "Расписание без сюрпризов",
    text: "Персональное расписание, история изменений пар и коннекторы: изменения приходят туда, где вы работаете.",
  },
  {
    icon: "layers" as IconName,
    title: "Пространство пары",
    text: "У каждого занятия своя страница: преподаватель, аудитория, объявления, подготовка к паре, файлы и обсуждение — в одном месте.",
  },
  {
    icon: "home" as IconName,
    title: "Мой день",
    text: "Персональная сводка учебного дня: текущая и следующая пара, горящие дедлайны, новые материалы и изменения.",
  },
  {
    icon: "clipboard" as IconName,
    title: "Отсутствия по правилам",
    text: "Статус «болен / работа / другой город» рассчитывается по парам и подтверждается куратором — без устных договорённостей.",
  },
  {
    icon: "bell" as IconName,
    title: "Уведомления по делу",
    text: "Изменения расписания, дедлайны и объявления приходят как уведомления, а не теряются в общих чатах.",
  },
  {
    icon: "dashboard" as IconName,
    title: "Единый вход и роли",
    text: "Один аккаунт открывает нужную поверхность: студент, преподаватель, куратор или деканат — автоматически.",
  },
] as const;

const steps = [
  ["01", "Войдите", "Используйте логин и пароль, выданные университетом."],
  [
    "02",
    "Выберите роль",
    "НаПаре определит роль и откроет своё рабочее пространство.",
  ],
  [
    "03",
    "Следите за днём",
    "Расписание, изменения и дедлайны — в одном потоке «Мой день».",
  ],
  [
    "04",
    "Работайте у пары",
    "Материалы, обсуждение и статусы привязаны к конкретному занятию.",
  ],
] as const;

const modules = [
  ["Расписание", "Получение, хранение и детект изменений занятий"],
  [
    "Пространство пары",
    "Объявления, подготовка к занятию, файлы и обсуждение урока",
  ],
  ["Мой день", "Агрегированная сводка для главного экрана студента"],
  ["Отсутствия", "Статусы пропусков и подтверждение куратором"],
  ["Уведомления", "Push и in-app оповещения о важных событиях"],
  ["Администрирование", "Структура вуза, роли, импорт расписания"],
] as const;

export default function HomePage() {
  return (
    <main>
      <MaxLaunchAuth />
      <header className="portal-header">
        <Link href="/" className="brand">
          <Image
            src="/brand/np-mark.png"
            alt=""
            width={34}
            height={34}
            priority
            unoptimized
          />
          НаПаре
        </Link>
        <nav className="portal-nav" aria-label="Разделы страницы">
          <a href="#problem">Зачем</a>
          <a href="#features">Возможности</a>
          <a href="#roles">Роли</a>
          <a href="#how">Как начать</a>
          <a href="#faq">Вопросы</a>
        </nav>
        <Link href="/login" className="text-link">
          Войти
        </Link>
      </header>

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
            <p className="eyebrow">Цифровая среда университета</p>
            <h1>
              Университет,
              <br />
              <em>который работает</em> как единая система.
            </h1>
            <p className="lead">
              Расписание, учебный день, подготовка к парам, материалы и коммуникация — в
              одном понятном пространстве для студентов, преподавателей и
              деканата.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="primary-action">
                Войти в НаПаре <Icon name="arrow-right" size={17} />
              </Link>
              <a href="#roles" className="secondary-action">
                Для вашего вуза
              </a>
            </div>
            <ul className="hero-points" aria-label="Ключевые преимущества">
              <li>
                <Icon name="check" size={16} /> Один контур вместо разрозненных
                чатов
              </li>
              <li>
                <Icon name="check" size={16} /> Свой кабинет для каждой роли
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Ценность платформы">
        <div>
          <strong>1</strong>
          <span>понятный контур вместо разрозненных сервисов</span>
        </div>
        <div>
          <strong>3</strong>
          <span>кабинета: студент, преподаватель и ВУЗ</span>
        </div>
        <div>
          <strong>Pair</strong>
          <span>объявления и подготовка привязаны к занятию</span>
        </div>
        <div>
          <strong>LMS</strong>
          <span>сдача заданий и оценки остаются в Moodle</span>
        </div>
      </section>

      <section className="product-overview section">
        <div className="section-inner product-overview-inner">
          <div className="product-overview-copy">
            <p className="eyebrow">Интерфейс продукта</p>
            <h2 className="section-title">
              Учебный день — в одном понятном окне
            </h2>
            <p className="section-lead">
              Расписание, изменения аудиторий, подготовка к занятию и
              посещаемость связаны с конкретной парой. Сдача работ и оценки
              остаются в Moodle.
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

      <section id="problem" className="section section-alt">
        <div className="section-inner split">
          <div>
            <p className="eyebrow">Проблема</p>
            <h2 className="section-title">
              Учебный день разбросан по десяткам мест
            </h2>
            <p className="section-lead">
              Расписание на сайте вуза, изменения в мессенджере, объявления и
              материалы в переписках, файлы в облаках, отсутствия — устно
              куратору. Время уходит на поиск информации, а не на учёбу.
            </p>
            <ul className="pain-list">
              <li>Неясно, что изменилось на сегодня</li>
              <li>Подготовка к паре и материалы теряются в переписке</li>
              <li>Пропуски сложно зафиксировать и подтвердить</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">Решение</p>
            <h2 className="section-title">От расписания — к контексту пары</h2>
            <p className="section-lead">
              НаПаре связывает день вокруг занятия: у каждой пары есть
              пространство с материалами и статусами, а «Мой день» собирает
              главное на сейчас.
            </p>
            <div className="flow" aria-label="Логика продукта">
              <span>Расписание</span>
              <Icon name="arrow-right" size={16} />
              <span>Конкретная пара</span>
              <Icon name="arrow-right" size={16} />
              <span>Контекст пары</span>
            </div>
            <p className="section-note">
              Преподаватель, группа, файлы, задания, объявления, обсуждение,
              история изменений и посещаемость — в одной карточке урока.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Возможности</p>
            <h2 className="section-title">
              Один интерфейс для всей учебной операционки
            </h2>
            <p className="section-lead center">
              Студент видит главное сразу, преподаватель работает с группой,
              университет управляет структурой и расписанием.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((item) => (
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

      <section id="roles" className="section section-alt">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Роли</p>
            <h2 className="section-title">
              Своя рабочая поверхность для каждой роли
            </h2>
            <p className="section-lead center">
              Общий язык интерфейса, разные приоритеты. После входа НаПаре
              открывает нужный кабинет автоматически.
            </p>
          </div>
          <div
            className="role-grid role-grid-page"
            aria-label="Возможности НаПаре"
          >
            {roles.map((role) => (
              <article key={role.title}>
                <span className="role-icon" aria-hidden="true">
                  <Icon name={role.icon} size={20} />
                </span>
                <h2>{role.title}</h2>
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

      <section id="modules" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Модули</p>
            <h2 className="section-title">Из чего собрана платформа</h2>
          </div>
          <div className="module-table" role="list">
            {modules.map(([name, description]) => (
              <div key={name} className="module-row" role="listitem">
                <strong>{name}</strong>
                <span>{description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="section section-alt">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Как начать</p>
            <h2 className="section-title">Четыре шага до рабочего дня</h2>
          </div>
          <div className="steps">
            {steps.map(([number, title, description]) => (
              <article key={number}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="cta-band">
            <div>
              <h3>Пора собрать учебный день в одну систему?</h3>
              <p>
                Студенты получают ясность, преподаватели — контекст, университет
                — управляемую операционку.
              </p>
            </div>
            <div className="cta-actions">
              <Link href="/login" className="primary-action">
                Войти в НаПаре <Icon name="arrow-right" size={17} />
              </Link>
              <a
                href="mailto:support@napare.ru?subject=Демо%20NaPare"
                className="cta-contact"
              >
                Обсудить запуск
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="section-inner faq">
          <div className="section-head">
            <p className="eyebrow">Вопросы</p>
            <h2 className="section-title">Коротко о входе и доступах</h2>
          </div>
          <div className="faq-list">
            <details open>
              <summary>Где взять учётные данные?</summary>
              <p>
                Логин и пароль выдаёт университет: учебная часть или
                администратор системы. Самостоятельная регистрация не нужна.
              </p>
            </details>
            <details>
              <summary>Что произойдёт после входа?</summary>
              <p>
                НаПаре определит вашу роль и откроет нужное пространство:
                студента, преподавателя, куратора или деканат — без отдельных
                адресов.
              </p>
            </details>
            <details>
              <summary>Нужно ли помнить расписание изменений?</summary>
              <p>
                Нет. Изменения пар, новые задания и объявления приходят в «Мой
                день» и уведомления, а не только в чатах.
              </p>
            </details>
            <details>
              <summary>Как учитываются пропуски?</summary>
              <p>
                Студент задаёт статус отсутствия, система рассчитывает
                затронутые пары, куратор подтверждает или отклоняет — история
                остаётся в системе.
              </p>
            </details>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-row">
          <Link href="/" className="brand footer-brand">
            <Image src="/brand/np-mark.png" alt="" width={34} height={34} unoptimized />
            НаПаре
          </Link>
          <p>
            Цифровая среда университета: расписание, пары, посещаемость и
            объявления.
          </p>
          <Link href="/login" className="text-link">
            Войти
          </Link>
          <Link href="/connections" className="text-link">
            Связать Telegram
          </Link>
        </div>
        <p className="footer-copy">
          © 2026 НаПаре · Учётные записи выдаёт университет.
        </p>
      </footer>
    </main>
  );
}
