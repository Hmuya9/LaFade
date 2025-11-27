# PowerShell script to fix database synchronization issues
# Run this from the web/ directory

Write-Host "LaFade Database Sync Fix" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory (should be web/)
$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Get-Location
}

Write-Host "Working directory: $scriptDir" -ForegroundColor Gray
Write-Host ""

# Step 1: Remove duplicate database
Write-Host "Step 1: Checking for duplicate database..." -ForegroundColor Yellow
$duplicatePath = Join-Path $scriptDir "prisma\prisma\dev.db"
if (Test-Path $duplicatePath) {
    Write-Host "  Found duplicate at: $duplicatePath" -ForegroundColor Red
    Remove-Item -Recurse -Force (Join-Path $scriptDir "prisma\prisma")
    Write-Host "  Removed duplicate database directory" -ForegroundColor Green
} else {
    Write-Host "  No duplicate database found" -ForegroundColor Green
}
Write-Host ""

# Step 2: Verify main database exists
Write-Host "Step 2: Verifying main database..." -ForegroundColor Yellow
$mainDbPath = Join-Path $scriptDir "prisma\dev.db"
if (Test-Path $mainDbPath) {
    $dbSize = (Get-Item $mainDbPath).Length
    Write-Host "  Main database exists: $mainDbPath" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($dbSize/1KB, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "  Main database not found (will be created on first migration)" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Check .env.local
Write-Host "Step 3: Checking .env.local..." -ForegroundColor Yellow
$envLocalPath = Join-Path $scriptDir ".env.local"
if (Test-Path $envLocalPath) {
    $content = Get-Content $envLocalPath
    $dbUrlLine = $content | Where-Object { $_ -match "^DATABASE_URL" }
    if ($dbUrlLine) {
        Write-Host "  Found DATABASE_URL in .env.local" -ForegroundColor Green
        Write-Host "  Value: $dbUrlLine" -ForegroundColor Gray
        if ($dbUrlLine -match 'file:\./prisma/dev\.db') {
            Write-Host "  Path is correct (relative to web/)" -ForegroundColor Green
        } else {
            Write-Host "  Path might be incorrect" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  DATABASE_URL not found in .env.local" -ForegroundColor Red
        Write-Host "  Adding DATABASE_URL..." -ForegroundColor Yellow
        Add-Content -Path $envLocalPath -Value "`nDATABASE_URL=`"file:./prisma/dev.db`""
        Write-Host "  Added DATABASE_URL" -ForegroundColor Green
    }
} else {
    Write-Host "  .env.local does not exist" -ForegroundColor Yellow
    Write-Host "  Creating .env.local with DATABASE_URL..." -ForegroundColor Yellow
    'DATABASE_URL="file:./prisma/dev.db"' | Out-File -FilePath $envLocalPath -Encoding utf8
    Write-Host "  Created .env.local" -ForegroundColor Green
}
Write-Host ""

# Step 4: Check prisma/.env
Write-Host "Step 4: Checking prisma/.env..." -ForegroundColor Yellow
$prismaEnvPath = Join-Path $scriptDir "prisma\.env"
if (Test-Path $prismaEnvPath) {
    $content = Get-Content $prismaEnvPath
    $dbUrlLine = $content | Where-Object { $_ -match "^DATABASE_URL" }
    if ($dbUrlLine) {
        Write-Host "  Found DATABASE_URL in prisma/.env" -ForegroundColor Green
        Write-Host "  Value: $dbUrlLine" -ForegroundColor Gray
        # When Prisma Studio runs from prisma/, it needs file:./dev.db
        if ($dbUrlLine -match 'file:\./dev\.db') {
            Write-Host "  Path is correct for Prisma Studio (relative to prisma/)" -ForegroundColor Green
        } elseif ($dbUrlLine -match 'file:\./prisma/dev\.db') {
            Write-Host "  Path might not work when Prisma Studio runs from prisma/" -ForegroundColor Yellow
            Write-Host "  Updating to use relative path from prisma/..." -ForegroundColor Yellow
            $newContent = $content | Where-Object { $_ -notmatch "^DATABASE_URL" }
            $newContent += 'DATABASE_URL="file:./dev.db"'
            $newContent | Out-File -FilePath $prismaEnvPath -Encoding utf8
            Write-Host "  Updated prisma/.env" -ForegroundColor Green
        }
    } else {
        Write-Host "  DATABASE_URL not found in prisma/.env" -ForegroundColor Yellow
        Write-Host "  Adding DATABASE_URL..." -ForegroundColor Yellow
        # Prisma Studio runs from prisma/, so path should be relative to that
        'DATABASE_URL="file:./dev.db"' | Out-File -FilePath $prismaEnvPath -Encoding utf8
        Write-Host "  Added DATABASE_URL" -ForegroundColor Green
    }
} else {
    Write-Host "  Creating prisma/.env..." -ForegroundColor Yellow
    # Prisma Studio runs from prisma/, so path should be relative to that
    'DATABASE_URL="file:./dev.db"' | Out-File -FilePath $prismaEnvPath -Encoding utf8
    Write-Host "  Created prisma/.env" -ForegroundColor Green
}
Write-Host ""

# Step 5: Verify paths resolve correctly
Write-Host "Step 5: Verifying path resolution..." -ForegroundColor Yellow
$expectedDbFromWeb = Join-Path $scriptDir "prisma\dev.db"

if (Test-Path $expectedDbFromWeb) {
    Write-Host "  Database accessible from web/ directory" -ForegroundColor Green
} else {
    Write-Host "  Database not accessible from web/ directory" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Database sync fix complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: pnpm prisma generate" -ForegroundColor White
Write-Host "  2. Run: pnpm prisma db push" -ForegroundColor White
Write-Host "  3. Run: pnpm prisma studio" -ForegroundColor White
Write-Host "  4. Sign up a new user in the app" -ForegroundColor White
Write-Host "  5. Refresh Prisma Studio to verify sync" -ForegroundColor White
Write-Host ""
