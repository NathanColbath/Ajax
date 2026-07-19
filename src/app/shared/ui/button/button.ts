import { Component, computed, input, output } from '@angular/core';
import { MatButton, MatButtonAppearance, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type AjaxButtonVariant = 'basic' | 'raised' | 'flat' | 'stroked' | 'icon';
export type AjaxButtonColor = 'primary' | 'accent' | 'warn' | undefined;

const VARIANT_TO_APPEARANCE: Record<Exclude<AjaxButtonVariant, 'icon'>, MatButtonAppearance> = {
  basic: 'text',
  raised: 'elevated',
  flat: 'filled',
  stroked: 'outlined',
};

@Component({
  selector: 'ajax-button',
  standalone: true,
  imports: [MatButton, MatIconButton, MatIconModule],
  template: `
    @if (isIcon()) {
      <button
        matIconButton
        [color]="color()"
        [disabled]="disabled()"
        [type]="type()"
        [attr.aria-label]="ariaLabel()"
        (click)="clicked.emit($event)"
      >
        <mat-icon>{{ icon() || 'more_vert' }}</mat-icon>
      </button>
    } @else {
      <button
        [matButton]="appearance()"
        [color]="color()"
        [disabled]="disabled()"
        [type]="type()"
        (click)="clicked.emit($event)"
      >
        @if (icon()) {
          <mat-icon iconPositionStart>{{ icon() }}</mat-icon>
        }
        <ng-content />
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
      max-width: 100%;
    }

    button {
      max-width: 100%;
    }

    .mat-icon {
      flex-shrink: 0;
    }
  `,
})
export class AjaxButton {
  readonly variant = input<AjaxButtonVariant>('basic');
  readonly color = input<AjaxButtonColor>(undefined);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly icon = input<string | undefined>(undefined);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly clicked = output<MouseEvent>();

  readonly isIcon = computed(() => this.variant() === 'icon');
  readonly appearance = computed<MatButtonAppearance>(() => {
    const variant = this.variant();
    return variant === 'icon' ? 'text' : VARIANT_TO_APPEARANCE[variant];
  });
}
