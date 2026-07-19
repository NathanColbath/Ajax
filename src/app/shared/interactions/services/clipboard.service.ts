import { Injectable, inject } from '@angular/core';
import { AjaxAnnouncementService } from './announcement.service';
import { AjaxFeedbackService } from './feedback.service';

export interface AjaxClipboardResult {
  ok: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AjaxClipboardService {
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly announcements = inject(AjaxAnnouncementService);

  async copy(
    value: string,
    options?: { successMessage?: string; errorMessage?: string; silent?: boolean },
  ): Promise<AjaxClipboardResult> {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(value);
      const message = options?.successMessage ?? 'Copied to clipboard';
      if (!options?.silent) {
        this.feedback.success(message, { duration: 2000 });
      }
      this.announcements.announce(message);
      return { ok: true };
    } catch {
      const message = options?.errorMessage ?? 'Unable to copy';
      if (!options?.silent) {
        this.feedback.error(message);
      }
      this.announcements.announce(message, 'assertive');
      return { ok: false, error: message };
    }
  }
}
