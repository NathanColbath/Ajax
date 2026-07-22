import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import {
  GameSystem,
  LocationType,
  LocationsApi,
  PhysicalApi,
  PhysicalItem,
  PhysicalLocation,
  PhysicalTitleSearchResult,
  SystemsApi,
} from '../../api';
import { apiErrorMessage } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import {
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
} from '../../shared/interactions';
import { CoverCacheService } from '../../shared/media/cover-cache.service';
import {
  AjaxButton,
  AjaxInput,
  AjaxPagination,
  AjaxSelect,
  AjaxSelectOption,
  AjaxSpinner,
  AjaxTable,
  AjaxTableColumn,
} from '../../shared/ui';

@Component({
  selector: 'ajax-physical-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    AjaxButton,
    AjaxInput,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxPagination,
    AjaxTable,
  ],
  templateUrl: './physical.page.html',
  styleUrl: './physical.page.scss',
})
export class PhysicalPage implements OnDestroy {
  private readonly api = inject(PhysicalApi);
  private readonly coverCache = inject(CoverCacheService);
  private readonly locationsApi = inject(LocationsApi);
  private readonly systemsApi = inject(SystemsApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAdmin = this.session.isAtLeast('admin');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly items = signal<PhysicalItem[]>([]);
  readonly locations = signal<PhysicalLocation[]>([]);
  readonly systems = signal<GameSystem[]>([]);
  readonly locationId = signal<string | undefined>(undefined);
  readonly selectedSystem = signal<string | undefined>(undefined);
  readonly statusFilter = signal<'' | 'in' | 'out'>('');
  readonly search = signal('');
  readonly view = signal<'grid' | 'list' | 'table'>('grid');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(8);
  readonly coverUrls = signal<Record<string, string>>({});

  readonly locationFilter = computed(() => this.locationId() ?? '');
  readonly systemFilter = computed(() => this.selectedSystem() ?? '');

  readonly showLocationForm = signal(false);
  readonly editingLocationId = signal<string | null>(null);
  readonly showAddGame = signal(false);
  readonly editingItemId = signal<string | null>(null);

  readonly searchResults = signal<PhysicalTitleSearchResult[]>([]);
  readonly searching = signal(false);
  readonly selectedHit = signal<PhysicalTitleSearchResult | null>(null);

  newLocationName = '';
  newLocationType: LocationType = 'shelf';
  newLocationNotes = '';

  addSystemId = '';
  addLocationId = '';
  addCondition = 'good';
  addCompleteness = 'cib';
  titleQuery = '';

  editLocationId = '';
  editCondition = 'good';
  editCompleteness = 'cib';

  private searchTimer: number | undefined;

  readonly systemFacets = computed(() => {
    const fromCatalog = this.systems()
      .map((s) => s.shortName || s.name)
      .filter(Boolean);
    const fromItems = this.items().map((i) => i.system).filter(Boolean);
    return [...new Set([...fromCatalog, ...fromItems])].sort((a, b) => a.localeCompare(b));
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.search().trim()
      || !!this.locationId()
      || !!this.selectedSystem()
      || !!this.statusFilter(),
  );

  readonly filteredItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    const system = this.selectedSystem();
    const status = this.statusFilter();
    return this.items().filter((item) => {
      if (system && item.system !== system) {
        return false;
      }
      if (status === 'in' && item.checkedOut) {
        return false;
      }
      if (status === 'out' && !item.checkedOut) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(q)
        || item.system.toLowerCase().includes(q)
        || item.locationName.toLowerCase().includes(q)
      );
    });
  });

  readonly pagedItems = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  readonly columns: AjaxTableColumn<PhysicalItem>[] = [
    { key: 'title', header: 'Title' },
    { key: 'system', header: 'System' },
    { key: 'locationName', header: 'Location' },
    { key: 'condition', header: 'Condition' },
    { key: 'completeness', header: 'Completeness' },
    {
      key: 'checkedOut',
      header: 'Status',
      cell: (row) => (row.checkedOut ? `Out · ${row.borrower ?? 'Guest'}` : 'In'),
    },
  ];

  constructor() {
    this.reloadLocations();
    this.reloadSystems();
    this.reload();

    effect((onCleanup) => {
      const page = this.pagedItems();
      const view = this.view();
      if (view !== 'grid' && view !== 'list') {
        return;
      }

      const subs = page
        .filter((item) => item.hasArt && item.gameId)
        .map((item) =>
          this.coverCache.getCoverUrl(item.gameId!, 'thumb').subscribe({
            next: (url) => {
              if (!url) {
                return;
              }
              this.coverUrls.update((current) => ({ ...current, [item.id]: url }));
            },
          }),
        );

      onCleanup(() => {
        for (const sub of subs) {
          sub.unsubscribe();
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.searchTimer != null) {
      window.clearTimeout(this.searchTimer);
    }
  }

  coverFor(item: PhysicalItem): string | null {
    return this.coverUrls()[item.id] ?? null;
  }

  metaLine(item: PhysicalItem): string {
    const bits = [item.system, item.locationName];
    if (item.year > 0) {
      bits.push(String(item.year));
    }
    bits.push(item.condition);
    if (item.checkedOut) {
      bits.push(`Out · ${item.borrower || 'Guest'}`);
    }
    return bits.join(' · ');
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.pageIndex.set(0);
  }

  onLocationFilter(value: string): void {
    const id = value?.trim() ? value : undefined;
    this.locationId.set(id);
    this.pageIndex.set(0);
    this.reload();
  }

  onSystemFilter(value: string): void {
    this.selectedSystem.set(value?.trim() ? value : undefined);
    this.pageIndex.set(0);
  }

  onStatusFilter(value: string): void {
    const next = value === 'in' || value === 'out' ? value : '';
    this.statusFilter.set(next);
    this.pageIndex.set(0);
  }

  clearFilters(): void {
    this.search.set('');
    this.selectedSystem.set(undefined);
    this.statusFilter.set('');
    if (this.locationId()) {
      this.locationId.set(undefined);
      this.reload();
    }
    this.pageIndex.set(0);
  }

  setView(view: 'grid' | 'list' | 'table'): void {
    this.view.set(view);
  }

  reloadLocations(): void {
    this.locationsApi.list().subscribe((locations) => this.locations.set(locations));
  }

  reloadSystems(): void {
    this.systemsApi.list().subscribe({
      next: (systems) => this.systems.set(systems.filter((s) => s.status !== 'archived')),
      error: () => this.systems.set([]),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.api.list(this.locationId()).subscribe({
      next: (items) => {
        this.items.set(items);
        this.pageIndex.set(0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateLocation(): void {
    this.editingLocationId.set(null);
    this.newLocationName = '';
    this.newLocationType = 'shelf';
    this.newLocationNotes = '';
    this.showLocationForm.set(true);
  }

  openEditLocation(loc: PhysicalLocation): void {
    this.editingLocationId.set(loc.id);
    this.newLocationName = loc.name;
    this.newLocationType = (loc.type as LocationType) || 'shelf';
    this.newLocationNotes = loc.notes ?? '';
    this.showLocationForm.set(true);
  }

  saveLocation(): void {
    if (!this.newLocationName.trim()) {
      this.feedback.warning('Location name is required');
      return;
    }
    const payload = {
      name: this.newLocationName,
      type: this.newLocationType,
      notes: this.newLocationNotes || undefined,
    };
    const editId = this.editingLocationId();
    this.busy.set(true);
    const req = editId
      ? this.locationsApi.update(editId, payload)
      : this.locationsApi.create(payload);
    req.subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.showLocationForm.set(false);
        this.reloadLocations();
        this.feedback.success(editId ? `Updated ${saved.name}` : `Created ${saved.name}`);
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.error(apiErrorMessage(err, 'Could not save location'));
      },
    });
  }

  async deleteLocation(loc: PhysicalLocation): Promise<void> {
    const ok = await this.confirmation.confirm({
      title: 'Delete location?',
      message: `Delete “${loc.name}”. Locations with items cannot be deleted.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.locationsApi.delete(loc.id).subscribe({
      next: () => {
        this.locations.update((list) => list.filter((l) => l.id !== loc.id));
        if (this.locationId() === loc.id) {
          this.onLocationFilter('');
        }
        this.feedback.success(`Deleted ${loc.name}`);
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete location')),
    });
  }

  openAddGame(): void {
    this.showAddGame.set(true);
    this.selectedHit.set(null);
    this.searchResults.set([]);
    this.titleQuery = '';
    this.addSystemId = this.systems()[0]?.id ?? '';
    this.addLocationId = this.locationId() ?? this.locations()[0]?.id ?? '';
    this.addCondition = 'good';
    this.addCompleteness = 'cib';
  }

  onTitleSearch(value: string): void {
    this.titleQuery = value;
    this.selectedHit.set(null);
    if (this.searchTimer != null) {
      window.clearTimeout(this.searchTimer);
    }
    const q = value.trim();
    if (q.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = window.setTimeout(() => this.runTitleSearch(q), 300);
  }

  private runTitleSearch(q: string): void {
    this.searching.set(true);
    this.api.searchTitles(q, this.addSystemId || undefined).subscribe({
      next: (hits) => {
        this.searchResults.set(hits);
        this.searching.set(false);
      },
      error: (err) => {
        this.searching.set(false);
        this.searchResults.set([]);
        this.feedback.warning(apiErrorMessage(err, 'Title search failed'));
      },
    });
  }

  pickHit(hit: PhysicalTitleSearchResult): void {
    this.selectedHit.set(hit);
    this.titleQuery = hit.title;
    this.searchResults.set([]);
  }

  savePhysicalGame(): void {
    const hit = this.selectedHit();
    if (!hit) {
      this.feedback.warning('Pick a title from search results');
      return;
    }
    if (!this.addSystemId) {
      this.feedback.warning('Select a system');
      return;
    }
    if (!this.addLocationId) {
      this.feedback.warning('Select a location');
      return;
    }
    this.busy.set(true);
    this.api
      .create({
        locationId: this.addLocationId,
        systemId: this.addSystemId,
        condition: this.addCondition,
        completeness: this.addCompleteness,
        igdbId: hit.igdbId ?? null,
        title: hit.title,
        externalId: hit.externalId ?? null,
        sampleMd5: hit.sampleMd5 ?? null,
      })
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.showAddGame.set(false);
          this.feedback.success(
            created.hasArt ? `Added ${created.title} with cover` : `Added ${created.title}`,
          );
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          this.feedback.error(apiErrorMessage(err, 'Could not add physical game'));
        },
      });
  }

  startEditItem(item: PhysicalItem): void {
    this.editingItemId.set(item.id);
    this.editLocationId = item.locationId;
    this.editCondition = String(item.condition);
    this.editCompleteness = String(item.completeness);
  }

  cancelEditItem(): void {
    this.editingItemId.set(null);
  }

  saveEditItem(item: PhysicalItem): void {
    this.busy.set(true);
    this.api
      .update(item.id, {
        locationId: this.editLocationId,
        condition: this.editCondition,
        completeness: this.editCompleteness,
      })
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.editingItemId.set(null);
          this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
          this.feedback.success('Item updated');
        },
        error: (err) => {
          this.busy.set(false);
          this.feedback.error(apiErrorMessage(err, 'Could not update item'));
        },
      });
  }

  toggleCheckout(item: PhysicalItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.api.toggleCheckout(item.id).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
        this.feedback.info(updated.checkedOut ? `Checked out to ${updated.borrower}` : 'Checked in');
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Checkout failed')),
    });
  }

  async deleteItem(item: PhysicalItem, event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    const ok = await this.confirmation.confirm({
      title: 'Delete physical item?',
      message: `Remove “${item.title}” from physical inventory. The catalog game stays.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.delete(item.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((i) => i.id !== item.id));
        this.feedback.success(`Deleted ${item.title}`);
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete item')),
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  hitLabel(hit: PhysicalTitleSearchResult): string {
    const bits = [hit.title];
    if (hit.year) {
      bits.push(String(hit.year));
    }
    if (hit.platforms.length) {
      bits.push(hit.platforms.slice(0, 2).join(', '));
    }
    return bits.join(' · ');
  }
}
