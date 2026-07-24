export type DashboardSectionId =
  | 'libraryStats'
  | 'continuePlaying'
  | 'recentlyAdded'
  | 'favorites'
  | 'systems'
  | 'recommendations'
  | 'attention';

export interface DashboardSectionDef {
  id: DashboardSectionId;
  label: string;
  /** Only meaningful for admins; non-admins never see it. */
  adminOnly?: boolean;
}

export const DASHBOARD_SECTIONS: readonly DashboardSectionDef[] = [
  { id: 'libraryStats', label: 'Your library' },
  { id: 'continuePlaying', label: 'Continue where you left off' },
  { id: 'recentlyAdded', label: 'Recently added' },
  { id: 'favorites', label: 'Your favorites' },
  { id: 'systems', label: 'Browse by system' },
  { id: 'recommendations', label: 'You might also like' },
  { id: 'attention', label: 'Needs your attention', adminOnly: true },
];

export const DEFAULT_DASHBOARD_SECTION_ORDER: readonly DashboardSectionId[] =
  DASHBOARD_SECTIONS.map((s) => s.id);

/** Paths that must remain reachable via More if removed from primary. */
export const NAV_ALWAYS_RECOVERABLE = new Set(['/', '/settings']);
