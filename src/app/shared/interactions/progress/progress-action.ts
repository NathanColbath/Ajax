import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AjaxProgressStep } from '../models/action-state';

@Component({
  selector: 'ajax-progress-action',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="progress" aria-label="Progress">
      @if (title()) {
        <h3 class="progress__title">{{ title() }}</h3>
      }
      <ol class="progress__steps">
        @for (step of steps(); track step.id) {
          <li class="step" [attr.data-state]="step.state">
            <span class="step__marker" aria-hidden="true">
              @switch (step.state) {
                @case ('complete') {
                  <mat-icon>check_circle</mat-icon>
                }
                @case ('active') {
                  <mat-icon>pending</mat-icon>
                }
                @case ('error') {
                  <mat-icon>error</mat-icon>
                }
                @case ('warning') {
                  <mat-icon>warning</mat-icon>
                }
                @default {
                  <mat-icon>radio_button_unchecked</mat-icon>
                }
              }
            </span>
            <div class="step__body">
              <div class="step__label">{{ step.label }}</div>
              @if (step.description) {
                <div class="step__desc">{{ step.description }}</div>
              }
            </div>
          </li>
        }
      </ol>
    </section>
  `,
  styles: `
    .progress__title {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-medium);
    }

    .progress__steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.65rem;
    }

    .step {
      display: flex;
      gap: 0.65rem;
      align-items: flex-start;
    }

    .step__marker mat-icon {
      width: 22px;
      height: 22px;
      font-size: 22px;
      color: var(--mat-sys-on-surface-variant);
    }

    .step[data-state='complete'] .step__marker mat-icon {
      color: var(--ajax-color-success);
    }

    .step[data-state='active'] .step__marker mat-icon {
      color: var(--mat-sys-primary);
    }

    .step[data-state='error'] .step__marker mat-icon {
      color: var(--ajax-color-danger);
    }

    .step[data-state='warning'] .step__marker mat-icon {
      color: var(--ajax-color-warning);
    }

    .step__label {
      font-weight: 500;
    }

    .step__desc {
      margin-top: 0.15rem;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }
  `,
})
export class AjaxProgressAction {
  readonly title = input<string | undefined>(undefined);
  readonly steps = input<AjaxProgressStep[]>([]);
  readonly activeStep = input<string | undefined>(undefined);
}
