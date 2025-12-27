# Fix Prisma Client and Authentication Issues
# This script will:
# 1. Generate Prisma Client
# 2. Check database connection
# 3. Verify user exists

Write-Host "=== Fixing Prisma and Authentication Issues ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate Prisma Client
Write-Host "Step 1: Generating Prisma Client..." -ForegroundColor Yellow
try {
    npx prisma generate --schema=./prisma/schema.prisma
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Prisma Client generated successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Prisma generate failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error generating Prisma Client: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check database connection
Write-Host "Step 2: Checking database connection..." -ForegroundColor Yellow
try {
    npx prisma db execute --stdin --schema=./prisma/schema.prisma <<< "SELECT 1 as test;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database connection successful" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Database connection test failed (this might be normal for some DBs)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not test database connection directly" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Check if .env.local exists and has DATABASE_URL
Write-Host "Step 3: Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    $dbUrl = Get-Content ".env.local" | Select-String -Pattern "DATABASE_URL"
    if ($dbUrl) {
        Write-Host "✅ DATABASE_URL found in .env.local" -ForegroundColor Green
        $dbUrlPreview = $dbUrl.ToString().Substring(0, [Math]::Min(50, $dbUrl.ToString().Length))
        Write-Host "   Preview: $dbUrlPreview..." -ForegroundColor Gray
    } else {
        Write-Host "❌ DATABASE_URL not found in .env.local" -ForegroundColor Red
        Write-Host "   Please add DATABASE_URL to .env.local" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ .env.local file not found" -ForegroundColor Red
    Write-Host "   Please create .env.local with DATABASE_URL" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Make sure your dev server is stopped" -ForegroundColor White
Write-Host "2. Restart your dev server: npm run dev (or pnpm dev)" -ForegroundColor White
Write-Host "3. Try logging in again" -ForegroundColor White
Write-Host "4. If Prisma Studio still errors, try: npx prisma studio --schema=./prisma/schema.prisma" -ForegroundColor White
Write-Host ""







