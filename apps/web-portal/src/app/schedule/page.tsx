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
      <PortalHeader searchHref="#public-schedule-filters" />
      <section className="public-page-hero schedule-page-hero">
        <div className={styles.heroVisual} aria-hidden="true">
          <span className={styles.heroOrbit} />
          <span className={styles.heroOrbitSecondary} />
          <span className={styles.heroCalendar}><Icon name="calendar" size={47} /></span>
          <span className={styles.heroCalendarCheck}><Icon name="check" size={23} /></span>
        </div>
        <div className="public-page-hero-inner">
          <p className="eyebrow">Публичное расписание</p>
          <h1>Расписание занятий</h1>
          <p>Выберите университет и группу, чтобы посмотреть пары на неделю. Без регистрации и входа в кабинет.</p>
          <div className={styles.heroFeatures} aria-label="Возможности расписания">
            <span><Icon name="building" size={17} /> Университеты</span>
            <span><Icon name="users" size={17} /> Учебные группы</span>
            <span><Icon name="search" size={17} /> Поиск занятий</span>
          </div>
        </div>
        <div className={styles.publicStatus}><span aria-hidden="true" /> Открыто для просмотра</div>
      </section>
      <section className={`public-page-content schedule-page-content ${styles.scheduleContent}`}>
        <div className="public-content-inner">
          <PublicSchedule />
          <section className={styles.moreSection} aria-labelledby="schedule-more-title">
            <h2 id="schedule-more-title">Дополнительно</h2>
            <div className={styles.moreLinks}>
              <a href="/career-center"><span><Icon name="briefcase" size={19} /></span><strong>Карьерный центр</strong><Icon name="chevron-right" size={16} /></a>
              <a href="/employers"><span><Icon name="users" size={19} /></span><strong>Работодателям</strong><Icon name="chevron-right" size={16} /></a>
              <a href="/universities"><span><Icon name="layers" size={19} /></span><strong>Публикация для вузов</strong><Icon name="chevron-right" size={16} /></a>
            </div>
          </section>
        </div>
      </section>
      <PortalFooter />
    </main>
  );
}
