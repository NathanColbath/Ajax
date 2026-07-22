import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { GamesApi } from '../../api';

declare global {
  interface Window {
    EJS_player?: string;
    EJS_core?: string;
    EJS_gameUrl?: string;
    EJS_pathtodata?: string;
    EJS_gameName?: string;
    EJS_color?: string;
    EJS_startOnLoaded?: boolean;
    EJS_askBeforeExit?: boolean;
    EJS_onGameStart?: () => void;
    EJS_emulator?: {
      pause?: (silent?: boolean) => void;
      play?: (silent?: boolean) => void;
      setVolume?: (volume: number) => void;
      muted?: boolean;
      volume?: number;
      paused?: boolean;
      gameManager?: {
        toggleMainLoop?: (running: number) => void;
        Module?: { AL?: { currentCtx?: { sources?: Array<{ gain?: { context?: AudioContext } }> } } };
      };
    };
  }
}

export const EMULATORJS_DATA_PATH = '/emulatorjs/data/';
export const EMULATORJS_LOADER_URL = `${EMULATORJS_DATA_PATH}loader.js`;
export const EMULATORJS_CDN_DATA_PATH = 'https://cdn.emulatorjs.org/stable/data/';

/**
 * Loads a ROM via authenticated API into a temporary blob URL for EmulatorJS,
 * and tears down the player + blob when leaving the play page.
 *
 * EmulatorJS runs inside an iframe so destroying the frame fully stops audio
 * (WebAssembly / AudioContext cannot be reliably freed in the parent page).
 */
@Injectable({ providedIn: 'root' })
export class EmulatorPlayService {
  private readonly gamesApi = inject(GamesApi);
  private blobUrl: string | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private visibilityHandler: (() => void) | null = null;

  /** Fetch ROM bytes (Bearer) and return a blob: URL owned by this service. */
  prepareRom(gameId: string, fileId: string): Observable<string> {
    this.clearRom();
    return this.gamesApi.getFileBlob(gameId, fileId).pipe(
      map((blob) => {
        this.blobUrl = URL.createObjectURL(blob);
        return this.blobUrl;
      }),
    );
  }

