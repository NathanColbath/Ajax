import { Component, input, model } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'ajax-drawer',
  standalone: true,
  imports: [MatSidenavModule],
  template: `
    <mat-sidenav-container [autosize]="autosize()" class="ajax-drawer-container">
      <mat-sidenav
        [mode]="mode()"
        [position]="position()"
        [opened]="opened()"
        (openedChange)="opened.set($event)"
        [fixedInViewport]="fixedInViewport()"
      >
        <ng-content select="[drawer]" />
      </mat-sidenav>
      <mat-sidenav-content>
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
    }
  `,
})
export class AjaxDrawer {
  readonly opened = model(false);
  readonly mode = input<'over' | 'push' | 'side'>('over');
  readonly position = input<'start' | 'end'>('start');
  readonly autosize = input(false);
  readonly fixedInViewport = input(false);

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
