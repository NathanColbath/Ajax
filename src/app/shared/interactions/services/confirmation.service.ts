import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AjaxConfirmationDialog, AjaxConfirmationRequest } from './confirmation-dialog';

@Injectable({ providedIn: 'root' })
export class AjaxConfirmationService {
  private readonly dialog = inject(MatDialog);

  confirm(request: AjaxConfirmationRequest): Promise<boolean> {
    const ref = this.dialog.open<AjaxConfirmationDialog, AjaxConfirmationRequest, boolean>(
      AjaxConfirmationDialog,
      {
        width: '420px',
        maxWidth: 'calc(100vw - 2rem)',
        data: {
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
          severity: 'warning',
          ...request,
        },
      },
    );

    return firstValueFrom(ref.afterClosed()).then((result) => !!result);
  }
}
