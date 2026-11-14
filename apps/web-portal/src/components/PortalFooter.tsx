import Image from "next/image";
import Link from "next/link";

export function PortalFooter() {
  return (
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
  );
}
