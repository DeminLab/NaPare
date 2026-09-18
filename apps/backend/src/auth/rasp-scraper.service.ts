import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

export const SIBIT_UNIVERSITY = {
  name: 'СИБИТ',
  city: 'Омск',
} as const;

const RASP_BASE_URL = 'https://rasp.sano.ru';
const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

interface RaspApiResponse<T> {
  state?: number;
  msg?: string;
  data: T;
}
interface RaspYearsResponse extends RaspApiResponse<{ years: string[] }> {}
interface RaspGroupRecord {
  name: string;
  id: number;
  kurs: number;
  facul: string;
  yearName: string;
  facultyID: number;
}
interface RaspGroupsResponse extends RaspApiResponse<RaspGroupRecord[]> {}
interface RaspLessonRecord {
  код: number;
  дата: string;
  начало: string;
  конец: string;
  деньНедели: number;
  день_недели: string;
  дисциплина: string;
  преподаватель: string;
  аудитория: string;
  учебныйГод: string;
  группа: string;
  замена: boolean;
  кодПреподавателя: number;
  кодГруппы: number;
  номерПодгруппы: number;
  типНедели: number;
  номерЗанятия: number;
}
interface RaspInfo {
  group?: { name?: string; groupID?: number };
  year?: string;
  dateUploadingRasp?: string;
}
interface RaspScheduleResponse extends RaspApiResponse<{ rasp: RaspLessonRecord[]; info?: RaspInfo }> {}

export interface RaspAcademicYear { value: string; label: string }

export interface RaspGroup {
  groupId: string;
  name: string;
  faculty: string;
  facultyId: number;
  course: number;
  academicYear: string;
}

export interface RaspLesson {
  lessonId: string;
  groupId: string;
  groupName: string;
  date: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  pairNumber: number;
  subject: string;
  subjectType?: string;
  teacher?: string;
  teacherId?: string;
  room?: string;
  subgroup?: string;
  weekType: 'odd' | 'even' | 'both';
  academicYear: string;
  isReplacement: boolean;
}

export interface RaspSubject {
  key: string;
  name: string;
  type?: string;
  groupIds: string[];
}

export interface RaspCatalog {
  university: typeof SIBIT_UNIVERSITY;
  academicYear: string;
  source: string;
  fetchedAt: string;
  groups: RaspGroup[];
  subjects: RaspSubject[];
  lessons: RaspLesson[];
}

interface CachedValue<T> { value: T; expiresAt: number }

@Injectable()
export class RaspScraperService {
  private readonly logger = new Logger(RaspScraperService.name);
  private yearsCache: CachedValue<string[]> | null = null;
  private readonly groupsCache = new Map<string, CachedValue<RaspGroup[]>>();
  private readonly scheduleCache = new Map<string, CachedValue<RaspLesson[]>>();
  private readonly catalogCache = new Map<string, CachedValue<RaspCatalog>>();

  async getYears(): Promise<RaspAcademicYear[]> {
    const years = await this.getAvailableYears();
    return years.map((value) => ({ value, label: value }));
  }

