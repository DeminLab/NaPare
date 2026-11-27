"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@napare/ui";

const links = [
  ["/schedule", "Расписание"],
  ["/career-center", "Карьерный центр"],
  ["/universities", "Университетам"],
  ["/employers", "Работодателям"],
  ["/pricing", "Стоимость"],
] as const;

export function PortalHeader({ searchHref }: { searchHref?: string }) {
  const pathname = usePathname();
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
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {searchHref && <Link href={searchHref} className="portal-header-search" aria-label="Открыть поиск расписания"><Icon name="search" size={18} /></Link>}
      <details className="portal-menu">
        <summary aria-label="Меню сайта" aria-controls="mobile-page-nav">
          <span className="menu-lines" aria-hidden="true">
            <span />
            <span />
          </span>
        </summary>
        <nav id="mobile-page-nav" className="portal-menu-panel" aria-label="Разделы сайта">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </details>
      <Link href="/login" className="text-link" aria-current={pathname === "/login" ? "page" : undefined}>
        Войти
      </Link>
    </header>
  );
}
