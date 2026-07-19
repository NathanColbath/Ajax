export interface PhysicalItem {
  id: string;
  title: string;
  system: string;
  condition: 'mint' | 'good' | 'fair' | 'poor';
  locationId: string;
  locationName: string;
  completeness: 'cib' | 'cart' | 'box' | 'loose';
  checkedOut: boolean;
  borrower?: string;
  accent: string;
}
