import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
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
import { CsvScheduleConnector, IcsScheduleConnector, MAX_IMPORT_ROWS, normalizeScheduleRow, offsetMinutes, textFile, XlsxScheduleConnector } from './file-schedule-connectors';
import { MoodleScheduleConnector, SibitScheduleConnector } from './external-schedule-connectors';
import { ImportRun } from './import-run.entity';
import {
  buildImportReportCsv,
  confirmationWarnings,
  journalCreatedRow,
  journalMatchesSnapshot,
  massChangeDecision,
  restoreFromJournal,
  rollbackConflict,
} from './import-run.helpers';
import {
  ImportRollbackConflict,
  ImportRollbackResult,
  NormalizedScheduleLesson,
  SCHEDULE_MAPPING_VERSION,
  ScheduleImportPayload,
  ScheduleImportPlan,
  ScheduleImportQueue,
  ScheduleImportRowIssue,
  ScheduleImportRowResult,
  ScheduleImportSummary,
} from './schedule-connector';
import { ScheduleImportJob } from './schedule-import-job.entity';

const TABLES = ['schedule_import_jobs', 'import_runs', 'users', 'groups', 'lessons', 'academic_schedule_changes'];
const ROLLBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const normalizeName = (name: string) => name.trim().toLocaleLowerCase('ru-RU');

/** One planned mutation of a source row; `apply` executes exactly this list. */
function importedOverlapWarnings(rows: Array<{ lesson: NormalizedScheduleLesson; groupId: string }>): ScheduleImportRowIssue[] {
  const latestEnds = new Map<string, { end: number; lesson: NormalizedScheduleLesson }>();
  const warnings: ScheduleImportRowIssue[] = [];
  const active = rows.filter(({ lesson }) => !lesson.cancelled)
    .sort((a, b) => Date.parse(a.lesson.startDate) - Date.parse(b.lesson.startDate));

  for (const { lesson, groupId } of active) {
    const start = Date.parse(lesson.startDate);
    const end = Date.parse(lesson.endDate);
    const teacher = lesson.sourceTeacherId || normalizeName(lesson.teacherName || '');
    const room = normalizeName(lesson.room || '');
    const resources = [['группа', groupId], ['преподаватель', teacher], ['аудитория', room]];
    for (const [label, identifier] of resources) {
      if (!identifier) continue;
      const key = `${label}:${identifier}`;
      const prior = latestEnds.get(key);
      if (prior && prior.end > start) {
        const other = prior.lesson.row ? `строка ${prior.lesson.row}` : `занятие ${prior.lesson.externalId}`;
        warnings.push({ row: lesson.row ?? 0, externalId: lesson.externalId, message: `Возможное пересечение: ${label}, ${other}.` });
      }
      if (!prior || end > prior.end) latestEnds.set(key, { end, lesson });
    }
  }

  return warnings;
}

type ImportOp =
  | { kind: 'upsert'; input: NormalizedScheduleLesson; group: Group; old?: Lesson; before: JsonObject; after: JsonObject }
  | { kind: 'cancel'; lesson: Lesson };

/** Column set shared by the dry-run diff and the persisted write (FR-IMP-04). */
function lessonValues(organizationId: string, input: NormalizedScheduleLesson, group: Group, payload: ScheduleImportPayload, sourceVersion: string): Partial<Lesson> {
  return {
    organizationId, groupId: group.id, groupName: group.name, subject: input.subject,
    startDate: new Date(input.startDate), endDate: new Date(input.endDate), startTime: input.startTime, endTime: input.endTime,
    dayOfWeek: new Date(input.localDate + 'T00:00:00Z').getUTCDay(), pairNumber: input.pairNumber, weekType: 'both',
    teacherName: input.teacherName || '', room: input.room || '', sourceTeacherId: input.sourceTeacherId || null,
    source: payload.source, externalId: input.externalId, syncStatus: 'synced', sourceVersion, deletedAt: null,
  };
}

