import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { LocationsApi, PhysicalApi, PhysicalItem, PhysicalLocation, LocationType } from '../../api';
import { AjaxEmptyState, AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
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
    AjaxButton,
    AjaxInput,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxStatusChip,
    AjaxTable,
    AjaxPagination,
  ],
  templateUrl: './physical.page.html',
  styleUrl: './physical.page.scss',
})
export class PhysicalPage {
  private readonly api = inject(PhysicalApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly feedback = inject(AjaxFeedbackService);

  readonly loading = signal(true);
  readonly items = signal<PhysicalItem[]>([]);
  readonly locations = signal<PhysicalLocation[]>([]);
  readonly locationId = signal<string | undefined>(undefined);
  readonly view = signal<'cards' | 'table'>('cards');
  readonly showCreate = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);

  newLocationName = '';
  newLocationType: LocationType = 'shelf';
  newLocationNotes = '';

  readonly columns: AjaxTableColumn<PhysicalItem>[] = [
    { key: 'title', header: 'Title' },
    { key: 'system', header: 'System' },
    { key: 'locationName', header: 'Location' },
    { key: 'condition', header: 'Condition' },
    {
      key: 'checkedOut',
      header: 'Status',
      cell: (row) => (row.checkedOut ? `Out · ${row.borrower ?? 'Guest'}` : 'In'),
    },
  ];

  readonly pagedItems = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.items().slice(start, start + this.pageSize());
  });

  constructor() {
    this.reloadLocations();
    this.reload();
  }

  reloadLocations(): void {
    this.locationsApi.list().subscribe((locations) => this.locations.set(locations));
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

  filterLocation(id?: string): void {
    this.locationId.set(id);
    this.reload();
  }

  toggleCheckout(item: PhysicalItem): void {
    this.api.toggleCheckout(item.id).subscribe((updated) => {
      this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      this.feedback.info(updated.checkedOut ? `Checked out to ${updated.borrower}` : 'Checked in');
    });
  }

  createLocation(): void {
    if (!this.newLocationName.trim()) {
      this.feedback.warning('Location name is required');
      return;
    }
    this.locationsApi
      .create({
        name: this.newLocationName,
        type: this.newLocationType,
        notes: this.newLocationNotes || undefined,
      })
      .subscribe((created) => {
        this.locations.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
        this.showCreate.set(false);
        this.newLocationName = '';
        this.newLocationNotes = '';
        this.newLocationType = 'shelf';
        this.feedback.success(`Created ${created.name}`);
      });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
