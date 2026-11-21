import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@napare/ui";
import { PortalFooter } from "../../components/PortalFooter";
import { PortalHeader } from "../../components/PortalHeader";
import styles from "./universities.module.css";

export const metadata: Metadata = {
  title: "НаПаре для университетов",
  description: "Информация о подключении университетов, расписании, структуре и доступах в НаПаре.",
  alternates: { canonical: "/universities" },
};

const capabilities = [
  { icon: "building", title: "Своя структура", text: "Университет настраивает подразделения, учебные группы и роли сотрудников в своём контуре." },
  { icon: "calendar", title: "Расписание и источники", text: "Можно согласовать подходящий источник расписания и порядок его обновления." },
  { icon: "lock", title: "Доступ по роли", text: "Пользователь работает в пределах назначенной роли и университета; административные функции защищены." },
] as const;

export default function UniversitiesPage() {
  return (
    <main className="public-info-page public-info-blue">
      <PortalHeader />
      <section className={styles.hero}>
        <div className={styles.heroArt} aria-hidden="true"><Image src="/brand/campus-learning.png" alt="" fill priority sizes="(max-width: 720px) 100vw, 55vw" /></div>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Для университетов</p>
          <h1>Цифровая площадка, которая учитывает устройство вашего вуза</h1>
          <p>Подключение начинается с университетской структуры и расписания. Дальше студенты, преподаватели и административные команды работают в своих ролевых пространствах.</p>
          <div className={styles.actions}><a href="mailto:support@napare.ru?subject=Подключение%20университета%20к%20НаПаре" className="home-action home-action-bright">Подключить университет <Icon name="arrow-right" size={17} /></a><Link href="#connection" className={styles.secondaryAction}>Узнать больше</Link></div>
        </div>
      </section>
      <div className={`public-info-content ${styles.content}`}>
      <section className="university-capabilities">
        <div className="info-flow-heading"><p className="eyebrow">Для каждого подключённого вуза</p><h2>Общий продукт, отдельные границы работы</h2><p>Платформа проектируется для нескольких университетов. Их структуры, пользователи и операции должны оставаться в границах своего вуза.</p></div>
        <div className="university-capability-grid">{capabilities.map((item) => <article key={item.title}><span aria-hidden="true"><Icon name={item.icon} size={21} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>
      <section id="connection" className="university-steps">
        <div><p className="eyebrow">Подключение через кабинет</p><h2>Сначала порядок данных. Затем — ежедневная работа.</h2><p className="university-steps-intro">После создания университетского контура администратор получает доступ и продолжает настройку в своём кабинете НаПаре.</p><Link href="/deanery/onboarding" className="inline-action">Открыть мастер подключения <Icon name="arrow-right" size={17} /></Link><Link href="/pricing#universities" className="university-pricing-link">Посмотреть варианты модулей и стоимость</Link></div>
        <ol><li><b>Создать контур и назначить администратора</b><span>Владелец платформы создаёт вуз; администратор входит отдельно в пространство своего университета.</span></li><li><b>Настроить структуру и расписание</b><span>В кабинете добавляются группы, сотрудники, доступы и источник расписания.</span></li><li><b>Согласовать состав модулей</b><span>Расписание, карьерный центр или оба направления. Сейчас выбор коммерческого пакета в мастере ещё не реализован.</span></li></ol>
      </section>
      <section className="university-publication-note"><div><p className="eyebrow">Публичное расписание</p><h2>Университет сам участвует в публикации</h2><p>Открытая страница показывает расписание только подключённого и опубликованного источника. Закрытые данные кабинета не превращаются в публичные автоматически.</p></div><Link href="/schedule" className="inline-action">Открыть публичное расписание <Icon name="arrow-right" size={17} /></Link></section>
      <section className="public-contact-band"><div><p className="eyebrow">Запуск в университете</p><h2>Обсудим структуру и источник расписания</h2></div><a href="mailto:support@napare.ru?subject=Подключение%20университета%20к%20НаПаре" className="home-action home-action-dark">Обсудить подключение <Icon name="arrow-right" size={17} /></a></section>
      </div>
      <PortalFooter />
    </main>
  );
}
