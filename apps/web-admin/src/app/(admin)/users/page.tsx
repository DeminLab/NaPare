"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspaceQuery } from "@napare/ui/workspace-shell";
import { apiFetch, apiFetchList } from "@/lib/api";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  RequestState,
  SearchInput,
  Sheet,
  Skeleton,
} from "@/components/ui";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  roles?: string[];
  groupId?: string;
  facultyId?: string;
  isActive: boolean;
  lastLoginAt?: string;
}
interface Group {
  id: string;
  name: string;
  facultyId?: string;
}
interface Faculty {
  id: string;
  name: string;
}
type Filter = "all" | "student" | "teacher" | "admin";
type NewUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  groupId: string;
};

const emptyNewUser: NewUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "student",
  groupId: "",
};

const roleLabels: Record<string, string> = {
  career_staff: "Специалист карьерного центра",
  career_admin: "Руководитель карьерного центра",
  employer: "Работодатель",
  student: "Студент",
  teacher: "Преподаватель",
  curator: "Куратор",
  faculty_dean: "Декан",
  department_head: "Зав. кафедрой",
  university_admin: "Администратор",
  superadmin: "Суперадмин",
  developer: "Разработчик",
};
const roleVariants: Record<
  string,
  "sky" | "purple" | "teal" | "amber" | "pink" | "slate" | "red" | "green"
> = {
  student: "sky",
  teacher: "purple",
  curator: "teal",
  faculty_dean: "amber",
  department_head: "pink",
  university_admin: "slate",
  superadmin: "red",
  developer: "green",
};
const assignableRoles = [
  "career_staff",
  "career_admin",
  "student",
  "teacher",
  "faculty_dean",
  "department_head",
  "university_admin",
];

