import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ajax-empty-state',
  standalone: true,
  imports: [MatButton, MatIconModule],
  template: `
    <section class="empty" role="status">
      @if (icon()) {
        <mat-icon class="empty__icon">{{ icon() }}</mat-icon>
      }
      <h3 class="empty__title">{{ title() }}</h3>
      @if (description()) {
        <p class="empty__desc">{{ description() }}</p>
      }
      <div class="empty__actions">
        @if (actionLabel()) {
          <button matButton="filled" type="button" (click)="action.emit()">
            {{ actionLabel() }}
          </button>
        }
        @if (secondaryActionLabel()) {
          <button matButton="outlined" type="button" (click)="secondaryAction.emit()">
            {{ secondaryActionLabel() }}
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .empty {
      display: grid;
      justify-items: center;
      gap: 0.5rem;
      padding: 2rem 1.25rem;
      text-align: center;
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: 10px;
      background: var(--mat-sys-surface-container-lowest);
    }

    .empty__icon {
      width: 40px;
      height: 40px;
      font-size: 40px;
      color: var(--mat-sys-on-surface-variant);
    }

    .empty__title {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-title-medium);
    }

    .empty__desc {
      margin: 0;
      max-width: 36ch;
      color: var(--mat-sys-on-surface-variant);
    }

    .empty__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 0.5rem;
    }
  `,
})
export class AjaxEmptyState {
  readonly icon = input<string | undefined>(undefined);
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
  readonly actionLabel = input<string | undefined>(undefined);
  readonly secondaryActionLabel = input<string | undefined>(undefined);

  readonly action = output<void>();
  readonly secondaryAction = output<void>();
}
