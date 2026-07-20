import { DashboardSnapshot } from './dashboard.models';

export const MOCK_DASHBOARDS: Record<string, DashboardSnapshot> = {
  u1: {
    userId: 'u1',
    displayName: 'Nathan',
    stats: {
      myFavorites: 4,
      myDownloads: 18,
      libraryGames: 248,
      physicalGames: 86,
      systems: 14,
      storageUsedGb: 412,
      storageTotalGb: 1024,
    },
    attention: [
      { id: 'art', label: 'Missing artwork in library', count: 12, tone: 'warning', link: '/games' },
      { id: 'dupes', label: 'Duplicate files', count: 4, tone: 'danger', link: '/duplicates' },
      { id: 'meta', label: 'Unmatched metadata', count: 9, tone: 'info', link: '/metadata' },
    ],
    recent: [
      { id: 'g1', title: 'Super Metroid', system: 'SNES', accent: '#2a6f7a', hasArt: true },
      { id: 'g8', title: 'Chrono Trigger', system: 'SNES', accent: '#4a6a2a', hasArt: true },
      { id: 'g3', title: 'Castlevania: SOTN', system: 'PS1', accent: '#52687a', hasArt: true },
    ],
    favorites: [
      { id: 'g1', title: 'Super Metroid', system: 'SNES', accent: '#2a6f7a', hasArt: true },
      { id: 'g3', title: 'Castlevania: SOTN', system: 'PS1', accent: '#52687a', hasArt: true },
      { id: 'g8', title: 'Chrono Trigger', system: 'SNES', accent: '#4a6a2a', hasArt: true },
      { id: 'g6', title: 'Final Fantasy VII', system: 'PS1', accent: '#3a4a8a', hasArt: true },
    ],
  },
  u2: {
    userId: 'u2',
    displayName: 'Alex Rivera',
    stats: {
      myFavorites: 2,
      myDownloads: 5,
      libraryGames: 248,
      physicalGames: 86,
      systems: 14,
      storageUsedGb: 412,
      storageTotalGb: 1024,
    },
    attention: [
      { id: 'loan', label: 'Items you have checked out', count: 1, tone: 'info', link: '/physical' },
    ],
    recent: [
      { id: 'g5', title: 'Streets of Rage 2', system: 'Genesis', accent: '#8a3a2a', hasArt: true },
      { id: 'g1', title: 'Super Metroid', system: 'SNES', accent: '#2a6f7a', hasArt: true },
    ],
    favorites: [
      { id: 'g1', title: 'Super Metroid', system: 'SNES', accent: '#2a6f7a', hasArt: true },
      { id: 'g5', title: 'Streets of Rage 2', system: 'Genesis', accent: '#8a3a2a', hasArt: true },
    ],
  },
  u3: {
    userId: 'u3',
    displayName: 'Sam Chen',
    stats: {
      myFavorites: 1,
      myDownloads: 2,
      libraryGames: 248,
      physicalGames: 86,
      systems: 14,
      storageUsedGb: 412,
      storageTotalGb: 1024,
    },
    attention: [],
    recent: [{ id: 'g7', title: 'Kirby’s Adventure', system: 'NES', accent: '#8a4a7a', hasArt: false }],
    favorites: [{ id: 'g7', title: 'Kirby’s Adventure', system: 'NES', accent: '#8a4a7a', hasArt: false }],
  },
};
