@echo off
title Organize Cookies Grandma Project
echo.
echo  Copying frontend files to frontend/ folder...
echo.

:: Copy HTML files
copy /Y "index.html"  "frontend\index.html"
copy /Y "admin.html"  "frontend\admin.html"

:: Copy Resources folder (images)
if not exist "frontend\Resources" mkdir "frontend\Resources"
xcopy /E /Y /Q "Resources\*" "frontend\Resources\"

echo  Done! frontend/ folder is ready for Vercel.
echo.
echo  Your project structure:
echo    frontend/   ^<-- Deploy to Vercel
echo    backend/    ^<-- Deploy to Render
echo    render.yaml ^<-- Render config
echo.
pause
