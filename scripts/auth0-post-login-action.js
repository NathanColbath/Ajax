/**
 * Auth0 Post-Login Action — paste into Actions → Login → Post Login.
 * Click Deploy, then add this Action to the Login flow (between Start and Complete).
 *
 * Also required:
 * - API identifier https://game-library-api with RBAC enabled
 * - User has an Auth0 Role assigned (e.g. admin)
 * - Full logout + login after deploying (refresh tokens keep the old ID token)
 */
exports.onExecutePostLogin = async (event, api) => {
  const claim = 'https://game-library/roles';

  let roles = Array.isArray(event.authorization?.roles)
    ? event.authorization.roles
    : [];

  // Fallback if RBAC authorization object is empty
  const meta = event.user.app_metadata || {};
  if (!roles.length) {
    if (Array.isArray(meta.roles)) {
      roles = meta.roles;
    } else if (typeof meta.role === 'string') {
      roles = [meta.role];
    }
  }

  // Always set the claim so the SPA can detect that this Action ran.
  // (An empty array may be omitted from the JWT by Auth0.)
  const value = roles.length ? roles : ['standard'];
  api.idToken.setCustomClaim(claim, value);
  api.accessToken.setCustomClaim(claim, value);

  console.log('game-library roles claim:', value);
};
