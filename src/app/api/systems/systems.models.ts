export interface GameSystem {
  id: string;
  name: string;
  shortName: string;
  manufacturer: string;
  extensions: string[];
  gameCount: number;
  icon: string;
  accent: string;
  description: string;
  releasePeriod: string;
  generation: string;
  region: string;
  hasLogo: boolean;
  preferredStoragePath: string;
  metadataProviderIds: Record<string, string>;
  emulatorInfo: string;
  /** EmulatorJS EJS_core id (nes, snes, gba, …). */
  emulatorJsCore: string;
  status: 'active' | 'hidden' | 'archived';
}

export type CreateGameSystemRequest = Omit<GameSystem, 'id' | 'gameCount' | 'hasLogo'>;

export interface UpdateGameSystemRequest {
  name?: string;
  shortName?: string;
  manufacturer?: string;
  icon?: string;
  accent?: string;
  description?: string;
  releasePeriod?: string;
  generation?: string;
  region?: string;
  preferredStoragePath?: string;
  metadataProviderIds?: Record<string, string>;
  emulatorInfo?: string;
  emulatorJsCore?: string;
  status?: GameSystem['status'];
}
