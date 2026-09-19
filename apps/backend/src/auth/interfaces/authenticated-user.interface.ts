import { UserRole } from './user-role';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  universityId: string;
  groupId?: string | null;
}
