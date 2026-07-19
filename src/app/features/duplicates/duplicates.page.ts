import { Component, inject, signal } from '@angular/core';
import { DuplicateGroup, DuplicatesApi } from '../../api';
import { AjaxConfirmationService, AjaxEmptyState, AjaxFeedbackService } from '../../shared/interactions';
import { AjaxButton, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-duplicates-page',
  standalone: true,
  imports: [AjaxButton, AjaxSpinner, AjaxEmptyState],
  templateUrl: './duplicates.page.html',
  styleUrl: './duplicates.page.scss',
})
export class DuplicatesPage {
  private readonly api = inject(DuplicatesApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);

  readonly loading = signal(true);
  readonly groups = signal<DuplicateGroup[]>([]);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  async keep(groupId: string, fileId: string, name: string): Promise<void> {
    const ok = await this.confirmation.confirm({
      title: 'Keep this file?',
      message: `Keep “${name}” and remove the other copies from this group.`,
      confirmLabel: 'Keep',
      severity: 'warning',
    });
    if (!ok) {
      return;
    }
    this.api.keep(groupId, fileId).subscribe((groups) => {
      this.groups.set(groups);
      this.feedback.success('Duplicate group resolved');
    });
  }

  keepBoth(groupId: string): void {
    this.api.keepBoth(groupId).subscribe((groups) => {
      this.groups.set(groups);
      this.feedback.info('Marked as intentional duplicates');
    });
  }
}
