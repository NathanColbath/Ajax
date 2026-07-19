import { Injectable, inject, isDevMode } from '@angular/core';
import { AuthService, User } from '@auth0/auth0-angular';
import { IdToken } from '@auth0/auth0-spa-js';
import { combineLatest } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AUTH0_ROLES_CLAIM } from './auth0.config';
import { readHighestRole } from './auth-roles';
import { SessionService } from './session.service';

/**
 * Keeps local SessionService in sync with Auth0 authentication state.
 * Roles are read from ID-token claims (Post-Login Action), not from user$ alone.
 */
@Injectable({ providedIn: 'root' })
export class Auth0SessionBridge {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private warnedMissingRoles = false;

  start(): void {
    combineLatest([
      this.auth.isLoading$,
      this.auth.isAuthenticated$,
      this.auth.user$,
      this.auth.idTokenClaims$,
    ])
      .pipe(filter(([loading]) => !loading))
      .subscribe(([_, isAuthenticated, user, claims]) => {
        if (isAuthenticated && user) {
          const merged = mergeClaims(user, claims);
          const role = readHighestRole(merged);
          if (isDevMode() && role === 'standard' && !this.warnedMissingRoles) {
            this.warnedMissingRoles = true;
            const roleClaim = merged[AUTH0_ROLES_CLAIM];
            const payload = decodeJwtPayload(merged['__raw']);
            console.warn(
              '[Auth0] No app role claim found — defaulting to standard.\n' +
                `Expected claim "${AUTH0_ROLES_CLAIM}", got:`,
              roleClaim ?? '(missing)',
              '\n\nThe Post-Login Action is not writing this claim into the ID token.\n' +
                '1. Actions → Login → Post Login: paste scripts/auth0-post-login-action.js\n' +
                '2. Click Deploy\n' +
                '3. Flows → Login: drag the Action onto the Login flow, Apply\n' +
                '4. APIs: create https://game-library-api, enable RBAC\n' +
                '5. User → Roles: assign admin\n' +
                '6. Sign out, clear site data for localhost:4200 if needed, sign in again\n' +
                '\nDecoded ID token payload:',
              payload ?? '(could not decode)',
            );
          }
          this.session.setSession({
            userId: user.sub ?? user.email ?? 'auth0-user',
            displayName: displayNameFromUser(user),
            email: typeof user.email === 'string' ? user.email : undefined,
            role,
          });
          return;
        }
        this.session.clear();
      });
  }
}

/** Prefer the email local-part (before @) over full email / Auth0 name. */
function displayNameFromUser(user: User): string {
  if (typeof user.email === 'string' && user.email.includes('@')) {
    const local = user.email.slice(0, user.email.indexOf('@')).trim();
    if (local) {
      return local;
    }
  }
  const name = user.name?.trim();
  if (name && !name.includes('@')) {
    return name;
  }
  const nickname = user.nickname?.trim();
  if (nickname && !nickname.includes('@')) {
    return nickname;
  }
  return 'User';
}

/** ID-token claims win over user$ so namespaced role claims are preserved. */
export function mergeClaims(
  user: User | null | undefined,
  claims: IdToken | null | undefined,
): Record<string, unknown> {
  return {
    ...(user && typeof user === 'object' ? (user as Record<string, unknown>) : {}),
    ...(claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : {}),
  };
}

function decodeJwtPayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.includes('.')) {
    return null;
  }
  try {
    const segment = raw.split('.')[1];
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
