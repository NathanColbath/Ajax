# Deploy (CI/CD)

Retrojax ships via **GitHub Actions** → private **GHCR** images → **self-hosted VPS** over SSH.

## Flow

1. Merge work into `main`
2. Cut a version branch: `git checkout -b version/1.2.0 main` and push it
3. [`.github/workflows/release.yml`](../.github/workflows/release.yml) builds/pushes images and creates GitHub Release `v1.2.0`
4. [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) SSHs to the VPS, pulls images, and restarts Compose

CI on every PR/`main` push builds both Docker images ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) without publishing.

## Image names

```
ghcr.io/nathancolbath/ajax/web:<tag>
ghcr.io/nathancolbath/ajax/api:<tag>
```

Release tags: `X.Y.Z`, `vX.Y.Z`, short SHA, and `latest`.

## GitHub repo settings

### Variables

| Name | Example | Purpose |
|------|---------|---------|
| `PUBLIC_ORIGIN` | `https://games.example.com` | Baked into the web image as Auth0 origin; used for deploy health checks |
| `VPS_APP_DIR` | `/root/retrojax` | Absolute path to the Compose project on the VPS |
| `VPS_PORT` | `22` | SSH port (optional, default 22) |
| `GHCR_IMAGE_PREFIX` | `nathancolbath/ajax` | Optional override for image path |

### Secrets

| Name | Purpose |
|------|---------|
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | Private key for that user (full PEM) |

Packages must stay **private**. The VPS Docker login needs `read:packages` (see bootstrap).

## VPS one-time bootstrap

1. Install Docker Engine + Compose plugin.
2. Create the app directory and copy deploy files only (no full source tree required):

```bash
mkdir -p /root/retrojax/data /root/retrojax/scripts
# copy from this repo:
#   docker-compose.prod.yml
#   .env.example → .env
#   scripts/deploy-vps.sh
chmod +x /root/retrojax/scripts/deploy-vps.sh
```

3. Edit `.env` (`PUBLIC_ORIGIN`, Auth0, API keys, `HTTP_PORT`). Align Auth0 Allowed Callback / Logout / Web Origins with `PUBLIC_ORIGIN`.
4. Create a GitHub PAT (classic) with `read:packages`, then:

```bash
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Prefer leaving credentials in `~/.docker/config.json` on the VPS so Actions only needs SSH (no `GHCR_READ_TOKEN` in GitHub). Alternatively set `GHCR_USER` / `GHCR_TOKEN` in the environment used by `deploy-vps.sh`.

The prod Compose file joins the external Docker network **`nginx_default`** (Nginx Proxy Manager). Ensure that network exists (`docker network ls`) before the first `up`. Proxy host: scheme `http`, forward hostname = web container name (e.g. `retrojax-web-1`), port `80`.

5. Set GitHub Variables/Secrets listed above (`VPS_APP_DIR=/root/retrojax`, etc.).
6. Trigger the first deploy by pushing `version/0.1.0` (or use **Actions → Deploy → Run workflow** with a version after images exist).

Manual deploy on the box:

```bash
cd /root/retrojax
./scripts/deploy-vps.sh 1.2.0
```

## Local development (build from source)

Use [`docker-compose.yml`](../docker-compose.yml) as before:

```bash
cp .env.example .env
docker compose up --build -d
```

## Offline / source tarball fallback

[`scripts/package-for-vps.ps1`](package-for-vps.ps1) still packages source for building on the server when GHCR is unavailable. Prefer registry pull for normal releases.

## Rollback

**Actions → Deploy → Run workflow** and enter an earlier semver (e.g. `1.1.0`) that still exists in GHCR.
