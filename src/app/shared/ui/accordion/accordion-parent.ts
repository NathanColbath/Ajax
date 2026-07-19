import { ModelSignal } from '@angular/core';

/** Parent contract so expansions can notify without a circular import. */
export abstract class AjaxAccordionParent {
  abstract handlePanelOpened(source: { expanded: ModelSignal<boolean> }): void;
}
