import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideAuth0 } from '@auth0/auth0-angular';

import { provideApi } from './core/api';
import {
  AUTH0_APP_ORIGIN,
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
} from './core/auth/auth0.config';
import { routes } from './app.routes';
import { provideAjaxInteractions } from './shared/interactions';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideAuth0({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: AUTH0_APP_ORIGIN,
        audience: AUTH0_AUDIENCE,
        // offline_access → refresh token; audience → RBAC roles in Post-Login Action
        scope: 'openid profile email offline_access',
      },
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      cacheLocation: 'localstorage',
    }),
    ...provideApi({ mode: 'mock', baseUrl: '/api' }),
    ...provideAjaxInteractions(),
  ],
};
