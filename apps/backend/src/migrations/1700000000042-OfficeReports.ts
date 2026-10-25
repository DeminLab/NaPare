import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfficeReports1700000000042 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS office_debt_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL, "groupId" uuid NOT NULL,
      "requestId" uuid NOT NULL, digest varchar NOT NULL, source varchar NOT NULL, reference varchar NOT NULL,
      "asOfDate" date NOT NULL, "verifiedBy" uuid NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "supersededAt" timestamp NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_office_debt_import" ON office_debt_snapshots ("universityId","requestId");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_office_debt_current_group" ON office_debt_snapshots ("universityId","groupId") WHERE "supersededAt" IS NULL;
      CREATE TABLE IF NOT EXISTS office_debt_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL, "groupId" uuid NOT NULL,
      "snapshotId" uuid NOT NULL, "studentId" uuid NOT NULL, subject varchar NOT NULL, period varchar NOT NULL, basis varchar NOT NULL);
      CREATE INDEX IF NOT EXISTS "IDX_office_debt_student" ON office_debt_records ("universityId","studentId");`);
    const foreignKeys: [string,string,string,string][] = [
      ['office_debt_snapshots','universityId','universities','id'], ['office_debt_snapshots','groupId','groups','id'],
      ['office_debt_snapshots','verifiedBy','users','id'], ['office_debt_records','universityId','universities','id'],
      ['office_debt_records','groupId','groups','id'], ['office_debt_records','snapshotId','office_debt_snapshots','id'],
      ['office_debt_records','studentId','users','id'],
    ];
    for (const [table,column,target,key] of foreignKeys) {
      const name = `FK_${table}_${column}`;
      await runner.query(`DO $fk$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='${table}'::regclass AND conname='${name}') THEN
        ALTER TABLE ${table} ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES ${target}("${key}") ON DELETE RESTRICT;
        END IF; END $fk$;`);
    }
    for (const [table,owner] of [['office_debt_snapshots','verifiedBy'],['office_debt_records','studentId']]) {
      const personal = `(public.napare_personal_export_enabled() AND "${owner}"::text = NULLIF(current_setting('app.actor_id',true),''))`;
      await runner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS napare_tenant_base ON ${table};
        CREATE POLICY napare_tenant_base ON ${table} AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);`);
      for (const [name,verb] of [['select','SELECT'],['insert','INSERT'],['update','UPDATE'],['delete','DELETE']]) {
        const ordinary = `public.napare_tenant_allows('${table}',"universityId"::text,${name !== 'select'})`;
        const predicate = name === 'select' ? `(${ordinary} OR ${personal})` : ordinary;
        await runner.query(`DROP POLICY IF EXISTS napare_tenant_${name} ON ${table}; CREATE POLICY napare_tenant_${name}
          ON ${table} AS RESTRICTIVE FOR ${verb} ${name === 'insert' ? `WITH CHECK (${predicate})` : `USING (${predicate})${name === 'update' ? ` WITH CHECK (${ordinary})` : ''}`}`);
      }
      await runner.query(`DROP TRIGGER IF EXISTS napare_active_writer ON ${table};
        CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer()`);
    }
  }
  async down(): Promise<void> { throw new Error('Academic debt history requires an explicitly approved archival migration'); }
}
