export interface UserGameListSummary {
  id: string;
  name: string;
  gameCount: number;
  updatedAt: string;
}

export interface UserGameListGame {
  id: string;
  title: string;
  system: string;
  hasFiles: boolean;
  accent: string;
  hasArt: boolean;
}

export interface UserGameListDetail {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  games: UserGameListGame[];
}

export type GameListDownloadJobStatus = 'queued' | 'processing' | 'complete' | 'error';

export interface GameListDownloadJob {
  id: string;
  listId: string;
  listName: string;
  status: GameListDownloadJobStatus | string;
  progress: number;
  fileName?: string | null;
  message: string;
  createdAt: string;
  completedAt?: string | null;
}
