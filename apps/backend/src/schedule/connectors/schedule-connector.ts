import { University } from '../../users/entities/university.entity';

export interface NormalizedScheduleLesson {
  externalId: string;
  groupName: string;
  groupExternalId?: string;
  subject: string;
  startDate: string;
  localDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  pairNumber: number;
  teacherName?: string;
  sourceTeacherId?: string;
  room?: string;
  cancelled?: boolean;
  /** 1-based source row number (file line/event index); 0 when the source has no rows. */
  row?: number;
}

export interface ScheduleConnectorInput {
  content?: string;
  utcOffset?: string;
  groupName?: string;
  pairNumber?: number;
  startDate?: string;
  endDate?: string;
  /** Collects per-row normalization errors instead of failing the whole file (FR-IMP-07). */
  onRowIssue?: (issue: ScheduleImportRowIssue) => void;
}

/** Adapters return source identities and instants; persistence resolves only this university's groups. */
export interface ScheduleConnector {
  fetchSchedule(university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]>;
}

/** Bump when the row schema or mapping semantics change; stored on every import run (FR-IMP-05). */
export const SCHEDULE_MAPPING_VERSION = '1';

export interface ScheduleImportPayload {
  lessons: NormalizedScheduleLesson[];
  source: string;
  fileName: string;
  replace: boolean;
  groupNames: string[];
  startDate?: string;
  endDate?: string;
  utcOffset: string;
  groupScopedIdentity: boolean;
  /** Rows rejected during normalization; they are never applied (FR-IMP-07). */
  rowIssues?: ScheduleImportRowIssue[];
  /** Row-numbered warnings attached during parsing (FR-IMP-04). */
  rowWarnings?: ScheduleImportRowIssue[];
}

export interface ScheduleImportSummary {
  imported: number;
  updated: number;
  deleted: number;
  unchanged: number;
  /** Rows skipped because of row-level errors (never applied). */
  errors: number;
}

/** A row-level problem or hint; `row` is the 1-based source row, 0 for plan-level entries. */
export interface ScheduleImportRowIssue {
  row: number;
  message: string;
  externalId?: string;
}

export type ScheduleImportRowOutcome = 'created' | 'updated' | 'deleted' | 'unchanged' | 'error';

/** Planned (dry-run) or executed outcome of a single source row (FR-IMP-04/05). */
export interface ScheduleImportRowResult {
  /** 1-based source row; 0 for replace deletions that have no row in the file. */
  row: number;
  externalId: string;
  groupName: string;
  date: string;
  subject: string;
  outcome: ScheduleImportRowOutcome;
  /** Present for `error` rows: why the row was skipped (FR-IMP-07). */
  message?: string;
}

/** Read-only diff produced before an import: the confirmation gate input (FR-IMP-04/07/08). */
export interface ScheduleImportPlan {
  summary: ScheduleImportSummary;
  rows: ScheduleImportRowResult[];
  warnings: ScheduleImportRowIssue[];
  errors: ScheduleImportRowIssue[];
  /** Plan-level notices shown next to the confirmation button (FR-IMP-04/08). */
  confirmationWarnings: string[];
  /** Active lessons of the university at plan time; mass-change denominator. */
  existingActive: number;
  /** (updated + deleted) / existingActive, capped at 1. */
  changedRatio: number;
  /** Organization mass-change threshold in percent. */
  threshold: number;
  requiresConfirmation: boolean;
  confirmationReasons: MassChangeReason[];
}

export type MassChangeReason = 'mass-change' | 'empty-snapshot';

/** Outcome of a compensating rollback attempt (FR-IMP-05). */
export interface ImportRollbackConflict {
  lessonId: string;
  externalId: string;
  reason: 'missing' | 'changed' | 'invalid-journal';
}

export interface ImportRollbackResult {
  restored: number;
  conflicts: ImportRollbackConflict[];
  rolledBackAt: string;
}

/** A Redis dispatcher can enqueue only this durable ID and invoke processJob(id). */
export interface ScheduleImportQueue {
  processNext(): Promise<boolean>;
  processJob(id: string): Promise<boolean>;
}
