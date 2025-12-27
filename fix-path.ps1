# Quick PATH fix for Node.js commands
# Run this in any PowerShell session: . .\fix-path.ps1

Write-Host "Refreshing PATH..." -ForegroundColor Yellow

# Get system and user PATH
$machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")

# Combine and set
$env:PATH = "$machinePath;$userPath"

# Verify Node.js is accessible
$nodePath = Get-Command node -ErrorAction SilentlyContinue
$npxPath = Get-Command npx -ErrorAction SilentlyContinue
$pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue

Write-Host ""
if ($nodePath) {
    Write-Host "✅ Node.js found: $($nodePath.Source)" -ForegroundColor Green
    node --version
} else {
    Write-Host "❌ Node.js not found in PATH" -ForegroundColor Red
}

if ($npxPath) {
    Write-Host "✅ npx found: $($npxPath.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ npx not found in PATH" -ForegroundColor Red
    Write-Host "   Trying direct path..." -ForegroundColor Yellow
    if (Test-Path "C:\Program Files (x86)\nodejs\npx.cmd") {
        Write-Host "   Found at: C:\Program Files (x86)\nodejs\npx.cmd" -ForegroundColor Green
    }
}

if ($pnpmPath) {
    Write-Host "✅ pnpm found: $($pnpmPath.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ pnpm not found in PATH" -ForegroundColor Red
    Write-Host "   Trying direct path..." -ForegroundColor Yellow
    if (Test-Path "C:\Program Files (x86)\nodejs\pnpm.ps1") {
        Write-Host "   Found at: C:\Program Files (x86)\nodejs\pnpm.ps1" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "PATH refreshed! Try running your commands now." -ForegroundColor Cyan
Write-Host "Example: npx prisma studio" -ForegroundColor Gray







