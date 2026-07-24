export interface UserPreferences {
  dashboardSectionOrder: string[];
  dashboardHidden: string[];
  navMorePaths: string[];
}

export type UpdateUserPreferencesRequest = Partial<UserPreferences>;
