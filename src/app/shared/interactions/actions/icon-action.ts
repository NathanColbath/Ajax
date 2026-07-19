import { booleanAttribute, Component, computed, inject, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AjaxActionState } from '../models/action-state';
import { AJAX_INTERACTIONS_CONFIG } from '../tokens/interactions-config';

@Component({
  selector: 'ajax-icon-action',
  standalone: true,
  imports: [MatIconButton, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <button
      matIconButton
      type="button"
      [disabled]="isDisabled()"
      [attr.aria-label]="label()"
      [attr.aria-busy]="state() === 'loading'"
      [matTooltip]="tooltipText()"
      (click)="onClick()"
    >
      @if (state() === 'loading') {
        <mat-progress-spinner diameter="20" strokeWidth="3" mode="indeterminate" />
      } @else {
        <mat-icon>{{ displayIcon() }}</mat-icon>
      }
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    mat-progress-spinner {
      display: block;
    }
  `,
})
export class AjaxIconAction {
  private readonly config = inject(AJAX_INTERACTIONS_CONFIG);

  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly successIcon = input('check');
  readonly errorIcon = input('error');
  readonly state = input<AjaxActionState>('idle');
  readonly disabled = input(false, { transform: booleanAttribute });

  readonly action = output<void>();

  readonly displayIcon = computed(() => {
    switch (this.state()) {
      case 'success':
        return this.successIcon();
      case 'error':
        return this.errorIcon();
      default:
        return this.icon();
    }
  });

  readonly tooltipText = computed(() => {
    switch (this.state()) {
      case 'loading':
        return `${this.label()} — working`;
      case 'success':
        return `${this.label()} — done`;
      case 'error':
        return `${this.label()} — failed`;
      default:
        return this.label();
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
