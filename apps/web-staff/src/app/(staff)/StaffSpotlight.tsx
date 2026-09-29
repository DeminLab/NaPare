'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type ResultType = 'lesson' | 'teacher' | 'room' | 'preparation' | 'material';
interface SearchResult { id: string; type: ResultType; title: string; subtitle: string; href: string; date?: string; }
interface SearchResponse { query: string; results: SearchResult[]; }

const labels: Record<ResultType, string> = {
  lesson: 'Занятие', teacher: 'Преподаватель', room: 'Аудитория',
  preparation: 'Подготовка', material: 'Материал',
};

export function StaffSpotlight() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = query.trim();
  const groups = useMemo(() => {
    const order: ResultType[] = ['lesson', 'teacher', 'room', 'preparation', 'material'];
    return order.map(type => ({ type, items: results.filter(result => result.type === type) })).filter(group => group.items.length);
  }, [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setError('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const navigate = useCallback((result: SearchResult) => {
    close();
    router.push(result.href);
  }, [close, router]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [close, open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open || normalizedQuery.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setResults([]);
    setActiveIndex(0);
    setLoading(true);
    const timer = window.setTimeout(() => {
      void apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal })
        .then(response => setResults(response.results))
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Не удалось выполнить поиск.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [normalizedQuery, open]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setActiveIndex(index => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      navigate(results[activeIndex]);
    }
  };

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-label="Поиск по NaPare" className="fixed bottom-6 right-6 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 transition hover:border-sky-300 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">
      <span aria-hidden="true" className="text-lg leading-none">⌕</span><span>Поиск</span><kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">Ctrl/⌘ K</kbd>
    </button>
    {open && <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 pb-20 pt-[12vh] backdrop-blur-sm sm:px-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="staff-spotlight-title">
        <h2 id="staff-spotlight-title" className="sr-only">Поиск по NaPare</h2>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4"><span aria-hidden="true" className="text-2xl text-sky-600">⌕</span><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onInputKeyDown} placeholder="Пара, преподаватель, аудитория, задание…" className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" autoComplete="off" aria-label="Запрос поиска" aria-controls="staff-spotlight-results" aria-activedescendant={results[activeIndex] ? `staff-spotlight-option-${activeIndex}` : undefined}/><button type="button" onClick={close} className="min-h-9 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-500 hover:bg-slate-50" aria-label="Закрыть поиск">Esc</button></div>
        <div id="staff-spotlight-results" role="listbox" aria-label="Результаты поиска" className="max-h-[min(65vh,560px)] overflow-y-auto p-2">
          {normalizedQuery.length < 2 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Введите хотя бы два символа. Ищем в данных, доступных вашей роли.</p>
            : loading ? <p className="px-3 py-8 text-center text-sm text-slate-500" role="status">Ищем…</p>
              : error ? <p className="px-3 py-8 text-center text-sm text-rose-700" role="alert">{error}</p>
                : groups.length ? groups.map(group => <div key={group.type} className="py-1"><h3 className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">{labels[group.type]}</h3>{group.items.map(result => {
                  const index = results.findIndex(item => item.id === result.id);
                  return <button id={`staff-spotlight-option-${index}`} key={result.id} type="button" role="option" aria-selected={activeIndex === index} onMouseEnter={() => setActiveIndex(index)} onClick={() => navigate(result)} className={`w-full rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${activeIndex === index ? 'bg-sky-50' : 'hover:bg-slate-50'}`}><span className="block truncate text-sm font-semibold text-slate-900">{result.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}{result.date ? ` · ${new Date(result.date).toLocaleDateString('ru-RU')}` : ''}</span></button>;
                })}</div>)
                  : <p className="px-3 py-8 text-center text-sm text-slate-500">Ничего не найдено по запросу «{normalizedQuery}».</p>}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400"><span>↑↓ выбрать · Enter открыть</span><span>Только доступные данные</span></div>
      </section>
    </div>}
  </>;
}
