# Fix Database Lock Issue
# This script helps diagnose and fix SQLite database lock issues

Write-Host "🔍 Diagnosing Database Lock Issue..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "prisma/schema.prisma")) {
    Write-Host "❌ Error: Must run from web/ directory" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Check if database file exists
$dbPath = "prisma/dev.db"
if (Test-Path $dbPath) {
    Write-Host "✅ Database file exists: $dbPath" -ForegroundColor Green
    $fileInfo = Get-Item $dbPath
    Write-Host "   Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
    Write-Host "   Last modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
} else {
    Write-Host "❌ Database file NOT found: $dbPath" -ForegroundColor Red
    Write-Host "   Will recreate it..." -ForegroundColor Yellow
}

# Check DATABASE_URL in .env.local
Write-Host ""
Write-Host "📋 Checking DATABASE_URL configuration..." -ForegroundColor Cyan

if (Test-Path ".env.local") {
    $dbUrl = Get-Content ".env.local" | Select-String "DATABASE_URL"
    if ($dbUrl) {
        Write-Host "✅ DATABASE_URL found:" -ForegroundColor Green
        Write-Host "   $dbUrl" -ForegroundColor Gray
    } else {
        Write-Host "❌ DATABASE_URL not found in .env.local" -ForegroundColor Red
    }
} else {
    Write-Host "❌ .env.local file not found" -ForegroundColor Red
}

# Check for Prisma Studio processes
Write-Host ""
Write-Host "🔍 Checking for Prisma Studio processes..." -ForegroundColor Cyan
$prismaStudio = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*prisma studio*" -or $_.Path -like "*prisma*"
}
if ($prismaStudio) {
    Write-Host "⚠️  Prisma Studio or related process detected!" -ForegroundColor Yellow
    Write-Host "   Please close Prisma Studio before continuing" -ForegroundColor Yellow
} else {
    Write-Host "✅ No Prisma Studio processes detected" -ForegroundColor Green
}

# Check for Node processes (dev server)
Write-Host ""
Write-Host "🔍 Checking for Node.js processes (dev server)..." -ForegroundColor Cyan
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⚠️  Node.js processes detected:" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "   PID: $($_.Id) - $($_.ProcessName)" -ForegroundColor Gray
    }
    Write-Host "   You may need to stop the dev server (Ctrl+C)" -ForegroundColor Yellow
} else {
    Write-Host "✅ No Node.js processes detected" -ForegroundColor Green
}

# Instructions
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Close Prisma Studio if open" -ForegroundColor White
Write-Host "   2. Stop dev server (Ctrl+C)" -ForegroundColor White
Write-Host "   3. Wait 2-3 seconds" -ForegroundColor White
Write-Host "   4. Run: pnpm prisma db push" -ForegroundColor White
Write-Host "   5. Restart dev server: pnpm dev" -ForegroundColor White
Write-Host ""

# Ask if user wants to recreate database
$recreate = Read-Host "Do you want to recreate the database? (y/n)"
if ($recreate -eq "y" -or $recreate -eq "Y") {
    Write-Host ""
    Write-Host "🔄 Recreating database..." -ForegroundColor Cyan
    
    # Stop any processes that might lock the file
    Write-Host "   Stopping Node processes..." -ForegroundColor Gray
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    # Push schema
    Write-Host "   Running: pnpm prisma db push" -ForegroundColor Gray
    pnpm prisma db push
    
    Write-Host ""
    Write-Host "✅ Database recreated!" -ForegroundColor Green
    Write-Host "   Now restart dev server: pnpm dev" -ForegroundColor Yellow
}




