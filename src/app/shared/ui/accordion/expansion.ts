import { booleanAttribute, Component, inject, input, model } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { AjaxAccordionParent } from './accordion-parent';

@Component({
  selector: 'ajax-expansion',
  standalone: true,
  imports: [MatExpansionModule],
  template: `
    <mat-expansion-panel
      [expanded]="expanded()"
      [disabled]="disabled()"
      [hideToggle]="hideToggle()"
      (expandedChange)="onExpandedChange($event)"
    >
      <mat-expansion-panel-header>
        <mat-panel-title>{{ title() }}</mat-panel-title>
        @if (description()) {
          <mat-panel-description>{{ description() }}</mat-panel-description>
        }
      </mat-expansion-panel-header>

      <div class="ajax-expansion__body">
        <ng-content />
      </div>

      <mat-action-row class="ajax-expansion__actions">
        <ng-content select="[actions]" />
      </mat-action-row>
    </mat-expansion-panel>
  `,
  styles: `
    :host {
      display: block;
    }

    .ajax-expansion__body {
      padding-top: 0.25rem;
    }

    :host ::ng-deep .mat-expansion-panel {
      border-radius: 10px;
      box-shadow: none;
      border: 1px solid var(--mat-sys-outline-variant);
    }

    :host ::ng-deep .mat-expansion-panel-header {
      padding-inline: 1.15rem;
    }

    :host ::ng-deep .mat-expansion-panel-body {
      padding-inline: 1.15rem;
      padding-bottom: 1rem;
    }

    :host ::ng-deep .ajax-expansion__actions:not(:has(*)) {
      display: none;
    }
  `,
})
export class AjaxExpansion {
  private readonly accordion = inject(AjaxAccordionParent, { optional: true });

  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
  readonly expanded = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly hideToggle = input(false, { transform: booleanAttribute });

  onExpandedChange(isExpanded: boolean): void {
    this.expanded.set(isExpanded);
    if (isExpanded) {
      this.accordion?.handlePanelOpened(this);
    }
  }
}
