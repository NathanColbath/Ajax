# EmulatorJS (self-hosted)

Retrojax plays digital library ROMs in the browser with [EmulatorJS](https://emulatorjs.org/).

## Assets

Self-hosted under `public/emulatorjs/data/` (served as `/emulatorjs/data/`).

Fetch / refresh (loader + phase-1 WASM cores):

```powershell
.\scripts\fetch-emulatorjs.ps1
# pin a release:
.\scripts\fetch-emulatorjs.ps1 -Tag 4.2.3
# loader/UI only (no cores):
.\scripts\fetch-emulatorjs.ps1 -SkipCores
```

`public/emulatorjs/VERSION` records the release tag. Large `*.data` / `*.wasm` core files under `data/cores/` are gitignored — run the fetch script after clone.

Play page sets:

- `EJS_pathtodata = '/emulatorjs/data/'`
- `EJS_core` from `GameSystem.emulatorJsCore` (or short-name defaults)
- `EJS_gameUrl` to a temporary `blob:` URL from an authenticated ROM download

## Cores

See [EmulatorJS cores](https://emulatorjs.org/docs4devs/cores). Phase 1 maps common short names (NES, SNES, GB, GBA, Genesis, …) in `SystemsService` / `emulator-cores.ts`.

## Cleanup

The play page hosts EmulatorJS in a same-origin iframe. Leaving `/games/:id/play` (or Exit) pauses/mutes, blanks the frame, removes it, and revokes the ROM blob URL — that stops background audio. Switching browser tabs pauses + mutes until the tab is visible again.

Nothing is written to `localStorage` by Retrojax itself.
