export type PhysicalCondition = 'mint' | 'good' | 'fair' | 'poor';
export type PhysicalCompleteness = 'cib' | 'cart' | 'box' | 'loose';

export interface PhysicalItem {
  id: string;
  gameId?: string | null;
  title: string;
  system: string;
  condition: PhysicalCondition | string;
  locationId: string;
  locationName: string;
  completeness: PhysicalCompleteness | string;
  checkedOut: boolean;
  borrower?: string;
  accent: string;
  hasArt: boolean;
  year: number;
}

export interface PhysicalTitleSearchResult {
  igdbId?: number | null;
  title: string;
  year?: number | null;
  platforms: string[];
  coverUrl?: string | null;
  externalId?: string | null;
  source: string;
  sampleMd5?: string | null;
}

export interface CreatePhysicalItemRequest {
  locationId: string;
  systemId: string;
  condition: PhysicalCondition | string;
  completeness: PhysicalCompleteness | string;
  igdbId?: number | null;
  title?: string | null;
  externalId?: string | null;
  sampleMd5?: string | null;
}

export interface UpdatePhysicalItemRequest {
  locationId: string;
  condition: PhysicalCondition | string;
  completeness: PhysicalCompleteness | string;
}
