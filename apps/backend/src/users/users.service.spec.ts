import { ConflictException } from '@nestjs/common';
import { IsNull } from 'typeorm';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService.bindMaxUserIdIfUnlinked', () => {
  const repository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const tenantContext = { assertAccess: jest.fn(), getUser: jest.fn() };
  const service = new UsersService(repository as never, tenantContext as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('atomically binds only an account whose MAX id is still empty', async () => {
    repository.findOne
      .mockResolvedValueOnce({ id: 'user-1', maxUserId: null } as User)
      .mockResolvedValueOnce({ id: 'user-1', maxUserId: 'max-1' } as User);
    repository.update.mockResolvedValue({ affected: 1 });

    await expect(service.bindMaxUserIdIfUnlinked('user-1', 'max-1'))
      .resolves.toMatchObject({ id: 'user-1', maxUserId: 'max-1' });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'user-1', maxUserId: IsNull() },
      { maxUserId: 'max-1' },
    );
  });

  it('rejects replacing a MAX id already linked to the account', async () => {
    repository.findOne.mockResolvedValue({ id: 'user-1', maxUserId: 'max-old' } as User);

    await expect(service.bindMaxUserIdIfUnlinked('user-1', 'max-new'))
      .rejects.toThrow(ConflictException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('accepts a concurrent retry that has already bound this same MAX id', async () => {
    repository.findOne
      .mockResolvedValueOnce({ id: 'user-1', maxUserId: null } as User)
      .mockResolvedValueOnce({ id: 'user-1', maxUserId: 'max-1' } as User);
    repository.update.mockResolvedValue({ affected: 0 });

    await expect(service.bindMaxUserIdIfUnlinked('user-1', 'max-1'))
      .resolves.toMatchObject({ id: 'user-1', maxUserId: 'max-1' });
  });
});
