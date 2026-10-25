import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CareerCompany, CareerMembership } from './career.entities';
import { CareerService } from './career.service';
import { CompanyRegistryService, validateCompanyInn } from './company-registry.service';

@Injectable()
export class CompanyVerificationService {
  constructor(private readonly db: DataSource, private readonly career: CareerService, private readonly registry: CompanyRegistryService) {}

  private async owned(manager: EntityManager, actor: AuthenticatedUser, id: string): Promise<CareerCompany> {
    // Company-first order matches ownership administration; do not invert this with membership writes.
    const company = await manager.findOne(CareerCompany, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!company) throw new NotFoundException('Компания не найдена');
    const member = await manager.getRepository(CareerMembership).createQueryBuilder('member')
      .where('member.companyId=:id AND member.userId=:actor AND member.role=:role AND member.revokedAt IS NULL', { id, actor: actor.id, role: 'company_owner' })
      .setLock('pessimistic_read').getOne();
    if (!member) throw new ForbiddenException('Нужны действующие права владельца компании');
    return company;
  }

  async recheck(actor: AuthenticatedUser, id: string, suppliedInn?: string): Promise<CareerCompany> {
    await this.career.assertCompanyOwnerAccess(actor, id);
    const claim = await this.db.transaction(async manager => {
      const company = await this.owned(manager, actor, id);
      const inn = suppliedInn === undefined ? company.inn : validateCompanyInn(suppliedInn);
      if (!inn) throw new BadRequestException('Укажите ИНН для первоначальной проверки компании');
      if (company.inn && inn !== company.inn) throw new ConflictException('ИНН компании уже закреплён. Для исправления обратитесь к оператору.');
      const [clock] = await manager.query('SELECT clock_timestamp() AS at');
      const at = new Date(clock.at);
      if (company.registryRequestedAt && at.getTime() - new Date(company.registryRequestedAt).getTime() < 60000) {
        throw new ConflictException('Повторная проверка доступна через минуту после предыдущей попытки.');
      }
      company.inn = validateCompanyInn(inn); company.registryStatus = 'checking'; company.registryRequestedAt = at;
      company.registryCheckVersion++;
      await manager.save(CareerCompany, company);
      return { inn: company.inn, version: company.registryCheckVersion };
    });
    // The external service never holds our transaction or row locks open.
    const result = await this.registry.lookup(claim.inn);
    return this.db.transaction(async manager => {
      const company = await this.owned(manager, actor, id);
      if (company.registryCheckVersion !== claim.version || company.inn !== claim.inn) throw new ConflictException('Результат заменён более новой проверкой. Обновите сведения.');
      company.registryStatus = result.status; company.registryCheckedAt = result.checkedAt;
      company.registryLegalName = result.legalName; company.registryOgrn = result.ogrn; company.registryReason = result.reason;
      return manager.save(CareerCompany, company);
    });
  }
}
