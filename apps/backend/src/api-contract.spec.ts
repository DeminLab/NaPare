import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { ScheduleController } from './schedule/schedule.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { PaginationQueryDto } from './common/dto/pagination-query.dto';

describe('HTTP API contracts', () => {
  it('uses PATCH for a partial lesson update', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, ScheduleController.prototype.update)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(PATH_METADATA, ScheduleController.prototype.update)).toBe(':id');
  });

  it('forwards validated pagination to notification data access', async () => {
    const findByUser = jest.fn().mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 25, total: 0, totalPages: 0 },
    });
    const controller = new NotificationsController({ findByUser } as never);
    const pagination = Object.assign(new PaginationQueryDto(), { page: 2, limit: 25 });

    await expect(controller.findAll({ user: { id: 'user-1' } }, pagination)).resolves.toEqual({
      data: [],
      meta: { page: 2, limit: 25, total: 0, totalPages: 0 },
    });
    expect(findByUser).toHaveBeenCalledWith('user-1', pagination);
  });
});
