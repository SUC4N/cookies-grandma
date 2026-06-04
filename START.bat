@echo off
title Cookies Grandma Server
color 4F

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🍪  Cookies Grandma — Starting Server      ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo  ❌ Node.js not found!
  echo     Please install from: https://nodejs.org
  pause
  exit /b 1
)

:: Install dependencies if node_modules missing
if not exist "node_modules\" (
  echo  📦 Installing dependencies...
  call npm install
  echo.
)

:: Setup database if not exists
if not exist "database\cookiesgrandma.db" (
  echo  🗄️  Setting up database...
  call node database/setup.js
  echo.
)

:: Start server
echo  🚀 Starting server on http://localhost:3000
echo  🔧 Admin panel:  http://localhost:3000/admin
echo  📡 API:          http://localhost:3000/api
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after 2 seconds
start "" timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: Run server
node server.js

pause
