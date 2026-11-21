import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@napare/ui";
import { PortalFooter } from "../components/PortalFooter";
import { PortalHeader } from "../components/PortalHeader";
import { HomeSessionRestore } from "../components/HomeSessionRestore";
import { MaxLaunchAuth } from "../components/MaxLaunchAuth";
import { ProductShowcase } from "../components/ProductShowcase";
import HomeSEO from "../components/HomeSEO";

export const metadata: Metadata = {
  title: "НаПаре — расписание, учёба и карьера",
  description:
    "Открытое расписание СИБИТа, материалы занятий и карьерные возможности для студентов, университетов и работодателей.",
  alternates: { canonical: "/" },
};

const audienceLinks = [
  {
    href: "/schedule",
    label: "Студентам",
    title: "Найдите расписание своей группы",
    description: "Откройте доступное расписание, а после входа — материалы и изменения к своим занятиям.",
    className: "audience-card audience-card-blue",
    number: "01",
  },
  {
    href: "/career-center",
    label: "Карьерным центрам",
    title: "Соединяйте учёбу и первый опыт",
    description: "Помогайте студентам находить задачи, а компаниям — работать с университетским сообществом.",
    className: "audience-card audience-card-lime",
    number: "02",
  },
  {
    href: "/universities",
    label: "Университетам",
    title: "Развивайте свой контур НаПаре",
    description: "Структура, расписание и права доступа настраиваются для подключённого вуза.",
    className: "audience-card audience-card-violet",
    number: "03",
  },
  {
    href: "/employers",
    label: "Работодателям",
    title: "Предлагайте реальные задачи",
    description: "Расскажите о компании и публикуйте задачи, которые помогают студентам получить опыт.",
    className: "audience-card audience-card-coral",
    number: "04",
  },
] as const;

