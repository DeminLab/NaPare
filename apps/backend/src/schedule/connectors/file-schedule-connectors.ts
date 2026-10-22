import { BadRequestException, Injectable } from '@nestjs/common';
import { createInflateRaw } from 'node:zlib';
import type ICALTypes from 'ical.js';
import { Workbook } from 'exceljs';
import { University } from '../../users/entities/university.entity';
import { NormalizedScheduleLesson, ScheduleConnector, ScheduleConnectorInput } from './schedule-connector';

const ICAL: typeof ICALTypes = require('ical.js');

export const MAX_IMPORT_ROWS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const HEADERS = ['id', 'date', 'startTime', 'endTime', 'pairNumber', 'subject', 'group', 'teacher', 'room', 'status'];
const REQUIRED = HEADERS.slice(0, 7);

export function textFile(content: string | undefined): string {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new BadRequestException('Файл должен быть текстом не больше 2 MiB.');
  return content.replace(/^\uFEFF/, '');
}

export function normalizeScheduleRow(row: Record<string, unknown>, offset: string, fallbackId?: string): NormalizedScheduleLesson {
  const value = (key: string) => typeof row[key] === 'string' || typeof row[key] === 'number' ? String(row[key]).trim() : '';
  const date = value('date');
  const time = (key: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value(key));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time('startTime') || !time('endTime') || !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset) || Math.abs(offsetMinutes(offset)) > 840) throw new BadRequestException('Некорректная дата, время или utcOffset.');
  const dateCheck = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(dateCheck.getTime()) || dateCheck.toISOString().slice(0, 10) !== date) throw new BadRequestException('Несуществующая дата занятия.');
  const start = new Date(`${date}T${value('startTime')}:00${offset}`);
  const end = new Date(`${date}T${value('endTime')}:00${offset}`);
  const pairNumber = Number(value('pairNumber'));
  const id = value('id') || fallbackId || '';
  if (!id || id.length > 200 || !value('subject') || value('subject').length > 500 || !value('group') || value('group').length > 200 || !Number.isInteger(pairNumber) || pairNumber < 1 || pairNumber > 30 || end <= start) throw new BadRequestException('Для занятия нужны стабильный id, группа, предмет, номер пары 1–30 и время окончания позже начала.');
  if (value('status') && !['scheduled', 'cancelled'].includes(value('status'))) throw new BadRequestException('status должен быть scheduled или cancelled.');
  for (const key of ['teacher', 'room']) if (value(key).length > 500) throw new BadRequestException(`Слишком длинное поле ${key}.`);
  return { externalId: id, groupName: value('group'), subject: value('subject'), startDate: start.toISOString(), endDate: end.toISOString(), startTime: value('startTime'), endTime: value('endTime'), pairNumber, teacherName: value('teacher') || undefined, room: value('room') || undefined, cancelled: value('status') === 'cancelled' };
}

export function offsetMinutes(offset: string): number {
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  return (offset.startsWith('-') ? -1 : 1) * (hours * 60 + minutes);
}

function tableRows(table: string[][], offset: string): NormalizedScheduleLesson[] {
  if (table.length === 0) throw new BadRequestException('Пустой файл: отсутствует строка заголовков.');
  const headers = table[0].map(value => value.trim());
  if (new Set(headers).size !== headers.length || headers.some(header => !HEADERS.includes(header)) || REQUIRED.some(header => !headers.includes(header))) throw new BadRequestException(`Нужны заголовки ${REQUIRED.join(', ')}; неизвестные/повторные колонки запрещены.`);
  const records = table.slice(1).filter(row => row.some(value => value !== ''));
  if (records.length > MAX_IMPORT_ROWS) throw new BadRequestException('Не больше 1000 занятий за импорт.');
  return records.map((row, index) => {
    if (row.length !== headers.length) throw new BadRequestException(`Строка ${index + 2}: число ячеек не совпадает с заголовками.`);
    return normalizeScheduleRow(Object.fromEntries(headers.map((header, cell) => [header, row[cell]])), offset);
  });
}

