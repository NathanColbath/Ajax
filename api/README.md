# Game Library API

ASP.NET Core monolith for the Angular SPA. Controllers → Services → Engines, with in-process background workers and durable application logs.

## Deploy (CI/CD)

Production images are built on GitHub Actions, pushed to private GHCR, and deployed to a VPS from `version/X.Y.Z` branches (GitHub Releases). See [`docs/deploy.md`](../docs/deploy.md).

## Run

```bash
# from repo root — two terminals
npm run api
npm start
```

- API: **http://localhost:5080** (Swagger: `/swagger` in Development)
- SPA: **http://localhost:4200** — proxies `/api` → the API via `proxy.conf.json`

## Configuration

### Deploy-time (appsettings / environment variables)

Environment variables override `appsettings.json` using `__` for nested keys. Prefer env (or User Secrets) for secrets — do not commit API keys.

| Config key | Environment variable |
|------------|----------------------|
| `ConnectionStrings:Default` | `ConnectionStrings__Default` |
| `Auth0:Domain` | `Auth0__Domain` |
| `Auth0:Audience` | `Auth0__Audience` |
| `Auth0:RolesClaimType` | `Auth0__RolesClaimType` |
| `Auth0:UserIdClaimType` | `Auth0__UserIdClaimType` |
| `Storage:RootPath` | `Storage__RootPath` |
| `Cors:Origins:0` | `Cors__Origins__0` |
| `Hasheous:ApiKey` | `Hasheous__ApiKey` |
| `Igdb:ClientId` / `ClientSecret` | `Igdb__ClientId` / `Igdb__ClientSecret` |
| `DeepSeek:ApiKey` | `DeepSeek__ApiKey` |
| `Uploads:MaxRequestBytes` | `Uploads__MaxRequestBytes` |
| `Http:EnrichmentTimeoutSeconds` | `Http__EnrichmentTimeoutSeconds` |
| `Jobs:MaxParallelUploadJobs` | `Jobs__MaxParallelUploadJobs` |

Example (PowerShell):

```powershell
$env:Hasheous__ApiKey = "..."
$env:DeepSeek__ApiKey = "..."
npm run api
```

Or: `dotnet user-secrets set "DeepSeek:ApiKey" "..." --project api/GameLibrary.Api`

### Runtime (admin Config UI)

Library name, upload permissions, parallel upload jobs, job run windows, metadata/enrichment batch sizes, dashboard limits, and related knobs are stored in SQLite `SystemConfig` and edited under **Config** in the SPA.


The SPA defaults to **live** API calls (`readStoredApiMode() ?? 'live'`). Use **Config → Data source** to switch mock/live; the choice is stored in `localStorage` (`ajax.apiMode`).

Auth0 must be configured (see SPA `auth0.config.ts` and API `appsettings.json` Auth0 section). Bearer tokens are attached by `authInterceptor`.

## Application logs

- Every HTTP request (except `/swagger` and `/api/logs`) and domain/worker events are written to SQLite `LogEntries`.
- Admin UI: **Logs** in the nav (`/logs`) — filter, poll, inspect correlation/exception.
- API: `GET /api/logs`, `GET /api/logs/{id}`, `DELETE /api/logs?olderThanDays=` (super admin)

## Data

- SQLite: `api/data/gamelibrary.db` — created empty on first run (SystemConfig defaults only; **no seed catalog**)
- File storage: `api/data/files/` (`uploads/`, `library/`, `artwork/`, `exports/`)
- Metadata: Hasheous hash lookup + IGDB proxy — set `Hasheous:ApiKey` in `appsettings.json` (or user secrets / env) to enable proxy enrichment. Get a key from https://hasheous.org/
- Public discussion on game detail: curated reviews/ratings/screenshots via DeepSeek enrichment job on **Metadata** (`DeepSeek:ApiKey`). Optional IGDB scores fallback: set `Igdb:ClientId` + `Igdb:ClientSecret` when games have an IGDB `ExternalId`.
- Factory wipe (Super Admin): **Config → Danger zone** — `POST /api/config/wipe` clears all DB rows and empties `Storage:RootPath`. Catalog stays empty (SystemConfig + Hasheous/Manual providers only). Refuses with 409 if upload/metadata/export jobs are active.

**Wipe note:** After schema changes, delete `api/data/gamelibrary.db` once so `EnsureCreated()` rebuilds, then restart the API. Live mode starts with no systems/games until an admin creates them. Or use Config factory wipe (no restart required for data clear).

## Uploads & downloads

- `POST /api/uploads` — FormData: `files`, required `systemId`, optional `gameId` / `createTitle`
- `GET /api/systems/resolve-extension?ext=.bin` — systems that accept an extension
- Downloads (authenticated):  
  - `GET /api/games/{gameId}/files/{fileId}/download`  
  - `GET /api/exports/{id}/download`  
  - `GET /api/uploads/{id}/download` (completed jobs)

Admins must create **Systems** (with extensions) before uploads can resolve file types.

## Layout

| Folder | Role |
|--------|------|
| `Controllers/` | HTTP endpoints |
| `Services/` | Use-case orchestration, EF, enqueue jobs, app event logging |
| `Engines/` | Domain business logic |
| `Workers/` | Background job processing |
| `Middleware/` | HTTP request logging |
| `Jobs/` | Channel-based work queue |
