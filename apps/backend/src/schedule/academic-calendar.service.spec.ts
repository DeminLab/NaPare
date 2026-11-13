import { NotFoundException } from '@nestjs/common';

import { AcademicCalendarService, calculateWeek, mondayOf } from './academic-calendar.service';

describe('AcademicCalendarService (TZ 11.3 week parity)', () => {
  const term = { week1Anchor: '2026-09-07', cycleLength: 2, week1Type: 'odd' as const };

  describe('control set from TZ 11.3 (anchor 2026-09-07, week1 odd, cycle 2)', () => {
    it.each([
      { date: '2026-09-07', weekNumber: 1, cyclePosition: 1, weekType: 'odd' },
      { date: '2026-10-19', weekNumber: 7, cyclePosition: 1, weekType: 'odd' },
      { date: '2026-10-23', weekNumber: 7, cyclePosition: 1, weekType: 'odd' },
      { date: '2026-10-26', weekNumber: 8, cyclePosition: 2, weekType: 'even' },
      { date: '2026-10-27', weekNumber: 8, cyclePosition: 2, weekType: 'even' },
    ])('$date → week $weekNumber, $weekType', ({ date, weekNumber, cyclePosition, weekType }) => {
      const info = calculateWeek(term, date);
      expect(info.weekNumber).toBe(weekNumber);
      expect(info.cyclePosition).toBe(cyclePosition);
      expect(info.weekType).toBe(weekType);
    });
  });

  it('reports the Monday..Sunday boundaries of the requested week', () => {
    const info = calculateWeek(term, '2026-10-23');
    expect(info.weekStart).toBe('2026-10-19');
    expect(info.weekEnd).toBe('2026-10-25');
    expect(mondayOf('2026-10-23').toISOString().slice(0, 10)).toBe('2026-10-19');
    expect(mondayOf('2026-10-27').toISOString().slice(0, 10)).toBe('2026-10-26');
    expect(mondayOf('2026-09-07').toISOString().slice(0, 10)).toBe('2026-09-07');
  });

  it('labels a cycle longer than two weeks instead of a parity', () => {
    const info = calculateWeek({ ...term, cycleLength: 4 }, '2026-09-14');
    expect(info.weekNumber).toBe(2);
    expect(info.cyclePosition).toBe(2);
    expect(info.weekType).toBe('неделя 2 из 4');
  });

  it('clamps a date before the anchor to week 1 (week_number ≥ 1)', () => {
    const info = calculateWeek(term, '2026-09-01');
    expect(info.weekNumber).toBe(1);
    expect(info.weekType).toBe('odd');
  });

  describe('getWeekType', () => {
    const activeTerm = {
      id: 'term-1',
      organizationId: 'uni-1',
      startsOn: '2026-09-01',
      endsOn: '2027-01-31',
      week1Anchor: '2026-09-07',
      cycleLength: 2,
      week1Type: 'odd' as const,
    };
    const termRepository = { findOne: jest.fn() };
    const exceptionRepository = { findOne: jest.fn() };
    const service = new AcademicCalendarService(termRepository as never, exceptionRepository as never);

    beforeEach(() => {
      jest.clearAllMocks();
      termRepository.findOne.mockResolvedValue(activeTerm);
      exceptionRepository.findOne.mockResolvedValue(null);
    });

    it('returns the semester rule when no exception applies', async () => {
      await expect(service.getWeekType('uni-1', '2026-10-23')).resolves.toMatchObject({
        date: '2026-10-23',
        weekNumber: 7,
        weekType: 'odd',
        cyclePosition: 1,
        cycleLength: 2,
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        term: { id: 'term-1', week1Anchor: '2026-09-07', week1Type: 'odd' },
        exception: null,
      });
      expect(exceptionRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('overrides the parity with a manual date exception', async () => {
      exceptionRepository.findOne.mockResolvedValueOnce({
        id: 'exc-1',
        kind: 'holiday',
        exceptionDate: '2026-10-26',
        weekNumber: null,
        weekType: 'odd',
        note: 'перенос пар',
      });

      await expect(service.getWeekType('uni-1', '2026-10-26')).resolves.toMatchObject({
        weekNumber: 8,
        weekType: 'odd',
        exception: { id: 'exc-1', kind: 'holiday', weekType: 'odd' },
      });
    });

    it('keeps the parity for an informational exception without an explicit weekType', async () => {
      exceptionRepository.findOne.mockResolvedValueOnce({
        id: 'exc-2',
        kind: 'vacation',
        exceptionDate: '2026-11-09',
        weekNumber: null,
        weekType: null,
        note: 'каникулы',
      });

      await expect(service.getWeekType('uni-1', '2026-11-09')).resolves.toMatchObject({
        weekNumber: 10,
        weekType: 'even',
        exception: { id: 'exc-2', kind: 'vacation', weekType: null },
      });
    });

    it('consults the week-number exception when no date exception exists', async () => {
      exceptionRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'exc-3', kind: null, exceptionDate: null, weekNumber: 7, weekType: 'even', note: null });

      await expect(service.getWeekType('uni-1', '2026-10-23')).resolves.toMatchObject({
        weekNumber: 7,
        weekType: 'even',
        exception: { id: 'exc-3', weekNumber: 7 },
      });
    });

    it('rejects a date outside the active academic calendar', async () => {
      termRepository.findOne.mockResolvedValue(null);
      await expect(service.getWeekType('uni-1', '2028-05-01')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a participant without an organization', async () => {
      await expect(service.getWeekType(null, '2026-10-23')).rejects.toBeInstanceOf(NotFoundException);
      expect(termRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
