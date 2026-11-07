import { UserRole } from './user-role';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  universityId: string | null;
  groupId?: string | null;
  /** Version checked by JwtStrategy, retained for locked revalidation of destructive actions. */
  sessionVersion?: number;
  /** Server-side session id used for device listing and targeted revocation. */
  sessionId?: string;
}
