# Cut a version/X.Y.Z branch from main and push it to trigger the Release workflow
# (GHCR images + GitHub Release vX.Y.Z → Deploy).
#
# Usage:
#   .\scripts\cut-version.ps1 0.1.0
#   .\scripts\cut-version.ps1 -Version 0.2.0
#   .\scripts\cut-version.ps1 -Bump patch    # from latest v* tag (or 0.0.0)
#   .\scripts\cut-version.ps1 -Bump minor
#   .\scripts\cut-version.ps1 -Bump major
#   .\scripts\cut-version.ps1 0.1.0 -DryRun
#   .\scripts\cut-version.ps1 0.1.0 -Force   # allow dirty working tree

[CmdletBinding(DefaultParameterSetName = "Explicit")]
param(
  [Parameter(ParameterSetName = "Explicit", Position = 0)]
  [string]$Version = "",

  [Parameter(ParameterSetName = "Bump")]
  [ValidateSet("major", "minor", "patch")]
  [string]$Bump = "",

  [switch]$DryRun,
  [switch]$Force,
  [string]$Remote = "origin",
  [string]$BaseBranch = "main"
)

$ErrorActionPreference = "Stop"

function Test-SemVer([string]$v) {
  return $v -match '^[0-9]+\.[0-9]+\.[0-9]+$'
}

function Get-LatestSemVerTag {
  $tags = @(git tag -l "v*.*.*" --sort=-v:refname 2>$null)
  foreach ($t in $tags) {
    $raw = $t.Trim()
    if ($raw.StartsWith("v")) { $raw = $raw.Substring(1) }
    if (Test-SemVer $raw) { return $raw }
  }
  return "0.0.0"
}

function Get-NextSemVer([string]$current, [string]$bumpKind) {
  $parts = $current.Split('.')
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $patch = [int]$parts[2]
  switch ($bumpKind) {
    "major" { return "$( $major + 1 ).0.0" }
    "minor" { return "$major.$( $minor + 1 ).0" }
    "patch" { return "$major.$minor.$( $patch + 1 )" }
  }
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is required on PATH"
}

# Resolve version
if ($PSCmdlet.ParameterSetName -eq "Bump" -or $Bump) {
  git fetch --tags $Remote 2>$null | Out-Null
  $latest = Get-LatestSemVerTag
  $Version = Get-NextSemVer $latest $Bump
  Write-Host "Latest tag base: $latest → bump $Bump → $Version" -ForegroundColor Cyan
}
elseif (-not $Version) {
  throw "Provide a version (e.g. 0.1.0) or -Bump patch|minor|major"
}

$Version = $Version.TrimStart('v')
if (-not (Test-SemVer $Version)) {
  throw "Version must be semver X.Y.Z (got: $Version)"
}

$branch = "version/$Version"
$tag = "v$Version"

# Safety checks
$status = git status --porcelain
if ($status -and -not $Force) {
  Write-Host $status
  throw "Working tree is dirty. Commit/stash first, or pass -Force."
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray
Write-Host "Will create branch $branch from $Remote/$BaseBranch (release $tag)" -ForegroundColor Cyan

if ($DryRun) {
  Write-Host "[DryRun] No git changes made." -ForegroundColor Yellow
  exit 0
}

# Ensure remote branch does not already exist
git fetch $Remote --prune | Out-Null
$remoteExists = git ls-remote --heads $Remote $branch
if ($remoteExists) {
  throw "Remote branch $branch already exists on $Remote. Pick a new version."
}

$localExists = git show-ref --verify --quiet "refs/heads/$branch"
if ($LASTEXITCODE -eq 0) {
  throw "Local branch $branch already exists. Delete it or pick a new version."
}

Write-Host "Checking out $BaseBranch and pulling..." -ForegroundColor Cyan
git checkout $BaseBranch
if ($LASTEXITCODE -ne 0) { throw "Failed to checkout $BaseBranch" }

git pull $Remote $BaseBranch
if ($LASTEXITCODE -ne 0) { throw "Failed to pull $Remote/$BaseBranch" }

Write-Host "Creating $branch..." -ForegroundColor Cyan
git checkout -b $branch
if ($LASTEXITCODE -ne 0) { throw "Failed to create $branch" }

Write-Host "Pushing $branch to $Remote..." -ForegroundColor Cyan
git push -u $Remote $branch
if ($LASTEXITCODE -ne 0) { throw "Failed to push $branch" }

$remoteUrl = (git remote get-url $Remote).Trim()
$actionsUrl = $null
if ($remoteUrl -match 'github\.com[:/](.+?)(?:\.git)?$') {
  $slug = $Matches[1] -replace '\\', '/'
  $actionsUrl = "https://github.com/$slug/actions"
}

Write-Host ""
Write-Host "Done. Pushed $branch — Release workflow should start." -ForegroundColor Green
Write-Host "  Tag/release: $tag"
Write-Host "  Images:      ghcr.io/nathancolbath/ajax/web:$Version"
Write-Host "  Images:      ghcr.io/nathancolbath/ajax/api:$Version"
if ($actionsUrl) {
  Write-Host "  Actions:     $actionsUrl"
}
Write-Host ""
Write-Host "After Release succeeds, deploy (auto if secrets set) or on VPS:" -ForegroundColor Yellow
Write-Host "  cd /root/retrojax && ./scripts/deploy-vps.sh $Version"
Write-Host ""
Write-Host "You are on branch $branch. Switch back when ready:" -ForegroundColor DarkGray
Write-Host "  git checkout $BaseBranch"
