import { booleanAttribute, Component, contentChildren, input } from '@angular/core';
import { ModelSignal } from '@angular/core';
import { AjaxAccordionParent } from './accordion-parent';
import { AjaxExpansion } from './expansion';

@Component({
  selector: 'ajax-accordion',
  standalone: true,
  providers: [{ provide: AjaxAccordionParent, useExisting: AjaxAccordion }],
  template: `
    <div class="ajax-accordion" [class.ajax-accordion--flat]="displayMode() === 'flat'">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .ajax-accordion {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .ajax-accordion--flat {
      gap: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 10px;
      overflow: hidden;
    }

    .ajax-accordion--flat ::ng-deep .mat-expansion-panel {
      border-radius: 0 !important;
      border: 0 !important;
      border-bottom: 1px solid var(--mat-sys-outline-variant) !important;
      box-shadow: none !important;
    }

    .ajax-accordion--flat ::ng-deep ajax-expansion:last-child .mat-expansion-panel {
      border-bottom: 0 !important;
    }
  `,
})
export class AjaxAccordion extends AjaxAccordionParent {
  readonly multi = input(false, { transform: booleanAttribute });
  readonly displayMode = input<'default' | 'flat'>('default');

  private readonly panels = contentChildren(AjaxExpansion);

  handlePanelOpened(source: { expanded: ModelSignal<boolean> }): void {
    if (this.multi()) {
      return;
    }

    for (const panel of this.panels()) {
      if (panel !== source && panel.expanded()) {
        panel.expanded.set(false);
      }
    }
  }
}
