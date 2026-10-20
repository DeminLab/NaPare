import Link from "next/link";
import Image from "next/image";
import { Icon, type IconName } from "@napare/ui";
import { ProductShowcase } from "../components/ProductShowcase";
import { MaxLaunchAuth } from "../components/MaxLaunchAuth";
import { HomeSessionRestore } from "../components/HomeSessionRestore";

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

const features = [
  { icon: "refresh" as IconName, title: "Расписание и изменения", text: "Новое время и аудитория сразу видны у нужной пары." },
  { icon: "bell" as IconName, title: "Уведомления", text: "Внутренние события ведут к паре с обновлёнными данными." },
  { icon: "layers" as IconName, title: "Материалы рядом", text: "Объявления, файлы и обсуждение собраны в занятии." },
  { icon: "clipboard" as IconName, title: "Подготовка к паре", text: "Личный прогресс — в НаПаре. Сдача и оценки — в Moodle." },
] as const;

const steps = [
  ["01", "Войдите", "Используйте логин и пароль, выданные университетом."],
  [
    "02",
    "Откройте свой кабинет",
    "НаПаре определит вашу роль и откроет нужный кабинет автоматически.",
  ],
  [
    "03",
    "Следите за днём",
    "Расписание, изменения и дедлайны — в одном потоке «Сегодня».",
  ],
  [
    "04",
    "Откройте занятие",
    "Материалы, обсуждение и статусы привязаны к конкретному занятию.",
  ],
] as const;