@Injectable()
export class CsvScheduleConnector implements ScheduleConnector {
  async fetchSchedule(_university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]> {
    const text = textFile(input.content);
    const delimiter = text.slice(0, text.search(/[\r\n]/) < 0 ? text.length : text.search(/[\r\n]/)).includes(';') ? ';' : ',';
    const table: string[][] = [];
    let row: string[] = [], cell = '', quoted = false, closed = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
        else if (char === '"') { quoted = false; closed = true; }
        else cell += char;
      } else if (char === '"') {
        if (cell || closed) throw new BadRequestException('Некорректные кавычки CSV.');
        quoted = true;
      } else if (char === delimiter) { row.push(cell); cell = ''; closed = false; }
      else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[index + 1] === '\n') index++;
        row.push(cell); table.push(row); row = []; cell = ''; closed = false;
        if (table.length > MAX_IMPORT_ROWS + 2) throw new BadRequestException('Не больше 1000 занятий за импорт.');
      } else {
        if (closed) throw new BadRequestException('Лишний символ после кавычки CSV.');
        cell += char;
      }
    }
    if (quoted) throw new BadRequestException('Незакрытые кавычки CSV.');
    if (cell || row.length || closed) { row.push(cell); table.push(row); }
    return tableRows(table, input.utcOffset || '+00:00');
  }
}

@Injectable()
export class IcsScheduleConnector implements ScheduleConnector {
  async fetchSchedule(_university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]> {
    try {
      const calendar = new ICAL.Component(ICAL.parse(textFile(input.content)));
      if (calendar.name !== 'vcalendar') throw new BadRequestException('Нужен VCALENDAR.');
      const results: NormalizedScheduleLesson[] = [];
      const events = calendar.getAllSubcomponents('vevent');
      if (events.length > MAX_IMPORT_ROWS) throw new BadRequestException('Не больше 1000 VEVENT.');
      for (const component of events) {
        const event = new ICAL.Event(component);
        for (const name of ['dtstart', 'dtend']) {
          const property = component.getFirstProperty(name);
          const value = property?.getFirstValue() as InstanceType<typeof ICAL.Time> | undefined;
          if (!value || value.isDate || value.zone !== ICAL.Timezone.utcTimezone || property?.getParameter('tzid')) throw new BadRequestException('ICS: DTSTART/DTEND должны быть UTC DATE-TIME с Z; floating/TZID/date-only не поддерживаются. Экспортируйте UTC.');
        }
        if (!event.uid || !event.summary || component.hasProperty('recurrence-id')) throw new BadRequestException('ICS: нужны UID/SUMMARY; RECURRENCE-ID overrides нужно развернуть в отдельные события.');
        if (event.isRecurring() && (!input.startDate || !input.endDate)) throw new BadRequestException('ICS RRULE требует явного диапазона startDate/endDate.');
        const group = String(component.getFirstPropertyValue('x-napare-group') || input.groupName || '').trim();
        const pair = Number(component.getFirstPropertyValue('x-napare-pair-number') || input.pairNumber);
        const iterator = event.iterator();
        let steps = 0;
        while (true) {
          if (++steps > 10000) throw new BadRequestException('ICS recurrence: превышен предел 10000 шагов. Разверните события за нужный период.');
          const occurrence = iterator.next();
          if (!occurrence) break;
          const details = event.getOccurrenceDetails(occurrence);
          const start = details.startDate.toJSDate().toISOString(), end = details.endDate.toJSDate().toISOString();
          if (start.slice(0, 10) !== end.slice(0, 10) || start.slice(17, 23) !== '00.000' || end.slice(17, 23) !== '00.000') throw new BadRequestException('ICS: нужны занятия в пределах одних UTC суток с точностью до минуты.');
          if (input.endDate && start.slice(0, 10) > input.endDate.slice(0, 10)) break;
          if (!input.startDate || start.slice(0, 10) >= input.startDate.slice(0, 10)) {
            results.push(normalizeScheduleRow({ id: event.isRecurring() ? `${event.uid}@${occurrence.toString()}` : event.uid, date: start.slice(0, 10), startTime: start.slice(11, 16), endTime: end.slice(11, 16), pairNumber: pair, subject: event.summary, group, teacher: component.getFirstPropertyValue('x-napare-teacher') || '', room: event.location || '', status: component.getFirstPropertyValue('status') === 'CANCELLED' ? 'cancelled' : 'scheduled' }, '+00:00'));
            if (results.length > MAX_IMPORT_ROWS) throw new BadRequestException('Не больше 1000 занятий за импорт.');
          }
          if (!event.isRecurring()) break;
        }
      }
      return results;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Некорректный календарь ICS.');
    }
  }
}

