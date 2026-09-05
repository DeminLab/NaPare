import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateLessonDto } from '../dto/create-lesson.dto';

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
        this.httpService.get(`${this.baseUrl}/schedule`, {
          params: {
            group,
            start: startDate,
            end: endDate,
          },
        }),
      );

      return this.mapToLessons(response.data);
    } catch (error) {
      this.logger.error(`Failed to fetch schedule from Sibit: ${error.message}`);
      throw error;
    }
  }

  async getGroups(): Promise<string[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/groups`),
      );

      return response.data.map((group: any) => group.name);
    } catch (error) {
      this.logger.error(`Failed to fetch groups from Sibit: ${error.message}`);
      throw error;
    }
  }

  async getTeachers(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/teachers`),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch teachers from Sibit: ${error.message}`);
      throw error;
    }
  }

  private mapToLessons(data: any[]): CreateLessonDto[] {
    return data.map((item) => ({
      date: new Date(item.date),
      pairNumber: item.pairNumber,
      startTime: item.startTime,
      endTime: item.endTime,
      subject: item.subject,
      subjectType: item.subjectType,
      teacherName: item.teacher,
      room: item.room,
      building: item.building,
      group: item.group,
      subgroup: item.subgroup,
      department: item.department,
      faculty: item.faculty,
      externalId: item.id?.toString(),
      source: 'sibit',
    }));
  }
}
