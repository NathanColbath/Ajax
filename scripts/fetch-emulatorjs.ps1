# Downloads EmulatorJS release assets into public/emulatorjs for self-hosted play.
# Also installs phase-1 WASM cores via npm into data/cores/.
#
# Usage:
#   .\scripts\fetch-emulatorjs.ps1
#   .\scripts\fetch-emulatorjs.ps1 -Tag 4.2.3
#   .\scripts\fetch-emulatorjs.ps1 -SkipCores
#
# See docs/emulatorjs.md

[CmdletBinding()]
param(
  [string]$Tag = "latest",
  [string]$OutDir = "",
  [switch]$SkipCores
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutDir) {
  $OutDir = Join-Path $RepoRoot "public\emulatorjs"
}

Write-Host "Fetching EmulatorJS ($Tag) → $OutDir" -ForegroundColor Cyan

$tmp = Join-Path $env:TEMP "emulatorjs-fetch-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

try {
  $api = if ($Tag -eq "latest") {
    "https://api.github.com/repos/EmulatorJS/EmulatorJS/releases/latest"
  } else {
    "https://api.github.com/repos/EmulatorJS/EmulatorJS/releases/tags/$Tag"
  }

  $release = Invoke-RestMethod -Uri $api -Headers @{ "User-Agent" = "retrojax-fetch-emulatorjs" }
  $resolvedTag = $release.tag_name
  $version = $resolvedTag.TrimStart('v')
  Write-Host "Release: $resolvedTag" -ForegroundColor DarkGray

  $asset = $release.assets |
    Where-Object { $_.name -match 'data|emulatorjs' -and $_.name -match '\.zip$' } |
    Select-Object -First 1

  $zipPath = Join-Path $tmp "emulatorjs.zip"
  if ($asset) {
    Write-Host "Downloading asset $($asset.name)..." -ForegroundColor DarkGray
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing
  } else {
    $zipUrl = $release.zipball_url
    if (-not $zipUrl) {
      $zipUrl = "https://github.com/EmulatorJS/EmulatorJS/archive/refs/tags/$resolvedTag.zip"
    }
    Write-Host "Downloading source zipball..." -ForegroundColor DarkGray
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
  }

  Expand-Archive -Path $zipPath -DestinationPath $tmp -Force

  $dataSrc = Get-ChildItem -Path $tmp -Recurse -Directory -Filter "data" |
    Where-Object { Test-Path (Join-Path $_.FullName "loader.js") } |
    Select-Object -First 1

  if (-not $dataSrc) {
    throw "Could not find data/loader.js in downloaded archive."
  }

  if (Test-Path $OutDir) {
    Remove-Item -Recurse -Force $OutDir
  }
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  Copy-Item -Path $dataSrc.FullName -Destination (Join-Path $OutDir "data") -Recurse -Force

  Set-Content -Path (Join-Path $OutDir "VERSION") -Value $resolvedTag -NoNewline

  if (-not $SkipCores) {
    Write-Host "Installing phase-1 WASM cores (npm @$version)..." -ForegroundColor Cyan
    $npmTmp = Join-Path $tmp "npm-cores"
    New-Item -ItemType Directory -Path $npmTmp -Force | Out-Null
    Push-Location $npmTmp
    try {
      npm init -y | Out-Null
      npm install --no-save --no-fund --no-audit `
        "@emulatorjs/core-fceumm@$version" `
        "@emulatorjs/core-snes9x@$version" `
        "@emulatorjs/core-gambatte@$version" `
        "@emulatorjs/core-mgba@$version" `
        "@emulatorjs/core-genesis_plus_gx@$version" `
        "@emulatorjs/core-smsplus@$version" `
        "@emulatorjs/core-stella2014@$version" `
        "@emulatorjs/core-mupen64plus_next@$version" `
        "@emulatorjs/core-beetle_vb@$version"
    } finally {
      Pop-Location
    }

    $coresDest = Join-Path $OutDir "data\cores"
    New-Item -ItemType Directory -Path $coresDest -Force | Out-Null
    $pkgRoot = Join-Path $npmTmp "node_modules\@emulatorjs"
    $corePkgs = @(
      "core-fceumm", "core-snes9x", "core-gambatte", "core-mgba",
      "core-genesis_plus_gx", "core-smsplus", "core-stella2014",
      "core-mupen64plus_next", "core-beetle_vb"
    )
    foreach ($name in $corePkgs) {
      $dir = Join-Path $pkgRoot $name
      if (-not (Test-Path $dir)) {
        Write-Host "  missing package $name" -ForegroundColor Yellow
        continue
      }
      Get-ChildItem $dir -Recurse -File |
        Where-Object { $_.Name -match '\.(data|wasm)$' } |
        ForEach-Object { Copy-Item $_.FullName -Destination $coresDest -Force }
      Write-Host "  copied $name" -ForegroundColor DarkGray
    }
  }

  Write-Host "Done. loader at public/emulatorjs/data/loader.js (tag $resolvedTag)" -ForegroundColor Green
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
