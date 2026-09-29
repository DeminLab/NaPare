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
    items: [{ href: "/overview", label: "Обзор", icon: "home" }],
  },
  {
    label: "Платформа",
    items: [
      {
        href: "/api",
        label: "API",
        icon: "code",
        keywords: ["api explorer", "endpoints", "api"],
      },
      {
        href: "/api#logs",
        label: "Журналы",
        icon: "list",
        keywords: ["логи", "logs"],
      },
      {
        href: "/api#events",
        label: "События",
        icon: "pulse",
        keywords: ["events"],
      },
      {
        href: "/api#connectors",
        label: "Коннекторы",
        icon: "plug",
        keywords: ["connectors", "интеграции"],
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
        keywords: ["max", "telegram"],
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
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    getUser()
      .then(setUser)
      .catch(() => undefined);
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
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
      user={{ name, role: "Разработчик" }}
      unreadCount={unread}
      status={{
        label: apiAvailable ? "API доступен" : "API недоступен",
        tone: apiAvailable ? "success" : "warning",
      }}
      commands={commands}
      onLogout={logout}
    >
      {children}
    </WorkspaceShell>
  );
}
