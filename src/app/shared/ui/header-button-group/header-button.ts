import { booleanAttribute, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { AjaxTooltip } from '../tooltip/tooltip';

@Component({
  selector: 'ajax-header-button',
  standalone: true,
  imports: [MatIconModule, MatRippleModule, AjaxTooltip],
  template: `
    <button
      type="button"
      class="ajax-header-button"
      matRipple
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() || label()"
      [ajaxTooltip]="tooltip() || ''"
      [ajaxTooltipDisabled]="!tooltip()"
      (click)="clicked.emit($event)"
    >
      <mat-icon class="ajax-header-button__icon" aria-hidden="true">{{ icon() }}</mat-icon>
      <span class="ajax-header-button__label">{{ label() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .ajax-header-button {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      min-width: 3.25rem;
      padding: 0.4rem 0.55rem;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--mat-sys-on-surface);
      cursor: pointer;
      font: inherit;
      line-height: 1.1;
    }

    .ajax-header-button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
    }

    .ajax-header-button:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .ajax-header-button:disabled {
      opacity: 0.42;
      cursor: default;
    }

    .ajax-header-button__icon {
      width: 22px;
      height: 22px;
      font-size: 22px;
      line-height: 22px;
      color: var(--mat-sys-primary);
    }

    .ajax-header-button__label {
      max-width: 4.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.6875rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AjaxHeaderButton {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly tooltip = input<string | undefined>(undefined);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly clicked = output<MouseEvent>();
}
