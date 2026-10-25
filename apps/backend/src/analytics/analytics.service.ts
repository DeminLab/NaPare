import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/interfaces/user-role';
import { requireUniversityId } from '../common/tenant/require-university';
import { TenantContext } from '../common/tenant/tenant-context';
import { AnalyticsReadinessDto, AnalyticsReportDto } from './analytics.dto';
import { ANALYTICS_RETENTION_DAYS, analyticsConfiguration, analyticsPeriod, percentage } from './analytics-policy';

export const PRODUCT_METRICS = [
  ['semester_retention','Возврат студентов к концу семестра','percent','Студенты, от которых зафиксирована активность в первые 7 дней семестра и повторно в последние 7 дней.'],
  ['weekly_active_users','Активные аккаунты за неделю','count','Уникальные учебные и карьерные аккаунты с успешным запросом в измеряемых разделах за 7 дней UTC.'],
  ['weekly_active_students_share','Доля активных студентов','percent','Зафиксированные активные студенты недели среди текущих действующих студентов своего вуза. Исторический состав не восстанавливается.'],
  ['onboarding_hours','Наблюдаемое время подключения','hours','От создания вуза до первой успешной серверной проверки готовности. Не время непрерывной работы администратора.'],
  ['qr_mark_share','Доля операций отметок через QR','percent','Число отметок в QR-операциях среди отметок с известным способом ввода: QR или вручную. Повторное ручное сохранение считается новой операцией.'],
  ['homework_publications','Опубликовано заданий за неделю','count','Число зарегистрированных событий публикации задания за выбранную неделю, без текста заданий.'],
  ['schedule_import_success','Успешные импорты расписания','percent','Успешные импорты среди завершённых успешно или с ошибкой, по дате обновления статуса за неделю. Ожидающая очередь не входит в расчёт.'],
  ['office_on_time_closure','Заявления закрыты в срок','percent','Заявления, закрытые за неделю не позже назначенного срока, среди закрытых заявлений с известным сроком.'],
  ['career_accepted_work_share','Принято работ в недельной когорте','percent','Работы, созданные за неделю и принятые к моменту отчёта, среди всех работ той же когорты. Не показатель оплаты или трудоустройства.'],
  ['schedule_group_coverage','Группы с расписанием на неделю','percent','Текущие группы с сохранёнными занятиями, начинающимися в выбранную неделю, среди всех текущих групп вуза.'],
] as const;
type MetricValue={value:number|null;numerator?:number;denominator?:number;reason?:string;partial?:boolean};

