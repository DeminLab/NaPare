import { analyticsConfiguration, analyticsDate, analyticsPeriod, percentage, qualifiesForProductActivity } from './analytics-policy';

describe('Product analytics measurement policy',()=>{
  it('requires both an explicit flag and an explicit university allowlist',()=>{
    expect(analyticsConfiguration(undefined,undefined)).toMatchObject({enabled:false});
    expect(analyticsConfiguration('true','').universities.size).toBe(0);
    expect(()=>analyticsConfiguration('yes','')).toThrow();
    expect(()=>analyticsConfiguration('true','not-a-university')).toThrow();
  });
  it('deduplicates valid configured universities without admitting wildcards',()=>{
    const id='b578f650-b4c6-41a7-b830-17927ff173c8';
    expect(analyticsConfiguration('true',`${id}, ${id}`).universities.size).toBe(1);
    expect(()=>analyticsConfiguration('true','*')).toThrow();
  });
  it.each(['2026-02-29','2026-04-31','2026-1-1','2026-10-22T12:00:00Z','not-a-date'])('rejects impossible or ambiguous calendar date %s',value=>{expect(()=>analyticsDate(value)).toThrow();});
  it('uses nonoverlapping first/last seven-day windows and exclusive UTC ends',()=>{
    const p=analyticsPeriod('2026-10-19','2026-09-01','2026-12-31');
    expect(p.weekEnd.toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(p.cohortEnd.toISOString()).toBe('2026-09-08T00:00:00.000Z');
    expect(p.returnStart.toISOString()).toBe('2026-12-25T00:00:00.000Z');
    expect(p.semesterEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(()=>analyticsPeriod('2026-10-19','2026-10-01','2026-10-13')).toThrow();
    expect(()=>analyticsPeriod('2026-10-19','2026-01-01','2026-12-31')).toThrow();
  });
  it.each(['/api/v1/auth/refresh','/api/v1/events/stream','/api/v1/notifications','/api/v1/analytics/report','/api/v1/users/me/export','/api/v1/health'])('excludes background, privacy or measurement routes: %s',path=>{expect(qualifiesForProductActivity(path,'student')).toBe(false);});
  it('does not treat technical or employer requests as campus usage',()=>{
    expect(qualifiesForProductActivity('/api/v1/schedule/range','student')).toBe(true);
    for(const role of ['developer','superadmin','employer'])expect(qualifiesForProductActivity('/api/v1/career',role)).toBe(false);
  });
  it('distinguishes an empty denominator from an observed zero',()=>{
    expect(percentage(0,0)).toBeNull();expect(percentage(0,2)).toBe(0);expect(percentage(1,3)).toBe(33.33);
  });
});
