import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ImportScheduleDto } from '../../admin/dto/import-schedule.dto';
import { UserRole } from '../../auth/interfaces/user-role';
import { ScheduleChange } from '../../academic/entities/schedule-change.entity';
import { TenantContext } from '../../common/tenant/tenant-context';
import { JsonObject } from '../../common/types/json-value.type';
import { PaginationQueryDto, toPaginatedResponse } from '../../common/dto/pagination-query.dto';
import { University } from '../../users/entities/university.entity';
import { Group } from '../../users/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { Lesson } from '../entities/lesson.entity';
import { CsvScheduleConnector, IcsScheduleConnector, MAX_IMPORT_ROWS, normalizeScheduleRow, textFile, XlsxScheduleConnector } from './file-schedule-connectors';
import { MoodleScheduleConnector, SibitScheduleConnector } from './external-schedule-connectors';
import { NormalizedScheduleLesson, ScheduleImportPayload, ScheduleImportQueue, ScheduleImportSummary } from './schedule-connector';
import { ScheduleImportJob } from './schedule-import-job.entity';

const TABLES = ['schedule_import_jobs', 'users', 'groups', 'lessons', 'academic_schedule_changes'];
const normalizeName = (name: string) => name.trim().toLocaleLowerCase('ru-RU');

@Injectable()
export class ScheduleImportService implements OnModuleInit, OnModuleDestroy, ScheduleImportQueue {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(ScheduleImportService.name);
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContext,
    @InjectRepository(ScheduleImportJob) private readonly jobs: Repository<ScheduleImportJob>,
    @InjectRepository(University) private readonly universities: Repository<University>,
    private readonly csv: CsvScheduleConnector,
    private readonly ics: IcsScheduleConnector,
    private readonly xlsx: XlsxScheduleConnector,
    private readonly sibit: SibitScheduleConnector,
    private readonly moodle: MoodleScheduleConnector,
  ) {}

  onModuleInit() {
    if (process.env.SCHEDULE_IMPORT_WORKER_ENABLED === 'false' || (process.env.NODE_ENV === 'test' && process.env.SCHEDULE_IMPORT_WORKER_ENABLED !== 'true')) return;
    this.timer = setInterval(() => {
      if (this.busy) return;
      this.busy = true;
      void this.processNext().catch(() => this.logger.error('Schedule import poll failed')).finally(() => { this.busy = false; });
    }, 2000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async submit(universityId: string, dto: ImportScheduleDto) {
    this.tenant.assertAccess(universityId);
    const actor = this.tenant.getUser();
    if (!actor || ![UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN].includes(actor.role) || !universityId) throw new ForbiddenException('Нужны права администратора вуза.');
    const university = await this.universities.findOneBy({ id: universityId });
    if (!university) throw new NotFoundException('Вуз не найден.');
    const payload = await this.prepare(university, dto);
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const idempotencyKey = dto.idempotencyKey || randomUUID();
    await this.jobs.createQueryBuilder().insert().values({ universityId, actorId: actor.id, idempotencyKey, payloadHash, payload, status: 'queued', nextAttemptAt: new Date() }).orIgnore().execute();
    let job = await this.jobs.findOneByOrFail({ universityId, idempotencyKey });
    if (job.payloadHash !== payloadHash) throw new ConflictException('Этот idempotencyKey уже использован для другого содержимого.');
    if (!dto.queued && job.status === 'queued') {
      await this.processJob(job.id);
      job = await this.jobs.findOneByOrFail({ id: job.id, universityId });
    }
    if (!dto.queued && job.status === 'failed') throw new BadRequestException(job.lastError || 'Импорт отклонён.');
    return job.status === 'completed' ? { ...job.result!, jobId: job.id, status: job.status } : this.jobView(job);
  }

  async getJob(universityId: string, id: string) {
    this.tenant.assertAccess(universityId);
    const job = await this.jobs.findOneBy({ id, universityId });
    if (!job) throw new NotFoundException('Задание импорта не найдено.');
    return this.jobView(job);
  }

  async getChanges(universityId: string, id: string, pagination: PaginationQueryDto) {
    await this.getJob(universityId, id);
    const [data, total] = await this.db.getRepository(ScheduleChange).createQueryBuilder('change')
      .where('change.universityId = :universityId', { universityId }).andWhere("change.newValue->>'importJobId' = :id", { id })
      .orderBy('change.timestamp', 'DESC').addOrderBy('change.id', 'ASC').skip((pagination.page - 1) * pagination.limit).take(pagination.limit).getManyAndCount();
    return toPaginatedResponse(data, total, pagination);
  }

  private jobView(job: ScheduleImportJob) {
    return { jobId: job.id, status: job.status, attempts: job.attempts, result: job.result, lastError: job.lastError, createdAt: job.createdAt, updatedAt: job.updatedAt };
  }

  private async prepare(university: University, dto: ImportScheduleDto): Promise<ScheduleImportPayload> {
    if (!dto.fileName?.trim() || dto.fileName.length > 100 || (dto.rows && dto.content !== undefined) || ((dto.rows || dto.content !== undefined) && ['sibit', 'moodle'].includes(dto.format))) throw new BadRequestException('Передайте один источник: rows, content или настроенный внешний коннектор.');
    let lessons: NormalizedScheduleLesson[];
    if (dto.rows) {
      if (!['csv', 'json'].includes(dto.format)) throw new BadRequestException('rows поддерживает только legacy csv/json.');
      lessons = dto.rows.map((row, index) => normalizeScheduleRow(row as unknown as Record<string, unknown>, dto.utcOffset || '+00:00', `${dto.fileName}:${index + 1}`));
    } else if (dto.format === 'json') {
      let rows: unknown;
      try { rows = JSON.parse(textFile(dto.content)); } catch { throw new BadRequestException('Некорректный JSON.'); }
      if (!Array.isArray(rows)) throw new BadRequestException('JSON должен содержать массив занятий.');
      lessons = rows.map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['id', 'date', 'startTime', 'endTime', 'pairNumber', 'subject', 'group', 'teacher', 'room', 'status'].includes(key))) throw new BadRequestException('JSON содержит неподдерживаемые поля.');
        return normalizeScheduleRow(row, dto.utcOffset || '+00:00');
      });
    } else {
      const connector = ({ csv: this.csv, ics: this.ics, xlsx: this.xlsx, sibit: this.sibit, moodle: this.moodle })[dto.format];
      if (!connector) throw new BadRequestException('Неподдерживаемый формат.');
      lessons = await connector.fetchSchedule(university, dto);
    }
    if (lessons.length > MAX_IMPORT_ROWS || (!lessons.length && !dto.replace) || new Set(lessons.map(lesson => lesson.externalId)).size !== lessons.length) throw new BadRequestException('Нужно 1–1000 занятий без повторных ID; пустой снимок разрешён только с replace.');
    const groupNames = [...new Set((dto.groupNames || lessons.map(lesson => lesson.groupName)).map(name => name.trim()))];
    const sourceKey = (dto.sourceKey || dto.fileName).trim();
    if (!sourceKey || sourceKey.length > 100 || groupNames.some(name => !name || name.length > 200)) throw new BadRequestException('Некорректное имя источника или группы.');
    const from = dto.startDate?.slice(0, 10), to = dto.endDate?.slice(0, 10);
    if ((from && !to) || (!from && to) || (from && to && (to < from || new Date(to).getTime() - new Date(from).getTime() > 366 * 86400000))) throw new BadRequestException('Нужен согласованный диапазон не больше 366 дней.');
    if (dto.replace && (!dto.sourceKey || !dto.startDate || !dto.endDate || !dto.groupNames?.length)) throw new BadRequestException('replace требует sourceKey, startDate/endDate и явный список groupNames.');
    if (lessons.some(lesson => (from && lesson.startDate.slice(0, 10) < from) || (to && lesson.startDate.slice(0, 10) > to) || !groupNames.some(name => normalizeName(name) === normalizeName(lesson.groupName)))) throw new BadRequestException('Занятие находится вне явно указанного диапазона или групп.');
    return { lessons, source: `university-import:${sourceKey}`, fileName: dto.fileName, replace: !!dto.replace, groupNames, startDate: from, endDate: to };
  }

  processNext(): Promise<boolean> { return this.process(); }
  processJob(id: string): Promise<boolean> { return this.process(id); }

  private async process(id?: string): Promise<boolean> {
    let claimed: { id: string; universityId: string } | undefined;
    return this.databaseAccess(['schedule_import_jobs'], null, true, async () => {
      try {
        return await this.db.transaction(async manager => {
          const query = manager.getRepository(ScheduleImportJob).createQueryBuilder('job').where('job.status = :status', { status: 'queued' }).setLock('pessimistic_write').setOnLocked('skip_locked').orderBy('job.createdAt', 'ASC');
          if (id) query.andWhere('job.id = :id', { id });
          else query.andWhere('job.nextAttemptAt <= :now', { now: new Date() });
          const job = await query.getOne();
          if (!job) return false;
          claimed = { id: job.id, universityId: job.universityId };
          if (!job.payload) throw new BadRequestException('Нет содержимого задания.');
          const result = await this.databaseAccess(TABLES, [job.universityId], true, () => this.apply(manager, job));
          job.status = 'completed'; job.result = result; job.payload = null; job.attempts++; job.lastError = null;
          await manager.getRepository(ScheduleImportJob).save(job);
          return true;
        });
      } catch (error) {
        if (!claimed) throw error;
        const terminal = error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException;
        await this.jobs.createQueryBuilder().update().set({
          attempts: () => 'attempts + 1',
          status: () => terminal ? "'failed'" : "CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'queued' END",
          nextAttemptAt: new Date(Date.now() + 30000), lastError: terminal ? error.message.slice(0, 500) : 'Временная ошибка импорта. Повторная попытка будет выполнена автоматически.',
        }).where('id = :id AND "universityId" = :universityId AND status = :status', { ...claimed, status: 'queued' }).execute();
        return true;
      }
    });
  }

  /** Adapts to the explicit trusted-capability API introduced by the independent RLS block. */
  private databaseAccess<T>(tables: string[], universityIds: string[] | null, write: boolean, callback: () => Promise<T>): Promise<T> {
    const context = this.tenant as TenantContext & { runWithDatabaseAccess?: (scope: { tables: string[]; universityIds: string[] | null; write: boolean }, callback: () => Promise<T>) => Promise<T> };
    return context.runWithDatabaseAccess ? context.runWithDatabaseAccess({ tables, universityIds, write }, callback) : callback();
  }

  private async apply(manager: EntityManager, job: ScheduleImportJob): Promise<ScheduleImportSummary> {
    const payload = job.payload!;
    const actor = await manager.getRepository(User).findOneBy({ id: job.actorId, universityId: job.universityId, isActive: true });
    if (!actor || ![UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN].includes(actor.role)) throw new ForbiddenException('Автор задания больше не имеет права импортировать расписание этого вуза.');
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`schedule-import:${job.universityId}:${payload.source}`]);
    const groups = await manager.getRepository(Group).find({ where: { universityId: job.universityId } });
    const byName = new Map(groups.map(group => [normalizeName(group.name), group]));
    const bySource = new Map(groups.filter(group => group.externalId).map(group => [group.externalId!, group]));
    for (const name of payload.groupNames) if (!byName.has(normalizeName(name))) throw new BadRequestException(`Не найдена группа ВУЗа: ${name}. Сначала добавьте её в структуру ВУЗа.`);
    const resolved = payload.lessons.map(lesson => ({ lesson, group: (lesson.groupExternalId ? bySource.get(lesson.groupExternalId) : undefined) || byName.get(normalizeName(lesson.groupName)) }));
    if (resolved.some(item => !item.group)) throw new BadRequestException('Не все группы источника сопоставлены с группами этого вуза.');
    const repository = manager.getRepository(Lesson);
    const existing = await repository.find({ where: { universityId: job.universityId, source: payload.source }, withDeleted: true });
    const legacy = payload.lessons.some(lesson => lesson.externalId.startsWith(payload.fileName + ':')) ? await repository.find({ where: { universityId: job.universityId, source: 'university-import' }, withDeleted: true }) : [];
    const current = new Map(existing.map(lesson => [lesson.externalId, lesson]));
    for (const lesson of legacy) if (payload.lessons.some(row => row.externalId === lesson.externalId) && !current.has(lesson.externalId)) current.set(lesson.externalId, lesson);
    const result: ScheduleImportSummary = { imported: 0, updated: 0, deleted: 0, unchanged: 0 };
    const seen = new Set<string>();
    for (const { lesson: input, group } of resolved) {
      seen.add(input.externalId);
      const old = current.get(input.externalId);
      if (input.cancelled) {
        if (old && !old.deletedAt) { await this.cancel(manager, job, old); result.deleted++; }
        else result.unchanged++;
        continue;
      }
      const values = {
        universityId: job.universityId, groupId: group!.id, groupName: group!.name, subject: input.subject,
        startDate: new Date(input.startDate), endDate: new Date(input.endDate), startTime: input.startTime, endTime: input.endTime,
        dayOfWeek: new Date(input.startDate).getUTCDay(), pairNumber: input.pairNumber, weekType: 'both',
        teacherName: input.teacherName || null, room: input.room || null, sourceTeacherId: input.sourceTeacherId || null,
        source: payload.source, externalId: input.externalId, syncStatus: 'synced', sourceVersion: job.payloadHash, deletedAt: null,
      };
      const before = old ? this.snapshot(old) : {};
      const after = this.snapshot({ ...old, ...values } as Lesson);
      if (old && JSON.stringify(before) === JSON.stringify(after)) { result.unchanged++; continue; }
      const saved = await repository.save(repository.create({ ...old, ...values, lastSyncedAt: new Date(), isChanged: !!old, changeDescription: old ? 'Изменение при импорте расписания' : undefined }));
      await this.record(manager, job, saved.id, old ? 'updated' : 'added', before, after);
      result[old ? 'updated' : 'imported']++;
    }
    if (payload.replace) {
      const groupIds = new Set(payload.groupNames.map(name => byName.get(normalizeName(name))!.id));
      for (const old of existing) if (!old.deletedAt && !seen.has(old.externalId) && groupIds.has(old.groupId) && new Date(old.startDate).toISOString().slice(0, 10) >= payload.startDate! && new Date(old.startDate).toISOString().slice(0, 10) <= payload.endDate!) { await this.cancel(manager, job, old); result.deleted++; }
    }
    return result;
  }

  private snapshot(lesson: Lesson): JsonObject {
    return {
      groupId: lesson.groupId, groupName: lesson.groupName, subject: lesson.subject,
      startDate: new Date(lesson.startDate).toISOString(), endDate: new Date(lesson.endDate).toISOString(),
      startTime: lesson.startTime, endTime: lesson.endTime, pairNumber: lesson.pairNumber,
      teacherName: lesson.teacherName || null, room: lesson.room || null, sourceTeacherId: lesson.sourceTeacherId || null,
      source: lesson.source, externalId: lesson.externalId, deletedAt: lesson.deletedAt ? new Date(lesson.deletedAt).toISOString() : null,
    };
  }

  private async cancel(manager: EntityManager, job: ScheduleImportJob, lesson: Lesson) {
    const before = this.snapshot(lesson);
    lesson.deletedAt = new Date(); lesson.isChanged = true; lesson.changeDescription = 'Отменено источником расписания';
    await manager.getRepository(Lesson).save(lesson);
    await this.record(manager, job, lesson.id, 'deleted', before, this.snapshot(lesson));
  }

  private async record(manager: EntityManager, job: ScheduleImportJob, lessonId: string, changeType: string, originalValue: JsonObject, newValue: JsonObject) {
    await manager.getRepository(ScheduleChange).save({ universityId: job.universityId, legacyLessonId: lessonId, occurrenceId: null, actorId: job.actorId, source: job.payload!.source, timestamp: new Date(), reason: `Импорт: ${changeType}`, originalValue, newValue: { ...newValue, changeType, importJobId: job.id } });
  }
}
