'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Button, Input, useToast } from '@/components/ui';

type SettingsSection = 'general' | 'notifications' | 'appearance' | 'security' | 'privacy';

interface SettingsState {
  name: string;
  phone: string;
  scheduleChanges: boolean;
  announcements: boolean;
  homework: boolean;
  absences: boolean;
  theme: 'light' | 'system';
  compactMode: boolean;
  analytics: boolean;
}

const defaultSettings: SettingsState = {
  name: '', phone: '', scheduleChanges: true, announcements: true, homework: true, absences: true,
  theme: 'light', compactMode: false, analytics: false,
};

const sections: Array<{ id: SettingsSection; label: string; description: string }> = [
  { id: 'general', label: 'Общие', description: 'Профиль и региональные настройки' },
  { id: 'notifications', label: 'Уведомления', description: 'Выберите важные события' },
  { id: 'appearance', label: 'Внешний вид', description: 'Настройте интерфейс под себя' },
  { id: 'security', label: 'Безопасность', description: 'Пароль и доступ к аккаунту' },
  { id: 'privacy', label: 'Приватность', description: 'Контроль данных и аналитики' },
];

function SettingToggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"><span><span className="block text-sm font-medium text-slate-800">{label}</span>{description && <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>}</span><span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" /><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></span></label>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [savedSettings, setSavedSettings] = useState<SettingsState>(defaultSettings);
  const [ready, setReady] = useState(false);
  const { toast } = useToast();
  const dirty = ready && JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('napare:student-settings');
      if (stored) {
        const parsed = { ...defaultSettings, ...JSON.parse(stored) } as SettingsState;
        setSettings(parsed);
        setSavedSettings(parsed);
      }
    } catch {
      // Corrupt local preferences should not prevent settings from opening.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    window.localStorage.setItem('napare:student-settings', JSON.stringify(settings));
    setSavedSettings(settings);
    toast('Настройки сохранены', 'success');
  };

  const currentSection = sections.find((section) => section.id === activeSection) || sections[0];

  return <div className="mx-auto max-w-[1180px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="transition-colors hover:text-indigo-600">НаПаре</Link><span>/</span><span className="text-slate-900">Настройки</span></div><div className="lg:hidden"><label htmlFor="settings-section" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Раздел настроек</label><select id="settings-section" value={activeSection} onChange={(event) => setActiveSection(event.target.value as SettingsSection)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></div><div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="hidden lg:block"><Card padding="sm" className="sticky top-24"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Настройки</p><nav aria-label="Настройки аккаунта" className="space-y-1">{sections.map((section) => <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={`w-full rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeSection === section.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><span className="block text-sm font-semibold">{section.label}</span><span className={`mt-1 block text-xs leading-4 ${activeSection === section.id ? 'text-indigo-600/70' : 'text-slate-400'}`}>{section.description}</span></button>)}</nav></Card></aside><main className="min-w-0"><Card className="px-5 py-6 sm:px-7 sm:py-8"><SectionHeading title={currentSection.label} description={currentSection.description} />{activeSection === 'general' && <div className="space-y-4"><Input label="Имя" value={settings.name} onChange={(event) => update('name', event.target.value)} placeholder="Ваше имя" /><Input label="Телефон" value={settings.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+7 (999) 123-45-67" /><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">Изменения профиля сохраняются только на этом устройстве. Учебные данные синхронизируются с университетом.</div></div>}{activeSection === 'notifications' && <div className="space-y-1"><SettingToggle label="Изменения расписания" description="Переносы, отмены и изменения аудиторий" checked={settings.scheduleChanges} onChange={(value) => update('scheduleChanges', value)} /><SettingToggle label="Новые объявления" description="Важные сообщения от преподавателей" checked={settings.announcements} onChange={(value) => update('announcements', value)} /><SettingToggle label="Домашние задания" description="Новые задания и приближение дедлайна" checked={settings.homework} onChange={(value) => update('homework', value)} /><SettingToggle label="Пропуски" description="События, требующие вашего внимания" checked={settings.absences} onChange={(value) => update('absences', value)} /></div>}{activeSection === 'appearance' && <div className="space-y-5"><div><label htmlFor="theme" className="mb-2 block text-sm font-medium text-slate-800">Тема интерфейса</label><select id="theme" value={settings.theme} onChange={(event) => update('theme', event.target.value as SettingsState['theme'])} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="light">Светлая</option><option value="system">Как в системе</option></select></div><SettingToggle label="Компактный режим" description="Больше информации помещается на экране" checked={settings.compactMode} onChange={(value) => update('compactMode', value)} /></div>}{activeSection === 'security' && <div className="space-y-4"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">Пароль и вход</p><p className="mt-1 text-sm leading-6 text-slate-500">Для изменения пароля используйте защищённый экран аккаунта.</p><Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700">Перейти к управлению входом →</Link></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Активные сессии и двухфакторная аутентификация пока не поддерживаются.</div></div>}{activeSection === 'privacy' && <div className="space-y-1"><SettingToggle label="Анонимная аналитика" description="Помогать улучшать НаПаре без передачи персональных данных" checked={settings.analytics} onChange={(value) => update('analytics', value)} /><div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">Мы используем только необходимые данные для работы расписания, заданий и уведомлений.</div></div>}<div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm ${dirty ? 'text-amber-700' : 'text-slate-400'}`}>{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</p><Button onClick={handleSave} disabled={!dirty}>{dirty ? 'Сохранить изменения' : 'Сохранено'}</Button></div></Card></main></div></div>;
}
