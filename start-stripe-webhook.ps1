# PowerShell script to start Stripe webhook forwarding
# Run this in a separate terminal while your dev server is running

Write-Host "Starting Stripe webhook forwarding..." -ForegroundColor Green
Write-Host ""
Write-Host "Make sure your dev server is running first!" -ForegroundColor Yellow
Write-Host "Default port: 3000 (check your dev server output)" -ForegroundColor Yellow
Write-Host ""

# Default to port 3000, but allow override
$port = if ($args[0]) { $args[0] } else { "3000" }

Write-Host "Forwarding webhooks to: http://localhost:$port/api/stripe/webhook" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Copy the webhook secret (whsec_...) and add it to .env.local as:" -ForegroundColor Yellow
Write-Host "STRIPE_WEBHOOK_SECRET=whsec_..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Start Stripe CLI listen
stripe listen --forward-to "localhost:$port/api/stripe/webhook"






