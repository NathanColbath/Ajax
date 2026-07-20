# Create and checkout a branch: (type/area)-name
#
# Usage:
#   .\scripts\new-branch.ps1
#   .\scripts\new-branch.ps1 -Type fix -Area ui -Name "update-for-mobile-devices"
#   .\scripts\new-branch.ps1 -Type feat -Area io -Name physical-scan -BaseBranch main

[CmdletBinding()]
param(
  [string]$Type = "",
  [string]$Area = "",
  [string]$Name = "",
  [string]$BaseBranch = "main",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$KnownTypes = @(
  "feat",
  "fix",
  "chore",
  "docs",
  "refactor",
  "test",
  "style",
  "perf",
  "ci",
  "build"
)

$KnownAreas = @(
  "api",
  "ui",
  "io",
  "auth",
  "uploads",
  "physical",
  "deploy",
  "db",
  "mobile",
  "web"
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

function Prompt-FromList([string]$label, [string[]]$options) {
  Write-Host ""
  Write-Host "Select ${label}:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $options.Count; $i++) {
    Write-Host ("  {0,2}) {1}" -f ($i + 1), $options[$i])
  }
  Write-Host ("  {0,2}) custom" -f ($options.Count + 1))
  Write-Host ""

  while ($true) {
    $choice = Read-Host "$label number (or type a custom value)"
    $choice = $choice.Trim()
    if (-not $choice) { continue }

    if ($choice -match '^\d+$') {
      $n = [int]$choice
      if ($n -ge 1 -and $n -le $options.Count) {
        return $options[$n - 1]
      }
      if ($n -eq ($options.Count + 1)) {
        $custom = Read-Host "Custom $label"
        $custom = Sanitize-BranchSlug $custom
        if ($custom) { return $custom }
        Write-Host "$label cannot be empty." -ForegroundColor Yellow
        continue
      }
      Write-Host "Invalid number." -ForegroundColor Yellow
      continue
    }

    $custom = Sanitize-BranchSlug $choice
    if ($custom) { return $custom }
    Write-Host "$label cannot be empty." -ForegroundColor Yellow
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
  Write-Host "Working tree has uncommitted changes:" -ForegroundColor Yellow
  git status -sb
  Write-Host ""
  $continueDirty = Read-Host "Create branch anyway? [Y/n]"
  if ($continueDirty -and $continueDirty -notmatch '^[Yy]') {
    Write-Host "Cancelled. Commit/stash first, or re-run with -Force."
    exit 0
  }
}

if (-not $Type) {
  $Type = Prompt-FromList "type" $KnownTypes
} else {
  $Type = Sanitize-BranchSlug $Type
  if (-not $Type) { throw "Type cannot be empty." }
}

if (-not $Area) {
  $Area = Prompt-FromList "area" $KnownAreas
} else {
  $Area = Sanitize-BranchSlug $Area
  if (-not $Area) { throw "Area cannot be empty." }
}

if (-not $Name) {
  $Name = Prompt-Name
} else {
  $Name = Sanitize-BranchSlug $Name
  if (-not $Name) { throw "Name cannot be empty." }
}

$branch = "($Type/$Area)-$Name"

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

git show-ref --verify --quiet "refs/heads/$branch" 2>$null
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
