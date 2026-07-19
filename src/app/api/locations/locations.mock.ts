import { PhysicalLocation } from './locations.models';

export const MOCK_LOCATIONS: PhysicalLocation[] = [
  { id: 'loc1', name: 'Shelf A1', type: 'shelf', notes: 'NES / SNES carts' },
  { id: 'loc2', name: 'Shelf A2', type: 'shelf' },
  { id: 'loc3', name: 'Bin B2', type: 'bin', notes: 'Handhelds' },
  { id: 'loc4', name: 'Cabinet 1', type: 'cabinet', notes: 'Hardware' },
  { id: 'loc5', name: 'Bin C1', type: 'bin' },
];
