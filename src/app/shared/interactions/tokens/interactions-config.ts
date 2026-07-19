import { InjectionToken, Provider } from '@angular/core';

export interface AjaxInteractionsConfig {
  motion: {
    enabled: boolean;
    successDuration: number;
  };
  feedback: {
    defaultDuration: number;
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  };
  actions: {
    disableWhileLoading: boolean;
    resetAfterSuccess: boolean;
  };
}

export const AJAX_INTERACTIONS_DEFAULT_CONFIG: AjaxInteractionsConfig = {
  motion: {
    enabled: true,
    successDuration: 1200,
  },
  feedback: {
    defaultDuration: 4000,
    position: 'bottom-right',
  },
  actions: {
    disableWhileLoading: true,
    resetAfterSuccess: true,
  },
};

export const AJAX_INTERACTIONS_CONFIG = new InjectionToken<AjaxInteractionsConfig>(
  'AJAX_INTERACTIONS_CONFIG',
  {
    providedIn: 'root',
    factory: () => AJAX_INTERACTIONS_DEFAULT_CONFIG,
  },
);

export function provideAjaxInteractions(
  config: Partial<{
    motion: Partial<AjaxInteractionsConfig['motion']>;
    feedback: Partial<AjaxInteractionsConfig['feedback']>;
    actions: Partial<AjaxInteractionsConfig['actions']>;
  }> = {},
): Provider[] {
  const merged: AjaxInteractionsConfig = {
    motion: { ...AJAX_INTERACTIONS_DEFAULT_CONFIG.motion, ...config.motion },
    feedback: { ...AJAX_INTERACTIONS_DEFAULT_CONFIG.feedback, ...config.feedback },
    actions: { ...AJAX_INTERACTIONS_DEFAULT_CONFIG.actions, ...config.actions },
  };

  return [{ provide: AJAX_INTERACTIONS_CONFIG, useValue: merged }];
}
