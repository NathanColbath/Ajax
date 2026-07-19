import { booleanAttribute, Component, computed, inject, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AjaxActionState } from '../models/action-state';
import { AJAX_INTERACTIONS_CONFIG } from '../tokens/interactions-config';

@Component({
  selector: 'ajax-action-button',
  standalone: true,
  imports: [MatButton, MatIconModule, MatProgressSpinnerModule],
  template: `
    <button
      [matButton]="appearance()"
      type="button"
      [disabled]="isDisabled()"
      [attr.aria-busy]="state() === 'loading'"
      [attr.aria-label]="ariaLabel() || displayLabel()"
      (click)="onClick()"
    >
      @if (state() === 'loading') {
        <mat-progress-spinner diameter="18" strokeWidth="3" mode="indeterminate" />
      } @else if (displayIcon()) {
        <mat-icon iconPositionStart>{{ displayIcon() }}</mat-icon>
      }
      <span>{{ displayLabel() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    button {
      gap: 0.35rem;
    }

    mat-progress-spinner {
      display: inline-block;
      margin-right: 0.35rem;
    }
  `,
})
export class AjaxActionButton {
  private readonly config = inject(AJAX_INTERACTIONS_CONFIG);

  readonly label = input.required<string>();
  readonly loadingLabel = input('Working…');
  readonly successLabel = input('Done');
  readonly errorLabel = input('Failed');
  readonly icon = input<string | undefined>(undefined);
  readonly successIcon = input('check');
  readonly errorIcon = input('error');
  readonly state = input<AjaxActionState>('idle');
  readonly appearance = input<'text' | 'filled' | 'elevated' | 'outlined'>('filled');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });

  readonly action = output<void>();

  readonly displayLabel = computed(() => {
    switch (this.state()) {
      case 'loading':
        return this.loadingLabel();
      case 'success':
        return this.successLabel();
      case 'error':
        return this.errorLabel();
      default:
        return this.label();
    }
  });

  readonly displayIcon = computed(() => {
    switch (this.state()) {
      case 'loading':
        return undefined;
      case 'success':
        return this.successIcon();
      case 'error':
        return this.errorIcon();
      default:
        return this.icon();
    }
  });

  readonly isDisabled = computed(() => {
    if (this.disabled() || this.state() === 'disabled') {
      return true;
    }
    return this.config.actions.disableWhileLoading && this.state() === 'loading';
  });

  onClick(): void {
    if (this.isDisabled()) {
      return;
    }
    this.action.emit();
  }
}
