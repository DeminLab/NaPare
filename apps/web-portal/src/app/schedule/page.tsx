import type { Metadata } from "next";
import { Icon } from "@napare/ui";
import { PortalFooter } from "../../components/PortalFooter";
import { PortalHeader } from "../../components/PortalHeader";
import { PublicSchedule } from "./public-schedule";
import styles from "./schedule.module.css";

export const metadata: Metadata = {
  title: "Открытое расписание — НаПаре",
  description: "Посмотрите опубликованное расписание СИБИТа по учебному году и группе.",
  alternates: { canonical: "/schedule" },
};

export default function PublicSchedulePage() {
  return (
    <main className={`public-info-page ${styles.schedulePage}`}>
      <PortalHeader />
      <section className="public-page-hero schedule-page-hero">
        <div className={styles.heroVisual} aria-hidden="true">
          <span className={styles.heroCalendar}><Icon name="calendar" size={31} /></span>
          <span className={styles.heroOrbit} />
        </div>
        <div className="public-page-hero-inner">
          <p className="eyebrow">Открытый доступ</p>
          <h1>Расписание, которое можно посмотреть заранее</h1>
          <p>Выберите учебный год и группу. Расписание открыто для просмотра; личные материалы и изменения доступны в кабинете университета.</p>
        </div>
      </section>
      <section className={`public-page-content schedule-page-content ${styles.scheduleContent}`}>
        <div className="public-content-inner">
          <PublicSchedule />
          <p className="public-data-note">Публичный источник сейчас подключён для СИБИТа. Расписание других вузов появится здесь после согласования и настройки публикации университетом.</p>
        </div>
      </section>
      <PortalFooter />
    </main>
  );
}
