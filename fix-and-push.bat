@echo off
del /f /q ".git\index.lock" 2>nul
git add -A
git commit -m "Add SVG visuals, progress dashboard, You've got this footer, completed tracking"
git push origin main
echo Done! Press any key to close.
pause
