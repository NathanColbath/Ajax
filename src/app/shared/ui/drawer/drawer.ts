import { Component, input, model } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'ajax-drawer',
  standalone: true,
  imports: [MatSidenavModule],
  template: `
    <mat-sidenav-container [autosize]="autosize()" class="ajax-drawer-container">
      <mat-sidenav
        class="ajax-drawer-panel"
        [mode]="mode()"
        [position]="position()"
        [opened]="opened()"
        (openedChange)="opened.set($event)"
        [fixedInViewport]="fixedInViewport()"
        [style.width.px]="width()"
      >
        <ng-content select="[drawer]" />
      </mat-sidenav>
      <mat-sidenav-content class="ajax-drawer-content">
        <ng-content />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .ajax-drawer-container {
      height: 100%;
      min-height: 240px;
      background: transparent;
    }

    .ajax-drawer-panel {
      background: transparent;
      border: none;
      box-shadow: none;
      transition: width 160ms ease;
    }

    .ajax-drawer-content {
      display: block;
      min-width: 0;
    }
  `,
})
export class AjaxDrawer {
  readonly opened = model(false);
  readonly mode = input<'over' | 'push' | 'side'>('over');
  readonly position = input<'start' | 'end'>('start');
  readonly autosize = input(false);
  readonly fixedInViewport = input(false);
  /** Explicit sidenav width in px so content margins stay in sync. */
  readonly width = input(248);

  open(): void {
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }

  toggle(): void {
    this.opened.update((value) => !value);
  }
}