/** Source-local day of an existing lesson, as the replace scan sees it. */
function localDay(lesson: Lesson, payload: ScheduleImportPayload): string {
  return payload.groupScopedIdentity
    ? `${lesson.startDate.getFullYear()}-${String(lesson.startDate.getMonth() + 1).padStart(2, '0')}-${String(lesson.startDate.getDate()).padStart(2, '0')}`
    : new Date(new Date(lesson.startDate).getTime() + offsetMinutes(payload.utcOffset) * 60000).toISOString().slice(0, 10);
}

@Injectable()
export class ScheduleImportService implements OnModuleInit, OnModuleDestroy, ScheduleImportQueue {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(ScheduleImportService.name);
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContext,
    @InjectRepository(ScheduleImportJob) private readonly jobs: Repository<ScheduleImportJob>,
    @InjectRepository(ImportRun) private readonly runs: Repository<ImportRun>,
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

  async submit(organizationId: string, dto: ImportScheduleDto) {
    this.tenant.assertAccess(organizationId);
    const actor = this.tenant.getUser();
    if (!actor || ![UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(actor.role) || !organizationId) throw new ForbiddenException('Нужны права администратора вуза.');
    const university = await this.universities.findOneBy({ id: organizationId });
    if (!university) throw new NotFoundException('Вуз не найден.');
    // FR-IMP-04: a server dry-run answers with the plan only and never queues a job.
    const payload = await this.prepare(university, dto, dto.dryRun ? 'diagnostic' : 'apply');
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const fileHash = dto.rows
      ? createHash('sha256').update(JSON.stringify(dto.rows)).digest('hex')
      : dto.content !== undefined
        ? (dto.format === 'xlsx' ? createHash('sha256').update(Buffer.from(dto.content, 'base64')).digest('hex') : createHash('sha256').update(dto.content, 'utf8').digest('hex'))
        : null;
    if (dto.dryRun) {
      const { plan } = await this.plan(this.db.manager, organizationId, payload);
      const run = await this.runs.save(this.runs.create({
        organizationId, actorId: actor.id, jobId: null, mode: 'dry-run', status: 'completed',
        fileHash, fileRef: null, mappingVersion: SCHEDULE_MAPPING_VERSION, payloadHash,
        source: payload.source, fileName: payload.fileName, result: plan, completedAt: new Date(),
      }));
      return { runId: run.id, dryRun: true as const, ...plan };
    }
    const idempotencyKey = dto.idempotencyKey || randomUUID();
    const prior = await this.jobs.findOneBy({ organizationId, idempotencyKey });
    if (prior && prior.payloadHash !== payloadHash) throw new ConflictException('Этот idempotencyKey уже использован для другого содержимого.');
    // FR-IMP-08: the confirmation gate runs before anything durable is written.
    if (!prior && !dto.confirmMassChange) {
      const { plan } = await this.plan(this.db.manager, organizationId, payload);
      if (plan.requiresConfirmation) throw new ConflictException({ message: 'Импорт требует явного подтверждения массового изменения расписания.', code: 'IMPORT_NEEDS_CONFIRMATION' });
    }
    await this.jobs.createQueryBuilder().insert().values({ organizationId, actorId: actor.id, idempotencyKey, payloadHash, payload, status: 'queued', nextAttemptAt: new Date() }).orIgnore().execute();
    let job = await this.jobs.findOneByOrFail({ organizationId, idempotencyKey });
    if (job.payloadHash !== payloadHash) throw new ConflictException('Этот idempotencyKey уже использован для другого содержимого.');
    await this.runs.createQueryBuilder().insert().orIgnore().values({
      organizationId, actorId: actor.id, jobId: job.id, mode: 'apply',
      status: job.status === 'queued' ? 'queued' : 'completed', fileHash, fileRef: null,
      mappingVersion: SCHEDULE_MAPPING_VERSION, payloadHash, source: payload.source, fileName: payload.fileName,
      completedAt: job.status === 'queued' ? null : new Date(),
    }).execute();
    if (!dto.queued && job.status === 'queued') {
      await this.processJob(job.id);
      job = await this.jobs.findOneByOrFail({ id: job.id, organizationId });
    }
    if (!dto.queued && job.status === 'failed') throw new BadRequestException(job.lastError || 'Импорт отклонён.');
    const run = await this.runs.findOneBy({ jobId: job.id });
    const runId = run?.id ?? null;
    return job.status === 'completed' ? { ...job.result!, jobId: job.id, status: job.status, runId } : { ...this.jobView(job), runId };
  }

  /** FR-IMP-04: one stored import attempt (dry-run or apply) with its per-row result. */
  async getRun(organizationId: string, id: string) {
    this.tenant.assertAccess(organizationId);
    const run = await this.runs.findOneBy({ id, organizationId });
    if (!run) throw new NotFoundException('Запись импорта не найдена.');
    return {
      runId: run.id, jobId: run.jobId, mode: run.mode, dryRun: run.mode === 'dry-run', status: run.status,
      source: run.source, fileName: run.fileName, fileHash: run.fileHash, fileRef: run.fileRef,
      mappingVersion: run.mappingVersion, result: run.result, lastError: run.lastError,
      rolledBackAt: run.rolledBackAt, rollbackResult: run.rollbackResult,
      createdAt: run.createdAt, completedAt: run.completedAt,
    };
  }

  /** FR-IMP-04: downloadable CSV report of one run (BOM + CRLF for Excel). */
  async getReport(organizationId: string, id: string): Promise<{ fileName: string; csv: string }> {
    const run = await this.getRun(organizationId, id);
    if (!run.result) throw new BadRequestException('Для этой записи импорта нет отчёта.');
    return { fileName: `import-run-${run.runId}.csv`, csv: buildImportReportCsv(run.result) };
  }

  /**
   * FR-IMP-05: compensating rollback of one applied run inside the 30-day
   * window. A lesson is restored only while the journal still matches the
   * current snapshot, so data changed after the import is never overwritten.
   */
  async rollback(organizationId: string, id: string): Promise<ImportRollbackResult> {
    this.tenant.assertAccess(organizationId);
    const actor = this.tenant.getUser();
    if (!actor || ![UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(actor.role)) throw new ForbiddenException('Нужны права администратора вуза.');
    const run = await this.runs.findOneBy({ id, organizationId });
    if (!run) throw new NotFoundException('Запись импорта не найдена.');
    if (run.mode !== 'apply' || !run.jobId) throw new BadRequestException('Откат доступен только для применённого импорта.');
    if (run.status !== 'completed') throw new BadRequestException('Откат доступен только для завершённого импорта.');
    if (run.rolledBackAt) throw new BadRequestException('Этот импорт уже откачен.');
    const completedAt = run.completedAt ?? run.updatedAt;
    if (Date.now() - completedAt.getTime() > ROLLBACK_WINDOW_MS) throw new BadRequestException('Срок отката импорта (30 дней) истёк.');
    const jobId = run.jobId;
    return this.databaseAccess(TABLES, [organizationId], true, () => this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`schedule-import:${organizationId}:${run.source}`]);
      const locked = await manager.getRepository(ImportRun).createQueryBuilder('run')
        .where('run.id = :id AND run.organizationId = :organizationId', { id, organizationId })
        .setLock('pessimistic_write').getOne();
      if (!locked) throw new NotFoundException('Запись импорта не найдена.');
      if (locked.rolledBackAt) throw new BadRequestException('Этот импорт уже откачен.');
      const entries = await manager.getRepository(ScheduleChange).createQueryBuilder('change')
        .where('change.organizationId = :organizationId', { organizationId })
        .andWhere(`change."newValue"->>'importJobId' = :jobId`, { jobId })
        .andWhere('change."legacyLessonId" IS NOT NULL')
        .orderBy('change.timestamp', 'ASC').addOrderBy('change.id', 'ASC').getMany();
      const groups = new Map<string, ScheduleChange[]>();
      for (const entry of entries) {
        if (!entry.legacyLessonId) continue;
        const list = groups.get(entry.legacyLessonId) ?? [];
        list.push(entry);
        groups.set(entry.legacyLessonId, list);
      }
      const lessons = manager.getRepository(Lesson);
      const result: ImportRollbackResult = { restored: 0, conflicts: [], rolledBackAt: new Date().toISOString() };
      for (const [lessonId, journal] of groups) {
        const conflict = (reason: ImportRollbackConflict['reason'], externalId: string) => result.conflicts.push(rollbackConflict(lessonId, externalId, reason));
        const lesson = await lessons.findOne({ where: { id: lessonId, organizationId }, withDeleted: true });
        const last = journal[journal.length - 1];
        const lastExternalId = String(last.newValue.externalId ?? '');
        if (!lesson) { conflict('missing', lastExternalId); continue; }
        if (!journalMatchesSnapshot(this.snapshot(lesson), last.newValue)) { conflict('changed', lastExternalId); continue; }
        const first = journal[0];
        if (journalCreatedRow(first.originalValue)) {
          // The import created this lesson: the compensation is a soft delete.
          lesson.deletedAt = new Date();
          lesson.isChanged = true;
          lesson.changeDescription = 'Откат импорта расписания';
          await lessons.save(lesson);
          await this.record(manager, organizationId, actor.id, run.source, jobId, lesson.id, 'rollback', this.snapshot({ ...lesson, deletedAt: null } as Lesson), this.snapshot(lesson));
          result.restored++;
          continue;
        }
        const restored = restoreFromJournal(first.originalValue);
        if (!restored) { conflict('invalid-journal', lastExternalId); continue; }
        const before = this.snapshot(lesson);
        await lessons.save(lessons.create({ ...lesson, ...restored, isChanged: true, changeDescription: 'Откат импорта расписания', lastSyncedAt: new Date() }));
        await this.record(manager, organizationId, actor.id, run.source, jobId, lesson.id, 'rollback', before, this.snapshot({ ...lesson, ...restored } as Lesson));
        result.restored++;
      }
      locked.rolledBackAt = new Date();
      locked.rolledBackBy = actor.id;
      locked.rollbackResult = result;
      await manager.getRepository(ImportRun).save(locked);
      return result;
    }));
  }

  async getJob(organizationId: string, id: string) {
    this.tenant.assertAccess(organizationId);
    const job = await this.jobs.findOneBy({ id, organizationId });
    if (!job) throw new NotFoundException('Задание импорта не найдено.');
    return this.jobView(job);
  }

  async getChanges(organizationId: string, id: string, pagination: PaginationQueryDto) {
    await this.getJob(organizationId, id);
    const [data, total] = await this.db.getRepository(ScheduleChange).createQueryBuilder('change')
      .where('change.organizationId = :organizationId', { organizationId }).andWhere(`"change"."newValue"->>'importJobId' = :id`, { id })
      .orderBy('change.timestamp', 'DESC').addOrderBy('change.id', 'ASC').skip((pagination.page - 1) * pagination.limit).take(pagination.limit).getManyAndCount();
    return toPaginatedResponse(data, total, pagination);
  }

  private jobView(job: ScheduleImportJob) {
    return { jobId: job.id, status: job.status, attempts: job.attempts, result: job.result, lastError: job.lastError, createdAt: job.createdAt, updatedAt: job.updatedAt };
  }

  /**
   * Parses one import request into a payload. `apply` keeps the historic
   * structural 400s (duplicates, out-of-range rows, empty file without
   * replace); `diagnostic` (server dry-run) turns row-level problems into
   * `rowIssues` so the preview can show them and the valid rows still plan
   * (FR-IMP-04/07). Normalization errors are row issues in both modes.
   */
  private async prepare(university: University, dto: ImportScheduleDto, mode: 'diagnostic' | 'apply'): Promise<ScheduleImportPayload> {
    if (!dto.fileName?.trim() || dto.fileName.length > 100 || (dto.rows && dto.content !== undefined) || ((dto.rows || dto.content !== undefined) && ['sibit', 'moodle'].includes(dto.format))) throw new BadRequestException('Передайте один источник: rows, content или настроенный внешний коннектор.');
    const rowIssues: ScheduleImportRowIssue[] = [];
    let lessons: NormalizedScheduleLesson[];
    if (dto.rows) {
      if (!['csv', 'json'].includes(dto.format)) throw new BadRequestException('rows поддерживает только legacy csv/json.');
      lessons = [];
      dto.rows.forEach((row, index) => {
        try {
          lessons.push({ ...normalizeScheduleRow(row as unknown as Record<string, unknown>, dto.utcOffset || '+00:00', `${dto.fileName}:${index + 1}`), row: index + 1 });
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          rowIssues.push({ row: index + 1, message: error.message });
        }
      });
    } else if (dto.format === 'json') {
      let rows: unknown;
      try { rows = JSON.parse(textFile(dto.content)); } catch { throw new BadRequestException('Некорректный JSON.'); }
      if (!Array.isArray(rows)) throw new BadRequestException('JSON должен содержать массив занятий.');
      lessons = [];
      rows.forEach((row, index) => {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['id', 'date', 'startTime', 'endTime', 'pairNumber', 'subject', 'group', 'teacher', 'room', 'status'].includes(key))) {
          rowIssues.push({ row: index + 1, message: 'JSON содержит неподдерживаемые поля.' });
          return;
        }
        try {
          lessons.push({ ...normalizeScheduleRow(row, dto.utcOffset || '+00:00'), row: index + 1 });
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          rowIssues.push({ row: index + 1, message: error.message });
        }
      });
    } else {
      const connector = ({ csv: this.csv, ics: this.ics, xlsx: this.xlsx, sibit: this.sibit, moodle: this.moodle })[dto.format];
      if (!connector) throw new BadRequestException('Неподдерживаемый формат.');
      lessons = await connector.fetchSchedule(university, { ...dto, onRowIssue: issue => rowIssues.push(issue) });
    }
    const groupScopedIdentity = dto.format === 'sibit';
    if (lessons.length > MAX_IMPORT_ROWS) throw new BadRequestException('Нужно 1–1000 занятий без повторных ID; пустой снимок разрешён только с replace.');
    // FR-IMP-07: a repeated external ID fails the whole apply (historic 400),
    // while a dry-run reports the repeat and plans the first occurrence.
    const unique: NormalizedScheduleLesson[] = [];
    const seenIds = new Set<string>();
    for (const lesson of lessons) {
      const key = groupScopedIdentity ? `${lesson.externalId}::${lesson.groupExternalId}` : lesson.externalId;
      if (seenIds.has(key)) {
        if (mode === 'apply') throw new BadRequestException('Нужно 1–1000 занятий без повторных ID; пустой снимок разрешён только с replace.');
        rowIssues.push({ row: lesson.row ?? 0, message: 'Повторный внешний ID: строка пропущена.', externalId: lesson.externalId });
        continue;
      }
      seenIds.add(key);
      unique.push(lesson);
    }
    lessons = unique;
    if (!lessons.length && !dto.replace) throw new BadRequestException('Нужно 1–1000 занятий без повторных ID; пустой снимок разрешён только с replace.');
    // A file whose every row failed must never wipe the source in apply mode.
    if (!lessons.length && rowIssues.length && mode === 'apply') throw new BadRequestException('Все строки источника отклонены: исправьте файл и повторите импорт.');
    const groupNames = [...new Set((dto.groupNames || lessons.map(lesson => lesson.groupName)).map(name => name.trim()))];
    const sourceKey = (dto.sourceKey || dto.fileName).trim();
    if (!sourceKey || sourceKey.length > 100 || groupNames.some(name => !name || name.length > 200)) throw new BadRequestException('Некорректное имя источника или группы.');
    const from = dto.startDate?.slice(0, 10), to = dto.endDate?.slice(0, 10);
    if ((from && !to) || (!from && to) || (from && to && (to < from || new Date(to).getTime() - new Date(from).getTime() > 366 * 86400000))) throw new BadRequestException('Нужен согласованный диапазон не больше 366 дней.');
    if (dto.replace && (!dto.sourceKey || !dto.startDate || !dto.endDate || !dto.groupNames?.length)) throw new BadRequestException('replace требует sourceKey, startDate/endDate и явный список groupNames.');
    const outOfRange = (lesson: NormalizedScheduleLesson): boolean =>
      (!!from && lesson.localDate < from) || (!!to && lesson.localDate > to) || !groupNames.some(name => normalizeName(name) === normalizeName(lesson.groupName));
    if (mode === 'apply') {
      if (lessons.some(outOfRange)) throw new BadRequestException('Занятие находится вне явно указанного диапазона или групп.');
    } else {
      lessons = lessons.filter(lesson => {
        if (!outOfRange(lesson)) return true;
        rowIssues.push({ row: lesson.row ?? 0, message: 'Занятие вне явно указанного диапазона или групп.', externalId: lesson.externalId });
        return false;
      });
    }
    // FR-IMP-04: row-numbered hints travel with the payload so the dry-run
    // preview and the downloadable report show exactly what the file held.
    const rowWarnings: ScheduleImportRowIssue[] = [];
    const planned = new Set(lessons.map(lesson => lesson.row));
    for (const lesson of lessons) {
      if (!lesson.row) continue;
      if (!lesson.teacherName) rowWarnings.push({ row: lesson.row, message: 'Не указан преподаватель.', externalId: lesson.externalId });
      if (lesson.cancelled) rowWarnings.push({ row: lesson.row, message: 'Строка помечена как отменённое занятие.', externalId: lesson.externalId });
    }
    if (dto.rows) {
      // One plan-level note: the legacy rows path has no stable source IDs at
      // all, so a per-row warning would drown the report (row 0 = plan-level).
      const missingId = dto.rows.some((row, index) => !row.id && planned.has(index + 1));
      if (missingId) rowWarnings.push({ row: 0, message: 'Нет внешнего ID: использован составной ключ «файл:номер строки».' });
    }
    return { lessons, source: `university-import:${sourceKey}`, fileName: dto.fileName, replace: !!dto.replace, groupNames, startDate: from, endDate: to, utcOffset: dto.format === 'ics' ? '+00:00' : dto.utcOffset || '+00:00', groupScopedIdentity, rowIssues, rowWarnings };
  }

  /**
   * Read-only diff plus the exact op list to execute it. The confirmation
   * gate, the server dry-run and the apply all share this code path, so the
   * preview can never disagree with what a confirmed import would do
   * (FR-IMP-04/07/08).
   */
  private async plan(manager: EntityManager, organizationId: string, payload: ScheduleImportPayload): Promise<{ plan: ScheduleImportPlan; ops: ImportOp[] }> {
    const groups = await manager.getRepository(Group).find({ where: { organizationId } });
    if (new Set(groups.map(group => normalizeName(group.name))).size !== groups.length || new Set(groups.filter(group => group.externalId).map(group => group.externalId)).size !== groups.filter(group => group.externalId).length) throw new BadRequestException('Неоднозначные имена или внешние ID групп: исправьте структуру вуза.');
    const byName = new Map(groups.map(group => [normalizeName(group.name), group]));
    const bySource = new Map(groups.filter(group => group.externalId).map(group => [group.externalId!, group]));
    for (const name of payload.groupNames) if (!byName.has(normalizeName(name))) throw new BadRequestException(`Не найдена группа ВУЗа: ${name}. Сначала добавьте её в структуру ВУЗа.`);
    const resolved = payload.lessons.map(lesson => ({ lesson, group: lesson.groupExternalId ? bySource.get(lesson.groupExternalId) : byName.get(normalizeName(lesson.groupName)) }));
    if (resolved.some(item => !item.group)) throw new BadRequestException('Не все группы источника сопоставлены с группами этого вуза.');
    const repository = manager.getRepository(Lesson);
    const existing = await repository.find({ where: { organizationId, source: payload.source }, withDeleted: true });
    const legacy = payload.lessons.some(lesson => lesson.externalId.startsWith(payload.fileName + ':')) ? await repository.find({ where: { organizationId, source: 'university-import' }, withDeleted: true }) : [];
    const identity = (externalId: string, groupId: string) => payload.groupScopedIdentity ? `${externalId}::${groupId}` : externalId;
    const current = new Map(existing.map(lesson => [identity(lesson.externalId, lesson.groupId), lesson]));
    for (const lesson of legacy) if (payload.lessons.some(row => row.externalId === lesson.externalId) && !current.has(lesson.externalId)) current.set(lesson.externalId, lesson);
    const summary: ScheduleImportSummary = { imported: 0, updated: 0, deleted: 0, unchanged: 0, errors: payload.rowIssues?.length ?? 0 };
    const rows: ScheduleImportRowResult[] = [];
    const ops: ImportOp[] = [];
    const seen = new Set<string>();
    for (const { lesson: input, group } of resolved) {
      const key = identity(input.externalId, group!.id);
      seen.add(key);
      const old = current.get(key);
      const report = (outcome: ScheduleImportRowResult['outcome']) => rows.push({ row: input.row ?? 0, externalId: input.externalId, groupName: group!.name, date: input.localDate, subject: input.subject, outcome });
      if (input.cancelled) {
        if (old && !old.deletedAt) { ops.push({ kind: 'cancel', lesson: old }); summary.deleted++; report('deleted'); }
        else { summary.unchanged++; report('unchanged'); }
        continue;
      }
      const values = lessonValues(organizationId, input, group!, payload, '');
      const before = old ? this.snapshot(old) : {};
      const after = this.snapshot({ ...old, ...values } as Lesson);
      if (old && JSON.stringify(before) === JSON.stringify(after)) { summary.unchanged++; report('unchanged'); continue; }
      ops.push({ kind: 'upsert', input, group: group!, old, before, after });
      summary[old ? 'updated' : 'imported']++;
      report(old ? 'updated' : 'created');
    }
    if (payload.replace) {
      const groupIds = new Set(payload.groupNames.map(name => byName.get(normalizeName(name))!.id));
      for (const old of existing) {
        if (old.deletedAt || seen.has(identity(old.externalId, old.groupId)) || !groupIds.has(old.groupId)) continue;
        const date = localDay(old, payload);
        if (date < payload.startDate! || date > payload.endDate!) continue;
        ops.push({ kind: 'cancel', lesson: old });
        summary.deleted++;
        rows.push({ row: 0, externalId: old.externalId, groupName: old.groupName, date, subject: old.subject, outcome: 'deleted' });
      }
    }
    for (const issue of payload.rowIssues ?? []) rows.push({ row: issue.row, externalId: issue.externalId ?? '', groupName: '', date: '', subject: '', outcome: 'error', message: issue.message });
    // FR-IMP-08 denominator: every active lesson of the university, not just this source.
    const existingActive = await repository.count({ where: { organizationId, deletedAt: IsNull() } });
    const university = await manager.getRepository(University).findOneBy({ id: organizationId });
    const threshold = university?.importMassChangeThreshold ?? 30;
    const decision = massChangeDecision({ summary, existingActive, threshold, replace: payload.replace, validRows: payload.lessons.length });
    const plan: ScheduleImportPlan = {
      summary,
      rows,
      warnings: [...(payload.rowWarnings ?? []), ...importedOverlapWarnings(resolved.map(({ lesson, group }) => ({ lesson, groupId: group!.id })))],
      errors: payload.rowIssues ?? [],
      confirmationWarnings: confirmationWarnings(decision.reasons, { changed: summary.updated + summary.deleted, existingActive, threshold, errors: summary.errors, validRows: payload.lessons.length }),
      existingActive,
      changedRatio: decision.changedRatio,
      threshold,
      requiresConfirmation: decision.requiresConfirmation,
      confirmationReasons: decision.reasons,
    };
    return { plan, ops };
  }

  processNext(): Promise<boolean> { return this.process(); }
  processJob(id: string): Promise<boolean> { return this.process(id); }

  private async process(id?: string): Promise<boolean> {
    let claimed: { id: string; organizationId: string; attempts: number } | undefined;
    // The run row is the durable trace of this attempt (FR-IMP-05), so the
    // outer capability covers it as well as the job queue.
    return this.databaseAccess(['schedule_import_jobs', 'import_runs'], null, true, async () => {
      try {
        return await this.db.transaction(async manager => {
          const query = manager.getRepository(ScheduleImportJob).createQueryBuilder('job').where('job.status = :status', { status: 'queued' }).setLock('pessimistic_write').setOnLocked('skip_locked').orderBy('job.createdAt', 'ASC');
          if (id) query.andWhere('job.id = :id', { id });
          else query.andWhere('job.nextAttemptAt <= :now', { now: new Date() });
          const job = await query.getOne();
          if (!job) return false;
          claimed = { id: job.id, organizationId: job.organizationId, attempts: job.attempts };
          if (!job.payload) throw new BadRequestException('Нет содержимого задания.');
          const plan = await this.databaseAccess(TABLES, [job.organizationId], true, () => this.apply(manager, job));
          job.status = 'completed'; job.result = plan.summary; job.payload = null; job.attempts++; job.lastError = null;
          await manager.getRepository(ScheduleImportJob).save(job);
          const run = await manager.getRepository(ImportRun).findOneBy({ jobId: job.id });
          if (run) {
            run.status = 'completed'; run.result = plan; run.lastError = null; run.completedAt = new Date();
            await manager.getRepository(ImportRun).save(run);
          }
          return true;
        });
      } catch (error) {
        if (!claimed) throw error;
        const terminal = error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException;
        const lastError = terminal ? error.message.slice(0, 500) : 'Временная ошибка импорта. Повторная попытка будет выполнена автоматически.';
        // Three attempts (or a terminal validation/auth failure) end the run;
        // a retryable failure keeps it queued for the next attempt.
        const exhausted = terminal || claimed.attempts + 1 >= 3;
        await this.jobs.createQueryBuilder().update().set({
          attempts: () => 'attempts + 1',
          status: () => terminal ? "'failed'" : "CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'queued' END",
          nextAttemptAt: new Date(Date.now() + 30000), lastError,
        }).where('id = :id AND "organizationId" = :organizationId AND status = :status', { id: claimed.id, organizationId: claimed.organizationId, status: 'queued' }).execute();
        if (exhausted) {
          await this.runs.createQueryBuilder().update().set({ status: 'failed', lastError })
            .where('"jobId" = :jobId AND status = :status', { jobId: claimed.id, status: 'queued' }).execute();
        }
        return true;
      }
    });
  }

  /** Adapts to the explicit trusted-capability API introduced by the independent RLS block. */
  private databaseAccess<T>(tables: string[], organizationIds: string[] | null, write: boolean, callback: () => Promise<T>): Promise<T> {
    return this.tenant.runWithDatabaseAccess({ tables, organizationIds, write }, callback);
  }

  /** Executes exactly the ops the shared plan produced, atomically (FR-IMP-07). */
  private async apply(manager: EntityManager, job: ScheduleImportJob): Promise<ScheduleImportPlan> {
    const payload = job.payload!;
    const actor = await manager.getRepository(User).findOneBy({ id: job.actorId, isActive: true });
    const canStillImport = actor && (
      [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(actor.role) ||
      (actor.role === UserRole.UNIVERSITY_ADMIN && actor.organizationId === job.organizationId)
    );
    if (!canStillImport) throw new ForbiddenException('Автор задания больше не имеет права импортировать расписание этого вуза.');
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`schedule-import:${job.organizationId}:${payload.source}`]);
    const { plan, ops } = await this.plan(manager, job.organizationId, payload);
    const repository = manager.getRepository(Lesson);
    for (const op of ops) {
      if (op.kind === 'cancel') { await this.cancel(manager, job, op.lesson); continue; }
      const values = lessonValues(job.organizationId, op.input, op.group, payload, job.payloadHash);
      const saved = await repository.save(repository.create({ ...op.old, ...values, lastSyncedAt: new Date(), isChanged: !!op.old, changeDescription: op.old ? 'Изменение при импорте расписания' : undefined }));
      await this.record(manager, job.organizationId, job.actorId, payload.source, job.id, saved.id, op.old ? 'updated' : 'added', op.before, op.after);
    }
    return plan;
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
    await this.record(manager, job.organizationId, job.actorId, job.payload!.source, job.id, lesson.id, 'deleted', before, this.snapshot(lesson));
  }

  /** Journal entry for one executed op; the compensating rollback reads these back (FR-IMP-05). */
  private async record(manager: EntityManager, organizationId: string, actorId: string, source: string, jobId: string, lessonId: string, changeType: string, originalValue: JsonObject, newValue: JsonObject) {
    await manager.getRepository(ScheduleChange).save({ organizationId, legacyLessonId: lessonId, occurrenceId: null, actorId, source, timestamp: new Date(), reason: `Импорт: ${changeType}`, originalValue, newValue: { ...newValue, changeType, importJobId: jobId } });
  }
}
