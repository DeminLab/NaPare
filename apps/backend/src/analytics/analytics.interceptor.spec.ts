import { ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ProductAnalyticsInterceptor } from './analytics.interceptor';
import { ProductAnalyticsService } from './analytics.service';

describe('Product analytics HTTP isolation',()=>{
  const actor={id:'5fb21464-3c38-46e4-a987-1e1e1561ab65',universityId:'2b207679-669b-47f3-9a18-ce0d7dfbc5ee',role:'student'};
  const context=(url='/api/v1/schedule/range',statusCode=200)=>({getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({user:actor,originalUrl:url}),getResponse:()=>({statusCode})})}) as unknown as ExecutionContext;
  const service=()=>({enabledFor:jest.fn(()=>true),recordActivity:jest.fn(async()=>undefined)});
  it('preserves successful business results when analytics storage fails',async()=>{
    const analytics=service();analytics.recordActivity.mockRejectedValueOnce(new Error('synthetic unavailable storage'));
    const log=jest.spyOn(Logger.prototype,'warn').mockImplementation(()=>undefined);
    try{const result=await lastValueFrom(new ProductAnalyticsInterceptor(analytics as unknown as ProductAnalyticsService).intercept(context(),{handle:()=>of({lessons:[]})}));expect(result).toEqual({lessons:[]});expect(analytics.recordActivity).toHaveBeenCalledTimes(1);}finally{log.mockRestore();}
  });
  it('does not record a failed handler',async()=>{
    const analytics=service(),failure=new Error('synthetic business rejection');
    await expect(lastValueFrom(new ProductAnalyticsInterceptor(analytics as unknown as ProductAnalyticsService).intercept(context(),{handle:()=>throwError(()=>failure)}))).rejects.toBe(failure);
    expect(analytics.recordActivity).not.toHaveBeenCalled();
  });
  it('does not record an explicitly unsuccessful HTTP response',async()=>{
    const analytics=service();await lastValueFrom(new ProductAnalyticsInterceptor(analytics as unknown as ProductAnalyticsService).intercept(context(undefined,400),{handle:()=>of({error:true})}));expect(analytics.recordActivity).not.toHaveBeenCalled();
  });
  it('does not contact analytics storage while collection is disabled',async()=>{
    const analytics=service();analytics.enabledFor.mockReturnValue(false);
    await lastValueFrom(new ProductAnalyticsInterceptor(analytics as unknown as ProductAnalyticsService).intercept(context(),{handle:()=>of('result')}));expect(analytics.recordActivity).not.toHaveBeenCalled();
  });
  it('excludes background and privacy requests entirely',async()=>{
    const analytics=service(),interceptor=new ProductAnalyticsInterceptor(analytics as unknown as ProductAnalyticsService);
    for(const path of ['/api/v1/events/stream','/api/v1/notifications','/api/v1/users/me/export'])await lastValueFrom(interceptor.intercept(context(path),{handle:()=>of('result')}));
    expect(analytics.enabledFor).not.toHaveBeenCalled();expect(analytics.recordActivity).not.toHaveBeenCalled();
  });
});
