export type UserRole = 'super_admin' | 'admin' | 'standard';

export interface LibraryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  initials: string;
}

export const ROLE_RANK: Record<UserRole, number> = {
  standard: 1,
  admin: 2,
  super_admin: 3,
};
