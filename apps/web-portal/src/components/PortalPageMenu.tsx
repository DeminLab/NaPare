"use client";

import { useRef } from "react";

export function PortalPageMenu() {
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={menu} className="portal-menu" onKeyDown={event => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label="Меню сайта" aria-controls="mobile-page-nav">
        <span className="menu-lines" aria-hidden="true"><span /><span /></span>
      </summary>
      <nav id="mobile-page-nav" className="portal-menu-panel" aria-label="Разделы страницы" onClick={event => {
        if (event.target instanceof Element && event.target.closest("a") && menu.current) {
          menu.current.open = false;
        }
      }}>
        <a href="#problem">Зачем НаПаре</a>
        <a href="#features">Возможности</a>
        <a href="#interface">Интерфейс</a>
        <a href="#roles">Роли</a>
        <a href="#career">Практика</a>
        <a href="#launch">Университету</a>
        <a href="#how">Как начать</a>
        <a href="#faq">Вопросы и поддержка</a>
      </nav>
    </details>
  );
}
