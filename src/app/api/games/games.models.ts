export interface GameSummary {
  id: string;
  title: string;
  system: string;
  region: string;
  year: number;
  owned: boolean;
  hasArt: boolean;
  accent: string;
  rating: number;
  downloadCount: number;
}

export interface GameFile {
  id: string;
  name: string;
  sizeLabel: string;
  extension: string;
}

export interface GameDetail extends GameSummary {
  description: string;
  publisher: string;
  developer: string;
  releaseDate: string;
  ratingCount: number;
  genres: string[];
  tags: string[];
  players: string;
  languages: string[];
  screenshots: string[];
  notes: string;
  files: GameFile[];
  /** Per-user overlay — not part of shared catalog record. */
  favorite: boolean;
  playStatus: 'unplayed' | 'playing' | 'beaten' | 'wishlist';
}

export interface GamesQuery {
  search?: string;
  system?: string;
  ownedOnly?: boolean;
}
