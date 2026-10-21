import type { PlatformPermission } from '../../platform/platform.dto';
import { TenantDatabaseGrant } from './tenant-database-access';

const academic = ['academic_courses', 'course_spaces', 'lesson_series', 'lesson_occurrences', 'lesson_spaces', 'academic_schedule_changes', 'academic_events'];
const career = ['career_membership', 'career_partnership', 'career_profile', 'career_admission', 'career_task', 'career_test', 'career_availability'];
const pairSpace = ['pair_spaces', 'personal_lesson_notes'];

/** Exact scalar-tenant tables needed by each permission and its relation joins. */
const readTables: Partial<Record<PlatformPermission, string[]>> = {
  'accounts.read': ['users', 'groups', 'curator_assignments'],
  'identity-links.read': ['users'],
  'universities.read': ['faculties', 'groups'],
  'student-data.read': ['absences', 'attendance_records', 'users', 'lessons'],
  'attendance-qr.read': ['attendance_qr_sessions', 'users', 'groups', 'lessons'],
  'personal-data.read': ['notification_preferences', 'user_favorites', 'personal_lesson_notes', 'users', 'groups', 'pair_spaces', 'lessons', 'curator_assignments'],
  'homework-data.read': ['pair_spaces', 'lessons', 'users'],
  'notification-data.read': ['notifications', 'inbox_items', 'users'],
  'curation-data.read': ['curator_assignments', 'groups', 'users'],
  'academic-data.read': [...academic, 'users', 'groups', 'faculties', 'lessons'],
  'career-data.read': [...career, 'users'],
  'discussion-data.read': ['pair_spaces', 'lessons', 'users'],
  'pairspace-content.read': [...pairSpace, ...academic, 'lessons', 'groups', 'users'],
  'events-data.read': ['event_records'],
  'attachments-data.read': ['pair_spaces', 'lessons', 'groups', 'users'],
};
const writeTables: Partial<Record<PlatformPermission, string[]>> = {
  'accounts.write': ['users'],
  'identity-links.write': ['users'],
  'universities.write': ['faculties', 'groups'],
  'student-data.write': ['absences', 'attendance_records'],
  'attendance-qr.revoke': ['attendance_qr_sessions'],
  'personal-data.write': ['notification_preferences', 'user_favorites', 'personal_lesson_notes'],
  'notification-data.write': ['notifications', 'inbox_items'],
  'curation-data.write': ['curator_assignments'],
  'academic-data.write': [...academic, 'lessons'],
  'career-data.write': career,
  'pairspace-content.write': ['pair_spaces'],
};

export const PLATFORM_TENANT_TABLES = [...new Set(Object.values(readTables).flat())];

export function platformDatabaseGrants(permission: PlatformPermission, universityIds: string[] | null): TenantDatabaseGrant[] {
  const domain = permission.slice(0, permission.lastIndexOf('.'));
  const readingPermission = `${domain}.read` as PlatformPermission;
  const reading = readTables[permission] ?? readTables[readingPermission] ?? [];
  const writing = writeTables[permission] ?? [];
  return [
    ...(reading.length ? [{ tables: reading, universityIds, replaceActor: true }] : []),
    ...(writing.length ? [{ tables: writing, universityIds, write: true, replaceActor: true }] : []),
  ];
}
