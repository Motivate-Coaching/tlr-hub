# Find git
$gitPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    (Get-Command git -ErrorAction SilentlyContinue)?.Source
)
$git = $gitPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $git) {
    # Try GitHub Desktop's bundled git
    $ghd = Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop" -Filter "git.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ghd) { $git = $ghd.FullName }
}

if (-not $git) {
    Write-Host "Could not find git.exe" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Using git at: $git" -ForegroundColor Cyan

Set-Location $PSScriptRoot

# Remove lock file
$lock = ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "Removed index.lock" -ForegroundColor Green
}

& $git add -A
& $git commit -m "Add SVG visuals, progress dashboard, You've got this footer, completed tracking"
& $git push origin main

Write-Host "`nDone!" -ForegroundColor Green
pause
