'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@napare/ui';
import ServicesPanel from './ServicesPanel';
import AccountsPanel from './AccountsPanel';
import PermissionsPanel from './PermissionsPanel';
import SettingsPanel from './SettingsPanel';
import UniversitiesPanel from './UniversitiesPanel';
import AuditPanel from './AuditPanel';
import StudentDataPanel from './StudentDataPanel';
import PersonalRecordsPanel from './PersonalRecordsPanel';
import CareerDataPanel from './CareerDataPanel';
import DiscussionsPanel from './DiscussionsPanel';
import CareerOperationsPanel from './CareerOperationsPanel';
import CareerCompaniesPanel from './CareerCompaniesPanel';
import CareerTasksPanel from './CareerTasksPanel';
import CareerMembershipsPanel from './CareerMembershipsPanel';
import CareerTestsPanel from './CareerTestsPanel';
import CareerContentPanel from './CareerContentPanel';
import CareerAvailabilityPanel from './CareerAvailabilityPanel';
import UserHubPanel from './UserHubPanel';
import HomeworkSubmissionsPanel from './HomeworkSubmissionsPanel';
import NotificationsDataPanel from './NotificationsDataPanel';
import CuratorAssignmentsPanel from './CuratorAssignmentsPanel';
import AnnouncementsPanel from './AnnouncementsPanel';
import PairSpacesPanel from './PairSpacesPanel';
import AcademicSchedulePanel from './AcademicSchedulePanel';
import EventsPanel from './EventsPanel';
import AttachmentsPanel from './AttachmentsPanel';
import GlobalObjectSearch from './GlobalObjectSearch';
import { type Access, Button, Notice, roles, useResource } from './control-ui';

