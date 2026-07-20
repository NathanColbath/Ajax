import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, catchError, of } from 'rxjs';
import { AJAX_API_BASE_URL } from '../api/api-mode';

/**
 * Attaches Auth0 access token to requests targeting the Game Library API base URL.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(AJAX_API_BASE_URL);
  const auth = inject(AuthService);

  if (!req.url.startsWith(baseUrl)) {
    return next(req);
  }

  return auth.getAccessTokenSilently().pipe(
    catchError(() => of(null as string | null)),
    switchMap((token) => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        }),
      );
    }),
  );
};
