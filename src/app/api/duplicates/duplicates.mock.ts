import { DuplicateGroup } from './duplicates.models';

export const MOCK_DUPLICATES: DuplicateGroup[] = [
  {
    id: 'd1',
    hash: 'a3f9c2…e81b',
    files: [
      {
        id: 'df1',
        name: 'Super Metroid (USA).sfc',
        path: '/roms/snes/verified/',
        sizeLabel: '3.0 MB',
        system: 'SNES',
      },
      {
        id: 'df2',
        name: 'Super Metroid (U) [!].sfc',
        path: '/roms/snes/inbox/',
        sizeLabel: '3.0 MB',
        system: 'SNES',
      },
    ],
  },
  {
    id: 'd2',
    hash: '91bb0d…44aa',
    files: [
      {
        id: 'df3',
        name: 'Sonic2.md',
        path: '/roms/genesis/',
        sizeLabel: '1.0 MB',
        system: 'Genesis',
      },
      {
        id: 'df4',
        name: 'Sonic the Hedgehog 2 (USA).md',
        path: '/roms/genesis/sorted/',
        sizeLabel: '1.0 MB',
        system: 'Genesis',
      },
      {
        id: 'df5',
        name: 'sonic2_backup.md',
        path: '/roms/_backup/',
        sizeLabel: '1.0 MB',
        system: 'Genesis',
      },
    ],
  },
];
