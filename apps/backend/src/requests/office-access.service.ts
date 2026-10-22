import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { requireUniversityId } from '../common/tenant/require-university';
import { Group } from '../users/entities/group.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { User } from '../users/entities/user.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { OfficeAssignment, OfficeDuty, RequestStep, RequestType, StepDuty, StudentRequest } from './request.entities';

export const OFFICE_STAFF_ROLES = [UserRole.TEACHER, UserRole.CURATOR, UserRole.FACULTY_DEAN, UserRole.DEPARTMENT_HEAD, UserRole.UNIVERSITY_ADMIN];
export const routeDuties = (type: RequestType): StepDuty[] => type === 'absence' ? ['office', 'curator_or_dean'] : ['office', 'methodologist', 'dean'];

@Injectable()
export class OfficeAccessService {
  constructor(private readonly tenant: TenantContext) {}
  actor() {
    const actor = this.tenant.getUser();
    if (!actor) throw new ForbiddenException('Требуется вход.');
    requireUniversityId(actor);
    return { ...actor, universityId: requireUniversityId(actor) };
  }
  admin() {
    const actor = this.actor();
    if (actor.role !== UserRole.UNIVERSITY_ADMIN) throw new ForbiddenException('Настройки доступны администратору своего вуза.');
    return actor;
  }
  async group(manager: EntityManager, id: string) {
    const group = await manager.findOneBy(Group, { id, universityId: this.actor().universityId });
    if (!group) throw new NotFoundException('Группа недоступна.');
    return group;
  }
  async staff(manager: EntityManager, id: string) {
    const user = await manager.findOneBy(User, { id, universityId: this.actor().universityId, isActive: true });
    if (!user || !OFFICE_STAFF_ROLES.includes(user.role)) throw new BadRequestException('Нужен действующий сотрудник своего вуза.');
    return user;
  }
  async assignments(manager: EntityManager, userId = this.actor().id) {
    return manager.find(OfficeAssignment, { where: { universityId: this.actor().universityId, userId, revokedAt: IsNull() } });
  }
  covers(assignment: OfficeAssignment, group: Group) {
    return assignment.groupIds.includes(group.id) || assignment.facultyIds.includes(group.facultyId);
  }
  async hasDuty(manager: EntityManager, group: Group, duty: OfficeDuty, userId = this.actor().id, create = false) {
    const user = await manager.findOneBy(User, { id: userId, universityId: group.universityId, isActive: true });
    if (!user || !OFFICE_STAFF_ROLES.includes(user.role)) return false;
    return (await this.assignments(manager, userId)).some(row => row.duty === duty && this.covers(row, group) && (!create || row.canCreateForStudents));
  }
  async canPerform(manager: EntityManager, group: Group, duty: StepDuty, userId: string) {
    const user = await manager.findOneBy(User, { id: userId, universityId: group.universityId, isActive: true });
    if (!user || ![...OFFICE_STAFF_ROLES, UserRole.STUDENT].includes(user.role)) return false;
    if (duty === 'office' || duty === 'methodologist') return this.hasDuty(manager, group, duty, userId);
    const faculty = await manager.findOneBy(Faculty, { id: group.facultyId, universityId: group.universityId });
    const dean = user.role === UserRole.FACULTY_DEAN && faculty?.deanUserId === userId;
    if (duty === 'dean' || dean) return dean;
    return !!await manager.findOneBy(CuratorAssignment, { universityId: group.universityId, groupId: group.id, userId, revokedAt: IsNull() });
  }
  async scope(manager: EntityManager) {
    const actor = this.actor();
    const [groups, assignments, curatorAssignments, faculties] = await Promise.all([
      manager.find(Group, { where: { universityId: actor.universityId }, order: { name: 'ASC' } }),
      this.assignments(manager),
      manager.findBy(CuratorAssignment, { universityId: actor.universityId, userId: actor.id, revokedAt: IsNull() }),
      manager.findBy(Faculty, { universityId: actor.universityId, deanUserId: actor.id }),
    ]);
    const staff = OFFICE_STAFF_ROLES.includes(actor.role);
    const office = groups.filter(group => staff && assignments.some(row => row.duty === 'office' && this.covers(row, group))).map(group => group.id);
    const methodologist = groups.filter(group => staff && assignments.some(row => row.duty === 'methodologist' && this.covers(row, group))).map(group => group.id);
    const dean = groups.filter(group => actor.role === UserRole.FACULTY_DEAN && faculties.some(faculty => faculty.id === group.facultyId)).map(group => group.id);
    const curator = [...new Set([...dean, ...curatorAssignments.filter(() => staff || actor.role === UserRole.STUDENT).map(row => row.groupId)])];
    const dispatcher = groups.filter(group => staff && assignments.some(row => row.duty === 'dispatcher' && this.covers(row, group))).map(group => group.id);
    return { groups, assignments, office, methodologist, dean, curator_or_dean: curator, dispatcher };
  }
  async assertRead(manager: EntityManager, request: StudentRequest) {
    const actor = this.actor();
    if (request.universityId !== actor.universityId) throw new NotFoundException('Заявление недоступно.');
    if (request.studentId === actor.id || request.createdBy === actor.id) {
      if (actor.role === UserRole.STUDENT && request.studentId === actor.id) return;
      const group = await this.group(manager, request.groupId);
      if (await this.hasDuty(manager, group, 'office')) return;
    }
    if (request.status === 'draft') throw new ForbiddenException('Черновик доступен автору.');
    if (actor.role === UserRole.UNIVERSITY_ADMIN) return;
    const group = await this.group(manager, request.groupId);
    if (await this.hasDuty(manager, group, 'office')) return;
    const steps = await manager.findBy(RequestStep, { requestId: request.id, universityId: actor.universityId, assigneeId: actor.id });
    for (const step of steps) if (await this.canPerform(manager, group, step.duty, actor.id)) return;
    throw new ForbiddenException('Нет действующего назначения для этого заявления.');
  }
  async defaultAssignees(manager: EntityManager, group: Group, type: RequestType, studentId: string) {
    const assignments = await manager.find(OfficeAssignment, { where: { universityId: group.universityId, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
    const faculty = await manager.findOneBy(Faculty, { id: group.facultyId, universityId: group.universityId });
    const curators = await manager.find(CuratorAssignment, { where: { universityId: group.universityId, groupId: group.id, revokedAt: IsNull() }, order: { createdAt: 'ASC', id: 'ASC' } });
    const result: string[] = [];
    for (const duty of routeDuties(type)) {
      const candidates = duty === 'office' || duty === 'methodologist'
        ? assignments.filter(row => row.duty === duty && this.covers(row, group)).map(row => row.userId)
        : duty === 'curator_or_dean' ? [...curators.map(row => row.userId), ...(faculty?.deanUserId ? [faculty.deanUserId] : [])] : faculty?.deanUserId ? [faculty.deanUserId] : [];
      let selected: string | undefined;
      for (const candidate of candidates) if (candidate !== studentId && await this.canPerform(manager, group, duty, candidate)) { selected = candidate; break; }
      if (!selected) throw new BadRequestException(`Не назначен согласующий этапа «${duty}». Администратору нужно настроить назначения и декана факультета.`);
      result.push(selected);
    }
    return result;
  }
  async validateRoute(manager: EntityManager, group: Group, type: RequestType, assignees: string[], studentId?: string) {
    const duties = routeDuties(type);
    if (duties.length !== assignees.length) throw new BadRequestException('Не все стадии маршрута настроены.');
    for (let index = 0; index < duties.length; index++) {
      if (assignees[index] === studentId || !await this.canPerform(manager, group, duties[index], assignees[index])) throw new BadRequestException(`Согласующий этапа ${index + 1} недоступен или совпадает с заявителем.`);
    }
  }
}
