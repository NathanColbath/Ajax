/**
 * Auth0 SPA settings shared by provideAuth0, login, and logout.
 *
 * =============================================================================
 * REQUIRED for roles to work (otherwise everyone stays `standard`):
 * =============================================================================
 *
 * 1) Applications → APIs → Create API
 *    - Name: Game Library API
 *    - Identifier: https://game-library-api   (must match AUTH0_AUDIENCE below)
 *    - Settings → RBAC: Enable RBAC
 *    - Settings → RBAC: Add Permissions in the Access Token (optional)
 *
 * 2) User Management → Roles: create `super_admin`, `admin`, `standard`
 *    Assign a role on the user (Users → Roles).
 *
 * 3) Actions → Login → Post Login — use scripts/auth0-post-login-action.js
 *    Deploy, then open Flows → Login and drag the Action into the flow (Apply).
 *    If the claim is totally missing from the ID token, this step was skipped.
 *
 * 4) Application (SPA) URLs — exactly, no trailing slash:
 *    - Allowed Callback URLs:  http://localhost:4200
 *    - Allowed Logout URLs:    http://localhost:4200
 *    - Allowed Web Origins:    http://localhost:4200
 *    - Refresh Token Rotation: Enabled
 *
 * 5) Log OUT and log back IN (required to get a new ID token with the claim).
 *
 * Why audience? Auth0 only fills event.authorization.roles when the login
 * requests an API audience with RBAC. SPA-only openid scopes leave roles empty.
 */
export const AUTH0_DOMAIN = 'dev-82ln3zs1yykao3qo.us.auth0.com';
export const AUTH0_CLIENT_ID = 'm4jb44bTmuBDDwrfPBY7BYuZBNUizEbY';

/** Must match Allowed Callback / Logout / Web Origins exactly. */
export const AUTH0_APP_ORIGIN = 'http://localhost:4200';

/**
 * Auth0 API identifier (Applications → APIs). Create this API and enable RBAC
 * so Post-Login Actions receive event.authorization.roles.
 */
export const AUTH0_AUDIENCE = 'https://game-library-api';

/** Namespaced ID-token claim set by the Post-Login Action. */
export const AUTH0_ROLES_CLAIM = 'https://game-library/roles';
