import { MetadataProvider, MetadataReviewItem } from './metadata.models';

export const MOCK_PROVIDERS: MetadataProvider[] = [
  {
    id: 'libretro',
    name: 'Libretro Thumbnails',
    description: 'Cover and box art lookups for known dumps.',
    enabled: true,
    lastRunLabel: '2 hours ago',
    status: 'success',
  },
  {
    id: 'screen',
    name: 'ScreenScraper',
    description: 'Rich metadata and media for consoles.',
    enabled: true,
    lastRunLabel: 'Yesterday',
    status: 'warning',
  },
  {
    id: 'manual',
    name: 'Manual entry',
    description: 'Always available fallback for custom titles.',
    enabled: true,
    lastRunLabel: 'Always on',
    status: 'idle',
  },
];

export const MOCK_REVIEW_QUEUE: MetadataReviewItem[] = [
  {
    id: 'm1',
    fileName: 'sm_jp_rev1.sfc',
    suggestedTitle: 'Super Metroid',
    system: 'SNES',
    confidence: 0.92,
  },
  {
    id: 'm2',
    fileName: 'SOR2_EUR.bin',
    suggestedTitle: 'Streets of Rage 2',
    system: 'Genesis',
    confidence: 0.81,
  },
  {
    id: 'm3',
    fileName: 'unknown_dump_04.nes',
    suggestedTitle: 'Unknown NES title',
    system: 'NES',
    confidence: 0.34,
  },
];
