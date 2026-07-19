import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AjaxMotionPreferenceService {
  private readonly media =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  readonly reducedMotion = signal(this.media?.matches ?? false);

  constructor() {
    this.media?.addEventListener('change', (event) => {
      this.reducedMotion.set(event.matches);
    });
  }

  get prefersReducedMotion(): boolean {
    return this.reducedMotion();
  }
}
