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
}

export interface ScheduleConnectorInput {
  content?: string;
  utcOffset?: string;
  groupName?: string;
  pairNumber?: number;
  startDate?: string;
  endDate?: string;
}

/** Adapters return source identities and instants; persistence resolves only this university's groups. */
export interface ScheduleConnector {
  fetchSchedule(university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]>;
}

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
}

export interface ScheduleImportSummary {
  imported: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

/** A Redis dispatcher can enqueue only this durable ID and invoke processJob(id). */
export interface ScheduleImportQueue {
  processNext(): Promise<boolean>;
  processJob(id: string): Promise<boolean>;
}
