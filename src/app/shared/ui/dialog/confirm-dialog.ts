import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface AjaxConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'ajax-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close(false)">
        {{ data.cancelLabel || 'Cancel' }}
      </button>
      <button
        mat-flat-button
        type="button"
        [color]="data.confirmColor || 'primary'"
        (click)="ref.close(true)"
      >
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class AjaxConfirmDialog {
  readonly data = inject<AjaxConfirmDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AjaxConfirmDialog, boolean>);
}
