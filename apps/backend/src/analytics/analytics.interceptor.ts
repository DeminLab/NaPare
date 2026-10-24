import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ProductAnalyticsService } from './analytics.service';
import { qualifiesForProductActivity } from './analytics-policy';

@Injectable()
export class ProductAnalyticsInterceptor implements NestInterceptor {
  private readonly logger=new Logger(ProductAnalyticsInterceptor.name);
  constructor(private readonly analytics:ProductAnalyticsService){}
  intercept(context:ExecutionContext,next:CallHandler):Observable<unknown>{
    if(context.getType()!=='http')return next.handle();
    const request=context.switchToHttp().getRequest<{user?:AuthenticatedUser;originalUrl?:string;url?:string}>();
    const actor=request.user;
    if(!actor?.universityId||!qualifiesForProductActivity(request.originalUrl||request.url||'',actor.role)||!this.analytics.enabledFor(actor.universityId))return next.handle();
    return next.handle().pipe(mergeMap(async value=>{
      const response=context.switchToHttp().getResponse<{statusCode:number}>();
      if(response.statusCode<200||response.statusCode>=300)return value;
      try{await this.analytics.recordActivity(actor);}catch{this.logger.warn('Product activity could not be recorded');}
      return value;
    }));
  }
}
