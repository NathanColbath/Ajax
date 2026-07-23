import { DashboardSnapshot } from './dashboard.models';

const sampleGames = {
  g1: { id: 'g1', title: 'Super Metroid', system: 'SNES', accent: '#2a6f7a', hasArt: true },
  g3: { id: 'g3', title: 'Castlevania: SOTN', system: 'PS1', accent: '#52687a', hasArt: true },
  g5: { id: 'g5', title: 'Streets of Rage 2', system: 'Genesis', accent: '#8a3a2a', hasArt: true },
  g6: { id: 'g6', title: 'Final Fantasy VII', system: 'PS1', accent: '#3a4a8a', hasArt: true },
  g7: { id: 'g7', title: "Kirby's Adventure", system: 'NES', accent: '#8a4a7a', hasArt: false },
  g8: { id: 'g8', title: 'Chrono Trigger', system: 'SNES', accent: '#4a6a2a', hasArt: true },
  g9: { id: 'g9', title: 'Mario Kart 64', system: 'N64', accent: '#3a6a8a', hasArt: true },
  g10: { id: 'g10', title: 'Aladdin', system: 'Genesis', accent: '#8a6a2a', hasArt: true },
  g11: { id: 'g11', title: 'Alien 3', system: 'SNES', accent: '#4a3a5a', hasArt: true },
  g12: { id: 'g12', title: 'Airwolf', system: 'NES', accent: '#2a4a6a', hasArt: true },
} as const;

const sampleSystems = [
  { id: 's-nes', name: 'Nintendo Entertainment System', shortName: 'NES', gameCount: 42, hasLogo: true },
  { id: 's-snes', name: 'Super Nintendo', shortName: 'SNES', gameCount: 38, hasLogo: true },
  { id: 's-n64', name: 'Nintendo 64', shortName: 'N64', gameCount: 21, hasLogo: true },
  { id: 's-gb', name: 'Game Boy', shortName: 'GB', gameCount: 17, hasLogo: false },
  { id: 's-gen', name: 'Sega Genesis', shortName: 'Genesis', gameCount: 29, hasLogo: true },
];

export const MOCK_DASHBOARDS: Record<string, DashboardSnapshot> = {
  u1: {
    userId: 'u1',
    displayName: 'Nathan',
    stats: {
      myFavorites: 4,
      myDownloads: 18,
      myLists: 2,
      libraryGames: 248,
      physicalGames: 16,
      systems: 14,
      storageUsedGb: 412,
      storageTotalGb: 1024,
    },
    attention: [
      { id: 'art', label: 'Missing artwork in library', count: 12, tone: 'warning', link: '/games' },
      { id: 'dupes', label: 'Duplicate files', count: 4, tone: 'danger', link: '/duplicates' },
      { id: 'meta', label: 'Unmatched metadata', count: 9, tone: 'info', link: '/metadata' },
    ],
    continuePlaying: [sampleGames.g11, sampleGames.g9, sampleGames.g10, sampleGames.g12],
    recentlyAdded: [sampleGames.g9, sampleGames.g10, sampleGames.g11, sampleGames.g12, sampleGames.g5, sampleGames.g1],
    favorites: [sampleGames.g12, sampleGames.g1, sampleGames.g8],
    systems: sampleSystems,
    recommendations: [sampleGames.g3, sampleGames.g6, sampleGames.g5, sampleGames.g7, sampleGames.g1, sampleGames.g8],
  },
  u2: {
    userId: 'u2',
    displayName: 'Alex Rivera',
    stats: {
      myFavorites: 2,
      myDownloads: 5,
      myLists: 1,
      libraryGames: 248,
      physicalGames: 16,
      systems: 14,
      storageUsedGb: 412,
      storageTotalGb: 1024,
    },
    attention: [
      { id: 'loan', label: 'Items you have checked out', count: 1, tone: 'info', link: '/physical' },
    ],
    continuePlaying: [sampleGames.g5, sampleGames.g1],
    recentlyAdded: [sampleGames.g9, sampleGames.g5, sampleGames.g1],
    favorites: [sampleGames.g1, sampleGames.g5],
    systems: sampleSystems.slice(0, 4),
    recommendations: [sampleGames.g8, sampleGames.g3, sampleGames.g10],
  },
  u3: {
    userId: 'u3',
    displayName: 'Sam Chen',
    stats: {
      myFavorites: 1,
      myDownloads: 2,
      myLists: 0,
      libraryGames: 248,
      physicalGames: 16,
      systems: 14,
      storageUsedGb: 412,
      storageTotalGb: 1024,
    },
    attention: [],
    continuePlaying: [],
    recentlyAdded: [sampleGames.g7],
    favorites: [sampleGames.g7],
    systems: sampleSystems.slice(0, 3),
    recommendations: [sampleGames.g1, sampleGames.g5],
  },
};
