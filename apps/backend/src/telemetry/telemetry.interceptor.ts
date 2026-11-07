import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap, finalize } from 'rxjs';
import type { Request, Response } from 'express';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TelemetryService } from './telemetry.service';

type TelemetryRequest = Request & { user?: AuthenticatedUser };
const EXCLUDED = [
  '/api/v1/health',
  '/api/v1/docs',
  '/api/v1/telemetry',
  '/api/v1/platform/analytics',
  '/api/v1/platform/events',
  '/api/v1/platform/sessions',
  '/api/v1/events/stream',
];

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<TelemetryRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    if (!path.startsWith('/api/') || EXCLUDED.some(prefix => path.startsWith(prefix))) return next.handle();

    const started = Date.now();
    let statusCode = 200;
    return next.handle().pipe(
      tap({
        next: () => { statusCode = response.statusCode; },
        error: (error: unknown) => { statusCode = error instanceof HttpException ? error.getStatus() : 500; },
      }),
      finalize(() => {
        const user = request.user;
        const durationMs = Date.now() - started;
        const failed = statusCode >= 400;
        this.telemetry.enqueueEvent({
          source: 'backend',
          category: statusCode >= 500 ? 'error' : path.includes('/auth/') ? 'auth' : 'request',
          name: statusCode >= 500 ? 'http.error' : 'http.request',
          severity: statusCode >= 500 ? 'error' : failed ? 'warning' : 'info',
          userId: user?.id ?? null,
          universityId: user?.universityId ?? null,
          sessionId: user?.sessionId ?? null,
          method: request.method,
          path,
          statusCode,
          durationMs,
          ip: request.ip,
          userAgent: request.get('user-agent') ?? null,
          createdAt: new Date(started),
        });
        if (user?.sessionId) void this.telemetry.touchSession(user.sessionId);
      }),
    );
  }
}
