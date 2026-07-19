import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { AJAX_INTERACTIONS_CONFIG } from '../tokens/interactions-config';
import { AjaxAnnouncementService } from './announcement.service';

export interface AjaxFeedbackActionOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  announce?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AjaxFeedbackService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly config = inject(AJAX_INTERACTIONS_CONFIG);
  private readonly announcements = inject(AjaxAnnouncementService);

  success(message: string, options?: AjaxFeedbackActionOptions): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, options, ['ajax-toast', 'ajax-toast--success'], 'polite');
  }

  info(message: string, options?: AjaxFeedbackActionOptions): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, options, ['ajax-toast', 'ajax-toast--info'], 'polite');
  }

  warning(message: string, options?: AjaxFeedbackActionOptions): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(message, options, ['ajax-toast', 'ajax-toast--warn'], 'assertive');
  }

  error(message: string, options?: AjaxFeedbackActionOptions): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(
      message,
      { duration: 6000, ...options },
      ['ajax-toast', 'ajax-toast--error'],
      'assertive',
    );
  }

  undoable(
    message: string,
    options: { onUndo: () => void; duration?: number; undoLabel?: string },
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.open(
      message,
      {
        actionLabel: options.undoLabel ?? 'Undo',
        onAction: options.onUndo,
        duration: options.duration ?? 6000,
      },
      ['ajax-toast', 'ajax-toast--info'],
      'polite',
    );
  }

  private open(
    message: string,
    options: AjaxFeedbackActionOptions | undefined,
    panelClass: string[],
    politeness: 'polite' | 'assertive',
  ): MatSnackBarRef<TextOnlySnackBar> {
    const position = this.config.feedback.position;
    const config: MatSnackBarConfig = {
      duration: options?.duration ?? this.config.feedback.defaultDuration,
      panelClass,
      horizontalPosition: position.endsWith('right') ? 'end' : 'start',
      verticalPosition: position.startsWith('top') ? 'top' : 'bottom',
    };

    const actionLabel = options?.actionLabel ?? 'Dismiss';
    const ref = this.snackBar.open(message, actionLabel, config);

    if (options?.announce !== false) {
      this.announcements.announce(message, politeness);
    }

    if (options?.onAction) {
      ref.onAction().subscribe(() => options.onAction?.());
    }

    return ref;
  }
}
