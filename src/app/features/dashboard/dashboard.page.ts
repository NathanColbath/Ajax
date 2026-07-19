import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardApi, DashboardSnapshot } from '../../api';
import { AjaxEmptyState, AjaxStatusChip } from '../../shared/interactions';
import { AjaxButton, AjaxCard, AjaxIcon, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-dashboard-page',
  standalone: true,
  imports: [RouterLink, AjaxButton, AjaxCard, AjaxIcon, AjaxSpinner, AjaxEmptyState, AjaxStatusChip],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);

  readonly loading = signal(true);
  readonly snapshot = signal<DashboardSnapshot | null>(null);

  constructor() {
    this.api.getSnapshot().subscribe({
      next: (data) => {
        this.snapshot.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
