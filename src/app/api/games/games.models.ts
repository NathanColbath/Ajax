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
  publisher?: string;
  genres?: string[];
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
  metadataSource: string;
  externalId: string;
  screenshotCount: number;
  files: GameFile[];
  /** Per-user overlay — not part of shared catalog record. */
  favorite: boolean;
  playStatus: 'unplayed' | 'playing' | 'beaten' | 'wishlist';
  myRating?: number | null;
  myReviewBody?: string | null;
}

export interface GameReview {
  id: string;
  gameId: string;
  userId: string;
  authorName: string;
  authorInitials: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

export interface UpsertGameReviewRequest {
  rating: number;
  body?: string;
}

export interface GamePublicComment {
  author: string;
  text: string;
  createdAt: string | null;
  url: string;
}

export interface GamePublicFeedback {
  available: boolean;
  rating: number | null;
  ratingsCount: number | null;
  metacritic: number | null;
  sourceUrl: string | null;
  attribution: string;
  comments: GamePublicComment[];
  ratingScale?: number | null;
  ratingProvider?: string | null;
}

export interface UpdateGameRequest {
  title?: string;
  region?: string;
  year?: number;
  description?: string;
  publisher?: string;
  developer?: string;
  releaseDate?: string;
  players?: string;
  notes?: string;
  genres?: string[];
  tags?: string[];
  languages?: string[];
}

export interface GamesQuery {
  search?: string;
  system?: string;
  ownedOnly?: boolean;
}

