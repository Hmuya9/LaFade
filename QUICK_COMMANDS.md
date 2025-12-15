# Quick Commands Reference

## ⚡ Immediate Fix (Run in PowerShell)

If `npx` or `pnpm` commands don't work, run this first:

```powershell
# Quick PATH refresh
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
```

Then your commands will work:
```powershell
npx prisma studio
pnpm dev
npm run prisma:studio
```

## 🔧 Permanent Fix (One-Time Setup)

Run this script ONCE to fix PATH in all future PowerShell sessions:

```powershell
cd web
.\setup-powershell-profile.ps1
```

This will:
- Create/update your PowerShell profile
- Automatically refresh PATH every time you open PowerShell
- Make `npx`, `pnpm`, and `npm` work without manual PATH refresh

## 📋 Common Commands

### Prisma
```powershell
npm run prisma:studio      # Open Prisma Studio
npm run prisma:generate    # Generate Prisma Client
npm run db:migrate         # Push schema changes
```

### Development
```powershell
npm run dev                # Start dev server
npm run build              # Build for production
npm run typecheck          # Type check
```

### Using Direct Paths (If PATH still doesn't work)
```powershell
& "C:\Program Files (x86)\nodejs\npx.cmd" prisma studio
& "C:\Program Files (x86)\nodejs\pnpm.ps1" dev
```

## 🐛 Troubleshooting

### If commands still don't work after PATH refresh:

1. **Check Node.js is installed:**
   ```powershell
   Test-Path "C:\Program Files (x86)\nodejs\node.exe"
   ```

2. **Check npx exists:**
   ```powershell
   Test-Path "C:\Program Files (x86)\nodejs\npx.cmd"
   ```

3. **Use direct paths:**
   ```powershell
   & "C:\Program Files (x86)\nodejs\npx.cmd" --version
   ```

4. **Check PowerShell execution policy:**
   ```powershell
   Get-ExecutionPolicy
   # If it's Restricted, you may need to allow scripts
   ```






