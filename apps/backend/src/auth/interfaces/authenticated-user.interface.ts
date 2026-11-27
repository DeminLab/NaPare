import { UserRole } from './user-role';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  /** Legacy mirror of the active organization's single role (ADR-0009). */
  role: UserRole;
  /**
   * ADR-0009 dual-read: effective roles of the active organization from
   * `user_role`, falling back to `[role]` when no membership exists. Guards
   * authorize against this set; `role` stays the persisted mirror.
   */
  roles?: UserRole[];
  organizationId: string | null;
  groupId?: string | null;
  /** Version checked by JwtStrategy, retained for locked revalidation of destructive actions. */
  sessionVersion?: number;
  /** Server-side session id used for device listing and targeted revocation. */
  sessionId?: string;
}
