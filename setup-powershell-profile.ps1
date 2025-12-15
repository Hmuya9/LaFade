# Setup PowerShell Profile to Auto-Load Node.js PATH
# Run this ONCE to set up your PowerShell profile

$profilePath = $PROFILE.CurrentUserAllHosts
$profileDir = Split-Path $profilePath -Parent

Write-Host "Setting up PowerShell profile..." -ForegroundColor Cyan
Write-Host "Profile will be at: $profilePath" -ForegroundColor Gray
Write-Host ""

# Create profile directory if it doesn't exist
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    Write-Host "✅ Created profile directory" -ForegroundColor Green
}

# Check if profile already exists
$profileExists = Test-Path $profilePath
if ($profileExists) {
    Write-Host "⚠️  Profile already exists. Backing up..." -ForegroundColor Yellow
    Copy-Item $profilePath "$profilePath.backup" -Force
    Write-Host "   Backup saved to: $profilePath.backup" -ForegroundColor Gray
}

# Add PATH refresh to profile
$pathRefreshCode = @"

# Auto-refresh PATH for Node.js (added by setup-powershell-profile.ps1)
`$machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
`$userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
`$env:PATH = "`$machinePath;`$userPath"

"@

if ($profileExists) {
    # Append to existing profile
    Add-Content -Path $profilePath -Value "`n$pathRefreshCode"
    Write-Host "✅ Added PATH refresh to existing profile" -ForegroundColor Green
} else {
    # Create new profile
    Set-Content -Path $profilePath -Value $pathRefreshCode
    Write-Host "✅ Created new profile with PATH refresh" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Your PowerShell profile will now automatically refresh PATH on startup." -ForegroundColor White
Write-Host ""
Write-Host "To apply immediately:" -ForegroundColor Yellow
Write-Host "  . `$PROFILE" -ForegroundColor Gray
Write-Host ""
Write-Host "Or restart PowerShell to load the profile automatically." -ForegroundColor White






