import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  DASHBOARD_SECTIONS,
  DashboardSectionId,
} from '../../core/layout/dashboard-sections';
import { APP_NAV_ITEMS, NavItem } from '../../core/layout/nav-items';
import { LibrarySettingsService } from '../../core/config/library-settings.service';
import { SessionService } from '../../core/auth/session.service';
import { UserPreferencesService } from '../../core/preferences/user-preferences.service';
import {
  AjaxAccordion,
  AjaxButton,
  AjaxExpansion,
  AjaxSlideToggle,
  AjaxSpinner,
} from '../../shared/ui';

interface DashboardEditorRow {
  id: DashboardSectionId;
  label: string;
  visible: boolean;
}

@Component({
  selector: 'ajax-settings-page',
  standalone: true,
  imports: [
    FormsModule,
    AjaxAccordion,
    AjaxExpansion,
    AjaxSlideToggle,
    AjaxButton,
    AjaxSpinner,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly prefs = inject(UserPreferencesService);
  private readonly session = inject(SessionService);
  private readonly librarySettings = inject(LibrarySettingsService);
  private readonly destroyRef = inject(DestroyRef);

  emailDigest = true;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savedFlash = signal(false);
  readonly dashboardRows = signal<DashboardEditorRow[]>([]);
  readonly navMore = signal<Record<string, boolean>>({});

  readonly configurableNavItems = computed(() =>
    APP_NAV_ITEMS.filter((item) => this.canSeeNav(item)),
  );

  constructor() {
    this.librarySettings.ensureLoaded();
    this.prefs.ensureLoaded();

    effect(() => {
      if (!this.prefs.loaded()) {
        return;
      }
      this.syncFromStore();
      this.loading.set(false);
    });
  }

  moveUp(index: number): void {
    if (index <= 0) {
      return;
    }
    this.dashboardRows.update((rows) => {
      const next = [...rows];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  moveDown(index: number): void {
    this.dashboardRows.update((rows) => {
      if (index >= rows.length - 1) {
        return rows;
      }
      const next = [...rows];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  setSectionVisible(id: DashboardSectionId, visible: boolean): void {
    this.dashboardRows.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, visible } : row)),
    );
  }

  setNavInMore(path: string, inMore: boolean): void {
    this.navMore.update((current) => ({ ...current, [path]: inMore }));
  }

  isNavInMore(path: string): boolean {
    return !!this.navMore()[path];
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.savedFlash.set(false);
    const rows = this.dashboardRows();
    const order = rows.map((r) => r.id);
    const hidden = rows.filter((r) => !r.visible).map((r) => r.id);
    const isAdmin = this.session.isAtLeast('admin');
    if (!isAdmin) {
      const prev = this.prefs.preferences();
      for (const def of DASHBOARD_SECTIONS) {
        if (!def.adminOnly) {
          continue;
        }
        if (!order.includes(def.id)) {
          const idx = prev.dashboardSectionOrder.indexOf(def.id);
          if (idx >= 0 && idx <= order.length) {
            order.splice(idx, 0, def.id);
          } else {
            order.push(def.id);
          }
        }
        if (prev.dashboardHidden.includes(def.id) && !hidden.includes(def.id)) {
          hidden.push(def.id);
        }
      }
    }

    const navMorePaths = Object.entries(this.navMore())
      .filter(([, inMore]) => inMore)
      .map(([path]) => path);

    this.prefs
      .save({
        dashboardSectionOrder: order,
        dashboardHidden: hidden,
        navMorePaths,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.savedFlash.set(true);
          window.setTimeout(() => this.savedFlash.set(false), 2000);
        },
        error: () => this.saving.set(false),
      });
  }

  private syncFromStore(): void {
    const order = this.prefs.dashboardSectionOrder();
    const hidden = this.prefs.dashboardHidden();
    const isAdmin = this.session.isAtLeast('admin');

    const defs = new Map(DASHBOARD_SECTIONS.map((s) => [s.id, s]));
    const rows: DashboardEditorRow[] = [];
    for (const id of order) {
      const def = defs.get(id as DashboardSectionId);
      if (!def) {
        continue;
      }
      if (def.adminOnly && !isAdmin) {
        continue;
      }
      rows.push({
        id: def.id,
        label: def.label,
        visible: !hidden.has(def.id),
      });
    }
    this.dashboardRows.set(rows);

    const more: Record<string, boolean> = {};
    for (const item of APP_NAV_ITEMS) {
      more[item.path] = this.prefs.navMorePaths().has(item.path);
    }
    this.navMore.set(more);
  }

  private canSeeNav(item: NavItem): boolean {
    if (item.path === '/uploads') {
      return this.session.isAtLeast('admin') || this.librarySettings.allowStandardUploads();
    }
    if (!item.minRole) {
      return true;
    }
    return this.session.isAtLeast(item.minRole);
  }
}
