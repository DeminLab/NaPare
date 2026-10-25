import { ForbiddenException, Injectable, ServiceUnavailableException, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { TenantContext } from '../common/tenant/tenant-context';
import { PERSONAL_DATASETS, PERSONAL_EXPORT_LIMITATIONS, quoteIdentifier as q } from './personal-data.catalog';

@Injectable()
export class PersonalDataService {
  private readonly active = new Set<string>();
  constructor(private readonly db: DataSource, private readonly tenant: TenantContext) {}

  async download(response: Response): Promise<void> {
    const actor = this.tenant.getUser();
    if (!actor) throw new ForbiddenException();
    if (this.active.has(actor.id)) throw new HttpException('Экспорт уже выполняется', 429);
    if (this.active.size >= 4) throw new ServiceUnavailableException('Экспорт занят; повторите позже');
    this.active.add(actor.id);
    const runner = this.db.createQueryRunner();
    let disconnected = false;
    const abort = () => { disconnected = true; };
    response.on('close', abort);
    const write = async (chunk: string) => {
      if (disconnected || response.destroyed) throw new Error('Export disconnected');
      if (!response.write(chunk)) await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { clean(); reject(new Error('Export client stalled')); }, 15000);
        const clean = () => { clearTimeout(timer); response.off('drain', drain); response.off('close', close); response.off('error', error); };
        const drain = () => { clean(); resolve(); };
        const close = () => { clean(); reject(new Error('Export disconnected')); };
        const error = (reason: Error) => { clean(); reject(reason); };
        response.once('drain', drain); response.once('close', close); response.once('error', error);
        if (response.destroyed) close();
      });
    };
    try {
      await this.tenant.runWithDatabaseAccess({ personalData: { userId: actor.id } }, async () => {
        await runner.connect();
        await runner.startTransaction('REPEATABLE READ');
        await runner.query('SET TRANSACTION READ ONLY');
        await runner.query("SET LOCAL statement_timeout = '15s'");
        await runner.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
        // Fail before starting a download on an un-migrated database.
        await runner.query('SELECT public.napare_personal_export_enabled()');
        const users = await runner.query('SELECT id FROM users WHERE id=$1 AND "isActive"=true', [actor.id]);
        if (users.length !== 1) throw new ForbiddenException('Аккаунт недоступен');
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Content-Disposition', 'attachment; filename="napare-personal-data.json"');
        response.setHeader('Cache-Control', 'no-store, private');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        const [snapshot] = await runner.query('SELECT transaction_timestamp() AS at');
        await write(JSON.stringify({ format: 'napare-personal-data', version: 1, exportedAt: snapshot.at, limitations: PERSONAL_EXPORT_LIMITATIONS }).slice(0, -1) + ',"datasets":{');
        const counts: Record<string, number> = {};
        let firstDataset = true;
        for (const dataset of PERSONAL_DATASETS) {
          if (disconnected) throw new Error('Export disconnected');
          const fields = dataset.columns.map(field => `t.${q(field)}`).join(', ');
          const predicate = dataset.where ?? dataset.owners.map(field => `t.${q(field)}::text = $1`).join(' OR ');
          let cursor: string | null = null;
          let count = 0;
          await write(`${firstDataset ? '' : ','}${JSON.stringify(dataset.name)}:[`);
          firstDataset = false;
          for (;;) {
            const rows: Record<string, unknown>[] = await runner.query(`SELECT ${fields}, t.${q(dataset.key)}::text AS "__exportCursor" FROM ${q(dataset.table)} t WHERE (${predicate})
              AND ($2::text IS NULL OR t.${q(dataset.key)}::text > $2) ORDER BY t.${q(dataset.key)}::text LIMIT 100`, [actor.id, cursor]);
            if (!rows.length) break;
            await write(`${count ? ',' : ''}${rows.map(({ __exportCursor: _cursor, ...row }) => JSON.stringify(row)).join(',')}`);
            count += rows.length;
            cursor = String(rows[rows.length - 1].__exportCursor);
          }
          counts[dataset.name] = count;
          await write(']');
        }
        await runner.commitTransaction();
        await write(`},"counts":${JSON.stringify(counts)},"complete":true}`);
        response.end();
      });
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      if (response.headersSent) response.destroy();
      else throw error;
    } finally {
      response.off('close', abort);
      this.active.delete(actor.id);
      await runner.release();
    }
  }
}
