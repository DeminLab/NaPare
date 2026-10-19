'use client';
import { useEffect, useState } from 'react';
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
import AttendanceQrSessionsPanel from './AttendanceQrSessionsPanel';
import AnnouncementsPanel from './AnnouncementsPanel';
import PairSpacesPanel from './PairSpacesPanel';
import AcademicSchedulePanel from './AcademicSchedulePanel';
import EventsPanel from './EventsPanel';
import AttachmentsPanel from './AttachmentsPanel';
import { type Access, Button, Notice, useResource } from './control-ui';

const sections = [
  { id: 'users', label: 'Пользователи' },
  { id: 'learning', label: 'Учебная среда' },
  { id: 'career', label: 'Карьера' },
  { id: 'platform', label: 'Платформа' },
] as const;
type SectionId = typeof sections[number]['id'];
const tabs: Array<{ id: string; label: string; permission: string; section: SectionId }> = [
  { id: 'services', label: 'Сервисы', permission: 'services.read', section: 'platform' },
  { id: 'user-hub', label: 'Каталог пользователей', permission: 'user-directory', section: 'users' },
  { id: 'accounts', label: 'Аккаунты', permission: 'accounts.read', section: 'users' },
  { id: 'student-data', label: 'Посещаемость и отсутствия', permission: 'student-data.read', section: 'users' },
  { id: 'attendance-qr', label: 'QR-сессии', permission: 'attendance-qr.read', section: 'users' },
  { id: 'personal-records', label: 'Личные записи', permission: 'personal-data.read', section: 'users' },
  { id: 'notifications-data', label: 'Уведомления и устройства', permission: 'notification-data.read', section: 'users' },
  { id: 'homework-submissions', label: 'Сдачи заданий', permission: 'homework-data.read', section: 'users' },
  { id: 'curator-assignments', label: 'Назначения кураторов', permission: 'curation-data.read', section: 'users' },
  { id: 'announcements', label: 'Объявления', permission: 'pairspace-content.read', section: 'learning' },
  { id: 'pair-spaces', label: 'Пространства пар', permission: 'pairspace-content.read', section: 'learning' },
  { id: 'academic-schedule', label: 'Расписание и каталог', permission: 'academic-data.read', section: 'learning' },
  { id: 'events', label: 'События', permission: 'events-data.read', section: 'learning' },
  { id: 'attachments', label: 'Вложения', permission: 'attachments-data.read', section: 'learning' },
  { id: 'discussions', label: 'Обсуждения', permission: 'discussion-data.read', section: 'learning' },
  { id: 'career-data', label: 'Профили и поступление', permission: 'career-data.read', section: 'career' },
  { id: 'career-companies', label: 'Компании и партнёрства', permission: 'career-data.read', section: 'career' },
  { id: 'career-tasks', label: 'Задачи и проекты', permission: 'career-data.read', section: 'career' },
  { id: 'career-operations', label: 'Отклики и работы', permission: 'career-data.read', section: 'career' },
  { id: 'career-memberships', label: 'Доступы компаний', permission: 'career-data.read', section: 'career' },
  { id: 'career-tests', label: 'Тесты и попытки', permission: 'career-data.read', section: 'career' },
  { id: 'career-content', label: 'Портфолио и отзывы', permission: 'career-data.read', section: 'career' },
  { id: 'career-planning', label: 'Доступность студентов', permission: 'career-data.read', section: 'career' },
  { id: 'universities', label: 'Университеты и структура', permission: 'universities.read', section: 'platform' },
  { id: 'permissions', label: 'Контур доверия', permission: 'owner', section: 'platform' },
  { id: 'settings', label: 'Настройки', permission: 'settings.read', section: 'platform' },
  { id: 'audit', label: 'Журнал аудита', permission: 'audit.read', section: 'platform' },
];
export default function PlatformControlPage() {
  const context = useResource<Access>('/platform/access', 30000);
  const [tab,setTab] = useState('services');
  const [requestedTab, setRequestedTab] = useState<string | null>(null);
  const access = context.data;
  const available = tabs.filter(item => item.permission === 'owner' ? access?.owner : item.permission === 'user-directory' ? access?.permissions.some(permission => ['accounts.read', 'personal-data.read'].includes(permission)) : access?.permissions.includes(item.permission));
  useEffect(() => { const query = new URLSearchParams(window.location.search).get('tab'); if (query) { setRequestedTab(query); if (tabs.some(item => item.id === query)) setTab(query); } }, []);
  useEffect(() => { const refresh = () => context.refresh(); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [context.refresh]);
  const active = available.find(item => item.id === tab)?.id || available[0]?.id;
  const activeSection = available.find(item => item.id === active)?.section;
  const visibleSections = sections.filter(item => available.some(tabItem => tabItem.section === item.id));
  const visibleTabs = available.filter(item => item.section === activeSection);
  useEffect(() => {
    if (!access || !active) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') !== active) {
      url.searchParams.set('tab', active);
      window.history.replaceState(null, '', url);
    }
  }, [access, active]);
  const select = (id: string) => { setTab(id); setRequestedTab(null); const url = new URL(window.location.href); url.searchParams.set('tab',id); window.history.replaceState(null,'',url); };
  const selectSection = (id: SectionId) => { const next = available.find(item => item.section === id); if (next) select(next.id); };
  const openUserSection = (id: string, userId: string) => { setTab(id); setRequestedTab(null); const url = new URL(window.location.href); url.searchParams.set('tab', id); url.searchParams.set('userId', userId); window.history.replaceState(null, '', url); };
  return <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-100 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Управление платформой</h1>{access && <p className="mt-2 text-sm text-slate-400">{access.owner ? 'Владелец · полный доступ' : 'Доступ по выданным разрешениям'}</p>}</div><Button onClick={context.refresh} disabled={context.loading}>Обновить доступ</Button></div>
    {context.error && <Notice error>{context.error}</Notice>}{!access && !context.error && <p role="status" className="text-sm text-slate-400">Проверяем доступ…</p>}
    {access && !access.ownerConfigured && <Notice error>Владелец ещё не назначен на этом сервере. Требуется первоначальная настройка через серверную команду; автоматической выдачи прав по email нет.</Notice>}
    {access?.ownerConfigured && !available.length && <Notice>Разрешения на управление пока не выданы. Их назначает владелец платформы.</Notice>}
    {access && active && requestedTab && requestedTab !== active && <Notice>Запрошенный раздел недоступен по текущим разрешениям. Открыт первый доступный раздел.</Notice>}
    {!!available.length && <div className="space-y-3">
      <nav aria-label="Категории управления" className="flex flex-wrap gap-2">{visibleSections.map(item => <Button key={item.id} aria-pressed={activeSection === item.id} className={activeSection === item.id ? '!border-cyan-400 !bg-cyan-400/15 !text-cyan-100' : ''} onClick={() => selectSection(item.id)}>{item.label}</Button>)}</nav>
      <nav aria-label={`Разделы: ${sections.find(item => item.id === activeSection)?.label ?? 'управление'}`} className="flex gap-2 overflow-x-auto pb-2">{visibleTabs.map(item => <Button key={item.id} aria-pressed={active === item.id} className={active === item.id ? '!border-cyan-400 !bg-cyan-400/15 !text-cyan-100 whitespace-nowrap' : 'whitespace-nowrap'} onClick={() => select(item.id)}>{item.label}</Button>)}</nav>
    </div>}
    {access && <>{active === 'services' && <ServicesPanel access={access} />}{active === 'user-hub' && <UserHubPanel access={access} onNavigate={openUserSection} />}{active === 'accounts' && <AccountsPanel access={access} />}{active === 'student-data' && <StudentDataPanel access={access} />}{active === 'attendance-qr' && <AttendanceQrSessionsPanel access={access} />}{active === 'personal-records' && <PersonalRecordsPanel access={access} />}{active === 'notifications-data' && <NotificationsDataPanel access={access} />}{active === 'homework-submissions' && <HomeworkSubmissionsPanel access={access} />}{active === 'curator-assignments' && <CuratorAssignmentsPanel access={access} />}{active === 'announcements' && <AnnouncementsPanel access={access} />}{active === 'pair-spaces' && <PairSpacesPanel access={access} />}{active === 'academic-schedule' && <AcademicSchedulePanel access={access} />}{active === 'events' && <EventsPanel access={access} />}{active === 'attachments' && <AttachmentsPanel access={access} />}{active === 'career-data' && <CareerDataPanel access={access} />}{active === 'career-companies' && <CareerCompaniesPanel access={access} />}{active === 'career-tasks' && <CareerTasksPanel access={access} />}{active === 'career-operations' && <CareerOperationsPanel access={access} />}{active === 'career-memberships' && <CareerMembershipsPanel access={access} />}{active === 'career-tests' && <CareerTestsPanel access={access} />}{active === 'career-content' && <CareerContentPanel access={access} />}{active === 'career-planning' && <CareerAvailabilityPanel access={access} />}{active === 'discussions' && <DiscussionsPanel access={access} />}{active === 'universities' && <UniversitiesPanel access={access} />}{active === 'permissions' && access.owner && <PermissionsPanel access={access} />}{active === 'settings' && <SettingsPanel access={access} />}{active === 'audit' && <AuditPanel access={access} />}</>}
  </div>;
}
