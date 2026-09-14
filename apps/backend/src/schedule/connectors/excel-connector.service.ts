import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { CreateLessonDto } from '../dto/create-lesson.dto';

type SpreadsheetCell = string | number | Date | undefined;
type SpreadsheetRow = Record<string, SpreadsheetCell>;

@Injectable()
export class ExcelConnectorService {
  private readonly logger = new Logger(ExcelConnectorService.name);

  async parseExcelFile(fileBuffer: Buffer): Promise<CreateLessonDto[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet);

    return this.mapToLessons(data);
  }

  private mapToLessons(data: SpreadsheetRow[]): CreateLessonDto[] {
    return data.map((row) => {
      const date = this.parseDate(row['Дата'] || row['date']);
      return {
        groupId: stringCell(row['Группа'] ?? row['group']),
        dayOfWeek: date.getDay(),
        startTime: stringCell(row['Начало'] ?? row['startTime'], '09:00'),
        endTime: stringCell(row['Конец'] ?? row['endTime'], '10:30'),
        pairNumber: Number.parseInt(stringCell(row['Пара'] ?? row['pairNumber']), 10),
        subject: stringCell(row['Предмет'] ?? row['subject']),
        subjectType: stringCell(row['Тип'] ?? row['subjectType']),
        teacherName: stringCell(row['Преподаватель'] ?? row['teacherName']),
        room: stringCell(row['Аудитория'] ?? row['room']),
        building: stringCell(row['Корпус'] ?? row['building']),
        subgroup: stringCell(row['Подгруппа'] ?? row['subgroup']),
        department: stringCell(row['Кафедра'] ?? row['department']),
        faculty: stringCell(row['Факультет'] ?? row['faculty']),
        weekType: 'both',
        startDate: date,
        endDate: date,
      };
    });
  }

  private parseDate(value: SpreadsheetCell): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;

    const dateStr = String(value);
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    const parts = dateStr.split('.');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }

    return new Date();
  }
}

function stringCell(value: SpreadsheetCell, fallback = ''): string {
  return value === undefined ? fallback : String(value);
}
