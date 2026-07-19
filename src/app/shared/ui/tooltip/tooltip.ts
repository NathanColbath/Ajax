import { Directive, input } from '@angular/core';
import { MatTooltip, TooltipPosition } from '@angular/material/tooltip';

@Directive({
  selector: '[ajaxTooltip]',
  standalone: true,
  hostDirectives: [
    {
      directive: MatTooltip,
      inputs: ['matTooltip: ajaxTooltip', 'matTooltipPosition: ajaxTooltipPosition', 'matTooltipDisabled: ajaxTooltipDisabled'],
    },
  ],
})
export class AjaxTooltip {
  readonly ajaxTooltip = input('');
  readonly ajaxTooltipPosition = input<TooltipPosition>('above');
  readonly ajaxTooltipDisabled = input(false);
}
