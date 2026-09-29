import { Repository } from 'typeorm';

import { EventBusService } from '../events/event-bus.service';
import { Homework } from '../pair-space/entities/homework.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { HomeworkDeadlineReminderService } from './homework-deadline-reminder.service';

describe('HomeworkDeadlineReminderService', () => {
  let homeworkRepository: jest.Mocked<Pick<Repository<Homework>, 'find'>>;
  let lessonRepository: jest.Mocked<Pick<Repository<Lesson>, 'find'>>;
  let eventBus: jest.Mocked<Pick<EventBusService, 'publish'>>;
  let service: HomeworkDeadlineReminderService;

  beforeEach(() => {
    homeworkRepository = { find: jest.fn() };
    lessonRepository = { find: jest.fn() };
    eventBus = { publish: jest.fn().mockResolvedValue({} as never) };
    service = new HomeworkDeadlineReminderService(
      homeworkRepository as unknown as Repository<Homework>,
      lessonRepository as unknown as Repository<Lesson>,
      eventBus as unknown as EventBusService,
    );
  });

  it('publishes an idempotent reminder for an active pair space and its group', async () => {
    const now = new Date('2026-09-28T06:00:00.000Z');
    const deadline = new Date('2026-09-28T12:00:00.000Z');
    homeworkRepository.find.mockResolvedValue([{
      id: 'homework-1', title: 'Подготовить доклад', deadline, isCompleted: false,
      pairSpace: { id: 'pair-space-1', isActive: true, lessonId: 'lesson-1', universityId: 'university-1', subject: 'История' },
    } as Homework]);
    lessonRepository.find.mockResolvedValue([{
      id: 'lesson-1', universityId: 'university-1', groupId: 'group-1', groupName: 'ИС-21', teacherId: 'teacher-1',
    } as Lesson]);

    await service.checkDueDeadlines(now);
    await service.checkDueDeadlines(now);

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'homework.deadline_soon',
      idempotencyKey: `homework-deadline:homework-1:${deadline.toISOString()}`,
      universityId: 'university-1',
      priority: 'high',
      payload: expect.objectContaining({
        groupId: 'group-1', teacherId: 'teacher-1', homeworkTitle: 'Подготовить доклад',
        deepLink: '/pair-space/lesson-1',
      }),
    }));
  });

  it('skips inactive spaces and lessons from another university', async () => {
    homeworkRepository.find.mockResolvedValue([
      { id: 'homework-inactive', deadline: new Date('2026-09-28T08:00:00Z'), pairSpace: { id: 'pair-inactive', isActive: false, lessonId: 'lesson-1', universityId: 'university-1' } },
      { id: 'homework-foreign', deadline: new Date('2026-09-28T08:00:00Z'), pairSpace: { id: 'pair-active', isActive: true, lessonId: 'lesson-2', universityId: 'university-1' } },
    ] as Homework[]);
    lessonRepository.find.mockResolvedValue([
      { id: 'lesson-2', universityId: 'university-2', groupId: 'group-2' },
    ] as Lesson[]);

    await service.checkDueDeadlines(new Date('2026-09-28T06:00:00Z'));

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('continues scanning after an individual publish failure', async () => {
    const deadline = new Date('2026-09-28T18:00:00Z');
    homeworkRepository.find.mockResolvedValue(['homework-1', 'homework-2'].map((id) => ({
      id, title: id, deadline, isCompleted: false,
      pairSpace: { id: `pair-${id}`, isActive: true, lessonId: 'lesson-1', universityId: 'university-1', subject: 'История' },
    } as Homework)));
    lessonRepository.find.mockResolvedValue([{ id: 'lesson-1', universityId: 'university-1', groupId: 'group-1' } as Lesson]);
    eventBus.publish.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce({} as never);

    await service.checkDueDeadlines(new Date('2026-09-28T06:00:00Z'));

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });
});
