import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderRoleMatrix, rolePolicySnapshot } from './role-policy.fixture';

const snapshot = rolePolicySnapshot();
mkdirSync(join(__dirname, 'fixtures'), { recursive: true });
writeFileSync(join(__dirname, 'fixtures/role-policy.json'), JSON.stringify(snapshot, null, 2) + '\n');
writeFileSync(join(__dirname, '../../../docs/security/role-matrix.md'), renderRoleMatrix(snapshot));
console.log(`Updated reviewed role baseline: ${snapshot.roles.length} roles, ${snapshot.routes.length} route declarations`);