const sections = [
  { id: 'organizations', label: 'Университеты', description: 'Организации, факультеты и учебные группы', icon: 'building' as IconName },
  { id: 'people', label: 'Пользователи', description: 'Аккаунты, роли и назначения', icon: 'users' as IconName },
  { id: 'data', label: 'Данные и интеграции', description: 'Расписание, учебные данные и карьера', icon: 'book' as IconName },
  { id: 'operations', label: 'Операции', description: 'Сервисы, события и доставка уведомлений', icon: 'settings' as IconName },
  { id: 'security', label: 'Безопасность и аудит', description: 'Права команды, журнал и настройки платформы', icon: 'lock' as IconName },
] as const;
type SectionId = typeof sections[number]['id'];
const tabs: Array<{ id: string; label: string; description: string; permission: string; section: SectionId }> = [
  { id: 'services', label: 'Сервисы', description: 'Состояние API и контейнеров, перезапуск и пересборка', permission: 'services.read', section: 'operations' },
  { id: 'user-hub', label: 'Каталог пользователей', description: 'Единый поиск аккаунта и переход к связанным разделам', permission: 'user-directory', section: 'people' },
  { id: 'accounts', label: 'Аккаунты', description: 'Создание, роли, привязка к вузу и группе, пароли и сессии', permission: 'accounts.read', section: 'people' },
  { id: 'personal-records', label: 'Личные записи', description: 'Настройки, избранное, заметки и прогресс подготовки', permission: 'personal-data.read', section: 'data' },
  { id: 'notifications-data', label: 'Уведомления и устройства', description: 'Уведомления, входящие и push-устройства', permission: 'notification-data.read', section: 'operations' },
  { id: 'student-data', label: 'Посещаемость и отсутствия', description: 'Посещаемость, отсутствия и решения кураторов', permission: 'student-data.read', section: 'data' },
  { id: 'homework-submissions', label: 'Сдачи заданий', description: 'Сдачи домашних заданий и исправление статусов', permission: 'homework-data.read', section: 'data' },
  { id: 'curator-assignments', label: 'Назначения кураторов', description: 'Выдача и отзыв кураторских назначений', permission: 'curation-data.read', section: 'people' },
  { id: 'announcements', label: 'Объявления', description: 'Объявления в пространствах пар', permission: 'pairspace-content.read', section: 'data' },
  { id: 'pair-spaces', label: 'Пространства пар', description: 'Связь занятия, группы и преподавателя', permission: 'pairspace-content.read', section: 'data' },
  { id: 'academic-schedule', label: 'Расписание и каталог', description: 'Занятия, курсы, серии и изменения расписания', permission: 'academic-data.read', section: 'data' },
  { id: 'events', label: 'События', description: 'Системные события и доставка', permission: 'events-data.read', section: 'operations' },
  { id: 'attachments', label: 'Вложения', description: 'Файлы PairSpace и скрытие ссылок', permission: 'attachments-data.read', section: 'data' },
  { id: 'discussions', label: 'Обсуждения', description: 'Модерация сообщений и ответов', permission: 'discussion-data.read', section: 'data' },
  { id: 'career-data', label: 'Профили и поступление', description: 'Карьерные профили, заявки и допуски', permission: 'career-data.read', section: 'data' },
  { id: 'career-companies', label: 'Компании и партнёрства', description: 'Компании, участники и связи с вузами', permission: 'career-data.read', section: 'data' },
  { id: 'career-tasks', label: 'Задачи и проекты', description: 'Задачи, проекты и условия публикации', permission: 'career-data.read', section: 'data' },
  { id: 'career-operations', label: 'Отклики и работы', description: 'Отклики, работы и решения по результатам', permission: 'career-data.read', section: 'data' },
  { id: 'career-memberships', label: 'Доступы компаний', description: 'Доступы сотрудников карьерных центров и компаний', permission: 'career-data.read', section: 'people' },
  { id: 'career-tests', label: 'Тесты и попытки', description: 'Тесты, вопросы и попытки студентов', permission: 'career-data.read', section: 'data' },
  { id: 'career-content', label: 'Портфолио и отзывы', description: 'Кейсы, отзывы и уведомления', permission: 'career-data.read', section: 'data' },
  { id: 'career-planning', label: 'Доступность студентов', description: 'Доступность студентов и окна практики', permission: 'career-data.read', section: 'data' },
  { id: 'universities', label: 'Каталог вузов и структура', description: 'Вузы, факультеты и учебные группы', permission: 'universities.read', section: 'organizations' },
  { id: 'permissions', label: 'Контур доверия', description: 'Владелец, делегированные права и экстренный отзыв', permission: 'owner', section: 'security' },
  { id: 'settings', label: 'Настройки платформы', description: 'Название платформы, поддержка и режим обслуживания', permission: 'settings.read', section: 'security' },
  { id: 'audit', label: 'Журнал аудита', description: 'История действий, причины и изменения данных', permission: 'audit.read', section: 'security' },
];
export default function PlatformControlPage() {
  const context = useResource<Access>('/platform/access', 30000);
  const [tab,setTab] = useState('home');
  const [requestedTab, setRequestedTab] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<SectionId | 'none' | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTrigger = useRef<HTMLButtonElement | null>(null);
  const access = context.data;
  const available = tabs.filter(item => item.permission === 'owner' ? access?.owner : item.permission === 'user-directory' ? access?.permissions.some(permission => ['accounts.read', 'personal-data.read'].includes(permission)) : access?.permissions.includes(item.permission));
  const universityScopeLabel = access?.owner || access?.organizationIds === null ? 'глобальная область' : `выбранные вузы (${access?.organizationIds?.length ?? 0})`;
  useEffect(() => {
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('tab');
      if (!id) { setTab('home'); setRequestedTab(null); setExpandedSection(null); return; }
      setRequestedTab(id);
      const target = tabs.find(item => item.id === id);
      if (target) { setTab(target.id); setExpandedSection(target.section); }
    };
    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);
  useEffect(() => { const refresh = () => context.refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [context.refresh]);
  const active = tab === 'home' ? undefined : available.find(item => item.id === tab)?.id || available[0]?.id;
  const activeTab = available.find(item => item.id === active);
  const activeSection = activeTab?.section;
  const activeSectionMeta = sections.find(item => item.id === activeSection);
  const visibleSections = sections.filter(item => available.some(tabItem => tabItem.section === item.id));
  const term = query.trim().toLowerCase();
  const matches = (item: typeof tabs[number]) => !term || [item.label, item.description, sections.find(section => section.id === item.section)?.label ?? ''].join(' ').toLowerCase().includes(term);
  const tabsForSection = (sectionId: SectionId) => available.filter(item => item.section === sectionId && matches(item));
  const searchCount = term ? available.filter(matches).length : 0;
  useEffect(() => {
    if (!access || !active) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') !== active) {
      url.searchParams.set('tab', active);
      window.history.replaceState(null, '', url);
    }
  }, [access, active]);
  const select = (id: string) => {
    const target = available.find(item => item.id === id);
    setTab(id); setRequestedTab(null); setQuery('');
    if (target) setExpandedSection(target.section);
    const url = new URL(window.location.href); url.searchParams.set('tab', id); url.searchParams.delete('userId'); url.searchParams.delete('universityId'); url.searchParams.delete('universityQuery');
    window.history.pushState(null, '', url);
    setMobileNavOpen(false);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => mobileNavTrigger.current?.focus());
    }
  };
  const toggleSection = (id: SectionId) => setExpandedSection(current => current === id ? 'none' : id);
  const openUserSection = (id: string, userId: string) => {
    const target = available.find(item => item.id === id);
    setTab(id); setRequestedTab(null); if (target) setExpandedSection(target.section);
    const url = new URL(window.location.href); url.searchParams.set('tab', id); url.searchParams.set('userId', userId); url.searchParams.delete('universityId'); url.searchParams.delete('universityQuery');
    window.history.pushState(null, '', url);
    setMobileNavOpen(false);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => mobileNavTrigger.current?.focus());
    }
  };
  const openAccount = (userId: string) => openUserSection('accounts', userId);
  const openUniversity = (universityId: string, name: string) => {
    const target = available.find(item => item.id === 'universities');
    if (!target) return;
    setTab('universities'); setRequestedTab(null); setQuery(''); setExpandedSection(target.section);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'universities');
    url.searchParams.set('universityId', universityId);
    url.searchParams.set('universityQuery', name);
    url.searchParams.delete('userId');
    window.history.pushState(null, '', url);
    setMobileNavOpen(false);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => mobileNavTrigger.current?.focus());
    }
  };
  const homeActions: Array<{ id: string; title: string; description: string; icon: IconName }> = [
    ...(available.some(item => item.id === 'universities') ? [{ id: 'universities', title: 'Университеты', description: 'Открыть вуз, его факультеты и учебные группы.', icon: 'building' as IconName }] : []),
    ...(available.some(item => item.id === 'user-hub') ? [{ id: 'user-hub', title: 'Найти пользователя', description: 'Поиск аккаунта и переход к связанным разделам.', icon: 'users' as IconName }] : available.some(item => item.id === 'accounts') ? [{ id: 'accounts', title: 'Аккаунты', description: 'Создать аккаунт, изменить роль или доступ.', icon: 'users' as IconName }] : []),
    ...(available.some(item => item.id === 'academic-schedule') ? [{ id: 'academic-schedule', title: 'Расписание и каталог', description: 'Учебные данные, занятия и изменения расписания.', icon: 'calendar' as IconName }] : []),
    ...(available.some(item => item.id === 'services') ? [{ id: 'services', title: 'Состояние сервисов', description: 'Проверить состояние и доступные операции.', icon: 'pulse' as IconName }] : []),
    ...(available.some(item => item.id === 'audit') ? [{ id: 'audit', title: 'Журнал аудита', description: 'Найти действие, оператора и указанную причину.', icon: 'clipboard' as IconName }] : []),
  ];
  return <div className="control-page mx-auto max-w-[1440px] space-y-5 p-4 text-[var(--color-text)] sm:p-6">
    <header className="control-page-header">
      <div className="min-w-0">
        <p className="workspace-kicker">Панель платформы</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Управление платформой</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">
          {access ? `${roles[access.actorRole] || access.actorRole} · область: ${universityScopeLabel}. ${access.owner ? 'Вы владелец платформы.' : 'Доступ ограничен выданными правами; роль сама по себе не даёт прав владельца.'}` : 'Проверяем вашу роль и доступ…'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={context.refresh} disabled={context.loading}>{context.loading ? 'Обновляем…' : 'Обновить доступ'}</Button>
      </div>
    </header>
    {context.error && <Notice error>{context.error}</Notice>}{!access && !context.error && <p role="status" className="text-sm text-slate-400">Проверяем доступ…</p>}
    {access && !access.ownerConfigured && <Notice error>Владелец ещё не назначен на этом сервере. Требуется первоначальная настройка через серверную команду; автоматической выдачи прав по email нет.</Notice>}
    {access?.ownerConfigured && !available.length && <Notice>Разрешения на управление пока не выданы. Их назначает владелец платформы.</Notice>}
    {access && active && requestedTab && requestedTab !== active && <Notice>Запрошенный раздел недоступен по текущим разрешениям. Открыт первый доступный раздел.</Notice>}
    {!!available.length && <div className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
      <button
        ref={mobileNavTrigger}
        type="button"
        className="control-mobile-nav-trigger lg:hidden"
        aria-expanded={mobileNavOpen}
        aria-controls="platform-control-navigation"
        onClick={() => setMobileNavOpen(open => !open)}
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Разделы платформы</span>
          <span className="mt-0.5 block truncate font-semibold">{activeTab ? activeTab.label : 'Выберите задачу'}</span>
        </span>
        <span className="control-mobile-nav-action">{mobileNavOpen ? 'Свернуть' : 'Все разделы'}</span>
      </button>
      <aside id="platform-control-navigation" aria-label="Навигация панели платформы" className={`control-nav-card lg:sticky lg:top-20 ${mobileNavOpen ? 'block' : 'hidden lg:block'}`}>
        <label className="block text-sm font-semibold">Найти инструмент<input type="search" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]" value={query} maxLength={80} placeholder="Например: преподаватель, группа, расписание" onChange={event => setQuery(event.target.value)} /></label>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]" role="status" aria-live="polite">{term ? searchCount ? `Найдено инструментов: ${searchCount}` : 'Совпадений нет. Проверьте запрос или очистите поиск.' : 'Выберите рабочую область. Доступные действия отфильтрованы по вашим правам.'}</p>
        <nav aria-label="Рабочие области и инструменты" className="mt-3 space-y-1">
          {visibleSections.map(section => {
            const sectionTabs = tabsForSection(section.id);
            if (!sectionTabs.length) return null;
            const expanded = term ? true : expandedSection === null ? activeSection === section.id : expandedSection === section.id;
            return <div key={section.id} className="control-nav-group">
              <button type="button" aria-expanded={expanded} onClick={() => toggleSection(section.id)} className={`control-nav-category ${expanded ? 'is-active' : ''}`}>
                <span className="control-nav-icon" aria-hidden="true"><Icon name={section.icon} size={17} /></span>
                <span className="min-w-0 flex-1 text-left"><span className="block font-semibold">{section.label}</span><span className="mt-0.5 block text-xs font-normal opacity-75">{section.description}</span></span>
                <span className="control-nav-count">{sectionTabs.length}</span>
                <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} />
              </button>
              {expanded && <div className="mt-1 space-y-0.5">{sectionTabs.map(item => <button key={item.id} type="button" aria-pressed={active === item.id} title={item.description} onClick={() => select(item.id)} className={`control-nav-tab ${active === item.id ? 'is-active' : ''}`}>{item.label}</button>)}</div>}
            </div>;
          })}
        </nav>
      </aside>
      <section aria-live="polite" aria-label={activeTab ? `Раздел: ${activeTab.label}` : 'Раздел управления'} className="control-content min-w-0 space-y-4">
        {tab === 'home' && <div className="space-y-4">
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-brand)]">Обзор</p><h2 className="mt-1 text-xl font-bold tracking-tight">С чего начать</h2><p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">Выберите задачу. Панель покажет только разделы и данные, доступные вашей роли.</p></div>
              {access && <span className="control-count">{access.owner ? 'Владелец платформы' : roles[access.actorRole] || access.actorRole}</span>}
            </div>
            {homeActions.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Быстрый переход к задачам">
              {homeActions.map(action => <button key={action.id} type="button" onClick={() => select(action.id)} className="group flex min-h-[5.5rem] items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-brand)]" aria-hidden="true"><Icon name={action.icon} size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold group-hover:text-[var(--color-brand-strong)]">{action.title}</span><span className="mt-1 block text-sm leading-5 text-[var(--color-text-secondary)]">{action.description}</span></span>
                <Icon name="arrow-right" size={16} />
              </button>)}
            </div> : <Notice>Для этой учётной записи нет доступных действий. Если доступ должен быть выдан, обратитесь к владельцу платформы.</Notice>}
            {access && <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-sm text-[var(--color-text-secondary)]">Область данных: <strong className="font-semibold text-[var(--color-text)]">{universityScopeLabel}</strong>{!access.owner && ' · права владельца платформы и изменение глобальных настроек не входят в эту роль.'}</p>}
          </section>
          <p className="px-1 text-sm text-[var(--color-text-secondary)]">Нужен другой раздел? Используйте поиск инструментов или раскройте рабочую область слева.</p>
          {access && <GlobalObjectSearch access={access} onOpenAccount={openAccount} onOpenUniversity={openUniversity} />}
        </div>}
        {activeTab && <div className="control-context"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">{activeSectionMeta?.label}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{activeTab.description}</p></div>}
        {access && <>{active === 'services' && <ServicesPanel access={access} />}{active === 'user-hub' && <UserHubPanel access={access} onNavigate={openUserSection} />}{active === 'accounts' && <AccountsPanel access={access} />}{active === 'student-data' && <StudentDataPanel access={access} />}{active === 'personal-records' && <PersonalRecordsPanel access={access} />}{active === 'notifications-data' && <NotificationsDataPanel access={access} />}{active === 'homework-submissions' && <HomeworkSubmissionsPanel access={access} />}{active === 'curator-assignments' && <CuratorAssignmentsPanel access={access} />}{active === 'announcements' && <AnnouncementsPanel access={access} />}{active === 'pair-spaces' && <PairSpacesPanel access={access} />}{active === 'academic-schedule' && <AcademicSchedulePanel access={access} />}{active === 'events' && <EventsPanel access={access} />}{active === 'attachments' && <AttachmentsPanel access={access} />}{active === 'career-data' && <CareerDataPanel access={access} />}{active === 'career-companies' && <CareerCompaniesPanel access={access} />}{active === 'career-tasks' && <CareerTasksPanel access={access} />}{active === 'career-operations' && <CareerOperationsPanel access={access} />}{active === 'career-memberships' && <CareerMembershipsPanel access={access} />}{active === 'career-tests' && <CareerTestsPanel access={access} />}{active === 'career-content' && <CareerContentPanel access={access} />}{active === 'career-planning' && <CareerAvailabilityPanel access={access} />}{active === 'discussions' && <DiscussionsPanel access={access} />}{active === 'universities' && <UniversitiesPanel access={access} />}{active === 'permissions' && access.owner && <PermissionsPanel access={access} />}{active === 'settings' && <SettingsPanel access={access} />}{active === 'audit' && <AuditPanel access={access} />}</>}
      </section>
    </div>}
  </div>;
}
