# Create and checkout a scoped branch: (scope)-name
#
# Usage:
#   .\scripts\new-branch.ps1
#   .\scripts\new-branch.ps1 -Scope feat -Name "add-login"
#   .\scripts\new-branch.ps1 -Scope io -Name physical-scan -BaseBranch main

[CmdletBinding()]
param(
  [string]$Scope = "",
  [string]$Name = "",
  [string]$BaseBranch = "main",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$KnownScopes = @(
  "feat",
  "fix",
  "chore",
  "docs",
  "refactor",
  "test",
  "style",
  "perf",
  "ci",
  "build",
  "io",
  "api",
  "ui"
)

function Sanitize-BranchSlug([string]$raw) {
  $slug = $raw.Trim().ToLowerInvariant()
  $slug = $slug -replace '\s+', '-'
  $slug = $slug -replace '_+', '-'
  $slug = $slug -replace '[^a-z0-9./-]', ''
  $slug = $slug -replace '-{2,}', '-'
  $slug = $slug.Trim('-', '.', '/')
  return $slug
}

function Prompt-Scope {
  Write-Host ""
  Write-Host "Select a scope:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $KnownScopes.Count; $i++) {
    Write-Host ("  {0,2}) {1}" -f ($i + 1), $KnownScopes[$i])
  }
  Write-Host ("  {0,2}) custom" -f ($KnownScopes.Count + 1))
  Write-Host ""

  while ($true) {
    $choice = Read-Host "Scope number (or type a custom scope)"
    $choice = $choice.Trim()
    if (-not $choice) { continue }

    if ($choice -match '^\d+$') {
      $n = [int]$choice
      if ($n -ge 1 -and $n -le $KnownScopes.Count) {
        return $KnownScopes[$n - 1]
      }
      if ($n -eq ($KnownScopes.Count + 1)) {
        $custom = Read-Host "Custom scope"
        $custom = Sanitize-BranchSlug $custom
        if ($custom) { return $custom }
        Write-Host "Scope cannot be empty." -ForegroundColor Yellow
        continue
      }
      Write-Host "Invalid number." -ForegroundColor Yellow
      continue
    }

    $custom = Sanitize-BranchSlug $choice
    if ($custom) { return $custom }
    Write-Host "Scope cannot be empty." -ForegroundColor Yellow
  }
}

function Prompt-Name {
  while ($true) {
    $raw = Read-Host "Branch name (short description)"
    $slug = Sanitize-BranchSlug $raw
    if ($slug) { return $slug }
    Write-Host "Name cannot be empty." -ForegroundColor Yellow
  }
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is required on PATH"
}

$status = git status --porcelain
if ($status -and -not $Force) {
  Write-Host "Working tree has uncommitted changes. Commit/stash them, or re-run with -Force." -ForegroundColor Yellow
  git status -sb
  throw "Refusing to create a branch on a dirty working tree (use -Force to override)."
}

if (-not $Scope) {
  $Scope = Prompt-Scope
} else {
  $Scope = Sanitize-BranchSlug $Scope
  if (-not $Scope) { throw "Scope cannot be empty." }
}

if (-not $Name) {
  $Name = Prompt-Name
} else {
  $Name = Sanitize-BranchSlug $Name
  if (-not $Name) { throw "Name cannot be empty." }
}

$branch = "($Scope)-$Name"

Write-Host ""
Write-Host "Creating branch: $branch" -ForegroundColor Cyan
Write-Host "Base:             $BaseBranch"
$confirm = Read-Host "Continue? [Y/n]"
if ($confirm -and $confirm -notmatch '^[Yy]') {
  Write-Host "Cancelled."
  exit 0
}

$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne $BaseBranch) {
  Write-Host "Checking out $BaseBranch..." -ForegroundColor DarkGray
  git checkout $BaseBranch
  if ($LASTEXITCODE -ne 0) { throw "Failed to checkout $BaseBranch" }
}

$existing = git show-ref --verify --quiet "refs/heads/$branch" 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Branch already exists: $branch" -ForegroundColor Yellow
  $switch = Read-Host "Check it out instead? [Y/n]"
  if (-not $switch -or $switch -match '^[Yy]') {
    git checkout $branch
    if ($LASTEXITCODE -ne 0) { throw "Failed to checkout $branch" }
    Write-Host "Switched to $branch" -ForegroundColor Green
    exit 0
  }
  throw "Branch already exists: $branch"
}

git checkout -b $branch
if ($LASTEXITCODE -ne 0) { throw "Failed to create branch $branch" }

Write-Host ""
Write-Host "Created and checked out: $branch" -ForegroundColor Green
git status -sb
