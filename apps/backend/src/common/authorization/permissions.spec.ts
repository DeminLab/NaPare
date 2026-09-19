import { UserRole } from '../../auth/interfaces/user-role';
import { hasPermission, PERMISSIONS } from './permissions';

describe('academic permission matrix', () => {
  it('keeps technical developer scope separate from academic write access', () => {
    expect(hasPermission(UserRole.DEVELOPER, PERMISSIONS.TECHNICAL_RESOURCE_READ)).toBe(true);
    expect(hasPermission(UserRole.DEVELOPER, PERMISSIONS.ACADEMIC_COURSE_READ)).toBe(false);
    expect(hasPermission(UserRole.TEACHER, PERMISSIONS.ACADEMIC_SERIES_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.TEACHER, PERMISSIONS.ACADEMIC_COURSE_MANAGE)).toBe(false);
  });

  it('allows university operators to manage the academic catalog', () => {
    expect(hasPermission(UserRole.UNIVERSITY_ADMIN, PERMISSIONS.ACADEMIC_COURSE_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.FACULTY_DEAN, PERMISSIONS.ACADEMIC_EVENT_MANAGE)).toBe(true);
    expect(hasPermission(UserRole.CURATOR, PERMISSIONS.ACADEMIC_COURSE_MANAGE)).toBe(false);
  });
});
