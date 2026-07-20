import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { AjaxConfirmDialog, AjaxConfirmDialogData } from './confirm-dialog';

@Injectable({ providedIn: 'root' })
export class AjaxDialog {
  private readonly dialog = inject(MatDialog);

  open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    config?: MatDialogConfig<D>,
  ): MatDialogRef<T, R> {
    return this.dialog.open(component, {
      width: '480px',
      ...config,
      maxWidth: config?.maxWidth ?? 'calc(100vw - 2rem)',
    });
  }

  confirm(data: AjaxConfirmDialogData): Observable<boolean | undefined> {
    const ref = this.dialog.open<AjaxConfirmDialog, AjaxConfirmDialogData, boolean>(AjaxConfirmDialog, {
      width: '420px',
      maxWidth: 'calc(100vw - 2rem)',
      data: {
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        ...data,
      },
    });
    return ref.afterClosed();
  }
}
