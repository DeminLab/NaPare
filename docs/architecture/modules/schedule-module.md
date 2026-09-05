# Backend Module: Schedule — Детальная реализация

## Структура модуля

```
apps/backend/src/schedule/
├── schedule.module.ts
├── schedule.controller.ts
├── schedule.service.ts
├── change-detector.service.ts
├── entities/
│   ├── lesson.entity.ts
│   ├── lesson-change.entity.ts
│   └── university.entity.ts
├── connectors/
│   ├── schedule-connector.interface.ts
│   ├── normalized-lesson.interface.ts
│   ├── excel.connector.ts
│   ├── sibit.connector.ts
│   └── connector.factory.ts
├── dto/
│   ├── schedule-query.dto.ts
│   ├── upload-schedule.dto.ts
│   └── schedule-response.dto.ts
└── interfaces/
    └── schedule-stats.interface.ts
```

## schedule.module.ts

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ChangeDetectorService } from './change-detector.service';
import { ConnectorFactory } from './connectors/connector.factory';
import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { University } from './entities/university.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, LessonChange, University]),
    AuthModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ScheduleController],
  providers: [
    ScheduleService,
    ChangeDetectorService,
    ConnectorFactory,
    EventEmitter2,
  ],
  exports: [ScheduleService],
})
export class ScheduleModule {}
```

## entities/lesson.entity.ts

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { University } from './university.entity';
import { Group } from '../../users/entities/group.entity';
import { Teacher } from '../../users/entities/teacher.entity';
import { PairSpace } from '../../pair-space/entities/pair-space.entity';
import { LessonChange } from './lesson-change.entity';

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'university_id' })
  @Index()
  universityId: string;

  @Column({ name: 'group_id' })
  @Index()
  groupId: string;

  @Column({ name: 'teacher_id', nullable: true })
  @Index()
  teacherId: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  room: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  building: string;

  @Column({ name: 'day_of_week', type: 'int' })
  dayOfWeek: number; // 1-7 (Пн-Вс)

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // HH:MM

  @Column({ name: 'end_time', type: 'time' })
  endTime: string; // HH:MM

  @Column({ name: 'week_type', type: 'varchar', length: 20, default: 'both' })
  weekType: 'odd' | 'even' | 'both';

  @Column({ name: 'start_date', type: 'date' })
  startDate: string; // YYYY-MM-DD

  @Column({ name: 'end_date', type: 'date' })
  endDate: string; // YYYY-MM-DD

  @Column({ name: 'is_cancelled', type: 'boolean', default: false })
  isCancelled: boolean;

  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  @Index()
  externalId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Связи
  @ManyToOne(() => University, (university) => university.lessons)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @ManyToOne(() => Group, (group) => group.lessons)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => Teacher, (teacher) => teacher.lessons, { nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  @OneToMany(() => PairSpace, (pairSpace) => pairSpace.lesson)
  pairSpaces: PairSpace[];

  @OneToMany(() => LessonChange, (change) => change.lesson)
  changes: LessonChange[];
}
```

## entities/lesson-change.entity.ts

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { Lesson } from './lesson.entity';

