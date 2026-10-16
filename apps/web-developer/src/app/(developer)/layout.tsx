"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    getUser()
      .then((profile) => {
        if (!active) return;
        if (!['developer', 'superadmin'].includes(profile.role)) {
          router.replace('/login');
          return;
        }
        setUser(profile);
        getHealth()
          .then(setHealth)
          .catch(() => setHealth(null))
          .finally(() => setHealthChecked(true));
        apiFetch<{ data: Array<{ isRead: boolean }> }>("/notifications")
          .then((response) =>
            setUnread(response.data.filter((item) => !item.isRead).length),
          )
          .catch(() => undefined);
      })
      .catch(() => {
        if (active) router.replace('/login');
      });
    return () => { active = false; };
  }, [router]);
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
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">
        Проверяем доступ…
      </div>
    );
  }
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
      onLogout={logout}
    >
      <div className="role-content">{children}</div>
    </WorkspaceShell>
  );
}
