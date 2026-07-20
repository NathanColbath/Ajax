import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { filter, map, startWith } from 'rxjs/operators';
import { AUTH0_APP_ORIGIN } from '../auth/auth0.config';
import { SessionService } from '../auth/session.service';
import { LibrarySettingsService } from '../config/library-settings.service';
import { AjaxButton, AjaxDrawer, AjaxIcon, AjaxToolbar, AjaxTooltip } from '../../shared/ui';
import { APP_NAV_ITEMS, NavItem } from './nav-items';
import { APP_VERSION } from '../version';

@Component({
  selector: 'ajax-app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AjaxDrawer,
    AjaxToolbar,
    AjaxButton,
    AjaxIcon,
    AjaxTooltip,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly auth = inject(AuthService);
  readonly sessionService = inject(SessionService);
  private readonly librarySettings = inject(LibrarySettingsService);
  protected readonly window = window;
  readonly appVersion = APP_VERSION;

  readonly drawerOpen = signal(true);
  /** Desktop rail: icons only. Independent of mobile open/close. */
  readonly navCollapsed = signal(false);

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
        return (route.data['title'] as string | undefined) ?? 'Retrojax';
      }),
    ),
    { initialValue: 'Retrojax' },
  );

  readonly navItems = computed(() => APP_NAV_ITEMS.filter((item) => this.canSee(item)));
  readonly displayName = computed(() => this.sessionService.displayName() ?? 'Guest');
  readonly roleLabel = computed(() => this.sessionService.role()?.replace('_', ' ') ?? '');
  readonly libraryName = computed(() => this.librarySettings.libraryName());
  readonly navToggleIcon = computed(() => {
    if (this.isHandset()) {
      return 'menu';
    }
    return this.navCollapsed() ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left';
  });
  readonly navToggleLabel = computed(() => {
    if (this.isHandset()) {
      return this.drawerOpen() ? 'Close navigation' : 'Open navigation';
    }
    return this.navCollapsed() ? 'Expand navigation' : 'Collapse navigation';
  });
  readonly drawerWidth = computed(() =>
    this.navCollapsed() && !this.isHandset() ? 64 : 248,
  );

  constructor() {
    this.librarySettings.ensureLoaded();
    this.breakpoints.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).subscribe((result) => {
      this.drawerOpen.set(!result.matches);
      if (result.matches) {
        this.navCollapsed.set(false);
      }
    });
  }

  private canSee(item: NavItem): boolean {
    if (item.path === '/uploads') {
      return this.sessionService.isAtLeast('admin') || this.librarySettings.allowStandardUploads();
    }
    if (!item.minRole) {
      return true;
    }
    return this.sessionService.isAtLeast(item.minRole);
  }

  toggleNav(): void {
    if (this.isHandset()) {
      this.drawerOpen.update((open) => !open);
      return;
    }
    this.navCollapsed.update((collapsed) => !collapsed);
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