export default function HomePage() {
  return (
    <main className="public-home">
      <HomeSEO />
      <HomeSessionRestore />
      <MaxLaunchAuth captureOnly />
      <PortalHeader />

      <section className="home-hero">
        <Image
          src="/brand/campus-learning.png"
          alt=""
          aria-hidden="true"
          className="home-hero-image"
          fill
          priority
          sizes="100vw"
          unoptimized
        />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <p className="home-kicker">Площадка для студентов и университетов</p>
            <h1>Учебный день начинается с ясного расписания</h1>
            <p className="home-hero-lead">
              Смотрите открытое расписание, находите материалы к занятиям и
              знакомьтесь с карьерными возможностями — в одной среде.
            </p>
            <div className="home-hero-actions">
              <Link href="/schedule" className="home-action home-action-bright">
                Посмотреть расписание <Icon name="arrow-right" size={17} />
              </Link>
              <Link href="/login" className="home-action home-action-glass">
                Войти в кабинет
              </Link>
            </div>
            <p className="home-hero-footnote">Расписание открыто без входа. Личные функции доступны после авторизации.</p>
          </div>
          <Link href="/schedule" className="home-schedule-link" aria-label="Перейти к открытому расписанию">
            <span className="schedule-art-top"><span>ОТКРЫТОЕ</span><span>РАСПИСАНИЕ</span></span>
            <span className="schedule-art-rule" />
            <span className="schedule-art-bottom">
              <span className="schedule-art-mark" aria-hidden="true"><span /><span /><span /><span /></span>
              <span><strong>Выберите группу</strong><small>Посмотреть занятия и время</small></span>
              <Icon name="arrow-right" size={20} />
            </span>
          </Link>
        </div>
        <a href="#choose-path" className="home-scroll-cue">Выберите свой путь <span aria-hidden="true">↓</span></a>
      </section>

      <section id="choose-path" className="audience-section section">
        <div className="section-inner">
          <div className="public-section-intro">
            <p className="eyebrow">Одна площадка — разные задачи</p>
            <h2>С чего хотите начать?</h2>
            <p>Откройте расписание, узнайте о карьерном центре или посмотрите, как НаПаре помогает вузам и компаниям.</p>
          </div>
          <div className="audience-grid">
            {audienceLinks.map((item) => (
              <Link key={item.href} href={item.href} className={item.className}>
                <span className="audience-card-number">{item.number}</span>
                <span className="audience-card-label">{item.label}</span>
                <strong>{item.title}</strong>
                <span className="audience-card-description">{item.description}</span>
                <span className="audience-card-cta">Подробнее <Icon name="arrow-right" size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="schedule-feature-section">
        <div className="section-inner schedule-feature-inner">
          <div className="schedule-feature-stamp" aria-hidden="true">
            <span>ОТКРЫТЫЙ</span><strong>ДЕНЬ</strong><span>НАПАРЕ</span>
          </div>
          <div className="schedule-feature-copy">
            <p className="eyebrow">Расписание для всех</p>
            <h2>Сначала посмотрите. Потом войдите за подробностями.</h2>
            <p>Выберите университет и группу, чтобы посмотреть расписание, которое вуз загрузил и разрешил публиковать из своего кабинета.</p>
            <Link href="/schedule" className="inline-action">Открыть расписание <Icon name="arrow-right" size={17} /></Link>
            <p className="schedule-source-note">В каталоге собраны только подключённые университеты, включившие публикацию в кабинете. Расписание нескольких вузов доступно в одном месте.</p>
          </div>
        </div>
      </section>

      <section className="career-feature-section section">
        <div className="section-inner career-feature-inner">
          <div>
            <p className="eyebrow">Карьерный центр</p>
            <h2>Практика — часть учебного пути</h2>
            <p className="section-lead">Карьерный центр помогает выстроить безопасный и понятный путь между студентом и работодателем: от знакомства с задачей до результата и портфолио.</p>
            <div className="career-route" aria-label="Этапы практики">
              <span><b>Студент</b><small>Выбирает задачу</small></span>
              <i aria-hidden="true" />
              <span><b>Работодатель</b><small>Даёт обратную связь</small></span>
              <i aria-hidden="true" />
              <span><b>Карьерный центр</b><small>Поддерживает процесс</small></span>
            </div>
            <div className="home-link-row">
              <Link href="/career-center" className="inline-action">Как работает центр <Icon name="arrow-right" size={17} /></Link>
              <Link href="/career" className="subtle-link">Перейти к задачам</Link>
            </div>
          </div>
          <div className="career-note-panel">
            <span className="career-note-star" aria-hidden="true">✳</span>
            <p>Университетская поддержка</p>
            <strong>Задачи ближе к учёбе. Опыт ближе к профессии.</strong>
            <Link href="/career-center">Посмотреть путь студента →</Link>
          </div>
        </div>
      </section>

      <section className="product-section section section-alt">
        <div className="section-inner product-section-inner">
          <div className="product-section-copy">
            <p className="eyebrow">После входа</p>
            <h2>Пара — больше, чем строка в расписании</h2>
            <p className="section-lead">Когда вуз подключён, расписание становится отправной точкой для занятий, объявлений и учебных материалов.</p>
            <ul className="product-points">
              <li>Изменения расписания рядом с занятием</li>
              <li>Материалы и сообщения в контексте пары</li>
              <li>Доступ зависит от роли и вуза пользователя</li>
            </ul>
            <Link href="/universities" className="inline-action">Для университетов <Icon name="arrow-right" size={17} /></Link>
          </div>
          <div className="product-showcase-frame"><ProductShowcase /></div>
        </div>
      </section>

      <section className="home-university-band">
        <div className="section-inner university-band-inner">
          <div>
            <p className="eyebrow">Для университетов</p>
            <h2>У каждого вуза — свои расписание, структура и правила доступа</h2>
          </div>
          <p>НаПаре рассчитана на подключение нескольких университетов. Данные и административные действия ограничиваются вузом пользователя; публично показывается только расписание, для которого настроена публикация.</p>
          <Link href="/universities" className="home-action home-action-dark">Как подключить вуз <Icon name="arrow-right" size={17} /></Link>
          <Link href="/pricing#universities" className="pricing-text-link">Варианты комплектации и стоимость</Link>
        </div>
      </section>

      <section className="employer-band section">
        <div className="section-inner employer-band-inner">
          <div><p className="eyebrow">Для компаний</p><h2>Несколько работодателей. Много точек входа в профессию.</h2></div>
          <p>Компании могут рассказать о себе и предложить студентам проектные задачи. Карьерный центр помогает связать предложения с образовательным контекстом.</p>
          <div className="home-link-row">
            <Link href="/employers" className="inline-action">Работодателям <Icon name="arrow-right" size={17} /></Link>
            <Link href="/career/register" className="subtle-link">Зарегистрировать компанию</Link>
            <Link href="/pricing#employers" className="subtle-link">Условия и стоимость</Link>
          </div>
        </div>
      </section>

      <section className="home-faq section section-alt">
        <div className="section-inner home-faq-inner">
          <div><p className="eyebrow">Коротко</p><h2>Что можно сделать без входа?</h2></div>
          <div className="home-faq-copy">
            <p>Открытое расписание доступно для опубликованных источников. Чтобы пользоваться личным расписанием, материалами занятий и статусами, войдите с аккаунтом, выданным университетом.</p>
            <p>Компании регистрируются самостоятельно. Подключение университета и публикация его расписания согласуются с администрацией вуза.</p>
            <div className="home-link-row"><Link href="/schedule" className="inline-action">Посмотреть расписание <Icon name="arrow-right" size={17} /></Link><Link href="/login" className="subtle-link">Войти в кабинет</Link></div>
          </div>
        </div>
      </section>

      <PortalFooter />
    </main>
  );
}
