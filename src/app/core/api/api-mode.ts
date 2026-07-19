import { EnvironmentProviders, InjectionToken, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export type AjaxApiMode = 'mock' | 'live';

export const AJAX_API_BASE_URL = new InjectionToken<string>('AJAX_API_BASE_URL');
export const AJAX_API_MODE_DEFAULT = new InjectionToken<AjaxApiMode>('AJAX_API_MODE_DEFAULT');

export const AJAX_API_MODE_STORAGE_KEY = 'ajax.apiMode';

export interface ProvideApiOptions {
  mode?: AjaxApiMode;
  baseUrl?: string;
}

export function provideApi(options: ProvideApiOptions = {}): Array<Provider | EnvironmentProviders> {
  const mode = options.mode ?? readStoredApiMode() ?? 'mock';
  const baseUrl = options.baseUrl ?? '/api';

  return [
    provideHttpClient(),
    { provide: AJAX_API_BASE_URL, useValue: baseUrl },
    { provide: AJAX_API_MODE_DEFAULT, useValue: mode },
  ];
}

export function readStoredApiMode(): AjaxApiMode | null {
  try {
    const value = localStorage.getItem(AJAX_API_MODE_STORAGE_KEY);
    if (value === 'mock' || value === 'live') {
      return value;
    }
  } catch {
    // ignore storage errors (SSR / privacy mode)
  }
  return null;
}
