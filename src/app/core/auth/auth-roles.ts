import { ROLE_RANK, UserRole } from '../../api/users/users.models';
import { AUTH0_ROLES_CLAIM } from './auth0.config';

/** Resolve the highest app role from Auth0 ID-token claims. Missing → standard. */
export function readHighestRole(claims: Record<string, unknown> | null | undefined): UserRole {
  if (!claims) {
    return 'standard';
  }

  const candidates: unknown[] = [
    claims[AUTH0_ROLES_CLAIM],
    claims['https://game-library/role'],
    claims['roles'],
    claims['role'],
  ];

  // Catch alternate Action namespaces (any claim key containing "role").
  for (const [key, value] of Object.entries(claims)) {
    if (/role/i.test(key) && !candidates.includes(value)) {
      candidates.push(value);
    }
  }

  const found: UserRole[] = [];
  for (const value of candidates) {
    collectRoles(value, found);
  }

  if (found.length === 0) {
    return 'standard';
  }

  return found.reduce((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best));
}

function collectRoles(value: unknown, into: UserRole[]): void {
  if (typeof value === 'string') {
    const role = normalizeRole(value);
    if (role) {
      into.push(role);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRoles(item, into);
    }
  }
}

/**
 * Map Auth0 role names to app roles.
 * Accepts: super_admin, Super Admin, admin, Administrator, standard, etc.
 */
export function normalizeRole(value: string): UserRole | null {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  switch (key) {
    case 'super_admin':
    case 'superadmin':
      return 'super_admin';
    case 'admin':
    case 'administrator':
      return 'admin';
    case 'standard':
    case 'user':
    case 'member':
      return 'standard';
    default:
      return null;
  }
}

export function isRole(value: string): value is UserRole {
  return normalizeRole(value) !== null;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
