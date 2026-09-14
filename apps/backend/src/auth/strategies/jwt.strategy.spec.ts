import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../interfaces/user-role';

describe('JwtStrategy', () => {
  const usersService = { findById: jest.fn() };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(configService, usersService as never);

  beforeEach(() => jest.clearAllMocks());

  it('accepts a token role only when it matches the database role', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      role: UserRole.TEACHER,
      universityId: 'uni-1',
    });

    await expect(strategy.validate({
      sub: 'u1', email: 'user@example.com', role: UserRole.TEACHER, universityId: 'uni-1',
    })).resolves.toMatchObject({ id: 'u1', role: UserRole.TEACHER });
  });

  it('rejects a stale or forged role claim', async () => {
    usersService.findById.mockResolvedValue({ id: 'u1', role: UserRole.STUDENT });

    await expect(strategy.validate({
      sub: 'u1', email: 'user@example.com', role: UserRole.SUPERADMIN, universityId: 'uni-1',
    })).rejects.toThrow();
  });
});
