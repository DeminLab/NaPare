export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  CURATOR: 'curator',
  FACULTY_DEAN: 'faculty_dean',
  DEPARTMENT_HEAD: 'department_head',
  UNIVERSITY_ADMIN: 'university_admin',
  SUPERADMIN: 'superadmin',
  DEVELOPER: 'developer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.DEVELOPER]: 0,
  [ROLES.STUDENT]: 1,
  [ROLES.TEACHER]: 2,
  [ROLES.CURATOR]: 3,
  [ROLES.DEPARTMENT_HEAD]: 4,
  [ROLES.FACULTY_DEAN]: 5,
  [ROLES.UNIVERSITY_ADMIN]: 6,
  [ROLES.SUPERADMIN]: 7,
};

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.STUDENT]: 'Студент',
  [ROLES.TEACHER]: 'Преподаватель',
  [ROLES.CURATOR]: 'Куратор',
  [ROLES.FACULTY_DEAN]: 'Декан факультета',
  [ROLES.DEPARTMENT_HEAD]: 'Заведующий кафедрой',
  [ROLES.UNIVERSITY_ADMIN]: 'Администратор университета',
  [ROLES.SUPERADMIN]: 'Суперадминистратор',
  [ROLES.DEVELOPER]: 'Разработчик',
};

export const STUDENT_ROLES: Role[] = [ROLES.STUDENT];
export const STAFF_ROLES: Role[] = [ROLES.TEACHER, ROLES.CURATOR, ROLES.FACULTY_DEAN, ROLES.DEPARTMENT_HEAD];
export const ADMIN_ROLES: Role[] = [ROLES.UNIVERSITY_ADMIN, ROLES.SUPERADMIN];
export const ALL_ROLES: Role[] = Object.values(ROLES);
