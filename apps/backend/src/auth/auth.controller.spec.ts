import { ForbiddenException } from '@nestjs/common';

import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('rejects public registration', () => {
    const controller = new AuthController({} as never, {} as never, {} as never);

    expect(() => controller.register()).toThrow(ForbiddenException);
  });
});
