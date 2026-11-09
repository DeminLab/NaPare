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
import { apiFetch, getHealth, getUser, logout, readUserCache } from "@/lib/api";
import type { HealthInfo, UserInfo } from "@/lib/api";

const groups: WorkspaceNavGroup[] = [
  {
    label: "Обзор",
    items: [{ href: "/overview", label: "Аналитика платформы", mobileLabel: "Аналитика", icon: "chart", keywords: ["дашборд", "метрики", "графики", "система"] }],
  },
  {
    label: "Мониторинг",
    items: [
      { href: "/users", label: "Пользователи", icon: "users", keywords: ["аккаунты", "мониторинг", "активность", "сессии"] },
      { href: "/events", label: "События и логи", mobileLabel: "События", icon: "list", keywords: ["логи", "logs", "ошибки", "запросы"] },
      { href: "/sessions", label: "Сессии устройств", mobileLabel: "Сессии", icon: "lock", keywords: ["устройства", "ip", "выход"] },
      {
        href: "/notifications",
        label: "Уведомления",
        mobileLabel: "Увед.",
        icon: "pulse",
        keywords: ["events"],
      },
    ],
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
    ],
  },
  {
    label: "База знаний",
    items: [
      {
        href: "/docs",
        label: "Документация",
        mobileLabel: "Док.",
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
        label: "Моя сессия",
        icon: "user",
        keywords: ["sessions", "токен", "выход"],
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
  // Paint instantly from a cached developer profile; the fresh /users/me response reconciles in the background.
  // The cache is only trusted when the role still grants access to this workspace.
  const [user, setUser] = useState<UserInfo | null>(() => {
    const cached = readUserCache();
    return cached && ['developer', 'superadmin'].includes(cached.role) ? cached : null;
  });
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
      id: "developer:analytics",
      label: "Открыть аналитику платформы",
      description: "Регистрации, входы, активность, устройства",
      icon: "chart",
      href: "/overview",
      keywords: ["аналитика", "metrics", "dashboard"],
    },
    {
      id: "developer:users",
      label: "Открыть мониторинг пользователей",
      description: "Аккаунты, история входов и активность",
      icon: "users",
      href: "/users",
      keywords: ["пользователи", "users"],
    },
    {
      id: "developer:events",
      label: "Открыть журнал событий",
      description: "Запросы, ошибки, авторизации, админ-действия",
      icon: "list",
      href: "/events",
      keywords: ["логи", "logs", "events"],
    },
    {
      id: "developer:sessions",
      label: "Открыть сессии устройств",
      description: "Устройства, IP и принудительный выход",
      icon: "lock",
      href: "/sessions",
      keywords: ["сессии", "devices"],
    },
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
      label: "Открыть свою сессию",
      icon: "user",
      href: "/session",
      keywords: ["my sessions", "токен"],
    },
  ];
  const name = user ? user.firstName + " " + user.lastName : "Разработчик";
  const apiAvailable = health
    ? ["ok", "healthy"].includes(health.status.toLowerCase())
    : false;
  // No blocking gate: the shell (menu, header) renders immediately; access is re-verified in the background.
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
      mobileHrefs={["/overview", "/users", "/events", "/sessions", "/notifications"]}
      onLogout={logout}
    >
      <div className="role-content">{children}</div>
    </WorkspaceShell>
  );
}
