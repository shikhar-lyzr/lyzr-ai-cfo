#!/usr/bin/env pwsh
# Bundle non-git pieces (env files + Claude project memory) into a tarball
# for transfer to a Mac. Run from the repo root on Windows.
#
# Output: ./migrate/lyzr-cfo-handoff-<timestamp>.tar.gz

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$memoryDir = "$env:USERPROFILE\.claude\projects\c--Users-shikh-lyzr-ai-cfo\memory"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stagingDir = "$PSScriptRoot\.staging-$timestamp"
$outputTar = "$PSScriptRoot\lyzr-cfo-handoff-$timestamp.tar.gz"

Write-Host "Repo root:   $repoRoot"
Write-Host "Memory dir:  $memoryDir"
Write-Host "Output:      $outputTar"
Write-Host ""

if (-not (Test-Path $memoryDir)) {
    Write-Error "Memory dir not found at $memoryDir"
    exit 1
}

# Stage the files
New-Item -ItemType Directory -Force -Path "$stagingDir\env" | Out-Null
New-Item -ItemType Directory -Force -Path "$stagingDir\memory" | Out-Null

# Copy env files (anything matching .env* in repo root, except .env.example which is already in git)
Get-ChildItem -Path $repoRoot -Filter ".env*" -Force | Where-Object {
    $_.Name -ne ".env.example"
} | ForEach-Object {
    Copy-Item $_.FullName "$stagingDir\env\" -Force
    Write-Host "  staged env: $($_.Name)"
}

# Copy memory files
Copy-Item "$memoryDir\*" "$stagingDir\memory\" -Recurse -Force
Write-Host "  staged memory: $((Get-ChildItem $stagingDir\memory).Count) files"

# Drop the restore script in the bundle so it travels with it
Copy-Item "$PSScriptRoot\restore-on-mac.sh" "$stagingDir\" -Force
Copy-Item "$PSScriptRoot\README.md" "$stagingDir\" -Force -ErrorAction SilentlyContinue

# Tar it up. Windows 10+ ships tar.exe.
Push-Location $stagingDir
try {
    tar -czf $outputTar *
} finally {
    Pop-Location
}

# Clean staging
Remove-Item -Recurse -Force $stagingDir

Write-Host ""
Write-Host "Bundle ready: $outputTar"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Transfer the tarball to your Mac (AirDrop, scp, USB, cloud drive)."
Write-Host "  2. On the Mac: clone the repo, then run the restore script:"
Write-Host "       tar -xzf lyzr-cfo-handoff-*.tar.gz -C /tmp/lyzr-handoff"
Write-Host "       bash /tmp/lyzr-handoff/restore-on-mac.sh /path/to/cloned/repo"
