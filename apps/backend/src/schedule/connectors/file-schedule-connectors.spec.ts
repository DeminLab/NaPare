import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Workbook } from 'exceljs';
import { University } from '../../users/entities/university.entity';
import { CsvScheduleConnector, IcsScheduleConnector, normalizeScheduleRow, XlsxScheduleConnector } from './file-schedule-connectors';
import { MoodleScheduleConnector, SibitScheduleConnector } from './external-schedule-connectors';
import { MoodleConnectorService } from '../../moodle/moodle-connector.service';
import { RaspScraperService } from '../../auth/rasp-scraper.service';

const university = { connectorType: 'moodle', connectorConfig: { baseUrl: 'https://moodle.example.test', encryptedToken: 'encrypted', tokenIv: 'iv', tokenTag: 'tag', scheduleGroupMap: { '101': 'ИН-25' }, schedulePairTimes: { '09:00': 1 } } } as unknown as University;
const fixture = (name: string) => readFileSync(join(__dirname, '../../../test/fixtures', name), 'utf8');
describe('Schedule source adapters', () => {
  it('reads fixture CSV quoting and converts explicit local offset without losing local date', async () => {
    const rows = await new CsvScheduleConnector().fetchSchedule(university, { content: fixture('schedule.csv'), utcOffset: '+06:00' });
    expect(rows[0]).toMatchObject({ externalId: 'csv-1', subject: 'Математика, анализ', localDate: '2026-10-22', startDate: '2026-10-21T19:00:00.000Z' });
  });
  it.each(['id,id,date,startTime,endTime,pairNumber,subject,group', 'id,date,startTime,endTime,pairNumber,subject,group\na,2026-02-30,09:00,10:00,1,x,G', '"unterminated'])('rejects malformed CSV %s', async content => {
    await expect(new CsvScheduleConnector().fetchSchedule(university, { content })).rejects.toThrow();
  });
  it('expands bounded fixture recurrence with stable per-occurrence identifiers', async () => {
    const rows = await new IcsScheduleConnector().fetchSchedule(university, { content: fixture('schedule.ics'), startDate: '2026-10-22', endDate: '2026-10-23' });
    expect(rows).toHaveLength(2); expect(new Set(rows.map(row => row.externalId)).size).toBe(2);
    expect(rows[1].startDate).toBe('2026-10-23T03:00:00.000Z');
  });
  it('fails closed on timezone-ambiguous ICS and unbounded recurrence', async () => {
    const connector = new IcsScheduleConnector();
    await expect(connector.fetchSchedule(university, { content: fixture('schedule.ics') })).rejects.toThrow('диапазона');
    await expect(connector.fetchSchedule(university, { content: fixture('schedule.ics').replace('DTSTART:20261022T030000Z', 'DTSTART:20261022T030000'), startDate: '2026-10-22', endDate: '2026-10-23' })).rejects.toThrow('UTC');
  });
  it('honours EXDATE instead of inventing a replacement occurrence', async () => {
    const content = fixture('schedule.ics').replace('RRULE:FREQ=DAILY;COUNT=3', 'RRULE:FREQ=DAILY;COUNT=3\nEXDATE:20261023T030000Z');
    const rows = await new IcsScheduleConnector().fetchSchedule(university, { content, startDate: '2026-10-22', endDate: '2026-10-24' });
    expect(rows.map(row => row.localDate)).toEqual(['2026-10-22', '2026-10-24']);
  });
  it('reads an actual XLSX archive and rejects formula cells', async () => {
    const workbook = new Workbook(); const sheet = workbook.addWorksheet('Расписание');
    sheet.addRow(['id', 'date', 'startTime', 'endTime', 'pairNumber', 'subject', 'group']);
    sheet.addRow(['xlsx-1', '2026-10-22', '09:00', '10:30', 1, 'Математика', 'ИН-25']);
    const connector = new XlsxScheduleConnector();
    const content = () => workbook.xlsx.writeBuffer().then(buffer => Buffer.from(buffer).toString('base64'));
    expect((await connector.fetchSchedule(university, { content: await content(), utcOffset: '+06:00' }))[0].externalId).toBe('xlsx-1');
    sheet.getCell('F2').value = { formula: '1+1', result: 2 };
    await expect(connector.fetchSchedule(university, { content: await content() })).rejects.toThrow('формулы');
  });
  it('rejects invalid offsets and nonpositive durations', () => {
    const row = { id: 'a', date: '2026-10-22', startTime: '09:00', endTime: '10:00', pairNumber: 1, subject: 'x', group: 'G' };
    expect(() => normalizeScheduleRow(row, '+14:01')).toThrow();
    expect(() => normalizeScheduleRow({ ...row, endTime: '08:00' }, '+06:00')).toThrow();
  });
  it('maps Moodle numeric group IDs explicitly and sends local-day epoch bounds', async () => {
    const getCalendarEvents = jest.fn().mockResolvedValue([{ id: 7, groupid: 101, timestart: Date.parse('2026-10-22T03:00:00Z') / 1000, timeduration: 5400, name: 'Математика' }]);
    const connector = new MoodleScheduleConnector({ getCalendarEvents } as unknown as MoodleConnectorService);
    const rows = await connector.fetchSchedule(university, { startDate: '2026-10-22', endDate: '2026-10-22', utcOffset: '+06:00' });
    expect(rows[0]).toMatchObject({ externalId: 'moodle:7', groupName: 'ИН-25', startTime: '09:00' });
    expect(getCalendarEvents.mock.calls[0].slice(1)).toEqual([[101], Date.parse('2026-10-21T18:00:00Z') / 1000, Date.parse('2026-10-22T17:59:59Z') / 1000]);
    getCalendarEvents.mockResolvedValue([{ id: 8, groupid: 999, timestart: 1, timeduration: 60, name: 'x' }]);
    await expect(connector.fetchSchedule(university, { startDate: '2026-10-22', endDate: '2026-10-22' })).rejects.toThrow('соответствия');
  });
  it('preserves SIBIT parser IDs and its existing local time conversion', async () => {
    const lesson = { lessonId: '987', groupId: '101', groupName: 'ИН-25', teacherId: '456', teacher: 'ФИО', date: '2026-10-22', startTime: '09:00', endTime: '10:30', pairNumber: 1, subject: 'x', room: '305' };
    const getCatalog = jest.fn().mockResolvedValue({ lessons: [lesson] });
    const rows = await new SibitScheduleConnector({ getCatalog } as unknown as RaspScraperService).fetchSchedule({ connectorType: 'sibit' } as University, {});
    expect(rows[0]).toMatchObject({ externalId: '987', groupExternalId: '101', sourceTeacherId: '456', startDate: new Date('2026-10-22T09:00:00').toISOString() });
  });
});
