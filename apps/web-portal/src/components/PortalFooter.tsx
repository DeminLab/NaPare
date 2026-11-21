import Image from "next/image";
import Link from "next/link";

export function PortalFooter() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand-block">
            <Link href="/" className="brand footer-brand">
              <Image src="/brand/np-mark.png" alt="" width={34} height={34} unoptimized />
              НаПаре
            </Link>
            <p>Расписание, материалы занятий и практика для первого профессионального опыта.</p>
          </div>
          <nav className="footer-primary-links" aria-label="Основные разделы">
            <Link href="/login">Войти</Link>
            <Link href="/connections">Подключить MAX</Link>
            <Link href="/schedule">Расписание</Link>
            <Link href="/career-center">Карьерный центр</Link>
          </nav>
        </div>
        <nav className="footer-secondary-links" aria-label="Другие разделы">
          <Link href="/universities">Университетам</Link>
          <Link href="/employers">Работодателям</Link>
          <Link href="/pricing">Стоимость и подключение</Link>
          <Link href="/features">Возможности</Link>
          <Link href="/career">Практика и работа</Link>
          <Link href="/team">Команда</Link>
          <Link href="/privacy">Политика конфиденциальности</Link>
        </nav>
      </div>
      <p className="footer-copy footer-inner">
        © 2026 НаПаре · Учебные аккаунты выдаёт университет. Работодатели регистрируются самостоятельно.
      </p>
    </footer>
  );
}
