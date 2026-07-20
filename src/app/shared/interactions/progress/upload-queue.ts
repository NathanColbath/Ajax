import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AjaxUploadItem } from '../models/action-state';

export type AjaxUploadQueueMode = 'active' | 'history';

@Component({
  selector: 'ajax-upload-queue',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <ul class="queue" [attr.aria-label]="mode() === 'history' ? 'Past uploads' : 'Active upload queue'">
      @for (item of items(); track item.id) {
        <li class="item" [attr.data-state]="item.state">
          <div class="item__main">
            <div class="item__name">{{ item.name }}</div>
            <div class="item__meta">
              {{ formatSize(item.size) }}
              ·
              {{ item.state }}
              @if (item.message) {
                — {{ item.message }}
              }
            </div>
            @if (showProgress(item)) {
              <mat-progress-bar mode="determinate" [value]="barValue(item)" />
            }
          </div>
          <div class="item__actions">
            @if (mode() === 'active' && (item.state === 'uploading' || item.state === 'queued' || item.state === 'processing')) {
              <button mat-button type="button" (click)="cancel.emit(item.id)">Cancel</button>
            }
            @if (item.state === 'error') {
              <button mat-button type="button" color="primary" (click)="retry.emit(item.id)">
                Retry
              </button>
              <button mat-button type="button" (click)="remove.emit(item.id)">Delete</button>
            }
            @if (item.state === 'complete') {
              <button mat-button type="button" color="primary" (click)="download.emit(item.id)">
                Download
              </button>
              <button mat-button type="button" (click)="remove.emit(item.id)">Delete</button>
              <mat-icon class="ok">check_circle</mat-icon>
            }
          </div>
        </li>
      } @empty {
        <li class="empty">{{ mode() === 'history' ? 'No past uploads' : 'No active uploads' }}</li>
      }
    </ul>
  `,
  styles: `
    .queue {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }

    .item {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
      padding: 0.7rem 0.85rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: var(--mat-sys-surface-container);
    }

    .item__main {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 0.3rem;
    }

    .item__name {
      font-size: 0.92rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item__meta {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .item__actions {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      flex: 0 0 auto;
    }

    .ok {
      color: var(--ajax-color-success, #2e7d32);
    }

    .empty {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
      padding: 0.35rem 0;
    }

    mat-progress-bar {
      height: 4px;
      border-radius: 2px;
    }
  `,
})
export class AjaxUploadQueue {
  readonly items = input<AjaxUploadItem[]>([]);
  readonly mode = input<AjaxUploadQueueMode>('active');
  readonly cancel = output<string>();
  readonly retry = output<string>();
  readonly download = output<string>();
  readonly remove = output<string>();

  showProgress(item: AjaxUploadItem): boolean {
    return item.state !== 'error';
  }

  barValue(item: AjaxUploadItem): number {
    if (item.state === 'complete') {
      return 100;
    }
    if (item.state === 'queued') {
      return Math.max(item.progress || 0, 5);
    }
    return Math.min(100, Math.max(0, item.progress || 0));
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
