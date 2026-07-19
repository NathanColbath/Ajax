import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AjaxInlineSaveState } from '../models/action-state';

@Component({
  selector: 'ajax-inline-save-status',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="status" [attr.data-state]="state()" role="status">
      @switch (state()) {
        @case ('unsaved') {
          <mat-icon>edit</mat-icon>
          <span>Unsaved changes</span>
        }
        @case ('saving') {
          <mat-icon class="spin">sync</mat-icon>
          <span>Saving…</span>
        }
        @case ('saved') {
          <mat-icon class="ok">check_circle</mat-icon>
          <span>Saved</span>
        }
        @case ('failed') {
          <mat-icon class="err">error</mat-icon>
          <span>Save failed</span>
          <button mat-button type="button" color="warn" (click)="retry.emit()">Retry</button>
        }
      }
    </div>
  `,
  styles: `
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }

    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .ok {
      color: var(--ajax-color-success);
    }

    .err {
      color: var(--ajax-color-danger);
    }

    .spin {
      animation: ajax-spin var(--ajax-motion-emphasized) linear infinite;
    }

    @keyframes ajax-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class AjaxInlineSaveStatus {
  readonly state = input<AjaxInlineSaveState>('unsaved');
  readonly retry = output<void>();

  readonly isError = computed(() => this.state() === 'failed');
}
