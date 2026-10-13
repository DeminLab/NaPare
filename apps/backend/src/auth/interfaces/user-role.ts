export enum UserRole {
  STUDENT = 'student',
  EMPLOYER = 'employer',
  CAREER_STAFF = 'career_staff',
  CAREER_ADMIN = 'career_admin',
  TEACHER = 'teacher',
  CURATOR = 'curator',
  FACULTY_DEAN = 'faculty_dean',
  DEPARTMENT_HEAD = 'department_head',
  UNIVERSITY_ADMIN = 'university_admin',
  SUPERADMIN = 'superadmin',
  DEVELOPER = 'developer',
}

export const USER_ROLES = Object.values(UserRole);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}
