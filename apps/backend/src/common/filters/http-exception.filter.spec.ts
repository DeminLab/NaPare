import { ArgumentsHost, BadRequestException, HttpStatus, Logger } from '@nestjs/common';

import { AllExceptionsFilter } from './http-exception.filter';
import * as Sentry from '@sentry/node';

jest.mock('@sentry/node', () => ({
  getCurrentHub: () => ({ getClient: () => ({}) }),
  captureMessage: jest.fn(),
}));

describe('AllExceptionsFilter', () => {
  beforeEach(() => jest.clearAllMocks());
  it('returns one machine-readable validation error shape', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', url: '/api/v1/auth/login' }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(
      new BadRequestException(['email must be an email']),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: ['email must be an email'],
      path: '/api/v1/auth/login',
    }));
    logger.mockRestore();
  });

  it('reports server errors without private exception or request details', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const host = { switchToHttp: () => ({
      getResponse: () => ({ status: () => ({ json }) }),
      getRequest: () => ({ method: 'POST', url: '/private?token=secret', body: { password: 'secret' } }),
    }) } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(new Error('SQL password=secret'), host);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Backend request failed', {
      level: 'error', tags: { http_status: '500', http_method: 'POST' },
    });
    expect(JSON.stringify((Sentry.captureMessage as jest.Mock).mock.calls)).not.toContain('secret');
    logger.mockRestore();
  });
});
