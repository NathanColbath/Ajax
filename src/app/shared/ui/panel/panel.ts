import { Component, input } from '@angular/core';

@Component({
  selector: 'ajax-panel',
  standalone: true,
  template: `
    <section class="ajax-panel">
      <header class="ajax-panel__header">
        <div class="ajax-panel__titles">
          <h3 class="ajax-panel__title">{{ title() }}</h3>
          @if (description()) {
            <p class="ajax-panel__description">{{ description() }}</p>
          }
        </div>
        <div class="ajax-panel__header-actions">
          <ng-content select="[headerActions]" />
        </div>
      </header>
      <div class="ajax-panel__body">
        <ng-content />
      </div>
      <footer class="ajax-panel__actions">
        <ng-content select="[actions]" />
      </footer>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .ajax-panel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 10px;
      background: var(--mat-sys-surface-container-lowest);
      overflow: hidden;
    }

    .ajax-panel__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.15rem;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .ajax-panel__titles {
      min-width: 0;
      flex: 1;
    }

    .ajax-panel__title {
      margin: 0;
      font-family: var(--mat-sys-title-medium-font), Roboto, sans-serif;
      font-size: var(--mat-sys-title-medium-size);
      font-weight: var(--mat-sys-title-medium-weight);
      line-height: var(--mat-sys-title-medium-line-height);
      color: var(--mat-sys-on-surface);
    }

    .ajax-panel__description {
      margin: 0.35rem 0 0;
      font-family: var(--mat-sys-body-medium-font), Roboto, sans-serif;
      font-size: var(--mat-sys-body-medium-size);
      font-weight: var(--mat-sys-body-medium-weight);
      line-height: var(--mat-sys-body-medium-line-height);
      color: var(--mat-sys-on-surface-variant);
    }

    .ajax-panel__header-actions {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .ajax-panel__header-actions:empty {
      display: none;
    }

    .ajax-panel__body {
      padding: 1rem 1.15rem;
      color: var(--mat-sys-on-surface);
    }

    .ajax-panel__actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.15rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }

    .ajax-panel__actions:empty {
      display: none;
    }
  `,
})
export class AjaxPanel {
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
}
