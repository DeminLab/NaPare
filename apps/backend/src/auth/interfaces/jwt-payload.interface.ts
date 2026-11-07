import { UserRole } from "./user-role";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  universityId: string | null;
  groupId?: string | null;
  sessionVersion: number;
  /** Server-side session id; absent on tokens issued before session tracking. */
  sid?: string;
}
