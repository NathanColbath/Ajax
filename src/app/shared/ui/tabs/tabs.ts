import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChildren, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { AjaxTab } from './tab';

@Component({
  selector: 'ajax-tabs',
  standalone: true,
  imports: [MatTabsModule, NgTemplateOutlet],
  template: `
    <mat-tab-group
      [selectedIndex]="selectedIndex()"
      [animationDuration]="animationDuration()"
      [dynamicHeight]="dynamicHeight()"
      [mat-stretch-tabs]="stretchTabs()"
    >
      @for (tab of tabs(); track $index) {
        <mat-tab [label]="tab.label()" [disabled]="tab.disabled()">
          <ng-container *ngTemplateOutlet="tab.contentTemplate()" />
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    mat-tab-group {
      min-width: 0;
      max-width: 100%;
    }

    :host ::ng-deep .mat-mdc-tab-body-wrapper,
    :host ::ng-deep .mat-mdc-tab-body-content {
      min-width: 0;
      max-width: 100%;
    }

    :host ::ng-deep .mat-mdc-tab-body-content {
      overflow-x: hidden;
    }

    :host ::ng-deep .mat-mdc-tab-header {
      max-width: 100%;
    }

    :host ::ng-deep .mat-mdc-tab-labels {
      max-width: 100%;
    }
  `,
})
export class AjaxTabs {
  readonly selectedIndex = input(0);
  readonly animationDuration = input('200ms');
  readonly dynamicHeight = input(true);
  readonly stretchTabs = input(false);
  readonly tabs = contentChildren(AjaxTab);
}
