import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Workbook } from 'exceljs';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CareerService } from './career.service';

type StateCount = { state: string; count: number };
export interface CareerUniversityReport {
  universityId: string;
  universityName: string;
  asOf: string;
  period: 'all_time';
  tasks: number;
  applications: number;
  acceptedWorks: number;
  byState: { tasks: StateCount[]; applications: StateCount[]; works: StateCount[] };
  limitations: string[];
}
const LIMITATIONS = [
  'Задачи вуза за всё время, включая черновики и закрытые задачи. Отклики и работы считаются по связанным задачам этого вуза.',
  'Принятая работа — результат со статусом «Принято» в карьерном модуле. Это не подтверждение официального трудоустройства, прохождения практики или выплаты.',
  'Здесь нет персонального списка студентов, контактных данных, текстов откликов и учебного досье. Учебный архив после удаления аккаунта может входить в агрегаты.',
];

@Injectable()
export class CareerReportService {
  constructor(private readonly db: DataSource, private readonly career: CareerService) {}

  async snapshot(actor: AuthenticatedUser): Promise<CareerUniversityReport> {
    const universityId = await this.career.assertCenterAccess(actor);
    return this.db.transaction('REPEATABLE READ', async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const [university] = await manager.query('SELECT name FROM universities WHERE id=$1', [universityId]);
      if (!university) throw new NotFoundException('Вуз не найден');
      const [time] = await manager.query('SELECT transaction_timestamp() AS at');
      const query = async (sql: string): Promise<StateCount[]> => {
        const rows: { state: string; count: string }[] = await manager.query(sql, [universityId]);
        return rows.map(row => {
          const count = Number(row.count);
          if (!Number.isSafeInteger(count) || count < 0) throw new Error('Report count exceeds safe integer range');
          return { state: row.state, count };
        });
      };
      const tasks = await query('SELECT state, count(*)::text AS count FROM career_task WHERE "universityId"=$1 GROUP BY state ORDER BY state');
      const applications = await query('SELECT application.state, count(*)::text AS count FROM career_application application JOIN career_task task ON task.id=application."taskId" WHERE task."universityId"=$1 GROUP BY application.state ORDER BY application.state');
      const works = await query('SELECT work.state, count(*)::text AS count FROM career_work work JOIN career_task task ON task.id=work."taskId" WHERE task."universityId"=$1 GROUP BY work.state ORDER BY work.state');
      const total = (rows: StateCount[]) => rows.reduce((sum, row) => sum + row.count, 0);
      return { universityId, universityName: university.name, asOf: new Date(time.at).toISOString(), period: 'all_time',
        tasks: total(tasks), applications: total(applications), acceptedWorks: works.find(row => row.state === 'accepted')?.count || 0,
        byState: { tasks, applications, works }, limitations: [...LIMITATIONS] };
    });
  }

  async workbook(report: CareerUniversityReport): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'НаПаре'; workbook.created = new Date(report.asOf);
    const summary = workbook.addWorksheet('Сводка', { views: [{ state: 'frozen', ySplit: 1 }] });
    summary.columns = [{ header: 'Показатель', key: 'name', width: 34 }, { header: 'Значение', key: 'value', width: 72 }];
    summary.addRows([
      { name: 'Вуз', value: report.universityName }, { name: 'Код вуза', value: report.universityId },
      { name: 'Снимок UTC', value: report.asOf }, { name: 'Период', value: 'За всё время' },
      { name: 'Задачи', value: report.tasks }, { name: 'Отклики', value: report.applications }, { name: 'Принятые работы', value: report.acceptedWorks },
      ...report.limitations.map(value => ({ name: 'Ограничение', value })),
    ]);
    const states = workbook.addWorksheet('Статусы');
    states.columns = [{ header: 'Набор', key: 'dataset', width: 22 }, { header: 'Статус', key: 'state', width: 24 }, { header: 'Число', key: 'count', width: 14 }];
    for (const [key, name] of [['tasks', 'Задачи'], ['applications', 'Отклики'], ['works', 'Работы']] as const) {
      states.addRows(report.byState[key].map(row => ({ dataset: name, ...row })));
    }
    for (const sheet of [summary, states]) {
      sheet.getRow(1).font = { bold: true };
      sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
