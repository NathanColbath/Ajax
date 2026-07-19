import { Directive, HostListener, inject, input, signal } from '@angular/core';
import { AjaxClipboardService } from '../services/clipboard.service';
import { AJAX_INTERACTIONS_CONFIG } from '../tokens/interactions-config';

@Directive({
  selector: '[ajaxCopyAction]',
  standalone: true,
  host: {
    '[attr.aria-live]': '"polite"',
    '[class.ajax-copy-action--copied]': 'copied()',
  },
})
export class AjaxCopyAction {
  private readonly clipboard = inject(AjaxClipboardService);
  private readonly config = inject(AJAX_INTERACTIONS_CONFIG);

  readonly copyValue = input.required<string>({ alias: 'ajaxCopyAction' });
  readonly copiedLabel = input('Copied');
  readonly copied = signal(false);

  private resetTimer: number | undefined;

  @HostListener('click', ['$event'])
  async onClick(event: Event): Promise<void> {
    event.preventDefault();
    const result = await this.clipboard.copy(this.copyValue());
    if (!result.ok) {
      return;
    }

    this.copied.set(true);
    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => {
      this.copied.set(false);
    }, this.config.motion.successDuration);
  }
}
