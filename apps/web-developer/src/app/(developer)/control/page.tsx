'use client';
import { useEffect, useState } from 'react';
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
import { type Access, Button, Notice, roles, useResource } from './control-ui';

const sections = [
  { id: 'users', label: 'Пользователи', description: 'Аккаунты, персональные данные и уведомления', icon: 'users' as IconName },
  { id: 'learning', label: 'Учебная среда', description: 'Расписание, пары, задания и посещаемость', icon: 'book' as IconName },
  { id: 'career', label: 'Карьера', description: 'Профили, компании, задачи и практика', icon: 'briefcase' as IconName },
  { id: 'platform', label: 'Платформа', description: 'Сервисы, структура вузов, права и настройки', icon: 'settings' as IconName },
] as const;
type SectionId = typeof sections[number]['id'];
const tabs: Array<{ id: string; label: string; description: string; permission: string; section: SectionId }> = [
  { id: 'services', label: 'Сервисы', description: 'Состояние API и контейнеров, перезапуск и пересборка', permission: 'services.read', section: 'platform' },
  { id: 'user-hub', label: 'Каталог пользователей', description: 'Единый поиск аккаунта и переход к связанным разделам', permission: 'user-directory', section: 'users' },
  { id: 'accounts', label: 'Аккаунты', description: 'Создание, роли, привязка к вузу и группе, пароли и сессии', permission: 'accounts.read', section: 'users' },
  { id: 'personal-records', label: 'Личные записи', description: 'Настройки, избранное, заметки и прогресс подготовки', permission: 'personal-data.read', section: 'users' },
  { id: 'notifications-data', label: 'Уведомления и устройства', description: 'Уведомления, входящие и push-устройства', permission: 'notification-data.read', section: 'users' },
  { id: 'student-data', label: 'Посещаемость и отсутствия', description: 'Посещаемость, отсутствия и решения кураторов', permission: 'student-data.read', section: 'learning' },
  { id: 'homework-submissions', label: 'Сдачи заданий', description: 'Сдачи домашних заданий и исправление статусов', permission: 'homework-data.read', section: 'learning' },
  { id: 'curator-assignments', label: 'Назначения кураторов', description: 'Выдача и отзыв кураторских назначений', permission: 'curation-data.read', section: 'learning' },
  { id: 'announcements', label: 'Объявления', description: 'Объявления в пространствах пар', permission: 'pairspace-content.read', section: 'learning' },
  { id: 'pair-spaces', label: 'Пространства пар', description: 'Связь занятия, группы и преподавателя', permission: 'pairspace-content.read', section: 'learning' },
  { id: 'academic-schedule', label: 'Расписание и каталог', description: 'Занятия, курсы, серии и изменения расписания', permission: 'academic-data.read', section: 'learning' },
  { id: 'events', label: 'События', description: 'Системные события и доставка', permission: 'events-data.read', section: 'learning' },
  { id: 'attachments', label: 'Вложения', description: 'Файлы PairSpace и скрытие ссылок', permission: 'attachments-data.read', section: 'learning' },
  { id: 'discussions', label: 'Обсуждения', description: 'Модерация сообщений и ответов', permission: 'discussion-data.read', section: 'learning' },
  { id: 'career-data', label: 'Профили и поступление', description: 'Карьерные профили, заявки и допуски', permission: 'career-data.read', section: 'career' },
  { id: 'career-companies', label: 'Компании и партнёрства', description: 'Компании, участники и связи с вузами', permission: 'career-data.read', section: 'career' },
  { id: 'career-tasks', label: 'Задачи и проекты', description: 'Задачи, проекты и условия публикации', permission: 'career-data.read', section: 'career' },
  { id: 'career-operations', label: 'Отклики и работы', description: 'Отклики, работы и решения по результатам', permission: 'career-data.read', section: 'career' },
  { id: 'career-memberships', label: 'Доступы компаний', description: 'Доступы сотрудников карьерных центров и компаний', permission: 'career-data.read', section: 'career' },
  { id: 'career-tests', label: 'Тесты и попытки', description: 'Тесты, вопросы и попытки студентов', permission: 'career-data.read', section: 'career' },
  { id: 'career-content', label: 'Портфолио и отзывы', description: 'Кейсы, отзывы и уведомления', permission: 'career-data.read', section: 'career' },
  { id: 'career-planning', label: 'Доступность студентов', description: 'Доступность студентов и окна практики', permission: 'career-data.read', section: 'career' },
  { id: 'universities', label: 'Университеты и структура', description: 'Вузы, факультеты и учебные группы', permission: 'universities.read', section: 'platform' },
  { id: 'permissions', label: 'Контур доверия', description: 'Владелец, делегированные права и экстренный отзыв', permission: 'owner', section: 'platform' },
  { id: 'settings', label: 'Настройки', description: 'Название платформы, поддержка и режим обслуживания', permission: 'settings.read', section: 'platform' },
  { id: 'audit', label: 'Журнал аудита', description: 'История действий, причины и изменения данных', permission: 'audit.read', section: 'platform' },
];
export default function PlatformControlPage() {
  const context = useResource<Access>('/platform/access', 30000);
  const [tab,setTab] = useState('home');
  const [requestedTab, setRequestedTab] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<SectionId | 'none' | null>(null);
  const access = context.data;
  const available = tabs.filter(item => item.permission === 'owner' ? access?.owner : item.permission === 'user-directory' ? access?.permissions.some(permission => ['accounts.read', 'personal-data.read'].includes(permission)) : access?.permissions.includes(item.permission));
  const canEditUniversityMetadata = Boolean(access?.owner && access.permissions.includes('universities.write'));
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
    const url = new URL(window.location.href); url.searchParams.set('tab', id); url.searchParams.delete('userId');
    window.history.pushState(null, '', url);
  };
  const toggleSection = (id: SectionId) => setExpandedSection(current => current === id ? 'none' : id);
  const openUserSection = (id: string, userId: string) => {
    const target = available.find(item => item.id === id);
    setTab(id); setRequestedTab(null); if (target) setExpandedSection(target.section);
    const url = new URL(window.location.href); url.searchParams.set('tab', id); url.searchParams.set('userId', userId);
    window.history.pushState(null, '', url);
  };
  return <div className="control-page mx-auto max-w-[1440px] space-y-5 p-4 text-[var(--color-text)] sm:p-6">
    <header className="control-page-header">
      <div className="min-w-0">
        <p className="workspace-kicker">Платформа · доступ по разрешениям</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Управление платформой</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">
          {access ? `Роль: ${roles[access.actorRole] || access.actorRole} · ${access.owner ? 'владелец платформы' : 'доступ по выданным разрешениям'}. ${access.owner ? 'Глобальная область и полный доступ к платформенным разделам.' : 'Показаны только разрешённые разделы и данные.'}` : 'Проверяем доступ и состав доступных разделов…'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {access && <span className="control-count">Доступно {available.length} из {tabs.length} разделов</span>}
        <Button onClick={context.refresh} disabled={context.loading}>{context.loading ? 'Обновляем…' : 'Обновить доступ'}</Button>
      </div>
    </header>
    {context.error && <Notice error>{context.error}</Notice>}{!access && !context.error && <p role="status" className="text-sm text-slate-400">Проверяем доступ…</p>}
    {access && !access.ownerConfigured && <Notice error>Владелец ещё не назначен на этом сервере. Требуется первоначальная настройка через серверную команду; автоматической выдачи прав по email нет.</Notice>}
    {access?.ownerConfigured && !available.length && <Notice>Разрешения на управление пока не выданы. Их назначает владелец платформы.</Notice>}
    {access && active && requestedTab && requestedTab !== active && <Notice>Запрошенный раздел недоступен по текущим разрешениям. Открыт первый доступный раздел.</Notice>}
    {!!available.length && <div className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside aria-label="Разделы управления платформой" className="control-nav-card lg:sticky lg:top-20">
        <label className="block text-sm font-semibold">Найти раздел<input type="search" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]" value={query} maxLength={80} placeholder="Например: аккаунты, расписание, аудит" onChange={event => setQuery(event.target.value)} /></label>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{term ? searchCount ? `Найдено разделов: ${searchCount}` : 'Ничего не найдено. Уточните запрос или очистите поле.' : 'Выберите категорию, затем нужный раздел.'}</p>
        <nav aria-label="Категории и разделы управления" className="mt-3 space-y-1">
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
        {tab === 'home' && <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">Рабочее место супер-администратора</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Что нужно сделать?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">Основные операции вынесены сюда. Выберите аккаунт или вуз и переходите к его данным; остальные инструменты собраны ниже по областям.</p>
            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {available.some(item => item.id === 'accounts') && <button type="button" onClick={() => select('accounts')} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]">
                <span className="flex items-center gap-2 text-base font-semibold"><Icon name="users" size={18} /> Пользователи и аккаунты</span>
                <span className="mt-2 block text-sm leading-5 text-[var(--color-text-secondary)]">Найти человека, открыть карточку, создать аккаунт, изменить роль и вуз, заблокировать доступ или завершить сессии.</span>
                <span className="mt-3 block text-sm font-semibold text-[var(--color-brand)]">Открыть аккаунты →</span>
              </button>}
              {available.some(item => item.id === 'universities') && <button type="button" onClick={() => select('universities')} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]">
                <span className="flex items-center gap-2 text-base font-semibold"><Icon name="building" size={18} /> Университеты и структура</span>
                <span className="mt-2 block text-sm leading-5 text-[var(--color-text-secondary)]">{canEditUniversityMetadata ? 'Открыть список вузов, изменить сведения об университете, просмотреть и редактировать факультеты и учебные группы.' : access?.permissions.includes('universities.write') ? 'Открыть список доступных вузов, просмотреть и редактировать факультеты и учебные группы.' : 'Открыть список доступных вузов и просмотреть их структуру.'}</span>
                <span className="mt-3 block text-sm font-semibold text-[var(--color-brand)]">Открыть вузы →</span>
              </button>}
            </div>
            {!access?.owner && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Роль: {roles[access?.actorRole ?? ''] || access?.actorRole}. Область данных: {universityScopeLabel}. Роль суперадминистратора сама по себе не делает аккаунт владельцем. Сведения вуза и контур доверия доступны только владельцу платформы; остальные действия зависят от разрешений слева.</p>}
            {access?.owner && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">Роль: {roles[access.actorRole] || access.actorRole} · владелец платформы · полный глобальный доступ. Изменения пользователей и структуры записываются в журнал действий.</p>}
          </section>
          <section aria-label="Все доступные инструменты" className="space-y-3">
            <div><h2 className="text-lg font-semibold">Все разделы управления</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Разделы показаны по областям данных; недоступные по разрешениям скрыты.</p></div>
            <div className="grid gap-3 xl:grid-cols-2">
              {sections.map(section => {
                const items = available.filter(item => item.section === section.id && matches(item));
                if (!items.length) return null;
                return <div key={section.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                  <h3 className="font-semibold">{section.label}</h3><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{section.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{items.map(item => <button key={item.id} type="button" onClick={() => select(item.id)} className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-sm font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]">{item.label}</button>)}</div>
                </div>;
              })}
            </div>
          </section>
        </div>}
        {activeTab && <div className="control-context"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">{activeSectionMeta?.label}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{activeTab.description}</p></div>}
        {access && <>{active === 'services' && <ServicesPanel access={access} />}{active === 'user-hub' && <UserHubPanel access={access} onNavigate={openUserSection} />}{active === 'accounts' && <AccountsPanel access={access} />}{active === 'student-data' && <StudentDataPanel access={access} />}{active === 'personal-records' && <PersonalRecordsPanel access={access} />}{active === 'notifications-data' && <NotificationsDataPanel access={access} />}{active === 'homework-submissions' && <HomeworkSubmissionsPanel access={access} />}{active === 'curator-assignments' && <CuratorAssignmentsPanel access={access} />}{active === 'announcements' && <AnnouncementsPanel access={access} />}{active === 'pair-spaces' && <PairSpacesPanel access={access} />}{active === 'academic-schedule' && <AcademicSchedulePanel access={access} />}{active === 'events' && <EventsPanel access={access} />}{active === 'attachments' && <AttachmentsPanel access={access} />}{active === 'career-data' && <CareerDataPanel access={access} />}{active === 'career-companies' && <CareerCompaniesPanel access={access} />}{active === 'career-tasks' && <CareerTasksPanel access={access} />}{active === 'career-operations' && <CareerOperationsPanel access={access} />}{active === 'career-memberships' && <CareerMembershipsPanel access={access} />}{active === 'career-tests' && <CareerTestsPanel access={access} />}{active === 'career-content' && <CareerContentPanel access={access} />}{active === 'career-planning' && <CareerAvailabilityPanel access={access} />}{active === 'discussions' && <DiscussionsPanel access={access} />}{active === 'universities' && <UniversitiesPanel access={access} />}{active === 'permissions' && access.owner && <PermissionsPanel access={access} />}{active === 'settings' && <SettingsPanel access={access} />}{active === 'audit' && <AuditPanel access={access} />}</>}
      </section>
    </div>}
  </div>;
}
