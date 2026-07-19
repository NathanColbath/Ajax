import { Component, input } from '@angular/core';

@Component({
  selector: 'ajax-header-button-group',
  standalone: true,
  template: `
    <div class="ajax-header-button-group" role="group" [attr.aria-label]="ariaLabel()">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }

    .ajax-header-button-group {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: stretch;
      justify-content: flex-end;
      gap: 0.15rem;
      padding: 0.15rem;
      border-radius: 10px;
      background: color-mix(in srgb, var(--mat-sys-surface-container-highest) 70%, transparent);
    }
  `,
})
export class AjaxHeaderButtonGroup {
  readonly ariaLabel = input('Header actions');
}
