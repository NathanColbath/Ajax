#!/usr/bin/env bash
# Pull and run Retrojax from private GHCR on a VPS.
#
# Prerequisites:
#   - Docker + Compose plugin
#   - docker-compose.prod.yml and .env in this directory (or APP_DIR)
#   - Already logged in to ghcr.io (docker login), OR GHCR_USER + GHCR_TOKEN set
#
# Usage:
#   ./scripts/deploy-vps.sh 1.2.0
#   IMAGE_TAG=1.2.0 ./scripts/deploy-vps.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$APP_DIR"

VERSION="${1:-${IMAGE_TAG:-}}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <X.Y.Z>" >&2
  exit 1
fi
VERSION="${VERSION#v}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: $VERSION (expected X.Y.Z)" >&2
  exit 1
fi

export IMAGE_TAG="$VERSION"
export GHCR_IMAGE_PREFIX="${GHCR_IMAGE_PREFIX:-nathancolbath/ajax}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing $COMPOSE_FILE in $APP_DIR" >&2
  exit 1
fi

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-$(whoami)}" --password-stdin
fi

echo "Deploying IMAGE_TAG=$IMAGE_TAG (prefix=$GHCR_IMAGE_PREFIX)"
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Drop dangling layers from previous tags (safe; does not remove in-use images)
docker image prune -f >/dev/null 2>&1 || true

echo "Deploy complete. Running containers:"
docker compose -f "$COMPOSE_FILE" ps
