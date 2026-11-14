import Image from "next/image";
import Link from "next/link";

const links = [
  ["/#problem", "Зачем"],
  ["/#features", "Возможности"],
  ["/#roles", "Роли"],
  ["/#career", "Практика"],
  ["/#launch", "Университету"],
  ["/#how", "Как начать"],
  ["/#faq", "Вопросы"],
] as const;

export function PortalHeader() {
  return (
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
      <nav className="portal-nav" aria-label="Разделы сайта">
        {links.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <details className="portal-menu">
        <summary aria-label="Меню сайта" aria-controls="mobile-page-nav">
          <span className="menu-lines" aria-hidden="true">
            <span />
            <span />
          </span>
        </summary>
        <nav id="mobile-page-nav" className="portal-menu-panel" aria-label="Разделы сайта">
          {links.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </details>
      <Link href="/login" className="text-link">
        Войти
      </Link>
    </header>
  );
}
