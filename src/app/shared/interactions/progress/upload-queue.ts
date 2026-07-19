import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AjaxUploadItem } from '../models/action-state';

@Component({
  selector: 'ajax-upload-queue',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <ul class="queue" aria-label="Upload queue">
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
            @if (item.state === 'uploading' || item.state === 'processing') {
              <mat-progress-bar mode="determinate" [value]="item.progress" />
            }
          </div>
          <div class="item__actions">
            @if (item.state === 'uploading' || item.state === 'queued' || item.state === 'processing') {
              <button mat-button type="button" (click)="cancel.emit(item.id)">Cancel</button>
            }
            @if (item.state === 'error') {
              <button mat-button type="button" color="primary" (click)="retry.emit(item.id)">
                Retry
              </button>
            }
            @if (item.state === 'complete') {
              <mat-icon class="ok">check_circle</mat-icon>
            }
          </div>
        </li>
      } @empty {
        <li class="empty">No files in queue</li>
      }
    </ul>
  `,
  styles: `
    .queue {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }

    .item {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0.85rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: var(--mat-sys-surface-container-lowest);
    }

    .item__main {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 0.25rem;
    }

    .item__name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item__meta {
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .item__actions {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .ok {
      color: var(--ajax-color-success);
    }

    .empty {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }
  `,
})
export class AjaxUploadQueue {
  readonly items = input<AjaxUploadItem[]>([]);
  readonly cancel = output<string>();
  readonly retry = output<string>();

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
