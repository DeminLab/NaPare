import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { UserRole } from '../auth/interfaces/user-role';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('AbsencesController authorization', () => {
  const controller = new AbsencesController({} as AbsencesService);

  it('limits student mutations to the student role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual([UserRole.STUDENT]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.update)).toEqual([UserRole.STUDENT]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.delete)).toEqual([UserRole.STUDENT]);
  });

  it('does not allow students to confirm or excuse absences', () => {
    for (const handler of [controller.confirm, controller.excuse]) {
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];
      expect(roles).not.toContain(UserRole.STUDENT);
      expect(roles).toContain(UserRole.CURATOR);
    }
  });
});