  async getGroups(year?: string): Promise<RaspGroup[]> {
    const academicYear = await this.resolveYear(year);
    const cached = this.groupsCache.get(academicYear);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await this.fetchJson<RaspGroupsResponse>(
        `/api/raspGrouplist?year=${encodeURIComponent(academicYear)}`,
      );
      this.assertSuccessfulResponse(response, 'группы');
      if (!Array.isArray(response.data)) throw new Error('Источник вернул группы в неожиданном формате');
      const groups = response.data
        .filter((group) => Number.isInteger(group.id) && Boolean(group.name))
        .map((group) => ({
          groupId: String(group.id),
          name: group.name.trim(),
          faculty: group.facul?.trim() || 'Не указан',
          facultyId: group.facultyID,
          course: group.kurs,
          academicYear: group.yearName || academicYear,
        }));
      this.groupsCache.set(academicYear, { value: groups, expiresAt: Date.now() + CACHE_TTL_MS });
      this.logger.log(`Fetched ${groups.length} groups from rasp.sano.ru for ${academicYear}`);
      return groups;
    } catch (error) {
      this.logUpstreamError('groups', error);
      throw new BadGatewayException('Не удалось загрузить группы с rasp.sano.ru');
    }
  }

  async getSchedule(groupId: string, year?: string): Promise<RaspLesson[]> {
    const academicYear = await this.resolveYear(year);
    const groups = await this.getGroups(academicYear);
    const group = groups.find((item) => item.groupId === groupId);
    if (!group) throw new NotFoundException('Группа не найдена в расписании СИБИТа');

    const cacheKey = `${academicYear}:${groupId}`;
    const cached = this.scheduleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await this.fetchJson<RaspScheduleResponse>(
        `/api/Rasp?idGroup=${encodeURIComponent(groupId)}&year=${encodeURIComponent(academicYear)}`,
      );
      this.assertSuccessfulResponse(response, 'расписание');
      if (!Array.isArray(response.data?.rasp)) throw new Error('Источник вернул расписание в неожиданном формате');
      const lessons = response.data.rasp
        .map((item) => this.normalizeLesson(item, group, academicYear))
        .filter((item): item is RaspLesson => item !== null);
      this.scheduleCache.set(cacheKey, { value: lessons, expiresAt: Date.now() + CACHE_TTL_MS });
      return lessons;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logUpstreamError(`schedule for ${groupId}`, error);
      throw new BadGatewayException('Не удалось загрузить расписание с rasp.sano.ru');
    }
  }

  async getCatalog(year?: string): Promise<RaspCatalog> {
    const academicYear = await this.resolveYear(year);
    const cached = this.catalogCache.get(academicYear);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const groups = await this.getGroups(academicYear);
    const scheduleChunks = await Promise.all(groups.map((group) => this.getSchedule(group.groupId, academicYear)));
    const lessons = scheduleChunks.flat();
    const catalog: RaspCatalog = {
      university: SIBIT_UNIVERSITY,
      academicYear,
      source: `${RASP_BASE_URL}/WebApp/#/Rasp/List`,
      fetchedAt: new Date().toISOString(),
      groups,
      subjects: this.collectSubjects(lessons),
      lessons,
    };
    this.catalogCache.set(academicYear, { value: catalog, expiresAt: Date.now() + CACHE_TTL_MS });
    this.logger.log(`Fetched SIBIT catalog for ${academicYear}: ${groups.length} groups, ${catalog.subjects.length} subjects, ${lessons.length} lessons`);
    return catalog;
  }

  async isValidGroup(groupId: string): Promise<boolean> {
    const groups = await this.getGroups();
    return groups.some((group) => group.groupId === groupId);
  }

  private async getAvailableYears(): Promise<string[]> {
    if (this.yearsCache && this.yearsCache.expiresAt > Date.now()) return this.yearsCache.value;
    try {
      const response = await this.fetchJson<RaspYearsResponse>('/api/Rasp/ListYears');
      this.assertSuccessfulResponse(response, 'учебные годы');
      const years = response.data?.years?.filter((year) => /^\d{4}-\d{4}$/.test(year)) ?? [];
      if (years.length === 0) throw new Error('Источник не вернул учебные годы');
      this.yearsCache = { value: years, expiresAt: Date.now() + CACHE_TTL_MS };
      return years;
    } catch (error) {
      this.logUpstreamError('academic years', error);
      throw new BadGatewayException('Не удалось загрузить учебные годы с rasp.sano.ru');
    }
  }

  private async resolveYear(year?: string): Promise<string> {
    const years = await this.getAvailableYears();
    if (year) {
      if (!years.includes(year)) throw new NotFoundException('Учебный год отсутствует в rasp.sano.ru');
      return year;
    }
    return years[years.length - 1];
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${RASP_BASE_URL}${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'NaPare/1.0 (SIBIT schedule integration)' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertSuccessfulResponse(response: { state?: number; msg?: string }, resource: string): void {
    if (response.state !== undefined && response.state !== 1) {
      throw new Error(`Источник отклонил запрос «${resource}»: ${response.msg || 'неизвестная ошибка'}`);
    }
  }

  private normalizeLesson(item: RaspLessonRecord, group: RaspGroup, academicYear: string): RaspLesson | null {
    const date = item.дата?.slice(0, 10);
    const discipline = item.дисциплина?.trim();
    if (!date || !discipline || !item.начало || !item.конец) return null;
    const subjectMatch = discipline.match(/^(лек|пр|лаб)\s+(.+)$/i);
    const subjectType = subjectMatch?.[1]?.toLowerCase();
    const subject = (subjectMatch?.[2] || discipline).trim();
    const sourceDay = Number(item.деньНедели);
    const dayOfWeek = Number.isInteger(sourceDay) ? sourceDay % 7 : new Date(`${date}T00:00:00`).getDay();
    return {
      lessonId: String(item.код),
      groupId: String(item.кодГруппы || group.groupId),
      groupName: item.группа || group.name,
      date,
      dayOfWeek,
      dayName: item.день_недели,
      startTime: item.начало,
      endTime: item.конец,
      pairNumber: item.номерЗанятия,
      subject,
      subjectType,
      teacher: item.преподаватель || undefined,
      teacherId: item.кодПреподавателя ? String(item.кодПреподавателя) : undefined,
      room: item.аудитория || undefined,
      subgroup: item.номерПодгруппы ? String(item.номерПодгруппы) : undefined,
      weekType: item.типНедели === 1 ? 'odd' : item.типНедели === 2 ? 'even' : 'both',
      academicYear: item.учебныйГод || academicYear,
      isReplacement: Boolean(item.замена),
    };
  }

  private collectSubjects(lessons: RaspLesson[]): RaspSubject[] {
    const subjects = new Map<string, RaspSubject>();
    for (const lesson of lessons) {
      const key = `${lesson.subject}::${lesson.subjectType || ''}`;
      const existing = subjects.get(key);
      if (existing) {
        if (!existing.groupIds.includes(lesson.groupId)) existing.groupIds.push(lesson.groupId);
        continue;
      }
      subjects.set(key, { key, name: lesson.subject, type: lesson.subjectType, groupIds: [lesson.groupId] });
    }
    return [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  private logUpstreamError(scope: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to fetch ${scope} from rasp.sano.ru: ${message}`);
  }
}
