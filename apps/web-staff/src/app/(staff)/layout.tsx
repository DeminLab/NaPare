"use client";

import Link from "next/link";
import { useCurationContext } from '@napare/ui/curation';
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  WorkspaceShell,
  searchCommands,
  type WorkspaceSearchResponse,
  type NavigationLinkProps,
  type WorkspaceCommand,
  type WorkspaceNavGroup,
} from "@napare/ui/workspace-shell";
import { apiFetch, getUnreadCount, getUser, isLoggedIn, logout } from "@/lib/api";

const groups: WorkspaceNavGroup[] = [
  {
    label: "Сегодня",
    items: [
      {
        href: "/today",
        label: "Сегодня",
        icon: "calendar",
        keywords: ["мой день", "ближайшая пара"],
      },
    ],
  },
  {
    label: "Работа",
    items: [
      {
        href: "/week",
        label: "Расписание",
        mobileLabel: "Неделя",
        icon: "calendar",
        keywords: ["неделя", "пары"],
      },
      {
        href: "/assignments",
        label: "Подготовка к парам",
        icon: "clipboard",
        keywords: ["подготовка", "тема", "материалы"],
      },
      { href: "/groups", label: "Группы", mobileLabel: "Группы", icon: "users" },
      { href: "/attendance", label: "Посещаемость", mobileLabel: "Посещ.", icon: "check" },
      { href: "/absences", label: "Обращения", icon: "clipboard" },
      { href: "/pair-space", label: "Занятия и материалы", icon: "book", keywords: ["пространства пар"] },
    ],
  },
  {
    label: "Коммуникация",
    items: [
      { href: "/inbox", activePaths: ["/notifications"], mobileLabel: "Важное", label: "Центр внимания", icon: "bell", keywords: ["входящие", "уведомления", "заявки"] },
    ],
  },
  {
    label: "Аккаунт",
    items: [
      { href: "/profile", label: "Профиль", icon: "user" },
      { href: "/settings", label: "Настройки", icon: "settings" },
      { href: "/connections", label: "Подключения аккаунта", icon: "plug" },
    ],
  },
];
const AppLink = ({ href, children, ...props }: NavigationLinkProps) => (
  href === "/connections" ? <a href={href} {...props}>{children}</a> : <Link href={href} {...props}>{children}</Link>
);
const searchWorkspace = async (query: string, signal: AbortSignal) => searchCommands(await apiFetch<WorkspaceSearchResponse>("/search?q=" + encodeURIComponent(query), { signal }));

const roleLabels: Record<string, string> = { teacher: "Преподаватель", curator: "Куратор", faculty_dean: "Декан", department_head: "Заведующий кафедрой" };
const staffHistoryIndexKey = "__napareStaffHistoryIndex";

const readStaffHistoryIndex = (state: unknown) => {
  if (!state || typeof state !== "object") return undefined;
  const index = (state as Record<string, unknown>)[staffHistoryIndexKey];
  return Number.isSafeInteger(index) && Number(index) >= 0 ? Number(index) : undefined;
};

const withStaffHistoryIndex = (state: unknown, index: number) => {
  if (!state || typeof state !== "object" || Array.isArray(state)) return undefined;
  const prototype = Object.getPrototypeOf(state);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return { ...(state as Record<string, unknown>), [staffHistoryIndexKey]: index };
};

