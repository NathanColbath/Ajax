import { Injectable, inject, signal } from '@angular/core';
import {
  AJAX_API_MODE_DEFAULT,
  AJAX_API_MODE_STORAGE_KEY,
  AjaxApiMode,
} from './api-mode';

@Injectable({ providedIn: 'root' })
export class ApiModeService {
  private readonly modeSignal = signal<AjaxApiMode>(inject(AJAX_API_MODE_DEFAULT));

  readonly mode = this.modeSignal.asReadonly();

  isMock(): boolean {
    return this.modeSignal() === 'mock';
  }

  setMode(mode: AjaxApiMode): void {
    this.modeSignal.set(mode);
    try {
      localStorage.setItem(AJAX_API_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }
}