@Injectable()
export class ProductAnalyticsService implements OnModuleInit,OnModuleDestroy {
  private readonly configuration:ReturnType<typeof analyticsConfiguration>;
  private cleanupTimer?:ReturnType<typeof setInterval>;
  private cleanupRunning=false;
  private readonly logger=new Logger(ProductAnalyticsService.name);
  constructor(private readonly db:DataSource,config:ConfigService,private readonly tenant:TenantContext){
    this.configuration=analyticsConfiguration(config.get('PRODUCT_ANALYTICS_ENABLED'),config.get('PRODUCT_ANALYTICS_UNIVERSITY_IDS'));
  }
  onModuleInit(){if(!this.configuration.universities.size)return;const run=()=>{void this.purgeExpired().catch(()=>this.logger.warn('Product activity retention cleanup failed'));};run();this.cleanupTimer=setInterval(run,3600000);this.cleanupTimer.unref();}
  onModuleDestroy(){if(this.cleanupTimer)clearInterval(this.cleanupTimer);}
  async purgeExpired(){
    if(!this.configuration.universities.size||this.cleanupRunning)return;
    this.cleanupRunning=true;
    try{const cutoff=new Date(Date.now()-ANALYTICS_RETENTION_DAYS*86400000).toISOString().slice(0,10);
      await this.tenant.runInRequest(()=>this.tenant.runWithDatabaseAccess({tables:['product_activity_days'],universityIds:[...this.configuration.universities],write:true},()=>this.db.query('DELETE FROM product_activity_days WHERE "universityId"=ANY($1::uuid[]) AND day<$2',[[...this.configuration.universities],cutoff])));
    }finally{this.cleanupRunning=false;}
  }
  enabledFor(universityId:string){return this.configuration.enabled&&this.configuration.universities.has(universityId);}
  private administrator(actor:AuthenticatedUser){
    if(actor.role!==UserRole.UNIVERSITY_ADMIN)throw new ForbiddenException('Аналитика доступна администратору своего вуза');
    return requireUniversityId(actor);
  }
  async recordActivity(actor:AuthenticatedUser){
    if(!actor.universityId||!this.enabledFor(actor.universityId))return;
    const now=new Date(),day=now.toISOString().slice(0,10);
    await this.db.transaction(async manager=>{
      await manager.query(`INSERT INTO product_analytics_state ("universityId","collectionStartedAt") VALUES ($1,$2) ON CONFLICT ("universityId") DO NOTHING`,[actor.universityId,now]);
      await manager.query(`INSERT INTO product_activity_days (id,"universityId","userId",day,role) VALUES (gen_random_uuid(),$1,$2,$3,$4) ON CONFLICT ("universityId","userId",day) DO NOTHING`,[actor.universityId,actor.id,day,actor.role]);
    });
  }
  async observeReadiness(actor:AuthenticatedUser,dto:AnalyticsReadinessDto){
    const universityId=this.administrator(actor),start=new Date(dto.startDate),end=new Date(dto.endDate);
    const duration=end.getTime()-start.getTime();
    if(!Number.isFinite(duration)||duration<86400000-1||duration>=32*86400000)throw new BadRequestException('Проверка готовности требует период от 1 до 32 дней');
    if(!this.enabledFor(universityId))return {enabled:false,ready:null,recordedAt:null};
    return this.db.transaction('REPEATABLE READ',async manager=>{
      const [state]=await manager.query(`SELECT
        EXISTS(SELECT 1 FROM universities WHERE id=$1 AND length(trim(name))>0 AND length(trim(city))>0) AND
        EXISTS(SELECT 1 FROM faculties WHERE "universityId"=$1) AND
        EXISTS(SELECT 1 FROM groups WHERE "universityId"=$1) AND
        EXISTS(SELECT 1 FROM users WHERE "universityId"=$1 AND role='university_admin' AND "isActive") AND
        NOT EXISTS(SELECT 1 FROM groups g WHERE g."universityId"=$1 AND NOT EXISTS(
          SELECT 1 FROM lessons l WHERE l."universityId"=$1 AND l."groupId"=g.id AND l."deletedAt" IS NULL AND l."startDate">=$2 AND l."startDate"<=$3)) AND
        NOT EXISTS(SELECT 1 FROM lessons l WHERE l."universityId"=$1 AND l."deletedAt" IS NULL AND l."startDate">=$2 AND l."startDate"<=$3 AND NOT EXISTS(
          SELECT 1 FROM users u WHERE u.id=l."teacherId" AND u."universityId"=$1 AND u.role='teacher' AND u."isActive")) AS ready`,[universityId,start,end]);
      if(!state.ready)return {enabled:true,ready:false,recordedAt:null};
      const [saved]=await manager.query(`INSERT INTO product_analytics_state ("universityId","collectionStartedAt","onboardingReadyAt","readinessPeriodStart","readinessPeriodEnd") VALUES ($1,$2,$2,$3,$4)
        ON CONFLICT ("universityId") DO UPDATE SET "onboardingReadyAt"=COALESCE(product_analytics_state."onboardingReadyAt",EXCLUDED."onboardingReadyAt"),
        "readinessPeriodStart"=COALESCE(product_analytics_state."readinessPeriodStart",EXCLUDED."readinessPeriodStart"),"readinessPeriodEnd"=COALESCE(product_analytics_state."readinessPeriodEnd",EXCLUDED."readinessPeriodEnd") RETURNING "onboardingReadyAt"`,[universityId,new Date(),start,end]);
      return {enabled:true,ready:true,recordedAt:saved.onboardingReadyAt};
    });
  }
  async report(actor:AuthenticatedUser,dto:AnalyticsReportDto){
    const universityId=this.administrator(actor),period=analyticsPeriod(dto.weekStart,dto.semesterStart,dto.semesterEnd),enabled=this.enabledFor(universityId),now=new Date();
    const values:Record<string,MetricValue>={};
    const result=(coverage:unknown)=>({version:'napare-analytics-v1',universityId,enabled,generatedAt:now.toISOString(),period,coverage,
      metrics:PRODUCT_METRICS.map(([id,label,unit,definition])=>{const metric=values[id]||{value:null,reason:enabled?'no_observations':'collection_disabled'};return {id,label,unit,definition,...metric,...(metric.value===null&&!metric.reason?{reason:'no_observations'}:{})};}),
      limitations:['Только зафиксированные успешные обращения кабинетов к серверу, включая автоматические запросы интерфейса. Эти числа не измеряют внимание, посещаемость или время за экраном.',
        'Нет восстановления активности до включения, во время отключения или недоступности сервера. UTC-неделя задаётся явно; календарь семестра задаёт администратор.',
        'Текущие состав студентов/групп и состояния работ могут менять прошлые коэффициенты. Удаление аккаунта удаляет его дневную активность.',
        'Дневная активность старше 400 дней очищается при запуске и каждый час для настроенных вузов, даже при отключённом сборе. Удаление вуза из настройки и простой останавливают очистку; оператор должен контролировать её выполнение и утвердить политику до включения.']});
    if(!enabled)return result(null);
    return this.db.transaction('REPEATABLE READ',async manager=>{
      await manager.query('SET TRANSACTION READ ONLY');
      const [tracking]=await manager.query('SELECT "collectionStartedAt","onboardingReadyAt" FROM product_analytics_state WHERE "universityId"=$1',[universityId]);
      const [activity]=await manager.query(`WITH weekly AS (
        SELECT DISTINCT "userId",role FROM product_activity_days WHERE "universityId"=$1 AND day >= $2::date AND day < $3::date),
        cohort AS (SELECT DISTINCT "userId" FROM product_activity_days WHERE "universityId"=$1 AND role='student' AND day >= $4::date AND day < $6::date),
        returned AS (SELECT DISTINCT "userId" FROM product_activity_days WHERE "universityId"=$1 AND role='student' AND day >= $7::date AND day < $5::date)
        SELECT (SELECT count(DISTINCT "userId") FROM weekly)::int AS active,
          (SELECT count(DISTINCT w."userId") FROM weekly w JOIN users u ON u.id=w."userId" AND u."universityId"=$1 AND u.role='student' AND u."isActive" WHERE w.role='student')::int AS students,
          (SELECT count(*) FROM users WHERE "universityId"=$1 AND role='student' AND "isActive")::int AS enrolled,
          (SELECT count(*) FROM cohort)::int AS cohort,(SELECT count(*) FROM cohort c JOIN returned r USING ("userId"))::int AS returned`,[universityId,period.weekStart,period.weekEnd,period.semesterStart,period.semesterEnd,period.cohortEnd,period.returnStart]);
      const partial=!tracking||new Date(tracking.collectionStartedAt)>period.weekStart||period.weekEnd>now;
      values.weekly_active_users={value:activity.active,partial};
      values.weekly_active_students_share={value:percentage(activity.students,activity.enrolled),numerator:activity.students,denominator:activity.enrolled,partial};
      const retentionReason=period.semesterEnd>now?'period_in_progress':!tracking||new Date(tracking.collectionStartedAt)>period.semesterStart?'incomplete_collection':period.semesterStart.getTime()<now.getTime()-ANALYTICS_RETENTION_DAYS*86400000?'outside_retention':activity.cohort===0?'empty_cohort':undefined;
      values.semester_retention={value:retentionReason?null:percentage(activity.returned,activity.cohort),numerator:activity.returned,denominator:activity.cohort,reason:retentionReason};
      const [onboarding]=await manager.query('SELECT "createdAt" FROM universities WHERE id=$1',[universityId]);
      values.onboarding_hours={value:tracking?.onboardingReadyAt&&onboarding?Math.max(0,Math.round((new Date(tracking.onboardingReadyAt).getTime()-new Date(onboarding.createdAt).getTime())/36000)/100):null,reason:tracking?.onboardingReadyAt?undefined:'readiness_not_observed'};
      const [events]=await manager.query(`WITH marks AS (SELECT payload->>'source' AS source,CASE WHEN payload->>'records' ~ '^\\d{1,6}$' THEN (payload->>'records')::int ELSE 0 END AS records
        FROM event_records WHERE "universityId"=$1 AND type='attendance.updated' AND timestamp >= $2 AND timestamp < $3)
        SELECT COALESCE(sum(records) FILTER(WHERE source='qr'),0)::int AS qr,COALESCE(sum(records) FILTER(WHERE source IN ('qr','manual')),0)::int AS known,
        COALESCE(sum(records) FILTER(WHERE source IS NULL OR source NOT IN ('qr','manual')),0)::int AS unknown,
        (SELECT count(*) FROM event_records WHERE "universityId"=$1 AND type='homework.created' AND timestamp >= $2 AND timestamp < $3)::int AS homework FROM marks`,[universityId,period.weekStart,period.weekEnd]);
      values.qr_mark_share={value:percentage(events.qr,events.known),numerator:events.qr,denominator:events.known,partial:events.unknown>0||period.weekEnd>now};
      values.homework_publications={value:events.homework,partial:period.weekEnd>now};
      const [imports]=await manager.query(`SELECT count(*) FILTER(WHERE status='completed')::int AS succeeded,count(*)::int AS total FROM schedule_import_jobs WHERE "universityId"=$1 AND status IN ('completed','failed') AND "updatedAt">=$2 AND "updatedAt"<$3`,[universityId,period.weekStart,period.weekEnd]);
      values.schedule_import_success={value:percentage(imports.succeeded,imports.total),numerator:imports.succeeded,denominator:imports.total,partial:period.weekEnd>now};
      const [office]=await manager.query(`SELECT count(*) FILTER(WHERE "closedAt"<="dueAt")::int AS ontime,count(*)::int AS total FROM student_requests WHERE "universityId"=$1 AND "closedAt">=$2 AND "closedAt"<$3 AND "dueAt" IS NOT NULL`,[universityId,period.weekStart,period.weekEnd]);
      values.office_on_time_closure={value:percentage(office.ontime,office.total),numerator:office.ontime,denominator:office.total,partial:period.weekEnd>now};
      const [career]=await manager.query(`SELECT count(*) FILTER(WHERE w.state='accepted')::int AS accepted,count(*)::int AS total FROM career_work w JOIN career_task t ON t.id=w."taskId" AND t."universityId"=$1 WHERE w."createdAt">=$2 AND w."createdAt"<$3`,[universityId,period.weekStart,period.weekEnd]);
      values.career_accepted_work_share={value:percentage(career.accepted,career.total),numerator:career.accepted,denominator:career.total,partial:period.weekEnd>now};
      const [schedule]=await manager.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM lessons l WHERE l."universityId"=$1 AND l."groupId"=g.id AND l."deletedAt" IS NULL AND l."startDate">=$2 AND l."startDate"<$3))::int AS covered FROM groups g WHERE g."universityId"=$1`,[universityId,period.weekStart,period.weekEnd]);
      values.schedule_group_coverage={value:percentage(schedule.covered,schedule.total),numerator:schedule.covered,denominator:schedule.total};
      return result({collectionStartedAt:tracking?.collectionStartedAt||null,retentionDays:ANALYTICS_RETENTION_DAYS,qrUnknownRecords:events.unknown,continuousCollectionProven:false});
    });
  }
}