function userRole(user: AdminUser) {
  return user.role || user.roles?.[0] || "student";
}
function lastActive(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Нет данных";
}
function roleMatches(role: string, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "admin")
    return ["university_admin", "superadmin", "developer"].includes(role);
  return role === filter;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Filter>("all");
  const [faculty, setFaculty] = useState("all");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  useWorkspaceQuery({ q: search, role, faculty, group, status }, query => {
    setSearch((query.get('q') || '').slice(0, 100));
    const requestedRole = query.get('role') || 'all';
    setRole(['all', 'student', 'teacher', 'admin'].includes(requestedRole) ? requestedRole as Filter : 'all');
    setFaculty(query.get('faculty') || 'all'); setGroup(query.get('group') || 'all');
    setStatus(['active', 'blocked'].includes(query.get('status') || '') ? query.get('status')! : 'all');
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingRole,setPendingRole]=useState<{id:string;role:string}|null>(null);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUser);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [replacementPassword, setReplacementPassword] = useState("");
  const [bulkRole, setBulkRole] = useState("teacher");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([
      apiFetchList<AdminUser>("/admin/users"),
      apiFetchList<Group>("/admin/groups").catch(() => []),
      apiFetchList<Faculty>("/admin/faculties").catch(() => []),
    ])
      .then(([userItems, groupItems, facultyItems]) => {
        setUsers(userItems);
        setGroups(groupItems);
        setFaculties(facultyItems);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить пользователей.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const groupMap = new Map(groups.map((item) => [item.id, item]));
  const facultyMap = new Map(faculties.map((item) => [item.id, item.name]));
  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const currentRole = userRole(user);
        const query = search.toLowerCase().trim();
        const groupItem = groupMap.get(user.groupId || "");
        const facultyId = user.facultyId || groupItem?.facultyId;
        return (
          roleMatches(currentRole, role) &&
          (faculty === "all" || facultyId === faculty) &&
          (group === "all" || user.groupId === group) &&
          (status === "all" ||
            (status === "active" ? user.isActive : !user.isActive)) &&
          (!query ||
            `${user.firstName} ${user.lastName} ${user.email}`
              .toLowerCase()
              .includes(query))
        );
      }),
    [users, groups, faculties, search, role, faculty, group, status],
  );
  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((user) => selectedIds.includes(user.id));
  const toggleAll = () =>
    setSelectedIds(
      allVisibleSelected
        ? selectedIds.filter((id) => !filtered.some((user) => user.id === id))
        : [...new Set([...selectedIds, ...filtered.map((user) => user.id)])],
    );
  const toggle = (id: string) =>
    setSelectedIds((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  const changeRole = async (id: string, nextRole: string) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/admin/users/${id}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setUsers((items) =>
        items.map((user) =>
          user.id === id
            ? { ...user, role: nextRole, roles: [nextRole] }
            : user,
        ),
      );
      setDetail(current=>current?.id===id?{...current,role:nextRole,roles:[nextRole]}:current);
      setPendingRole(null);
      setMessage("Роль пользователя обновлена.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось изменить роль.",
      );
    } finally {
      setSaving(false);
    }
  };
  const bulkChangeRole = async () => {
    setSaving(true);
    setError("");
    try {
      const results = await Promise.allSettled(selectedIds.map(id => apiFetch(`/admin/users/${id}/roles`, { method: 'PATCH', body: JSON.stringify({ role: bulkRole }) })));
      const succeeded = new Set(selectedIds.filter((_, index) => results[index].status === 'fulfilled'));
      const failed = selectedIds.filter(id => !succeeded.has(id));
      setUsers(items => items.map(user => succeeded.has(user.id) ? { ...user, role: bulkRole, roles: [bulkRole] } : user));
      setSelectedIds(failed);
      setBulkConfirmOpen(false);
      setMessage(`Роль обновлена для ${succeeded.size} пользователей.`);
      if (failed.length) setError(`Не удалось изменить роль для ${failed.length} пользователей. Они остаются выбранными; повторите действие после проверки доступа.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось применить массовое действие.",
      );
    } finally {
      setSaving(false);
    }
  };
  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await apiFetch<AdminUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          ...newUser,
          firstName: newUser.firstName.trim(),
          lastName: newUser.lastName.trim(),
          email: newUser.email.trim(),
          groupId: newUser.groupId || undefined,
        }),
      });
      setUsers((items) => [created, ...items]);
      setCreateOpen(false);
      setNewUser(emptyNewUser);
      setMessage(
        "Учётная запись создана. Передайте временный пароль пользователю защищённым способом.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать пользователя.",
      );
    } finally {
      setSaving(false);
    }
  };
  const changeStatus = async (user: AdminUser) => {
    const willActivate = !user.isActive;
    const action = willActivate ? "разблокировать" : "заблокировать";
    if (!window.confirm(`Вы уверены, что хотите ${action} пользователя?`))
      return;

    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<AdminUser>(
        `/admin/users/${user.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: willActivate }),
        },
      );
      setUsers((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDetail((item) => (item?.id === updated.id ? updated : item));
      setMessage(
        willActivate
          ? "Пользователь разблокирован."
          : "Пользователь заблокирован.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось изменить статус пользователя.",
      );
    } finally {
      setSaving(false);
    }
  };
  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<AdminUser>(
        `/admin/users/${resetTarget.id}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ password: replacementPassword }),
        },
      );
      setUsers((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDetail((item) => (item?.id === updated.id ? updated : item));
      setResetTarget(null);
      setReplacementPassword("");
      setMessage(
        "Временный пароль обновлён. Передайте его пользователю защищённым способом.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось сбросить пароль.",
      );
    } finally {
      setSaving(false);
    }
  };
  const openPasswordReset = (user: AdminUser) => {
    setReplacementPassword("");
    setResetTarget(user);
  };
  const closePasswordReset = () => {
    if (saving) return;
    setReplacementPassword("");
    setResetTarget(null);
  };

  const statCards = [
    { label: "Всего", value: users.length, filter: "all" as Filter },
    {
      label: "Студенты",
      value: users.filter((user) => userRole(user) === "student").length,
      filter: "student" as Filter,
    },
    {
      label: "Преподаватели",
      value: users.filter((user) => userRole(user) === "teacher").length,
      filter: "teacher" as Filter,
    },
    {
      label: "Администраторы",
      value: users.filter((user) => roleMatches(userRole(user), "admin"))
        .length,
      filter: "admin" as Filter,
    },
    {
      label: "Заблокированы",
      value: users.filter((user) => !user.isActive).length,
      filter: "all" as Filter,
    },
  ];

  return (
    <div className="space-y-6">

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Пользователи
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {filtered.length} из {users.length} пользователей
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><Link className="role-link role-link-secondary" href="/curation">Назначить куратора</Link><Button onClick={() => setCreateOpen(true)}>
          Добавить пользователя
        </Button></div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Быстрые фильтры пользователей">
        {statCards.map((stat) => (
          <button
            key={stat.label}
            type="button"
            aria-pressed={stat.label === "Заблокированы" ? status === "blocked" : role === stat.filter && status === "all"}
            onClick={() => { setRole(stat.filter); setStatus(stat.label === "Заблокированы" ? "blocked" : "all"); }}
            className="min-h-11 shrink-0 text-left"
          >
            <Card
              className={`flex items-center gap-2 rounded-lg !px-3 !py-2 transition-colors ${(stat.label === "Заблокированы" ? status === "blocked" : role === stat.filter && status === "all") ? "border-slate-900" : ""}`}
              padding="sm"
            >
              <p className="text-sm font-medium text-slate-600">
                {stat.label}
              </p>
              <p className="text-sm font-semibold text-slate-950">
                {stat.value}
              </p>
            </Card>
          </button>
        ))}
      </div>
      <Card padding="sm"><SearchInput value={search} onChange={event => setSearch(event.target.value)} onSearch={setSearch} placeholder="Поиск пользователей…" />
        <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-700">Роль, факультет, группа и статус</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <select
            aria-label="Роль"
            value={role}
            onChange={(event) => setRole(event.target.value as Filter)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">Все роли</option>
            <option value="student">Студенты</option>
            <option value="teacher">Преподаватели</option>
            <option value="admin">Администраторы</option>
          </select>
          <select
            aria-label="Факультет"
            value={faculty}
            onChange={(event) => setFaculty(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">Все факультеты</option>
            {faculties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Группа"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">Все группы</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Статус"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">Любой статус</option>
            <option value="active">Активные</option>
            <option value="blocked">Заблокированные</option>
          </select>
        </div></details>
      </Card>
      {selectedIds.length > 0 && (
        <Card
          padding="sm"
          className="flex flex-col gap-3 border-slate-300 bg-slate-50 sm:flex-row sm:items-center"
        >
          <span className="text-sm font-semibold text-slate-700">
            Выбрано: {selectedIds.length}
          </span>
          <select
            value={bulkRole}
            onChange={(event) => setBulkRole(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="teacher">Преподаватель</option>
            <option value="student">Студент</option>
            <option value="university_admin">Администратор</option>
          </select>
          <Button size="sm" loading={saving} onClick={() => setBulkConfirmOpen(true)}>
            Изменить роль
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Сбросить
          </button>
        </Card>
      )}
      {message && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          {message}
        </p>
      )}
      {error && users.length > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-16" />
          ))}
        </div>
      ) : error && !users.length ? (
        <RequestState
          title="Не удалось загрузить пользователей"
          description={error}
          onRetry={load}
        />
      ) : !filtered.length ? (
        <EmptyState
          title="Пользователи не найдены"
          description="Измените параметры поиска или фильтров."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[36px_minmax(190px,1.4fr)_minmax(180px,1.2fr)_140px_140px_130px_110px_110px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 2xl:grid">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAll}
              aria-label="Выбрать всех"
            />
            <span>Имя</span>
            <span>Почта</span>
            <span>Роль</span>
            <span>Факультет</span>
            <span>Группа</span>
            <span>Статус</span>
            <span>Последний вход</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((user) => {
              const currentRole = userRole(user);
              const groupItem = groupMap.get(user.groupId || "");
              const facultyName =
                facultyMap.get(user.facultyId || groupItem?.facultyId || "") ||
                "—";
              return (
                <div key={user.id}>
                  <article className="space-y-3 p-4 2xl:hidden"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => toggle(user.id)} aria-label={`Выбрать ${user.firstName} ${user.lastName}`} className="mt-1 h-5 w-5 shrink-0" /><div className="min-w-0"><button type="button" onClick={() => setDetail(user)} className="min-h-11 break-words text-left text-base font-semibold text-slate-900">{user.firstName} {user.lastName}</button><p className="text-sm text-slate-600">{roleLabels[currentRole] || currentRole} · {groupItem?.name || 'Группа не назначена'}</p></div></div><Badge variant={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Активен' : 'Заблокирован'}</Badge></div><div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-all text-sm text-slate-500">{user.email}</span><Button variant="secondary" onClick={() => setDetail(user)}>Данные и действия →</Button></div></article>
                <div
                  className="grid gap-3 px-4 py-4 hidden 2xl:grid-cols-[36px_minmax(190px,1.4fr)_minmax(180px,1.2fr)_140px_140px_130px_110px_110px] 2xl:grid 2xl:items-center 2xl:px-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(user.id)}
                    onChange={() => toggle(user.id)}
                    aria-label={`Выбрать ${user.firstName} ${user.lastName}`}
                  />
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={`${user.firstName} ${user.lastName}`}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => setDetail(user)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-sky-700"
                    >
                      {user.firstName} {user.lastName}
                    </button>
                  </div>
                  <div>
                    <span className="md:hidden text-xs text-slate-400">
                      Почта ·{" "}
                    </span>
                    <span className="break-all text-sm text-slate-600">
                      {user.email}
                    </span>
                  </div>
                  <div>
                    <span className="md:hidden text-xs text-slate-400">
                      Роль ·{" "}
                    </span>
                    <select
                      aria-label={`Роль: ${user.firstName} ${user.lastName}`}
                      disabled={saving}
                      value={currentRole}
                      onChange={(event) =>
                        setPendingRole({id:user.id,role:event.target.value})
                      }
                      className="h-9 max-w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-sky-500"
                    >
                      {currentRole === 'curator' && <option value="curator">Куратор · прежняя роль</option>}
                      {assignableRoles.map((item) => (
                        <option key={item} value={item}>
                          {roleLabels[item]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="md:hidden text-xs text-slate-400">
                      Факультет ·{" "}
                    </span>
                    {facultyName}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="md:hidden text-xs text-slate-400">
                      Группа ·{" "}
                    </span>
                    {groupItem?.name || "—"}
                  </div>
                  <div>
                    <Badge variant={user.isActive ? "green" : "red"} size="sm">
                      {user.isActive ? "Активен" : "Заблокирован"}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="md:hidden text-xs text-slate-400">
                      Последний вход ·{" "}
                    </span>
                    {lastActive(user.lastLoginAt)}
                  </div>
                  <div className="flex gap-2 md:col-start-2 md:col-span-7">
                    <button
                      type="button"
                      onClick={() => setDetail(user)}
                      className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                    >
                      Просмотр
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetail(user)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(user)}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:text-slate-400"
                    >
                      {user.isActive ? "Заблокировать" : "Разблокировать"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => openPasswordReset(user)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-950 disabled:text-slate-400"
                    >
                      Сброс пароля
                    </button>
                  </div>
                </div></div>
              );
            })}
          </div>
        </div>
      )}
      <ConfirmDialog open={Boolean(pendingRole)} onClose={()=>setPendingRole(null)} title="Изменить роль пользователя?" description={`Новая роль: ${roleLabels[pendingRole?.role || ''] || pendingRole?.role || ''}. Доступ пользователя изменится после успешного сохранения.`} confirmLabel="Изменить роль" loading={saving} onConfirm={()=>{if(pendingRole) void changeRole(pendingRole.id,pendingRole.role);}}/>
      <ConfirmDialog open={bulkConfirmOpen} onClose={() => setBulkConfirmOpen(false)} title="Изменить роли выбранных пользователей?" description={`Новая роль: ${roleLabels[bulkRole] || bulkRole}. Пользователей: ${selectedIds.length}. Изменение затрагивает их доступ к разделам университета.`} confirmLabel="Применить роль" loading={saving} onConfirm={() => void bulkChangeRole()} />
      {detail && (
        <Sheet open={!pendingRole && !resetTarget} onClose={()=>setDetail(null)} title={`${detail.firstName} ${detail.lastName}`}>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Данные пользователя
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {detail.firstName} {detail.lastName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Avatar
                name={`${detail.firstName} ${detail.lastName}`}
                size="lg"
              />
              <div>
                <Badge variant={roleVariants[userRole(detail)] || "slate"}>
                  {roleLabels[userRole(detail)] || userRole(detail)}
                </Badge>
                <p className="mt-2 text-sm text-slate-500">
                  {detail.isActive ? "Активен" : "Заблокирован"}
                </p>
              </div>
            </div>
            <dl className="mt-6 divide-y divide-slate-100">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-slate-500">Почта</dt>
                <dd className="break-all text-right text-sm font-medium text-slate-800">
                  {detail.email}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-slate-500">Факультет</dt>
                <dd className="text-right text-sm font-medium text-slate-800">
                  {facultyMap.get(
                    detail.facultyId ||
                      groupMap.get(detail.groupId || "")?.facultyId ||
                      "",
                  ) || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-slate-500">Группа</dt>
                <dd className="text-right text-sm font-medium text-slate-800">
                  {groupMap.get(detail.groupId || "")?.name || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-slate-500">Последний вход</dt>
                <dd className="text-right text-sm font-medium text-slate-800">
                  {lastActive(detail.lastLoginAt)}
                </dd>
              </div>
            </dl>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Роль
              </label>
              <select
                aria-label="Роль пользователя"
                disabled={saving}
                value={userRole(detail)}
                onChange={event=>setPendingRole({id:detail.id,role:event.target.value})}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
              >
                <option value={userRole(detail)}>
                  {roleLabels[userRole(detail)] || userRole(detail)}
                </option>
                {assignableRoles
                  .filter((item) => item !== userRole(detail))
                  .map((item) => (
                    <option key={item} value={item}>
                      {roleLabels[item]}
                    </option>
                  ))}
              </select>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                disabled={saving}
                onClick={() => void changeStatus(detail)}
                variant="secondary"
              >
                {detail.isActive
                  ? "Заблокировать пользователя"
                  : "Разблокировать пользователя"}
              </Button>
              <Button
                disabled={saving}
                onClick={() => openPasswordReset(detail)}
                variant="secondary"
              >
                Сбросить пароль
              </Button>
            </div>
        </Sheet>
      )}
      <Modal
        open={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Новая учётная запись"
      >
        <form className="space-y-4" onSubmit={createUser}>
          <p className="text-sm leading-6 text-slate-500">
            Временный пароль передавайте пользователю только защищённым
            способом. Он не будет показан в кабинете после создания.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Имя"
              value={newUser.firstName}
              onChange={(event) =>
                setNewUser((item) => ({
                  ...item,
                  firstName: event.target.value,
                }))
              }
              required
            />
            <Input
              label="Фамилия"
              value={newUser.lastName}
              onChange={(event) =>
                setNewUser((item) => ({
                  ...item,
                  lastName: event.target.value,
                }))
              }
              required
            />
          </div>
          <Input
            label="Корпоративная почта"
            type="email"
            value={newUser.email}
            onChange={(event) =>
              setNewUser((item) => ({ ...item, email: event.target.value }))
            }
            required
          />
          <Input
            label="Временный пароль"
            type="password"
            minLength={10}
            value={newUser.password}
            onChange={(event) =>
              setNewUser((item) => ({ ...item, password: event.target.value }))
            }
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Роль
              <select
                value={newUser.role}
                onChange={(event) =>
                  setNewUser((item) => ({ ...item, role: event.target.value }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
              >
                {assignableRoles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Учебная группа
              <select
                value={newUser.groupId}
                onChange={(event) =>
                  setNewUser((item) => ({
                    ...item,
                    groupId: event.target.value,
                  }))
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="">Не назначать</option>
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Отмена
            </Button>
            <Button loading={saving} type="submit">
              Создать пользователя
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(resetTarget)}
        onClose={closePasswordReset}
        title="Новый временный пароль"
      >
        <form className="space-y-4" onSubmit={resetPassword}>
          <p className="text-sm leading-6 text-slate-500">
            {resetTarget
              ? `Пароль для ${resetTarget.firstName} ${resetTarget.lastName} будет заменён сразу после сохранения.`
              : ""}
          </p>
          <Input
            label="Новый временный пароль"
            type="password"
            minLength={10}
            autoComplete="new-password"
            value={replacementPassword}
            onChange={(event) => setReplacementPassword(event.target.value)}
            required
          />
          <p className="text-xs leading-5 text-slate-500">
            Передайте пароль только защищённым способом. После закрытия окна он
            не будет доступен в NaPare.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={closePasswordReset}
            >
              Отмена
            </Button>
            <Button loading={saving} type="submit">
              Сохранить пароль
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
