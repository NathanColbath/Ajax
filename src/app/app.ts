import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { Auth0SessionBridge } from './core/auth/auth0-session.bridge';

@Component({
  selector: 'ajax-root',
  imports: [RouterOutlet, AsyncPipe],
  template: `
    @if (auth.isLoading$ | async) {
      <div class="auth-loading">Checking session…</div>
    } @else {
      <router-outlet />
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .auth-loading {
      display: grid;
      place-items: center;
      min-height: 100vh;
      font: inherit;
      opacity: 0.75;
    }
  `,
})
export class App implements OnInit {
  readonly auth = inject(AuthService);
  private readonly bridge = inject(Auth0SessionBridge);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.bridge.start();
    // Auth0 SDK navigates via appState.target after callback; keep /login clear if already signed in.
    this.auth.isAuthenticated$.subscribe((isAuthenticated) => {
      if (isAuthenticated && this.router.url.startsWith('/login')) {
        const tree = this.router.parseUrl(this.router.url);
        const returnUrl = tree.queryParams['returnUrl'];
        const target =
          typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
            ? returnUrl
            : '/';
        void this.router.navigateByUrl(target);
      }
    });
  }
}
