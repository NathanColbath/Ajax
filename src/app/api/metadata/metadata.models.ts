export interface MetadataProvider {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastRunLabel: string;
  status: 'idle' | 'running' | 'success' | 'warning';
}

export interface MetadataReviewItem {
  id: string;
  fileName: string;
  suggestedTitle: string;
  system: string;
  confidence: number;
  gameId?: string | null;
  providerId?: string | null;
  suggestedCoverUrl?: string | null;
}

export interface PublicEnrichmentStatus {
  status: 'idle' | 'running' | 'success' | 'warning' | string;
  lastRunLabel: string;
  updatedAt: string;
}