  /**
   * Mount EmulatorJS in a same-origin iframe under `playerHost`.
   */
  launch(options: {
    playerHost: HTMLElement;
    core: string;
    gameUrl: string;
    gameName: string;
  }): Observable<void> {
    return from(
      new Promise<void>((resolve, reject) => {
        this.destroyFrame();

        const host = options.playerHost;
        host.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.className = 'play__ejs-frame';
        iframe.title = 'Emulator';
        iframe.setAttribute('allow', 'autoplay; fullscreen; gamepad');
        iframe.setAttribute(
          'sandbox',
          'allow-scripts allow-same-origin allow-pointer-lock allow-forms',
        );
        host.appendChild(iframe);
        this.iframe = iframe;

        const doc = iframe.contentDocument;
        if (!doc) {
          reject(new Error('Could not initialize emulator frame'));
          return;
        }

        const safeName = escapeJsString(options.gameName);
        const safeCore = escapeJsString(options.core);
        const safeGameUrl = escapeJsString(options.gameUrl);
        const localPath = escapeJsString(EMULATORJS_DATA_PATH);
        const cdnPath = escapeJsString(EMULATORJS_CDN_DATA_PATH);
        const localLoader = escapeJsString(EMULATORJS_LOADER_URL);
        const cdnLoader = escapeJsString(`${EMULATORJS_CDN_DATA_PATH}loader.js`);

        doc.open();
        doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #0d1117; overflow: hidden; }
    #game { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script>
    (function () {
      var volumeBeforeMute = 1;
      window.EJS_player = '#game';
      window.EJS_core = '${safeCore}';
      window.EJS_gameUrl = '${safeGameUrl}';
      window.EJS_pathtodata = '${localPath}';
      window.EJS_gameName = '${safeName}';
      window.EJS_startOnLoaded = true;
      window.EJS_askBeforeExit = false;
      window.EJS_color = '#2a6f7a';

      function stopAudioHard() {
        try {
          var emu = window.EJS_emulator;
          if (!emu) return;
          if (typeof emu.pause === 'function') emu.pause(true);
          if (typeof emu.setVolume === 'function') emu.setVolume(0);
          if (emu.gameManager && typeof emu.gameManager.toggleMainLoop === 'function') {
            emu.gameManager.toggleMainLoop(0);
          }
          var mod = emu.gameManager && emu.gameManager.Module;
          var AL = mod && mod.AL;
          if (AL && AL.currentCtx && AL.currentCtx.sources) {
            AL.currentCtx.sources.forEach(function (src) {
              try {
                if (src.gain && src.gain.context && src.gain.context.state !== 'closed') {
                  src.gain.context.suspend();
                }
              } catch (e) {}
            });
          }
        } catch (e) {}
      }

      function pauseForBackground() {
        try {
          var emu = window.EJS_emulator;
          if (!emu) return;
          volumeBeforeMute = typeof emu.volume === 'number' ? emu.volume : 1;
          if (typeof emu.pause === 'function') emu.pause(true);
          if (typeof emu.setVolume === 'function') emu.setVolume(0);
        } catch (e) {}
      }

      function resumeFromBackground() {
        try {
          var emu = window.EJS_emulator;
          if (!emu) return;
          if (typeof emu.setVolume === 'function') emu.setVolume(volumeBeforeMute || 1);
          if (typeof emu.play === 'function') emu.play();
        } catch (e) {}
      }

      window.addEventListener('message', function (ev) {
        var data = ev && ev.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'ejs-destroy') stopAudioHard();
        if (data.type === 'ejs-pause') pauseForBackground();
        if (data.type === 'ejs-resume') resumeFromBackground();
      });

      window.EJS_onGameStart = function () {
        parent.postMessage({ type: 'ejs-started' }, '*');
      };

      function inject(src, onFail) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onerror = onFail;
        document.body.appendChild(s);
      }

      inject('${localLoader}', function () {
        window.EJS_pathtodata = '${cdnPath}';
        inject('${cdnLoader}', function () {
          parent.postMessage({ type: 'ejs-error', message: 'Failed to load EmulatorJS' }, '*');
        });
      });
    })();
  </script>
</body>
</html>`);
        doc.close();

        let settled = false;
        const done = () => {
          if (settled) {
            return;
          }
          settled = true;
          window.removeEventListener('message', onMessage);
          resolve();
        };
        const fail = (message: string) => {
          if (settled) {
            return;
          }
          settled = true;
          window.removeEventListener('message', onMessage);
          reject(new Error(message));
        };

        const onMessage = (ev: MessageEvent) => {
          if (ev.source !== iframe.contentWindow) {
            return;
          }
          const data = ev.data as { type?: string; message?: string } | null;
          if (!data || typeof data !== 'object') {
            return;
          }
          if (data.type === 'ejs-started') {
            done();
          }
          if (data.type === 'ejs-error') {
            fail(data.message || 'Emulator failed to start');
          }
        };
        window.addEventListener('message', onMessage);
        // Don't block the UI forever if start never fires.
        setTimeout(() => done(), 2500);

        this.bindVisibility();
      }),
    );
  }

  /** Pause + mute when the browser tab is hidden; resume when visible again. */
  private bindVisibility(): void {
    this.unbindVisibility();
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.postToFrame({ type: 'ejs-pause' });
      } else {
        this.postToFrame({ type: 'ejs-resume' });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private unbindVisibility(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private postToFrame(message: { type: string }): void {
    try {
      this.iframe?.contentWindow?.postMessage(message, window.location.origin);
    } catch {
      try {
        this.iframe?.contentWindow?.postMessage(message, '*');
      } catch {
        /* frame already gone */
      }
    }
  }

  /** Stop audio, destroy the emulator iframe, revoke ROM blob. */
  teardown(playerHost?: HTMLElement | null): void {
    this.unbindVisibility();
    this.postToFrame({ type: 'ejs-destroy' });
    this.destroyFrame();
    this.clearRom();
    if (playerHost) {
      playerHost.innerHTML = '';
    }
  }

  private destroyFrame(): void {
    if (!this.iframe) {
      return;
    }
    try {
      this.iframe.src = 'about:blank';
    } catch {
      /* ignore */
    }
    this.iframe.remove();
    this.iframe = null;
  }

  private clearRom(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }
}

function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\u003c');
}
