export type LocationType = 'shelf' | 'bin' | 'cabinet' | 'room';

export interface PhysicalLocation {
  id: string;
  name: string;
  type: LocationType;
  notes?: string;
}
