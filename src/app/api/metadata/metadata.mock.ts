import { MetadataProvider, MetadataReviewItem } from './metadata.models';

export const MOCK_PROVIDERS: MetadataProvider[] = [
  {
    id: 'hasheous',
    name: 'Hasheous',
    description: 'Matches ROM SHA256 hashes via Hasheous and enriches games through the IGDB metadata proxy.',
    enabled: true,
    lastRunLabel: '2 hours ago',
    status: 'success',
  },
  {
    id: 'manual',
    name: 'Manual entry',
    description: 'Edit game and system metadata and upload cover art locally. Always available.',
    enabled: true,
    lastRunLabel: 'Always on',
    status: 'idle',
  },
];

export const MOCK_REVIEW_QUEUE: MetadataReviewItem[] = [
  {
    id: 'm1',
    fileName: 'Super Metroid (USA).sfc',
    suggestedTitle: 'Super Metroid',
    system: 'SNES',
    confidence: 0.95,
    gameId: 'g1',
    providerId: 'hasheous',
    suggestedCoverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2uno.jpg',
  },
  {
    id: 'm2',
    fileName: 'Sonic the Hedgehog 2 (USA).md',
    suggestedTitle: 'Sonic the Hedgehog 2',
    system: 'Genesis',
    confidence: 0.8,
    gameId: 'g2',
    providerId: 'hasheous',
    suggestedCoverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg',
  },
  {
    id: 'm3',
    fileName: 'unknown_dump_04.nes',
    suggestedTitle: 'Unknown NES title',
    system: 'NES',
    confidence: 0.55,
    gameId: 'g4',
    providerId: 'hasheous',
    suggestedCoverUrl: null,
  },
];
