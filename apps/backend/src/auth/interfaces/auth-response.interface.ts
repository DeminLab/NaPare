export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string | null;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}
import { UserRole } from './user-role';
