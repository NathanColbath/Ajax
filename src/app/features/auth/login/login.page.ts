import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { AjaxButton } from '../../../shared/ui';

@Component({
  selector: 'ajax-login-page',
  standalone: true,
  imports: [AsyncPipe, AjaxButton],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly window = window;

  login(): void {
    this.auth
      .loginWithRedirect({
        appState: { target: this.returnTarget() },
      })
      .subscribe();
  }

  signUp(): void {
    this.auth
      .loginWithRedirect({
        authorizationParams: { screen_hint: 'signup' },
        appState: { target: this.returnTarget() },
      })
      .subscribe();
  }

  private returnTarget(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      return returnUrl;
    }
    return '/';
  }
}
