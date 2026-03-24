@echo off
REM Worker Safety SOS System - Installation & Setup Script (Windows)
REM Run this batch file to automatically set up the backend server

cls
echo.
echo ╔════════════════════════════════════════╗
echo ║  🚨 SATEY Worker Safety Setup Script   ║
echo ║      Windows Version                   ║
echo ╚════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Download from: https://nodejs.org/ (LTS version)
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm found: %NPM_VERSION%
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    type .env.example > .env
    echo ⚠️  Please update .env with your Supabase credentials:
    echo    - SUPABASE_URL
    echo    - SUPABASE_ANON_KEY
    echo.
)

echo ✅ Setup complete!
echo.
echo 🚀 To start the server, run:
echo    npm start
echo.
echo 📍 Dashboard will be available at:
echo    http://localhost:3000/worker-dashboard.html
echo.
echo Before running the server, make sure to:
echo 1. Update ESP32 WiFi credentials in esp32.i
echo 2. Update Supabase credentials in .env
echo 3. Configure database as per WORKER_SAFETY_SETUP.md
echo.
pause
