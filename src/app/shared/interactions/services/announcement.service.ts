import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AjaxAnnouncementService {
  private region: HTMLElement | null = null;

  announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    if (typeof document === 'undefined' || !message.trim()) {
      return;
    }

    const region = this.ensureRegion();
    region.setAttribute('aria-live', politeness);
    region.textContent = '';
    // Force a DOM change so screen readers re-announce.
    window.setTimeout(() => {
      region.textContent = message;
    }, 50);
  }

  private ensureRegion(): HTMLElement {
    if (this.region && document.body.contains(this.region)) {
      return this.region;
    }

    const el = document.createElement('div');
    el.className = 'ajax-announcer';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.style.position = 'absolute';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.margin = '-1px';
    el.style.border = '0';
    el.style.padding = '0';
    el.style.overflow = 'hidden';
    el.style.clip = 'rect(0 0 0 0)';
    document.body.appendChild(el);
    this.region = el;
    return el;
  }
}
