import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';

import { TelemetryInterceptor } from './telemetry.interceptor';

function context(path: string, user?: { id: string; universityId: string; sessionId: string }) {
  const request = { method: 'GET', originalUrl: path, ip: '203.0.113.10', get: () => 'Mozilla/5.0 (Windows NT 10.0)', user };
  const response = { statusCode: 200 };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  };
}

describe('TelemetryInterceptor', () => {
  it('buffers API requests without touching the response', async () => {
    const telemetry = { enqueueEvent: jest.fn(), touchSession: jest.fn() };
    const interceptor = new TelemetryInterceptor(telemetry as never);

    const result = await interceptor.intercept(context('/api/v1/users/me') as never, { handle: () => of({ ok: true }) } as never)
      .toPromise();

    expect(result).toEqual({ ok: true });
    expect(telemetry.enqueueEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'backend',
      category: 'request',
      name: 'http.request',
      path: '/api/v1/users/me',
      statusCode: 200,
    }));
  });

  it('does not record its own endpoints, health checks or non-API routes', () => {
    const telemetry = { enqueueEvent: jest.fn(), touchSession: jest.fn() };
    const interceptor = new TelemetryInterceptor(telemetry as never);

    for (const path of ['/api/v1/health', '/api/v1/telemetry/events', '/api/v1/platform/events', '/api/v1/platform/analytics/overview', '/api/v1/platform/sessions', '/login']) {
      void interceptor.intercept(context(path) as never, { handle: () => of('done') } as never).toPromise();
    }

    expect(telemetry.enqueueEvent).not.toHaveBeenCalled();
  });

  it('records failed authentication calls and refreshes session activity', async () => {
    const telemetry = { enqueueEvent: jest.fn(), touchSession: jest.fn() };
    const interceptor = new TelemetryInterceptor(telemetry as never);
    const ctx = context('/api/v1/auth/login', { id: 'user-1', universityId: 'university-1', sessionId: 'session-1' });

    await expect(interceptor.intercept(ctx as never, { handle: () => throwError(() => new HttpException('bad', HttpStatus.UNAUTHORIZED)) } as never).toPromise()).rejects.toThrow(HttpException);

    expect(telemetry.enqueueEvent).toHaveBeenCalledWith(expect.objectContaining({
      category: 'auth',
      severity: 'warning',
      statusCode: 401,
      userId: 'user-1',
      sessionId: 'session-1',
    }));
    expect(telemetry.touchSession).toHaveBeenCalledWith('session-1');
  });
});