export default function HomePage() {
  return (
    <main>
      <HomeSessionRestore />
      <MaxLaunchAuth captureOnly />
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
          <a href="#career">Практика</a>
          <a href="#launch">Университету</a>
          <a href="#how">Как начать</a>
          <a href="#faq">Вопросы</a>
        </nav>
        <details className="portal-menu">
          <summary aria-label="Меню сайта" aria-controls="mobile-page-nav">
            <span className="menu-lines" aria-hidden="true"><span /><span /></span>
          </summary>
          <nav id="mobile-page-nav" className="portal-menu-panel" aria-label="Разделы страницы">
            <a href="#problem">Зачем НаПаре</a>
            <a href="#features">Возможности</a>
            <a href="#interface">Интерфейс</a>
            <a href="#roles">Роли</a>
            <a href="#career">Практика</a>
            <a href="#launch">Университету</a>
            <a href="#how">Как начать</a>
            <a href="#faq">Вопросы и поддержка</a>
          </nav>
        </details>
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
            <p className="eyebrow">Учёба и первый профессиональный опыт</p>
            <h1>Учитесь. Пробуйте профессию. Собирайте опыт.</h1>
            <p className="lead">
              Следите за расписанием и изменениями, готовьтесь к парам и
              работайте с материалами занятия. Для первого профессионального
              опыта есть отдельный раздел с задачами работодателей.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="primary-action">
                Войти в кабинет <Icon name="arrow-right" size={17} />
              </Link>
              <Link href="/career/register" className="secondary-action">Я работодатель</Link>
            </div>
            <ul className="hero-points" aria-label="Что даёт НаПаре">
              <li>
                <Icon name="check" size={16} /> Учебные материалы рядом с расписанием
              </li>
              <li>
                <Icon name="check" size={16} /> Принятые работы и отзывы — в портфолио
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Возможности</p>
            <h2 className="section-title">
              От изменения расписания к понятному действию
            </h2>
            <p className="section-lead center">
              Уведомления внутри кабинета, материалы занятия и личные задачи помогают не терять важное.
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

      <section id="interface" className="product-overview section">
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

      <section id="career" className="section">
        <div className="section-inner">
          <div className="section-head">
            <p className="eyebrow">Практика и работа</p>
            <h2 className="section-title">От учебных навыков к задачам работодателей</h2>
            <p className="section-lead center">
              Студент, карьерный центр и компания работают вместе: от допуска к задаче до принятого результата и отзыва.
            </p>
          </div>
          <div className="role-grid role-grid-page career-grid">
            {[
              ["Студенту", "Задачи с понятными сроками и нагрузкой можно совмещать с учёбой. Принятые работы и отзывы пополняют портфолио."],
              ["Работодателю", "Опубликуйте задачу, выберите исполнителя, примите результат и оставьте отзыв."],
              ["Карьерному центру", "Проверяйте профили и достижения студентов, управляйте допусками и работайте с компаниями-партнёрами."],
            ].map(([title, text]) => (
              <article key={title}><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
          <div className="hero-actions career-actions">
            <Link href="/career" className="primary-action">Открыть практику и работу</Link>
            <Link href="/career/register" className="secondary-action">Я работодатель</Link>
          </div>
          <p className="career-note">Для студентов сервис бесплатен. Онлайн-оплата пока не подключена.</p>
        </div>
      </section>

      <section id="problem" className="section section-alt">
        <div className="section-inner split">
          <div>
            <p className="eyebrow">Зачем НаПаре</p>
            <h2 className="section-title">Учебный день разбросан по десяткам мест</h2>
            <p className="section-lead">
              Расписание на сайте вуза, изменения в мессенджере, объявления и материалы
              в переписках, файлы в облаках, отсутствия — устно куратору. Время уходит
              на поиск информации, а не на учёбу.
            </p>
            <ul className="pain-list">
              <li>Неясно, что изменилось на сегодня</li>
              <li>Подготовка к паре и материалы теряются в переписке</li>
              <li>Пропуски сложно зафиксировать и подтвердить</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">В одном контексте</p>
            <h2 className="section-title">От расписания — к контексту пары</h2>
            <p className="section-lead">
              НаПаре связывает день вокруг занятия: у каждой пары есть пространство
              с материалами и статусами, а «Сегодня» собирает главное на сейчас.
            </p>
            <div className="flow" aria-label="Логика продукта">
              <span>Расписание</span><Icon name="arrow-right" size={16} />
              <span>Конкретная пара</span><Icon name="arrow-right" size={16} />
              <span>Контекст пары</span>
            </div>
            <p className="section-note">
              Преподаватель, группа, файлы, задания, объявления, обсуждение, история
              изменений и посещаемость — в одной карточке урока.
            </p>
          </div>
        </div>
      </section>



      <section id="launch" className="section"><div className="section-inner"><div className="section-head"><p className="eyebrow">Для университета</p><h2 className="section-title">Что нужно для начала работы</h2><p className="section-lead center">Администратор готовит структуру и расписание; студенты и сотрудники получают готовые аккаунты.</p></div><div className="steps">{[["01", "Назначьте администратора", "Определите, кто будет управлять пользователями и данными ВУЗа."], ["02", "Опишите структуру", "Добавьте факультеты и группы, назначьте доступ сотрудникам."], ["03", "Подключите расписание", "Настройте поддерживаемый источник или проверьте файл CSV / JSON перед импортом."], ["04", "Выдайте аккаунты", "Передайте учётные данные студентам и сотрудникам защищённым способом."]].map(([number,title,text]) => <article key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

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
                администратор системы. Работодатели регистрируются самостоятельно в разделе «Практика и работа».
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
                Изменения расписания и другие события доступны в уведомлениях
                внутри кабинета. Учебные задания и сдача работ остаются в Moodle.
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
          <aside className="support-card">
            <span className="feature-icon" aria-hidden="true">
              <Icon name="info" size={20} />
            </span>
            <div>
              <h3>Остались вопросы?</h3>
              <p>Напишите нам — поможем разобраться с доступом и запуском.</p>
            </div>
            <a href="mailto:support@napare.ru" className="support-action">
              Написать в поддержку
            </a>
          </aside>
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

      <footer>
        <div className="footer-row">
          <Link href="/" className="brand footer-brand">
            <Image src="/brand/np-mark.png" alt="" width={34} height={34} unoptimized />
            НаПаре
          </Link>
          <p>
            Расписание, материалы занятий и практика для первого профессионального опыта.
          </p>
          <Link href="/login" className="text-link">
            Войти
          </Link>
          <Link href="/connections" className="text-link">
            Подключить MAX
          </Link>
          <Link href="/team" className="text-link">
            Команда
          </Link>
          <Link href="/privacy" className="text-link">
            Политика конфиденциальности
          </Link>
        </div>
        <p className="footer-copy">
          © 2026 НаПаре · Учебные аккаунты выдаёт университет. Работодатели регистрируются самостоятельно.
        </p>
      </footer>
    </main>
  );
}
