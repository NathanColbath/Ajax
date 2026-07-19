export { DashboardApi } from './dashboard/dashboard.api';
export type {
  DashboardSnapshot,
  DashboardStats,
  DashboardAttentionItem,
  DashboardRecentGame,
} from './dashboard/dashboard.models';

export { GamesApi } from './games/games.api';
export type { GameSummary, GameDetail, GameFile, GamesQuery } from './games/games.models';

export { PhysicalApi } from './physical/physical.api';
export type { PhysicalItem } from './physical/physical.models';

export { LocationsApi } from './locations/locations.api';
export type { PhysicalLocation, LocationType } from './locations/locations.models';

export { SystemsApi } from './systems/systems.api';
export type { GameSystem } from './systems/systems.models';

export { UploadsApi } from './uploads/uploads.api';
export type { UploadJob, UploadJobState } from './uploads/uploads.models';

export { MetadataApi } from './metadata/metadata.api';
export type { MetadataProvider, MetadataReviewItem } from './metadata/metadata.models';

export { DuplicatesApi } from './duplicates/duplicates.api';
export type { DuplicateGroup, DuplicateFile } from './duplicates/duplicates.models';

export { ExportsApi } from './exports/exports.api';
export type { ExportJob, ExportFormat, ExportScope } from './exports/exports.models';

export { UsersApi } from './users/users.api';
export type { LibraryUser, UserRole } from './users/users.models';

export { ConfigApi } from './config/config.api';
export type { SystemConfig, StorageMetrics, StoragePathMetric } from './config/config.models';

export { AuthApi } from './auth/auth.api';
export type { AuthSession, LoginRequest } from './auth/auth.models';
