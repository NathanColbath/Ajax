# Packages Retrojax source for Docker Compose deploy on a VPS.
# Creates a .tar.gz (no node_modules / build outputs / secrets) and prints deploy steps.
#
# Usage: .\scripts\package-for-vps.ps1

[CmdletBinding()]
param(
  [string]$OutDir = "",
  [string]$ArchiveName = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutDir) {
  $OutDir = Join-Path $RepoRoot "dist-package"
}
if (-not $ArchiveName) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ArchiveName = "retrojax-docker-$stamp.tar.gz"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$ArchivePath = Join-Path $OutDir $ArchiveName

$Required = @(
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.prod.yml",
  ".dockerignore",
  ".env.example",
  "package.json",
  "package-lock.json",
  "angular.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "docker",
  "public",
  "src",
  "api/GameLibrary.Api",
  "scripts/deploy-vps.sh"
)

foreach ($item in $Required) {
  $full = Join-Path $RepoRoot $item
  if (-not (Test-Path $full)) {
    throw "Missing required path for package: $item"
  }
}

$excludes = @(
  "--exclude=node_modules",
  "--exclude=.angular",
  "--exclude=dist",
  "--exclude=bin",
  "--exclude=obj",
  "--exclude=.git",
  "--exclude=.vs",
  "--exclude=.cursor",
  "--exclude=.env",
  "--exclude=.env.local",
  "--exclude=*.db",
  "--exclude=*.db-*",
  "--exclude=api/data",
  "--exclude=data",
  "--exclude=dist-package",
  "--exclude=__screenshots__",
  "--exclude=coverage"
)

Write-Host "Creating $ArchivePath ..." -ForegroundColor Cyan

Push-Location $RepoRoot
try {
  & tar -czf $ArchivePath @excludes @Required
  if ($LASTEXITCODE -ne 0) {
    throw "tar exited with code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

$listing = @( & tar -tzf $ArchivePath )
$mustContain = @(
  "docker-compose.yml",
  "Dockerfile",
  "api/GameLibrary.Api/Dockerfile",
  "api/GameLibrary.Api/GameLibrary.Api.csproj",
  "api/GameLibrary.Api/Program.cs",
  "src/main.ts",
  "docker/nginx.conf"
)

foreach ($entry in $mustContain) {
  $found = $listing | Where-Object { $_ -eq $entry -or $_.StartsWith("$entry/") }
  if (-not $found) {
    Remove-Item -Force $ArchivePath -ErrorAction SilentlyContinue
    throw "Archive is missing required path: $entry - packaging failed."
  }
}

$sizeMb = [math]::Round((Get-Item $ArchivePath).Length / 1MB, 2)
Write-Host ""
Write-Host ("Done: {0} ({1} MB)" -f $ArchivePath, $sizeMb) -ForegroundColor Green
Write-Host "Verified API context is inside the archive." -ForegroundColor Green
Write-Host ""
Write-Host "========== Upload and deploy on your VPS ==========" -ForegroundColor Yellow
Write-Host ""
Write-Host "Preferred path: GitHub Actions + GHCR (see docs/deploy.md)."
Write-Host "This tarball is the offline/source-build fallback."
Write-Host ""
Write-Host "1) Copy the archive to the VPS (replace USER and HOST):"
Write-Host ""
Write-Host ("   scp `"{0}`" USER@HOST:~/" -f $ArchivePath)
Write-Host ""
Write-Host "   Or with a custom SSH key / port:"
Write-Host ("   scp -i C:\path\to\key -P 22 `"{0}`" USER@HOST:~/" -f $ArchivePath)
Write-Host ""
Write-Host "2) SSH in:"
Write-Host ""
Write-Host "   ssh USER@HOST"
Write-Host ""
Write-Host "3) Unpack into an app directory (replace ARCHIVE with the .tar.gz name):"
Write-Host ""
Write-Host "   mkdir -p ~/retrojax"
Write-Host "   cd ~/retrojax"
Write-Host ("   tar -xzf ~/{0}" -f $ArchiveName)
Write-Host ""
Write-Host "   Confirm the API build context exists:"
Write-Host "     ls ~/retrojax/api/GameLibrary.Api/Dockerfile"
Write-Host "     ls ~/retrojax/docker-compose.yml"
Write-Host ""
Write-Host "4) Create production env on the VPS (do not ship .env in the tar):"
Write-Host ""
Write-Host "   cp .env.example .env"
Write-Host "   nano .env"
Write-Host ""
Write-Host "   Set at least:"
Write-Host "     PUBLIC_ORIGIN=https://your.domain.or.ip"
Write-Host "     HTTP_PORT=80"
Write-Host ""
Write-Host "5) Auth0 dashboard - add PUBLIC_ORIGIN to Callback / Logout / Web Origins"
Write-Host ""
Write-Host "6) Build and start:"
Write-Host ""
Write-Host "   cd ~/retrojax"
Write-Host "   docker compose up --build -d"
Write-Host ""
Write-Host "7) Data on disk:"
Write-Host "   ~/retrojax/data/gamelibrary.db"
Write-Host "   ~/retrojax/data/files/"
Write-Host ""
Write-Host "8) Useful commands:"
Write-Host "   docker compose logs -f"
Write-Host "   docker compose ps"
Write-Host "   docker compose down"
Write-Host ""
Write-Host "=================================================" -ForegroundColor Yellow
Write-Host ("Archive ready: {0}" -f $ArchivePath)
