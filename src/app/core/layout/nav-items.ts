import { UserRole } from '../../api/users/users.models';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  /** Minimum role required to see this item (inclusive). */
  minRole?: UserRole;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
  { path: '/games', label: 'Games', icon: 'sports_esports' },
  { path: '/physical', label: 'Physical', icon: 'inventory_2' },
  { path: '/systems', label: 'Systems', icon: 'devices', minRole: 'admin' },
  { path: '/uploads', label: 'Uploads', icon: 'upload_file', minRole: 'admin' },
  { path: '/metadata', label: 'Metadata', icon: 'auto_awesome', minRole: 'admin' },
  { path: '/duplicates', label: 'Duplicates', icon: 'content_copy', minRole: 'admin' },
  { path: '/exports', label: 'Exports', icon: 'ios_share', minRole: 'admin' },
  { path: '/users', label: 'Users', icon: 'group', minRole: 'admin' },
  { path: '/config', label: 'Config', icon: 'tune', minRole: 'admin' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export const APP_NAV_FOOTER: NavItem[] = [
  { path: '/ui', label: 'Shared UI', icon: 'widgets', minRole: 'admin' },
];
