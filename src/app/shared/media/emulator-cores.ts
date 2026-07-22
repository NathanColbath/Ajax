/**
 * EmulatorJS core resolution and ROM extension allowlists for in-browser play.
 * Cores: https://emulatorjs.org/docs4devs/cores
 */

const SHORT_NAME_TO_CORE: Record<string, string> = {
  nes: 'nes',
  famicom: 'nes',
  snes: 'snes',
  sfc: 'snes',
  gb: 'gb',
  gbc: 'gb',
  gba: 'gba',
  genesis: 'segaMD',
  megadrive: 'segaMD',
  md: 'segaMD',
  gg: 'segaGG',
  gamegear: 'segaGG',
  sms: 'segaMS',
  mastersystem: 'segaMS',
  atari2600: 'atari2600',
  a2600: 'atari2600',
  '2600': 'atari2600',
  n64: 'n64',
  vb: 'vb',
  virtualboy: 'vb',
};

/** Extensions accepted per EmulatorJS system id (phase 1, no-BIOS carts). */
export const EMULATOR_CORE_EXTENSIONS: Record<string, string[]> = {
  nes: ['.nes', '.unf', '.fds', '.zip'],
  snes: ['.sfc', '.smc', '.fig', '.zip'],
  gb: ['.gb', '.gbc', '.zip'],
  gba: ['.gba', '.zip'],
  segaMD: ['.md', '.gen', '.bin', '.smd', '.zip'],
  segaGG: ['.gg', '.zip'],
  segaMS: ['.sms', '.zip'],
  atari2600: ['.a26', '.bin', '.zip'],
  n64: ['.n64', '.z64', '.v64', '.zip'],
  vb: ['.vb', '.vboy', '.zip'],
};

export function normalizeRomExtension(ext: string): string {
  const trimmed = ext.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

export function resolveEmulatorJsCore(
  emulatorJsCore: string | null | undefined,
  shortName: string | null | undefined,
): string {
  const explicit = emulatorJsCore?.trim();
  if (explicit) {
    return explicit;
  }
  const key = (shortName ?? '').trim().toLowerCase();
  return SHORT_NAME_TO_CORE[key] ?? '';
}

export function isExtensionPlayable(core: string, extension: string): boolean {
  if (!core) {
    return false;
  }
  const allowed = EMULATOR_CORE_EXTENSIONS[core];
  if (!allowed) {
    return false;
  }
  return allowed.includes(normalizeRomExtension(extension));
}
