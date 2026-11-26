'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type Access, type Page, Notice, inputClass, panelClass, roles } from './control-ui';

interface AccountResult {
  id: string;
  username?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface UniversityResult {
  id: string;
  name: string;
  city: string;
  status: string;
}

interface SearchState {
  loading: boolean;
  accounts: AccountResult[];
  universities: UniversityResult[];
  accountError: string;
  universityError: string;
}

const emptyState: SearchState = {
  loading: false,
  accounts: [],
  universities: [],
  accountError: '',
  universityError: '',
};
const universityStatusLabels: Record<string, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
  pending: 'Ожидает подключения',
};

export default function GlobalObjectSearch({
  access,
  onOpenAccount,
  onOpenUniversity,
}: {
  access: Access;
  onOpenAccount: (userId: string) => void;
  onOpenUniversity: (universityId: string, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>(emptyState);
  const canSearchAccounts = access.permissions.includes('accounts.read');
  const canSearchUniversities = access.permissions.includes('universities.read');
  const canSearch = canSearchAccounts || canSearchUniversities;
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2 || !canSearch) {
      setState(emptyState);
      return;
    }

    setState({ ...emptyState, loading: true });
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: term, page: '1', limit: '5' });
      const accountParams = new URLSearchParams(params);
      accountParams.set('status', 'active');
      const accountRequest = canSearchAccounts
        ? apiFetch<Page<AccountResult>>(`/platform/accounts?${accountParams}`, { signal: controller.signal, cache: 'no-store' })
            .then(result => ({ data: result.data.slice(0, 5), error: '' }))
            .catch(error => ({ data: [] as AccountResult[], error: error instanceof Error ? error.message : 'Не удалось найти аккаунты.' }))
        : Promise.resolve({ data: [] as AccountResult[], error: '' });
      const universityRequest = canSearchUniversities
        ? apiFetch<Page<UniversityResult>>(`/platform/universities?${params}`, { signal: controller.signal, cache: 'no-store' })
            .then(result => ({ data: result.data.slice(0, 5), error: '' }))
            .catch(error => ({ data: [] as UniversityResult[], error: error instanceof Error ? error.message : 'Не удалось найти вузы.' }))
        : Promise.resolve({ data: [] as UniversityResult[], error: '' });

      void Promise.all([accountRequest, universityRequest]).then(([accounts, universities]) => {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          accounts: accounts.data,
          universities: universities.data,
          accountError: accounts.error,
          universityError: universities.error,
        });
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, canSearch, canSearchAccounts, canSearchUniversities]);

  if (!canSearch) return null;

  const hasResults = state.accounts.length > 0 || state.universities.length > 0;
  const hasErrors = Boolean(state.accountError || state.universityError);

  return <section className={`${panelClass} space-y-3`} aria-labelledby="platform-object-search-title">
    <div>
      <h2 id="platform-object-search-title" className="text-lg font-semibold">Поиск по платформе</h2>
      <p className="mt-1 text-sm text-slate-400">Ищет только в тех областях, к которым у вас есть доступ. Факультеты и группы ищите внутри выбранного вуза.</p>
      <p className="mt-1 text-xs text-slate-500">Показываем до 5 совпадений каждого типа. Уточните запрос, чтобы сузить список.</p>
    </div>
    <label className="block text-sm font-medium" htmlFor="platform-object-search">Вуз или аккаунт
      <input
        id="platform-object-search"
        className={inputClass}
        type="search"
        maxLength={100}
        autoComplete="off"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Название вуза, логин или ФИО"
        aria-describedby="platform-object-search-hint"
      />
    </label>
    <p id="platform-object-search-hint" className="text-xs text-slate-400">Введите не менее 2 символов. Поиск запускается автоматически.</p>
    {term.length < 2 && <p className="text-sm text-slate-400">Результаты появятся здесь.</p>}
    {term.length >= 2 && state.loading && <p role="status" aria-live="polite" className="text-sm text-slate-400">Ищем аккаунты и вузы…</p>}
    {hasErrors && <div className="space-y-2" aria-label="Ошибки поиска">
      {state.accountError && <Notice error>Не удалось выполнить поиск аккаунтов: {state.accountError}</Notice>}
      {state.universityError && <Notice error>Не удалось выполнить поиск вузов: {state.universityError}</Notice>}
    </div>}
    {term.length >= 2 && !state.loading && !hasResults && !hasErrors && <p role="status" className="text-sm text-slate-400">Совпадений нет. Измените запрос.</p>}
    {hasResults && <div className="grid gap-4 md:grid-cols-2">
      {state.accounts.length > 0 && <section aria-labelledby="platform-account-results-title" className="min-w-0">
        <h3 id="platform-account-results-title" className="mb-2 text-sm font-semibold">Аккаунты</h3>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {state.accounts.map(account => <li key={account.id}>
            <button type="button" onClick={() => onOpenAccount(account.id)} className="flex min-h-16 w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{account.lastName} {account.firstName}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{account.username ? `@${account.username}` : account.email} · {roles[account.role] || account.role}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-[var(--color-brand)]">Открыть</span>
            </button>
          </li>)}
        </ul>
      </section>}
      {state.universities.length > 0 && <section aria-labelledby="platform-university-results-title" className="min-w-0">
        <h3 id="platform-university-results-title" className="mb-2 text-sm font-semibold">Вузы</h3>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {state.universities.map(university => <li key={university.id}>
            <button type="button" onClick={() => onOpenUniversity(university.id, university.name)} className="flex min-h-16 w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{university.name}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{university.city} · {universityStatusLabels[university.status] || university.status}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-[var(--color-brand)]">Открыть</span>
            </button>
          </li>)}
        </ul>
      </section>}
    </div>}
  </section>;
}
