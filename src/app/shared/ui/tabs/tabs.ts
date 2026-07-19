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
