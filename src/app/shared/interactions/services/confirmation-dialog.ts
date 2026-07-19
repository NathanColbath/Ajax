import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AjaxConfirmationSeverity } from '../models/action-state';

export interface AjaxConfirmationRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: AjaxConfirmationSeverity;
}

@Component({
  selector: 'ajax-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="title">
      @if (icon) {
        <mat-icon [style.color]="iconColor">{{ icon }}</mat-icon>
      }
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close(false)">
        {{ data.cancelLabel || 'Cancel' }}
      </button>
      <button mat-flat-button type="button" [color]="buttonColor" (click)="ref.close(true)">
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class AjaxConfirmationDialog {
  readonly data = inject<AjaxConfirmationRequest>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AjaxConfirmationDialog, boolean>);

  get severity(): AjaxConfirmationSeverity {
    return this.data.severity ?? 'warning';
  }

  get icon(): string {
    switch (this.severity) {
      case 'danger':
        return 'warning';
      case 'warning':
        return 'error_outline';
      default:
        return 'info';
    }
  }

  get iconColor(): string {
    switch (this.severity) {
      case 'danger':
        return 'var(--ajax-color-danger)';
      case 'warning':
        return 'var(--ajax-color-warning)';
      default:
        return 'var(--ajax-color-info)';
    }
  }

  get buttonColor(): 'primary' | 'warn' {
    return this.severity === 'danger' ? 'warn' : 'primary';
  }
}
