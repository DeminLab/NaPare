import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  it('returns the persisted event for an idempotent retry', async () => {
    const existing = {
      id: 'event-1',
      type: 'lesson.changed',
      actor: { type: 'system' },
      timestamp: new Date('2026-09-19T10:00:00.000Z'),
      universityId: 'university-1',
      idempotencyKey: 'change-1',
      target: { type: 'lesson_occurrence', id: 'occurrence-1' },
      payload: { occurrenceId: 'occurrence-1' },
      priority: 'normal',
      recipients: null,
    };
    const repository = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new EventBusService(repository as never, { emit: jest.fn() } as never);

    const result = await service.publish({
      type: 'lesson.changed',
      idempotencyKey: 'change-1',
      universityId: 'university-1',
      target: { type: 'lesson_occurrence', id: 'occurrence-1' },
      payload: { occurrenceId: 'occurrence-1' },
    });

    expect(result.id).toBe('event-1');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
