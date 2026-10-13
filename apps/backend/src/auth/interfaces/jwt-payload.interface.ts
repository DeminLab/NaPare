import { UserRole } from "./user-role";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  universityId: string | null;
  groupId?: string | null;
  sessionVersion: number;
}
