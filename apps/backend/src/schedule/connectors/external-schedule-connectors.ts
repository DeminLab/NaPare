import { BadRequestException, Injectable } from '@nestjs/common';
import { RaspScraperService } from '../../auth/rasp-scraper.service';
import { MoodleConnectionConfig, MoodleConnectorService } from '../../moodle/moodle-connector.service';
import { University } from '../../users/entities/university.entity';
import { normalizeScheduleRow, offsetMinutes } from './file-schedule-connectors';
import { NormalizedScheduleLesson, ScheduleConnector, ScheduleConnectorInput } from './schedule-connector';

@Injectable()
export class SibitScheduleConnector implements ScheduleConnector {
  constructor(private readonly rasp: RaspScraperService) {}

  async fetchSchedule(university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]> {
    if (!['sibit', 'rasp-sano', 'rasp_sano'].includes(university.connectorType)) throw new BadRequestException('Для вуза не выбран источник СИБИТ.');
    const catalog = await this.rasp.getCatalog();
    return catalog.lessons.filter(lesson => (!input.startDate || lesson.date >= input.startDate.slice(0, 10)) && (!input.endDate || lesson.date <= input.endDate.slice(0, 10))).map(lesson => ({
      externalId: lesson.lessonId, groupExternalId: lesson.groupId, groupName: lesson.groupName, subject: lesson.subject, localDate: lesson.date,
      // Preserve the original scraper/connector's local-time conversion and source identifiers.
      startDate: new Date(`${lesson.date}T${lesson.startTime}:00`).toISOString(), endDate: new Date(`${lesson.date}T${lesson.endTime}:00`).toISOString(),
      startTime: lesson.startTime, endTime: lesson.endTime, pairNumber: lesson.pairNumber,
      teacherName: lesson.teacher, sourceTeacherId: lesson.teacherId, room: lesson.room,
    }));
  }
}

@Injectable()
export class MoodleScheduleConnector implements ScheduleConnector {
  constructor(private readonly moodle: MoodleConnectorService) {}

  async fetchSchedule(university: University, input: ScheduleConnectorInput): Promise<NormalizedScheduleLesson[]> {
    if (university.connectorType !== 'moodle') throw new BadRequestException('Для вуза не выбран Moodle.');
    const config = university.connectorConfig || {};
    const mapping = config.scheduleGroupMap;
    const pairTimes = config.schedulePairTimes;
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || !pairTimes || typeof pairTimes !== 'object' || Array.isArray(pairTimes) || !input.startDate || !input.endDate) throw new BadRequestException('Moodle требует явные scheduleGroupMap (ID группы → имя группы НаПаре), schedulePairTimes (HH:mm → номер пары) и startDate/endDate.');
    for (const key of ['baseUrl', 'encryptedToken', 'tokenIv', 'tokenTag']) if (typeof config[key] !== 'string' || !config[key]) throw new BadRequestException('Сначала настройте защищённое подключение Moodle.');
    const groupMap = mapping as Record<string, unknown>;
    const ids = Object.keys(groupMap).map(Number);
    if (Object.values(groupMap).some(value => typeof value !== 'string' || !value.trim())) throw new BadRequestException('Некорректный scheduleGroupMap.');
    const offset = input.utcOffset || '+00:00';
    // Validate the offset with the same row rules before any external request.
    normalizeScheduleRow({ id: 'validation', group: 'validation', subject: 'validation', date: '2026-01-01', startTime: '09:00', endTime: '10:00', pairNumber: 1 }, offset);
    const from = Math.floor(new Date(input.startDate.slice(0, 10) + 'T00:00:00' + offset).getTime() / 1000);
    const to = Math.floor(new Date(input.endDate.slice(0, 10) + 'T23:59:59' + offset).getTime() / 1000);
    const events = await this.moodle.getCalendarEvents(config as unknown as MoodleConnectionConfig, ids, from, to);
    return events.map(event => {
      if (!Number.isSafeInteger(event.id) || !Number.isSafeInteger(event.timestart) || !Number.isSafeInteger(event.timeduration) || Number(event.timeduration) < 60 || Number(event.timeduration) > 86400 || event.modulename) throw new BadRequestException('Moodle: импортируются только групповые календарные занятия с ID, временем и длительностью; задания/модули не являются парами.');
      const group = groupMap[String(event.groupid)];
      if (typeof group !== 'string') throw new BadRequestException('Moodle вернул событие без явного соответствия группе; импорт остановлен.');
      const localStart = new Date((Number(event.timestart) + offsetMinutes(offset) * 60) * 1000).toISOString();
      const localEnd = new Date((Number(event.timestart) + Number(event.timeduration) + offsetMinutes(offset) * 60) * 1000).toISOString();
      if (localStart.slice(0, 10) !== localEnd.slice(0, 10) || localStart.slice(17, 23) !== '00.000' || localEnd.slice(17, 23) !== '00.000') throw new BadRequestException('Moodle: нужны занятия в одних локальных сутках с точностью до минуты.');
      return normalizeScheduleRow({ id: `moodle:${event.id}`, date: localStart.slice(0, 10), startTime: localStart.slice(11, 16), endTime: localEnd.slice(11, 16), pairNumber: (pairTimes as Record<string, unknown>)[localStart.slice(11, 16)], subject: event.name, group }, offset);
    });
  }
}