const installStaffHistoryTracker = () => {
  let currentIndex = readStaffHistoryIndex(window.history.state) ?? 0;
  let pendingRestoreIndex: number | null = null;
  let trackingReliable = true;
  const nativePushState = window.history.pushState.bind(window.history);
  const nativeReplaceState = window.history.replaceState.bind(window.history);

  const pushState: History["pushState"] = (data, unused, url) => {
    const indexedState = withStaffHistoryIndex(data, currentIndex + 1);
    if (!indexedState) {
      trackingReliable = false;
      return nativePushState(data, unused, url);
    }
    const nextIndex = currentIndex + 1;
    const result = nativePushState(indexedState, unused, url);
    currentIndex = nextIndex;
    return result;
  };
  const replaceState: History["replaceState"] = (data, unused, url) => {
    const nextIndex = readStaffHistoryIndex(data) ?? currentIndex;
    const indexedState = withStaffHistoryIndex(data, nextIndex);
    if (!indexedState) {
      trackingReliable = false;
      return nativeReplaceState(data, unused, url);
    }
    const result = nativeReplaceState(indexedState, unused, url);
    currentIndex = nextIndex;
    return result;
  };

  window.history.replaceState(window.history.state, "");
  window.history.pushState = pushState;
  window.history.replaceState = replaceState;

  const handlePopState = (event: PopStateEvent) => {
    const targetIndex = readStaffHistoryIndex(event.state);
    if (targetIndex === undefined) {
      trackingReliable = false;
      return;
    }

    if (pendingRestoreIndex !== null) {
      if (targetIndex === pendingRestoreIndex) {
        currentIndex = targetIndex;
        pendingRestoreIndex = null;
      }
      return;
    }

    if (!trackingReliable || targetIndex === currentIndex) return;
    const request = new CustomEvent("napare:staff-history-request", {
      cancelable: true,
      detail: { fromIndex: currentIndex, toIndex: targetIndex },
    });
    window.dispatchEvent(request);
    if (!request.defaultPrevented) {
      currentIndex = targetIndex;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    pendingRestoreIndex = currentIndex;
    window.history.go(currentIndex - targetIndex);
  };

  window.addEventListener("popstate", handlePopState, true);
  return () => {
    window.removeEventListener("popstate", handlePopState, true);
    if (window.history.pushState === pushState) window.history.pushState = nativePushState;
    if (window.history.replaceState === replaceState) window.history.replaceState = nativeReplaceState;
  };
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Awaited<ReturnType<typeof getUser>> | null>(null);
  const [unread, setUnread] = useState(0);
  const curation = useCurationContext(apiFetch, Boolean(user));
  useEffect(() => {
    let active = true;
    let uninstall: (() => void) | undefined;
    queueMicrotask(() => {
      if (active) uninstall = installStaffHistoryTracker();
    });
    return () => {
      active = false;
      uninstall?.();
    };
  }, []);
  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    getUser()
      .then(setUser)
      .catch(() => router.push("/login"));
    getUnreadCount()
      .then(setUnread)
      .catch(() => undefined);
  }, [router]);
  const commands: WorkspaceCommand[] = [
    {
      id: "staff:today",
      label: "Открыть мой рабочий день",
      description: "Ближайшие пары и задачи",
      icon: "calendar",
      href: "/today",
      keywords: ["сегодня", "мой день"],
    },
    {
      id: "staff:notifications",
      label: "Открыть уведомления",
      description: unread ? unread + " непрочитанных" : "Новых уведомлений нет",
      icon: "bell",
      href: "/notifications",
    },
    {
      id: "staff:inbox",
      label: "Открыть центр внимания",
      description: "Сообщения и важные действия",
      icon: "bell",
      href: "/inbox",
      keywords: ["сообщения", "вопросы", "работы"],
    },
    {
      id: "staff:profile",
      label: "Открыть профиль",
      icon: "user",
      href: "/profile",
    },
  ];
  if (!user)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] text-sm text-[var(--color-text-secondary)]">
        Загрузка…
      </div>
    );
  const fullName = user.firstName + " " + user.lastName;
  const curationItems: WorkspaceNavGroup['items'] = curation?.canCurate || curation?.canManage ? [{ href: '/curation', label: 'Кураторство', mobileLabel: 'Куратор', icon: 'users', keywords: ['куратор', 'назначения'] }] : [];
  const resolvedGroups = groups.map((group) => ({
    ...group,
    items: [...group.items, ...(group.label === 'Работа' ? curationItems : [])].filter(item => item.href !== "/absences" || ["curator", "faculty_dean", "department_head", "university_admin", "superadmin"].includes(user.role) || (user.role === "teacher" && curation?.canCurate)).map((item) =>
      item.href === "/inbox" ? { ...item, badge: unread } : item,
    ),
  }));
  return (
    <WorkspaceShell
      LinkComponent={AppLink}
      pathname={pathname}
      groups={resolvedGroups}
      roleLabel={roleLabels[user.role] || "Сотрудник университета"}
      homeHref="/today"
      user={{ name: fullName, role: roleLabels[user.role] || "Сотрудник университета", id: user.id }}
      unreadCount={unread}
      commands={commands}
      notificationHref="/notifications"
      onSearch={searchWorkspace}
      searchPlaceholder="Предмет, группа, материал или раздел…"
      mobileHrefs={["/today", "/week", "/groups", "/inbox"]}
      onLogout={logout}
    >
      <div className="role-content">{children}</div>
    </WorkspaceShell>
  );
}
