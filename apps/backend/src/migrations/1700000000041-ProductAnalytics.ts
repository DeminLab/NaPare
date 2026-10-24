import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductAnalytics1700000000041 implements MigrationInterface {
  name='ProductAnalytics1700000000041';
  async up(runner:QueryRunner):Promise<void>{
    await runner.query(`CREATE TABLE IF NOT EXISTS product_activity_days (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"universityId" uuid NOT NULL,"userId" uuid NOT NULL,day date NOT NULL,role varchar NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_activity_day_actor" ON product_activity_days ("universityId","userId",day);
      CREATE INDEX IF NOT EXISTS "IDX_product_activity_day_scope" ON product_activity_days ("universityId",day);
      CREATE TABLE IF NOT EXISTS product_analytics_state ("universityId" uuid PRIMARY KEY,"collectionStartedAt" timestamp NOT NULL,
        "onboardingReadyAt" timestamp NULL,"readinessPeriodStart" timestamp NULL,"readinessPeriodEnd" timestamp NULL);
      DO $constraints$ BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='product_activity_days'::regclass AND conname='FK_product_activity_user') THEN
          ALTER TABLE product_activity_days ADD CONSTRAINT "FK_product_activity_user" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT;
          ALTER TABLE product_activity_days ADD CONSTRAINT "FK_product_activity_university" FOREIGN KEY ("universityId") REFERENCES universities(id) ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='product_analytics_state'::regclass AND conname='FK_product_analytics_university') THEN
          ALTER TABLE product_analytics_state ADD CONSTRAINT "FK_product_analytics_university" FOREIGN KEY ("universityId") REFERENCES universities(id) ON DELETE RESTRICT;
        END IF;
      END $constraints$;`);
    for(const table of ['product_activity_days','product_analytics_state']){
      const selfRead=table==='product_activity_days'?`("userId"::text=NULLIF(current_setting('app.actor_id',true),'') AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access',true),''),'[]')::jsonb) cap
        WHERE cap->'personalData'->>'userId'=NULLIF(current_setting('app.actor_id',true),'')))`:'false';
      const erasure=table==='product_activity_days'?`public.napare_erasure_row('${table}',id::text)`:'false';
      await runner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS napare_tenant_base ON ${table};
        CREATE POLICY napare_tenant_base ON ${table} AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true)`);
      for(const [name,verb] of [['select','SELECT'],['insert','INSERT'],['update','UPDATE'],['delete','DELETE']] as const){
        const ordinary=`public.napare_tenant_allows('${table}',"universityId"::text,${name!=='select'})`;
        const predicate=name==='select'?`(${ordinary} OR ${selfRead} OR ${erasure})`:name==='insert'?ordinary:`(${ordinary} OR ${erasure})`;
        const read=`(public.napare_tenant_allows('${table}',"universityId"::text,false) OR ${selfRead} OR ${erasure})`;
        await runner.query(`DROP POLICY IF EXISTS napare_tenant_${name} ON ${table};
          CREATE POLICY napare_tenant_${name} ON ${table} AS RESTRICTIVE FOR ${verb} ${name==='insert'?`WITH CHECK (${predicate})`:`USING (${name==='update'?read:predicate})${name==='update'?` WITH CHECK (${predicate})`:''}`}`);
      }
      await runner.query(`DROP TRIGGER IF EXISTS napare_active_writer ON ${table}; CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer()`);
    }
  }
  async down():Promise<void>{throw new Error('Analytics history requires an explicit archival migration; automatic destructive rollback is disabled');}
}
