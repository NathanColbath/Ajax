import { Injectable, computed, signal } from '@angular/core';
import { AuthSession } from '../../api/auth/auth.models';
import { ROLE_RANK, UserRole } from '../../api/users/users.models';

const LEGACY_SESSION_KEY = 'ajax.session';

/**
 * In-memory session only. Auth0SessionBridge is the sole writer while Auth0 owns auth
 * (avoids stale localStorage flashing a mock/super_admin session before Auth0 loads).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly sessionSignal = signal<AuthSession | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly role = computed(() => this.sessionSignal()?.role ?? null);
  readonly userId = computed(() => this.sessionSignal()?.userId ?? null);
  readonly displayName = computed(() => this.sessionSignal()?.displayName ?? null);
  readonly email = computed(() => this.sessionSignal()?.email ?? null);

  constructor() {
    try {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // ignore
    }
  }

  setSession(session: AuthSession): void {
    this.sessionSignal.set(session);
  }

  clear(): void {
    this.sessionSignal.set(null);
  }

  hasRole(role: UserRole): boolean {
    return this.sessionSignal()?.role === role;
  }

  /** True if current role is at least as privileged as `minimum`. */
  isAtLeast(minimum: UserRole): boolean {
    const current = this.sessionSignal()?.role;
    if (!current) {
      return false;
    }
    return ROLE_RANK[current] >= ROLE_RANK[minimum];
  }

  isSuperAdmin(): boolean {
    return this.hasRole('super_admin');
  }

  canAccessConfig(): boolean {
    return this.isAtLeast('admin');
  }

  canManageUsers(): boolean {
    return this.isAtLeast('admin');
  }

  canSeeStorageMetrics(): boolean {
    return this.isSuperAdmin();
  }
}
