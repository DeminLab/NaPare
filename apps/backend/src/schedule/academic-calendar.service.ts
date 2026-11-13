import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { AcademicTerm } from './entities/academic-term.entity';
import { CalendarException } from './entities/calendar-exception.entity';

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

/** TZ 11.3: parse 'YYYY-MM-DD' at UTC midnight so the math never drifts with the host timezone. */
function parseIsoDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** monday(d) = d − (isoWeekday(d) − 1) дней; ISO weekday: Mon=1 … Sun=7 (TZ 11.3). */
export function mondayOf(value: string): Date {
  const date = parseIsoDate(value);
  const isoWeekday = ((date.getUTCDay() + 6) % 7) + 1;
  return new Date(date.getTime() - (isoWeekday - 1) * DAY_MS);
}

export interface WeekCalculation {
  weekNumber: number;
  cyclePosition: number;
  weekType: string;
  weekStart: string;
  weekEnd: string;
}

/**
 * TZ 11.3: week_number ≥ 1 (dates before the anchor clamp to week 1),
 * cycle_position 1…N, week_type is the anchor parity for a 2-week cycle and
 * the «неделя {position} из N» label otherwise.
 */
export function calculateWeek(
  term: { week1Anchor: string; cycleLength: number; week1Type: 'odd' | 'even' },
  date: string,
): WeekCalculation {
  const monday = mondayOf(date);
  const anchorMonday = mondayOf(term.week1Anchor);
  const weekNumber = Math.max(1, Math.round((monday.getTime() - anchorMonday.getTime()) / WEEK_MS) + 1);
  const cyclePosition = ((weekNumber - 1) % term.cycleLength) + 1;
  const opposite = term.week1Type === 'odd' ? 'even' : 'odd';
  const weekType = term.cycleLength === 2
    ? (cyclePosition === 1 ? term.week1Type : opposite)
    : `неделя ${cyclePosition} из ${term.cycleLength}`;
  return {
    weekNumber,
    cyclePosition,
    weekType,
    weekStart: toIsoDate(monday),
    weekEnd: toIsoDate(new Date(monday.getTime() + 6 * DAY_MS)),
  };
}

export interface WeekTypeInfo {
  date: string;
  weekNumber: number;
  weekType: string;
  cyclePosition: number;
  cycleLength: number;
  weekStart: string;
  weekEnd: string;
  term: Pick<AcademicTerm, 'id' | 'startsOn' | 'endsOn' | 'week1Anchor' | 'week1Type'>;
  exception: Pick<CalendarException, 'id' | 'kind' | 'exceptionDate' | 'weekNumber' | 'weekType' | 'note'> | null;
}

@Injectable()
export class AcademicCalendarService {
  constructor(
    @InjectRepository(AcademicTerm)
    private readonly termRepository: Repository<AcademicTerm>,
    @InjectRepository(CalendarException)
    private readonly exceptionRepository: Repository<CalendarException>,
  ) {}

  /** TZ 9.3: week type + week number + boundaries for a date of the active calendar. */
  async getWeekType(organizationId: string | null, date: string): Promise<WeekTypeInfo> {
    const day = date.slice(0, 10);
    const term = organizationId
      ? await this.termRepository.findOne({
          where: { organizationId, startsOn: LessThanOrEqual(day), endsOn: MoreThanOrEqual(day) },
          order: { startsOn: 'DESC' },
        })
      : null;
    if (!term) throw new NotFoundException('Дата вне активного учебного календаря');

    const calculated = calculateWeek(term, day);
    // TZ 11.3 priority: manual exception per date → per week → semester rule.
    // Group/faculty scopes join once the endpoint grows those parameters;
    // exceptions without an explicit weekType never shift the parity.
    const exception = (await this.exceptionRepository.findOne({
      where: { organizationId: term.organizationId, exceptionDate: day, groupId: IsNull(), facultyId: IsNull() },
      order: { updatedAt: 'DESC' },
    })) ?? (await this.exceptionRepository.findOne({
      where: { organizationId: term.organizationId, weekNumber: calculated.weekNumber, groupId: IsNull(), facultyId: IsNull() },
      order: { updatedAt: 'DESC' },
    }));

    return {
      date: day,
      weekNumber: calculated.weekNumber,
      weekType: exception?.weekType ?? calculated.weekType,
      cyclePosition: calculated.cyclePosition,
      cycleLength: term.cycleLength,
      weekStart: calculated.weekStart,
      weekEnd: calculated.weekEnd,
      term: {
        id: term.id,
        startsOn: term.startsOn,
        endsOn: term.endsOn,
        week1Anchor: term.week1Anchor,
        week1Type: term.week1Type,
      },
      exception: exception
        ? {
            id: exception.id,
            kind: exception.kind,
            exceptionDate: exception.exceptionDate,
            weekNumber: exception.weekNumber,
            weekType: exception.weekType,
            note: exception.note,
          }
        : null,
    };
  }
}
