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

  it('sanitizes persisted fields before writing them into the SSE protocol', async () => {
    const record = {
      id: 'event-id\r\nretry:0',
      type: 'lesson.changed\nevent:spoofed',
      actor: { type: 'system' },
      timestamp: new Date('2026-10-17T00:00:00.000Z'),
      universityId: 'university-1',
      idempotencyKey: null,
      target: { type: 'lesson_occurrence', id: 'occurrence-1' },
      payload: { occurrenceId: 'occurrence-1' },
      priority: 'normal',
      recipients: null,
    };
    const repository = {
      find: jest.fn().mockResolvedValue([record]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new EventBusService(repository as never, { emit: jest.fn() } as never);
    const messages: Array<{ id: string; type: string }> = [];
    const subscription = service.stream('user-1', 'university-1').subscribe((message) => messages.push(message));

    await new Promise((resolve) => setTimeout(resolve, 0));
    subscription.unsubscribe();

    expect(messages[0]).toEqual({ id: 'event-idretry:0', type: 'unknown', data: expect.any(Object) });
  });
});
