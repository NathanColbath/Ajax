export interface DashboardStats {
  myFavorites: number;
  myDownloads: number;
  myLists: number;
  libraryGames: number;
  physicalGames: number;
  systems: number;
  storageUsedGb: number;
  storageTotalGb: number;
}

export interface DashboardAttentionItem {
  id: string;
  label: string;
  count: number;
  tone: 'info' | 'warning' | 'danger';
  link: string;
}

export interface DashboardRecentGame {
  id: string;
  title: string;
  system: string;
  accent: string;
  hasArt: boolean;
}

export interface DashboardSystemTile {
  id: string;
  name: string;
  shortName: string;
  gameCount: number;
  hasLogo: boolean;
}

export interface DashboardSnapshot {
  userId: string;
  displayName: string;
  stats: DashboardStats;
  attention: DashboardAttentionItem[];
  continuePlaying: DashboardRecentGame[];
  recentlyAdded: DashboardRecentGame[];
  favorites: DashboardRecentGame[];
  systems: DashboardSystemTile[];
  recommendations: DashboardRecentGame[];
}
