import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap, catchError } from 'rxjs';
import { UserPreferencesApi } from '../../api/users/user-preferences.api';
import {
  UpdateUserPreferencesRequest,
  UserPreferences,
} from '../../api/users/user-preferences.models';
import {
  DASHBOARD_SECTIONS,
  DEFAULT_DASHBOARD_SECTION_ORDER,
  DashboardSectionId,
} from '../layout/dashboard-sections';
import { APP_NAV_ITEMS } from '../layout/nav-items';
import { SessionService } from '../auth/session.service';

function mergePreferences(raw: UserPreferences | null | undefined): UserPreferences {
  const knownSections = new Set(DEFAULT_DASHBOARD_SECTION_ORDER);
  const knownPaths = new Set(APP_NAV_ITEMS.map((i) => i.path));

  const order: string[] = [];
  for (const id of raw?.dashboardSectionOrder ?? []) {
    if (knownSections.has(id as DashboardSectionId) && !order.includes(id)) {
      order.push(id);
    }
  }
  for (const id of DEFAULT_DASHBOARD_SECTION_ORDER) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  const hidden = [...new Set((raw?.dashboardHidden ?? []).filter((id) => knownSections.has(id as DashboardSectionId)))];
  const more = [...new Set((raw?.navMorePaths ?? []).filter((p) => knownPaths.has(p)))];

  return {
    dashboardSectionOrder: order,
    dashboardHidden: hidden,
    navMorePaths: more,
  };
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly api = inject(UserPreferencesApi);
  private readonly session = inject(SessionService);

  private readonly prefsSignal = signal<UserPreferences>(mergePreferences(null));
  private readonly loadedSignal = signal(false);
  private loadStarted = false;

  readonly preferences = this.prefsSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  readonly dashboardSectionOrder = computed(() => this.prefsSignal().dashboardSectionOrder);
  readonly dashboardHidden = computed(() => new Set(this.prefsSignal().dashboardHidden));
  readonly navMorePaths = computed(() => new Set(this.prefsSignal().navMorePaths));

  readonly visibleDashboardSections = computed(() => {
    const hidden = this.dashboardHidden();
    const isAdmin = this.session.isAtLeast('admin');
    return this.dashboardSectionOrder()
      .map((id) => DASHBOARD_SECTIONS.find((s) => s.id === id))
      .filter((s): s is (typeof DASHBOARD_SECTIONS)[number] => !!s)
      .filter((s) => !hidden.has(s.id))
      .filter((s) => !s.adminOnly || isAdmin);
  });

  ensureLoaded(): void {
    if (this.loadStarted) {
      return;
    }
    this.loadStarted = true;
    this.api.get().subscribe({
      next: (prefs) => {
        this.prefsSignal.set(mergePreferences(prefs));
        this.loadedSignal.set(true);
      },
      error: () => {
        this.prefsSignal.set(mergePreferences(null));
        this.loadedSignal.set(true);
      },
    });
  }

  save(request: UpdateUserPreferencesRequest): Observable<UserPreferences> {
    const merged = mergePreferences({
      dashboardSectionOrder: request.dashboardSectionOrder ?? this.prefsSignal().dashboardSectionOrder,
      dashboardHidden: request.dashboardHidden ?? this.prefsSignal().dashboardHidden,
      navMorePaths: request.navMorePaths ?? this.prefsSignal().navMorePaths,
    });

    return this.api.update(merged).pipe(
      tap((saved) => {
        this.prefsSignal.set(mergePreferences(saved));
        this.loadedSignal.set(true);
      }),
      catchError(() => {
        this.prefsSignal.set(merged);
        return of(merged);
      }),
    );
  }
}
