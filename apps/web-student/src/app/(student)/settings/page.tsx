'use client';

import Link from 'next/link';
import { useWorkspaceQuery } from '@napare/ui/workspace-shell';
import { useCallback, useEffect, useState } from 'react';
import { Card, Button, Input, useToast } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { InstallStudentApp } from '../InstallStudentApp';

type SettingsSection = 'general' | 'notifications' | 'appearance' | 'security' | 'connections' | 'privacy';

interface SettingsState {
  firstName: string;
  lastName: string;
  phone: string;
  theme: 'light' | 'dark' | 'system';
  accent: 'blue' | 'indigo' | 'violet' | 'emerald';
  compactMode: boolean;
}

const defaultSettings: SettingsState = {
  firstName: '', lastName: '', phone: '', theme: 'light', accent: 'indigo', compactMode: false,
};

const accentOptions = [
  { value: 'blue', label: 'Синий', color: '#2563eb' },
  { value: 'indigo', label: 'Индиго', color: '#4f46e5' },
  { value: 'violet', label: 'Фиолетовый', color: '#7c3aed' },
  { value: 'emerald', label: 'Изумрудный', color: '#059669' },
] as const;

interface NotificationPreferences {
  scheduleChanges: boolean;
  cancellations: boolean;
  roomChanges: boolean;
  homeworkCreated: boolean;
  deadlines: boolean;
  messages: boolean;
  announcements: boolean;
  systemAlerts: boolean;
  telegramEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timeZone: string;
}

const defaultNotificationPreferences: NotificationPreferences = {
  scheduleChanges: true, cancellations: true, roomChanges: true, homeworkCreated: true,
  deadlines: true, messages: true, announcements: true, systemAlerts: true, telegramEnabled: false,
  quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00', timeZone: 'UTC',
};

function normalizeNotificationPreferences(value: Partial<NotificationPreferences>): NotificationPreferences {
  return {
    ...defaultNotificationPreferences,
    ...value,
    quietHoursStart: value.quietHoursStart?.slice(0, 5) || defaultNotificationPreferences.quietHoursStart,
    quietHoursEnd: value.quietHoursEnd?.slice(0, 5) || defaultNotificationPreferences.quietHoursEnd,
  };
}

const sections: Array<{ id: SettingsSection; label: string; description: string }> = [
  { id: 'general', label: 'Общие', description: 'Личные данные аккаунта' },
  { id: 'notifications', label: 'Уведомления', description: 'Выберите важные события' },
  { id: 'appearance', label: 'Внешний вид', description: 'Настройте интерфейс под себя' },
  { id: 'security', label: 'Безопасность', description: 'Пароль и доступ к аккаунту' },
  { id: 'connections', label: 'Подключения аккаунта', description: 'Связи с MAX и Telegram' },
  { id: 'privacy', label: 'Приватность', description: 'Контроль данных и аналитики' },
];

function SettingToggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"><span><span className="block text-sm font-medium text-slate-800">{label}</span>{description && <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>}</span><span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-within:ring-4 focus-within:ring-indigo-300 ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" /><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></span></label>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  useWorkspaceQuery({ section: activeSection }, query => {
    setActiveSection(sections.find(section => section.id === query.get('section'))?.id || 'general');
  });
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [savedSettings, setSavedSettings] = useState<SettingsState>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(defaultNotificationPreferences);
  const [savedNotificationPreferences, setSavedNotificationPreferences] = useState(defaultNotificationPreferences);
  const [notificationPreferencesReady, setNotificationPreferencesReady] = useState(false);
  const [notificationPreferencesError, setNotificationPreferencesError] = useState('');
  const [notificationPreferencesSaving, setNotificationPreferencesSaving] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramNotificationsConfigured, setTelegramNotificationsConfigured] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const { toast } = useToast();
  const dirty = ready && JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const notificationPreferencesDirty = notificationPreferencesReady && JSON.stringify(notificationPreferences) !== JSON.stringify(savedNotificationPreferences);
  const hasUnsavedChanges = dirty || notificationPreferencesDirty;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('napare:student-settings');
      if (stored) {
        const storedSettings = JSON.parse(stored) as Record<string, unknown>;
        for (const legacyPreference of ['scheduleChanges', 'announcements', 'homework', 'absences']) {
          delete storedSettings[legacyPreference];
        }
        const parsed: SettingsState = {
          ...defaultSettings,
          theme: storedSettings.theme === 'system' || storedSettings.theme === 'dark' ? storedSettings.theme : 'light',
          accent: accentOptions.some(option => option.value === storedSettings.accent) ? storedSettings.accent as SettingsState['accent'] : 'indigo',
          compactMode: storedSettings.compactMode === true,
        };
        setSettings(parsed);
        setSavedSettings(parsed);
      }
    } catch {
      // Corrupt local preferences should not prevent settings from opening.
    } finally {
      setReady(true);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileError('');
    try {
      const profile = await apiFetch<{ firstName?: string; lastName?: string; phone?: string | null }>('/users/me');
      const fields = { firstName: profile.firstName || '', lastName: profile.lastName || '', phone: profile.phone || '' };
      setSettings(current => ({ ...current, ...fields }));
      setSavedSettings(current => ({ ...current, ...fields }));
      setProfileReady(true);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось загрузить профиль.');
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const loadNotificationPreferences = useCallback(async () => {
    setNotificationPreferencesError('');
    try {
      const value = await apiFetch<Partial<NotificationPreferences>>('/notifications/preferences');
      const normalized = normalizeNotificationPreferences(value);
      setSavedNotificationPreferences(normalized);
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setNotificationPreferences({ ...normalized, timeZone: localTimeZone });
      setNotificationPreferencesReady(true);
    } catch (error) {
      setNotificationPreferencesError(error instanceof Error ? error.message : 'Не удалось загрузить настройки уведомлений.');
    }
  }, []);

  useEffect(() => { void loadNotificationPreferences(); }, [loadNotificationPreferences]);

  useEffect(() => {
    apiFetch<{ linked: boolean; notificationsConfigured: boolean }>('/auth/telegram/status')
      .then(status => {
        setTelegramLinked(status.linked);
        setTelegramNotificationsConfigured(status.notificationsConfigured);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const handleSaveLocalSettings = () => {
    const localSettings = { theme: settings.theme, accent: settings.accent, compactMode: settings.compactMode };
    window.localStorage.setItem('napare:student-settings', JSON.stringify(localSettings));
    window.dispatchEvent(new Event('napare:student-settings-updated'));
    setSavedSettings(current => ({ ...current, ...localSettings }));
    toast('Настройки сохранены', 'success');
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileError('');
    try {
      const profile = await apiFetch<{ firstName?: string; lastName?: string; phone?: string | null }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: settings.firstName.trim(), lastName: settings.lastName.trim(), phone: settings.phone.trim() }),
      });
      const fields = { firstName: profile.firstName || '', lastName: profile.lastName || '', phone: profile.phone || '' };
      setSettings(current => ({ ...current, ...fields }));
      setSavedSettings(current => ({ ...current, ...fields }));
      toast('Профиль сохранён', 'success');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveNotificationPreferences = async () => {
    setNotificationPreferencesSaving(true);
    setNotificationPreferencesError('');
    try {
      const saved = await apiFetch<Partial<NotificationPreferences>>('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(notificationPreferences),
      });
      const normalized = normalizeNotificationPreferences(saved);
      setNotificationPreferences(normalized);
      setSavedNotificationPreferences(normalized);
      toast('Настройки уведомлений сохранены', 'success');
    } catch (error) {
      setNotificationPreferencesError(error instanceof Error ? error.message : 'Не удалось сохранить настройки уведомлений.');
    } finally {
      setNotificationPreferencesSaving(false);
    }
  };

  const updateNotificationPreference = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    setNotificationPreferences(current => ({ ...current, [key]: value }));
  };

  const currentSection = sections.find((section) => section.id === activeSection) || sections[0];

  return <div className="mx-auto max-w-[1180px] space-y-6"><div className="flex items-center gap-2 text-sm text-slate-500"><Link href="/today" className="transition-colors hover:text-indigo-600">НаПаре</Link><span>/</span><span className="text-slate-900">Настройки</span></div><InstallStudentApp /><div className="lg:hidden"><label htmlFor="settings-section" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Раздел настроек</label><select id="settings-section" value={activeSection} onChange={(event) => setActiveSection(event.target.value as SettingsSection)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">{sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></div><div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="hidden lg:block"><Card padding="sm" className="sticky top-24"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Настройки</p><nav aria-label="Настройки аккаунта" className="space-y-1">{sections.map((section) => <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={`w-full rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeSection === section.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><span className="block text-sm font-semibold">{section.label}</span><span className={`mt-1 block text-xs leading-4 ${activeSection === section.id ? 'text-indigo-600/70' : 'text-slate-400'}`}>{section.description}</span></button>)}</nav></Card></aside><div className="min-w-0"><Card className="px-5 py-6 sm:px-7 sm:py-8"><SectionHeading title={currentSection.label} description={currentSection.description} />{activeSection === 'general' && <div className="space-y-4">{profileError && <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{profileError}</span><button type="button" onClick={() => void loadProfile()} className="font-semibold underline">Повторить</button></div>}<fieldset disabled={!profileReady || profileSaving} className="space-y-4 disabled:opacity-60"><Input label="Имя" value={settings.firstName} onChange={(event) => update('firstName', event.target.value)} placeholder="Ваше имя" /><Input label="Фамилия" value={settings.lastName} onChange={(event) => update('lastName', event.target.value)} placeholder="Ваша фамилия" /><Input label="Телефон" type="tel" autoComplete="tel" value={settings.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+7 (999) 123-45-67" /></fieldset><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">Профиль сохраняется в аккаунте и будет доступен на других устройствах. Учебные данные синхронизируются с университетом.</div></div>}{activeSection === 'notifications' && <div className="space-y-2">{notificationPreferencesError && <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{notificationPreferencesError}</span><button type="button" onClick={() => void (notificationPreferencesReady ? handleSaveNotificationPreferences() : loadNotificationPreferences())} className="font-semibold underline">Повторить</button></div>}{!notificationPreferencesReady && <p className="px-3 py-2 text-sm text-slate-500" role="status">Загружаем настройки с сервера…</p>}<fieldset disabled={!notificationPreferencesReady || notificationPreferencesSaving} className="space-y-1 disabled:opacity-60"><fieldset className="rounded-xl border p-3"><legend className="px-2 text-sm font-semibold">Расписание</legend><SettingToggle label="Изменения расписания" description="Переносы и изменения времени занятия" checked={notificationPreferences.scheduleChanges} onChange={(value) => updateNotificationPreference('scheduleChanges', value)} /><SettingToggle label="Отмена пары" description="Отдельные уведомления об отменённых занятиях" checked={notificationPreferences.cancellations} onChange={(value) => updateNotificationPreference('cancellations', value)} /><SettingToggle label="Смена аудитории" description="Новая аудитория для занятия" checked={notificationPreferences.roomChanges} onChange={(value) => updateNotificationPreference('roomChanges', value)} /></fieldset><fieldset className="rounded-xl border p-3"><legend className="px-2 text-sm font-semibold">Подготовка и общение</legend><SettingToggle label="Новые задания" description="Создание и обновление заданий" checked={notificationPreferences.homeworkCreated} onChange={(value) => updateNotificationPreference('homeworkCreated', value)} /><SettingToggle label="Приближение дедлайнов" description="Напоминания о скором сроке задания" checked={notificationPreferences.deadlines} onChange={(value) => updateNotificationPreference('deadlines', value)} /><SettingToggle label="Сообщения" description="Новые сообщения по парам" checked={notificationPreferences.messages} onChange={(value) => updateNotificationPreference('messages', value)} /><SettingToggle label="Объявления преподавателей" description="Новые объявления для группы" checked={notificationPreferences.announcements} onChange={(value) => updateNotificationPreference('announcements', value)} /></fieldset><fieldset className="rounded-xl border p-3"><legend className="px-2 text-sm font-semibold">Система и доставка</legend><SettingToggle label="Системные события" description="Статусы отсутствий, посещаемости и синхронизации" checked={notificationPreferences.systemAlerts} onChange={(value) => updateNotificationPreference('systemAlerts', value)} />{telegramLinked && telegramNotificationsConfigured ? <SettingToggle label="Уведомления в Telegram" description="Дублировать выбранные события в связанный Telegram. Для обычных событий действуют тихие часы и фильтры категорий; срочные проходят по общему правилу уведомлений." checked={notificationPreferences.telegramEnabled} onChange={(value) => updateNotificationPreference('telegramEnabled', value)} /> : <div className="mx-3 my-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">{!telegramNotificationsConfigured ? 'Telegram-уведомления пока не настроены университетом.' : <>Свяжите Telegram, чтобы получать копии уведомлений. <a href="/connections" className="font-semibold text-indigo-700 underline">Подключить Telegram</a></>}</div>}<SettingToggle label="Тихие часы" description="Не создавать обычные уведомления в выбранный период" checked={notificationPreferences.quietHoursEnabled} onChange={(value) => updateNotificationPreference('quietHoursEnabled', value)} />{notificationPreferences.quietHoursEnabled && <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><p className="text-xs text-slate-500 sm:col-span-2">Время рассчитывается по часовому поясу устройства: {notificationPreferences.timeZone}. Нажмите «Сохранить», чтобы применить его.</p><label className="text-sm font-medium text-slate-700">Начало тихих часов<input type="time" value={notificationPreferences.quietHoursStart} onChange={(event) => updateNotificationPreference('quietHoursStart', event.target.value)} className="mt-2 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900" /></label><label className="text-sm font-medium text-slate-700">Окончание тихих часов<input type="time" value={notificationPreferences.quietHoursEnd} onChange={(event) => updateNotificationPreference('quietHoursEnd', event.target.value)} className="mt-2 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900" /></label></div>}</fieldset></fieldset></div>}{activeSection === 'appearance' && <div className="space-y-5"><div><label htmlFor="theme" className="mb-2 block text-sm font-medium text-slate-800">Тема интерфейса</label><select id="theme" value={settings.theme} onChange={(event) => update('theme', event.target.value as SettingsState['theme'])} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="light">Светлая</option><option value="dark">Тёмная</option><option value="system">Как в системе</option></select></div><div><p id="accent-label" className="mb-2 block text-sm font-medium text-slate-800">Акцентный цвет</p><div role="group" aria-labelledby="accent-label" className="flex flex-wrap gap-2">{accentOptions.map(option => <button key={option.value} type="button" aria-pressed={settings.accent === option.value} onClick={() => update("accent", option.value)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${settings.accent === option.value ? "border-indigo-300 bg-indigo-50 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><span aria-hidden="true" className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: option.color }} />{option.label}</button>)}</div></div><SettingToggle label="Компактный режим" description="Больше информации помещается на экране" checked={settings.compactMode} onChange={(value) => update('compactMode', value)} /></div>}{activeSection === 'security' && <div className="space-y-4"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-900">Пароль и вход</p><p className="mt-1 text-sm leading-6 text-slate-500">Пароль выдаёт университет. Чтобы изменить или восстановить его, обратитесь в учебную часть или к администратору НаПаре в вашем университете.</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Активные сессии и двухфакторная аутентификация пока не поддерживаются.</div></div>}{activeSection === 'connections' && <div className="rounded-xl border border-slate-200 p-4 sm:p-5"><h2 className="text-base font-semibold text-slate-900">MAX и Telegram</h2><p className="mt-2 text-sm leading-6 text-slate-600">Управляйте привязкой MAX для входа в аккаунт и подключением Telegram для уведомлений.</p><a href="/connections" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800">Открыть подключения аккаунта</a></div>}{activeSection === 'privacy' && <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">НаПаре использует данные аккаунта для расписания, учебных материалов и доставки выбранных уведомлений. Отдельный сбор аналитики в студенческом приложении не подключён.</div>}{['general', 'notifications', 'appearance'].includes(activeSection) && <div className={`mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${(activeSection === 'notifications' ? notificationPreferencesDirty : dirty) ? 'sticky bottom-20 z-10 rounded-xl border shadow-sm sm:static sm:shadow-none' : ''}`}><p className={`text-sm ${(activeSection === 'notifications' ? notificationPreferencesDirty : dirty) ? 'text-amber-700' : 'text-slate-400'}`}>{(activeSection === 'notifications' ? notificationPreferencesDirty : dirty) ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</p><Button onClick={activeSection === 'notifications' ? handleSaveNotificationPreferences : activeSection === 'general' ? handleSaveProfile : handleSaveLocalSettings} loading={activeSection === 'notifications' ? notificationPreferencesSaving : activeSection === 'general' && profileSaving} disabled={activeSection === 'notifications' ? !notificationPreferencesDirty || !notificationPreferencesReady || notificationPreferencesSaving : activeSection === 'general' ? !dirty || !profileReady || profileSaving : !dirty}>{activeSection === 'notifications' ? notificationPreferencesSaving ? 'Сохраняем…' : notificationPreferencesDirty ? 'Сохранить настройки уведомлений' : 'Сохранено' : activeSection === 'general' && profileSaving ? 'Сохраняем…' : dirty ? 'Сохранить изменения' : 'Сохранено'}</Button></div>}</Card></div></div></div>;
}
