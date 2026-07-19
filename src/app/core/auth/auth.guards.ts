import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { combineLatest } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { ROLE_RANK, UserRole } from '../../api/users/users.models';
import { mergeClaims } from './auth0-session.bridge';
import { readHighestRole } from './auth-roles';

/** Wait for Auth0; redirect to /login with returnUrl when unauthenticated. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return combineLatest([auth.isLoading$, auth.isAuthenticated$]).pipe(
    filter(([loading]) => !loading),
    take(1),
    map(([, isAuthenticated]) => {
      if (isAuthenticated) {
        return true;
      }
      return router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
    }),
  );
};

/**
 * Requires route data.minRole. Reads role from ID-token claims so it matches
 * Auth0SessionBridge even before SessionService is updated.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const minimum = route.data['minRole'] as UserRole | undefined;

  if (!minimum) {
    return true;
  }

  return combineLatest([
    auth.isLoading$,
    auth.isAuthenticated$,
    auth.user$,
    auth.idTokenClaims$,
  ]).pipe(
    filter(([loading]) => !loading),
    take(1),
    map(([, isAuthenticated, user, claims]) => {
      if (!isAuthenticated) {
        return router.createUrlTree(['/login']);
      }
      const role = readHighestRole(mergeClaims(user, claims));
      if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
        return router.createUrlTree(['/']);
      }
      return true;
    }),
  );
};

/** Blocks /login when already authenticated; honors returnUrl query. */
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return combineLatest([auth.isLoading$, auth.isAuthenticated$]).pipe(
    filter(([loading]) => !loading),
    take(1),
    map(([, isAuthenticated]) => {
      if (!isAuthenticated) {
        return true;
      }
      const returnUrl = route.queryParamMap.get('returnUrl') || '/';
      return router.parseUrl(returnUrl.startsWith('/') ? returnUrl : '/');
    }),
  );
};
