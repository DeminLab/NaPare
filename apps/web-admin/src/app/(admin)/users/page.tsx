'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
}

const ASSIGNABLE_ROLES = [
  'student',
  'teacher',
  'curator',
  'faculty_dean',
  'department_head',
  'university_admin',
  'superadmin',
  'developer',
];

const ROLE_LABELS: Record<string, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
  curator: 'Куратор',
  faculty_dean: 'Декан',
  department_head: 'Зав. кафедрой',
  university_admin: 'Админ',
  superadmin: 'Суперадмин',
  developer: 'Разработчик',
};

const ROLE_BADGE: Record<string, 'sky' | 'purple' | 'teal' | 'amber' | 'pink' | 'slate' | 'red' | 'green'> = {
  student: 'sky',
  teacher: 'purple',
  curator: 'teal',
  faculty_dean: 'amber',
  department_head: 'pink',
  university_admin: 'slate',
  superadmin: 'red',
  developer: 'green',
};

const ROLE_FILTERS = ['all', ...ASSIGNABLE_ROLES];
const PAGE_SIZE = 20;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  const loadUsers = async () => {
    try {
      setUsers(await apiFetch<AdminUser[]>('/admin/users'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.roles?.includes(roleFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.firstName?.toLowerCase().includes(q) ||
          u.lastName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, roleFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const changeRole = async (userId: string, role: string) => {
    setSavingId(userId);
    setError('');
    try {
      await apiFetch(`/admin/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить роль');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Пользователи</h1>
        <p className="mt-1 text-sm text-slate-500">
          {filtered.length} из {users.length} пользователей
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Поиск по имени или email..."
          onSearch={setSearch}
          className="sm:w-72"
        />
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                roleFilter === r
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r === 'all' ? 'Все' : ROLE_LABELS[r] || r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {paginated.map((user) => {
          const role = user.roles?.[0] || 'student';
          return (
            <div
              key={user.id}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:p-5"
            >
              <Avatar name={`${user.firstName} ${user.lastName}`} size="md" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>

              <div className="flex flex-shrink-0 items-center gap-3">
                <Badge variant={ROLE_BADGE[role] || 'slate'} size="md">
                  {ROLE_LABELS[role] || role}
                </Badge>

                <select
                  value={role}
                  disabled={savingId === user.id}
                  onChange={(e) => changeRole(user.id, e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
                >
                  {Array.from(new Set([role, ...ASSIGNABLE_ROLES])).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <span className="text-xs font-medium text-slate-500">
                    {user.isActive ? 'Активен' : 'Откл.'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {paginated.length === 0 && (
          <EmptyState
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
            title="Пользователей не найдено"
            description="Попробуйте изменить фильтры или поисковый запрос"
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Назад
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
            .reduce<(number | string)[]>((acc, p, i, arr) => {
              if (i > 0 && (arr[i - 1] as number) < p - 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              typeof p === 'string' ? (
                <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                    page === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
}
