import { UserRole } from '../users/users.models';

export interface AuthSession {
  userId: string;
  displayName: string;
  role: UserRole;
  /** Present when session comes from Auth0. */
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}
