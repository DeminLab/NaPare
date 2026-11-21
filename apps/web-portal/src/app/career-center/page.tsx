import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@napare/ui";
import { PublicInfoLayout } from "../../components/PublicInfoLayout";
import styles from "./career-center.module.css";

export const metadata: Metadata = {
  title: "Карьерный центр — НаПаре",
  description: "Как карьерный центр помогает связать студентов, университет и работодателей.",
  alternates: { canonical: "/career-center" },
};

const stages = [
  ["Студент", "Выбирает задачу по интересу, навыкам и доступной нагрузке.", "book"],
  ["Работодатель", "Описывает ожидания, сроки и критерии результата.", "briefcase"],
  ["Карьерный центр", "Помогает участникам пройти путь с понятными правилами и обратной связью.", "users"],
] as const;

export default function CareerCenterPage() {
  return (
    <PublicInfoLayout className={styles.careerCenterRoot} kicker="Учёба встречается с практикой" title="Карьерный центр: практика в ходе учёбы" lead="НаПаре связывает студентов и работодателей вокруг конкретных проектных задач — с университетским контекстом и поддержкой карьерного центра." tone="lime">
      <div className={styles.careerCenterScope}>
      <nav className={styles.heroActions} aria-label="Действия по карьерному центру">
        <a href="mailto:support@napare.ru?subject=Карьерный%20центр%20НаПаре" className={styles.heroPrimary}>Подключить карьерный центр <Icon name="arrow-right" size={17} /></a>
        <a href="#career-roles" className={styles.heroSecondary}>Как это работает</a>
      </nav>
      <section className="info-flow-section">
        <div className="info-flow-heading" id="career-roles"><p className="eyebrow">Общий процесс</p><h2>У каждого участника своя роль</h2><p>Студент видит задачу и договаривается о результате. Компания получает выполненную работу. Центр помогает сохранять понятный и безопасный процесс.</p></div>
        <div className="career-stage-grid">
          {stages.map(([name, description, icon], index) => <article key={name} className={`career-stage career-stage-${index + 1}`}><span className={styles.stageIcon}><Icon name={icon} size={25} /></span><h3>{name}</h3><p>{description}</p><span className={styles.stageArrow} aria-hidden="true"><Icon name="arrow-right" size={18} /></span></article>)}
        </div>
      </section>
      <section className="info-two-column">
        <article><p className="eyebrow">Для студента</p><h2>Опыт, который можно объяснить</h2><p>Выберите задачу, уточните сроки и договоритесь об ожидаемом результате. Принятые работы и отзывы могут стать частью профессионального портфолио.</p><Link href="/career" className="inline-action">Посмотреть практику <Icon name="arrow-right" size={17} /></Link></article>
        <article><p className="eyebrow">Для центра</p><h2>Поддержка по ходу работы</h2><p>Карьерный центр может работать с компаниями и достижениями студентов, помогать с допусками и поддерживать взаимодействие участников.</p><Link href="/universities" className="inline-action">Информация для вузов <Icon name="arrow-right" size={17} /></Link></article>
      </section>
      <section className="public-contact-band"><div><p className="eyebrow">Для университетской команды</p><h2>Обсудим, как подключить карьерный центр</h2></div><a href="mailto:support@napare.ru?subject=Карьерный%20центр%20НаПаре" className="home-action home-action-dark">Связаться с нами <Icon name="arrow-right" size={17} /></a></section>
      </div>
    </PublicInfoLayout>
  );
}