@Entity('lesson_changes')
export class LessonChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lesson_id' })
  @Index()
  lessonId: string;

  @Column({ name: 'change_type', type: 'varchar', length: 20 })
  changeType: 'moved' | 'cancelled' | 'room_changed' | 'teacher_changed' | 'added';

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, unknown>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, unknown>;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Связи
  @ManyToOne(() => Lesson, (lesson) => lesson.changes)
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;
}
```

## schedule.service.ts

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { ChangeDetectorService } from './change-detector.service';
import { ConnectorFactory } from './connectors/connector.factory';
import { NormalizedLesson } from './connectors/normalized-lesson.interface';
import { ScheduleQuery } from './dto/schedule-query.dto';
import { ScheduleChangedEvent } from '../notifications/events/schedule-changed.event';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonChange)
    private readonly lessonChangeRepository: Repository<LessonChange>,
    private readonly changeDetector: ChangeDetectorService,
    private readonly connectorFactory: ConnectorFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Получение расписания для пользователя
   */
  async getMySchedule(userId: string, universityId: string, query: ScheduleQuery): Promise<Lesson[]> {
    const { startDate, endDate, groupId } = query;

    const lessons = await this.lessonRepository.find({
      where: {
        universityId,
        groupId: groupId || undefined,
        startDate: Between(startDate, endDate),
        endDate: Between(startDate, endDate),
        isCancelled: false,
      },
      relations: ['group', 'teacher', 'changes'],
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });

    return lessons;
  }

  /**
   * Получение деталей пары
   */
  async getLessonById(lessonId: string, universityId: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, universityId },
      relations: ['group', 'teacher', 'changes', 'pairSpaces'],
    });

    if (!lesson) {
      throw new NotFoundException('Пара не найдена');
    }

    return lesson;
  }

  /**
   * Загрузка расписания из файла
   */
  async uploadSchedule(
    universityId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ imported: number; changes: number }> {
    // Получение коннектора для вуза
    const connector = this.connectorFactory.getConnector(universityId, 'excel');

    // Парсинг файла
    const normalizedLessons = await connector.parseFile(file);

    // Импорт с детектом изменений
    return this.importSchedule(universityId, normalizedLessons, userId);
  }

  /**
   * Импорт расписания
   */
  async importSchedule(
    universityId: string,
    lessons: NormalizedLesson[],
    userId: string,
  ): Promise<{ imported: number; changes: number }> {
    let imported = 0;
    let changes = 0;

    for (const normalizedLesson of lessons) {
      // Поиск существующей пары
      const existingLesson = await this.lessonRepository.findOne({
        where: {
          universityId,
          externalId: normalizedLesson.externalId,
        },
      });

      if (existingLesson) {
        // Детект изменений
        const detectedChanges = this.changeDetector.detectChanges(
          existingLesson,
          normalizedLesson,
        );

        if (detectedChanges.length > 0) {
          // Сохранение изменений
          for (const change of detectedChanges) {
            await this.saveLessonChange(existingLesson.id, change, userId);
            changes++;
          }

          // Обновление пары
          Object.assign(existingLesson, normalizedLesson);
          await this.lessonRepository.save(existingLesson);
        }
      } else {
        // Создание новой пары
        const newLesson = this.lessonRepository.create({
          universityId,
          groupId: normalizedLesson.groupId,
          teacherId: normalizedLesson.teacherId,
          subject: normalizedLesson.subject,
          room: normalizedLesson.room,
          dayOfWeek: normalizedLesson.dayOfWeek,
          startTime: normalizedLesson.startTime,
          endTime: normalizedLesson.endTime,
          weekType: normalizedLesson.weekType,
          startDate: normalizedLesson.startDate,
          endDate: normalizedLesson.endDate,
          externalId: normalizedLesson.externalId,
        });

        await this.lessonRepository.save(newLesson);
        imported++;

        // Создание изменения "added"
        await this.saveLessonChange(newLesson.id, {
          changeType: 'added',
          newValues: normalizedLesson,
        }, userId);
      }
    }

    // Отправка события об изменениях
    if (changes > 0) {
      this.eventEmitter.emit('schedule.changed', new ScheduleChangedEvent(
        universityId,
        changes,
      ));
    }

    return { imported, changes };
  }

  /**
   * Сохранение изменения пары
   */
  private async saveLessonChange(
    lessonId: string,
    changeData: {
      changeType: string;
      oldValues?: Record<string, unknown>;
      newValues?: Record<string, unknown>;
    },
    userId: string,
  ): Promise<LessonChange> {
    const change = this.lessonChangeRepository.create({
      lessonId,
      changeType: changeData.changeType as any,
      oldValues: changeData.oldValues,
      newValues: changeData.newValues,
      createdBy: userId,
    });

    return this.lessonChangeRepository.save(change);
  }

  /**
   * Получение изменений пары
   */
  async getLessonChanges(lessonId: string, universityId: string): Promise<LessonChange[]> {
    // Проверка существования пары
    await this.getLessonById(lessonId, universityId);

    return this.lessonChangeRepository.find({
      where: { lessonId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Ручной запуск синхронизации
   */
  async syncSchedule(universityId: string): Promise<{ synced: number }> {
    const connector = this.connectorFactory.getConnector(universityId, 'auto');
    const lessons = await connector.fetchSchedule({
      from: new Date(),
      to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
    });

    const result = await this.importSchedule(universityId, lessons, 'system');
    return { synced: result.imported + result.changes };
  }
}
```

## change-detector.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Lesson } from './entities/lesson.entity';
import { NormalizedLesson } from './connectors/normalized-lesson.interface';
import { LessonChangeType } from '../shared/constants/change-types';

