export interface NavigationTarget { href: string; disabled?: boolean; activePaths?: string[] }

/** Prefer the most specific destination, including query parameters and anchors. */
export function activeNavigationIndex(items: NavigationTarget[], pathname: string, search = '', hash = '') {
  const currentQuery = new URLSearchParams(search);
  let bestIndex = -1;
  let bestScore = -1;
  items.forEach((item, index) => {
    if (item.disabled) return;
    [item.href, ...(item.activePaths || [])].forEach((href) => {
      const target = new URL(href, 'https://workspace.invalid');
      if (target.origin !== 'https://workspace.invalid') return;
      const pathMatches = pathname === target.pathname || (target.pathname !== '/' && pathname.startsWith(`${target.pathname}/`));
      if (!pathMatches || (target.hash && target.hash !== hash)) return;
      if (Array.from(target.searchParams).some(([key, value]) => currentQuery.get(key) !== value)) return;
      const score = target.pathname.length + (target.search ? 1000 : 0) + (target.hash ? 2000 : 0);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
  });
  return bestIndex;
}

export function uniqueCommands<T extends { id: string; href?: string }>(commands: T[]) {
  const seen = new Set<string>();
  return commands.filter((command) => {
    const key = command.href || command.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface WorkspaceSearchResponse {
  results: Array<{ id: string; type: 'lesson' | 'teacher' | 'room' | 'preparation' | 'material'; title: string; subtitle: string; href: string; date?: string }>;
}
export function searchCommands(response: WorkspaceSearchResponse) {
  const labels = { lesson: 'Занятие', teacher: 'Преподаватель', room: 'Аудитория', preparation: 'Подготовка', material: 'Материал' };
  return response.results.filter((result) => result.href.startsWith('/') && !result.href.startsWith('//') && new URL(result.href, 'https://workspace.invalid').origin === 'https://workspace.invalid').map((result) => {
    const url = new URL(result.href, 'https://workspace.invalid');
    if (url.pathname.startsWith('/pair-space/') && (result.type === 'preparation' || result.type === 'material')) url.searchParams.set('tab', result.type === 'material' ? 'materials' : 'homeworks');
    const date = result.date ? new Date(result.date) : null;
    const when = date && Number.isFinite(date.getTime()) && result.type === 'lesson'
      ? date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    return { id: `search:${result.type}:${result.id}`, label: result.title, description: [labels[result.type], when, result.subtitle].filter(Boolean).join(' · '), href: `${url.pathname}${url.search}${url.hash}` };
  });
}

export function lessonTabFromSearch(search: string, personal = false) {
  const params = new URLSearchParams(search);
  const tab = params.get('tab') || (params.get('compose') ? 'homeworks' : 'overview');
  const allowed = ['overview', 'homeworks', 'materials', 'discussion', ...(personal ? ['notes', 'timeline'] : [])];
  return allowed.includes(tab) ? tab : 'overview';
}

export function parseCalendarDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
