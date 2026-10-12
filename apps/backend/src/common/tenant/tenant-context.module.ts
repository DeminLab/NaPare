import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { TenantContext } from './tenant-context';

@Global()
@Module({
  providers: [TenantContext],
  exports: [TenantContext],
})
export class TenantContextModule implements NestModule {
  constructor(private readonly context: TenantContext) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply((_request: Request, _response: Response, next: NextFunction) => this.context.runInRequest(next)).forRoutes('*');
  }
}
