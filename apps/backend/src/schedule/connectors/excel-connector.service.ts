import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { CreateLessonDto } from '../dto/create-lesson.dto';

@Injectable()
export class ExcelConnectorService {
  private readonly logger = new Logger(ExcelConnectorService.name);

  async parseExcelFile(fileBuffer: Buffer): Promise<CreateLessonDto[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet);

    return this.mapToLessons(data);
  }

  private mapToLessons(data: any[]): CreateLessonDto[] {
    return data.map((row) => {
      const date = this.parseDate(row['Дата'] || row['date']);
      return {
        groupId: row['Группа'] || row['group'] || '',
        dayOfWeek: date.getDay(),
        startTime: row['Начало'] || row['startTime'] || '09:00',
        endTime: row['Конец'] || row['endTime'] || '10:30',
        pairNumber: parseInt(row['Пара'] || row['pairNumber'], 10),
        subject: row['Предмет'] || row['subject'] || '',
        subjectType: row['Тип'] || row['subjectType'] || '',
        teacherName: row['Преподаватель'] || row['teacherName'] || '',
        room: row['Аудитория'] || row['room'] || '',
        building: row['Корпус'] || row['building'] || '',
        subgroup: row['Подгруппа'] || row['subgroup'] || '',
        department: row['Кафедра'] || row['department'] || '',
        faculty: row['Факультет'] || row['faculty'] || '',
        weekType: 'both',
        startDate: date,
        endDate: date,
      };
    });
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();

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
