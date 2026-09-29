'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallStudentApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
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

  if (installed) return null;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="install-student-app">
      <h2 id="install-student-app" className="text-lg font-semibold text-slate-900">НаПаре на домашнем экране</h2>
      <p className="mt-1 text-sm text-slate-600">
        Открывайте студенческий кабинет отдельным окном и быстрее возвращайтесь к расписанию.
      </p>
      {prompt ? (
        <button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={async () => {
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
