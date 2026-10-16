import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ServiceUnavailableException } from '@nestjs/common';
import { PlatformService } from './platform.service';
@Injectable()
export class PlatformMaintenanceInterceptor implements NestInterceptor {
  constructor(private readonly platform: PlatformService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<{ method: string; originalUrl: string }>();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !/^\/api\/v1\/(platform|auth|health)(\/|\?|$)/.test(request.originalUrl)) {
      const settings = await this.platform.settings(true);
      if (settings.readOnly) throw new ServiceUnavailableException(settings.announcement || 'Платформа временно доступна только для чтения.');
    }
    return next.handle();
  }
}
