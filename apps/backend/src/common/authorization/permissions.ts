import { UserRole } from '../../auth/interfaces/user-role';

export const PERMISSIONS = {
  ACADEMIC_COURSE_READ: 'academic.course.read',
  ACADEMIC_COURSE_MANAGE: 'academic.course.manage',
  ACADEMIC_SERIES_READ: 'academic.series.read',
  ACADEMIC_SERIES_MANAGE: 'academic.series.manage',
  ACADEMIC_OCCURRENCE_READ: 'academic.occurrence.read',
  ACADEMIC_OCCURRENCE_MANAGE: 'academic.occurrence.manage',
  ACADEMIC_EVENT_READ: 'academic.event.read',
  ACADEMIC_EVENT_MANAGE: 'academic.event.manage',
  TECHNICAL_RESOURCE_READ: 'technical.resource.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const allAcademicRead: Permission[] = [
  PERMISSIONS.ACADEMIC_COURSE_READ,
  PERMISSIONS.ACADEMIC_SERIES_READ,
  PERMISSIONS.ACADEMIC_OCCURRENCE_READ,
  PERMISSIONS.ACADEMIC_EVENT_READ,
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: allAcademicRead,
  [UserRole.TEACHER]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
  ],
  [UserRole.CURATOR]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
  ],
  [UserRole.DEPARTMENT_HEAD]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_COURSE_MANAGE,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
    PERMISSIONS.ACADEMIC_EVENT_MANAGE,
  ],
  [UserRole.FACULTY_DEAN]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_COURSE_MANAGE,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
    PERMISSIONS.ACADEMIC_EVENT_MANAGE,
  ],
  [UserRole.UNIVERSITY_ADMIN]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_COURSE_MANAGE,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
    PERMISSIONS.ACADEMIC_EVENT_MANAGE,
  ],
  [UserRole.SUPERADMIN]: Object.values(PERMISSIONS),
  [UserRole.DEVELOPER]: [PERMISSIONS.TECHNICAL_RESOURCE_READ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
