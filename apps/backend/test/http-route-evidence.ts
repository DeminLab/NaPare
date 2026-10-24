import { INestApplication } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { UserRole } from '../src/auth/interfaces/user-role';

/** Opt-in metadata only, on real test AppModules; never install on a guard probe. */
export function installHttpRouteEvidence(app: INestApplication, universityIds: () => string[] = () => []) {
  const configured = process.env.BUSINESS_ROUTE_EVIDENCE_FILE;
  if (!configured) return;
  if (process.env.NODE_ENV !== 'test') throw new Error('Business HTTP evidence is test-only');
  const root = path.resolve(__dirname, '../../..'), output = path.join(root, 'output');
  const filename = path.resolve(root, configured), relative = path.relative(output, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !filename.endsWith('.jsonl')) throw new Error('Evidence must be a JSONL file inside workspace output');
  mkdirSync(path.dirname(filename), { recursive: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.once('finish', () => {
      const route: unknown = req.route?.path;
      if (typeof route !== 'string' || !route.startsWith('/api/v1') || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
      const state = typeof expect === 'function' ? expect.getState() : undefined;
      const suite = state?.testPath ? path.basename(state.testPath) : '';
      if (!/^[a-z0-9.-]+\.e2e-spec\.ts$/i.test(suite)) return;
      const actor = (req as Request & { user?: { role?: UserRole; universityId?: string } }).user;
      const ids = universityIds(), index = actor?.universityId ? ids.indexOf(actor.universityId) : -1;
      const scope = !actor?.universityId ? 'none' : index === 0 ? 'primary' : index === 1 ? 'secondary' : 'other';
      const role = actor?.role && Object.values(UserRole).includes(actor.role) ? actor.role : actor ? 'other' : 'anonymous';
      appendFileSync(filename, JSON.stringify({ method: req.method, path: route, status: res.statusCode, role, scope, suite,
        caseId: createHash('sha256').update(suite + ':' + (state?.currentTestName || 'setup')).digest('hex').slice(0, 16) }) + '\n');
    });
    next();
  });
}
