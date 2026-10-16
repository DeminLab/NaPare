"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  WorkspaceShell,
  type NavigationLinkProps,
  type WorkspaceCommand,
  type WorkspaceNavGroup,
} from "@napare/ui/workspace-shell";
import { apiFetch, getHealth, getUser, logout } from "@/lib/api";
import type { HealthInfo, UserInfo } from "@/lib/api";

const groups: WorkspaceNavGroup[] = [
  {
    label: "Обзор",
    items: [{ href: "/overview", label: "Состояние системы", mobileLabel: "Система", icon: "home" }],
  },
  {
    label: "Платформа",
    items: [
      { href: '/control', label: 'Управление платформой', icon: 'settings', keywords: ['сервер', 'сервисы', 'рестарт', 'ребилд', 'аккаунты', 'права'] },
      {
        href: "/api",
        label: "API",
        icon: "code",
        keywords: ["api explorer", "endpoints", "api"],
      },
      {
        href: "/overview#events",
        label: "События платформы",
        icon: "list",
        keywords: ["логи", "logs"],
      },
      {
        href: "/notifications",
        label: "Уведомления",
        icon: "pulse",
        keywords: ["events"],
      },
    ],
  },
  {
    label: "База знаний",
    items: [
      {
        href: "/docs",
        label: "Документация",
        icon: "book",
        keywords: ["docs", "документация"],
      },
      {
        href: "/architecture",
        label: "Архитектура",
        icon: "layers",
        keywords: ["architecture"],
      },
    ],
  },
  {
    label: "Доступ",
    items: [
      {
        href: "/session",
        label: "Сессии",
        icon: "users",
        keywords: ["sessions", "сессии"],
      },
      {
        href: "/connections",
        label: "Подключения аккаунта",
        icon: "plug",
        keywords: ["max"],
      },
    ],
  },
];
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => href === "/connections" ? (
  <a href={href} {...props}>{children}</a>
) : (
  <Link href={href} {...props}>{children}</Link>
);

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    getUser()
      .then(setUser)
      .catch(() => undefined);
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthChecked(true));
    apiFetch<{ data: Array<{ isRead: boolean }> }>("/notifications")
      .then((response) =>
        setUnread(response.data.filter((item) => !item.isRead).length),
      )
      .catch(() => undefined);
  }, []);
  const commands: WorkspaceCommand[] = [
    {
      id: "developer:api",
      label: "Открыть API Explorer",
      description: "Эндпоинты и авторизация",
      icon: "code",
      href: "/api",
      keywords: ["api", "endpoints"],
    },
    {
      id: "developer:docs",
      label: "Открыть документацию",
      icon: "book",
      href: "/docs",
    },
    {
      id: "developer:session",
      label: "Открыть активные сессии",
      icon: "users",
      href: "/session",
      keywords: ["sessions", "jobs"],
    },
  ];
  const name = user ? user.firstName + " " + user.lastName : "Разработчик";
  const apiAvailable = health
    ? ["ok", "healthy"].includes(health.status.toLowerCase())
    : false;
  return (
    <WorkspaceShell
      className="developer-shell"
      LinkComponent={AppLink}
      pathname={pathname}
      groups={groups}
      roleLabel="Разработчик"
      homeHref="/overview"
      user={{ name, role: "Разработчик", id: user?.id }}
      unreadCount={unread}
      notificationHref="/notifications"
      status={{
        label: !healthChecked ? "Проверяем API…" : apiAvailable ? "API доступен" : "Не удалось проверить API",
        tone: apiAvailable ? "success" : "warning",
      }}
      commands={commands}
      mobileHrefs={["/overview", "/api", "/notifications", "/docs"]}
      help={{ title: "Инструменты разработчика", description: "Проверка API, события платформы и документация.", steps: [
        { title: "Проверить состояние системы", description: "Доступность API и сведения о текущем окружении.", href: "/overview" },
        { title: "Открыть API", description: "Проверка доступности методов с текущими правами доступа.", href: "/api" },
        { title: "Найти документацию", description: "Описание устройства платформы и её контрактов.", href: "/docs" },
        { title: "Проверить текущую сессию", description: "Сведения об авторизации вашего аккаунта.", href: "/session" },
      ]}}
      onLogout={logout}
    >
      {children}
    </WorkspaceShell>
  );
}