export interface DetectedChange {
  changeType: LessonChangeType;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

@Injectable()
export class ChangeDetectorService {
  /**
   * Детект изменений между существующей и новой парой
   */
  detectChanges(existing: Lesson, updated: NormalizedLesson): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Проверка дня недели и времени (перенос)
    if (
      existing.dayOfWeek !== updated.dayOfWeek ||
      existing.startTime !== updated.startTime ||
      existing.endTime !== updated.endTime
    ) {
      changes.push({
        changeType: 'moved',
        field: 'schedule',
        oldValue: {
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
        },
        newValue: {
          dayOfWeek: updated.dayOfWeek,
          startTime: updated.startTime,
          endTime: updated.endTime,
        },
      });
    }

    // Проверка аудитории
    if (existing.room !== updated.room) {
      changes.push({
        changeType: 'room_changed',
        field: 'room',
        oldValue: existing.room,
        newValue: updated.room,
      });
    }

    // Проверка преподавателя
    if (existing.teacherId !== updated.teacherId) {
      changes.push({
        changeType: 'teacher_changed',
        field: 'teacherId',
        oldValue: existing.teacherId,
        newValue: updated.teacherId,
      });
    }

    // Проверка отмены
    if (existing.isCancelled && !updated.isCancelled) {
      changes.push({
        changeType: 'added',
        field: 'isCancelled',
        oldValue: true,
        newValue: false,
      });
    }

    return changes;
  }
}
```

## connectors/schedule-connector.interface.ts

```typescript
import { NormalizedLesson } from './normalized-lesson.interface';

export interface ScheduleConnector {
  id: string;
  name: string;
  universityId: string;

  /**
   * Получение расписания из внешнего источника
   */
  fetchSchedule(period: { from: Date; to: Date }): Promise<NormalizedLesson[]>;

  /**
   * Парсинг загруженного файла
   */
  parseFile(file: Express.Multer.File): Promise<NormalizedLesson[]>;

  /**
   * Проверка работоспособности коннектора
   */
  healthCheck(): Promise<{ ok: boolean; lastSuccessAt?: Date; error?: string }>;
}
```

## connectors/normalized-lesson.interface.ts

```typescript
export interface NormalizedLesson {
  externalId: string;        // ID во внешней системе
  universityId: string;
  groupId: string;
  teacherId?: string;
  subject: string;
  room?: string;
  building?: string;
  dayOfWeek: number;         // 1=Пн, 7=Вс
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  weekType: 'odd' | 'even' | 'both';
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
}
```

## connectors/excel.connector.ts

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { ScheduleConnector } from './schedule-connector.interface';
import { NormalizedLesson } from './normalized-lesson.interface';

@Injectable()
export class ExcelConnector implements ScheduleConnector {
  id = 'excel';
  name = 'Excel/CSV импорт';
  universityId: string;

  constructor(universityId: string) {
    this.universityId = universityId;
  }

  async fetchSchedule(): Promise<NormalizedLesson[]> {
    throw new BadRequestException('Excel коннектор не поддерживает fetchSchedule');
  }

  async parseFile(file: Express.Multer.File): Promise<NormalizedLesson[]> {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map((row: any, index) => this.mapRowToLesson(row, index));
  }

  private mapRowToLesson(row: any, index: number): NormalizedLesson {
    // Маппинг колонок (настраивается для каждого вуза)
    return {
      externalId: `excel-${index}`,
      universityId: this.universityId,
      groupId: row['Группа'] || row['group'],
      subject: row['Предмет'] || row['subject'],
      room: row['Аудитория'] || row['room'],
      dayOfWeek: this.parseDayOfWeek(row['День недели'] || row['day']),
      startTime: row['Начало'] || row['start_time'],
      endTime: row['Конец'] || row['end_time'],
      weekType: this.parseWeekType(row['Неделя'] || row['week']),
      startDate: row['Дата начала'] || row['start_date'],
      endDate: row['Дата окончания'] || row['end_date'],
    };
  }

  private parseDayOfWeek(day: string | number): number {
    if (typeof day === 'number') return day;

    const days: Record<string, number> = {
      'понедельник': 1, 'пн': 1,
      'вторник': 2, 'вт': 2,
      'среда': 3, 'ср': 3,
      'четверг': 4, 'чт': 4,
      'пятница': 5, 'пт': 5,
      'суббота': 6, 'сб': 6,
      'воскресенье': 7, 'вс': 7,
    };

    return days[day.toLowerCase()] || 1;
  }

  private parseWeekType(week: string): 'odd' | 'even' | 'both' {
    if (!week) return 'both';

    const lower = week.toLowerCase();
    if (lower.includes('нечёт') || lower.includes('нечет') || lower === 'odd') {
      return 'odd';
    }
    if (lower.includes('чёт') || lower.includes('чет') || lower === 'even') {
      return 'even';
    }
    return 'both';
  }

  async healthCheck() {
    return { ok: true };
  }
}
```

