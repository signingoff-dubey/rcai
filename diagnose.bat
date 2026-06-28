@echo off
title RCAi - Diagnosis
cd /d "%~dp0"

echo ============================================
echo  RCAi - Diagnostic Tool
echo ============================================
echo.

:: Check ports
echo [PORTS]
netstat -ano | findstr ":8000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo   Port 8000: IN USE (Backend)
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (
        for /f %%b in ("%%a") do echo   PID: %%b
    )
) else (
    echo   Port 8000: FREE
)

netstat -ano | findstr ":5173 " >nul 2>&1
if %errorlevel% equ 0 (
    echo   Port 5173: IN USE (Frontend)
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 "') do (
        for /f %%b in ("%%a") do echo   PID: %%b
    )
) else (
    echo   Port 5173: FREE
)

:: Check Python
echo.
echo [PYTHON]
python --version 2>&1 || echo   NOT FOUND

:: Check Node
echo.
echo [NODE]
node --version 2>&1 || echo   NOT FOUND

:: Check frontend files
echo.
echo [FRONTEND FILES]
if exist "frontend\node_modules" ( echo   node_modules: YES ) else ( echo   node_modules: MISSING )
if exist "frontend\vite.config.js" ( echo   vite.config.js: OK ) else ( echo   vite.config.js: MISSING )
if exist "frontend\src\main.jsx" ( echo   main.jsx: OK ) else ( echo   main.jsx: MISSING )
if exist "frontend\src\App.jsx" ( echo   App.jsx: OK ) else ( echo   App.jsx: MISSING )

:: Check backend
echo.
echo [BACKEND FILES]
if exist "venv" ( echo   venv: YES ) else ( echo   venv: MISSING )
if exist "backend\main.py" ( echo   main.py: OK ) else ( echo   main.py: MISSING )
if exist "backend\rcai.db" ( echo   rcai.db: EXISTS ) else ( echo   rcai.db: NOT YET CREATED )

:: Test backend
echo.
echo [BACKEND TEST]
>nul 2>&1 curl -s http://localhost:8000/api/health
if %errorlevel% equ 0 (
    echo   Backend: RESPONDING
    curl -s http://localhost:8000/api/health
) else (
    echo   Backend: NOT RESPONDING
)

:: Test frontend
echo.
echo [FRONTEND TEST]
>nul 2>&1 curl -s http://localhost:5173
if %errorlevel% equ 0 (
    echo   Frontend: RESPONDING
) else (
    echo   Frontend: NOT RESPONDING
)

echo.
pause
