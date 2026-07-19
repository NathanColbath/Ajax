import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { filter, map, startWith } from 'rxjs/operators';
import { AUTH0_APP_ORIGIN } from '../auth/auth0.config';
import { SessionService } from '../auth/session.service';
import { AjaxButton, AjaxDrawer, AjaxIcon, AjaxToolbar } from '../../shared/ui';
import { APP_NAV_FOOTER, APP_NAV_ITEMS, NavItem } from './nav-items';

@Component({
  selector: 'ajax-app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AjaxDrawer, AjaxToolbar, AjaxButton, AjaxIcon],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly auth = inject(AuthService);
  readonly sessionService = inject(SessionService);
  protected readonly window = window;

  readonly drawerOpen = signal(true);

  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).pipe(
      map((result) => result.matches),
    ),
    { initialValue: false },
  );

  readonly drawerMode = computed(() => (this.isHandset() ? 'over' : 'side'));

  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return (route.data['title'] as string | undefined) ?? 'Game Library';
      }),
    ),
    { initialValue: 'Game Library' },
  );

  readonly navItems = computed(() => APP_NAV_ITEMS.filter((item) => this.canSee(item)));
  readonly footerItems = computed(() => APP_NAV_FOOTER.filter((item) => this.canSee(item)));
  readonly displayName = computed(() => this.sessionService.displayName() ?? 'Guest');
  readonly roleLabel = computed(() => this.sessionService.role()?.replace('_', ' ') ?? '');

  constructor() {
    this.breakpoints.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).subscribe((result) => {
      this.drawerOpen.set(!result.matches);
    });
  }

  private canSee(item: NavItem): boolean {
    if (!item.minRole) {
      return true;
    }
    return this.sessionService.isAtLeast(item.minRole);
  }

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  onNavClick(): void {
    if (this.isHandset()) {
      this.drawerOpen.set(false);
    }
  }

  signOut(): void {
    this.sessionService.clear();
    this.auth
      .logout({
        logoutParams: {
          returnTo: AUTH0_APP_ORIGIN,
        },
      })
      .subscribe();
  }
}
