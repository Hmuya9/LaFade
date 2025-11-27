# Fix Database Access Issue (Error code 14)
# This script fixes the SQLite database lock/access problem

Write-Host "🔧 Fixing Database Access Issue..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "prisma/schema.prisma")) {
    Write-Host "❌ Error: Must run from web/ directory" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Checking for lock files..." -ForegroundColor Yellow
$lockFiles = @("prisma/dev.db-journal", "prisma/dev.db-wal", "prisma/dev.db-shm")
$foundLocks = $false

foreach ($file in $lockFiles) {
    if (Test-Path $file) {
        Write-Host "   Found lock file: $file" -ForegroundColor Yellow
        $foundLocks = $true
    }
}

if ($foundLocks) {
    Write-Host "   Removing lock files..." -ForegroundColor Yellow
    foreach ($file in $lockFiles) {
        if (Test-Path $file) {
            Remove-Item $file -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ Removed: $file" -ForegroundColor Green
        }
    }
} else {
    Write-Host "   ✅ No lock files found" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Checking DATABASE_URL configuration..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    $dbUrl = Get-Content ".env.local" | Select-String "DATABASE_URL"
    if ($dbUrl) {
        Write-Host "   Current DATABASE_URL:" -ForegroundColor Gray
        Write-Host "   $dbUrl" -ForegroundColor Gray
        
        # Check if it's using relative path
        if ($dbUrl -match 'file:\./') {
            Write-Host "   ✅ Using relative path (correct)" -ForegroundColor Green
        } elseif ($dbUrl -match 'file:[A-Z]:') {
            Write-Host "   ⚠️  Using absolute path (may cause issues)" -ForegroundColor Yellow
            Write-Host "   Recommended: Use 'file:./prisma/dev.db' instead" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ DATABASE_URL not found in .env.local" -ForegroundColor Red
        Write-Host "   Adding DATABASE_URL..." -ForegroundColor Yellow
        Add-Content ".env.local" "`nDATABASE_URL=`"file:./prisma/dev.db`""
        Write-Host "   ✅ Added DATABASE_URL" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ .env.local not found" -ForegroundColor Red
    Write-Host "   Creating .env.local with DATABASE_URL..." -ForegroundColor Yellow
    @"
DATABASE_URL="file:./prisma/dev.db"
"@ | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host "   ✅ Created .env.local" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 3: Checking database file..." -ForegroundColor Yellow
if (Test-Path "prisma/dev.db") {
    $fileInfo = Get-Item "prisma/dev.db"
    Write-Host "   ✅ Database file exists" -ForegroundColor Green
    Write-Host "   Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Database file not found" -ForegroundColor Yellow
    Write-Host "   Will be created when running 'pnpm prisma db push'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 4: Stopping processes that might lock the database..." -ForegroundColor Yellow

# Check for Prisma Studio
$prismaStudio = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*prisma studio*" -or $_.MainWindowTitle -like "*Prisma Studio*"
}
if ($prismaStudio) {
    Write-Host "   Found Prisma Studio process, stopping..." -ForegroundColor Yellow
    $prismaStudio | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Stopped Prisma Studio" -ForegroundColor Green
} else {
    Write-Host "   ✅ No Prisma Studio process found" -ForegroundColor Green
}

# Check for Node processes (dev server)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   ⚠️  Node.js processes detected (dev server may be running)" -ForegroundColor Yellow
    Write-Host "   You may need to stop dev server manually (Ctrl+C)" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ No Node.js processes detected" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 5: Regenerating Prisma Client..." -ForegroundColor Yellow
pnpm prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Prisma Client regenerated" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Prisma generate had issues (may need to stop dev server first)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 6: Pushing database schema..." -ForegroundColor Yellow
pnpm prisma db push
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Database schema pushed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Database push had issues" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Fix Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Make sure Prisma Studio is CLOSED" -ForegroundColor White
Write-Host "   2. Start dev server: pnpm dev" -ForegroundColor White
Write-Host "   3. Try logging in at http://localhost:3000/login" -ForegroundColor White
Write-Host "   4. Watch terminal for [auth] logs" -ForegroundColor White
Write-Host ""




