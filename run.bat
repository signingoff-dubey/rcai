@echo off
setlocal enabledelayedexpansion
title RCAi - Root Cause Analysis Platform
cd /d "%~dp0"

echo ============================================
echo  RCAi - Software Failure Root Cause Analysis
echo ============================================

echo.
echo [1/3] Prerequisites...
where python >nul 2>&1 || ( echo [FAIL] Python not found & pause & exit /b 1 )
python --version
where node >nul 2>&1 || ( echo [FAIL] Node.js not found & pause & exit /b 1 )
node --version

echo.
echo [2/3] Backend...
if not exist "venv" ( python -m venv venv )
call "venv\Scripts\activate.bat" >nul 2>&1

set REQ_HASH=
if exist "backend\requirements.txt" (
    for /f "tokens=*" %%a in ('certutil -hashfile "backend\requirements.txt" MD5 2^>nul ^| findstr /v "MD5" ^| findstr /v "CertUtil"') do set REQ_HASH=%%a
)
if "%REQ_HASH%"=="" set REQ_HASH=unknown
set INSTALLED_HASH=
if exist "venv\.deps_hash" set /p INSTALLED_HASH=<"venv\.deps_hash"
if not "%INSTALLED_HASH%"=="%REQ_HASH%" (
    echo   Installing/updating Python deps...
    pip install -r "backend\requirements.txt" --quiet || ( echo [FAIL] pip & pause & exit /b 1 )
    echo %REQ_HASH%> "venv\.deps_hash"
) else ( echo   Python deps up to date )

if not exist ".env" ( echo GROQ_API_KEY=your_key_here > ".env" )

echo.
echo [3/3] Frontend...
if not exist "frontend\node_modules" (
    echo   Installing frontend deps...
    pushd "frontend" && call npm install --loglevel=warn && popd
)
if exist "frontend\dist" ( rmdir /s /q "frontend\dist" 2>nul )

:: ──────────────────────────────────────
:: Launch both servers
:: ──────────────────────────────────────
echo.
echo ============================================
echo  STARTING SERVERS
echo  Close this window to stop everything.
echo ============================================
echo.

echo --- BACKEND (port 8000) ---
start "RCAi Backend" /D "%~dp0" cmd /c "title RCAi Backend && call venv\Scripts\activate.bat && uvicorn backend.main:app --reload --port 8000 || pause"

echo --- FRONTEND (port 5173) ---
start "RCAi Frontend" /D "%~dp0frontend" cmd /c "title RCAi Frontend && npm run dev || pause"

:: Wait for both servers to start
echo Waiting for servers (10s)...
timeout /t 10 /nobreak >nul

echo.
echo ============================================
echo  Both servers should be ready!
echo  Opening http://localhost:5173 ...
echo ============================================
echo.

:: Open browser — try multiple methods
rundll32.exe url.dll,FileProtocolHandler http://localhost:5173

echo.
echo  If browser didn't open, paste this in your browser:
echo  http://localhost:5173
echo.
echo  TIP: If page is blank, press F12 in browser
echo  and check the Console tab for errors.
echo.

:wait
pause >nul
goto wait
