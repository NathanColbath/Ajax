import { Component, input, TemplateRef, viewChild } from '@angular/core';

@Component({
  selector: 'ajax-tab',
  standalone: true,
  template: `<ng-template><ng-content /></ng-template>`,
})
export class AjaxTab {
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly contentTemplate = viewChild.required(TemplateRef);
}
