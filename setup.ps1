Set-StrictMode -Version Latest
Write-Host 'Installing dependencies...'
npm install
Write-Host 'Installing Playwright browsers...'
npx playwright install
Write-Host 'Building TypeScript and UI assets...'
npm run build
New-Item -ItemType Directory -Force -Path .\data\media | Out-Null
New-Item -ItemType Directory -Force -Path .\exports | Out-Null
Write-Host 'Setup complete.'
