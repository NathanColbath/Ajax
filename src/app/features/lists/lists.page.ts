import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ListsApi, UserGameListSummary } from '../../api';
import { apiErrorMessage } from '../../core/api';
import {
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
} from '../../shared/interactions';
import { AjaxButton, AjaxDialog, AjaxSpinner } from '../../shared/ui';
import { CreateListDialog } from './create-list.dialog';

@Component({
  selector: 'ajax-lists-page',
  standalone: true,
  imports: [DatePipe, AjaxButton, AjaxSpinner, AjaxEmptyState],
  templateUrl: './lists.page.html',
  styleUrl: './lists.page.scss',
})
export class ListsPage {
  private readonly listsApi = inject(ListsApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly dialog = inject(AjaxDialog);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly lists = signal<UserGameListSummary[]>([]);
  readonly busy = signal(false);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.listsApi.list().subscribe({
      next: (lists) => {
        this.lists.set(lists);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.feedback.warning(apiErrorMessage(err, 'Could not load lists'));
      },
    });
  }

  openList(list: UserGameListSummary): void {
    void this.router.navigate(['/lists', list.id]);
  }

  openCreate(): void {
    this.dialog
      .open<CreateListDialog, undefined, string>(CreateListDialog, { width: '420px' })
      .afterClosed()
      .subscribe((name) => {
        if (!name?.trim()) {
          return;
        }
        this.busy.set(true);
        this.listsApi.create(name.trim()).subscribe({
          next: (created) => {
            this.busy.set(false);
            this.feedback.success(`Created “${created.name}”`);
            void this.router.navigate(['/lists', created.id]);
          },
          error: (err) => {
            this.busy.set(false);
            this.feedback.warning(apiErrorMessage(err, 'Could not create list'));
          },
        });
      });
  }

  async deleteList(list: UserGameListSummary, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const ok = await this.confirmation.confirm({
      title: 'Delete list?',
      message: `Remove “${list.name}”? Games stay in your library.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.listsApi.delete(list.id).subscribe({
      next: () => {
        this.feedback.success('List deleted');
        this.reload();
      },
      error: (err) => this.feedback.warning(apiErrorMessage(err, 'Could not delete list')),
    });
  }
}
