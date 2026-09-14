import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateLessonDto } from '../dto/create-lesson.dto';

interface SibitLesson {
  id?: string | number;
  groupId?: string;
  group?: string;
  date: string;
  startTime: string;
  endTime: string;
  pairNumber: number;
  subject: string;
  subjectType?: string;
  teacher?: string;
  teacherId?: string;
  room?: string;
  building?: string;
  subgroup?: string;
  department?: string;
  faculty?: string;
}

interface SibitGroup { name: string; }
interface SibitTeacher { id: string; name: string; }

@Injectable()
export class SibitConnectorService {
  private readonly logger = new Logger(SibitConnectorService.name);
  private readonly baseUrl = 'https://rasp.sibit.ru/api';

  constructor(private readonly httpService: HttpService) {}

  async getSchedule(
    group: string,
    startDate: string,
    endDate: string,
  ): Promise<CreateLessonDto[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<SibitLesson[]>(`${this.baseUrl}/schedule`, {
          params: {
            group,
            start: startDate,
            end: endDate,
          },
        }),
      );

      return this.mapToLessons(response.data, startDate, endDate);
    } catch (error) {
      this.logger.error(`Failed to fetch schedule from Sibit: ${errorMessage(error)}`);
      throw error;
    }
  }

  async getGroups(): Promise<string[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<SibitGroup[]>(`${this.baseUrl}/groups`),
      );

      return response.data.map((group) => group.name);
    } catch (error) {
      this.logger.error(`Failed to fetch groups from Sibit: ${errorMessage(error)}`);
      throw error;
    }
  }

  async getTeachers(): Promise<SibitTeacher[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<SibitTeacher[]>(`${this.baseUrl}/teachers`),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch teachers from Sibit: ${errorMessage(error)}`);
      throw error;
    }
  }

  private mapToLessons(data: SibitLesson[], startDate: string, endDate: string): CreateLessonDto[] {
    return data.map((item) => ({
      groupId: item.groupId || item.group || '',
      dayOfWeek: new Date(item.date).getDay(),
      startTime: item.startTime,
      endTime: item.endTime,
      pairNumber: item.pairNumber,
      subject: item.subject,
      subjectType: item.subjectType,
      teacherName: item.teacher,
      teacherId: item.teacherId,
      room: item.room,
      building: item.building,
      subgroup: item.subgroup,
      department: item.department,
      faculty: item.faculty,
      weekType: 'both',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      externalId: item.id?.toString(),
      source: 'sibit',
    }));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
