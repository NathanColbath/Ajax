import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';

export type AjaxToastType = 'success' | 'error' | 'info' | 'warn';

@Injectable({ providedIn: 'root' })
export class AjaxToast {
  private readonly snackBar = inject(MatSnackBar);

  open(
    message: string,
    action = 'Dismiss',
    config?: MatSnackBarConfig,
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.snackBar.open(message, action, {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      ...config,
    });
  }

  success(message: string, action = 'Dismiss'): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, action, { panelClass: ['ajax-toast', 'ajax-toast--success'] });
  }

  error(message: string, action = 'Dismiss'): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, action, {
      duration: 6000,
      panelClass: ['ajax-toast', 'ajax-toast--error'],
    });
  }

  info(message: string, action = 'Dismiss'): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, action, { panelClass: ['ajax-toast', 'ajax-toast--info'] });
  }

  warn(message: string, action = 'Dismiss'): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, action, { panelClass: ['ajax-toast', 'ajax-toast--warn'] });
  }
}
