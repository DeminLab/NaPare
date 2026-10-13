'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallStudentApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    try { setDismissed(sessionStorage.getItem('napare:install-dismissed') === 'true'); } catch { /* The hint remains available when storage is disabled. */ }
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const handleInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="install-student-app">
      <div className="flex items-start justify-between gap-3"><div><h2 id="install-student-app" className="text-sm font-semibold text-slate-900">Быстрый доступ с домашнего экрана</h2><p className="mt-1 text-sm text-slate-600">Добавьте НаПаре на устройство, чтобы быстрее открывать расписание.</p></div><button type="button" aria-label="Скрыть подсказку установки" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-indigo-100" onClick={() => { setDismissed(true); try { sessionStorage.setItem('napare:install-dismissed', 'true'); } catch { /* Dismissal still works for this render. */ } }}>×</button></div>
      {prompt ? (
        <button className="mt-3 min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={async () => {
          await prompt.prompt();
          const choice = await prompt.userChoice;
          if (choice.outcome === 'accepted') setPrompt(null);
        }}>
          Установить приложение
        </button>
      ) : ios ? (
        <p className="mt-3 text-sm text-slate-700">В Safari нажмите «Поделиться», затем «На экран Домой».</p>
      ) : (
        <p className="mt-3 text-sm text-slate-700">Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».</p>
      )}
    </section>
  );
}
