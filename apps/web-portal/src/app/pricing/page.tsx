import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@napare/ui";
import { PortalFooter } from "../../components/PortalFooter";
import { PortalHeader } from "../../components/PortalHeader";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Стоимость НаПаре — для вузов и работодателей",
  description: "Варианты подключения расписания и карьерного центра для университетов. Условия для компаний и работодателей.",
  alternates: { canonical: "/pricing" },
};

const universityPlans = [
  {
    id: "schedule-plan",
    className: "pricing-plan pricing-plan-schedule",
    label: "Учебный день",
    title: "Расписание",
    description: "Начните с актуального расписания и переходите от группы к занятиям и учебному контексту.",
    features: ["Импорт расписания из поддерживаемого источника", "Структура вуза, группы и роли", "Публичный просмотр только опубликованных данных"],
    price: "По запросу",
    note: "Состав и объём подключения согласуются с университетом.",
  },
  {
    id: "career-plan",
    className: "pricing-plan pricing-plan-career",
    label: "Практика и карьера",
    title: "Карьерный центр",
    description: "Организуйте взаимодействие студентов, центра и компаний вокруг профессиональных задач.",
    features: ["Задачи и отклики студентов", "Работа с компаниями и допусками", "Принятые результаты и портфолио"],
    price: "По запросу",
    note: "Условия зависят от состава карьерных сервисов.",
  },
  {
    id: "complete-plan",
    className: "pricing-plan pricing-plan-complete",
    label: "Единая среда",
    title: "Расписание + карьерный центр",
    description: "Объедините учебную повседневность и первые профессиональные проекты студентов.",
    features: ["Модуль расписания", "Модуль карьерного центра", "Общий университетский контекст и роли"],
    price: "Составной расчёт",
    note: "Сначала фиксируем подключаемые модули и объём работ.",
  },
] as const;

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <PortalHeader />
      <section className="pricing-hero">
        <div className="pricing-hero-inner">
          <p className="eyebrow">Стоимость и варианты подключения</p>
          <h1>Тарифы для вузов и работодателей</h1>
          <p>Вуз может подключить расписание, карьерный центр или оба направления. Для работодателей действует отдельная модель услуг.</p>
          <nav className="pricing-jump-links" aria-label="Разделы страницы">
            <a href="#universities">Университетам <span aria-hidden="true">↓</span></a>
            <a href="#employers">Работодателям <span aria-hidden="true">↓</span></a>
          </nav>
        </div>
        <div className="pricing-hero-orbit" aria-hidden="true"><span>Учёба</span><b>+</b><span>Практика</span><i className={styles.capIcon}><Icon name="book" size={27} /></i><i className={styles.workIcon}><Icon name="briefcase" size={27} /></i></div>
      </section>

      <section id="universities" className="pricing-university-section">
        <div className="pricing-section-inner">
          <header className="pricing-section-heading">
            <div><p className="eyebrow">Для нескольких вузов</p><h2>Соберите нужный состав</h2></div>
            <p>Каждый университет ведёт собственную структуру и пользователей. Модули и объём подключения обсуждаются отдельно, чтобы предложение соответствовало масштабу и готовности вуза.</p>
          </header>
          <div className="pricing-plan-grid">
            {universityPlans.map((plan) => (
              <article id={plan.id} key={plan.title} className={plan.className}>
                <p className="pricing-plan-label">{plan.label}</p>
                <h3>{plan.title}</h3>
                <p className="pricing-plan-description">{plan.description}</p>
                <ul>{plan.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
                <div className="pricing-plan-price"><strong>{plan.price}</strong><span>{plan.note}</span></div>
                <a href={`mailto:support@napare.ru?subject=${encodeURIComponent(`Подключение НаПаре: ${plan.title}`)}`} className="pricing-plan-link">Запросить условия <Icon name="arrow-right" size={16} /></a>
              </article>
            ))}
          </div>
          <p className="pricing-disclosure">Фиксированные публичные тарифы для вузов пока не утверждены. На странице нет тестовых или расчётных цифр: итоговое предложение формируется после согласования модулей, объёма данных, источника расписания и поддержки.</p>
        </div>
      </section>

      <section className="pricing-cabinet-section">
        <div className="pricing-section-inner pricing-cabinet-inner">
          <div className="pricing-cabinet-copy">
            <p className="eyebrow">Подключение через кабинет вуза</p>
            <h2>После согласования администратор продолжает настройку в НаПаре</h2>
            <p>Владелец платформы создаёт контур университета и назначает администратора. Администратор входит в кабинет своего вуза и открывает мастер подключения: настраивает структуру, группы, учётные записи и источник расписания.</p>
            <div className="pricing-cabinet-actions">
              <Link href="/deanery/onboarding" className="home-action home-action-dark">Открыть мастер подключения <Icon name="arrow-right" size={17} /></Link>
              <Link href="/universities" className="pricing-text-link">Как подключается вуз</Link>
            </div>
          </div>
          <aside className="pricing-cabinet-note">
            <span aria-hidden="true">↗</span>
            <strong>Что уже настраивается в кабинете</strong>
            <p>Структура вуза, администратор и импорт расписания. Выбор коммерческого пакета и переключатель «расписание / карьерный центр / вместе» в мастере пока не реализованы — состав фиксируется при согласовании подключения.</p>
          </aside>
        </div>
      </section>

      <section id="employers" className="pricing-employer-section">
        <div className="pricing-section-inner pricing-employer-inner">
          <div>
            <p className="eyebrow">Отдельно для работодателей</p>
            <h2>Условия компании — в кабинете работодателя</h2>
            <p>Компания создаёт аккаунт, добавляет организацию и отправляет её на проверку карьерному центру. Оплачивается услуга платформы для доступа к карьерным сервисам; публичная сумма зависит от настроенной оператором цены и отображается в кабинете компании, когда оплата доступна.</p>
            <ul className="employer-price-points"><li>Студентам основной учебный доступ бесплатен.</li><li>Оплата услуги платформы не является выплатой студенту.</li><li>Условия, сумма и доступность оплаты проверяются в аккаунте компании.</li></ul>
            <div className="pricing-cabinet-actions">
              <Link href="/career/register" className="home-action home-action-bright">Создать аккаунт компании <Icon name="arrow-right" size={17} /></Link>
              <Link href="/employers" className="pricing-text-link">Возможности для работодателей</Link>
            </div>
          </div>
          <div className="pricing-employer-stamp" aria-label="Условия работодателю отображаются в его кабинете"><span>УСЛОВИЯ</span><strong>В КАБИНЕТЕ</strong><span>КОМПАНИИ</span></div>
        </div>
      </section>

      <section className="pricing-final-section">
        <div className="pricing-section-inner pricing-final-inner">
          <div><p className="eyebrow">Следующий шаг</p><h2>Сначала согласуем состав. Затем настроим подключение.</h2></div>
          <div className="pricing-final-actions"><a href="mailto:support@napare.ru?subject=Стоимость%20и%20подключение%20НаПаре" className="home-action home-action-dark">Обсудить условия <Icon name="arrow-right" size={17} /></a><Link href="/schedule" className="pricing-text-link">Открыть публичное расписание</Link></div>
        </div>
      </section>
      <PortalFooter />
    </main>
  );
}
