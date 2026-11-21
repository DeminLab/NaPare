import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@napare/ui";
import { PortalFooter } from "../../components/PortalFooter";
import { PortalHeader } from "../../components/PortalHeader";
import styles from "./employers.module.css";

export const metadata: Metadata = {
  title: "НаПаре для работодателей",
  description: "Как компания может предложить студентам проектные задачи и получить результат.",
  alternates: { canonical: "/employers" },
};

export default function EmployersPage() {
  return (
    <main className="public-info-page public-info-coral">
      <PortalHeader />
      <section className={styles.hero}>
        <div className={styles.heroArt} aria-hidden="true"><Image src="/brand/campus-learning.png" alt="" fill priority sizes="(max-width: 720px) 100vw, 55vw" /></div>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Для работодателей</p>
          <h1>Знакомьтесь со студентами через реальные задачи</h1>
          <p>Компании могут присоединиться к карьерной площадке и предложить задачи, в которых студент применит знания на практике.</p>
          <div className={styles.actions}><Link href="/career/register" className="home-action home-action-bright">Зарегистрировать компанию <Icon name="arrow-right" size={17} /></Link><Link href="#participation" className={styles.secondaryAction}>Как это работает</Link></div>
        </div>
      </section>
      <div className={`public-info-content ${styles.content}`}>
      <section id="participation" className="employer-intro-grid">
        <div className="employer-intro-copy"><p className="eyebrow">От компании к результату</p><h2>Опишите работу так, чтобы студент понял её ценность</h2><p>Укажите, что предстоит сделать, какие навыки пригодятся, сколько времени займёт работа и как вы будете принимать результат.</p><Link href="/career/register" className="home-action home-action-dark">Зарегистрировать компанию <Icon name="arrow-right" size={17} /></Link></div>
        <div className="employer-process"><span className="employer-process-mark" aria-hidden="true">↗</span><p>Понятная задача</p><i /><p>Совместная работа</p><i /><p>Принятый результат</p></div>
      </section>
      <p className="employer-pricing-link-wrap"><Link href="/pricing#employers" className="inline-action">Посмотреть условия и стоимость <Icon name="arrow-right" size={17} /></Link></p>
      <section className="info-two-column employer-info-pair">
        <article><p className="eyebrow">Сотрудничество</p><h2>На площадке могут работать разные компании</h2><p>Каждый работодатель представляет свою организацию и предложения. Студенты могут знакомиться с задачами разных направлений, а карьерный центр помогает поддерживать связь с университетом.</p></article>
        <article><p className="eyebrow">Для студентов</p><h2>Сначала понятные условия</h2><p>До отклика можно узнать ожидаемый результат, сроки и требования к задаче. Принятая работа и отзыв помогают показать приобретённый опыт.</p><Link href="/career-center" className="inline-action">О карьерном центре <Icon name="arrow-right" size={17} /></Link></article>
      </section>
      <section className="public-contact-band"><div><p className="eyebrow">Есть вопрос по участию?</p><h2>Команда НаПаре подскажет следующий шаг</h2></div><a href="mailto:support@napare.ru?subject=Работодатель%20НаПаре" className="home-action home-action-dark">Связаться с нами <Icon name="arrow-right" size={17} /></a></section>
      </div>
      <PortalFooter />
    </main>
  );
}
