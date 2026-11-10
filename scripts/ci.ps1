<#
.SYNOPSIS
  Local CI runner script for Windows PowerShell
#>
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Starting Local CI for Desktop Google Apps (Windows)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# Delegate to WSL execution to ensure clean toolchain invocation per user environment
Write-Host ""
Write-Host "-> Running CI steps inside WSL toolchain environment..." -ForegroundColor Yellow
wsl bash -lc "cd /mnt/c/Users/andrey/Documents/GitHub/desktop-google-apps && bash scripts/ci.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Error "CI pipeline failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Windows Local CI Completed Successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
