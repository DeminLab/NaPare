import { SetMetadata } from '@nestjs/common';

import { Permission } from './permissions';

export const PERMISSIONS_KEY = 'permissions';
export const RequiresPermission = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