/** Verify actual inflated bytes before ExcelJS opens XML, including forged ZIP size metadata. */
async function validateWorkbookArchive(buffer: Buffer): Promise<void> {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index--) if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  if (eocd < 0 || buffer.readUInt16LE(eocd + 4) || buffer.readUInt16LE(eocd + 6)) throw new BadRequestException('Нужен обычный однодисковый XLSX ZIP.');
  const entries = buffer.readUInt16LE(eocd + 10);
  if (entries > 100) throw new BadRequestException('XLSX: слишком много ZIP entries.');
  let cursor = buffer.readUInt32LE(eocd + 16), total = 0;
  const names = new Set<string>();
  for (let entry = 0; entry < entries; entry++) {
    if (cursor + 46 > eocd || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new BadRequestException('Повреждённый ZIP directory.');
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10), compressed = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28), extraLength = buffer.readUInt16LE(cursor + 30), commentLength = buffer.readUInt16LE(cursor + 32), local = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (flags & 1 || ![0, 8].includes(method) || size > 8 * 1024 * 1024 || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50 || names.has(name) || name.split('/').includes('..')) throw new BadRequestException('XLSX: неподдерживаемый, повторный или слишком большой ZIP entry.');
    names.add(name);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > buffer.length) throw new BadRequestException('Повреждённый XLSX ZIP entry.');
    const data = buffer.subarray(start, start + compressed);
    let actual = 0;
    if (method === 0) { actual = data.length; total += actual; }
    else await new Promise<void>((resolve, reject) => {
      const stream = createInflateRaw();
      stream.on('data', chunk => { actual += chunk.length; total += chunk.length; if (total > 8 * 1024 * 1024) stream.destroy(new Error('XLSX inflate limit')); });
      stream.on('error', reject); stream.on('end', resolve); stream.end(data);
    });
    if (actual !== size || total > 8 * 1024 * 1024) throw new BadRequestException('XLSX: превышен лимит распакованного файла 8 MiB или неверный размер.');
    cursor += 46 + nameLength + extraLength + commentLength;
  }
}

@Injectable()
export class XlsxScheduleConnector implements ScheduleConnector {
  async fetchSchedule(_university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]> {
    try {
      if (!input.content || input.content.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.content)) throw new BadRequestException('XLSX должен быть base64 без data URL, не больше 2 MiB.');
      const bytes = Buffer.from(input.content, 'base64');
      if (bytes.length > MAX_FILE_BYTES) throw new BadRequestException('XLSX больше 2 MiB.');
      await validateWorkbookArchive(bytes);
      const workbook = new Workbook();
      await workbook.xlsx.load(bytes as never);
      const sheets = workbook.worksheets.filter(sheet => sheet.rowCount > 0);
      if (sheets.length !== 1 || sheets[0].rowCount > MAX_IMPORT_ROWS + 1 || sheets[0].columnCount > HEADERS.length) throw new BadRequestException('Нужен один непустой лист, до 1000 занятий и 10 колонок.');
      const table: string[][] = [];
      sheets[0].eachRow({ includeEmpty: true }, row => {
        const values: string[] = [];
        for (let column = 1; column <= sheets[0].columnCount; column++) {
          const value = row.getCell(column).value;
          if (value !== null && typeof value !== 'string' && typeof value !== 'number') throw new BadRequestException('XLSX: используйте текст и числа; даты — YYYY-MM-DD, время — HH:mm; формулы, ссылки и объекты не принимаются.');
          values.push(value === null ? '' : String(value));
        }
        table.push(values);
      });
      return tableRows(table, input.utcOffset || '+00:00');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Некорректный или слишком большой XLSX.');
    }
  }
}