## connectors/connector.factory.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScheduleConnector } from './schedule-connector.interface';
import { ExcelConnector } from './excel.connector';
import { SibitConnector } from './sibit.connector';
import { University } from '../entities/university.entity';

@Injectable()
export class ConnectorFactory {
  constructor(
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
  ) {}

  /**
   * Получение коннектора для вуза
   */
  async getConnector(universityId: string, type: string = 'auto'): Promise<ScheduleConnector> {
    const university = await this.universityRepository.findOne({
      where: { id: universityId },
    });

    if (!university) {
      throw new Error('Вуз не найден');
    }

    const config = university.connectorConfig as any;

    if (type === 'auto') {
      type = config?.type || 'excel';
    }

    switch (type) {
      case 'sibit':
        return new SibitConnector(universityId, config?.sibitUrl);
      case 'excel':
      default:
        return new ExcelConnector(universityId);
    }
  }
}
```

## schedule.controller.ts

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

import { ScheduleService } from './schedule.service';
import { ScheduleQuery } from './dto/schedule-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UniversityGuard } from '../common/guards/university.guard';

@ApiTags('Schedule')
@Controller('api/v1/schedule')
@UseGuards(JwtAuthGuard, UniversityGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить персональное расписание' })
  async getMySchedule(
    @CurrentUser() user: any,
    @Query() query: ScheduleQuery,
  ) {
    return this.scheduleService.getMySchedule(user.userId, user.universityId, query);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Получить детали пары' })
  async getLessonById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.scheduleService.getLessonById(id, user.universityId);
  }

  @Get('lessons/:id/changes')
  @ApiOperation({ summary: 'Получить историю изменений пары' })
  async getLessonChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.scheduleService.getLessonChanges(id, user.universityId);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles('university_admin', 'department_head')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Загрузить расписание из файла' })
  @ApiConsumes('multipart/form-data')
  async uploadSchedule(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.scheduleService.uploadSchedule(user.universityId, file, user.userId);
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles('university_admin', 'superadmin')
  @ApiOperation({ summary: 'Ручной запуск синхронизации' })
  async syncSchedule(@CurrentUser() user: any) {
    return this.scheduleService.syncSchedule(user.universityId);
  }
}
```

## DTO

```typescript
// dto/schedule-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsUUID } from 'class-validator';

export class ScheduleQuery {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
```

## Тесты

```typescript
// schedule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ScheduleService } from './schedule.service';
import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { ChangeDetectorService } from './change-detector.service';
import { ConnectorFactory } from './connectors/connector.factory';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let lessonRepository: Repository<Lesson>;

  const mockLesson = {
    id: 'uuid-lesson',
    universityId: 'uuid-university',
    groupId: 'uuid-group',
    subject: 'Математика',
    room: '305',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:30',
    weekType: 'both',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    isCancelled: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: getRepositoryToken(Lesson),
          useValue: {
            find: jest.fn().mockResolvedValue([mockLesson]),
            findOne: jest.fn().mockResolvedValue(mockLesson),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LessonChange),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ChangeDetectorService,
          useValue: {
            detectChanges: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: ConnectorFactory,
          useValue: {
            getConnector: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    lessonRepository = module.get(getRepositoryToken(Lesson));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMySchedule', () => {
    it('should return lessons for user', async () => {
      const result = await service.getMySchedule(
        'uuid-user',
        'uuid-university',
        { startDate: '2026-09-01', endDate: '2026-09-30' },
      );

      expect(result).toEqual([mockLesson]);
      expect(lessonRepository.find).toHaveBeenCalled();
    });
  });

  describe('getLessonById', () => {
    it('should return lesson by id', async () => {
      const result = await service.getLessonById('uuid-lesson', 'uuid-university');
      expect(result).toEqual(mockLesson);
    });

    it('should throw if lesson not found', async () => {
      jest.spyOn(lessonRepository, 'findOne').mockResolvedValue(null);
      
      await expect(
        service.getLessonById('nonexistent', 'uuid-university'),
      ).rejects.toThrow('Пара не найдена');
    });
  });
});
```